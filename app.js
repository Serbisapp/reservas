const STORAGE_KEY = "reservas-state-v1";

const TYPE_LABELS = {
  Fernet: "Fernet",
  Gin: "Gin",
  Vodka: "Vodka",
  Whisky: "Whisky",
  Rum: "Ron",
  Wine: "Vino",
  Beer: "Cerveza",
  Other: "Otro"
};

const TYPE_EMOJIS = {
  Fernet: "🥃",
  Gin: "🍸",
  Vodka: "🍹",
  Whisky: "🥃",
  Rum: "🍹",
  Wine: "🍷",
  Beer: "🍺",
  Other: "🍾"
};

const UNIT_LABELS = {
  bottles: "botellas",
  ml: "ml",
  cans: "latas",
  liters: "litros"
};

const DEFAULTS_BY_TYPE = {
  Fernet: { servingMl: 60, mixerName: "Coca", mixerMl: 180, bottleMl: 750 },
  Gin: { servingMl: 50, mixerName: "Tónica", mixerMl: 150, bottleMl: 700 },
  Vodka: { servingMl: 50, mixerName: "Jugo", mixerMl: 150, bottleMl: 750 },
  Whisky: { servingMl: 60, mixerName: "", mixerMl: 0, bottleMl: 750 },
  Rum: { servingMl: 50, mixerName: "Coca", mixerMl: 150, bottleMl: 750 },
  Wine: { servingMl: 150, mixerName: "", mixerMl: 0, bottleMl: 750 },
  Beer: { servingMl: 473, mixerName: "", mixerMl: 0, bottleMl: 473 },
  Other: { servingMl: 50, mixerName: "", mixerMl: 0, bottleMl: 750 }
};

const sampleState = {
  items: [
    {
      id: crypto.randomUUID(),
      name: "Fernet Branca",
      type: "Fernet",
      unit: "bottles",
      amount: 1.5,
      bottleMl: 750,
      servingMl: 60,
      mixerName: "Coca",
      mixerMl: 180,
      location: "Casa de Nico, alacena",
      updatedAt: Date.now() - 1000 * 60 * 34
    },
    {
      id: crypto.randomUUID(),
      name: "Gin London Dry",
      type: "Gin",
      unit: "bottles",
      amount: 2,
      bottleMl: 700,
      servingMl: 50,
      mixerName: "Tónica",
      mixerMl: 150,
      location: "Heladera grande",
      updatedAt: Date.now() - 1000 * 60 * 75
    },
    {
      id: crypto.randomUUID(),
      name: "Birras IPA",
      type: "Beer",
      unit: "cans",
      amount: 12,
      bottleMl: 473,
      servingMl: 473,
      mixerName: "",
      mixerMl: 0,
      location: "Heladera de abajo",
      updatedAt: Date.now() - 1000 * 60 * 140
    }
  ],
  log: [
    { id: crypto.randomUUID(), text: "Arrancó la barra con reservas de ejemplo", at: Date.now() - 1000 * 60 * 120 }
  ],
  planner: { people: 8, drinksEach: 4 },
  updatedAt: Date.now()
};

