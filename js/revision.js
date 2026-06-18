// ── Panel de Revisión ─────────────────────────────────────────────────────────
// Detecta posibles inconsistencias en los datos de avance.
// Usa las variables globales de terminaciones.js:
//   _mat_config, _mat_datos, _mat_fasesActivas, FASE_COLORES

// Actividades de recepción: actNum → faseRevisa (la fase que "reciben")
const _REV_RECEPCIONES = [
  { actNum: 2180, faseRevisa: 1 },
  { actNum: 3190, faseRevisa: 2 },
  { actNum: 4140, faseRevisa: 3 },
  { actNum: 5100, faseRevisa: 4 },
  { actNum: 6160, faseRevisa: 5 },
];

// Umbral de celdas incompletas para separar frente activo de rezago.
// ≤ UMBRAL_REZAGO celdas incompletas → rezago; > UMBRAL_REZAGO → frente activo.
var _REV_UMBRAL_REZAGO = 5;

// ── Punto de entrada ──────────────────────────────────────────────────────────

function revision_renderPanel() {
  var config    = _mat_config;
  var datos     = _mat_datos;
  var fases     = _mat_fasesActivas;
  var pisos     = (config.departamentos || []).filter(function(p) { return p.cantidad > 0; });
  var secuencia = config.secuenciaDeptos || [];

  var a = {
    secuenciaFases: _rev_grupoA(config, datos, fases, pisos),
    frenteTrabajo:  _rev_grupoB(config, datos, fases, pisos),
    rezagos:        _rev_grupoRezagos(config, datos, fases, pisos),
    deptosSaltados: _rev_grupoC(config, datos, fases, pisos, secuencia),
    recepciones:    _rev_grupoD(config, datos, fases, pisos),
  };

  var total = a.secuenciaFases.length + a.frenteTrabajo.length + a.rezagos.length +
              a.deptosSaltados.length + a.recepciones.length;

  if (total === 0) {
    return '<div class="rev-panel"><div class="rev-vacio">' +
           '<span style="font-size:2rem">✅</span>' +
           '<p>Sin inconsistencias detectadas.</p>' +
           '</div></div>';
  }

  return '<div class="rev-panel">' +
    _rev_renderGrupo('🔢', 'Secuencia de fases',        a.secuenciaFases.map(_rev_htmlSecuencia)) +
    _rev_renderGrupo('🏗️', 'Frente de trabajo',          a.frenteTrabajo.map(_rev_htmlFrente)) +
    _rev_renderGrupo('⏳', 'Rezagos',                   a.rezagos.map(_rev_htmlRezago)) +
    _rev_renderGrupo('⚠️', 'Departamentos saltados',     a.deptosSaltados.map(_rev_htmlSaltadoGrupo)) +
    _rev_renderGrupo('❌', 'Recepciones inconsistentes', a.recepciones.map(_rev_htmlRecepcionGrupo)) +
  '</div>';
}

// ── Helpers de render ─────────────────────────────────────────────────────────

function _rev_renderGrupo(icono, titulo, items) {
  if (items.length === 0) return '';
  return '<div class="rev-grupo">' +
    '<div class="rev-grupo-header">' +
      '<span class="rev-titulo">' + titulo + '</span>' +
      '<span class="rev-count">' + items.length + '</span>' +
    '</div>' +
    items.join('') +
  '</div>';
}

function _rev_c(fase) {
  return FASE_COLORES[fase] || { enc: '#888888', fondo: '#bbbbbb', txt: '#ffffff' };
}

function _rev_faseTag(fase, c) {
  return '<span class="rev-fase-tag" style="background:' + c.enc + '22;color:' + c.enc + '">Fase ' + fase + '</span>';
}

function _rev_chip(label, tipo, c) {
  if (tipo === 'ok')   return '<span class="rev-chip" style="background:' + c.enc + '22;color:' + c.enc + ';border-color:' + c.enc + '44">' + label + '</span>';
  if (tipo === 'skip') return '<span class="rev-chip rev-chip-skip">' + label + '</span>';
  if (tipo === 'idle') return '<span class="rev-chip rev-chip-idle">' + label + '</span>';
  return '<span class="rev-chip" style="background:' + c.enc + '15;color:' + c.enc + ';border-color:' + c.enc + '35">' + label + '</span>';
}

