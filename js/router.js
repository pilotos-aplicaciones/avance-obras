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
          _router_navegar(vista, opciones);
        }
      );
      return;
    }
  }

  _router_navegar(vista, opciones);
}

function _router_navegar(vista, opciones = {}) {
  VISTAS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });

  const destino = document.getElementById(vista);
  if (!destino) return;
  destino.style.display = 'flex';
  _vistaActual = vista;

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