const state = {
  items: [],
  log: [],
  planner: { people: 8, drinksEach: 4 },
  updatedAt: Date.now()
};

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  readinessCopy: document.querySelector("#readinessCopy"),
  totalBottles: document.querySelector("#totalBottles"),
  totalDrinks: document.querySelector("#totalDrinks"),
  totalDrinksHero: document.querySelector("#totalDrinksHero"),
  mixGap: document.querySelector("#mixGap"),
  glassFill: document.querySelector("#glassFill"),
  form: document.querySelector("#itemForm"),
  editingId: document.querySelector("#editingId"),
  name: document.querySelector("#nameInput"),
  type: document.querySelector("#typeInput"),
  unit: document.querySelector("#unitInput"),
  amount: document.querySelector("#amountInput"),
  bottleMl: document.querySelector("#bottleMlInput"),
  servingMl: document.querySelector("#servingMlInput"),
  location: document.querySelector("#locationInput"),
  saveItem: document.querySelector("#saveItemBtn"),
  resetForm: document.querySelector("#resetFormBtn"),
  people: document.querySelector("#peopleInput"),
  drinksEach: document.querySelector("#drinksEachInput"),
  plannerCopy: document.querySelector("#plannerCopy"),
  mixBreakdown: document.querySelector("#mixBreakdown"),
  search: document.querySelector("#searchInput"),
  filter: document.querySelector("#filterInput"),
  inventoryList: document.querySelector("#inventoryList"),
  emptyState: document.querySelector("#emptyState"),
  stockSubtitle: document.querySelector("#stockSubtitle"),
  activityLog: document.querySelector("#activityLog"),
  clearLog: document.querySelector("#clearLogBtn"),
  share: document.querySelector("#shareBtn"),
  export: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  toast: document.querySelector("#toast")
};

let remote = null;
let applyingRemote = false;
let toastTimer = null;

init();

async function init() {
  loadFromUrlSnapshot();
  loadLocalState();
  bindEvents();
  applyTypeDefaults();
  await setupBackend();
  render();
}

function bindEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveForm();
  });

  els.type.addEventListener("change", applyTypeDefaults);
  els.resetForm.addEventListener("click", resetForm);
  els.search.addEventListener("input", renderInventory);
  els.filter.addEventListener("change", renderInventory);

  els.people.addEventListener("input", () => {
    state.planner.people = positiveNumber(els.people.value, 1);
    persist("Se actualizó la cantidad de personas");
  });

  els.drinksEach.addEventListener("input", () => {
    state.planner.drinksEach = positiveNumber(els.drinksEach.value, 1);
    persist("Se actualizó el plan de tragos");
  });

  els.clearLog.addEventListener("click", () => {
    state.log = [];
    persist("Se borró el historial", { silentLog: true });
  });

  els.share.addEventListener("click", copySnapshotLink);
  els.export.addEventListener("click", exportData);
  els.importFile.addEventListener("change", importData);
}

async function setupBackend() {
  const config = window.RESERVAS_CONFIG || { backend: "local" };
  if (config.backend !== "firebase") {
    els.syncStatus.textContent = "Modo local";
    return;
  }

  try {
    const [{ initializeApp }, { getDatabase, ref, onValue, set }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")
    ]);
    const app = initializeApp(config.firebase);
    const db = getDatabase(app);
    const stateRef = ref(db, `reservas/${config.room || "main"}`);

    remote = {
      save: (nextState) => set(stateRef, sanitizeState(nextState))
    };

    onValue(stateRef, (snapshot) => {
      const remoteState = snapshot.val();
      if (!remoteState) {
        remote.save(state);
        return;
      }
      applyingRemote = true;
      Object.assign(state, normalizeState(remoteState));
      saveLocalState();
      render();
      applyingRemote = false;
    });

    els.syncStatus.textContent = `Sala en vivo: ${config.room || "main"}`;
  } catch (error) {
    console.error(error);
    els.syncStatus.textContent = "Modo local";
    showToast("Firebase no cargó. Queda guardado local.");
  }
}

function loadFromUrlSnapshot() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const encoded = params.get("stock");
  if (!encoded) return;

  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(decoded)));
    history.replaceState(null, "", window.location.pathname + window.location.search);
    showToast("Snapshot importado en este navegador.");
  } catch (error) {
    console.error(error);
    showToast("Ese link de stock no se pudo leer.");
  }
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const next = saved ? JSON.parse(saved) : sampleState;
  Object.assign(state, normalizeState(next));
  saveLocalState();
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
}

