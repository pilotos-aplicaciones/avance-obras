// Módulo Terminaciones — matrices de avance por departamento + cierre semanal.

let _mat_id      = null;
let _mat_config  = null;
let _mat_datos   = {};
let _mat_baseline= {};
let _mat_deptos  = [];
let _mat_fasesActivas = [];
let _mat_tabActiva    = 'resumen';
let _mat_pisoFiltro   = 'todos';
let _mat_colsOcultas      = false;   // true = columnas resumen ocultas
let _mat_actividadesFiltro = {};     // objeto {faseKey: Set|null} — filtro independiente por fase
let _mat_abreviado        = false;   // true = nombres abreviados en columna Actividad
let _mat_sidebarColapsado = false;   // true = sidebar de escritorio colapsado (solo iconos)

let _sel                 = new Set();
let _ancla               = null;
let _arrastrando         = false;
let _pasteDocRegistrado  = false;
let _dragDocRegistrado   = false;
let _scrollRAF           = null;
let _ptrClientX          = 0;
let _ptrClientY          = 0;
let _touchStartX         = 0;
let _touchStartY         = 0;
let _esScrollando        = false;   // true cuando el gesto táctil es scroll vertical
let _ultimoFueToque      = false;   // bloquea el click sintético que el browser dispara tras touchend
let _touchTimer          = null;    // timer long press (350ms) para activar modo arrastre
let _touchModoArrastre   = false;   // true cuando el long press activó selección de celdas

const VALORES_CICLO = [0, 25, 50, 75, 100];

// Calcula el piso sugerido para móvil según el frente de trabajo activo.
// Retorna un número de piso, el piso más bajo si nadie ha empezado,
// o 'completados' si todos los pisos están al 100%.
function _mat_sugerirPiso() {
  const pisos = (_mat_config.departamentos || [])
    .filter(function(p) { return p.cantidad > 0; })
    .map(function(p) { return p.piso; })
    .sort(function(a, b) { return a - b; }); // ascendente: negativo → positivo

  if (pisos.length === 0) return 'todos';

  // Calcular promedio de avance por piso (todas las fases juntas)
  var promediosPiso = pisos.map(function(piso) {
    var deptos = ((_mat_config.departamentos || []).find(function(d) { return d.piso === piso; }) || {}).deptos || [];
    var total = 0, count = 0;
    _mat_fasesActivas.forEach(function(fase) {
      var faseKey = 'fase_' + fase;
      var celdas = _mat_datos[faseKey] || {};
      var nums = logica_actividadesDeFase(_mat_config, fase);
      deptos.forEach(function(depto) {
        nums.forEach(function(num) {
          total += (celdas[depto + '_' + num] || 0);
          count++;
        });
      });
    });
    return { piso: piso, avg: count > 0 ? total / count : 0 };
  });

  // Pisos con trabajo activo: avg entre 0% y 100% (sin completar)
  var activos = promediosPiso.filter(function(p) { return p.avg > 0 && p.avg < 100; });
  if (activos.length > 0) {
    // El más alto con trabajo activo es el frente actual (bajan de arriba)
    return activos[activos.length - 1].piso;
  }

  // Si todos están al 100%
  var completos = promediosPiso.filter(function(p) { return p.avg >= 100; });
  if (completos.length === pisos.length && pisos.length > 0) return 'completados';

  // Ningún piso ha empezado → sugerir el más bajo (empieza por abajo)
  return pisos[0];
}

function terminaciones_inicializar(idProyecto) {
  _mat_id       = idProyecto;
  _mat_config   = datos_cargarProyecto(idProyecto);
  if (!_mat_config) return;
  _mat_datos    = datos_cargarMatrices(idProyecto);
  _mat_baseline = {};
  _mat_deptos   = logica_listaDeptosPlana(_mat_config.departamentos || []);
  _mat_fasesActivas = logica_fasesEfectivas(_mat_config);

  // En móvil: comenzar filtrado por piso sugerido y primera fase activa.
  // En escritorio: vista resumen sin filtro de piso.
  if (interfaz_esMovil()) {
    const pisoSug = _mat_sugerirPiso();
    _mat_pisoFiltro = (pisoSug === 'completados') ? 'todos' : pisoSug;
    _mat_tabActiva  = _mat_fasesActivas.length > 0 ? 'fase_' + _mat_fasesActivas[0] : 'resumen';
  } else {
    _mat_tabActiva  = 'resumen';
    _mat_pisoFiltro = 'todos';
  }
  if (!_pasteDocRegistrado) {
    document.addEventListener('paste', _mat_pasteHandler);
    _pasteDocRegistrado = true;
  }
  if (!_dragDocRegistrado) {
    document.addEventListener('mousemove', _mat_mousemoveScrollHandler);
    _dragDocRegistrado = true;
  }
  // Recalcular anchos de depto al rotar o redimensionar la pantalla
  if (!window._mat_resizeRegistrado) {
    var _mat_resizeTimer = null;
    window.addEventListener('resize', function() {
      clearTimeout(_mat_resizeTimer);
      _mat_resizeTimer = setTimeout(function() {
        if (interfaz_esMovil()) _term_aplicarStickyH();
      }, 150);
    });
    window._mat_resizeRegistrado = true;
  }
  _mat_render();
}

function _mat_render() {
  const panel = document.getElementById('panel-tab-term');
  if (!panel) return;
  panel.scrollLeft = 0;
  panel.scrollTop  = 0;

  if (interfaz_esMovil()) {
    // Rescatar sc-fecha-wrap antes de destruir el DOM para no perder sus listeners
    const fechaWrap = document.getElementById('sc-fecha-wrap');
    if (fechaWrap) fechaWrap.remove();

    panel.innerHTML = _mat_toolbarMovilHTML() + '<div id="mat-contenido" class="mat-contenido"></div>';

    // Insertar fecha ANTES del botón guardar (orden: 📅 → ✓ → •••)
    const filaUnica = panel.querySelector('.movil-fila-unica');
    if (filaUnica && fechaWrap) {
      const guardarBtn = filaUnica.querySelector('#mat-btn-guardar-avances');
      if (guardarBtn) filaUnica.insertBefore(fechaWrap, guardarBtn);
      else filaUnica.appendChild(fechaWrap);
    }
    // Ocultar la barra de control original (ya integrada en el toolbar)
    const barraCtrl = document.getElementById('barra-control');
    if (barraCtrl) barraCtrl.style.display = 'none';
  } else {
    // Rescatar sc-fecha-wrap antes de destruir el DOM del panel
    const fechaWrapD = document.getElementById('sc-fecha-wrap');
    if (fechaWrapD) fechaWrapD.remove();

    panel.innerHTML = `
    <div class="mat-sidebar${_mat_sidebarColapsado ? ' colapsado' : ''}" id="mat-sidebar">
      ${_mat_sidebarEscritorioHTML()}
    </div>
    <div class="mat-area-contenido" id="mat-area-contenido">
      <div id="mat-contenido" class="mat-contenido"></div>
    </div>`;

    // Inyectar fecha en el slot reservado dentro de la sidebar
    const slotFecha = document.getElementById('sidebar-fecha-slot');
    if (slotFecha && fechaWrapD) slotFecha.replaceWith(fechaWrapD);

    // Ocultar la franja de barra-control (la fecha ya está en la sidebar)
    const barraCtrlD = document.getElementById('barra-control');
    if (barraCtrlD) barraCtrlD.style.display = 'none';
  }

  _mat_renderContenido();
  _mat_registrarEventos();
}

// ── Sidebar escritorio ───────────────────────────────────────────────────────
function _mat_sidebarEscritorioHTML() {
  const hayPendiente = datos_hayPendiente(_mat_id);

  // % avance por fase, calculado sobre proyecto completo (sin filtro de piso)
  const deptosTodos = logica_listaDeptosPlana(_mat_config.departamentos || []);
  const deptosEstr  = _mat_config.departamentos || [];

  const tabFases = _mat_fasesActivas.map(function(f) {
    const prom   = logica_promediosFase(_mat_config, _mat_datos, _mat_baseline, f, deptosTodos, deptosEstr);
    const pct    = Math.round(prom.avance || 0);
    const nombre = NOMBRES_FASES[f].split('–')[0].trim();
    const activo = _mat_tabActiva === 'fase_' + f;
    return `<button class="sidebar-tab${activo ? ' activo' : ''}" data-tab="fase_${f}" style="--fase-enc:${FASE_COLORES[f].enc}">
      <span class="sidebar-icono sidebar-icono-fase"></span>
      <span class="sidebar-texto">${nombre}</span>
      <span class="sidebar-pct">${pct}%</span>
    </button>`;
  }).join('');

  const pisoLabel = _mat_pisoFiltro === 'todos'
    ? 'Todos los pisos'
    : (_mat_pisoFiltro < 0 ? 'Sub ' + Math.abs(_mat_pisoFiltro) : 'Piso ' + _mat_pisoFiltro);

  const filtroActActivo = _mat_tabActiva.startsWith('fase_') && !!_mat_actividadesFiltro[_mat_tabActiva];
  const hayFiltros      = _mat_pisoFiltro !== 'todos' || Object.values(_mat_actividadesFiltro).some(Boolean);
  const enFase          = _mat_tabActiva !== 'resumen' && _mat_tabActiva !== 'todas';

  return `
    <button class="sidebar-toggle" id="sidebar-toggle" title="${_mat_sidebarColapsado ? 'Expandir' : 'Colapsar'}">${_mat_sidebarColapsado ? '▶' : '◀'}</button>

    <div id="sidebar-fecha-slot" class="sidebar-fecha-slot"></div>

    <button class="btn-primario btn-sm sidebar-guardar${hayPendiente ? ' mat-btn-pendiente' : ''}" id="mat-btn-guardar-avances">
      <span class="sidebar-icono">✓</span><span class="sidebar-texto"> Guardar avances</span>
    </button>

    <div class="sidebar-sep"></div>

    <nav class="sidebar-nav">
      <button class="sidebar-tab${_mat_tabActiva === 'resumen' ? ' activo' : ''}" data-tab="resumen">
        <span class="sidebar-icono">📊</span><span class="sidebar-texto">Resumen</span>
      </button>
      <button class="btn-secundario btn-sm sidebar-btn-filtro" id="mat-btn-filtro-piso">
        <span class="sidebar-icono">🏢</span><span class="sidebar-texto">${pisoLabel}</span>
        ${_mat_pisoFiltro !== 'todos' ? '<span class="piso-filtro-x" id="mat-btn-limpiar-piso" title="Quitar filtro de piso">✕</span>' : ''}
      </button>
      <div class="sidebar-nav-sep"></div>
      ${tabFases}
      <button class="sidebar-tab${_mat_tabActiva === 'todas' ? ' activo' : ''}" data-tab="todas">
        <span class="sidebar-icono">⊞</span><span class="sidebar-texto">Todas las fases</span>
      </button>
    </nav>

    <div class="sidebar-spacer"></div>

    <div class="sidebar-acciones-wrap">
      <button class="sidebar-btn-accion sidebar-btn-acciones-toggle" id="mat-btn-acciones-toggle">
        <span class="sidebar-icono">⚙</span><span class="sidebar-texto">Acciones ▾</span>
      </button>
      <div class="sidebar-acciones-dropdown" id="sidebar-acciones-dropdown" style="display:none">
        <button class="sidebar-btn-accion-item" id="mat-btn-excel">
          <span class="sidebar-icono">⬇</span><span class="sidebar-texto">Excel</span>
        </button>
        <button class="sidebar-btn-accion-item" id="mat-btn-cargar">
          <span class="sidebar-icono">📂</span><span class="sidebar-texto">Cargar respaldo</span>
        </button>
        <button class="sidebar-btn-accion-item" id="mat-btn-exportar-json">
          <span class="sidebar-icono">💾</span><span class="sidebar-texto">Exportar respaldo</span>
        </button>
        <button class="sidebar-btn-accion-item sidebar-btn-peligro" id="mat-btn-resetear">
          <span class="sidebar-icono">↺</span><span class="sidebar-texto">Resetear avances</span>
        </button>
      </div>
      <input type="file" id="mat-input-cargar" accept=".json" style="display:none">
    </div>`;
}

