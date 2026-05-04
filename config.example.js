// Copy this file to config.js if you want real shared editing on GitHub Pages.
// Without config.js, the app uses browser localStorage only.
//
// Firebase option:
// 1. Create a Firebase project.
// 2. Create a Realtime Database.
// 3. Set rules appropriate for your group. Public write is convenient but unsafe:
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }
// 4. Paste your web app config below.

window.RESERVAS_CONFIG = {
  backend: "firebase",
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
  },
  room: "main"
};
