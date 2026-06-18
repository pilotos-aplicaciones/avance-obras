// Router centralizado — ningún módulo cambia vistas directamente.

let _vistaActual = null;
let _proyectoActivo = null;
let _tabActiva = null;

const VISTAS = ['v-inicio', 'v-config', 'v-proyecto'];
const TABS   = ['tab-term'];

function router_ir(vista, opciones = {}) {
  // Si salimos de v-proyecto, verificar si hay avances pendientes de guardar
  if (_vistaActual === 'v-proyecto' && vista !== 'v-proyecto') {
    if (_proyectoActivo && typeof datos_hayPendiente === 'function' && datos_hayPendiente(_proyectoActivo)) {
      interfaz_mostrarModal(
        'Avances sin guardar',
        '¿Salir sin guardar los avances?',
        () => {
          // Descartar cambios locales: restaurar último estado guardado oficialmente
          if (typeof datos_descartarPendiente === 'function') datos_descartarPendiente(_proyectoActivo);
          window._coa_guardadoPendiente = false;
          _router_navegar(vista, opciones);
        },
        () => {
          // Usuario canceló: re-empujar entrada para que el botón atrás siga funcionando
          history.pushState({ coa: 'v-proyecto' }, '');
        }
      );
      return;
    }
  }

  _router_navegar(vista, opciones);
}

function _router_navegar(vista, opciones = {}) {
  // Mostrar flechas solo dentro de v-proyecto; ocultar en cualquier otra vista
  if (vista !== 'v-proyecto') document.body.classList.remove('proyecto-con-fase');

  VISTAS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });

  const destino = document.getElementById(vista);
  if (!destino) return;
  destino.style.display = 'flex';
  _vistaActual = vista;

  // Gestión de historial para botón atrás de Android:
  // Solo se agrega entrada al entrar a una sub-vista (proyecto, config).
  // Al volver al inicio, la entrada ya fue consumida por el back del usuario
  // (si usó el back físico) o queda en el stack (si usó "← Inicio").
  if (vista === 'v-proyecto' || vista === 'v-config') {
    history.pushState({ coa: vista }, '');
  }

  if (vista === 'v-proyecto') {
    const id = opciones.idProyecto || _proyectoActivo;
    if (!id) { router_ir('v-inicio'); return; }
    const cambiandoProyecto = id !== _proyectoActivo;
    _proyectoActivo = id;
    proyectos_actualizarHeader(id);
    semanaCtrl_renderBarra(id);
    router_mostrarTab(opciones.tab || (cambiandoProyecto ? 'tab-term' : _tabActiva) || 'tab-term');
  }

  if (vista === 'v-config') {
    if (opciones.esEdicion && opciones.idProyecto) {
      configProyecto_iniciarEdicion(opciones.idProyecto);
    } else {
      configProyecto_iniciarNuevo();
    }
  }

  if (vista === 'v-inicio') {
    proyectos_renderizarGrilla();
  }
}

function router_mostrarTab(tab) {
  TABS.forEach(t => {
    const panel = document.getElementById('panel-' + t);
    const btn   = document.querySelector(`[data-tab="${t}"]`);
    if (panel) panel.style.display = 'none';
    if (btn)   btn.classList.remove('activo');
  });

  const panel = document.getElementById('panel-' + tab);
  const btn   = document.querySelector(`[data-tab="${tab}"]`);
  if (panel) panel.style.display = 'block';
  if (btn)   btn.classList.add('activo');
  _tabActiva = tab;

  const id = _proyectoActivo;
  if (!id) return;

  switch (tab) {
    case 'tab-term': terminaciones_inicializar(id); break;
  }
}

function router_getProyectoActivo() { return _proyectoActivo; }
function router_getVistaActual()    { return _vistaActual; }
function router_getTabActiva()      { return _tabActiva; }