// Chip con badge encima indicando cantidad de deptos incompletos.
function _rev_chipBadge(label, count, c) {
  return '<span class="rev-chip-wrap">' +
    '<span class="rev-chip" style="background:' + c.enc + '15;color:' + c.enc + ';border-color:' + c.enc + '35">' + label + '</span>' +
    '<span class="rev-chip-badge" style="background:' + c.enc + '">' + count + '</span>' +
  '</span>';
}

// ── Render Grupo A — Secuencia de fases ──────────────────────────────────────

function _rev_htmlSecuencia(a) {
  var c        = _rev_c(a.faseAlta);
  var chips    = a.pisos.map(function(p) { return _rev_chip(p, 'piso', c); }).join('');
  var esPlural = a.pisos.length > 1;
  var pisosTxt = (esPlural ? 'Pisos ' : 'Piso ') + chips;
  var verbo    = esPlural ? 'tienen' : 'tiene';
  return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
    '<div class="rev-texto">' + _rev_faseTag(a.faseAlta, c) + ' ' + pisosTxt + ' — ' + verbo + ' avance sin que Fase ' + a.faseBaja + ' esté completa</div>' +
    '<div class="rev-detalle">Fase ' + a.faseBaja + ' incompleta en al menos un depto de cada piso</div>' +
  '</div>';
}

// ── Render Grupo B — Frente de trabajo ───────────────────────────────────────

function _rev_htmlFrente(a) {
  var c     = _rev_c(a.fase);
  var chips = a.pisos.map(function(p) { return _rev_chip(p, 'piso', c); }).join('');
  return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
    '<div class="rev-texto">' + _rev_faseTag(a.fase, c) + ' Abierta en <strong>' + a.pisos.length + ' pisos</strong> simultáneamente (máx. recomendado: 3)</div>' +
    '<div class="rev-detalle">Pisos con Fase ' + a.fase + ' activa: ' + chips + '</div>' +
  '</div>';
}

// ── Render Grupo Rezagos ──────────────────────────────────────────────────────

function _rev_htmlRezago(a) {
  var c     = _rev_c(a.fase);
  var chips = a.pisos.map(function(item) {
    return _rev_chipBadge('Piso ' + item.piso, item.deptosInc, c);
  }).join('');
  var n = a.pisos.length;
  return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
    '<div class="rev-texto">' + _rev_faseTag(a.fase, c) + ' ' + n + ' ' + (n === 1 ? 'piso' : 'pisos') + ' con actividades puntuales sin completar</div>' +
    '<div class="rev-detalle" style="padding-top:6px">' + chips + '</div>' +
  '</div>';
}

// ── Render Grupo C — Departamentos saltados (agrupado por fase) ───────────────

function _rev_htmlSaltadoGrupo(a) {
  var c      = _rev_c(a.fase);
  var n      = a.pisosData.length;
  var txt    = n === 1 ? '1 piso' : n + ' pisos';

  var filasHtml = a.pisosData.map(function(pd) {
    var saltSet = new Set(pd.saltados);
    var seqHtml = pd.deptosSec.map(function(item) {
      if (saltSet.has(item.depto)) return _rev_chip(item.depto, 'skip', c);
      if (item.avg > 0)            return _rev_chip(item.depto, 'ok',   c);
      return                              _rev_chip(item.depto, 'idle', c);
    }).join('<span class="rev-arr">›</span>');
    return '<div class="rev-fila"><span class="rev-piso-lbl">Piso ' + pd.piso + '</span>' + seqHtml + '</div>';
  }).join('');

  var leyenda = '<div class="rev-legend rev-legend-sep">' +
    '<span><span class="rev-legend-sq" style="background:' + c.enc + '30;border-color:' + c.enc + '55"></span> Con avance</span>' +
    '<span><span class="rev-legend-sq rev-legend-skip"></span> Saltados</span>' +
    '<span><span class="rev-legend-sq rev-legend-idle"></span> Sin iniciar</span>' +
  '</div>';

  return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
    '<div class="rev-texto">' + _rev_faseTag(a.fase, c) + ' ' + txt + ' con deptos sin avance entre deptos que ya iniciaron</div>' +
    '<div class="rev-detalle" style="margin-top:6px">' + filasHtml + leyenda + '</div>' +
  '</div>';
}

// ── Render Grupo D — Recepciones inconsistentes (agrupado por tipo+fase) ─────

