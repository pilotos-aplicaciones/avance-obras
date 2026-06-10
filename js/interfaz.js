// Inicializador general y componentes reutilizables (modal, toast).

// ── Detección de dispositivo ─────────────────────────────────────────────────
// Cualquier pantalla táctil (tablet, celular, iPad) → móvil.
// Computadores sin touch → escritorio.
function interfaz_esMovil() {
  return navigator.maxTouchPoints > 0;
}

function _interfaz_aplicarModoDispositivo() {
  if (interfaz_esMovil()) {
    document.body.classList.add('modo-movil');
    document.body.classList.remove('modo-escritorio');
  } else {
    document.body.classList.add('modo-escritorio');
    document.body.classList.remove('modo-movil');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _interfaz_aplicarModoDispositivo();
  _interfaz_registrarNavegacionGlobal();
  _interfaz_registrarModal();
  _interfaz_inicializarNombreUsuario();
  router_ir('v-inicio');

  // Iniciar listener en tiempo real con Firestore.
  // Se dispara inmediatamente con el estado actual y luego cada vez que
  // cualquier proyecto cambia desde cualquier dispositivo.
  datos_iniciarListenerFirestore();

  // _coa_guardadoPendiente se pone en true al editar cualquier celda
  // y en false al confirmar "Guardar avances". Controla la visibilidad
  // del botón flotante.
  window._coa_guardadoPendiente = false;

  // Botón flotante: se muestra al marcar pendiente, dispara "Guardar avances"
  const btnFlotante = document.getElementById('btn-guardar-flotante');
  btnFlotante?.addEventListener('click', () => {
    const id = typeof router_getProyectoActivo === 'function' ? router_getProyectoActivo() : null;
    if (!id) return;
    interfaz_mostrarModal(
      'Guardar avances',
      '¿Confirmas el guardado de los avances? Los datos se sincronizarán con todos los dispositivos.',
      () => {
        datos_subirAhora(id);
        window._coa_guardadoPendiente = false;
        const btnToolbar = document.getElementById('mat-btn-guardar-avances');
        if (btnToolbar) btnToolbar.classList.remove('mat-btn-pendiente');
        interfaz_mostrarToast('Avances guardados correctamente', 'exito');
      }
    );
  });
  // Proxy para detectar cambios en _coa_guardadoPendiente y reflejarlos en el botón
  Object.defineProperty(window, '_coa_guardadoPendiente', {
    get() { return this.__coa_pend__; },
    set(v) {
      this.__coa_pend__ = v;
      const b = document.getElementById('btn-guardar-flotante');
      if (b) b.classList.toggle('visible', !!v);
      // También actualizar el botón ✓ del toolbar móvil
      const btnToolbar = document.getElementById('mat-btn-guardar-avances');
      if (btnToolbar) btnToolbar.classList.toggle('mat-btn-pendiente', !!v);
    },
    configurable: true,
  });
  window._coa_guardadoPendiente = false; // inicializar

  // ── Interceptar botón "atrás" de Android en PWA ──────────────────────────
  // Empujamos un estado al historial para que el primer "atrás" no cierre
  // la app directamente. El listener popstate lo intercepta y muestra la
  // alerta si hay cambios pendientes.
  history.pushState({ coa: 'app' }, '');
  var _ignorarProximoPopstate = false;
  window.addEventListener('popstate', function() {
    if (_ignorarProximoPopstate) { _ignorarProximoPopstate = false; return; }
    var hayPendiente = window._coa_guardadoPendiente
      || (typeof datos_proyectosConPendiente === 'function' && datos_proyectosConPendiente().length > 0);
    // Siempre re-empujamos el estado para mantener el buffer
    history.pushState({ coa: 'app' }, '');
    if (hayPendiente) {
      interfaz_mostrarModal(
        'Avances sin guardar',
        '¿Salir de la aplicación? Tienes avances sin guardar en este dispositivo.',
        function() {
          // Usuario confirma salir: sacar el estado extra y dejar cerrar
          _ignorarProximoPopstate = true;
          history.back();
          history.back(); // salir del estado extra y del inicial
        }
      );
    }
  });

  window.addEventListener('beforeunload', e => {
    // Si hay avances pendientes de guardar, advertir al cerrar
    const pendientes = typeof datos_proyectosConPendiente === 'function'
      ? datos_proyectosConPendiente() : [];
    if (pendientes.length > 0) {
      const msg = 'Tienes avances sin guardar. Los cambios quedarán guardados en este dispositivo y podrás recuperarlos al volver.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    }
  });

  // Verificar si hay avances pendientes de sesiones anteriores
  setTimeout(_interfaz_verificarPendientes, 500); // pequeño delay para que cargue Firebase primero
});

function _interfaz_verificarPendientes() {
  if (typeof datos_proyectosConPendiente !== 'function') return;
  const pendientes = datos_proyectosConPendiente();
  if (pendientes.length === 0) return;

  interfaz_mostrarModal(
    'Avances sin guardar',
    'Tenías avances sin guardar de una sesión anterior. ¿Deseas recuperarlos?',
    () => {
      // Sí: los datos ya están en localStorage, solo mostrar toast
      interfaz_mostrarToast('Avances recuperados. Recuerda guardarlos cuando termines.', 'info', 4000);
    },
    () => {
      // No: limpiar todos los pendientes
      pendientes.forEach(id => datos_limpiarPendiente(id));
      interfaz_mostrarToast('Avances descartados.', 'info');
    }
  );
}

// ── Nombre de usuario ────────────────────────────────────────────────────────

function _interfaz_inicializarNombreUsuario() {
  const nombre = datos_getNombreUsuario();

  // Actualizar todos los botones de usuario en el navbar
  _interfaz_actualizarNombreEnNavbar(nombre);

  // Registrar click en cualquier botón .navbar-usuario para editar
  document.querySelectorAll('.navbar-usuario').forEach(btn => {
    btn.addEventListener('click', interfaz_editarNombreUsuario);
  });

  // Registrar modal de nombre
  document.getElementById('modal-nombre-confirmar')?.addEventListener('click', () => {
    const input = document.getElementById('modal-nombre-input');
    const valor = (input?.value || '').trim();
    if (!valor) return;
    datos_setNombreUsuario(valor);
    _interfaz_actualizarNombreEnNavbar(valor);
    document.getElementById('modal-nombre-overlay').style.display = 'none';
    interfaz_mostrarToast('Nombre guardado: ' + valor, 'exito');
  });

  document.getElementById('modal-nombre-cancelar')?.addEventListener('click', () => {
    document.getElementById('modal-nombre-overlay').style.display = 'none';
  });

  // Permitir confirmar con Enter
  document.getElementById('modal-nombre-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('modal-nombre-confirmar')?.click();
  });

  // Si no tiene nombre configurado, pedir al abrir la app
  if (!nombre) {
    setTimeout(() => interfaz_editarNombreUsuario(true), 600);
  }

}

