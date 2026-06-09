// Barra de control semanal — selector de viernes.

let _sc_id           = null;
let _sc_semana       = null;  // YYYY-MM-DD seleccionado
let _sc_calYear      = null;
let _sc_calMonth     = null;  // 0-based
let _sc_closeHandler = null;

// ── API pública ───────────────────────────────────────────────────────────────

function semanaCtrl_renderBarra(id) {
  _sc_id = id;
  const ctrl = datos_cargarSemanaControl(id);
  _sc_semana = ctrl?.semana || null;

  const el = document.getElementById('barra-control');
  if (!el) return;

  const fechaTexto = _sc_semana ? logica_formatearFecha(_sc_semana) : '——-——-————';

  const accionesHtml = '';

  el.innerHTML = `
  <div class="sc-barra">
    <span class="sc-label">Viernes</span>
    <div class="sc-fecha-wrap" id="sc-fecha-wrap">
      <button class="sc-fecha-btn" id="sc-fecha-btn" aria-label="Seleccionar semana">
        <span class="sc-fecha-valor" id="sc-fecha-valor">${fechaTexto}</span>
        <span style="margin-left:.4rem;color:var(--texto-3)">📅</span>
      </button>
      <div class="sc-cal-dropdown" id="sc-cal-dropdown" style="display:none">
        <div id="sc-cal-contenido"></div>
        <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--borde-suave)">
          <button class="btn-secundario btn-sm" id="sc-btn-hoy"
                  style="width:100%;font-size:.82rem;justify-content:center">
            📅 Usar viernes de esta semana
          </button>
        </div>
      </div>
    </div>
    <div class="sc-acciones">${accionesHtml}</div>
  </div>`;

  // Inicializar mes del calendario
  if (_sc_semana) {
    const d = new Date(_sc_semana + 'T12:00:00Z');
    _sc_calYear  = d.getUTCFullYear();
    _sc_calMonth = d.getUTCMonth();
  } else {
    const hoy    = new Date();
    _sc_calYear  = hoy.getFullYear();
    _sc_calMonth = hoy.getMonth();
  }

  _sc_renderCal();
  _sc_registrarEventos();
}

function semanaCtrl_abrirGestionResponsables(id) {}

// ── Calendario ────────────────────────────────────────────────────────────────

