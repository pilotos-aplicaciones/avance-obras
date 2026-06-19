// Capa de persistencia — toda escritura/lectura de datos pasa por aquí.
// Para migrar a backend: reemplazar este archivo manteniendo las mismas firmas.

const _PRE = 'coa_';

// ── Índice de proyectos ──────────────────────────────────────────────────────

function datos_listarProyectos() {
  return JSON.parse(localStorage.getItem(_PRE + 'index') || '[]');
}

function datos_generarId() {
  return 'proj_' + Date.now();
}

function _datos_guardarIndice(lista) {
  localStorage.setItem(_PRE + 'index', JSON.stringify(lista));
}

// ── Proyectos ────────────────────────────────────────────────────────────────

function datos_guardarProyecto(config) {
  config.modificadoEn = new Date().toISOString();
  if (!config.creadoEn) config.creadoEn = config.modificadoEn;
  localStorage.setItem(_PRE + 'proyecto_' + config.id, JSON.stringify(config));
  // Actualizar índice
  const idx = datos_listarProyectos();
  const pos = idx.findIndex(p => p.id === config.id);
  const entrada = { id: config.id, nombre: config.nombre, zona: config.zona || '', creadoEn: config.creadoEn };
  if (pos >= 0) idx[pos] = entrada; else idx.push(entrada);
  _datos_guardarIndice(idx);
  _fs_sync(config.id);
}

function datos_cargarProyecto(id) {
  const raw = localStorage.getItem(_PRE + 'proyecto_' + id);
  return raw ? JSON.parse(raw) : null;
}

// Borra solo del almacenamiento local (sin tocar Firestore).
// Usado cuando la eliminación ya ocurrió en Firestore (p.ej. desde otro dispositivo).
function _datos_eliminarLocal(id) {
  localStorage.removeItem(_PRE + 'proyecto_' + id);
  localStorage.removeItem(_PRE + 'matrices_' + id);
  localStorage.removeItem(_PRE + 'matrices_ok_' + id);
  localStorage.removeItem(_PRE + 'pendiente_ts_' + id);
  localStorage.removeItem(_PRE + 'baseline_' + id);
  localStorage.removeItem(_PRE + 'hist_og_' + id);
  localStorage.removeItem(_PRE + 'hist_term_' + id);
  localStorage.removeItem(_PRE + 'og_pisos_' + id);
  localStorage.removeItem(_PRE + 'snapshots_' + id);
  localStorage.removeItem(_PRE + 'ciclo_' + id);
  localStorage.removeItem(_PRE + 'semana_ctrl_' + id);
  const idx = datos_listarProyectos().filter(function(p) { return p.id !== id; });
  _datos_guardarIndice(idx);
}

function datos_eliminarProyecto(id) {
  _datos_eliminarLocal(id);
  // Eliminar también de Firestore
  if (_db) {
    _db.collection(_FS_COL).doc(id).delete()
      .catch(err => console.warn('[COA] Error eliminando de Firestore:', err.message));
  }
}

// ── Estado pendiente ─────────────────────────────────────────────────────────
// Marca que hay cambios locales que aún no se han subido a Firebase.
// El usuario debe confirmar explícitamente para subir.

function datos_marcarPendiente(idProyecto) {
  localStorage.setItem(_PRE + 'pendiente_' + idProyecto, '1');
}

function datos_hayPendiente(idProyecto) {
  return !!localStorage.getItem(_PRE + 'pendiente_' + idProyecto);
}

function datos_limpiarPendiente(idProyecto) {
  localStorage.removeItem(_PRE + 'pendiente_' + idProyecto);
}

// Devuelve lista de ids de proyectos con cambios pendientes
function datos_proyectosConPendiente() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(_PRE + 'pendiente_')) {
      ids.push(key.replace(_PRE + 'pendiente_', ''));
    }
  }
  return ids;
}

// Sube el proyecto a Firebase de forma explícita (llamado solo al confirmar guardado)
function datos_subirAhora(idProyecto) {
  // Guardar snapshot del estado oficial antes de subir
  datos_guardarMatricesOk(idProyecto);
  datos_limpiarPendiente(idProyecto);
  localStorage.removeItem(_PRE + 'pendiente_ts_' + idProyecto);
  // Si no hay internet, marcar offline y no intentar Firebase.
  // El listener 'online' subirá automáticamente cuando vuelva la red.
  if (!datos_estaOnline()) {
    _fs_setEstado('offline');
    return;
  }
  _fs_setEstado('sincronizando');
  _fs_subirProyecto(idProyecto);
}

// ── Matrices de terminaciones (estado actual) ────────────────────────────────