function persist(message, options = {}) {
  state.updatedAt = Date.now();
  if (message && !options.silentLog) addLog(message);
  saveLocalState();
  render();

  if (remote && !applyingRemote) {
    remote.save(state).catch((error) => {
      console.error(error);
      showToast("No se pudo sincronizar. La copia local quedó guardada.");
    });
  }
}

function addLog(text) {
  state.log.unshift({ id: crypto.randomUUID(), text, at: Date.now() });
  state.log = state.log.slice(0, 14);
}

function saveForm() {
  const defaults = DEFAULTS_BY_TYPE[els.type.value] || DEFAULTS_BY_TYPE.Other;
  const mixer = inferredMixer(els.type.value);
  const amount = positiveNumber(els.amount.value, 0);
  const item = {
    id: els.editingId.value || crypto.randomUUID(),
    name: els.name.value.trim(),
    type: els.type.value,
    unit: els.unit.value,
    amount,
    bottleMl: positiveNumber(els.bottleMl.value, defaults.bottleMl),
    servingMl: positiveNumber(els.servingMl.value, defaults.servingMl),
    mixerName: mixer.name,
    mixerMl: mixer.ml,
    location: els.location.value.trim(),
    updatedAt: Date.now()
  };

  const existingIndex = state.items.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) {
    state.items[existingIndex] = item;
    persist(`Se editó ${item.name}`);
  } else {
    state.items.unshift(item);
    persist(`Se sumó ${item.name}`);
  }

  resetForm();
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.type.value = "Fernet";
  applyTypeDefaults();
  els.amount.value = "1";
  els.saveItem.textContent = "Sumar a la barra";
}

function applyTypeDefaults() {
  const defaults = DEFAULTS_BY_TYPE[els.type.value] || DEFAULTS_BY_TYPE.Other;
  els.bottleMl.value = defaults.bottleMl;
  els.servingMl.value = defaults.servingMl;

  if (els.type.value === "Beer") {
    els.unit.value = "cans";
  }
}

function editItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  els.editingId.value = item.id;
  els.name.value = item.name;
  els.type.value = item.type;
  els.unit.value = item.unit;
  els.amount.value = item.amount;
  els.bottleMl.value = item.bottleMl;
  els.servingMl.value = item.servingMl;
  els.location.value = item.location || "";
  els.saveItem.textContent = "Guardar cambios";
  els.name.focus();
}

function removeItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  state.items = state.items.filter((entry) => entry.id !== id);
  persist(`Se sacó ${item.name}`);
}

function changeAmount(id, delta) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  const precision = item.unit === "bottles" || item.unit === "liters" ? 1 : 0;
  item.amount = Math.max(0, roundTo(item.amount + delta, precision));
  item.updatedAt = Date.now();
  persist(`${delta > 0 ? "Entró" : "Salió"} ${item.name}`);
}

function render() {
  els.people.value = state.planner.people;
  els.drinksEach.value = state.planner.drinksEach;
  renderSummary();
  renderInventory();
  renderPlanner();
  renderLog();
}

function renderSummary() {
  const stats = getStats();
  const plannedDrinks = Math.max(1, state.planner.people * state.planner.drinksEach);
  const glassLevel = Math.min(100, Math.round(stats.totalDrinks / plannedDrinks * 100));

  els.totalBottles.textContent = formatNumber(stats.totalBottles, 1);
  els.totalDrinks.textContent = stats.totalDrinks.toString();
  els.totalDrinksHero.textContent = stats.totalDrinks.toString();
  els.mixGap.textContent = formatLiters(stats.mixerNeededMl);
  els.glassFill.style.height = `${glassLevel}%`;
  els.readinessCopy.textContent = readinessCopy(glassLevel, stats);
}