function _rev_htmlRecepcionGrupo(a) {
  // c usa faseRecep (donde vive la actividad y donde el usuario debe ir a marcarla)
  var c = _rev_c(a.faseRecep);

  if (a.tipo === 1) {
    // Hay actividades incompletas en varios deptos → badge con conteo
    var chipsT1 = a.pisos.map(function(item) {
      return _rev_chipBadge('Piso ' + item.piso, item.deptosInc, c);
    }).join('');
    return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
      '<div class="rev-texto">' + _rev_faseTag(a.faseRecep, c) + ' "Recepción Fase ' + a.faseRevisa + '" al 100% pero hay actividades sin terminar en Fase ' + a.faseRevisa + '</div>' +
      '<div class="rev-detalle" style="padding-top:6px">' + chipsT1 + '</div>' +
    '</div>';
  }

  // Tipo 2: solo falta marcar la recepción → chip simple sin badge
  var chipsT2 = a.pisos.map(function(item) {
    return _rev_chip('Piso ' + item.piso, 'piso', c);
  }).join('');
  return '<div class="rev-alerta" style="border-left-color:' + c.enc + '">' +
    '<div class="rev-texto">' + _rev_faseTag(a.faseRecep, c) + ' "Recepción Fase ' + a.faseRevisa + '" sin avances — las actividades de Fase ' + a.faseRevisa + ' están al 100%</div>' +
    '<div class="rev-detalle">' + chipsT2 + '</div>' +
  '</div>';
}

// ── Lógica — Grupo A: Secuencia de fases ─────────────────────────────────────
// Alerta cuando hay avance en Fase N+1 pero Fase N todavía no está completa.
// Solo alerta si la inconsistencia supera el umbral de celdas (casos aislados
// como montacargas o arriostramiento no deben generar alerta).

function _rev_grupoA(config, datos, fases, pisos) {
  var alertas = [];
  for (var i = 1; i < fases.length; i++) {
    var faseAlta = fases[i];
    var faseBaja = fases[i - 1];
    var actsAlta = logica_actividadesDeFase(config, faseAlta);
    var actsBaja = logica_actividadesDeFase(config, faseBaja);
    var celAlta  = datos['fase_' + faseAlta] || {};
    var celBaja  = datos['fase_' + faseBaja] || {};
    var pisosAfectados = [];
    pisos.forEach(function(p) {
      var celdasInc = 0;
      (p.deptos || []).forEach(function(d) {
        var tieneAlta = actsAlta.some(function(n) { return (celAlta[d + '_' + n] || 0) > 0; });
        if (!tieneAlta) return;
        actsBaja.forEach(function(n) {
          if ((celBaja[d + '_' + n] || 0) < 100) celdasInc++;
        });
      });
      if (celdasInc > _REV_UMBRAL_REZAGO) pisosAfectados.push(p.piso);
    });
    if (pisosAfectados.length > 0) alertas.push({ faseAlta: faseAlta, faseBaja: faseBaja, pisos: pisosAfectados });
  }
  return alertas;
}

// ── Lógica — Grupo B: Frente de trabajo ──────────────────────────────────────
// Pisos con más de _REV_UMBRAL_REZAGO celdas incompletas → frente activo.
// Alerta cuando hay más de 3 pisos activos en la misma fase.

function _rev_grupoB(config, datos, fases, pisos) {
  var alertas = [];
  var LIMITE  = 3;
  fases.forEach(function(fase) {
    var acts   = logica_actividadesDeFase(config, fase);
    var celdas = datos['fase_' + fase] || {};
    var pisosActivos = [];
    pisos.forEach(function(p) {
      var celdasInc      = 0;
      var algunaIniciada = false;
      (p.deptos || []).forEach(function(d) {
        acts.forEach(function(n) {
          var v = celdas[d + '_' + n] || 0;
          if (v > 0)   algunaIniciada = true;
          if (v < 100) celdasInc++;
        });
      });
      if (algunaIniciada && celdasInc > _REV_UMBRAL_REZAGO) pisosActivos.push(p.piso);
    });
    if (pisosActivos.length > LIMITE) alertas.push({ fase: fase, pisos: pisosActivos });
  });
  return alertas;
}

// ── Lógica — Grupo Rezagos ────────────────────────────────────────────────────
// Pisos con entre 1 y _REV_UMBRAL_REZAGO celdas incompletas → rezago puntual.

