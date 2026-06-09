// Lógica de negocio pura — sin DOM, sin localStorage, sin efectos secundarios.

// ── Nomenclatura de departamentos ────────────────────────────────────────────

function logica_generarNomenclatura(piso, numEnPiso) {
  return String(piso * 100 + numEnPiso);
}

function logica_generarDepartamentos(pisosCantidades) {
  // pisosCantidades: [{piso, cantidad}]
  return pisosCantidades.map(({ piso, cantidad }) => {
    const deptos = [];
    for (let i = 1; i <= cantidad; i++) deptos.push(logica_generarNomenclatura(piso, i));
    return { piso, cantidad, deptos };
  });
}

function logica_listaDeptosPlana(departamentos) {
  return departamentos.flatMap(p => p.deptos);
}

function logica_totalDepartamentos(departamentos) {
  return departamentos.reduce((s, p) => s + p.cantidad, 0);
}

function logica_pisosConDeptos(departamentos) {
  return departamentos.filter(p => p.cantidad > 0).length;
}

// ── Orden efectivo de actividades ────────────────────────────────────────────

function logica_ordenEfectivo(config) {
  // Devuelve array de {numero, faseEfectiva, posicion} ordenado
  if (!config.ordenActividades) return [];
  return [...config.ordenActividades].sort((a, b) => {
    if (a.faseEfectiva !== b.faseEfectiva) return a.faseEfectiva - b.faseEfectiva;
    return a.posicion - b.posicion;
  });
}

function logica_fasesEfectivas(config) {
  const fases = new Set(logica_ordenEfectivo(config).map(o => o.faseEfectiva));
  return Array.from(fases).sort();
}

function logica_actividadesDeFase(config, fase) {
  return logica_ordenEfectivo(config)
    .filter(o => o.faseEfectiva === fase)
    .map(o => o.numero);
}

// ── Cálculo de piso aproximado ────────────────────────────────────────────────
// Algoritmo "llenar de abajo hacia arriba":
//   1. Ordena pisos del más bajo al más alto.
//   2. Recorre cada piso en orden:
//      - Si tiene 0 deptos → suma 1 piso (cuenta como terminado).
//      - Si los deptos terminados alcanzan para llenarlo → suma 1, descuenta.
//      - Si no alcanzan → suma la fracción (restantes / cantidad) y termina.
// Parámetros:
//   deptosAl100: cantidad total de deptos al 100%.
//   departamentos: array [{piso, cantidad, deptos?}, …] (puede ser filtrado).

function logica_pisoAproximado(deptosAl100, departamentos) {
  if (!departamentos || departamentos.length === 0) return 0;
  const ordenados = [...departamentos].sort((a, b) => a.piso - b.piso);
  let pisoAcum  = 0;
  let restantes = deptosAl100;
  for (const p of ordenados) {
    const cant = p.cantidad || 0;
    if (cant === 0) {                // Piso sin deptos: cuenta como terminado.
      pisoAcum += 1;
      continue;
    }
    if (restantes >= cant) {         // Piso completo.
      pisoAcum += 1;
      restantes -= cant;
    } else {                         // Piso parcial: aporta la fracción y se detiene.
      pisoAcum += restantes / cant;
      restantes = 0;
      break;
    }
  }
  return parseFloat(pisoAcum.toFixed(2));
}

// ── Cálculos de matrices ──────────────────────────────────────────────────────

function logica_deptosTerminadosActividad(matrices, faseKey, numActividad, todosDeptos) {
  const celdas = matrices[faseKey] || {};
  let count = 0;
  todosDeptos.forEach(depto => {
    const key = depto + '_' + numActividad;
    if ((celdas[key] || 0) >= 100) count++;
  });
  return count;
}

function logica_avanceActividad(matrices, faseKey, numActividad, todosDeptos) {
  const term = logica_deptosTerminadosActividad(matrices, faseKey, numActividad, todosDeptos);
  return todosDeptos.length ? Math.round((term / todosDeptos.length) * 100) : 0;
}

function logica_pisoActividad(matrices, faseKey, numActividad, deptosLista, departamentos) {
  const term = logica_deptosTerminadosActividad(matrices, faseKey, numActividad, deptosLista);
  return logica_pisoAproximado(term, departamentos);
}

function logica_deptosCompletadosFase(matrices, faseKey, numerosActividades, todosDeptos) {
  // Cuenta deptos donde TODAS las actividades de la fase están al 100%
  const celdas = matrices[faseKey] || {};
  let count = 0;
  todosDeptos.forEach(depto => {
    const all100 = numerosActividades.every(num => (celdas[depto + '_' + num] || 0) >= 100);
    if (all100) count++;
  });
  return count;
}

function logica_pisoFase(matrices, faseKey, numerosActividades, deptosLista, departamentos) {
  const term = logica_deptosCompletadosFase(matrices, faseKey, numerosActividades, deptosLista);
  return logica_pisoAproximado(term, departamentos);
}

