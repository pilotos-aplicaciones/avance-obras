// ── Botones de desplazamiento (cruz flotante) ───────────────────────────────
// Función NUEVA y AISLADA. No modifica ninguna lógica existente de la app.
// Agrega 4 botones (↑ ↓ ← →) en cruz, abajo a la izquierda, SOLO en móvil y
// SOLO mientras se está dentro de un proyecto. Desplazan el contenedor de la
// vista de avances (#panel-tab-term), que es el que hace scroll en móvil.
//
//   Toque rápido  → avanza un paso.
//   Mantener      → desplazamiento continuo hasta soltar.
//   Sin más contenido en una dirección → ese botón se atenúa.
//
// Para quitar esta función por completo: borrar este archivo, su <script> en
// index.html y el bloque CSS "Botones de desplazamiento" de estilos.css.

(function () {
  'use strict';

  var HOLD_DELAY = 180;  // ms para distinguir un toque de "mantener presionado"
  var VEL        = 14;   // px por frame en modo continuo

  var pad        = null;
  var btns       = {};
  var rafId      = null;
  var holdTimer  = null;
  var holdActivo = false;
  var dirActual  = null;
  var intervalo  = null;
  var scrollLigado = false;

  function getPanel() {
    return document.getElementById('panel-tab-term');
  }

  // ── Desplazamiento ──────────────────────────────────────────────────────────

  function pasoTap(dir) {
    var p = getPanel();
    if (!p) return;
    var dv  = Math.max(80, Math.round(p.clientHeight * 0.5));
    var dh  = Math.max(80, Math.round(p.clientWidth  * 0.6));
    var opt = { behavior: 'smooth' };
    if (dir === 'up')    opt.top  = -dv;
    if (dir === 'down')  opt.top  =  dv;
    if (dir === 'left')  opt.left = -dh;
    if (dir === 'right') opt.left =  dh;
    p.scrollBy(opt);
    setTimeout(recomputar, 350);
  }

  function loop() {
    var p = getPanel();
    if (!p || !dirActual) { rafId = null; return; }
    var dx = 0, dy = 0;
    if (dirActual === 'up')    dy = -VEL;
    if (dirActual === 'down')  dy =  VEL;
    if (dirActual === 'left')  dx = -VEL;
    if (dirActual === 'right') dx =  VEL;
    p.scrollBy(dx, dy);
    recomputar();
    rafId = requestAnimationFrame(loop);
  }

  function iniciarPresion(dir) {
    dirActual  = dir;
    holdActivo = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      holdActivo = true;
      if (!rafId) rafId = requestAnimationFrame(loop);
    }, HOLD_DELAY);
  }

  function terminarPresion() {
    clearTimeout(holdTimer);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (!holdActivo && dirActual) pasoTap(dirActual);
    holdActivo = false;
    dirActual  = null;
  }

  // ── Atenuado al llegar al límite ──────────────────────────────────────────────

  function recomputar() {
    var p = getPanel();
    if (!p || !pad || !pad.classList.contains('visible')) return;
    var tol = 1;
    _set(btns.up,    p.scrollTop <= tol);
    _set(btns.down,  p.scrollTop  + p.clientHeight >= p.scrollHeight - tol);
    _set(btns.left,  p.scrollLeft <= tol);
    _set(btns.right, p.scrollLeft + p.clientWidth  >= p.scrollWidth  - tol);
  }

  function _set(btn, off) {
    if (btn) btn.classList.toggle('coa-scroll-off', !!off);
  }

  // ── Construcción de los botones (una sola vez) ───────────────────────────────

  function crear() {
    if (pad) return;
    pad = document.createElement('div');
    pad.id = 'coa-scroll-pad';

    var defs = [
      ['up',    '↑', 'coa-scroll-up'],
      ['down',  '↓', 'coa-scroll-down'],
      ['left',  '←', 'coa-scroll-left'],
      ['right', '→', 'coa-scroll-right']
    ];

    defs.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'coa-scroll-btn ' + d[2];
      b.type = 'button';
      b.textContent = d[1];
      b.setAttribute('aria-label', 'Desplazar ' + d[0]);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); iniciarPresion(d[0]); });
      b.addEventListener('pointerup',   function (e) { e.preventDefault(); terminarPresion(); });
      b.addEventListener('pointercancel', terminarPresion);
      b.addEventListener('pointerleave', function () { if (dirActual === d[0]) terminarPresion(); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      btns[d[0]] = b;
      pad.appendChild(b);
    });

    document.body.appendChild(pad);

    if (!scrollLigado) {
      var p = getPanel();
      if (p) p.addEventListener('scroll', recomputar, { passive: true });
      window.addEventListener('resize', recomputar);
      window.addEventListener('orientationchange', function () { setTimeout(recomputar, 300); });
      scrollLigado = true;
    }
  }

  // ── Visibilidad: solo móvil + dentro de proyecto ─────────────────────────────

  function visibleAhora() {
    if (!document.body.classList.contains('modo-movil')) return false;
    if (typeof router_getVistaActual === 'function') {
      return router_getVistaActual() === 'v-proyecto';
    }
    var v = document.getElementById('v-proyecto');
    return !!(v && v.style.display !== 'none');
  }

  function evaluar() {
    crear();
    var mostrar = visibleAhora();
    pad.classList.toggle('visible', mostrar);
    if (mostrar) {
      recomputar();
      if (!intervalo) intervalo = setInterval(recomputar, 500);
    } else {
      if (intervalo) { clearInterval(intervalo); intervalo = null; }
      terminarPresion();
    }
  }

  // ── Arranque ──────────────────────────────────────────────────────────────────

  function init() {
    crear();
    evaluar();
    var vproj = document.getElementById('v-proyecto');
    if (vproj && window.MutationObserver) {
      new MutationObserver(evaluar).observe(vproj, { attributes: true, attributeFilter: ['style'] });
    }
    // Respaldo liviano por si cambia el modo (escritorio/móvil) en caliente.
    setInterval(evaluar, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