// ── Toolbar móvil — fila única ───────────────────────────────────────────────
// Layout: [Piso ▼] [F1][F2]...[Fn] · · · [✓][🔍][•••]
function _mat_toolbarMovilHTML() {
  const pisos = (_mat_config.departamentos || [])
    .filter(function(p) { return p.cantidad > 0; })
    .sort(function(a, b) { return a.piso - b.piso; });

  const pisoSug      = _mat_sugerirPiso();
  const hayPendiente = datos_hayPendiente(_mat_id);

  const labelPiso = function(p) {
    return p < 0 ? 'Sub ' + Math.abs(p) : 'Piso ' + p;
  };

  // Select de piso: opción sugerida lleva ★
  const optionsPiso = pisos.map(function(p) {
    var sel   = String(p.piso) === String(_mat_pisoFiltro) ? ' selected' : '';
    var suger = p.piso === pisoSug ? ' ★' : '';
    return '<option value="' + p.piso + '"' + sel + '>' + labelPiso(p.piso) + suger + '</option>';
  }).join('');

  // Botones de fase compactos: F1, F2…
  const btnsFase = _mat_fasesActivas.map(function(f) {
    var activo = _mat_tabActiva === 'fase_' + f ? ' activo' : '';
    return '<button class="btn-fase-movil' + activo + '" data-fase="' + f
      + '" style="--fase-enc:' + FASE_COLORES[f].enc + '">F' + f + '</button>';
  }).join('');

  const filtroActActivo = _mat_tabActiva.startsWith('fase_') && !!_mat_actividadesFiltro[_mat_tabActiva];

  const msgCompleto = pisoSug === 'completados'
    ? '<div class="movil-completado-msg">✓ Todos los pisos se encuentran completados</div>'
    : '';

  // Layout: [Piso▼] [F1..Fn 🔍 [✕]] · · · [📅 fecha] [✓] [•••]
  return `
  <div class="mat-toolbar mat-toolbar-movil">
    <div class="movil-fila-unica">
      <select class="movil-select-piso" id="movil-select-piso">${optionsPiso}</select>
      <div class="movil-fases-scroll">
        ${btnsFase}
        <button class="movil-btn-icono movil-btn-icono-filtro${filtroActActivo ? ' filtro-activo' : ''}" id="mat-btn-filtro-act" title="Filtrar actividades">🔍</button>
        ${filtroActActivo ? '<button class="movil-btn-icono movil-btn-limpiar-act" id="mat-btn-limpiar-filtro-act" title="Quitar filtro actividades">✕</button>' : ''}
      </div>
      <!-- sc-fecha-wrap se inyecta ANTES de ✓ por _mat_render() -->
      <button class="movil-btn-guardar${hayPendiente ? ' mat-btn-pendiente' : ''}" id="mat-btn-guardar-avances" title="Guardar avances">✓</button>
      <div class="mat-menu-wrap">
        <button class="movil-btn-icono" id="mat-btn-mas" title="Más opciones">•••</button>
        <div class="mat-menu-dropdown" id="mat-menu-dropdown" style="display:none">
          <button class="mat-menu-item" id="mat-btn-cargar">📂 Cargar respaldo</button>
          <button class="mat-menu-item" id="mat-btn-exportar-json">💾 Exportar respaldo</button>
          <button class="mat-menu-item mat-menu-item-peligro" id="mat-btn-resetear">↺ Resetear avances</button>
        </div>
      </div>
      <input type="file" id="mat-input-cargar" accept=".json" style="display:none">
    </div>
    ${msgCompleto}
  </div>`;
}

function _mat_renderContenido() {
  const contenido = document.getElementById('mat-contenido');
  if (!contenido) return;

  if (_mat_tabActiva === 'resumen') {
    contenido.innerHTML = _mat_tablaResumen();
  } else if (_mat_tabActiva === 'todas') {
    contenido.innerHTML = _mat_fasesActivas.map(f => _mat_tablaFase(f)).join('');
  } else if (_mat_tabActiva.startsWith('fase_')) {
    const fase = parseInt(_mat_tabActiva.split('_')[1]);
    contenido.innerHTML = _mat_tablaFase(fase);
  }
  _mat_registrarEventosCeldas();
  _term_aplicarStickyH();
  if (_mat_colsOcultas) _mat_aplicarToggleCols();
}

// ── Tabla Resumen ────────────────────────────────────────────────────────────

function _mat_tablaResumen() {
  // El Resumen SIEMPRE muestra el proyecto completo, sin importar el filtro de piso.
  const departamentosProy = _mat_config.departamentos || [];
  const deptosProy        = logica_listaDeptosPlana(departamentosProy);
  const totalPisos        = _mat_config.pisos || 0;
  const totalDeptos       = logica_totalDepartamentos(departamentosProy);

  // Promedios por fase calculados sobre el proyecto completo.
  const filasData = _mat_fasesActivas.map(fase => ({
    fase,
    c:    FASE_COLORES[fase],
    prom: _mat_promediosFase(fase, deptosProy, departamentosProy),
  }));

  // Fila "Consolidado fases": promedio simple de las fases activas.
  const consAvg = key => {
    const vals = filasData.map(f => f.prom[key]).filter(v => v !== null && !isNaN(v));
    return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0;
  };
  const cons = {
    avance:      Math.round(consAvg('avance')),
    piso:        consAvg('piso'),
    deltaPiso:   consAvg('deltaPiso'),
    deptos:      consAvg('deptos'),
    deltaDeptos: consAvg('deltaDeptos'),
  };

  // Helpers de formato.
  const deltaCls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const deltaTxt = v => (v > 0 ? '+' : '') + interfaz_fmtNum(v);

  // Estilos compartidos: texto negro, centrado, y borde derecho grueso después
  // de "Total Deptos" para separar visualmente los datos del proyecto del bloque
  // de cálculos.
  const cN  = 'style="text-align:center;color:#000"';
  const cND = 'style="text-align:center;color:#000;border-right:2px solid #333"';

  const filaPorFase = ({ fase, c, prom }) => `
    <tr>
      <td class="celda-fase-label" style="background:${c.enc};color:#000">${NOMBRES_FASES[fase]}</td>
      <td class="num" ${cN}>${totalPisos}</td>
      <td class="num" ${cND}>${totalDeptos}</td>
      <td class="num" ${cN}>${prom.avance !== null ? interfaz_fmtPct(prom.avance) : '—'}</td>
      <td class="num" ${cN}>${interfaz_fmtNum(prom.piso)}</td>
      <td class="num" ${cN}>${interfaz_fmtNum(prom.deptos)}</td>
      <td><div class="barra-pct" style="--pct:${prom.avance !== null ? Math.min(100, prom.avance) : 0}%;--color:${c.fondo}"></div></td>
    </tr>`;

  const filaConsolidado = `
    <tr class="fila-consolidado" style="background:#fff;color:#000;font-weight:600;border-top:2px solid #333">
      <td style="color:#000;font-weight:600">Consolidado fases</td>
      <td class="num" ${cN}>${totalPisos}</td>
      <td class="num" ${cND}>${totalDeptos}</td>
      <td class="num" ${cN}>${interfaz_fmtPct(cons.avance)}</td>
      <td class="num" ${cN}>${interfaz_fmtNum(cons.piso)}</td>
      <td class="num" ${cN}>${interfaz_fmtNum(cons.deptos)}</td>
      <td><div class="barra-pct" style="--pct:${Math.min(100, cons.avance)}%;--color:#000"></div></td>
    </tr>`;

  return `
  <div class="tabla-scroll">
    <table class="tabla-mat tabla-resumen">
      <thead>
        <tr>
          <th style="text-align:center">Fase</th>
          <th style="text-align:center">Total Pisos</th>
          <th style="text-align:center;border-right:2px solid #333">Total Deptos</th>
          <th style="text-align:center">% Avance</th>
          <th style="text-align:center">Piso Aprox.</th>
          <th style="text-align:center">Deptos<br>terminados</th>
          <th style="text-align:center;min-width:140px">Avance</th>
        </tr>
      </thead>
      <tbody>${filasData.map(filaPorFase).join('')}${filaConsolidado}</tbody>
    </table>
  </div>`;
}