function renderInventory() {
  const search = els.search.value.trim().toLowerCase();
  const filter = els.filter.value;
  const items = state.items
    .filter((item) => filter === "all" || item.type === filter)
    .filter((item) => [item.name, item.type, TYPE_LABELS[item.type], item.location, item.mixerName].join(" ").toLowerCase().includes(search))
    .sort((a, b) => drinkCount(a) - drinkCount(b) || a.name.localeCompare(b.name));

  els.stockSubtitle.textContent = `${items.length} visibles, ${state.items.length} cargadas`;
  els.inventoryList.innerHTML = "";
  els.emptyState.hidden = items.length > 0;

  const maxDrinks = Math.max(1, ...items.map((item) => Math.floor(drinkCount(item))));

  items.forEach((item) => {
    const drinks = Math.floor(drinkCount(item));
    const ratio = drinks / maxDrinks;
    const mixerNeeded = mixerNeededForItem(item);
    const article = document.createElement("article");
    article.className = "reserve-item";
    article.innerHTML = `
      <div class="item-gauge" style="--gauge: ${Math.min(100, Math.round(ratio * 100))}%" aria-hidden="true">
        <div style="height: ${Math.min(100, Math.round(ratio * 100))}%"></div>
      </div>
      <div class="reserve-main">
        <div class="reserve-title">
          <span class="drink-emoji" aria-hidden="true">${TYPE_EMOJIS[item.type] || TYPE_EMOJIS.Other}</span>
          <h3 title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
          <span class="type-pill">${escapeHtml(TYPE_LABELS[item.type] || item.type)}</span>
        </div>
        <div class="item-meta">
          <span>${formatAmount(item)}</span>
          <span>${drinks} tragos</span>
          ${mixerNeeded ? `<span>${formatLiters(mixerNeeded)} de ${escapeHtml(item.mixerName)} para mezclar</span>` : ""}
          ${item.location ? `<span class="location-chip">${escapeHtml(item.location)}</span>` : ""}
          <span>hace ${relativeTime(item.updatedAt)}</span>
        </div>
        <div class="item-progress">
          <div style="width: ${Math.min(100, Math.round(ratio * 100))}%"></div>
        </div>
      </div>
      <div class="item-actions">
        <div class="stock-stepper" aria-label="Ajustar stock de ${escapeHtml(item.name)}">
          <button type="button" data-action="minus" data-id="${item.id}" title="Usar stock">-</button>
          <span class="stock-amount">${formatNumber(item.amount, item.unit === "bottles" || item.unit === "liters" ? 1 : 0)}</span>
          <button type="button" data-action="plus" data-id="${item.id}" title="Reponer">+</button>
        </div>
        <button class="action-chip" type="button" data-action="edit" data-id="${item.id}" title="Editar">Editar</button>
        <button class="action-chip" type="button" data-action="remove" data-id="${item.id}" title="Borrar">Borrar</button>
      </div>
    `;
    els.inventoryList.append(article);
  });

  els.inventoryList.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      const item = state.items.find((entry) => entry.id === id);
      const step = item?.unit === "bottles" || item?.unit === "liters" ? 0.5 : 1;
      if (button.dataset.action === "minus") changeAmount(id, -step);
      if (button.dataset.action === "plus") changeAmount(id, step);
      if (button.dataset.action === "edit") editItem(id);
      if (button.dataset.action === "remove") removeItem(id);
    });
  });
}

function renderPlanner() {
  const stats = getStats();
  const needed = state.planner.people * state.planner.drinksEach;
  const gap = Math.max(0, needed - stats.totalDrinks);
  const surplus = Math.max(0, stats.totalDrinks - needed);

  if (!state.items.length) {
    els.plannerCopy.textContent = "Cargá reservas para calcular si alcanza.";
    els.mixBreakdown.innerHTML = "";
    return;
  }

  if (gap === 0) {
    els.plannerCopy.textContent = `${stats.totalDrinks} tragos para ${needed} planeados. Sobran ${surplus}.`;
  } else {
    els.plannerCopy.textContent = `${stats.totalDrinks} tragos para ${needed} planeados. Faltan ${gap}.`;
  }

  const rows = [...stats.mixerRows.values()].sort((a, b) => b.neededMl - a.neededMl);
  els.mixBreakdown.innerHTML = rows.length
    ? rows.map((row) => {
        return `
          <div class="mix-row">
            <div>
              <strong>${escapeHtml(row.name)}</strong>
              <span>${formatLiters(row.neededMl)} necesarios</span>
            </div>
            <div class="mini-bar"><span style="width:100%"></span></div>
            <em>calcular</em>
          </div>
        `;
      }).join("")
    : '<div class="mix-row"><div><strong>Sin mezcla requerida</strong><span>Whisky solo, vino o cerveza</span></div><em>ok</em></div>';
}

