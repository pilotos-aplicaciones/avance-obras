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
  _fs_subirProyecto(idProyecto);
  datos_limpiarPendiente(idProyecto);
}

// ── Matrices de terminaciones (estado actual) ────────────────────────────────

function datos_guardarMatrices(idProyecto, matrices) {
  // Solo guarda en local — NO sube a Firebase automáticamente.
  // El usuario debe presionar "Guardar avances" para sincronizar.
  localStorage.setItem(_PRE + 'matrices_' + idProyecto, JSON.stringify(matrices));
  datos_marcarPendiente(idProyecto);
}

function datos_cargarMatrices(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'matrices_' + idProyecto);
  return raw ? JSON.parse(raw) : {};
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
    error:         'Error de sync',
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

  const doc = {
    config,
    matrices:      datos_cargarMatrices(id)      || {},
    semanaControl: datos_cargarSemanaControl(id) || null,
    _sincEn:        ahora,
    _dispositivoId: _DEVICE_ID,  // identifica el origen; el listener lo usa para ignorar echos
    _app:           'Avances_Obras', // identifica la app en Firebase
    _autor:         localStorage.getItem(_PRE + 'autor') || _DEVICE_ID, // nombre ingresado en primer uso
    _fecha:         ahora,        // fecha de última escritura (ISO 8601)
  };

  _db.collection(_FS_COL).doc(id).set(doc)
    .then(function() {
      _fs_setEstado('ok');
    })
    .catch(function(err) {
      console.warn('[COA] Error al subir proyecto a Firestore:', err.message);
      _fs_setEstado('error');
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

    _fs_setEstado('ok');

    // Solo notificar si hubo cambios externos y alguno afecta la vista actual
    if (idsActualizados.size > 0) {
      _fs_notificarCambioExterno(idsActualizados);
    }

  }, function(err) {
    _fs_setEstado('error');
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

// ── Presencia: modo editor / modo visualizador ───────────────────────────────
// Cuando un dispositivo abre un proyecto lo "reclama" como editor.
// Cualquier otro dispositivo que entre al mismo proyecto queda en modo
// visualizador (solo lectura) hasta que el editor salga o se caiga.
//
// Mecanismo:
//   · Al entrar: leer presencia/{id}. Si está libre o es nuestro → editor.
//   · El editor envía heartbeat cada 15 s actualizando el campo 'visto'.
//   · Si 'visto' lleva >30 s sin actualizar → editor caído → otro puede tomar.
//   · onSnapshot en presencia/{id} detecta salida del editor en tiempo real.
//   · Al salir del proyecto: borrar el documento de presencia.

const _PRES_COL = 'avances_obras_presencia';
const _PRES_HB  = 15000; // heartbeat cada 15 s
const _PRES_TTL = 30000; // timeout: 30 s sin heartbeat = editor caído

let _pres_modoEditor     = false;
let _pres_proyectoActual = null;
let _pres_hbTimer        = null;
let _pres_listener       = null;
let _pres_callback       = null; // función(esEditor) llamada cuando cambia el modo
let _pres_pollerTimer    = null; // reloj que detecta heartbeats expirados en modo viewer
let _pres_ultimoVisto    = null; // timestamp (ms) del último heartbeat conocido del editor

// Entra al proyecto: reclama el rol de editor o queda en visualizador.
// onCambioModo(esEditor) se llama cuando el rol cambia (ej: editor sale → visualizador pasa a editor).
async function presencia_entrarProyecto(idProyecto, onCambioModo) {
  // Si ya estamos en este proyecto, solo actualizar el callback y devolver el modo actual.
  if (_pres_proyectoActual === idProyecto) {
    if (onCambioModo) _pres_callback = onCambioModo;
    return _pres_modoEditor;
  }

  // Salir del proyecto anterior si lo había
  if (_pres_proyectoActual) presencia_salirProyecto(_pres_proyectoActual);

  _pres_proyectoActual = idProyecto;
  _pres_callback = onCambioModo || null;

  // Asumir modo editor de inmediato (optimista) — así el usuario puede tocar
  // celdas sin esperar a que Firebase confirme el rol. Si otro dispositivo
  // resulta ser el editor, Firebase lo corregirá a modo visualizador.
  _pres_modoEditor = true;

  if (!_db) {
    return true;
  }

  try {
    const ref  = _db.collection(_PRES_COL).doc(idProyecto);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    const ahora = Date.now();
    const reciente = data && data.visto && (ahora - new Date(data.visto).getTime()) < _PRES_TTL;
    const esNuestro = data && data.dispositivoId === _DEVICE_ID;

    if (!reciente || esNuestro) {
      // Proyecto libre o ya era nuestro → reclamar como editor
      await ref.set({
        dispositivoId: _DEVICE_ID,
        nombreUsuario: datos_getNombreUsuario() || _DEVICE_ID,
        desde: new Date().toISOString(),
        visto: new Date().toISOString(),
      });
      _pres_modoEditor = true;
      _pres_iniciarHeartbeat(idProyecto);
    } else {
      // Hay un editor activo en otro dispositivo → modo visualizador
      _pres_modoEditor = false;
    }
  } catch (err) {
    console.warn('[COA] Error verificando presencia:', err.message);
    _pres_modoEditor = true; // ante duda, asumir editor
  }

  _pres_escuchar(idProyecto);
  return _pres_modoEditor;
}

// Sale del proyecto: libera la presencia y detiene el heartbeat.
function presencia_salirProyecto(idProyecto) {
  clearInterval(_pres_hbTimer);
  clearInterval(_pres_pollerTimer);
  _pres_hbTimer     = null;
  _pres_pollerTimer = null;
  _pres_ultimoVisto = null;

  if (_pres_listener) { _pres_listener(); _pres_listener = null; }

  if (_db && _pres_modoEditor && _pres_proyectoActual === idProyecto) {
    _db.collection(_PRES_COL).doc(idProyecto).delete().catch(function() {});
  }

  _pres_modoEditor = false;
  _pres_proyectoActual = null;
  _pres_callback = null;
}

// Devuelve true si este dispositivo es el editor activo (o si no hay Firebase).
function presencia_esModoEditor() {
  return _pres_modoEditor || !_db;
}

// Devuelve el id del proyecto que tiene presencia activa en este momento.
// Usado por terminaciones.js para saber si ya conocemos el modo (evita flash).
function presencia_getProyectoActual() {
  return _pres_proyectoActual;
}

// Heartbeat: actualiza 'visto' cada 15 s para mantener el rol de editor.
function _pres_iniciarHeartbeat(idProyecto) {
  clearInterval(_pres_hbTimer);
  _pres_hbTimer = setInterval(function() {
    if (!_db || !_pres_modoEditor) return;
    _db.collection(_PRES_COL).doc(idProyecto)
      .update({ visto: new Date().toISOString(), nombreUsuario: datos_getNombreUsuario() || _DEVICE_ID })
      .catch(function() {});
  }, _PRES_HB);
}

// Escucha cambios en la presencia del proyecto en tiempo real.
// Si el editor sale, el visualizador intenta tomar el rol automáticamente.
// También guarda el último 'visto' para que el poller pueda detectar expiración
// sin depender de que Firebase mande una nueva notificación.
function _pres_escuchar(idProyecto) {
  if (_pres_listener) { _pres_listener(); _pres_listener = null; }
  if (!_db) return;

  _pres_listener = _db.collection(_PRES_COL).doc(idProyecto).onSnapshot(function(doc) {
    if (_pres_proyectoActual !== idProyecto) return;

    const data    = doc.exists ? doc.data() : null;
    const ahora   = Date.now();
    const reciente = data && data.visto && (ahora - new Date(data.visto).getTime()) < _PRES_TTL;
    const esNuestro = !data || data.dispositivoId === _DEVICE_ID;

    // Guardar timestamp del heartbeat del editor y su nombre para el banner
    if (data && data.visto) _pres_ultimoVisto = new Date(data.visto).getTime();
    if (data && data.nombreUsuario) window._pres_nombreEditor = data.nombreUsuario;

    if (!_pres_modoEditor && (!reciente || esNuestro)) {
      // El editor se fue → intentar tomar el rol
      clearInterval(_pres_pollerTimer);
      _pres_pollerTimer = null;
      _pres_proyectoActual = null;
      presencia_entrarProyecto(idProyecto, _pres_callback).then(function(esEditor) {
        if (_pres_callback) _pres_callback(esEditor);
      });
    } else if (!_pres_modoEditor && reciente && !esNuestro) {
      // Hay un editor activo externo → iniciar poller para detectar cuando expire
      _pres_iniciarPoller(idProyecto);
    }
  }, function(err) {
    console.warn('[COA] Error en listener de presencia:', err.message);
  });
}

// Poller: en modo viewer, verifica cada 20 s si el heartbeat del editor ya expiró.
// Esto cubre el caso donde el editor se va sin internet y Firebase nunca notifica.
function _pres_iniciarPoller(idProyecto) {
  clearInterval(_pres_pollerTimer);
  _pres_pollerTimer = setInterval(function() {
    if (_pres_modoEditor || _pres_proyectoActual !== idProyecto) {
      clearInterval(_pres_pollerTimer);
      _pres_pollerTimer = null;
      return;
    }
    if (_pres_ultimoVisto && (Date.now() - _pres_ultimoVisto) > _PRES_TTL) {
      // Heartbeat expirado → intentar tomar el rol
      clearInterval(_pres_pollerTimer);
      _pres_pollerTimer = null;
      _pres_proyectoActual = null;
      presencia_entrarProyecto(idProyecto, _pres_callback).then(function(esEditor) {
        if (_pres_callback) _pres_callback(esEditor);
      });
    }
  }, 20000);
}

