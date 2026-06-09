// Módulo Gráficos — Curvas S de OG y Terminaciones usando Chart.js.

let _graf_ogChart   = null;
let _graf_termChart = null;

function _graf_viernesDeSemanaDe(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00Z');
  const dia = d.getUTCDay(); // 0=Dom … 5=Vie
  d.setUTCDate(d.getUTCDate() + (5 - dia + 7) % 7);
  return d.toISOString().slice(0, 10);
}

function _graf_snapViernes(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=Dom,1=Lun,...,5=Vie,6=Sáb
  if (dow === 5) return fechaStr;
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);      // Sáb → vie anterior
  else if (dow === 0) d.setUTCDate(d.getUTCDate() - 2); // Dom → vie anterior
  else d.setUTCDate(d.getUTCDate() + (5 - dow));        // Lun-Jue → vie siguiente
  return d.toISOString().slice(0, 10);
}

function _graf_rangoViernes(v1, v2) {
  const arr = [];
  const fin = new Date(v2 + 'T12:00:00Z');
  for (let d = new Date(v1 + 'T12:00:00Z'); d <= fin; d.setUTCDate(d.getUTCDate() + 7))
    arr.push(d.toISOString().slice(0, 10));
  return arr;
}

function graficos_inicializar(idProyecto) {
  const panel = document.getElementById('panel-tab-graficos');
  if (!panel) return;

  const config    = datos_cargarProyecto(idProyecto);
  const histOG    = datos_cargarHistorialOG(idProyecto);
  const histTerm  = datos_cargarHistorialTerm(idProyecto);
  const schedOG   = config?.og?.schedule  || [];
  const schedTerm = config?.term_schedule || [];
  const m3Total   = config?.og?.m3_total  || 0;
  const pisos     = config?.pisos || 0;
  const fasesActivas  = logica_fasesEfectivas(config);
  const fechasPisos   = datos_cargarFechasPisos(idProyecto);

  if (_graf_ogChart)   { _graf_ogChart.destroy();   _graf_ogChart   = null; }
  if (_graf_termChart) { _graf_termChart.destroy(); _graf_termChart = null; }

  panel.innerHTML = `
  <div class="graf-seccion">
    <div class="graf-header">
      <span class="graf-titulo">Curva Obra Gruesa</span>
      <div class="graf-kpis" id="og-kpis"></div>
    </div>
    <div class="graf-wrapper">
      <canvas id="canvas-og"></canvas>
    </div>
    <p class="graf-aviso" id="og-aviso" style="display:none">Sin datos suficientes para mostrar el gráfico.</p>
  </div>

  <div class="graf-seccion">
    <div class="graf-header">
      <span class="graf-titulo">Curva Terminaciones</span>
      <div class="graf-kpis" id="term-kpis"></div>
    </div>
    <div class="graf-wrapper">
      <canvas id="canvas-term"></canvas>
    </div>
    <p class="graf-aviso" id="term-aviso" style="display:none">Sin datos suficientes para mostrar el gráfico.</p>
  </div>`;

  const histOGAcum = _graf_calcularAcumOG(histOG);
  const ctrlSemana = datos_cargarSemanaControl(idProyecto)?.semana || null;
  const matrices   = datos_cargarMatrices(idProyecto);
  const baseline   = datos_cargarBaseline(idProyecto);

  _graf_renderKpisOG(config, histOG, ctrlSemana);
  _graf_renderKpisTerm(config, matrices, baseline, fasesActivas, schedTerm, fechasPisos, ctrlSemana, histTerm);

  _graf_dibujarOG(histOGAcum, schedOG, m3Total, pisos);
  _graf_dibujarTerm(histOGAcum, histTerm, schedTerm, fasesActivas, config, fechasPisos, ctrlSemana);
}

function _graf_calcularAcumOG(histOG) {
  let acum = 0;
  return histOG.map(r => {
    acum += (r.m3_semanal || 0);
    return { semana: r.semana, m3_acumulado: acum };
  });
}