// ── Tabla Consolidado (programado vs real) ───────────────────────────────────
// Pestaña entre Resumen y F1. Muestra, por semana de la planificación inicial,
// el avance programado y el real lado a lado. Estructura inspirada en la hoja
// "Consolidado" de las curvas de RVC: dos bloques (Programado / Real) con
// OG (solo Piso) + cada fase activa (% y Piso). Paso 1: columnas Programado
// se llenan desde config.term_schedule; las columnas Real quedan en "—" por
// ahora (se completarán en el Paso 2).

// ── Tabla por Fase ───────────────────────────────────────────────────────────

function _mat_tablaFase(fase) {
  const faseKey    = 'fase_' + fase;
  const celdas     = _mat_datos[faseKey] || {};
  const celdasBase = _mat_baseline[faseKey] || {};
  const numsBase   = logica_actividadesDeFase(_mat_config, fase);
  const _filtroFase = _mat_actividadesFiltro['fase_' + fase] || null;
  const nums       = _filtroFase
    ? numsBase.filter(n => _filtroFase.has(n))
    : numsBase;
  const deptosFiltro  = _mat_deptosFiltrados();
  const departamentos = _mat_departamentosFiltrados();
  const c             = FASE_COLORES[fase];

  if (nums.length === 0) return '';

  const colsDepto = deptosFiltro.map(d =>
    `<th class="col-depto" title="${d}">${d}</th>`).join('');

  const filas = nums.map(num => {
    const nombre    = _mat_abreviado
      ? actividades_getAbrev(num)
      : actividades_getNombreProyecto(_mat_config, num);
    const deptsTerm = logica_deptosTerminadosActividad(_mat_datos, faseKey, num, deptosFiltro);
    const piso      = logica_pisoActividad(_mat_datos, faseKey, num, deptosFiltro, departamentos);
    const avance    = logica_avanceActividad(_mat_datos, faseKey, num, deptosFiltro);

    const celdas_ = deptosFiltro.map(depto => {
      const key = depto + '_' + num;
      const val = celdas[key] || 0;
      const cl  = _mat_claseValor(val);
      return `<td class="celda-mat ${cl}" data-fase="${faseKey}" data-key="${key}" data-val="${val}" tabindex="0">${val > 0 ? val + '%' : ''}</td>`;
    }).join('');

    return `
    <tr>
      <td class="celda-codigo">${num}</td>
      <td class="celda-act-nombre">${nombre}</td>
      <td class="num term-sticky-col">${interfaz_fmtPct(avance)}</td>
      <td class="num term-sticky-col">${interfaz_fmtNum(piso)}</td>
      <td class="num term-sticky-col">${deptsTerm}</td>
      ${celdas_}
    </tr>`;
  });

  // Fila "Término Fx" — todas las columnas calculadas son promedios simples por
  // actividad (ver helper _mat_promediosFase).
  const prom = _mat_promediosFase(fase);

  // Celda por depto en la fila Término Fx: % de actividades de la fase al 100%
  // para ese depto (deptos al 100% en la columna del depto / total actividades).
  const celdasTerminoDeptos = deptosFiltro.map(depto => {
    if (nums.length === 0) return '<td class="num">—</td>';
    let countAl100 = 0;
    nums.forEach(num => {
      if ((celdas[depto + '_' + num] || 0) >= 100) countAl100++;
    });
    const pct = Math.round((countAl100 / nums.length) * 100);
    return `<td class="num">${interfaz_fmtPct(pct)}</td>`;
  }).join('');

  const filaTermino = `
  <tr class="fila-termino" style="background:${c.enc};color:#000">
    <td class="celda-codigo"></td>
    <td>Término ${NOMBRES_FASES[fase].split('–')[0].trim()}</td>
    <td class="num term-sticky-col">${prom.avance !== null ? interfaz_fmtPct(prom.avance) : '—'}</td>
    <td class="num term-sticky-col">${interfaz_fmtNum(prom.piso)}</td>
    <td class="num term-sticky-col">${interfaz_fmtNum(prom.deptos)}</td>
    ${celdasTerminoDeptos}
  </tr>`;

  return `
  <div class="bloque-fase-mat" data-fase="${faseKey}" style="--fase-enc:${c.enc};--fase-txt:${c.txt}">
    <div class="tabla-scroll tabla-scroll-mat">
      <table class="tabla-mat${_mat_abreviado ? ' tabla-abreviada' : ''}">
        <thead>
          <tr class="fila-fase-titulo">
            <td colspan="2" class="sticky-left fase-titulo-cel" style="background:${c.enc};color:#000">
              ${NOMBRES_FASES[fase]}
              ${!interfaz_esMovil() ? `<span class="fase-titulo-acciones">
                <button class="btn-toggle-cols-mat" title="${_mat_colsOcultas ? 'Mostrar columnas' : 'Ocultar columnas'}">${_mat_colsOcultas ? '⊞' : '⊟'}</button>
              </span>` : ''}
            </td>
            <td colspan="${3 + deptosFiltro.length}" style="background:${c.enc}"></td>
          </tr>
          <tr>
            <th class="th-codigo sticky-left">Código</th>
            <th class="th-act sticky-left">Actividad ${interfaz_esMovil() ? `<button class="btn-abrev-hdr" title="${_mat_abreviado ? 'Ver nombre completo' : 'Abreviar nombres'}" style="font-size:10px;padding:1px 5px;margin-left:4px;border:0.5px solid #aaa;border-radius:3px;background:#f0f0f0;color:#444;cursor:pointer;vertical-align:middle;line-height:1.4">${_mat_abreviado ? '↔' : 'Ab'}</button>` : ''}</th>
            <th class="term-sticky-col">%<br>Avance</th><th class="term-sticky-col">Piso<br>Aprox.</th><th class="term-sticky-col">Deptos</th>
            ${colsDepto}
          </tr>
        </thead>
        <tbody>${filas.join('')}${filaTermino}</tbody>
      </table>
    </div>
  </div>`;
}

// ── Sticky horizontal: congelar columnas de cálculo ─────────────────────────

