# Reservas

App estática para GitHub Pages que lleva el stock de alcohol de un grupo y estima la mezcla necesaria.

## Qué calcula

- Tragos disponibles: cerveza cuenta como 1 trago por lata/botella; el resto usa ml por trago.
- Mezcla necesaria: la app la infiere por tipo, por ejemplo Fernet + Coca o Gin + Tónica.
- Mezcla: se muestra como cálculo estimado, no como reserva editable.
- Objetivos de stock, actividad, export/import JSON y link snapshot.

## GitHub Pages y datos compartidos

GitHub Pages puede hostear la app, pero no puede guardar una base compartida por sí solo. Modos:

- Navegador: funciona ya, pero el stock vive en cada browser.
- Snapshot/JSON: sirve para compartir una copia.
- Firebase Realtime Database: edición compartida sin login dentro de la app.

No pongas tokens de GitHub en una app de Pages. Todo lo que publiques ahí queda visible para quien abra la página.

## Correr local

```sh
python3 -m http.server 8000
```

Abrí `http://localhost:8000`.

## Firebase opcional

Copiá `config.example.js` a `config.js` y pegá tu config de Firebase. Si dejás reglas públicas, cualquiera con el link puede cambiar o borrar el stock.
