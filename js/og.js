// Módulo Obra Gruesa — tabla semanal programado vs real (desagregado por componente).

let _og_id = null;
let _og_config = null;
let _og_delegacionRegistrada = false;
let _og_subTab = 'consolidado'; // 'consolidado' | 'pisos'

const _OG_CAMPOS = ['fundaciones', 'subterraneo', 'placa', 'nucleo'];

function og_inicializar(idProyecto) {
  _og_id     = idProyecto;
  _og_config = datos_cargarProyecto(idProyecto);
  if (!_og_config) return;
  _og_subTab = 'consolidado';
  if (!_og_delegacionRegistrada) {
    const panel = document.getElementById('panel-tab-og');
    panel?.addEventListener('change', _og_changeHandler);
    panel?.addEventListener('paste',  _og_pasteHandler);
    panel?.addEventListener('input',  _og_fechaInputHandler);
    _og_delegacionRegistrada = true;
  }
  _og_render();
}

// ── Edición celda a celda (consolidado) ──────────────────────────────────────

function _og_changeHandler(e) {
  const input = e.target.closest('.og-input-real');
  if (!input) return;
  const { sem, campo } = input.dataset;

  const hist = datos_cargarHistorialOG(_og_id);
  const rec  = { ...(hist.find(r => r.semana === sem) || { semana: sem }) };
  rec[campo] = input.value.trim() === '' ? null : (parseFloat(input.value) || 0);

  _og_guardarRec(rec);
  _og_render();
}

// ── Pegar desde Excel — consolidado o fechas pisos ────────────────────────────

function _og_pasteHandler(e) {
  // Pegar en tabla consolidado
  const inputReal = e.target.closest('.og-input-real');
  if (inputReal) {
    _og_pasteConsolidado(e, inputReal);
    return;
  }
  // Pegar en tabla fecha término pisos
  const inputFecha = e.target.closest('.og-fecha-input');
  if (inputFecha) {
    _og_pasteFechas(e, inputFecha);
    return;
  }
}

function _og_pasteConsolidado(e, input) {
  e.preventDefault();
  const texto = e.clipboardData.getData('text');
  const filasPaste = texto.trim().split(/\r?\n/).map(r => r.split('\t'));

  const panel = document.getElementById('panel-tab-og');
  const sems  = [...new Set(
    [...panel.querySelectorAll('.og-input-real')].map(i => i.dataset.sem)
  )];
  const startSemIdx   = sems.indexOf(input.dataset.sem);
  const startCampoIdx = _OG_CAMPOS.indexOf(input.dataset.campo);

  const hist   = datos_cargarHistorialOG(_og_id);
  const recMap = Object.fromEntries(hist.map(r => [r.semana, { ...r }]));

  filasPaste.forEach((rowVals, rowOffset) => {
    const sem = sems[startSemIdx + rowOffset];
    if (!sem) return;
    if (!recMap[sem]) recMap[sem] = { semana: sem };
    rowVals.forEach((val, colOffset) => {
      const campo = _OG_CAMPOS[startCampoIdx + colOffset];
      if (!campo) return;
      const limpio = val.trim().replace(/\./g, '').replace(',', '.');
      const n = parseFloat(limpio);
      recMap[sem][campo] = isNaN(n) ? null : n;
    });
  });

  Object.values(recMap).forEach(rec => _og_guardarRec(rec));
  _og_render();
}

function _og_pasteFechas(e, input) {
  e.preventDefault();
  const lineas = e.clipboardData.getData('text').trim().split(/\r?\n/);
  const todosNiveles = _og_nivelesOrdenados(_og_config).map(n => n.key);
  const startIdx = todosNiveles.indexOf(input.dataset.nivel);
  const fechas = datos_cargarFechasPisos(_og_id);

  lineas.forEach((linea, i) => {
    const key = todosNiveles[startIdx + i];
    if (!key) return;
    const fecha = _logica_parsearFecha(linea.trim());
    if (fecha) fechas[key] = fecha;
  });

  datos_guardarFechasPisos(_og_id, fechas);
  _og_renderFechasPisos();
}

// ── Input manual de fecha ─────────────────────────────────────────────────────