function _term_aplicarStickyH() {
  // Abreviado en móvil: ocultar Código (idx 0) + columnas de cálculo (idx 2,3,4)
  // para que la tabla entre en pantalla sin scroll horizontal.
  const _abreMovil = _mat_abreviado && interfaz_esMovil();
  document.querySelectorAll('#mat-contenido .tabla-mat:not(.tabla-resumen):not(.tabla-consolidado)').forEach(function(tabla) {
    tabla.querySelectorAll('thead tr').forEach(function(tr) {
      if (tr.classList.contains('fila-fase-titulo')) return;
      // No resetear si _mat_colsOcultas está activo — _mat_aplicarToggleCols los controla
      if (!_mat_colsOcultas) {
        [0, 2, 3, 4].forEach(function(idx) {
          if (tr.children[idx]) tr.children[idx].style.display = _abreMovil ? 'none' : '';
        });
      }
    });
    tabla.querySelectorAll('tbody tr').forEach(function(tr) {
      if (!_mat_colsOcultas) {
        [0, 2, 3, 4].forEach(function(idx) {
          if (tr.children[idx]) tr.children[idx].style.display = _abreMovil ? 'none' : '';
        });
      }
    });
  });

  // Forzar ancho mínimo de contenido en columnas sticky de texto antes de medir.
  // Con white-space:nowrap, width:1px hace que el navegador use exactamente el
  // ancho del texto, evitando que table-layout:auto las infle cuando hay pocos
  // deptos visibles (ej. filtro por piso).
  ['.th-codigo', '.celda-codigo', '.th-act', '.celda-act-nombre'].forEach(function(sel) {
    document.querySelectorAll('#mat-contenido .tabla-mat ' + sel).forEach(function(el) {
      el.style.minWidth = '';
      el.style.maxWidth = '';
      el.style.width = '1px';
    });
  });

  // Normalizar ancho de columna Código al más ancho de todas las tablas
  const codThs = document.querySelectorAll('#mat-contenido .tabla-mat .th-codigo');
  let maxCodW = 0;
  codThs.forEach(th => { if (th.scrollWidth > maxCodW) maxCodW = th.scrollWidth; });
  if (maxCodW > 0) {
    codThs.forEach(th => { th.style.minWidth = maxCodW + 'px'; th.style.maxWidth = maxCodW + 'px'; });
    document.querySelectorAll('#mat-contenido .tabla-mat .celda-codigo').forEach(td => {
      td.style.minWidth = maxCodW + 'px'; td.style.maxWidth = maxCodW + 'px';
    });
  }

  // Normalizar ancho de columna Actividad al más ancho de todas las tablas
  const actThs = document.querySelectorAll('#mat-contenido .tabla-mat .th-act');
  let maxActW = 0;
  actThs.forEach(th => { if (th.scrollWidth > maxActW) maxActW = th.scrollWidth; });
  if (maxActW > 0) {
    actThs.forEach(th => { th.style.minWidth = maxActW + 'px'; th.style.maxWidth = maxActW + 'px'; });
    document.querySelectorAll('#mat-contenido .tabla-mat .celda-act-nombre').forEach(td => {
      td.style.minWidth = maxActW + 'px'; td.style.maxWidth = maxActW + 'px';
    });
  }

  document.querySelectorAll('#mat-contenido .tabla-mat').forEach(tabla => {
    // La tabla Consolidado tiene un encabezado de 3 niveles (con colspan/rowspan)
    // y no necesita columnas sticky horizontales. Saltarla evita romper el layout.
    if (tabla.classList.contains('tabla-consolidado')) return;
    const allHeaderRows = tabla.querySelectorAll('thead tr');
    const headerRow = allHeaderRows[allHeaderRows.length - 1]; // última fila = columnas reales
    if (!headerRow) return;
    const ths = [...headerRow.children];

    // Identificar los índices de las celdas fijas (sticky-left + term-sticky-col).
    const stickyIdxs = [];
    ths.forEach((th, i) => {
      if (th.classList.contains('sticky-left') || th.classList.contains('term-sticky-col')) {
        stickyIdxs.push(i);
      }
    });

    let left = 0;
    const stickyMap = []; // [{i, left}]

    // Colores resueltos a hex para evitar problemas con var() en estilo inline.
    const HEX_FONDO_ALT  = '#f0f1f3';
    const HEX_FONDO_CARD = '#ffffff';
    const HEX_BORDE      = '#d0d3d8'; // var(--borde-suave) aproximado

    ths.forEach((th, i) => {
      // Forzar sticky vertical en TODOS los TH del encabezado de columnas.
      th.style.position = 'sticky';
      th.style.top      = '0';
      th.style.zIndex   = '5';
      if (!th.style.background) th.style.background = HEX_FONDO_ALT;

      const idxInSticky = stickyIdxs.indexOf(i);
      if (idxInSticky < 0) return;

      // Sticky horizontal + esquina con z-index aún mayor.
      th.style.left   = left + 'px';
      th.style.zIndex = '6';
      // Primera columna fija: "extender" su fondo hacia la izquierda con un
      // box-shadow muy ancho para cubrir el padding del panel y cualquier
      // contenido que se cuele por ahí al hacer scroll horizontal.
      if (idxInSticky === 0) {
        th.style.boxShadow = '-300px 0 0 0 ' + HEX_FONDO_ALT;
      }
      // Última columna fija: borde derecho grueso gris para sellar la rendija
      // con la primera columna de deptos (donde se asoma el color de la fase).
      if (idxInSticky === stickyIdxs.length - 1) {
        th.style.borderRight = '2px solid ' + HEX_BORDE;
      }
      stickyMap.push({ i, left });
      // Usamos getBoundingClientRect().width (decimal) en vez de offsetWidth
      // (entero) para no perder fracciones de pixel en la suma.
      left += th.getBoundingClientRect().width;
    });

    // Sticky horizontal en celdas de tbody — fondo SIEMPRE opaco; la primera
    // columna fija extiende su fondo hacia la izquierda para tapar el padding;
    // la última refuerza su borde derecho.
    tabla.querySelectorAll('tbody tr').forEach(row => {
      const isTermino = row.classList.contains('fila-termino');
      const rowBg     = isTermino ? (row.style.background || HEX_FONDO_CARD) : HEX_FONDO_CARD;
      stickyMap.forEach(({ i, left }, idxInMap) => {
        const td = row.children[i];
        if (!td) return;
        td.style.position   = 'sticky';
        td.style.left       = left + 'px';
        td.style.zIndex     = '3';
        td.style.background = rowBg;
        if (idxInMap === 0) {
          td.style.boxShadow = '-300px 0 0 0 ' + rowBg;
        }
        if (idxInMap === stickyMap.length - 1) {
          td.style.borderRight = '2px solid ' + HEX_BORDE;
        }
      });
    });
  });

  // Normalizar anchos de columnas de departamento.
  // En móvil: distribuir el espacio disponible para que todos los deptos entren
  // en pantalla sin scroll horizontal.
  // En escritorio: usar el ancho natural más ancho de todas las tablas.
  var allDeptoThs = document.querySelectorAll(
    '#mat-contenido .tabla-mat:not(.tabla-resumen):not(.tabla-consolidado) .col-depto'
  );
  if (allDeptoThs.length > 0) {
    allDeptoThs.forEach(function(th) { th.style.minWidth = ''; th.style.maxWidth = ''; th.style.width = ''; });

    if (interfaz_esMovil()) {
      // Medir hasta dónde llega la última columna sticky (coord. viewport)
      var stickyRight = 0;
      var primeraTabla = document.querySelector(
        '#mat-contenido .tabla-mat:not(.tabla-resumen):not(.tabla-consolidado)'
      );
      if (primeraTabla) {
        primeraTabla.querySelectorAll('thead tr:last-child th').forEach(function(th) {
          if (th.classList.contains('sticky-left') || th.classList.contains('term-sticky-col')) {
            var r = th.getBoundingClientRect().right;
            if (r > stickyRight) stickyRight = r;
          }
        });
      }
      // Número de deptos por tabla (todas las tablas tienen los mismos deptos)
      var numTablas = document.querySelectorAll(
        '#mat-contenido .tabla-mat:not(.tabla-resumen):not(.tabla-consolidado)'
      ).length;
      var numDeptos = numTablas > 0 ? Math.round(allDeptoThs.length / numTablas) : allDeptoThs.length;
      if (numDeptos < 1) numDeptos = 1;

      // Espacio disponible = borde derecho del contenedor real de la tabla (#mat-contenido),
      // descontando su padding derecho. Esto evita que los deptos excedan el área visible.
      var matContent = document.getElementById('mat-contenido');
      var rightBound = window.innerWidth; // fallback
      if (matContent) {
        var cs = window.getComputedStyle(matContent);
        rightBound = matContent.getBoundingClientRect().right
          - parseFloat(cs.paddingRight || '0')
          - parseFloat(cs.borderRightWidth || '0');
      }
      var available = rightBound - stickyRight;
      var deptoW = Math.max(26, Math.floor(available / numDeptos));

      allDeptoThs.forEach(function(th) {
        th.style.minWidth = deptoW + 'px';
        th.style.maxWidth = deptoW + 'px';
        th.style.width    = deptoW + 'px';
      });
    } else {
      // Escritorio: respetar el ancho natural del contenido
      var maxDeptoW = 48;
      allDeptoThs.forEach(function(th) { if (th.scrollWidth > maxDeptoW) maxDeptoW = th.scrollWidth; });
      allDeptoThs.forEach(function(th) {
        th.style.minWidth = maxDeptoW + 'px';
        th.style.maxWidth = maxDeptoW + 'px';
        th.style.width    = maxDeptoW + 'px';
      });
    }
  }
}

// ── Auto-scroll durante arrastre ────────────────────────────────────────────
// Cuando el puntero se acerca al borde del panel, scrollea suavemente y
// re-evalúa la celda bajo el cursor para extender la selección.

function _mat_mousemoveScrollHandler(e) {
  if (!_arrastrando) return;
  _ptrClientX = e.clientX;
  _ptrClientY = e.clientY;
  if (!_scrollRAF) _scrollRAF = requestAnimationFrame(_mat_autoScrollLoop);
}

function _mat_autoScrollLoop() {
  if (!_arrastrando) { _scrollRAF = null; return; }
  const panel = document.getElementById('panel-tab-term');
  if (!panel) { _scrollRAF = null; return; }

  const rect = panel.getBoundingClientRect();
  const ZONA = 72;  // px desde el borde donde empieza el scroll
  const VEL  = 12;  // velocidad máxima en px por frame
  const vel  = d => Math.round(VEL * Math.max(0, 1 - d / ZONA));

  let dx = 0, dy = 0;
  if (_ptrClientX < rect.left   + ZONA) dx = -vel(_ptrClientX - rect.left);
  if (_ptrClientX > rect.right  - ZONA) dx =  vel(rect.right  - _ptrClientX);
  if (_ptrClientY < rect.top    + ZONA) dy = -vel(_ptrClientY - rect.top);
  if (_ptrClientY > rect.bottom - ZONA) dy =  vel(rect.bottom - _ptrClientY);

  if (dx || dy) {
    panel.scrollLeft += dx;
    panel.scrollTop  += dy;
    // Tras desplazar el panel, re-evaluar la celda bajo el cursor
    const el = document.elementFromPoint(_ptrClientX, _ptrClientY);
    const t  = el?.closest('.celda-mat');
    if (t && _ancla) _mat_seleccionarRango(_ancla, t, _sel);
  }

  _scrollRAF = requestAnimationFrame(_mat_autoScrollLoop);
}

function _mat_detenerAutoScroll() {
  if (_scrollRAF) { cancelAnimationFrame(_scrollRAF); _scrollRAF = null; }
}

// ── Interacción con celdas ───────────────────────────────────────────────────

function _mat_registrarEventosCeldas() {
  _sel = new Set();
  _ancla = null;
  _arrastrando = false;

  document.querySelectorAll('.celda-mat').forEach(td => {
    td.addEventListener('click', e => {
      // Ignorar el click sintético que el browser dispara tras touchend en móvil
      if (_ultimoFueToque) { _ultimoFueToque = false; return; }
      if (!presencia_esModoEditor()) return; // modo visualizador: sin edición
      if (e.shiftKey && _ancla) {
        _mat_seleccionarRango(_ancla, td, _sel);
        _mat_mostrarSelectorFlotante(_sel);
        return;
      }
      // Click simple (mouse real) → mostrar burbuja
      _sel.clear();
      _ancla = td;
      _sel.add(td);
      _mat_mostrarSelectorFlotante(_sel);
    });

    td.addEventListener('dblclick', e => {
      e.stopPropagation();
      _mat_abrirInputInline(td);
    });

    td.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      _arrastrando = true;
      _sel.clear();
      _ancla = td;
      _sel.add(td);
    });

    td.addEventListener('mouseover', () => {
      if (_arrastrando && _ancla) _mat_seleccionarRango(_ancla, td, _sel);
    });

    td.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _sel.clear(); _sel.add(td); _mat_mostrarSelectorFlotante(_sel); }
    });

    td.addEventListener('touchstart', e => {
      // Las celdas capturan el toque completamente (igual que un click de mouse).
      // Para scrollear, usar la columna de actividades o los encabezados.
      e.preventDefault();
      _ultimoFueToque = true; // bloquear el click sintético posterior
      _arrastrando = true;
      _sel.clear();
      _ancla = td;
      _sel.add(td);
      td.classList.add('seleccionada');
    }, { passive: false });

    td.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      _ptrClientX = t.clientX;
      _ptrClientY = t.clientY;
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const target = el?.closest('.celda-mat');
      if (target && _ancla) _mat_seleccionarRango(_ancla, target, _sel);
      if (!_scrollRAF) _scrollRAF = requestAnimationFrame(_mat_autoScrollLoop);
    }, { passive: false });

    td.addEventListener('touchend', () => {
      _mat_detenerAutoScroll();
      // Siempre mostrar burbuja: celda única o selección múltiple
      _mat_mostrarSelectorFlotante(_sel);
      _arrastrando = false;
    });
  });

  document.addEventListener('mouseup', () => {
    _mat_detenerAutoScroll();
    if (_arrastrando && _sel.size > 1) _mat_mostrarSelectorFlotante(_sel);
    _arrastrando = false;
  });

  // Botón abreviar nombres en encabezado Actividad
  document.querySelectorAll('.btn-abrev-hdr').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _mat_abreviado = !_mat_abreviado;
      _mat_renderContenido();
    });
  });
}