function datos_guardarMatrices(idProyecto, matrices) {
  // Solo guarda en local — NO sube a Firebase automáticamente.
  // El usuario debe presionar "Guardar avances" para sincronizar.
  localStorage.setItem(_PRE + 'matrices_' + idProyecto, JSON.stringify(matrices));
  // Guardar timestamp de la última vez que hubo cambios sin guardar
  if (!localStorage.getItem(_PRE + 'pendiente_ts_' + idProyecto)) {
    localStorage.setItem(_PRE + 'pendiente_ts_' + idProyecto, new Date().toISOString());
  }
  datos_marcarPendiente(idProyecto);
}

function datos_cargarMatrices(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'matrices_' + idProyecto);
  return raw ? JSON.parse(raw) : {};
}

// ── Matrices oficiales (último guardado confirmado) ───────────────────────────
// Se actualiza cada vez que el usuario presiona "Guardar avances".
// Se usa para restaurar el estado cuando el usuario descarta cambios sin guardar.

function datos_guardarMatricesOk(idProyecto) {
  const matrices = datos_cargarMatrices(idProyecto);
  localStorage.setItem(_PRE + 'matrices_ok_' + idProyecto, JSON.stringify(matrices));
}

function datos_cargarMatricesOk(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'matrices_ok_' + idProyecto);
  return raw ? JSON.parse(raw) : {};
}

// Devuelve la fecha/hora en que se hicieron cambios sin guardar (ISO 8601), o null si no hay.
function datos_getFechaPendiente(idProyecto) {
  return localStorage.getItem(_PRE + 'pendiente_ts_' + idProyecto) || null;
}

// Descarta los cambios sin guardar: restaura las matrices al último estado oficial
// y limpia la marca de pendiente. Se llama al confirmar "salir sin guardar".
function datos_descartarPendiente(idProyecto) {
  const ok = datos_cargarMatricesOk(idProyecto);
  localStorage.setItem(_PRE + 'matrices_' + idProyecto, JSON.stringify(ok));
  datos_limpiarPendiente(idProyecto);
  localStorage.removeItem(_PRE + 'pendiente_ts_' + idProyecto);
}

// ── Control semanal ──────────────────────────────────────────────────────────

function datos_cargarSemanaControl(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'semana_ctrl_' + idProyecto);
  return raw ? JSON.parse(raw) : null;
}

function datos_guardarSemanaControl(idProyecto, obj) {
  localStorage.setItem(_PRE + 'semana_ctrl_' + idProyecto, JSON.stringify(obj));
  _fs_sync(idProyecto);
}

function datos_limpiarSemanaControl(idProyecto) {
  localStorage.removeItem(_PRE + 'semana_ctrl_' + idProyecto);
}

// ── Exportar / Importar respaldo ─────────────────────────────────────────────

function datos_exportarRespaldo(idProyecto) {
  return JSON.stringify({
    version: '2.2',
    exportadoEn: new Date().toISOString(),
    proyecto: datos_cargarProyecto(idProyecto),
    matrices: datos_cargarMatrices(idProyecto),
  }, null, 2);
}

function datos_importarRespaldo(jsonTexto) {
  const obj = JSON.parse(jsonTexto);
  if (!obj.proyecto || !obj.proyecto.id) throw new Error('Respaldo inválido');
  const id = obj.proyecto.id;
  datos_guardarProyecto(obj.proyecto);
  datos_guardarMatrices(id, obj.matrices || {});
  datos_limpiarPendiente(id); // el respaldo cargado no tiene avances pendientes
  return id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function datos_usageKB() {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(_PRE)) total += (localStorage.getItem(key) || '').length;
  }
  return Math.round(total / 1024);
}

// ── Sincronización con Firestore ─────────────────────────────────────────────
// Estrategia: localStorage como almacén principal (síncrono, offline siempre).
// Firestore como espejo en la nube (asíncrono, en segundo plano).
//
// Flujo:
//   escritura → localStorage (inmediato) + Firestore (debounced 2 s)
//   al iniciar → Firestore → localStorage (si Firestore es más reciente)
//
// Si no hay internet, _db = null y todo funciona solo con localStorage.

const _FS_COL    = 'avances_obras_proyectos'; // nombre de la colección en Firestore
const _fs_timers = {};          // timers de debounce por proyecto

// ID único del dispositivo. Se persiste en localStorage para que sea siempre
// el mismo aunque el usuario cierre y reabra la app. Esto permite al sistema
// de presencia reconocer que es el mismo dispositivo entre sesiones.
const _DEVICE_ID = (function() {
  const key = _PRE + 'device_id';
  let id = localStorage.getItem(key);
  if (!id) { id = 'dev_' + Math.random().toString(36).slice(2, 9); localStorage.setItem(key, id); }
  return id;
})();

// ── Nombre de usuario ────────────────────────────────────────────────────────
// Nombre que el usuario ingresó en su primer uso. Se guarda en el dispositivo.