function _interfaz_actualizarNombreEnNavbar(nombre) {
  const display = nombre || 'Sin nombre';
  document.querySelectorAll('.navbar-usuario-nombre').forEach(el => {
    el.textContent = display;
  });
}

// Abre el modal para editar el nombre. Si esPrompt=true, no muestra botón "Ahora no".
function interfaz_editarNombreUsuario(esPrompt) {
  const overlay = document.getElementById('modal-nombre-overlay');
  const input   = document.getElementById('modal-nombre-input');
  const btnCancelar = document.getElementById('modal-nombre-cancelar');
  if (!overlay || !input) return;

  input.value = datos_getNombreUsuario();
  if (esPrompt === true) {
    if (btnCancelar) btnCancelar.style.display = 'none';
    document.querySelector('#modal-nombre-overlay .modal-titulo').textContent = '¿Cuál es tu nombre?';
  } else {
    if (btnCancelar) btnCancelar.style.display = '';
    document.querySelector('#modal-nombre-overlay .modal-titulo').textContent = 'Cambiar nombre';
  }
  overlay.style.display = 'flex';
  setTimeout(() => input.focus(), 100);
}

// ── Modal ────────────────────────────────────────────────────────────────────

function interfaz_mostrarModal(titulo, mensaje, onConfirmar, onCancelar) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-mensaje').textContent = mensaje;
  document.getElementById('modal-overlay').style.display = 'flex';

  // Reemplazar botones para evitar acumulación de listeners
  const btnConfViejo = document.getElementById('modal-confirmar');
  const btnConfNuevo = btnConfViejo.cloneNode(true);
  btnConfViejo.parentNode.replaceChild(btnConfNuevo, btnConfViejo);
  btnConfNuevo.addEventListener('click', () => {
    interfaz_cerrarModal();
    if (onConfirmar) onConfirmar();
  });

  const btnCancViejo = document.getElementById('modal-cancelar');
  const btnCancNuevo = btnCancViejo.cloneNode(true);
  btnCancViejo.parentNode.replaceChild(btnCancNuevo, btnCancViejo);
  btnCancNuevo.addEventListener('click', () => {
    interfaz_cerrarModal();
    if (onCancelar) onCancelar();
  });
}

function interfaz_cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function _interfaz_registrarModal() {
  document.getElementById('modal-cancelar')?.addEventListener('click', interfaz_cerrarModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') interfaz_cerrarModal();
  });
}

// ── Toast ────────────────────────────────────────────────────────────────────

function interfaz_mostrarToast(mensaje, tipo = 'exito', duracion = 3200) {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.className = 'toast activo toast-' + tipo;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('activo'), duracion);
}

// ── Navegación global ────────────────────────────────────────────────────────

function _interfaz_registrarNavegacionGlobal() {
  // Botón nuevo proyecto (inicio)
  document.getElementById('btn-nuevo-proyecto')?.addEventListener('click', () => {
    router_ir('v-config');
  });

  // Botón configurar desde vista proyecto
  document.getElementById('btn-config-proyecto')?.addEventListener('click', () => {
    router_ir('v-config', { esEdicion: true, idProyecto: router_getProyectoActivo() });
  });

  // Botón volver al inicio desde proyecto
  document.getElementById('btn-volver-inicio')?.addEventListener('click', () => {
    router_ir('v-inicio');
  });

  // Tabs de la vista proyecto
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      router_mostrarTab(btn.dataset.tab);
    });
  });
}

// ── Formateo de números ──────────────────────────────────────────────────────

function interfaz_fmtNum(n, decimales = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function interfaz_fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n) + '%';
}