function _mat_ciclarValor(td) {
  const actual = parseInt(td.dataset.val) || 0;
  // Si la celda ya está al 100%, pedir confirmación antes de bajar el avance
  if (actual === 100) {
    interfaz_mostrarModal(
      'Actividad completada',
      'Esta actividad ya está al 100%. ¿Deseas modificar el avance?',
      () => {
        const idx  = VALORES_CICLO.indexOf(actual);
        const nuevo = VALORES_CICLO[(idx + 1) % VALORES_CICLO.length];
        _mat_setCelda(td, nuevo);
      }
    );
    return;
  }
  const idx  = VALORES_CICLO.indexOf(actual);
  const nuevo = VALORES_CICLO[(idx + 1) % VALORES_CICLO.length];
  _mat_setCelda(td, nuevo);
}

function _mat_setCelda(td, valor) {
  const faseKey = td.dataset.fase;
  const key     = td.dataset.key;
  if (!faseKey || !key) return;

  if (!_mat_datos[faseKey]) _mat_datos[faseKey] = {};
  _mat_datos[faseKey][key] = valor;
  datos_guardarMatrices(_mat_id, _mat_datos);
  window._coa_guardadoPendiente = true;

  // Actualizar TODAS las celdas con la misma key en el DOM
  document.querySelectorAll(`.celda-mat[data-fase="${faseKey}"][data-key="${key}"]`).forEach(c => {
    c.dataset.val = valor;
    c.className   = 'celda-mat ' + _mat_claseValor(valor);
    c.textContent = valor > 0 ? valor + '%' : '';
  });

  // Recalcular fila de actividad y fila de término
  const [depto, num] = key.split('_');
  _mat_recalcularFilaActividad(faseKey, parseInt(num));
  _mat_recalcularFilaTermino(faseKey, parseInt(faseKey.split('_')[1]));
  _mat_recalcularResumen();
}

function _mat_recalcularFilaActividad(faseKey, num) {
  const deptosFiltro  = _mat_deptosFiltrados();
  const departamentos = _mat_departamentosFiltrados();

  const deptsTerm = logica_deptosTerminadosActividad(_mat_datos, faseKey, num, deptosFiltro);
  const piso      = logica_pisoActividad(_mat_datos, faseKey, num, deptosFiltro, departamentos);
  const avance    = logica_avanceActividad(_mat_datos, faseKey, num, deptosFiltro);

  document.querySelectorAll(`.tabla-mat tbody tr`).forEach(tr => {
    const primeraTd = tr.querySelector(`.celda-mat[data-fase="${faseKey}"][data-key*="_${num}"]`);
    if (!primeraTd) return;
    const tds = tr.querySelectorAll('td');
    // tds[0]=Código, tds[1]=Actividad, tds[2]=%Avance, tds[3]=PisoAprox,
    // tds[4]=Deptos, tds[5+]=celdas depto.
    if (tds[2]) tds[2].textContent = interfaz_fmtPct(avance);
    if (tds[3]) tds[3].textContent = interfaz_fmtNum(piso);
    if (tds[4]) tds[4].textContent = deptsTerm;
  });
}

function _mat_recalcularFilaTermino(faseKey, fase) {
  if (!fase) return;
  const prom         = _mat_promediosFase(fase);
  const deptosFiltro = _mat_deptosFiltrados();
  const nums         = logica_actividadesDeFase(_mat_config, fase);
  const celdas       = _mat_datos[faseKey] || {};

  // Scopeamos a las filas Término que pertenecen a esta fase (con el data-fase
  // del bloque). Cuando se ven varias fases a la vez ("Todas"), esto evita
  // pisar los Termino de otras fases con datos equivocados.
  document.querySelectorAll(`.bloque-fase-mat[data-fase="${faseKey}"] .fila-termino`).forEach(tr => {
    const tds = tr.querySelectorAll('td');
    // Índices corridos en +1 por la nueva columna Código.
    // tds[0]=Código (vacío), tds[1]="Término Fx", tds[2..6]=cálculos, tds[7+]=deptos.
    if (tds[2]) tds[2].textContent = prom.avance !== null ? interfaz_fmtPct(prom.avance) : '—';
    if (tds[3]) tds[3].textContent = interfaz_fmtNum(prom.piso);
    if (tds[4]) tds[4].textContent = interfaz_fmtNum(prom.deptos);
    // Celdas por depto a partir de tds[5]: % de actividades de la fase al 100%.
    deptosFiltro.forEach((depto, idx) => {
      const td = tds[5 + idx];
      if (!td) return;
      if (nums.length === 0) { td.textContent = '—'; return; }
      let countAl100 = 0;
      nums.forEach(num => {
        if ((celdas[depto + '_' + num] || 0) >= 100) countAl100++;
      });
      const pct = Math.round((countAl100 / nums.length) * 100);
      td.textContent = interfaz_fmtPct(pct);
    });
  });
}

function _mat_recalcularResumen() {
  if (_mat_tabActiva !== 'resumen') return;
  // La tabla del Resumen tiene fila Consolidado y muchas columnas calculadas;
  // regenerar el bloque completo es más simple y barato que actualizar celda
  // por celda. Sin estado interactivo, esto no genera flicker perceptible.
  const contenido = document.getElementById('mat-contenido');
  if (contenido) contenido.innerHTML = _mat_tablaResumen();
}

// ── Selector flotante ────────────────────────────────────────────────────────

function _mat_mostrarSelectorFlotante(sel) {
  let flotante = document.getElementById('mat-flotante');
  if (!flotante) {
    flotante = document.createElement('div');
    flotante.id = 'mat-flotante';
    flotante.className = 'mat-flotante';
    document.body.appendChild(flotante);
  }
  const labelCeldas = sel.size === 1 ? 'Avance:' : `${sel.size} celdas:`;
  flotante.innerHTML = `
    <span class="flotante-label">${labelCeldas}</span>
    ${VALORES_CICLO.map(v => `<button class="btn-flotante btn-v${v}" data-val="${v}">${v}%</button>`).join('')}
    <button class="btn-flotante btn-cerrar-flotante">✕</button>`;

  flotante.style.display = 'flex';
  // Posicionar dentro del viewport
  const first = [...sel][0];
  const rect  = first.getBoundingClientRect();
  // Medir el flotante después de hacerlo visible
  const fw = flotante.offsetWidth  || 320;
  const fh = flotante.offsetHeight || 52;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Preferir arriba de la celda; si no cabe, ir abajo
  let top  = rect.top - fh - 6;
  if (top < 4) top = rect.bottom + 6;
  if (top + fh > vh - 4) top = Math.max(4, vh - fh - 4);
  // Preferir alinear con la celda; ajustar si se sale por la derecha
  let left = rect.left;
  if (left + fw > vw - 4) left = vw - fw - 4;
  if (left < 4) left = 4;
  flotante.style.position = 'fixed';
  flotante.style.top  = top  + 'px';
  flotante.style.left = left + 'px';

  flotante.querySelectorAll('[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nuevoValor = parseInt(btn.dataset.val);
      const celdas100 = [...sel].filter(td => parseInt(td.dataset.val) === 100);

      const aplicar = () => {
        sel.forEach(td => _mat_setCelda(td, nuevoValor));
        sel.clear();
        flotante.style.display = 'none';
      };

      // Si hay celdas al 100% y el nuevo valor es menor, pedir confirmación
      if (celdas100.length > 0 && nuevoValor < 100) {
        flotante.style.display = 'none';
        const msg = celdas100.length === 1
          ? 'Una de las celdas seleccionadas ya está al 100%. ¿Deseas modificar el avance?'
          : `${celdas100.length} celdas seleccionadas ya están al 100%. ¿Deseas modificar su avance?`;
        interfaz_mostrarModal('Actividades completadas', msg, aplicar);
      } else {
        aplicar();
      }
    });
  });
  flotante.querySelector('.btn-cerrar-flotante')?.addEventListener('click', () => {
    sel.clear();
    flotante.style.display = 'none';
  });
}

function _mat_getCellPos(td) {
  const tbody = td.closest('tbody');
  if (!tbody) return null;
  const todasFilas = [...tbody.querySelectorAll('tr')].filter(r => r.querySelector('.celda-mat'));
  const tr = td.closest('tr');
  const rowIdx = todasFilas.indexOf(tr);
  const colIdx = [...tr.querySelectorAll('.celda-mat')].indexOf(td);
  return { tbody, rowIdx, colIdx };
}

function _mat_seleccionarRango(tdA, tdB, sel) {
  const posA = _mat_getCellPos(tdA);
  const posB = _mat_getCellPos(tdB);
  if (!posA || !posB || posA.tbody !== posB.tbody) return;

  const minR = Math.min(posA.rowIdx, posB.rowIdx);
  const maxR = Math.max(posA.rowIdx, posB.rowIdx);
  const minC = Math.min(posA.colIdx, posB.colIdx);
  const maxC = Math.max(posA.colIdx, posB.colIdx);

  const todasFilas = [...posA.tbody.querySelectorAll('tr')].filter(r => r.querySelector('.celda-mat'));
  sel.clear();
  for (let r = minR; r <= maxR; r++) {
    const celdas = [...todasFilas[r].querySelectorAll('.celda-mat')];
    for (let c = minC; c <= maxC; c++) {
      if (celdas[c]) sel.add(celdas[c]);
    }
  }
  document.querySelectorAll('.celda-mat').forEach(td => td.classList.remove('seleccionada'));
  sel.forEach(td => td.classList.add('seleccionada'));
}

// ── Input inline (doble clic → escritura manual) ─────────────────────────────