function datos_getNombreUsuario() {
  return localStorage.getItem(_PRE + 'autor') || '';
}

function datos_setNombreUsuario(nombre) {
  localStorage.setItem(_PRE + 'autor', (nombre || '').trim());
}

// ── Indicador de estado de sincronización ────────────────────────────────────
// Actualiza todos los íconos .sync-indicator del navbar según el estado actual.
// estados posibles: 'ok' | 'sincronizando' | 'error' | 'offline'
function _fs_setEstado(estado) {
  const labels = {
    ok:            'Sincronizado',
    sincronizando: 'Sincronizando…',
    error:         'Error',
    offline:       'Sin conexión',
  };
  const texto = labels[estado] || '';
  document.querySelectorAll('.sync-indicator').forEach(function(el) {
    el.dataset.estado = estado;
    const lbl = el.querySelector('.sync-label');
    if (lbl) lbl.textContent = texto;
  });
}

// Recopila el estado completo de un proyecto desde localStorage y lo sube
// a Firestore. Se llama después de cada escritura (con debounce).
// IMPORTANTE: también actualiza config.modificadoEn para que otros dispositivos
// detecten el cambio aunque solo se hayan editado celdas (matrices).
function _fs_subirProyecto(id) {
  if (!_db) return;
  const config = datos_cargarProyecto(id);
  if (!config) return;

  // Actualizar timestamp — garantiza que otros dispositivos vean el cambio
  // aunque solo se hayan marcado avances sin tocar la configuración.
  const ahora = new Date().toISOString();
  config.modificadoEn = ahora;
  localStorage.setItem(_PRE + 'proyecto_' + id, JSON.stringify(config));

  // Solo se sincroniza el estado CONFIRMADO. Si el proyecto tiene cambios sin
  // guardar (pendiente), se sube la última versión oficial (matrices_ok), nunca
  // el borrador. Así una reconexión o una edición de config/fecha no suben
  // avances que el usuario aún no confirmó con "Guardar avances".
  // Si no hay pendiente, el borrador YA es el estado oficial (cubre importaciones).
  const matricesASubir = datos_hayPendiente(id)
    ? datos_cargarMatricesOk(id)
    : datos_cargarMatrices(id);

  const doc = {
    config,
    matrices:      matricesASubir                || {},
    semanaControl: datos_cargarSemanaControl(id) || null,
    _sincEn:        ahora,
    _dispositivoId: _DEVICE_ID,  // identifica el origen; el listener lo usa para ignorar echos
    _app:           'Avances_Obras', // identifica la app en Firebase
    _autor:         localStorage.getItem(_PRE + 'autor') || _DEVICE_ID, // nombre ingresado en primer uso
    _fecha:         ahora,        // fecha de última escritura (ISO 8601)
  };

  _db.collection(_FS_COL).doc(id).set(doc)
    .then(function() {
      // Firebase resuelve su caché local aunque no haya internet,
      // así que verificamos datos_estaOnline() antes de mostrar "Sincronizado".
      _fs_setEstado(datos_estaOnline() ? 'ok' : 'offline');
    })
    .catch(function(err) {
      console.warn('[COA] Error al subir proyecto a Firestore:', err.message);
      _fs_setEstado(datos_estaOnline() ? 'error' : 'offline');
    });
}

// Versión con debounce: agrupa escrituras rápidas (ej: celdas) en una sola
// subida a Firestore después de 2 segundos de inactividad.
function _fs_sync(id) {
  _fs_setEstado('sincronizando');
  clearTimeout(_fs_timers[id]);
  _fs_timers[id] = setTimeout(function() { _fs_subirProyecto(id); }, 2000);
}

// ── Listener en tiempo real ──────────────────────────────────────────────────
// Reemplaza la descarga única por un listener persistente que recibe cambios
// automáticamente sin recargar la página. Se activa al iniciar la app.
//
// Primera llamada: comportamiento idéntico a la descarga inicial (sync completo).
// Llamadas siguientes: solo se procesan los documentos que cambiaron (docChanges).
// Cambios propios (subidos por este dispositivo) se ignoran via _dispositivoId.

let _fs_primeraVez = true; // controla la subida de proyectos locales al arrancar