function _sc_renderCal() {
  const contenido = document.getElementById('sc-cal-contenido');
  if (!contenido) return;

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS  = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

  // Primer día del mes (JS: 0=Dom … 6=Sab) → convertir a base lunes (0=Lun … 6=Dom)
  const diaSemana = new Date(_sc_calYear, _sc_calMonth, 1).getDay();
  const inicio    = diaSemana === 0 ? 6 : diaSemana - 1;
  const diasEnMes = new Date(_sc_calYear, _sc_calMonth + 1, 0).getDate();

  // Armar array de celdas: null = vacía
  const celdas = [];
  for (let i = 0; i < inicio; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);

  // Encabezados
  const ths = DIAS.map((d, i) =>
    `<th${i === 4 ? ' class="sc-cal-th-vie"' : ''}>${d}</th>`
  ).join('');

  // Filas
  let filas = '';
  for (let i = 0; i < celdas.length; i++) {
    if (i % 7 === 0) filas += '<tr>';

    const d = celdas[i];
    if (d === null) {
      filas += '<td class="sc-cal-vacio"></td>';
    } else {
      const col       = i % 7;         // 0=Lun … 4=Vie … 6=Dom
      const esViernes = col === 4;
      const fecha     = `${_sc_calYear}-${String(_sc_calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const esSel     = fecha === _sc_semana;

      if (esViernes) {
        const cls = 'sc-cal-dia sc-cal-viernes' + (esSel ? ' sc-cal-sel' : '');
        filas += `<td class="${cls}" data-fecha="${fecha}">${d}</td>`;
      } else {
        filas += `<td class="sc-cal-dia sc-cal-otro">${d}</td>`;
      }
    }

    if (i % 7 === 6) filas += '</tr>';
  }

  contenido.innerHTML = `
  <div class="sc-cal-header">
    <button class="sc-cal-nav" id="sc-cal-ant">‹</button>
    <span class="sc-cal-mes">${MESES[_sc_calMonth]} ${_sc_calYear}</span>
    <button class="sc-cal-nav" id="sc-cal-sig">›</button>
  </div>
  <table class="sc-cal-tabla">
    <thead><tr>${ths}</tr></thead>
    <tbody>${filas}</tbody>
  </table>`;

  document.getElementById('sc-cal-ant')?.addEventListener('click', e => {
    e.stopPropagation();
    if (--_sc_calMonth < 0) { _sc_calMonth = 11; _sc_calYear--; }
    _sc_renderCal();
  });
  document.getElementById('sc-cal-sig')?.addEventListener('click', e => {
    e.stopPropagation();
    if (++_sc_calMonth > 11) { _sc_calMonth = 0; _sc_calYear++; }
    _sc_renderCal();
  });
}

// ── Selección de fecha ────────────────────────────────────────────────────────

function _sc_seleccionarFecha(fecha) {
  _sc_semana = fecha;
  datos_guardarSemanaControl(_sc_id, { semana: fecha });
  const val = document.getElementById('sc-fecha-valor');
  if (val) val.textContent = logica_formatearFecha(fecha);
  _sc_renderCal();
  const dd = document.getElementById('sc-cal-dropdown');
  if (dd) dd.style.display = 'none';
}

function _sc_viernesDeEstaSemana() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=Dom … 6=Sab
  hoy.setDate(hoy.getDate() + (5 - dia + 7) % 7);
  return hoy.toISOString().slice(0, 10);
}

// ── Eventos ───────────────────────────────────────────────────────────────────

function _sc_registrarEventos() {
  const btn  = document.getElementById('sc-fecha-btn');
  const dd   = document.getElementById('sc-cal-dropdown');
  const wrap = document.getElementById('sc-fecha-wrap');

  // Abrir / cerrar dropdown
  btn?.addEventListener('click', e => {
    e.stopPropagation();
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  });

  // Click en día del calendario (delegado)
  dd?.addEventListener('click', e => {
    e.stopPropagation();
    const td = e.target.closest('[data-fecha]');
    if (td?.dataset.fecha) _sc_seleccionarFecha(td.dataset.fecha);
  });

  // Botón "viernes de esta semana"
  document.getElementById('sc-btn-hoy')?.addEventListener('click', e => {
    e.stopPropagation();
    const viernes = _sc_viernesDeEstaSemana();
    const d = new Date(viernes + 'T12:00:00Z');
    _sc_calYear  = d.getUTCFullYear();
    _sc_calMonth = d.getUTCMonth();
    _sc_seleccionarFecha(viernes);
  });

  // Cerrar al hacer clic fuera
  if (_sc_closeHandler) document.removeEventListener('click', _sc_closeHandler);
  _sc_closeHandler = () => {
    const d = document.getElementById('sc-cal-dropdown');
    if (d) d.style.display = 'none';
  };
  document.addEventListener('click', _sc_closeHandler);

  // Botones de ciclo eliminados en versión prueba de terreno.
}

// ── Ciclo de actualización ───────────────────────────────────────────────────
// Estas funciones implementan el contrato de "Iniciar / Terminar actualización"
// descrito en el modelo de datos: al iniciar se fija el baseline para los Δ;
// al terminar se construye el snapshot completo (OG + Term Consolidado + Term
// Detalle) y se guarda en el histórico.

function semanaCtrl_iniciarActualizacion(id, viernes) {
  if (!viernes) {
    interfaz_mostrarToast(
      'Selecciona primero un viernes en la barra para iniciar la actualización.',
      'error'
    );
    return;
  }
  const previo = datos_cargarCicloActivo(id);
  if (previo && previo.semana_viernes !== viernes) {
    interfaz_mostrarToast(
      `Ya hay un ciclo activo para ${logica_formatearFecha(previo.semana_viernes)}.
       Termínalo antes de iniciar otro.`,
      'error'
    );
    return;
  }
  if (previo && previo.semana_viernes === viernes) return; // idempotente

  interfaz_mostrarModal(
    'Iniciar actualización',
    `Se va a iniciar el ciclo de avances para la semana del ${logica_formatearFecha(viernes)}. ` +
    `A partir de ahora los Δ piso / Δ deptos se calculan respecto al estado actual.`,
    () => {
      datos_iniciarCiclo(id, viernes);
      interfaz_mostrarToast(
        `Actualización iniciada para ${logica_formatearFecha(viernes)}.`,
        'exito'
      );
      router_ir('v-proyecto'); // refresca barra + pestaña activa
    }
  );
}

function semanaCtrl_terminarActualizacion(id) {
  const ciclo = datos_cargarCicloActivo(id);
  if (!ciclo) {
    interfaz_mostrarToast('No hay actualización activa.', 'error');
    return;
  }
  const viernes = ciclo.semana_viernes;

  interfaz_mostrarModal(
    'Terminar actualización',
    `Guardar el snapshot semanal del ${logica_formatearFecha(viernes)}: OG completo + ` +
    `Term Consolidado por fase + Term Detalle por actividad. Esta semana quedará ` +
    `registrada en el histórico.`,
    () => {
      const config     = datos_cargarProyecto(id);
      const matrices   = datos_cargarMatrices(id);
      const baseline   = ciclo.baseline || {};
      const histOG     = datos_cargarHistorialOG(id);
      const ogRegistro = histOG.find(r => r.semana === viernes) || null;
      const snapshot   = logica_construirSnapshot(config, viernes, matrices, baseline, ogRegistro);
      datos_guardarSnapshot(id, snapshot);
      datos_terminarCicloActivo(id);
      // Actualizamos el baseline legado de Terminaciones para que los Δ que
      // se muestran en pantalla (cuando no hay ciclo activo) sean coherentes.
      // Una vez que el ciclo esté terminado, las matrices = baseline y Δ = 0.
      datos_guardarBaseline(id, JSON.parse(JSON.stringify(matrices)));
      interfaz_mostrarToast(
        `Snapshot del ${logica_formatearFecha(viernes)} guardado.`,
        'exito'
      );
      router_ir('v-proyecto');
    }
  );
}