function _mat_abrirInputInline(td) {
  const rect = td.getBoundingClientRect();
  let inp = document.getElementById('mat-input-inline');
  if (!inp) {
    inp = document.createElement('input');
    inp.id = 'mat-input-inline';
    inp.type = 'number';
    inp.className = 'mat-input-inline';
    document.body.appendChild(inp);

    const _commit = () => {
      const target = inp._td;
      if (!target) { inp.style.display = 'none'; return; }
      inp._td = null;
      inp.style.display = 'none';
      const raw = parseFloat(inp.value);
      if (!isNaN(raw)) {
        const n = Math.round(Math.min(100, Math.max(0, raw)) / 25) * 25;
        _mat_setCelda(target, n);
      }
    };

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _commit(); }
      if (e.key === 'Escape') { inp._td = null; inp.style.display = 'none'; }
    });
    inp.addEventListener('blur', _commit);
  }

  inp.value = td.dataset.val || '0';
  inp.style.top    = rect.top    + 'px';
  inp.style.left   = rect.left   + 'px';
  inp.style.width  = rect.width  + 'px';
  inp.style.height = rect.height + 'px';
  inp.style.display = 'block';
  inp._td = td;
  inp.select();
  inp.focus();
}

// ── Paste desde Excel ────────────────────────────────────────────────────────

function _mat_pasteHandler(e) {
  if (!_ancla) return;
  e.preventDefault();
  const filasPaste = e.clipboardData.getData('text').trim()
    .split(/\r?\n/).map(r => r.split('\t'));

  const tbody = _ancla.closest('tbody');
  if (!tbody) return;
  const todasFilas = [...tbody.querySelectorAll('tr')].filter(r => r.querySelector('.celda-mat'));
  const anclaTr  = _ancla.closest('tr');
  const rowStart = todasFilas.indexOf(anclaTr);
  const colStart = [...anclaTr.querySelectorAll('.celda-mat')].indexOf(_ancla);

  filasPaste.forEach((cols, dr) => {
    const tr = todasFilas[rowStart + dr];
    if (!tr) return;
    const celdas = [...tr.querySelectorAll('.celda-mat')];
    cols.forEach((val, dc) => {
      const td = celdas[colStart + dc];
      if (!td) return;
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      const n = Math.round(Math.min(100, Math.max(0, isNaN(num) ? 0 : num)) / 25) * 25;
      _mat_setCelda(td, n);
    });
  });
}

// ── Cierre semanal ───────────────────────────────────────────────────────────

// ── Registro de eventos de la vista ─────────────────────────────────────────

