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
    const abrir = dd.style.display === 'none';
    dd.style.display = abrir ? 'block' : 'none';
    // En sidebar de escritorio (overflow-x:hidden), usar position:fixed
    // calculado desde el bounding rect del botón para no quedar recortado.
    if (abrir && btn.closest('.mat-sidebar')) {
      const rect = btn.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top      = (rect.bottom + 4) + 'px';
      dd.style.left     = rect.left + 'px';
      dd.style.right    = 'auto';
    }
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