function logica_calcularResumenFases(config, matrices) {
  const deptos = logica_listaDeptosPlana(config.departamentos || []);
  const resumen = {};
  logica_fasesEfectivas(config).forEach(fase => {
    const faseKey = 'fase_' + fase;
    const nums = logica_actividadesDeFase(config, fase);
    resumen[fase] = {
      piso: logica_pisoFase(matrices, faseKey, nums, deptos, config.departamentos || []),
      deptos: logica_deptosCompletadosFase(matrices, faseKey, nums, deptos),
    };
  });
  return resumen;
}

// ── Cálculo piso OG desde m3 ─────────────────────────────────────────────────

function logica_pisoOG(m3Acumulado, m3Total, pisosTotal) {
  if (!m3Total || m3Total <= 0) return 0;
  return parseFloat(((m3Acumulado / m3Total) * pisosTotal).toFixed(2));
}

// ── Promedios por fase (Terminaciones) ───────────────────────────────────────
// Función pura. La consumen el Resumen de Terminaciones y los KPIs del gráfico
// de Terminaciones — así siempre dan el mismo número. Calcula:
//   - avance:     promedio de % de avance de las actividades de la fase
//   - piso:       promedio de Piso Aprox. por actividad
//   - deltaPiso:  promedio de (piso actual - piso baseline) por actividad
//   - deptos:     promedio de "deptos al 100%" por actividad
//   - deltaDeptos:promedio de (deptos actuales - deptos baseline) por actividad

function logica_promediosFase(config, matrices, baseline, fase, deptosLista, departamentos) {
  const faseKey = 'fase_' + fase;
  const nums    = logica_actividadesDeFase(config, fase);

  if (nums.length === 0) {
    return { avance: null, piso: 0, deltaPiso: 0, deptos: 0, deltaDeptos: 0 };
  }

  const datos = nums.map(n => {
    const avance     = logica_avanceActividad(matrices, faseKey, n, deptosLista);
    const piso       = logica_pisoActividad(matrices, faseKey, n, deptosLista, departamentos);
    const pisoBase   = logica_pisoActividad(baseline, faseKey, n, deptosLista, departamentos);
    const deptos     = logica_deptosTerminadosActividad(matrices, faseKey, n, deptosLista);
    const deptosBase = logica_deptosTerminadosActividad(baseline, faseKey, n, deptosLista);
    return { avance, piso, pisoBase, deptos, deptosBase,
             deltaPiso: piso - pisoBase, deltaDeptos: deptos - deptosBase };
  });

  const avg = key => datos.reduce((s, d) => s + d[key], 0) / datos.length;
  const r2  = n => parseFloat(n.toFixed(2));

  return {
    avance:      Math.round(avg('avance')),
    piso:        r2(avg('piso')),
    deltaPiso:   r2(avg('deltaPiso')),
    deptos:      r2(avg('deptos')),
    deltaDeptos: r2(avg('deltaDeptos')),
  };
}

// ── Desviación en semanas ────────────────────────────────────────────────────
// Distancia horizontal entre la curva real y la programada.
//   fechaReal = fecha en que la curva real alcanzó su valor actual (último
//               registro real <= viernes de control).
//   fechaProg = fecha en que la curva programada alcanza ese mismo valor
//               (o la última fecha programada si nunca lo alcanza).
//   diff      = fechaReal - fechaProg.
//     positivo  → atrasado (real llegó después que programado).
//     negativo  → adelantado (real llegó antes).
//     cero      → al día.
// Parámetros:
//   serieProg:   [{fecha, valor}, ...] curva programada acumulada
//   serieReal:   [{fecha, valor}, ...] curva real acumulada
//   semanaCtrl:  viernes de control (corta serieReal a esa fecha)
// Retorna { semanas, direccion } o null.

function logica_desviacionSemanas(serieProg, serieReal, semanaCtrl) {
  if (!semanaCtrl) return null;

  const sProg = (serieProg || [])
    .filter(s => s && s.fecha && s.valor !== null && s.valor !== undefined)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const sReal = (serieReal || [])
    .filter(s => s && s.fecha && s.valor !== null && s.valor !== undefined && s.fecha <= semanaCtrl)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (sProg.length === 0 || sReal.length === 0) return null;

  const lastReal = sReal[sReal.length - 1];
  const valorR   = lastReal.valor;
  if (valorR <= 0) return null;

  const fechaReal   = lastReal.fecha;
  const entradaProg = sProg.find(s => s.valor >= valorR);
  const fechaProg   = entradaProg ? entradaProg.fecha : sProg[sProg.length - 1].fecha;

  const ms   = new Date(fechaReal + 'T00:00:00Z') - new Date(fechaProg + 'T00:00:00Z');
  const dias = Math.round(ms / 86400000);
  const sem  = Math.round(dias / 7);

  let direccion;
  if (sem > 0)      direccion = 'atrasado';
  else if (sem < 0) direccion = 'adelantado';
  else              direccion = 'al_dia';

  return { semanas: Math.abs(sem), direccion };
}