function _rev_grupoRezagos(config, datos, fases, pisos) {
  var alertas = [];
  fases.forEach(function(fase) {
    var acts   = logica_actividadesDeFase(config, fase);
    var celdas = datos['fase_' + fase] || {};
    var pisosRezago = [];
    pisos.forEach(function(p) {
      var celdasInc      = 0;
      var deptosInc      = 0;
      var algunaIniciada = false;
      (p.deptos || []).forEach(function(d) {
        var deptoTieneInc = false;
        acts.forEach(function(n) {
          var v = celdas[d + '_' + n] || 0;
          if (v > 0)   algunaIniciada = true;
          if (v < 100) { celdasInc++; deptoTieneInc = true; }
        });
        if (deptoTieneInc) deptosInc++;
      });
      if (algunaIniciada && celdasInc > 0 && celdasInc <= _REV_UMBRAL_REZAGO && deptosInc > 0) {
        pisosRezago.push({ piso: p.piso, deptosInc: deptosInc });
      }
    });
    if (pisosRezago.length > 0) alertas.push({ fase: fase, pisos: pisosRezago });
  });
  return alertas;
}

// ── Lógica — Grupo C: Departamentos saltados (agrupado por fase) ──────────────
// Depto con avg=0 que tiene deptos posteriores en la secuencia ya iniciados.

function _rev_grupoC(config, datos, fases, pisos, secuencia) {
  var porFase = {};
  fases.forEach(function(fase) {
    var acts   = logica_actividadesDeFase(config, fase);
    var celdas = datos['fase_' + fase] || {};
    pisos.forEach(function(p) {
      var deptosSec = logica_aplicarSecuencia(p.deptos || [], secuencia);
      var avances   = deptosSec.map(function(d) {
        var vals = acts.map(function(n) { return celdas[d + '_' + n] || 0; });
        var avg  = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
        return { depto: d, avg: avg };
      });
      var saltados = [];
      for (var i = 0; i < avances.length; i++) {
        if (avances[i].avg > 0) continue;
        var hayPosterior = avances.slice(i + 1).some(function(x) { return x.avg > 0; });
        if (hayPosterior) saltados.push(avances[i].depto);
      }
      if (saltados.length > 0) {
        if (!porFase[fase]) porFase[fase] = { fase: fase, pisosData: [] };
        porFase[fase].pisosData.push({ piso: p.piso, deptosSec: avances, saltados: saltados });
      }
    });
  });
  return Object.keys(porFase).map(function(k) { return porFase[k]; });
}

// ── Lógica — Grupo D: Recepciones inconsistentes (agrupado por tipo+fase) ────
// Tipo 1: Recepción al 100% pero la fase revisada tiene actividades < 100%.
// Tipo 2: Todas las actividades al 100% pero la recepción está a 0%.

function _rev_grupoD(config, datos, fases, pisos) {
  var porClave = {};
  _REV_RECEPCIONES.forEach(function(r) {
    var faseBaja = r.faseRevisa;
    if (fases.indexOf(faseBaja) === -1) return;
    var faseRecep = null;
    for (var fi = 0; fi < fases.length; fi++) {
      if (logica_actividadesDeFase(config, fases[fi]).indexOf(r.actNum) !== -1) {
        faseRecep = fases[fi];
        break;
      }
    }
    if (!faseRecep) return;
    var actsBaja = logica_actividadesDeFase(config, faseBaja);
    if (actsBaja.length === 0) return;
    var celBaja  = datos['fase_' + faseBaja]  || {};
    var celRecep = datos['fase_' + faseRecep] || {};
    pisos.forEach(function(p) {
      var caso1 = [], caso2 = [];
      (p.deptos || []).forEach(function(d) {
        var valRecep    = celRecep[d + '_' + r.actNum] || 0;
        var bajIncomp   = actsBaja.some(function(n)  { return (celBaja[d + '_' + n] || 0) < 100; });
        var todosAlCien = actsBaja.every(function(n) { return (celBaja[d + '_' + n] || 0) === 100; });
        if (valRecep === 100 && bajIncomp) caso1.push(d);
        if (todosAlCien && valRecep === 0) caso2.push(d);
      });
      if (caso1.length > 0) {
        var k1 = '1_' + faseBaja;
        if (!porClave[k1]) porClave[k1] = { tipo: 1, faseRevisa: faseBaja, faseRecep: faseRecep, actNum: r.actNum, pisos: [] };
        porClave[k1].pisos.push({ piso: p.piso, deptosInc: caso1.length });
      }
      if (caso2.length > 0) {
        var k2 = '2_' + faseBaja;
        if (!porClave[k2]) porClave[k2] = { tipo: 2, faseRevisa: faseBaja, faseRecep: faseRecep, actNum: r.actNum, pisos: [] };
        porClave[k2].pisos.push({ piso: p.piso, deptosInc: caso2.length });
      }
    });
  });
  return Object.keys(porClave).map(function(k) { return porClave[k]; });
}
