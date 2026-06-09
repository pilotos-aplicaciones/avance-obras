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

function datos_eliminarProyecto(id) {
  localStorage.removeItem(_PRE + 'proyecto_' + id);
  localStorage.removeItem(_PRE + 'matrices_' + id);
  localStorage.removeItem(_PRE + 'baseline_' + id);
  localStorage.removeItem(_PRE + 'hist_og_' + id);
  localStorage.removeItem(_PRE + 'hist_term_' + id);
  localStorage.removeItem(_PRE + 'semana_ctrl_' + id);
  localStorage.removeItem(_PRE + 'og_pisos_' + id);
  localStorage.removeItem(_PRE + 'snapshots_' + id);
  localStorage.removeItem(_PRE + 'ciclo_' + id);
  const idx = datos_listarProyectos().filter(p => p.id !== id);
  _datos_guardarIndice(idx);
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

// ── Baseline (matrices de la última semana cerrada para calcular deltas) ─────

function datos_guardarBaseline(idProyecto, matrices) {
  localStorage.setItem(_PRE + 'baseline_' + idProyecto, JSON.stringify(matrices));
  _fs_sync(idProyecto);
}

function datos_cargarBaseline(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'baseline_' + idProyecto);
  return raw ? JSON.parse(raw) : {};
}

// ── Historial OG ─────────────────────────────────────────────────────────────

function datos_cargarHistorialOG(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'hist_og_' + idProyecto);
  return raw ? JSON.parse(raw) : [];
}

function datos_guardarRegistroOG(idProyecto, registro) {
  const hist = datos_cargarHistorialOG(idProyecto);
  const idx = hist.findIndex(r => r.semana === registro.semana);
  if (idx >= 0) hist[idx] = registro; else hist.push(registro);
  hist.sort((a, b) => a.semana.localeCompare(b.semana));
  localStorage.setItem(_PRE + 'hist_og_' + idProyecto, JSON.stringify(hist));
  _fs_sync(idProyecto);
}

function datos_eliminarRegistroOG(idProyecto, semana) {
  const hist = datos_cargarHistorialOG(idProyecto).filter(r => r.semana !== semana);
  localStorage.setItem(_PRE + 'hist_og_' + idProyecto, JSON.stringify(hist));
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

// ── Historial Terminaciones ──────────────────────────────────────────────────

function datos_cargarHistorialTerm(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'hist_term_' + idProyecto);
  return raw ? JSON.parse(raw) : [];
}

function datos_guardarCierreSemanal(idProyecto, registro) {
  // registro: { semana, piso_por_fase, deptos_por_fase, fechaCierre }
  const hist = datos_cargarHistorialTerm(idProyecto);
  const idx = hist.findIndex(r => r.semana === registro.semana);
  if (idx >= 0) hist[idx] = registro; else hist.push(registro);
  hist.sort((a, b) => a.semana.localeCompare(b.semana));
  localStorage.setItem(_PRE + 'hist_term_' + idProyecto, JSON.stringify(hist));
  _fs_sync(idProyecto);
}

function datos_eliminarCierreSemanal(idProyecto, semana) {
  const hist = datos_cargarHistorialTerm(idProyecto).filter(r => r.semana !== semana);
  localStorage.setItem(_PRE + 'hist_term_' + idProyecto, JSON.stringify(hist));
}

// ── Snapshots semanales (nuevo modelo unificado) ─────────────────────────────
// Cada snapshot guarda en una sola entrada todo lo que se cerró un viernes:
// OG (m³ real de la semana + acumulado), Term consolidado por fase, y Term
// detalle por actividad. La clave canónica es `semana_viernes`. El array se
// mantiene ordenado cronológicamente por viernes.

function datos_cargarSnapshots(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'snapshots_' + idProyecto);
  return raw ? JSON.parse(raw) : [];
}

function datos_guardarSnapshot(idProyecto, snapshot) {
  // snapshot debe tener semana_viernes (clave). Upsert: si ya existe ese viernes
  // se reemplaza; si no, se agrega. Mantiene el array ordenado.
  if (!snapshot || !snapshot.semana_viernes) {
    throw new Error('Snapshot inválido: falta semana_viernes');
  }
  const lista = datos_cargarSnapshots(idProyecto);
  const i = lista.findIndex(s => s.semana_viernes === snapshot.semana_viernes);
  if (i >= 0) lista[i] = snapshot; else lista.push(snapshot);
  lista.sort((a, b) => a.semana_viernes.localeCompare(b.semana_viernes));
  localStorage.setItem(_PRE + 'snapshots_' + idProyecto, JSON.stringify(lista));
  _fs_sync(idProyecto);
}

function datos_eliminarSnapshot(idProyecto, semana_viernes) {
  const lista = datos_cargarSnapshots(idProyecto).filter(s => s.semana_viernes !== semana_viernes);
  localStorage.setItem(_PRE + 'snapshots_' + idProyecto, JSON.stringify(lista));
}

function datos_obtenerSnapshot(idProyecto, semana_viernes) {
  return datos_cargarSnapshots(idProyecto).find(s => s.semana_viernes === semana_viernes) || null;
}