// ── Construcción de snapshot semanal ─────────────────────────────────────────
// Arma el objeto completo que se guarda en `coa_snapshots_<id>` al hacer
// "Terminar actualización". Incluye OG (m³ Real de la semana + acumulado),
// Term consolidado por fase y Term detalle por actividad.
//
// Parámetros:
//   config         — configuración del proyecto
//   semana_viernes — clave canónica (string YYYY-MM-DD)
//   matrices       — estado actual (`_mat_datos`)
//   baseline       — baseline del ciclo activo (`ciclo.baseline`); se usa para
//                    calcular Δ piso/Δ deptos a nivel de fase y actividad.
//   ogRegistro     — registro de OG para esa semana (de `coa_hist_og_<id>`);
//                    puede ser null si nunca se ingresaron valores.

function logica_construirSnapshot(config, semana_viernes, matrices, baseline, ogRegistro) {
  const fases = logica_fasesEfectivas(config);
  const deptos = logica_listaDeptosPlana(config.departamentos || []);
  const departamentos = config.departamentos || [];

  // OG: copia directa de los m³ Real entrados durante la semana.
  const og = {
    fundaciones:  ogRegistro?.fundaciones  ?? null,
    subterraneo:  ogRegistro?.subterraneo  ?? null,
    placa:        ogRegistro?.placa        ?? null,
    nucleo:       ogRegistro?.nucleo       ?? null,
    m3_semanal:   ogRegistro?.m3_semanal   ?? null,
    m3_acumulado: ogRegistro?.m3_acumulado ?? null,
  };

  // Term Consolidado: una entrada por fase activa con los promedios de la
  // fase contra la baseline del ciclo. Reusa `logica_promediosFase`.
  const term_consolidado = {};
  fases.forEach(fase => {
    term_consolidado[fase] = logica_promediosFase(
      config, matrices, baseline, fase, deptos, departamentos
    );
  });

  // Term Actividades: una entrada por cada actividad de cada fase activa.
  // Δ contra baseline a nivel de actividad individual (no contra promedios).
  const term_actividades = [];
  fases.forEach(fase => {
    const faseKey = 'fase_' + fase;
    const nums    = logica_actividadesDeFase(config, fase);
    nums.forEach(num => {
      const piso     = logica_pisoActividad(matrices, faseKey, num, deptos, departamentos);
      const pisoBase = logica_pisoActividad(baseline,  faseKey, num, deptos, departamentos);
      const dpTerm   = logica_deptosTerminadosActividad(matrices, faseKey, num, deptos);
      const dpBase   = logica_deptosTerminadosActividad(baseline,  faseKey, num, deptos);
      const avance   = logica_avanceActividad(matrices, faseKey, num, deptos);
      term_actividades.push({
        fase,
        num,
        codigo: num,
        nombre: actividades_getNombreProyecto(config, num),
        avance,
        piso:        parseFloat(piso.toFixed(2)),
        delta_piso:  parseFloat((piso - pisoBase).toFixed(2)),
        deptos:      dpTerm,
        delta_deptos: dpTerm - dpBase,
      });
    });
  });

  // Buscar el lunes correspondiente al viernes en el schedule (lo asociamos
  // a la planificación para no depender del cálculo de "lunes anterior").
  // Si no se encuentra, se cae a usar el mismo viernes como lunes.
  const schedule = config.term_schedule || [];
  const fila = schedule.find(s => (s.fecha_termino || s.fecha) === semana_viernes);
  const semana_lunes = fila?.fecha || semana_viernes;

  return {
    semana_lunes,
    semana_viernes,
    fecha_cierre: new Date().toISOString(),
    og,
    term_consolidado,
    term_actividades,
    fotos: [],
  };
}

// ── Resumen OG a la fecha de control ─────────────────────────────────────────
// Una única fuente para los KPIs de OG. Lo consumen la hoja "Avances Obra
// Gruesa" y el gráfico de OG, así nunca se desincronizan.
// Para "Prog. Acum." y "Real Acum." se toma el último valor hasta el viernes
// de control (no el de esa semana puntual), así si la obra programada terminó
// antes, los KPIs siguen mostrando el valor final.