function _mat_registrarEventos() {
  // ── Select de piso (móvil) ────────────────────────────────────────────────
  const selectPiso = document.getElementById('movil-select-piso');
  if (selectPiso) {
    selectPiso.addEventListener('change', function() {
      _mat_pisoFiltro = this.value === 'todos' ? 'todos' : parseInt(this.value);
      _mat_renderContenido();
    });
  }

  // ── Botones de fase (móvil) ────────────────────────────────────────────────
  document.querySelectorAll('.btn-fase-movil').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _mat_tabActiva = 'fase_' + btn.dataset.fase;
      document.querySelectorAll('.btn-fase-movil').forEach(function(b) { b.classList.remove('activo'); });
      btn.classList.add('activo');
      const panel = document.getElementById('panel-tab-term');
      if (panel) { panel.scrollLeft = 0; panel.scrollTop = 0; }
      _mat_renderContenido();
    });
  });

  document.querySelectorAll('.mat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _mat_tabActiva = btn.dataset.tab;
      // Al ir a "Todas", limpiar filtro de actividades (que es específico de fase)
      if (_mat_tabActiva === 'todas') _mat_actividadesFiltro = {};
      document.querySelectorAll('.mat-tab').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      const panel = document.getElementById('panel-tab-term');
      if (panel) { panel.scrollLeft = 0; panel.scrollTop = 0; }
      _mat_renderContenido();
      _mat_actualizarToolbar();
    });
  });

  // ── Pestañas de sidebar (escritorio) ────────────────────────────────────────
  document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _mat_tabActiva = btn.dataset.tab;
      if (_mat_tabActiva === 'todas') _mat_actividadesFiltro = {};
      document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      const area = document.getElementById('mat-area-contenido');
      if (area) { area.scrollLeft = 0; area.scrollTop = 0; }
      _mat_renderContenido();
      _mat_actualizarToolbar();
    });
  });

  // ── Toggle sidebar colapsado ─────────────────────────────────────────────────
  const btnSidebarToggle = document.getElementById('sidebar-toggle');
  if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', () => {
      _mat_sidebarColapsado = !_mat_sidebarColapsado;
      const sidebar = document.getElementById('mat-sidebar');
      if (sidebar) sidebar.classList.toggle('colapsado', _mat_sidebarColapsado);
      btnSidebarToggle.textContent = _mat_sidebarColapsado ? '▶' : '◀';
      btnSidebarToggle.title       = _mat_sidebarColapsado ? 'Expandir' : 'Colapsar';
    });
  }

  document.getElementById('mat-btn-filtro-piso')?.addEventListener('click', e => {
    e.stopPropagation();
    // Si se hizo click en la ✕ interna, limpiar filtro sin abrir el panel
    if (e.target.id === 'mat-btn-limpiar-piso') {
      _mat_pisoFiltro = 'todos';
      _mat_render();
      return;
    }
    _mat_mostrarFiltroPiso(e.currentTarget);
  });

  // Filtro de actividades — móvil: botón en toolbar por ID
  document.getElementById('mat-btn-filtro-act')?.addEventListener('click', e => {
    e.stopPropagation();
    _mat_mostrarFiltroActividades(e.currentTarget);
  });

  // Filtro de actividades — escritorio: botón .btn-fase-filtro-act en cabecera de matriz
  const _matContenido = document.getElementById('mat-contenido');
  if (_matContenido) {
    _matContenido.addEventListener('click', function(e) {
      // 🔍 Filtro actividades por fase
      const btnFiltroAct = e.target.closest('.btn-fase-filtro-act');
      if (btnFiltroAct) {
        e.stopPropagation();
        var faseBtnKey = btnFiltroAct.dataset.fase;
        // Si estamos en modo 'todas', cambiar a la fase específica primero
        if (faseBtnKey && _mat_tabActiva !== faseBtnKey) {
          _mat_tabActiva = faseBtnKey;
          document.querySelectorAll('.sidebar-tab').forEach(function(b) {
            b.classList.toggle('activo', b.dataset.tab === _mat_tabActiva);
          });
          _mat_renderContenido();
          // Buscar el botón recién renderizado y abrir el panel
          var newBtn = document.querySelector('.btn-fase-filtro-act[data-fase="' + faseBtnKey + '"]');
          if (newBtn) _mat_mostrarFiltroActividades(newBtn);
        } else {
          _mat_mostrarFiltroActividades(btnFiltroAct);
        }
        return;
      }
      // ⊟ Toggle columnas — botón en cabecera de fase
      if (e.target.closest('.btn-toggle-cols-mat')) {
        _mat_colsOcultas = !_mat_colsOcultas;
        // Actualizar todos los botones ⊟ en la matriz
        document.querySelectorAll('.btn-toggle-cols-mat').forEach(function(b) {
          b.textContent = _mat_colsOcultas ? '⊞' : '⊟';
          b.title       = _mat_colsOcultas ? 'Mostrar columnas' : 'Ocultar columnas';
        });
        _mat_aplicarToggleCols();
      }
    });
  }

  // Quitar todos los filtros
  document.getElementById('mat-btn-quitar-filtros')?.addEventListener('click', () => {
    _mat_pisoFiltro        = 'todos';
    _mat_actividadesFiltro = {};
    _mat_render();
  });

  // ✕ Quitar filtro actividades (móvil)
  document.getElementById('mat-btn-limpiar-filtro-act')?.addEventListener('click', () => {
    if (_mat_tabActiva.startsWith('fase_')) delete _mat_actividadesFiltro[_mat_tabActiva];
    _mat_render();
  });

  // Acciones ▾ (escritorio sidebar dropdown)
  const btnAcciones = document.getElementById('mat-btn-acciones-toggle');
  const dropAcciones = document.getElementById('sidebar-acciones-dropdown');
  if (btnAcciones && dropAcciones) {
    btnAcciones.addEventListener('click', e => {
      e.stopPropagation();
      const visible = dropAcciones.style.display !== 'none';
      dropAcciones.style.display = visible ? 'none' : 'block';
      const icono = btnAcciones.querySelector('.sidebar-texto');
      if (icono) icono.textContent = visible ? 'Acciones ▾' : 'Acciones ▲';
    });
    document.addEventListener('click', () => {
      if (dropAcciones) { dropAcciones.style.display = 'none'; }
      const icono = btnAcciones?.querySelector('.sidebar-texto');
      if (icono) icono.textContent = 'Acciones ▾';
    });
  }

  // Menú "···"
  const btnMas      = document.getElementById('mat-btn-mas');
  const menuDropdown = document.getElementById('mat-menu-dropdown');
  btnMas?.addEventListener('click', e => {
    e.stopPropagation();
    const visible = menuDropdown.style.display !== 'none';
    menuDropdown.style.display = visible ? 'none' : 'block';
    if (!visible) {
      // Posicionar dentro del viewport
      menuDropdown.style.position = 'fixed';
      menuDropdown.style.right    = 'auto';
      menuDropdown.style.left     = 'auto';
      menuDropdown.style.top      = 'auto';
      const btnRect = btnMas.getBoundingClientRect();
      const mw = menuDropdown.offsetWidth  || 200;
      const mh = menuDropdown.offsetHeight || 80;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top  = btnRect.bottom + 4;
      let left = btnRect.right  - mw;
      if (top  + mh > vh - 4) top  = btnRect.top - mh - 4;
      if (left < 4)            left = 4;
      if (left + mw > vw - 4)  left = vw - mw - 4;
      menuDropdown.style.top  = top  + 'px';
      menuDropdown.style.left = left + 'px';
    }
  });
  document.addEventListener('click', () => {
    if (menuDropdown) menuDropdown.style.display = 'none';
  });

  document.getElementById('mat-btn-resetear')?.addEventListener('click', () => {
    const menuDropdownLocal = document.getElementById('mat-menu-dropdown');
    if (menuDropdownLocal) menuDropdownLocal.style.display = 'none';
    interfaz_mostrarModal(
      '⚠ Resetear avances',
      'Esto eliminará TODOS los avances de terminaciones del proyecto. Esta acción no se puede deshacer. ¿Estás segura?',
      () => {
        _mat_datos = {};
        datos_guardarMatrices(_mat_id, _mat_datos);
        _mat_renderContenido();
        interfaz_mostrarToast('Avances reseteados.', 'aviso');
      }
    );
  });

  // ── Guardar avances → confirmación → Firebase ───────────────────────────────
  document.getElementById('mat-btn-guardar-avances')?.addEventListener('click', () => {
    interfaz_mostrarModal(
      'Guardar avances',
      '¿Confirmas el guardado de los avances? Los datos se sincronizarán con todos los dispositivos.',
      () => {
        datos_subirAhora(_mat_id);
        window._coa_guardadoPendiente = false;
        // Quitar estilo pendiente del botón
        const btn = document.getElementById('mat-btn-guardar-avances');
        if (btn) btn.classList.remove('mat-btn-pendiente');
        interfaz_mostrarToast('Avances guardados correctamente', 'exito');
      }
    );
  });

  // ── Exportar respaldo JSON ───────────────────────────────────────────────────
  document.getElementById('mat-btn-exportar-json')?.addEventListener('click', () => {
    _mat_exportarJSON();
    const md = document.getElementById('mat-menu-dropdown');
    if (md) md.style.display = 'none';
  });

  // ── Cargar JSON ─────────────────────────────────────────────────────────────
  document.getElementById('mat-btn-cargar')?.addEventListener('click', () => {
    document.getElementById('mat-input-cargar')?.click();
  });
  document.getElementById('mat-input-cargar')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        _mat_importarJSON(data);
      } catch(err) {
        interfaz_mostrarToast('El archivo no es válido. Asegúrate de que sea un JSON generado por esta app.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // ── Exportar Excel ──────────────────────────────────────────────────────────
  document.getElementById('mat-btn-excel')?.addEventListener('click', () => {
    _mat_exportarExcel();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _mat_deptosFiltrados() {
  if (_mat_pisoFiltro === 'todos') return _mat_deptos;
  const piso = parseInt(_mat_pisoFiltro);
  const entry = (_mat_config.departamentos || []).find(d => d.piso === piso);
  return entry ? entry.deptos : [];
}

// Departamentos filtrados como estructura [{piso, cantidad, deptos}] — base para
// el cálculo de piso aproximado (que necesita saber pisos y sus cantidades).
function _mat_departamentosFiltrados() {
  if (_mat_pisoFiltro === 'todos') return _mat_config.departamentos || [];
  const piso = parseInt(_mat_pisoFiltro);
  const entry = (_mat_config.departamentos || []).find(d => d.piso === piso);
  return entry ? [entry] : [];
}

// Wrapper local: la función pura vive en logica.js (logica_promediosFase) para
// que también la consuma el módulo de gráficos. Aquí solo resolvemos los defaults
// del filtro de piso actual y delegamos.
function _mat_promediosFase(fase, deptosLista, departamentos) {
  if (deptosLista === undefined)   deptosLista   = _mat_deptosFiltrados();
  if (departamentos === undefined) departamentos = _mat_departamentosFiltrados();
  return logica_promediosFase(_mat_config, _mat_datos, _mat_baseline, fase, deptosLista, departamentos);
}

function _mat_claseValor(val) {
  if (val >= 100) return 'v100';
  if (val >= 75)  return 'v75';
  if (val >= 50)  return 'v50';
  if (val >= 25)  return 'v25';
  return 'v0';
}


// ── Actualizar botones del toolbar sin re-renderizar todo ───────────────────
// Se llama al cambiar de pestaña o al aplicar/quitar filtros.

function _mat_actualizarToolbar() {
  var enFase       = _mat_tabActiva !== 'resumen' && _mat_tabActiva !== 'todas';
  var filtroActivo = _mat_tabActiva.startsWith('fase_') && !!_mat_actividadesFiltro[_mat_tabActiva];
  var hayFiltro    = _mat_pisoFiltro !== 'todos' || Object.values(_mat_actividadesFiltro).some(Boolean);

  if (interfaz_esMovil()) {
    // ──── Toolbar móvil (fila única) ────
    // Actualizar select de piso
    var sel = document.getElementById('movil-select-piso');
    if (sel) sel.value = String(_mat_pisoFiltro);

    // Actualizar botones de fase activos
    document.querySelectorAll('.btn-fase-movil').forEach(function(b) {
      b.classList.toggle('activo', b.dataset.fase && _mat_tabActiva === 'fase_' + b.dataset.fase);
    });

    // Actualizar indicador de filtro actividades
    var btnActMovil = document.getElementById('mat-btn-filtro-act');
    if (btnActMovil) btnActMovil.classList.toggle('filtro-activo', filtroActivo);

    // Insertar / quitar el botón ✕ de limpiar filtro según estado
    var fasesScroll = document.querySelector('.movil-fases-scroll');
    if (fasesScroll) {
      var xBtn = document.getElementById('mat-btn-limpiar-filtro-act');
      if (filtroActivo && !xBtn) {
        var nuevoX = document.createElement('button');
        nuevoX.className = 'movil-btn-icono movil-btn-limpiar-act';
        nuevoX.id        = 'mat-btn-limpiar-filtro-act';
        nuevoX.title     = 'Quitar filtro actividades';
        nuevoX.textContent = '✕';
        nuevoX.addEventListener('click', function() {
          if (_mat_tabActiva.startsWith('fase_')) delete _mat_actividadesFiltro[_mat_tabActiva];
          _mat_render();
        });
        fasesScroll.appendChild(nuevoX);
      } else if (!filtroActivo && xBtn) {
        xBtn.remove();
      }
    }

    return;
  }

  // ──── Sidebar escritorio ────

  // Actualizar pestaña activa
  document.querySelectorAll('.sidebar-tab').forEach(function(b) {
    b.classList.toggle('activo', b.dataset.tab === _mat_tabActiva);
  });

  // ✕ piso: actualizar visibilidad de la X inline en el botón de piso
  var btnPisoRef = document.getElementById('mat-btn-filtro-piso');
  if (btnPisoRef) {
    var xEl = btnPisoRef.querySelector('.piso-filtro-x');
    if (_mat_pisoFiltro !== 'todos' && !xEl) {
      var x = document.createElement('span');
      x.className = 'piso-filtro-x';
      x.id        = 'mat-btn-limpiar-piso';
      x.title     = 'Quitar filtro de piso';
      x.textContent = '✕';
      btnPisoRef.appendChild(x);
    } else if (_mat_pisoFiltro === 'todos' && xEl) {
      xEl.remove();
    }
    // Actualizar label
    var pisoTexto = btnPisoRef.querySelector('.sidebar-texto');
    if (pisoTexto) {
      pisoTexto.textContent = _mat_pisoFiltro === 'todos'
        ? 'Todos los pisos'
        : (_mat_pisoFiltro < 0 ? 'Sub ' + Math.abs(_mat_pisoFiltro) : 'Piso ' + _mat_pisoFiltro);
    }
  }

  // 🔍 Filtro actividades: actualizar indicador en botón de cabecera de matriz
  document.querySelectorAll('.btn-fase-filtro-act').forEach(function(btn) {
    var fk = btn.dataset.fase;
    btn.classList.toggle('filtro-activo-mat', fk ? !!_mat_actividadesFiltro[fk] : false);
  });
}


// ── Filtro de piso (botón desplegable) ───────────────────────────────────────

function _mat_mostrarFiltroPiso(btnRef) {
  var anterior = document.getElementById('mat-panel-filtro-piso');
  if (anterior) { anterior.remove(); return; }

  var pisos  = (_mat_config.departamentos || []).filter(function(p) { return p.cantidad > 0; });
  var panel  = document.createElement('div');
  panel.id        = 'mat-panel-filtro-piso';
  panel.className = 'mat-menu-dropdown';
  panel.style.display = 'block';

  var opcionTodos = '<button class="mat-menu-item' + (_mat_pisoFiltro === 'todos' ? ' mat-menu-item-activo' : '') + '" data-piso="todos">Todos los pisos</button>';
  var opcionesPisos = pisos.map(function(p) {
    var label = p.piso < 0 ? 'Sub ' + Math.abs(p.piso) : p.piso;
    var activo = String(_mat_pisoFiltro) === String(p.piso) ? ' mat-menu-item-activo' : '';
    return '<button class="mat-menu-item' + activo + '" data-piso="' + p.piso + '">' + label + '</button>';
  }).join('');

  panel.innerHTML = opcionTodos + opcionesPisos;
  document.body.appendChild(panel);

  // Posicionar
  panel.style.position = 'fixed';
  panel.style.zIndex   = '600';
  requestAnimationFrame(function() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var br = btnRef.getBoundingClientRect();
    var pw = panel.offsetWidth  || 180;
    var spaceBelow = vh - br.bottom - 12;
    var spaceAbove = br.top - 12;
    var maxH = Math.max(80, spaceBelow >= 120 ? spaceBelow : spaceAbove);
    panel.style.maxHeight = maxH + 'px';
    panel.style.overflowY = 'auto';
    var ph = Math.min(panel.scrollHeight, maxH);
    var top  = (spaceBelow >= 120 || spaceBelow >= spaceAbove) ? br.bottom + 4 : br.top - ph - 4;
    var left = br.left;
    if (top + ph > vh - 8) top = Math.max(8, vh - ph - 8);
    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    panel.style.top  = top  + 'px';
    panel.style.left = left + 'px';
  });

  // Selección
  panel.querySelectorAll('[data-piso]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _mat_pisoFiltro = btn.dataset.piso === 'todos' ? 'todos' : parseInt(btn.dataset.piso);
      panel.remove();
      _mat_render();  // re-render completo para actualizar el label del botón
    });
  });

  // Cerrar al hacer clic fuera
  setTimeout(function() {
    var cerrar = function(e) {
      if (!panel.contains(e.target) && e.target.id !== 'mat-btn-filtro-piso') {
        panel.remove();
        document.removeEventListener('click', cerrar);
      }
    };
    document.addEventListener('click', cerrar);
  }, 50);
}

// ── Filtro de actividades ─────────────────────────────────────────────────────