function _graf_escaleraOG(fechasPisos, config, fechasEje, cutoff) {
  const sub   = config?.subterraneos || 0;
  const pisos = config?.pisos || 0;
  const eventos = {};
  Object.entries(fechasPisos || {}).forEach(([key, fecha]) => {
    if (!fecha || key === 'fund_inicio') return;
    let y;
    if (key === 'fund_termino') y = -sub;
    else if (key === 'sm')      y = pisos + 1;
    else { y = parseInt(key); if (isNaN(y)) return; }
    const v = _graf_snapViernes(fecha);
    if (eventos[v] === undefined || eventos[v] < y) eventos[v] = y;
  });
  const viernesEventos = Object.keys(eventos).sort();
  if (viernesEventos.length === 0) return fechasEje.map(() => null);

  const lastEvento  = viernesEventos[viernesEventos.length - 1];
  const effectiveEnd = (cutoff && cutoff < lastEvento) ? cutoff : lastEvento;

  let running = null;
  let eIdx = 0;
  return fechasEje.map(f => {
    if (f > effectiveEnd) return null;
    while (eIdx < viernesEventos.length && viernesEventos[eIdx] <= f) {
      const y = eventos[viernesEventos[eIdx]];
      running = running === null ? y : Math.max(running, y);
      eIdx++;
    }
    return running;
  });
}

// ── Curva OG ─────────────────────────────────────────────────────────────────