// Devuelve el snapshot más reciente cuyo viernes sea ANTERIOR (estricto) al
// viernes dado. Usado para carry-forward en el Consolidado (cuando una fila
// no tiene snapshot propio, hereda del último previo).
function datos_obtenerSnapshotPrevio(idProyecto, semana_viernes) {
  const lista = datos_cargarSnapshots(idProyecto);
  let prev = null;
  for (const s of lista) {
    if (s.semana_viernes < semana_viernes) prev = s; else break;
  }
  return prev;
}

// ── Ciclo de actualización activo ────────────────────────────────────────────
// Existe solo entre "Iniciar actualización" y "Terminar actualización". Guarda
// el viernes activo, el timestamp de inicio y el baseline de matrices al
// momento de iniciar (para calcular Δ piso/Δ deptos durante la semana).

function datos_cargarCicloActivo(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'ciclo_' + idProyecto);
  return raw ? JSON.parse(raw) : null;
}

function datos_iniciarCiclo(idProyecto, semana_viernes) {
  // Clona las matrices actuales como baseline del ciclo. A partir de ahora,
  // los Δ de la semana se calculan contra esta foto.
  const matrices = datos_cargarMatrices(idProyecto);
  const ciclo = {
    semana_viernes,
    iniciado_at: new Date().toISOString(),
    baseline: JSON.parse(JSON.stringify(matrices)),
  };
  localStorage.setItem(_PRE + 'ciclo_' + idProyecto, JSON.stringify(ciclo));
  _fs_sync(idProyecto);
  return ciclo;
}

function datos_terminarCicloActivo(idProyecto) {
  localStorage.removeItem(_PRE + 'ciclo_' + idProyecto);
  _fs_sync(idProyecto);
}

// ── Exportar / Importar respaldo ─────────────────────────────────────────────

function datos_exportarRespaldo(idProyecto) {
  return JSON.stringify({
    version: '2.1',
    exportadoEn: new Date().toISOString(),
    proyecto:    datos_cargarProyecto(idProyecto),
    matrices:    datos_cargarMatrices(idProyecto),
    baseline:    datos_cargarBaseline(idProyecto),
    historial_og:   datos_cargarHistorialOG(idProyecto),
    historial_term: datos_cargarHistorialTerm(idProyecto),
    snapshots:   datos_cargarSnapshots(idProyecto),
    ciclo:       datos_cargarCicloActivo(idProyecto),
    fechas_pisos: datos_cargarFechasPisos(idProyecto),
  }, null, 2);
}

function datos_importarRespaldo(jsonTexto) {
  const obj = JSON.parse(jsonTexto);
  if (!obj.proyecto || !obj.proyecto.id) throw new Error('Respaldo inválido');
  const id = obj.proyecto.id;
  datos_guardarProyecto(obj.proyecto);
  datos_guardarMatrices(id, obj.matrices || {});
  datos_guardarBaseline(id, obj.baseline || {});
  if (obj.historial_og)   localStorage.setItem(_PRE + 'hist_og_'   + id, JSON.stringify(obj.historial_og));
  if (obj.historial_term) localStorage.setItem(_PRE + 'hist_term_' + id, JSON.stringify(obj.historial_term));
  if (obj.snapshots)      localStorage.setItem(_PRE + 'snapshots_' + id, JSON.stringify(obj.snapshots));
  if (obj.ciclo)          localStorage.setItem(_PRE + 'ciclo_'     + id, JSON.stringify(obj.ciclo));
  if (obj.fechas_pisos)   datos_guardarFechasPisos(id, obj.fechas_pisos);
  return id;
}

// ── Fechas término pisos (OG) ────────────────────────────────────────────────

function datos_cargarFechasPisos(idProyecto) {
  const raw = localStorage.getItem(_PRE + 'og_pisos_' + idProyecto);
  return raw ? JSON.parse(raw) : {};
}

function datos_guardarFechasPisos(idProyecto, obj) {
  localStorage.setItem(_PRE + 'og_pisos_' + idProyecto, JSON.stringify(obj));
  _fs_sync(idProyecto);
}

// ── Migración: canon de semana al viernes ────────────────────────────────────
// Limpia historiales que quedaron con fecha de lunes (canon antiguo) y los
// convierte a fecha de viernes. Si hay duplicados (mismo viernes con un viejo
// y uno nuevo), conserva el más reciente del array. Se ejecuta una vez por
// proyecto; marca config._canonViernes = true al terminar.