function renderLog() {
  els.activityLog.innerHTML = "";
  const entries = state.log.length ? state.log : [{ id: "empty", text: "Todavía no hay movimientos", at: Date.now() }];
  entries.slice(0, 8).forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(entry.text)}</strong><span>hace ${relativeTime(entry.at)}</span>`;
    els.activityLog.append(li);
  });
}

function getStats() {
  const mixerRows = new Map();
  let totalBottles = 0;
  let totalDrinks = 0;
  let mixerNeededMl = 0;

  state.items.forEach((item) => {
    totalBottles += bottleEquivalent(item);
    totalDrinks += Math.floor(drinkCount(item));

    const neededMl = mixerNeededForItem(item);
    if (neededMl > 0) {
      mixerNeededMl += neededMl;
      const key = mixerKey(item.mixerName);
      const row = mixerRows.get(key) || { name: item.mixerName, neededMl: 0, availableMl: 0 };
      row.neededMl += neededMl;
      mixerRows.set(key, row);
    }
  });

  return {
    totalBottles,
    totalDrinks,
    mixerNeededMl,
    mixerRows
  };
}

function bottleEquivalent(item) {
  if (item.unit === "bottles") return item.amount;
  if (item.unit === "liters") return item.amount * 1000 / item.bottleMl;
  if (item.unit === "ml") return item.amount / item.bottleMl;
  if (item.unit === "cans") return item.amount * item.bottleMl / 750;
  return item.amount;
}

function drinkCount(item) {
  if (item.type === "Beer" && (item.unit === "cans" || item.unit === "bottles")) return item.amount;
  if (!item.servingMl) return 0;
  return itemVolumeMl(item) / item.servingMl;
}

function itemVolumeMl(item) {
  if (item.unit === "bottles") return item.amount * item.bottleMl;
  if (item.unit === "liters") return item.amount * 1000;
  if (item.unit === "ml") return item.amount;
  if (item.unit === "cans") return item.amount * item.bottleMl;
  return item.amount * item.bottleMl;
}

function mixerNeededForItem(item) {
  if (!item.mixerName || !item.mixerMl) return 0;
  return Math.floor(drinkCount(item)) * item.mixerMl;
}

function inferredMixer(type) {
  const defaults = DEFAULTS_BY_TYPE[type] || DEFAULTS_BY_TYPE.Other;
  return {
    name: defaults.mixerName || "",
    ml: defaults.mixerMl || 0
  };
}

function readinessCopy(score, stats) {
  if (!state.items.length) return "Cargá reservas para ver disponibilidad.";
  const needed = state.planner.people * state.planner.drinksEach;
  const drinksGap = Math.max(0, needed - stats.totalDrinks);
  if (drinksGap === 0) return `Alcanza para ${needed} tragos planeados. Mezcla estimada: ${formatLiters(stats.mixerNeededMl)}.`;
  if (score >= 60) return `Stock parcial. Faltan ${drinksGap} tragos para el plan.`;
  return `Faltan ${drinksGap} tragos para cubrir el plan.`;
}

function formatAmount(item) {
  return `${formatNumber(item.amount, item.unit === "bottles" || item.unit === "liters" ? 1 : 0)} ${unitLabel(item.unit)}`;
}

function formatLiters(ml) {
  const liters = Math.max(0, ml) / 1000;
  return `${formatNumber(liters, liters < 10 ? 1 : 0)} L`;
}

function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits
  });
}

function unitLabel(unit) {
  return UNIT_LABELS[unit] || unit;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundTo(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function relativeTime(timestamp) {
  const seconds = Math.max(1, Math.floor((Date.now() - Number(timestamp || Date.now())) / 1000));
  if (seconds < 60) return "un toque";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function sanitizeState(nextState) {
  return {
    items: nextState.items.map((item) => ({ ...item })),
    log: nextState.log.map((entry) => ({ ...entry })),
    planner: { ...nextState.planner },
    updatedAt: nextState.updatedAt || Date.now()
  };
}

function normalizeState(nextState) {
  return {
    items: Array.isArray(nextState.items) ? nextState.items.map(normalizeItem).filter(Boolean) : [],
    log: Array.isArray(nextState.log) ? nextState.log.map(normalizeLog).filter(Boolean) : [],
    planner: {
      people: positiveNumber(nextState.planner?.people, 8),
      drinksEach: positiveNumber(nextState.planner?.drinksEach, 4)
    },
    updatedAt: Number(nextState.updatedAt || Date.now())
  };
}

function normalizeItem(item) {
  const type = normalizeType(item.type);
  if (type === "Mixer") return null;
  const defaults = DEFAULTS_BY_TYPE[type] || DEFAULTS_BY_TYPE.Other;
  const mixer = inferredMixer(type);
  return {
    id: item.id || crypto.randomUUID(),
    name: String(item.name || "Reserva sin nombre").slice(0, 36),
    type,
    unit: ["bottles", "ml", "cans", "liters"].includes(item.unit) ? item.unit : "bottles",
    amount: positiveNumber(item.amount, 0),
    bottleMl: positiveNumber(item.bottleMl, defaults.bottleMl),
    servingMl: positiveNumber(item.servingMl, defaults.servingMl),
    mixerName: mixer.name,
    mixerMl: mixer.ml,
    location: String(item.location || "").slice(0, 60),
    updatedAt: Number(item.updatedAt || Date.now())
  };
}

function normalizeType(type) {
  const value = String(type || "Other").toLowerCase();
  if (value === "beer" || value === "cerveza") return "Beer";
  if (value === "mixer" || value === "mezcla") return "Mixer";
  if (value === "rum" || value === "ron") return "Rum";
  if (value === "wine" || value === "vino") return "Wine";
  if (value === "other" || value === "otro") return "Other";
  if (value === "fernet") return "Fernet";
  if (value === "gin") return "Gin";
  if (value === "vodka") return "Vodka";
  if (value === "whisky") return "Whisky";
  return "Other";
}

function normalizeLog(entry) {
  if (!entry?.text) return null;
  return {
    id: entry.id || crypto.randomUUID(),
    text: String(entry.text).slice(0, 120),
    at: Number(entry.at || Date.now())
  };
}

function mixerKey(value) {
  return String(value || "Mezcla")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/tonic/g, "tonica")
    .replace(/cola|coke/g, "coca")
    .replace(/[^a-z0-9]+/g, "");
}

function copySnapshotLink() {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(sanitizeState(state)))));
  const url = `${window.location.origin}${window.location.pathname}#stock=${encoded}`;
  navigator.clipboard.writeText(url).then(
    () => showToast("Link de stock copiado."),
    () => showToast("No se pudo copiar el link.")
  );
}

function exportData() {
  const blob = new Blob([JSON.stringify(sanitizeState(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reservas-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("JSON exportado.");
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      Object.assign(state, normalizeState(JSON.parse(reader.result)));
      persist("Se importaron reservas", { silentLog: true });
      showToast("Reservas importadas.");
    } catch (error) {
      console.error(error);
      showToast("Falló la importación. Usá un JSON de Reservas.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