function _og_fechaInputHandler(e) {
  const input = e.target.closest('.og-fecha-input');
  if (!input) return;
  const val = input.value.trim();
  if (val === '') {
    input.classList.remove('invalida');
    const fechas = datos_cargarFechasPisos(_og_id);
    delete fechas[input.dataset.nivel];
    datos_guardarFechasPisos(_og_id, fechas);
    return;
  }
  const fecha = _logica_parsearFecha(val);
  if (fecha) {
    input.classList.remove('invalida');
    const fechas = datos_cargarFechasPisos(_og_id);
    fechas[input.dataset.nivel] = fecha;
    datos_guardarFechasPisos(_og_id, fechas);
  } else {
    input.classList.add('invalida');
  }
}

// ── Helpers de persistencia ───────────────────────────────────────────────────

function _og_guardarRec(rec) {
  const tieneAlgo = _OG_CAMPOS.some(c => rec[c] != null);
  if (tieneAlgo) {
    rec.m3_semanal = _OG_CAMPOS.reduce((s, c) => s + (rec[c] || 0), 0);
    datos_guardarRegistroOG(_og_id, rec);
  } else {
    datos_eliminarRegistroOG(_og_id, rec.semana);
  }
}

function _og_sum(rows, fn) {
  const vals = rows.map(fn).filter(v => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

function _og_max(rows, fn) {
  const vals = rows.map(fn).filter(v => v !== null);
  return vals.length ? Math.max(...vals) : null;
}

// ── Niveles para tabla de pisos ──────────────────────────────────────────────

function _og_nivelesOrdenados(config) {
  const niveles = [
    { key: 'fund_inicio',  label: 'Fundaciones', desc: 'Inicio de fundaciones',         rowspan: true },
    { key: 'fund_termino', label: '',            desc: 'Fundaciones terminadas',          rowspan: false },
  ];
  const sub = config.subterraneos || 0;
  for (let p = -sub; p <= -1; p++)
    niveles.push({ key: String(p), label: String(p), desc: `Losa cielo del piso ${p} hormigonada` });
  const pisos = config.pisos || 0;
  for (let p = 1; p <= pisos; p++)
    niveles.push({ key: String(p), label: String(p), desc: `Losa cielo del piso ${p} hormigonada` });
  niveles.push({ key: 'sm', label: 'SM', desc: `Losa cielo del piso ${pisos + 1} hormigonada` });
  return niveles;
}

// ── Render principal ──────────────────────────────────────────────────────────

function _og_render() {
  const panel = document.getElementById('panel-tab-og');
  if (!panel) return;
  panel.scrollLeft = 0;
  panel.scrollTop  = 0;

  const subClass = _og_subTab === 'consolidado' ? 'og-sub-consolidado' : 'og-sub-pisos';
  panel.innerHTML = `
    <div class="og-subtabs">
      <button class="og-subtab${_og_subTab === 'consolidado' ? ' activo' : ''}" data-sub="consolidado">Consolidado</button>
      <button class="og-subtab${_og_subTab === 'pisos' ? ' activo' : ''}" data-sub="pisos">Fecha Término Pisos</button>
    </div>
    <div id="og-subcontent" class="${subClass}"></div>`;

  panel.querySelectorAll('.og-subtab').forEach(btn =>
    btn.addEventListener('click', () => {
      _og_subTab = btn.dataset.sub;
      _og_render();
    })
  );

  if (_og_subTab === 'consolidado') _og_renderConsolidado();
  else                               _og_renderFechasPisos();
}

// ── Sub-render: Consolidado ───────────────────────────────────────────────────

function _og_renderConsolidado() {
  const subcontent = document.getElementById('og-subcontent');
  if (!subcontent) return;

  const schedule = _og_config.og?.schedule || [];
  const hist     = datos_cargarHistorialOG(_og_id);
  const m3Total  = _og_config.og?.m3_total || 0;

  if (schedule.length === 0) {
    subcontent.innerHTML = `<div style="padding:2rem;text-align:center"><p class="cf-hint">No hay programación OG importada.<br>Edita el proyecto (⚙ Configurar) y sube la planificación.</p></div>`;
    return;
  }

  // ctrlSemana es el viernes seleccionado en la barra de control.
  // La tabla se identifica internamente por s.fecha_termino (también viernes).
  const ctrlSemana = datos_cargarSemanaControl(_og_id)?.semana || null;

  const realMap = {};
  hist.forEach(r => { realMap[r.semana] = r; });

  let acumReal = 0;
  const rows = schedule.map(s => {
    const progFund  = s.fundaciones  ?? null;
    const progSub   = s.subterraneo  ?? null;
    const progPlaca = s.placa        ?? null;
    const progNuc   = s.nucleo       ?? null;
    const progSem   = s.m3_semanal   ?? null;
    const progAcum  = s.m3_acumulado ?? null;

    // Clave interna = viernes (fecha_termino). Cae a fecha como respaldo si falta.
    const semKey   = s.fecha_termino || s.fecha;
    const rec = realMap[semKey] || {};
    const realFund  = rec.fundaciones ?? null;
    const realSub   = rec.subterraneo ?? null;
    const realPlaca = rec.placa       ?? null;
    const realNuc   = rec.nucleo      ?? null;

    let realSem = null, realAcum = null;
    if (realFund != null || realSub != null || realPlaca != null || realNuc != null) {
      realSem   = (realFund||0) + (realSub||0) + (realPlaca||0) + (realNuc||0);
      acumReal += realSem;
      realAcum  = acumReal;
    }

    const difAcum = realAcum !== null && progAcum !== null ? realAcum - progAcum : null;
    const esActual = ctrlSemana !== null && semKey === ctrlSemana;

    return { s, semKey, progFund, progSub, progPlaca, progNuc, progSem, progAcum,
             realFund, realSub, realPlaca, realNuc, realSem, realAcum, difAcum, esActual };
  });

  // ── KPI bar (a la fecha de control) ─────────────────────────────────────────
  // Los cálculos viven en logica.js (logica_resumenOG) para que el gráfico de
  // OG consuma exactamente los mismos números. "Prog Acum." y "Real Acum." son
  // el ÚLTIMO valor hasta el viernes de control (no el de esa semana puntual),
  // así si la obra programada terminó antes, los KPIs siguen mostrando el
  // valor final en vez de "—".
  const resumen = logica_resumenOG(_og_config, hist, ctrlSemana);
  const { progAcumCtrl, realAcumCtrl, difAcum: difAcumCtrl, pctAvance } = resumen;
  const fechaCtrlLabel = ctrlSemana ? ` (${logica_formatearFecha(ctrlSemana)})` : '';
  const difCls         = difAcumCtrl !== null ? (difAcumCtrl >= 0 ? 'og-pos' : 'og-neg') : '';
  const sinCtrl        = !ctrlSemana;

  const kpiHtml = `
    <div class="og-kpi-bar">
      ${sinCtrl ? `<span class="kpi-placeholder" style="font-size:.8rem">Selecciona un viernes en la barra de control para ver los KPIs.</span>` : `
      <div class="kpi-item">
        <span class="kpi-label">M³ Prog. Acum.${fechaCtrlLabel}</span>
        <span class="kpi-val">${progAcumCtrl !== null ? interfaz_fmtNum(progAcumCtrl, 1) : '—'}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">M³ Real Acum.${fechaCtrlLabel}</span>
        <span class="kpi-val">${realAcumCtrl !== null ? interfaz_fmtNum(realAcumCtrl, 1) : '—'}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">Dif. Acum.${fechaCtrlLabel}</span>
        <span class="kpi-val ${difCls}">${difAcumCtrl !== null ? (difAcumCtrl >= 0 ? '+' : '') + interfaz_fmtNum(difAcumCtrl, 1) + ' m³' : '—'}</span>
      </div>
      ${pctAvance !== null ? `<div class="kpi-item">
        <span class="kpi-label">% Avance OG (sobre total)</span>
        <span class="kpi-val">${interfaz_fmtNum(pctAvance, 1)}%</span>
      </div>` : ''}
      `}
    </div>`;

  // ── Helpers de render ────────────────────────────────────────────────────────
  const n  = v => v !== null ? interfaz_fmtNum(v, 1) : '—';
  const fi = (sem, campo, val) =>
    `<td class="og-col-edit"><input class="og-input-real" type="number" min="0" step="0.1"
       data-sem="${sem}" data-campo="${campo}" value="${val !== null ? val : ''}" placeholder="—"></td>`;

  // ── Filas de datos ───────────────────────────────────────────────────────────
  const filas = rows.map(r => {
    const inicio  = logica_formatearFecha(r.s.fecha);
    const termino = r.s.fecha_termino ? logica_formatearFecha(r.s.fecha_termino) : '—';
    const difCls  = r.difAcum !== null ? (r.difAcum >= 0 ? 'og-pos' : 'og-neg') : '';
    const difTxt  = r.difAcum !== null ? (r.difAcum >= 0 ? '+' : '') + interfaz_fmtNum(r.difAcum, 1) : '—';

    return `<tr${r.esActual ? ' class="og-fila-actual"' : ''}>
      <td class="og-col-sem">${inicio}</td>
      <td class="og-col-sem">${termino}</td>
      <td class="og-col-num">${n(r.progFund)}</td>
      <td class="og-col-num">${n(r.progSub)}</td>
      <td class="og-col-num">${n(r.progPlaca)}</td>
      <td class="og-col-num">${n(r.progNuc)}</td>
      <td class="og-col-num og-td-prog-tot">${n(r.progSem)}</td>
      <td class="og-col-num og-td-prog-tot">${n(r.progAcum)}</td>
      ${fi(r.semKey, 'fundaciones', r.realFund)}
      ${fi(r.semKey, 'subterraneo', r.realSub)}
      ${fi(r.semKey, 'placa',       r.realPlaca)}
      ${fi(r.semKey, 'nucleo',      r.realNuc)}
      <td class="og-col-num og-td-real-tot">${n(r.realSem)}</td>
      <td class="og-col-num og-td-real-tot">${n(r.realAcum)}</td>
      <td class="og-col-num ${difCls}">${difTxt}</td>
    </tr>`;
  }).join('');

  // ── Fila de totales ──────────────────────────────────────────────────────────
  const totProgFund  = _og_sum(rows, r => r.progFund);
  const totProgSub   = _og_sum(rows, r => r.progSub);
  const totProgPlaca = _og_sum(rows, r => r.progPlaca);
  const totProgNuc   = _og_sum(rows, r => r.progNuc);
  const totProgSem   = _og_sum(rows, r => r.progSem);
  const maxProgAcum  = _og_max(rows, r => r.progAcum);
  const totRealFund  = _og_sum(rows, r => r.realFund);
  const totRealSub   = _og_sum(rows, r => r.realSub);
  const totRealPlaca = _og_sum(rows, r => r.realPlaca);
  const totRealNuc   = _og_sum(rows, r => r.realNuc);
  const totRealSem   = _og_sum(rows, r => r.realSem);
  const maxRealAcum  = _og_max(rows, r => r.realAcum);
  const totDifAcum   = maxRealAcum !== null && maxProgAcum !== null ? maxRealAcum - maxProgAcum : null;
  const totDifCls    = totDifAcum !== null ? (totDifAcum >= 0 ? 'og-pos' : 'og-neg') : '';
  const totDifTxt    = totDifAcum !== null ? (totDifAcum >= 0 ? '+' : '') + interfaz_fmtNum(totDifAcum, 1) : '—';

  const filaTotales = `<tr class="og-fila-totales">
    <td colspan="2">TOTALES</td>
    <td class="og-col-num">${n(totProgFund)}</td>
    <td class="og-col-num">${n(totProgSub)}</td>
    <td class="og-col-num">${n(totProgPlaca)}</td>
    <td class="og-col-num">${n(totProgNuc)}</td>
    <td class="og-col-num og-td-prog-tot">${n(totProgSem)}</td>
    <td class="og-col-num og-td-prog-tot">${n(maxProgAcum)}</td>
    <td class="og-col-num">${n(totRealFund)}</td>
    <td class="og-col-num">${n(totRealSub)}</td>
    <td class="og-col-num">${n(totRealPlaca)}</td>
    <td class="og-col-num">${n(totRealNuc)}</td>
    <td class="og-col-num og-td-real-tot">${n(totRealSem)}</td>
    <td class="og-col-num og-td-real-tot">${n(maxRealAcum)}</td>
    <td class="og-col-num ${totDifCls}">${totDifTxt}</td>
  </tr>`;

  subcontent.innerHTML = `
  <div class="og-tabla-layout">
    ${kpiHtml}
    <div class="tabla-scroll">
      <table class="tabla-og">
        <thead>
          <tr>
            <th rowspan="2" class="og-th-fecha">Inicio</th>
            <th rowspan="2" class="og-th-fecha">Término</th>
            <th colspan="6" class="og-th-prog">PROGRAMACIÓN</th>
            <th colspan="6" class="og-th-real">REAL</th>
            <th rowspan="2" class="og-th-dif">Dif.<br>Acum.</th>
          </tr>
          <tr>
            <th class="og-th-prog-sub">Fund.</th>
            <th class="og-th-prog-sub">Sub.</th>
            <th class="og-th-prog-sub">Placa</th>
            <th class="og-th-prog-sub">Núcleo</th>
            <th class="og-th-prog-tot">Semanal</th>
            <th class="og-th-prog-tot">Acum.</th>
            <th class="og-th-real-sub">Fund. ✎</th>
            <th class="og-th-real-sub">Sub. ✎</th>
            <th class="og-th-real-sub">Placa ✎</th>
            <th class="og-th-real-sub">Núcleo ✎</th>
            <th class="og-th-real-tot">Semanal</th>
            <th class="og-th-real-tot">Acum.</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>${filaTotales}</tfoot>
      </table>
    </div>
  </div>`;

  // Segunda fila del encabezado doble: top = altura de la primera fila
  const headRows = subcontent.querySelectorAll('.tabla-og thead tr');
  if (headRows.length >= 2) {
    const h1 = headRows[0].offsetHeight;
    headRows[1].querySelectorAll('th').forEach(th => { th.style.top = h1 + 'px'; });
  }
}

// ── Sub-render: Fecha Término Pisos ──────────────────────────────────────────

function _og_renderFechasPisos() {
  const subcontent = document.getElementById('og-subcontent');
  if (!subcontent) return;

  const niveles = _og_nivelesOrdenados(_og_config);
  const fechas  = datos_cargarFechasPisos(_og_id);

  // Construir filas de la tabla
  let filas = '';
  let i = 0;
  while (i < niveles.length) {
    const niv = niveles[i];
    if (niv.rowspan) {
      // Fundaciones ocupa 2 filas — emitir dos <tr>
      const niv2 = niveles[i + 1];
      filas += `<tr>
        <td rowspan="2" class="og-col-sem">Fundaciones</td>
        <td>${niv.desc}</td>
        <td>${_og_datecell(niv.key, fechas)}</td>
      </tr>
      <tr>
        <td>${niv2 ? niv2.desc : ''}</td>
        <td>${niv2 ? _og_datecell(niv2.key, fechas) : ''}</td>
      </tr>`;
      i += 2;
    } else {
      filas += `<tr>
        <td class="og-col-sem">${niv.label}</td>
        <td>${niv.desc}</td>
        <td>${_og_datecell(niv.key, fechas)}</td>
      </tr>`;
      i++;
    }
  }

  subcontent.innerHTML = `
  <div style="padding:1rem">
    <p class="cf-hint" style="margin-bottom:.75rem">
      Ingresa la fecha en que se completó cada nivel. Puedes escribir manualmente (dd-mm-aaaa),
      usar el calendario 📅, o pegar fechas desde Excel (una por fila).
    </p>
    <div class="tabla-scroll" style="max-width:620px">
      <table class="tabla-og tabla-og-pisos">
        <thead>
          <tr>
            <th class="og-th-fecha" style="min-width:90px">Nivel</th>
            <th class="og-th-fecha">Cuándo se rellena</th>
            <th class="og-th-real-tot" style="min-width:160px">Fecha Término</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  </div>`;

  // Registrar eventos del calendario en las celdas recién renderizadas
  subcontent.querySelectorAll('.og-fecha-cal-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.nivel;
      const dropId = 'og-cal-' + key;
      const drop = document.getElementById(dropId);
      if (!drop) return;
      const visible = drop.style.display !== 'none';
      // Cerrar todos los dropdowns abiertos
      subcontent.querySelectorAll('.og-cal-drop').forEach(d => { d.style.display = 'none'; });
      if (!visible) {
        const fechas = datos_cargarFechasPisos(_og_id);
        const fechaActual = fechas[key] ? new Date(fechas[key] + 'T12:00:00') : new Date();
        _og_renderCalPisos(key, fechaActual.getFullYear(), fechaActual.getMonth());
        // Posicionar con fixed respecto al viewport para escapar de cualquier overflow
        const btnRect = btn.getBoundingClientRect();
        drop.style.top  = (btnRect.bottom + 4) + 'px';
        drop.style.left = btnRect.left + 'px';
        drop.style.display = 'block';
        // Ajustar si se sale por la derecha
        const dw = drop.offsetWidth;
        if (btnRect.left + dw > window.innerWidth - 8) {
          drop.style.left = Math.max(8, window.innerWidth - dw - 8) + 'px';
        }
      }
    });
  });

  // Cerrar dropdowns al hacer clic fuera
  const _ogCalClose = e => {
    if (!e.target.closest('.og-fecha-wrap')) {
      subcontent.querySelectorAll('.og-cal-drop').forEach(d => { d.style.display = 'none'; });
    }
  };
  document.removeEventListener('click', _ogCalClose);
  document.addEventListener('click', _ogCalClose);
}