function datos_migrarCanonViernes(idProyecto) {
  const config = datos_cargarProyecto(idProyecto);
  if (!config) return;
  if (config._canonViernes) return; // Ya migrado.

  // Mapa lunes (s.fecha) → viernes (s.fecha_termino) desde ambos schedules.
  const lunesAViernes = new Map();
  (config.og?.schedule || []).forEach(s => {
    if (s.fecha && s.fecha_termino) lunesAViernes.set(s.fecha, s.fecha_termino);
  });
  (config.term_schedule || []).forEach(s => {
    if (s.fecha && s.fecha_termino) lunesAViernes.set(s.fecha, s.fecha_termino);
  });

  // ── Historial OG ────────────────────────────────────────────────────────────
  const histOG = datos_cargarHistorialOG(idProyecto);
  const mapOG  = new Map();
  histOG.forEach(r => {
    const semNueva = lunesAViernes.get(r.semana) || r.semana;
    // hist viene ordenado por semana; iteración tardía sobreescribe a la temprana,
    // que es exactamente lo que queremos (viernes post-fix gana al lunes pre-fix).
    mapOG.set(semNueva, { ...r, semana: semNueva });
  });
  const histOGNuevo = Array.from(mapOG.values())
    .sort((a, b) => a.semana.localeCompare(b.semana));
  localStorage.setItem(_PRE + 'hist_og_' + idProyecto, JSON.stringify(histOGNuevo));

  // ── Historial Terminaciones ────────────────────────────────────────────────
  const histTerm = datos_cargarHistorialTerm(idProyecto);
  const mapTerm  = new Map();
  histTerm.forEach(r => {
    const semNueva = lunesAViernes.get(r.semana) || r.semana;
    mapTerm.set(semNueva, { ...r, semana: semNueva });
  });
  const histTermNuevo = Array.from(mapTerm.values())
    .sort((a, b) => a.semana.localeCompare(b.semana));
  localStorage.setItem(_PRE + 'hist_term_' + idProyecto, JSON.stringify(histTermNuevo));

  // Marcar como migrado.
  config._canonViernes = true;
  datos_guardarProyecto(config);
}

function datos_migrarTodosACanonViernes() {
  datos_listarProyectos().forEach(p => {
    try { datos_migrarCanonViernes(p.id); }
    catch (err) { console.warn('Migración canon viernes falló para', p.id, err); }
  });
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

// ID único de esta sesión/dispositivo. Permite al listener onSnapshot ignorar
// los cambios que nosotros mismos subimos (evita refrescos innecesarios).
const _DEVICE_ID = 'dev_' + Math.random().toString(36).slice(2, 9);

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
    baseline:      datos_cargarBaseline(id)      || {},
    semanaControl: datos_cargarSemanaControl(id) || null,
    ciclo:         datos_cargarCicloActivo(id)   || null,
    fechasPisos:   datos_cargarFechasPisos(id)   || {},
    snapshots:     datos_cargarSnapshots(id)     || [],
    historialOG:   datos_cargarHistorialOG(id)   || [],
    historialTerm: datos_cargarHistorialTerm(id) || [],
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
      if (change.type === 'removed') return;

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
        if (d.baseline)                                    localStorage.setItem(_PRE + 'baseline_'    + id, JSON.stringify(d.baseline));
        if (d.semanaControl)                               localStorage.setItem(_PRE + 'semana_ctrl_' + id, JSON.stringify(d.semanaControl));
        if (d.ciclo)                                       localStorage.setItem(_PRE + 'ciclo_'       + id, JSON.stringify(d.ciclo));
        if (d.fechasPisos)                                 localStorage.setItem(_PRE + 'og_pisos_'    + id, JSON.stringify(d.fechasPisos));
        if (d.snapshots     && d.snapshots.length)         localStorage.setItem(_PRE + 'snapshots_'   + id, JSON.stringify(d.snapshots));
        if (d.historialOG   && d.historialOG.length)       localStorage.setItem(_PRE + 'hist_og_'     + id, JSON.stringify(d.historialOG));
        if (d.historialTerm && d.historialTerm.length)     localStorage.setItem(_PRE + 'hist_term_'   + id, JSON.stringify(d.historialTerm));
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
  _pres_hbTimer = null;

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
      .update({ visto: new Date().toISOString() })
      .catch(function() {});
  }, _PRES_HB);
}

// Escucha cambios en la presencia del proyecto en tiempo real.
// Si el editor sale, el visualizador intenta tomar el rol automáticamente.
function _pres_escuchar(idProyecto) {
  if (_pres_listener) { _pres_listener(); _pres_listener = null; }
  if (!_db) return;

  _pres_listener = _db.collection(_PRES_COL).doc(idProyecto).onSnapshot(function(doc) {
    if (_pres_proyectoActual !== idProyecto) return; // ya nos fuimos de este proyecto

    const data = doc.exists ? doc.data() : null;
    const ahora = Date.now();
    const reciente = data && data.visto && (ahora - new Date(data.visto).getTime()) < _PRES_TTL;
    const esNuestro = !data || data.dispositivoId === _DEVICE_ID;

    if (!_pres_modoEditor && (!reciente || esNuestro)) {
      // El editor se fue → intentar tomar el rol
      _pres_proyectoActual = null; // forzar re-evaluación en presencia_entrarProyecto
      presencia_entrarProyecto(idProyecto, _pres_callback).then(function(esEditor) {
        if (_pres_callback) _pres_callback(esEditor);
      });
    }
  }, function(err) {
    console.warn('[COA] Error en listener de presencia:', err.message);
  });
}