function logica_resumenOG(config, histOG, semanaCtrl) {
  const schedule = config?.og?.schedule || [];

  // Construir la serie acumulada del programado.
  const serieProg = schedule
    .filter(s => s && (s.fecha_termino || s.fecha) && s.m3_acumulado != null)
    .map(s => ({ fecha: s.fecha_termino || s.fecha, valor: s.m3_acumulado }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Construir la serie acumulada del real (sumando m3_semanal en orden).
  const histOrdenado = [...(histOG || [])].sort((a, b) => a.semana.localeCompare(b.semana));
  let acumReal = 0;
  const serieReal = histOrdenado.map(r => {
    acumReal += (r.m3_semanal || 0);
    return { fecha: r.semana, valor: acumReal };
  });

  // Último valor <= semanaCtrl de cada serie.
  const ultimoHasta = (serie) => {
    if (!semanaCtrl) return null;
    let v = null;
    for (const s of serie) {
      if (s.fecha <= semanaCtrl) v = s.valor;
      else break;
    }
    return v;
  };

  const progAcumCtrl = ultimoHasta(serieProg);
  const realAcumCtrl = ultimoHasta(serieReal);
  const difAcum = (realAcumCtrl != null && progAcumCtrl != null)
    ? realAcumCtrl - progAcumCtrl : null;

  const maxProgAcum = serieProg.length ? serieProg[serieProg.length - 1].valor : null;
  const pctAvance = (maxProgAcum && realAcumCtrl != null)
    ? (realAcumCtrl / maxProgAcum) * 100 : null;

  const desviacion = logica_desviacionSemanas(serieProg, serieReal, semanaCtrl);

  return {
    progAcumCtrl, realAcumCtrl, difAcum, pctAvance,
    maxProgAcum, desviacion,
  };
}

// ── Escalera OG (Fecha Término Pisos) — último piso terminado a una fecha ────
// Útil para el bloque OG del gráfico de Terminaciones y para curvas escalera.

function logica_escaleraOGActual(fechasPisos, config, semanaCtrl) {
  if (!fechasPisos || !semanaCtrl) return null;
  const sub   = config?.subterraneos || 0;
  const pisos = config?.pisos || 0;
  let maxPiso = null;
  Object.entries(fechasPisos).forEach(([key, fecha]) => {
    if (!fecha || key === 'fund_inicio') return;
    if (fecha > semanaCtrl) return;
    let y;
    if (key === 'fund_termino') y = -sub;
    else if (key === 'sm')      y = pisos + 1;
    else { y = parseInt(key); if (isNaN(y)) return; }
    if (maxPiso === null || y > maxPiso) maxPiso = y;
  });
  return maxPiso;
}

// ── Parseo de schedule pegado desde Excel ────────────────────────────────────
// Formato esperado: filas con tab-separación, primera columna = fecha, resto = valores

function logica_parsearSchedulePegado(texto) {
  // Devuelve [{fecha: 'YYYY-MM-DD', valores: [n1, n2, ...]}]
  const lineas = texto.trim().split('\n').filter(l => l.trim());
  const resultado = [];
  lineas.forEach(linea => {
    const cols = linea.split('\t').map(c => c.trim().replace(',', '.'));
    if (cols.length < 2) return;
    const fecha = _logica_parsearFecha(cols[0]);
    if (!fecha) return;
    const valores = cols.slice(1).map(v => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    });
    resultado.push({ fecha, valores });
  });
  return resultado;
}

function _logica_parsearFecha(str) {
  if (!str) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY o DD-MM-YYYY
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // MM/DD/YYYY
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    const anio = m2[3].length === 2 ? '20' + m2[3] : m2[3];
    return `${anio}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  }
  // Número serial de Excel (días desde 1900-01-01)
  const serial = parseInt(str);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

// ── Validaciones del wizard ──────────────────────────────────────────────────

function logica_validarPaso1(estado) {
  if (!estado.nombre || !estado.nombre.trim()) return 'Ingresa el nombre del proyecto';
  if (!estado.pisos || estado.pisos < 1) return 'Ingresa la cantidad de pisos';
  if (!estado.fechaInicioObra) return 'Ingresa la fecha de inicio de obra';
  return null;
}

function logica_validarPaso2(estado) {
  const total = (estado.departamentos || []).reduce((s, p) => s + (p.cantidad || 0), 0);
  if (total < 1) return 'Configura al menos un departamento';
  return null;
}

function logica_validarPaso3(estado) {
  if (!estado.actividades || estado.actividades.length < 1) return 'Selecciona al menos una actividad';
  return null;
}

// ── Helpers de fecha ─────────────────────────────────────────────────────────

function logica_semanaISO(fecha) {
  // Devuelve el lunes de la semana de la fecha (YYYY-MM-DD)
  const d = new Date(fecha + 'T00:00:00');
  const dia = d.getDay() || 7;
  d.setDate(d.getDate() - dia + 1);
  return d.toISOString().slice(0, 10);
}

function logica_formatearFecha(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

function logica_semanaLabel(isoStr) {
  // "Semana del DD/MM"
  return 'Sem. ' + logica_formatearFecha(isoStr);
}
