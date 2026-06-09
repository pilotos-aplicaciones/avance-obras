// ── Firebase — Configuración y conexión ──────────────────────────────────────
// Para migrar al repositorio compartido del equipo, actualizar solo los valores
// de FIREBASE_CONFIG. El resto del código no cambia.
//
// IMPORTANTE: estas credenciales son para la versión de prueba personal.
// Firebase protege el acceso mediante reglas de seguridad en la consola,
// no por ocultamiento de estas claves.

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCmUlkihNfxV8CyHOZ-38gcEx27jqU0z04",
  authDomain:        "rvc-pilotos-app.firebaseapp.com",
  projectId:         "rvc-pilotos-app",
  storageBucket:     "rvc-pilotos-app.firebasestorage.app",
  messagingSenderId: "304566913753",
  appId:             "1:304566913753:web:f1936de8ca85188338ccc8",
};

// _db es la referencia global a Firestore. datos.js la usa para leer/escribir.
// Si Firebase no está disponible (sin internet en primer uso), _db queda null
// y la app sigue funcionando solo con datos locales del dispositivo.
let _db = null;

(function () {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();

    // Persistencia offline: la app funciona sin internet y sincroniza
    // automáticamente cuando vuelve la conexión.
    _db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      if (err.code === 'failed-precondition') {
        // Ocurre si hay varias pestañas abiertas a la vez — solo una puede
        // tener persistencia activa. No es un error crítico.
        console.warn('[COA] Firebase: persistencia offline activa en una sola pestaña.');
      } else if (err.code === 'unimplemented') {
        console.warn('[COA] Firebase: este navegador no soporta persistencia offline.');
      }
    });

    console.log('[COA] Firebase conectado · ' + FIREBASE_CONFIG.projectId);
  } catch (err) {
    console.warn('[COA] Firebase no pudo inicializarse — modo local activado:', err.message);
    _db = null;
  }
})();