function datos_iniciarListenerFirestore() {
  if (!_db) {
    _fs_setEstado('offline');
    console.warn('[COA] Firestore no disponible — usando datos locales.');
    return;
  }

  _fs_setEstado('sincronizando');

  _db.collection(_FS_COL).onSnapshot(function(snap) {
    const idsActualizados = new Set(); // proyectos que cambiaron desde otro dispositivo

    snap.docChanges().forEach(function(change) {
      if (change.type === 'removed') {
        // El proyecto fue eliminado desde otro dispositivo: borrarlo localmente también.
        const id = change.doc.id;
        _datos_eliminarLocal(id);
        // Si el usuario está viendo ese proyecto ahora, volver al inicio.
        if (typeof router_getProyectoActivo === 'function' && router_getProyectoActivo() === id) {
          if (typeof interfaz_mostrarToast === 'function') {
            interfaz_mostrarToast('Este proyecto fue eliminado desde otro dispositivo.', 'info', 4000);
          }
          if (typeof router_ir === 'function') router_ir('v-inicio');
        } else if (typeof proyectos_renderizarGrilla === 'function') {
          proyectos_renderizarGrilla();
        }
        return;
      }

      const d = change.doc.data();
      if (!d.config || !d.config.id) return;
      const id = d.config.id;

      // Ignorar cambios que subimos nosotros mismos (eco del propio upload)
      if (d._dispositivoId && d._dispositivoId === _DEVICE_ID) return;

      const localConfig = datos_cargarProyecto(id);
      const fsDate      = d.config.modificadoEn || d._sincEn || '';
      const localDate   = localConfig ? (localConfig.modificadoEn || '') : '';

      // Solo sobrescribir si Firestore es más reciente
      if (!localConfig || fsDate > localDate) {
        idsActualizados.add(id); // registrar qué proyecto cambió
        if (!d.config.creadoEn) d.config.creadoEn = d.config.modificadoEn;

        // Escritura directa — sin llamar datos_guardarProyecto para no disparar _fs_sync
        localStorage.setItem(_PRE + 'proyecto_' + id, JSON.stringify(d.config));
        const idx = datos_listarProyectos();
        const pos = idx.findIndex(function(p) { return p.id === id; });
        const ent = { id: id, nombre: d.config.nombre, zona: d.config.zona || '', creadoEn: d.config.creadoEn };
        if (pos >= 0) idx[pos] = ent; else idx.push(ent);
        _datos_guardarIndice(idx);

        if (d.matrices)                                    localStorage.setItem(_PRE + 'matrices_'    + id, JSON.stringify(d.matrices));
        if (d.semanaControl)                               localStorage.setItem(_PRE + 'semana_ctrl_' + id, JSON.stringify(d.semanaControl));
      }
    });

    // Primera llamada: subir proyectos locales que aún no están en Firestore
    if (_fs_primeraVez) {
      _fs_primeraVez = false;
      const idsFirestore = new Set(snap.docs.map(function(d) { return d.id; }));
      datos_listarProyectos().forEach(function(p) {
        if (!idsFirestore.has(p.id)) _fs_subirProyecto(p.id);
      });
    }

    _fs_setEstado(datos_estaOnline() ? 'ok' : 'offline');

    // Solo notificar si hubo cambios externos y alguno afecta la vista actual
    if (idsActualizados.size > 0) {
      _fs_notificarCambioExterno(idsActualizados);
    }

  }, function(err) {
    _fs_setEstado(datos_estaOnline() ? 'error' : 'offline');
    console.warn('[COA] Error en listener Firestore:', err.message);
  });
}

// Refresca la UI cuando llegan datos externos, SOLO si afectan la vista actual.
// Si está en proyecto A y cambió proyecto B → silencioso, sin interrumpir.
function _fs_notificarCambioExterno(idsActualizados) {
  const vista          = typeof router_getVistaActual    === 'function' ? router_getVistaActual()    : null;
  const proyectoActivo = typeof router_getProyectoActivo === 'function' ? router_getProyectoActivo() : null;

  const afectaVista = vista === 'v-inicio' ||
    (vista === 'v-proyecto' && proyectoActivo && idsActualizados.has(proyectoActivo));

  if (!afectaVista) return;

  if (vista === 'v-inicio') {
    if (typeof proyectos_renderizarGrilla === 'function') proyectos_renderizarGrilla();
  } else if (vista === 'v-proyecto' && proyectoActivo) {
    if (typeof terminaciones_inicializar === 'function') terminaciones_inicializar(proyectoActivo);
  }
}

// ── Detección de red en tiempo real ─────────────────────────────────────────
// Usamos nuestra propia variable en vez de navigator.onLine directamente,
// porque navigator.onLine no es confiable en todos los dispositivos (ej. iOS).

let _coa_estaOnline = navigator.onLine;

function datos_estaOnline() {
  return _coa_estaOnline;
}

window.addEventListener('offline', function() {
  _coa_estaOnline = false;
  _fs_setEstado('offline');
});

window.addEventListener('online', function() {
  _coa_estaOnline = true;
  // Al recuperar la red, re-intentar subir todos los proyectos locales
  // por si hubo cambios mientras no había conexión.
  if (!_db) return;
  _fs_setEstado('sincronizando');
  datos_listarProyectos().forEach(function(p) {
    _fs_subirProyecto(p.id);
  });
});
