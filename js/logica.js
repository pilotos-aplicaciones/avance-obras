// Lógica de negocio pura — sin DOM, sin localStorage, sin efectos secundarios.

// ── Secuencia de avance ───────────────────────────────────────────────────────

// Reordena los deptos de UN piso según la secuencia definida en la configuración.
// secuencia: array de posiciones 1-based en el orden deseado, ej. [6,5,4,3,2,1].
// Si el piso tiene menos deptos que la secuencia, se omiten las posiciones que
// no existen. Si tiene más, los extra se agregan al final en orden natural.
function logica_aplicarSecuencia(deptos, secuencia) {
  if (!secuencia || secuencia.length === 0) return deptos;
  var n = deptos.length;
  var resultado = [];
  var usados = new Set();
  secuencia.forEach(function(pos) {
    var idx = pos - 1;
    if (idx >= 0 && idx < n) {
      resultado.push(deptos[idx]);
      usados.add(idx);
    }
  });
  // Deptos del piso que quedan fuera de la secuencia (piso con más deptos que piso tipo)
  deptos.forEach(function(d, idx) {
    if (!usados.has(idx)) resultado.push(d);
  });
  return resultado;
}

// Lista plana de todos los deptos del proyecto, respetando la secuencia de avance.
// Reemplaza a logica_listaDeptosPlana cuando se necesita el orden correcto.
function logica_listaDeptosOrdenados(departamentos, secuencia) {
  if (!secuencia || secuencia.length === 0) return logica_listaDeptosPlana(departamentos);
  return departamentos.flatMap(function(p) {
    return logica_aplicarSecuencia(p.deptos || [], secuencia);
  });
}

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
  return todosDeptos.length ? parseFloat(((term / todosDeptos.length) * 100).toFixed(1)) : 0;
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
    avance:      parseFloat(avg('avance').toFixed(1)),
    piso:        r2(avg('piso')),
    deltaPiso:   r2(avg('deltaPiso')),
    deptos:      r2(avg('deptos')),
    deltaDeptos: r2(avg('deltaDeptos')),
  };
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