function _mat_mostrarFiltroActividades(btnRef) {
  var anterior = document.getElementById('mat-panel-filtro');
  if (anterior) { anterior.remove(); return; }

  if (_mat_tabActiva === 'resumen') {
    interfaz_mostrarToast('El filtro aplica en pestanas F1-F6 y Todas.', 'aviso');
    return;
  }

  var fasesPanel = _mat_tabActiva === 'todas'
    ? _mat_fasesActivas
    : [parseInt(_mat_tabActiva.split('_')[1])];

  var actividades = [];
  fasesPanel.forEach(function(fase) {
    var nums = logica_actividadesDeFase(_mat_config, fase);
    nums.forEach(function(num) {
      actividades.push({ num: num, nombre: actividades_getNombreProyecto(_mat_config, num), fase: fase });
    });
  });
  if (!actividades.length) return;

  var _faseKey    = _mat_tabActiva.startsWith('fase_') ? _mat_tabActiva : null;
  var _filtroFaseActual = _faseKey ? (_mat_actividadesFiltro[_faseKey] || null) : null;
  var selActuales = _filtroFaseActual
    ? new Set(Array.from(_filtroFaseActual).map(String))
    : new Set(actividades.map(function(a) { return String(a.num); }));

  var panel = document.createElement('div');
  panel.id        = 'mat-panel-filtro';
  panel.className = 'mat-panel-filtro';

  var items = actividades.map(function(a) {
    return '<label class="filtro-item"><input type="checkbox" value="' + a.num + '"' +
      (selActuales.has(String(a.num)) ? ' checked' : '') + '>' +
      '<span>' + a.nombre + '</span></label>';
  }).join('');

  panel.innerHTML =
    '<div class="filtro-header">' +
      '<span class="filtro-titulo">Filtrar actividades</span>' +
      '<div class="filtro-acciones-top">' +
        '<button class="btn-link" id="filtro-sel-todas">Todas</button>' +
        '<button class="btn-link" id="filtro-sel-ninguna">Ninguna</button>' +
      '</div>' +
    '</div>' +
    '<div class="filtro-lista">' + items + '</div>' +
    '<div class="filtro-footer">' +
      '<button class="btn-secundario btn-sm" id="filtro-btn-cancelar">Cancelar</button>' +
      '<button class="btn-primario btn-sm" id="filtro-btn-aplicar">Aplicar</button>' +
    '</div>';

  document.body.appendChild(panel);

  // Posicionar dentro del viewport
  panel.style.position = 'fixed';
  panel.style.zIndex   = '600';
  requestAnimationFrame(function() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var br = btnRef.getBoundingClientRect();
    var pw = panel.offsetWidth  || 280;
    var ph = panel.offsetHeight || 300;
    var top  = br.bottom + 6;
    var left = br.left;
    if (top  + ph > vh - 8) top  = Math.max(8, vh - ph - 8);
    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    panel.style.top  = top  + 'px';
    panel.style.left = left + 'px';
  });

  panel.querySelector('#filtro-sel-todas').addEventListener('click', function() {
    panel.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = true; });
  });
  panel.querySelector('#filtro-sel-ninguna').addEventListener('click', function() {
    panel.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
  });
  panel.querySelector('#filtro-btn-cancelar').addEventListener('click', function() { panel.remove(); });
  panel.querySelector('#filtro-btn-aplicar').addEventListener('click', function() {
    var marcados = Array.from(panel.querySelectorAll('input[type=checkbox]:checked'))
      .map(function(cb) { return parseInt(cb.value); });
    var todasNums = actividades.map(function(a) { return a.num; });
    var _fk = _mat_tabActiva.startsWith('fase_') ? _mat_tabActiva : null;
    if (_fk) {
      if (marcados.length === todasNums.length) {
        delete _mat_actividadesFiltro[_fk];
      } else {
        _mat_actividadesFiltro[_fk] = new Set(marcados);
      }
    }
    panel.remove();
    _mat_renderContenido();
    _mat_actualizarToolbar();
  });

  setTimeout(function() {
    var cerrar = function(e) {
      if (!panel.contains(e.target) && e.target.id !== 'mat-btn-filtro-act') {
        panel.remove();
        document.removeEventListener('click', cerrar);
      }
    };
    document.addEventListener('click', cerrar);
  }, 50);
}


// ── Toggle columnas de resumen (% Avance, Piso Aprox., Deptos) ───────────────

function _mat_aplicarToggleCols() {
  var contenido = document.getElementById('mat-contenido');
  if (!contenido) return;
  contenido.querySelectorAll('.tabla-mat').forEach(function(tabla) {
    var esResumen = tabla.classList.contains('tabla-resumen');
    var indices   = esResumen ? [3, 4, 5] : [0, 2, 3, 4];
    tabla.querySelectorAll('thead tr').forEach(function(tr) {
      if (tr.classList.contains('fila-fase-titulo')) return; // nunca ocultar la fila de título
      Array.from(tr.children).forEach(function(th, i) {
        if (indices.indexOf(i) >= 0) th.style.display = _mat_colsOcultas ? 'none' : '';
      });
    });
    tabla.querySelectorAll('tbody tr').forEach(function(tr) {
      Array.from(tr.children).forEach(function(td, i) {
        if (indices.indexOf(i) >= 0) td.style.display = _mat_colsOcultas ? 'none' : '';
      });
    });
  });

  // Recalcular anchos sticky después de cambiar visibilidad de columnas
  _term_aplicarStickyH();
}

// ── Exportar JSON ─────────────────────────────────────────────────────────────

function _mat_exportarJSON() {
  var config   = datos_cargarProyecto(_mat_id);
  var matrices = datos_cargarMatrices(_mat_id);
  var payload  = { version: 'coa-v1', exportado: new Date().toISOString(), proyecto: config, matrices: matrices };
  var nombre   = (config && config.nombre ? config.nombre : 'proyecto').replace(/\s+/g, '_');
  var fecha    = new Date().toISOString().slice(0, 10);
  var blob     = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url      = URL.createObjectURL(blob);
  var a        = document.createElement('a');
  a.href       = url;
  a.download   = 'coa_' + nombre + '_' + fecha + '.json';
  a.click();
  URL.revokeObjectURL(url);
  interfaz_mostrarToast('Respaldo guardado correctamente.', 'exito');
  window._coa_guardadoPendiente = false;
}

// ── Importar JSON ─────────────────────────────────────────────────────────────

function _mat_importarJSON(data) {
  if (!data || data.version !== 'coa-v1' || !data.proyecto || !data.matrices) {
    interfaz_mostrarToast('Archivo invalido. Debe ser un respaldo generado por esta app.', 'error');
    return;
  }
  var config = data.proyecto;
  var id     = config.id;
  if (!id) { interfaz_mostrarToast('El archivo no tiene un ID de proyecto valido.', 'error'); return; }
  interfaz_mostrarModal(
    'Cargar respaldo',
    'Se cargara el proyecto "' + config.nombre + '". Si ya existe un proyecto con este ID, sus avances seran reemplazados. Continuar?',
    function() {
      datos_guardarProyecto(config);
      datos_guardarMatrices(id, data.matrices);
      interfaz_mostrarToast('Proyecto "' + config.nombre + '" cargado.', 'exito');
      router_ir('v-proyecto', { idProyecto: id, tab: 'tab-term' });
    }
  );
}

// ── Exportar Excel ────────────────────────────────────────────────────────────

function _mat_exportarExcel() {
  if (typeof XLSX === 'undefined') {
    interfaz_mostrarToast('La libreria Excel no esta lista. Reintenta en un momento.', 'error');
    return;
  }
  var deptos        = logica_listaDeptosPlana(_mat_config.departamentos || []);
  var fasesActivas  = logica_fasesEfectivas(_mat_config);
  var encabezado    = ['Codigo', 'Actividad', '% Avance', 'Piso Aprox.', 'Deptos terminados'].concat(deptos);
  var filas         = [encabezado];
  fasesActivas.forEach(function(fase) {
    var faseKey       = 'fase_' + fase;
    var celdas        = _mat_datos[faseKey] || {};
    var nums          = logica_actividadesDeFase(_mat_config, fase);
    var departamentos = _mat_config.departamentos || [];
    filas.push([NOMBRES_FASES[fase]]);
    nums.forEach(function(num) {
      var nombre    = actividades_getNombreProyecto(_mat_config, num);
      var deptsTerm = logica_deptosTerminadosActividad(_mat_datos, faseKey, num, deptos);
      var piso      = logica_pisoActividad(_mat_datos, faseKey, num, deptos, departamentos);
      var avance    = logica_avanceActividad(_mat_datos, faseKey, num, deptos);
      var celdaD    = deptos.map(function(d) { return (celdas[d + '_' + num] || 0) / 100; });
      filas.push([num, nombre, avance / 100, Math.round(piso * 10) / 10, deptsTerm].concat(celdaD));
    });
    var prom    = _mat_promediosFase(fase, deptos, departamentos);
    var filaRes = ['', 'Termino ' + NOMBRES_FASES[fase].split('-')[0].trim(),
      prom.avance !== null ? prom.avance / 100 : '',
      Math.round(prom.piso * 10) / 10, prom.deptos
    ].concat(deptos.map(function(d) {
      if (!nums.length) return '';
      var count = 0;
      nums.forEach(function(n) { if ((celdas[d + '_' + n] || 0) >= 100) count++; });
      return count / nums.length;
    }));
    filas.push(filaRes);
    filas.push([]);
  });
  var ws    = XLSX.utils.aoa_to_sheet(filas);
  var rango = XLSX.utils.decode_range(ws['!ref']);
  for (var R = 1; R <= rango.e.r; R++) {
    var row = filas[R];
    if (!row || row.length < 2) continue;
    var cp = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
    if (cp && typeof cp.v === 'number') cp.z = '0%';
    for (var C = 5; C < encabezado.length; C++) {
      var cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === 'number') cell.z = '0%';
    }
  }
  var wb     = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Terminaciones');
  var config = datos_cargarProyecto(_mat_id);
  var nombre = (config && config.nombre ? config.nombre : 'proyecto').replace(/\s+/g, '_');
  var fecha  = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, 'terminaciones_' + nombre + '_' + fecha + '.xlsx');
  interfaz_mostrarToast('Excel descargado correctamente.', 'exito');
}