function _graf_dibujarOG(histOGAcum, schedule, m3Total, pisos) {
  const canvas = document.getElementById('canvas-og');
  if (!canvas) return;

  // schedule.fecha_termino y hist.semana ya son viernes; no se requiere conversión.
  const _vProg = new Map(schedule.map(s => [s.fecha_termino || _graf_snapViernes(s.fecha), s]));
  const _vReal = new Map(histOGAcum.map(r => [r.semana, r]));
  const _vTodos = Array.from(new Set([..._vProg.keys(), ..._vReal.keys()])).sort();

  if (_vTodos.length < 2) {
    const av = document.getElementById('og-aviso');
    if (av) av.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }

  const fechas = _graf_rangoViernes(_vTodos[0], _vTodos[_vTodos.length - 1]);

  const dataProg = fechas.map(f => { const s = _vProg.get(f); return s ? (s.m3_acumulado ?? null) : null; });
  const dataReal = fechas.map(f => { const r = _vReal.get(f); return r ? r.m3_acumulado : null; });
  const labels   = fechas.map(f => logica_formatearFecha(f));

  const _dataMax = Math.max(
    0,
    ...schedule.filter(s => s.m3_acumulado != null).map(s => s.m3_acumulado),
    ...histOGAcum.filter(r => r.m3_acumulado != null).map(r => r.m3_acumulado),
    m3Total || 0
  );
  const _ogMax  = _dataMax > 0 ? Math.ceil(_dataMax * 1.1 / 250) * 250 : 2500;

  if (_graf_ogChart) _graf_ogChart.destroy();

  _graf_ogChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'M³ Programado',
          data: dataProg,
          borderColor: OG_COLOR.enc,
          borderDash: [6, 4],
          pointRadius: 3,
          fill: false,
          spanGaps: true,
          tension: 0.3,
        },
        {
          label: 'M³ Real',
          data: dataReal,
          borderColor: OG_COLOR.enc,
          backgroundColor: OG_COLOR.enc + '14',
          pointRadius: 4,
          fill: false,
          spanGaps: false,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            generateLabels: (chart) => {
              const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              items.forEach(item => {
                const ds = chart.data.datasets[item.datasetIndex];
                if (ds?.borderDash?.length) item.lineDash = ds.borderDash;
              });
              return items;
            },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? interfaz_fmtNum(ctx.parsed.y) : '—'}`,
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 45 } },
        y: {
          title: { display: true, text: 'M³' },
          min: 0,
          max: _ogMax,
          ticks: { autoSkip: false },
          afterBuildTicks: scale => {
            scale.ticks = [];
            for (let v = 0; v <= _ogMax; v += 250) scale.ticks.push({ value: v });
          },
        },
      },
    },
  });
}

function _graf_renderKpisOG(config, histOG, semanaCtrl) {
  const el = document.getElementById('og-kpis');
  if (!el) return;
  if (!semanaCtrl) {
    el.innerHTML = '<span class="kpi-placeholder">Selecciona un viernes en la barra de control.</span>';
    return;
  }
  // Misma fuente que la hoja "Avances Obra Gruesa" → coinciden por construcción.
  const r = logica_resumenOG(config, histOG, semanaCtrl);
  const difCls = r.difAcum !== null ? (r.difAcum >= 0 ? 'pos' : 'neg') : '';
  const desv   = r.desviacion;
  const desvTxt = desv == null
    ? null
    : (desv.direccion === 'al_dia'
        ? 'Al día'
        : `${desv.direccion === 'atrasado' ? 'Atrasado' : 'Adelantado'} ${desv.semanas} sem`);
  const desvCls = desv && desv.direccion === 'atrasado' ? 'neg'
                : desv && desv.direccion === 'adelantado' ? 'pos' : '';

  el.innerHTML = `
    ${r.pctAvance !== null ? `<div class="kpi-item"><span class="kpi-label">% Avance OG</span><span class="kpi-val">${interfaz_fmtNum(r.pctAvance, 1)}%</span></div>` : ''}
    ${r.progAcumCtrl !== null ? `<div class="kpi-item"><span class="kpi-label">M³ Prog. Acum.</span><span class="kpi-val">${interfaz_fmtNum(r.progAcumCtrl, 1)}</span></div>` : ''}
    ${r.realAcumCtrl !== null ? `<div class="kpi-item"><span class="kpi-label">M³ Real Acum.</span><span class="kpi-val">${interfaz_fmtNum(r.realAcumCtrl, 1)}</span></div>` : ''}
    ${r.difAcum !== null ? `<div class="kpi-item"><span class="kpi-label">Dif. Acum. m³</span><span class="kpi-val ${difCls}">${r.difAcum >= 0 ? '+' : ''}${interfaz_fmtNum(r.difAcum, 1)}</span></div>` : ''}
    ${desvTxt ? `<div class="kpi-item"><span class="kpi-label">Desviación</span><span class="kpi-val ${desvCls}">${desvTxt}</span></div>` : ''}`;
}

// ── Curva Terminaciones ──────────────────────────────────────────────────────

function _graf_dibujarTerm(histOGAcum, histTerm, schedTerm, fasesActivas, config, fechasPisos, ctrlSemana) {
  const canvas = document.getElementById('canvas-term');
  if (!canvas) return;

  const pisos = config?.pisos || 0;
  const sub   = config?.subterraneos || 0;

  // schedTerm.fecha_termino y hist.*semana ya son viernes; se usan tal cual.
  const _vSched  = new Map(schedTerm.map(s => [s.fecha_termino || _graf_snapViernes(s.fecha), s]));
  const _vOGReal = new Map(histOGAcum.map(r => [r.semana, r]));
  const _vTerm   = new Map(histTerm.map(r => [r.semana, r]));
  const _vStair  = Object.values(fechasPisos || {}).filter(Boolean).map(_graf_snapViernes);
  const _vTodos  = Array.from(new Set([..._vSched.keys(), ..._vOGReal.keys(), ..._vTerm.keys(), ..._vStair])).sort();

  if (_vTodos.length < 2) {
    const av = document.getElementById('term-aviso');
    if (av) av.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }

  const fechas   = _graf_rangoViernes(_vTodos[0], _vTodos[_vTodos.length - 1]);
  const labels   = fechas.map(f => logica_formatearFecha(f));
  const datasets = [];

  if (schedTerm.length > 0) {
    datasets.push({
      label: 'OG Prog.',
      data: fechas.map(f => _vSched.get(f)?.piso_og ?? null),
      borderColor: OG_COLOR.enc,
      borderDash: [6, 4],
      pointRadius: 2,
      fill: false,
      spanGaps: true,
      tension: 0.3,
    });
  }

  const escaleraOG = _graf_escaleraOG(fechasPisos, config, fechas, ctrlSemana);
  if (escaleraOG.some(v => v !== null)) {
    datasets.push({
      label: 'OG Real',
      data: escaleraOG,
      borderColor: OG_COLOR.enc,
      pointRadius: 3,
      fill: false,
      spanGaps: false,
      tension: 0,
    });
  }

  fasesActivas.forEach(fase => {
    const c      = FASE_COLORES[fase];
    const nombre = NOMBRES_FASES[fase].split('–')[0].trim();

    if (schedTerm.length > 0) {
      datasets.push({
        label: `${nombre} Prog.`,
        data: fechas.map(f => _vSched.get(f)?.['f' + fase] ?? null),
        borderColor: c.enc,
        borderDash: [4, 3],
        pointRadius: 2,
        fill: false,
        spanGaps: true,
        tension: 0.3,
      });
    }

    if (histTerm.length > 0) {
      datasets.push({
        label: `${nombre} Real`,
        data: fechas.map(f => _vTerm.get(f)?.piso_por_fase?.[fase] ?? null),
        borderColor: c.enc,
        backgroundColor: c.enc + '22',
        pointRadius: 3,
        fill: false,
        spanGaps: false,
        tension: 0.3,
      });
    }
  });

  const _termMin = sub > 0 ? -(sub + 1) : 0;
  const _termMax = pisos > 0 ? pisos + 2 : 10;

  if (_graf_termChart) _graf_termChart.destroy();

  _graf_termChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            font: { size: 11 },
            generateLabels: (chart) => {
              const items = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              items.forEach(item => {
                const ds = chart.data.datasets[item.datasetIndex];
                if (ds?.borderDash?.length) item.lineDash = ds.borderDash;
              });
              return items;
            },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? interfaz_fmtNum(ctx.parsed.y) : '—'}`,
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 90, autoSkip: false } },
        y: {
          title: { display: true, text: 'Piso Aproximado' },
          min: _termMin,
          max: _termMax,
          ticks: { autoSkip: false, font: { size: 10 } },
          afterBuildTicks: scale => {
            scale.ticks = [];
            for (let v = _termMin; v <= _termMax; v++) scale.ticks.push({ value: v });
          },
        },
      },
    },
  });
}

