// Vista de inicio: grilla de proyectos.

let _proy_orden = 'antiguedad';

function proyectos_renderizarGrilla() {
  const lista = datos_listarProyectos();
  const container = document.getElementById('grilla-proyectos');
  const vacia    = document.getElementById('estado-vacio');
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = '';
    if (vacia) vacia.style.display = 'flex';
    return;
  }
  if (vacia) vacia.style.display = 'none';

  const ordenada = _proy_ordenar(lista, _proy_orden);
  container.innerHTML = ordenada.map(p => _proy_crearTarjetaHTML(p)).join('');

  container.querySelectorAll('.btn-abrir').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      router_ir('v-proyecto', { idProyecto: btn.dataset.id });
    });
  });

  container.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const config = datos_cargarProyecto(id);
      interfaz_mostrarModal(
        'Eliminar proyecto',
        `¿Eliminar "${config?.nombre || id}"? Se borrarán todos los datos permanentemente.`,
        () => {
          datos_eliminarProyecto(id);
          proyectos_renderizarGrilla();
          interfaz_mostrarToast('Proyecto eliminado.', 'aviso');
        }
      );
    });
  });

  container.querySelectorAll('.btn-exportar').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const config = datos_cargarProyecto(id);
      interfaz_mostrarModal(
        'Exportar configuración',
        `Esto exporta la configuración del proyecto "${config?.nombre || id}" (pisos, departamentos, actividades, fases).\n\nNo incluye los avances de terminaciones — esos se exportan desde dentro del proyecto con "Exportar Excel".`,
        () => {
          const json = datos_exportarRespaldo(id);
          const blob = new Blob([json], { type: 'application/json' });
          const url  = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `respaldo_${(config?.nombre || id).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      );
    });
  });
}

function proyectos_actualizarHeader(id) {
  const config = datos_cargarProyecto(id);
  if (!config) return;
  const el = document.getElementById('proyecto-nombre-header');
  if (el) el.textContent = config.nombre;
  const sub = document.getElementById('proyecto-sub-header');
  if (sub) sub.textContent = 'Avance Terminaciones';
}

function proyectos_inicializarOrden() {
  document.querySelectorAll('[data-orden]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-orden]').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      _proy_orden = btn.dataset.orden;
      proyectos_renderizarGrilla();
    });
  });

  // Importar respaldo
  document.getElementById('btn-importar')?.addEventListener('click', () => {
    interfaz_mostrarModal(
      'Importar configuración',
      'Esto importa la configuración de un proyecto (pisos, departamentos, actividades, fases) desde un archivo JSON de respaldo.\n\nNo carga avances de terminaciones — esos se importan desde dentro del proyecto con "Importar Excel".',
      () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              datos_importarRespaldo(ev.target.result);
              proyectos_renderizarGrilla();
              interfaz_mostrarToast('Respaldo importado correctamente.', 'exito');
            } catch (err) {
              interfaz_mostrarToast('Error al importar: ' + err.message, 'error');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      }
    );
  });
}

function _proy_ordenar(lista, criterio) {
  const copia = [...lista];
  if (criterio === 'alfabetico') return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL'));
  if (criterio === 'zona')       return copia.sort((a, b) => (a.zona || '').localeCompare(b.zona || '', 'es-CL') || a.nombre.localeCompare(b.nombre, 'es-CL'));
  return copia.sort((a, b) => b.creadoEn?.localeCompare(a.creadoEn || '') || 0);
}

function _proy_crearTarjetaHTML(entrada) {
  const config = datos_cargarProyecto(entrada.id);
  const fases  = config ? actividades_fasesActivas(config.actividades || []).length : 0;
  const acts   = config ? (config.actividades || []).length : 0;
  const pisos  = config ? (config.pisos || 0) : 0;
  const depts  = config ? logica_totalDepartamentos(config.departamentos || []) : 0;
  const deptsPisoTipo = config?.cantDeptosTipo || 0;
  const ubicacion  = [config?.zona, config?.comuna].filter(Boolean).join(' · ');
  const fechaObra  = config?.fechaInicioObra    ? logica_formatearFecha(config.fechaInicioObra)    : '—';
  const fechaCtrl  = config?.fechaInicioControl ? logica_formatearFecha(config.fechaInicioControl) : null;
  const fechaCreado = config?.creadoEn ? logica_formatearFecha(config.creadoEn.slice(0, 10)) : null;

  return `
  <div class="tarjeta-proyecto">
    <div class="tarjeta-header">
      <div class="tarjeta-nombre">${config?.nombre || entrada.nombre}</div>
      <button class="btn-icono btn-peligro btn-eliminar" data-id="${entrada.id}" title="Eliminar">✕</button>
    </div>
    ${ubicacion ? `<div class="tarjeta-ubicacion">📍 ${ubicacion}</div>` : ''}
    <div class="tarjeta-meta">
      <span class="meta-chip">⚡ ${fases} fases</span>
      <span class="meta-chip">🏗 ${acts} actividades</span>
    </div>
    <div class="tarjeta-meta">
      <span class="meta-chip">🏢 ${pisos} pisos</span>
      <span class="meta-chip">📦 ${depts} deptos</span>
    </div>
    ${deptsPisoTipo > 0 ? `<div class="tarjeta-detalle">Deptos piso tipo: ${deptsPisoTipo}</div>` : ''}
    <div class="tarjeta-fechas">Inicio obra: ${fechaObra}${fechaCtrl ? ` · Control: ${fechaCtrl}` : ''}</div>
    <div class="tarjeta-footer">
      <span class="tarjeta-fecha">${fechaCreado ? `Creado ${fechaCreado}` : ''}</span>
      <div class="tarjeta-acciones">
        <button class="btn-icono btn-exportar" data-id="${entrada.id}" title="Exportar respaldo">⬇</button>
        <button class="btn-primario btn-sm btn-abrir" data-id="${entrada.id}">Abrir →</button>
      </div>
    </div>
  </div>`;
}