// ── Celda de fecha ────────────────────────────────────────────────────────────

function _og_datecell(key, fechas) {
  const fecha  = fechas[key] || '';
  const display = fecha ? logica_formatearFecha(fecha) : '';
  return `<div class="og-fecha-wrap" data-nivel="${key}">
    <input class="og-fecha-input" type="text" placeholder="dd-mm-aaaa"
           value="${display}" data-nivel="${key}" autocomplete="off">
    <button class="og-fecha-cal-btn" data-nivel="${key}" title="Abrir calendario">📅</button>
    <div class="sc-cal-dropdown og-cal-drop" id="og-cal-${key}" style="display:none"></div>
  </div>`;
}

// ── Calendario pisos (todos los días clickeables) ─────────────────────────────

function _og_renderCalPisos(key, year, month) {
  const drop = document.getElementById('og-cal-' + key);
  if (!drop) return;

  const fechas      = datos_cargarFechasPisos(_og_id);
  const seleccionada = fechas[key] || null;

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const primerDia = new Date(year, month, 1);
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  // Lunes=0 … Domingo=6
  let startDow = primerDia.getDay() - 1;
  if (startDow < 0) startDow = 6;

  let celdas = '';
  let col = 0;
  let row = '<tr>';
  // Celdas vacías al inicio
  for (let b = 0; b < startDow; b++) {
    row += `<td class="sc-cal-vacio"></td>`;
    col++;
  }
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const esSel = fecha === seleccionada;
    const cls   = esSel ? 'sc-cal-dia sc-cal-sel' : 'sc-cal-dia og-cal-dia-click';
    row += `<td class="${cls}" data-fecha="${fecha}" data-nivel="${key}" style="cursor:pointer">${d}</td>`;
    col++;
    if (col === 7) { row += '</tr>'; celdas += row; row = '<tr>'; col = 0; }
  }
  if (col > 0) { while (col < 7) { row += `<td class="sc-cal-vacio"></td>`; col++; } row += '</tr>'; celdas += row; }

  drop.innerHTML = `
    <div class="sc-cal-header">
      <button class="sc-cal-nav" data-cal-key="${key}" data-cal-year="${year}" data-cal-month="${month - 1}">‹</button>
      <span class="sc-cal-mes">${meses[month]} ${year}</span>
      <button class="sc-cal-nav" data-cal-key="${key}" data-cal-year="${year}" data-cal-month="${month + 1}">›</button>
    </div>
    <table class="sc-cal-tabla">
      <thead><tr>
        <th>Lu</th><th>Ma</th><th>Mi</th><th>Ju</th><th>Vi</th><th>Sa</th><th>Do</th>
      </tr></thead>
      <tbody>${celdas}</tbody>
    </table>`;

  // Navegación mes
  drop.querySelectorAll('.sc-cal-nav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      let y = parseInt(btn.dataset.calYear);
      let m = parseInt(btn.dataset.calMonth);
      if (m < 0)  { m = 11; y--; }
      if (m > 11) { m = 0;  y++; }
      _og_renderCalPisos(btn.dataset.calKey, y, m);
    });
  });

  // Selección de día
  drop.querySelectorAll('.og-cal-dia-click, .sc-cal-sel').forEach(td => {
    td.addEventListener('click', e => {
      e.stopPropagation();
      const fecha  = td.dataset.fecha;
      const nivel  = td.dataset.nivel;
      const fechas = datos_cargarFechasPisos(_og_id);
      fechas[nivel] = fecha;
      datos_guardarFechasPisos(_og_id, fechas);
      // Actualizar input y cerrar dropdown
      const wrap  = document.querySelector(`.og-fecha-wrap[data-nivel="${nivel}"]`);
      const input = wrap?.querySelector('.og-fecha-input');
      if (input) { input.value = logica_formatearFecha(fecha); input.classList.remove('invalida'); }
      drop.style.display = 'none';
    });
  });
}