function _graf_renderKpisTerm(config, matrices, baseline, fasesActivas, schedTerm, fechasPisos, semanaCtrl, histTerm) {
  const el = document.getElementById('term-kpis');
  if (!el) return;
  if (!semanaCtrl) {
    el.innerHTML = '<span class="kpi-placeholder">Selecciona un viernes en la barra de control.</span>';
    return;
  }

  // Línea compacta: label izquierda + valor derecha en una sola fila.
  const linea = (label, val, cls = '') =>
    `<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:11px;line-height:1.5">
       <span style="opacity:.65">${label}</span>
       <span style="font-weight:600" class="${cls}">${val}</span>
     </div>`;

  const fmtDesv = d => {
    if (!d) return null;
    if (d.direccion === 'al_dia') return { txt: 'Al día', cls: '' };
    return {
      txt: `${d.direccion === 'atrasado' ? 'Atrasado' : 'Adelantado'} ${d.semanas} sem`,
      cls: d.direccion === 'atrasado' ? 'neg' : 'pos',
    };
  };

  // Bloque OG: solo Piso Aprox., desde la escalera de Fecha Término Pisos.
  const pisoOG = logica_escaleraOGActual(fechasPisos, config, semanaCtrl);
  const bloqueOG = `
    <div class="kpi-item" style="border-left:3px solid ${OG_COLOR.enc};min-width:140px;padding:6px 10px">
      <div style="font-weight:700;font-size:12px;margin-bottom:4px">OG</div>
      ${linea('Piso Aprox.', pisoOG !== null ? interfaz_fmtNum(pisoOG) : '—')}
    </div>`;

  // Bloque por fase: mismos números que el Resumen.
  const departamentos = config.departamentos || [];
  const deptos        = logica_listaDeptosPlana(departamentos);

  const chips = fasesActivas.map(fase => {
    const c    = FASE_COLORES[fase];
    const prom = logica_promediosFase(config, matrices, baseline, fase, deptos, departamentos);

    // Programado de esta fase: último valor hasta el viernes de control.
    const serieProgFase = (schedTerm || [])
      .filter(s => (s.fecha_termino || s.fecha) && s['f' + fase] != null)
      .map(s => ({ fecha: s.fecha_termino || s.fecha, valor: s['f' + fase] }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    let progFase = null;
    for (const s of serieProgFase) {
      if (s.fecha <= semanaCtrl) progFase = s.valor; else break;
    }
    const difPisos = (progFase != null) ? prom.piso - progFase : null;

    // Serie real por fase desde los cierres + valor actual en semanaCtrl.
    // Si no hay deptos al 100% (prom.deptos === 0), no se calcula desviación.
    let desv = null;
    if (prom.deptos > 0) {
      const serieRealFase = (histTerm || [])
        .filter(r => r && r.semana && r.piso_por_fase && r.piso_por_fase[fase] != null)
        .map(r => ({ fecha: r.semana, valor: r.piso_por_fase[fase] }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      // Aseguramos un punto en semanaCtrl con el estado actual (matrices vivas).
      serieRealFase.push({ fecha: semanaCtrl, valor: prom.piso });
      desv = fmtDesv(logica_desviacionSemanas(serieProgFase, serieRealFase, semanaCtrl));
    }

    return `<div class="kpi-item" style="border-left:3px solid ${c.enc};min-width:140px;padding:6px 10px">
      <div style="font-weight:700;font-size:12px;margin-bottom:4px">${NOMBRES_FASES[fase].split('–')[0].trim()}</div>
      ${prom.avance !== null ? linea('% Avance', `${prom.avance}%`) : ''}
      ${linea('Piso Aprox.', interfaz_fmtNum(prom.piso))}
      ${difPisos !== null ? linea('Dif. Pisos', `${difPisos >= 0 ? '+' : ''}${interfaz_fmtNum(difPisos)}`, difPisos >= 0 ? 'pos' : 'neg') : ''}
      ${desv ? linea('Desviación', desv.txt, desv.cls) : ''}
    </div>`;
  }).join('');

  el.innerHTML = bloqueOG + chips;
}
