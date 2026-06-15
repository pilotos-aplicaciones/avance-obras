// Wizard de creación/edición de proyecto (4 pasos).

let _cf = {};
let _cf_paso = 1;
let _cf_modoEdicion = false;

function configProyecto_iniciarNuevo() {
  _cf = {
    id: datos_generarId(),
    nombre: '', zona: '', comuna: '',
    pisos: 0, subterraneos: 0, cantDeptosTipo: 0,
    fechaInicioObra: '', fechaInicioControl: '',
    departamentos: [],
    actividades: CATALOGO_ACTIVIDADES.map(a => a.numero),
    ordenActividades: actividades_construirOrden(CATALOGO_ACTIVIDADES.map(a => a.numero)),
    og: { m3_total: 0, schedule: [] },
    term_schedule: [],
    responsables: [],
    nombresActividades: {},
    actividadesCustom: [],
  };
  _cf_modoEdicion = false;
  _cf_paso = 1;
  _cf_renderizar();
}

function configProyecto_iniciarEdicion(id) {
  const p = datos_cargarProyecto(id);
  if (!p) { router_ir('v-inicio'); return; }
  _cf = JSON.parse(JSON.stringify(p));
  if (!_cf.og) _cf.og = { m3_total: 0, schedule: [] };
  if (!_cf.term_schedule) _cf.term_schedule = [];
  if (!_cf.responsables) _cf.responsables = [];
  if (!('cantDeptosTipo' in _cf)) _cf.cantDeptosTipo = 0;
  if (!_cf.nombresActividades) _cf.nombresActividades = {};
  if (!_cf.actividadesCustom) _cf.actividadesCustom = [];
  _cf_modoEdicion = true;
  _cf_paso = 1;
  _cf_renderizar();
}

// ── Renderizado principal ────────────────────────────────────────────────────

function _cf_renderizar() {
  _cf_renderizarIndicador();
  _cf_renderizarPaso();
  _cf_renderizarBotones();
}

function _cf_renderizarIndicador() {
  for (let i = 1; i <= 4; i++) {
    const el = document.querySelector(`.paso-num[data-paso="${i}"]`);
    if (!el) continue;
    el.classList.toggle('activo',    i === _cf_paso);
    el.classList.toggle('completado', i < _cf_paso);
  }
}

function _cf_renderizarBotones() {
  const btnAnterior = document.getElementById('cf-btn-anterior');
  const btnSiguiente = document.getElementById('cf-btn-siguiente');
  const btnGuardar = document.getElementById('cf-btn-guardar');
  if (btnAnterior)  btnAnterior.style.display  = _cf_paso > 1 ? 'inline-flex' : 'none';
  if (btnSiguiente) btnSiguiente.style.display = _cf_paso < 4 ? 'inline-flex' : 'none';
  if (btnGuardar)   btnGuardar.style.display   = _cf_paso === 4 ? 'inline-flex' : 'none';
  if (btnGuardar)   btnGuardar.textContent = _cf_modoEdicion ? '✓ Guardar cambios' : '✓ Crear proyecto';
}

function _cf_renderizarPaso() {
  const contenedor = document.getElementById('cf-contenido');
  if (!contenedor) return;
  const fn = [null, _cf_paso1, _cf_paso2, _cf_paso3, _cf_paso4][_cf_paso];
  if (fn) contenedor.innerHTML = fn();
  _cf_registrarEventosPaso();
}

// ── Paso 1: Datos generales ──────────────────────────────────────────────────

function _cf_paso1() {
  return `
  <div class="cf-seccion">
    <h3>Datos generales</h3>
    <div class="cf-grid-2">
      <div class="campo">
        <label>Nombre del proyecto <span class="req">*</span></label>
        <input id="cf-nombre" type="text" value="${_cf.nombre}" placeholder="Ej: Edificio Alameda 1234">
      </div>
      <div class="campo">
        <label>Zona</label>
        <input id="cf-zona" type="text" value="${_cf.zona}" placeholder="Ej: Santiago Centro">
      </div>
      <div class="campo">
        <label>Comuna</label>
        <input id="cf-comuna" type="text" value="${_cf.comuna}" placeholder="Ej: Santiago">
      </div>
      <div class="campo">
        <label>Pisos totales (sobre 0) <span class="req">*</span></label>
        <input id="cf-pisos" type="number" min="1" max="60" value="${_cf.pisos || ''}">
      </div>
      <div class="campo">
        <label>Subterráneos</label>
        <input id="cf-sub" type="number" min="0" max="10" value="${_cf.subterraneos || 0}">
      </div>
      <div class="campo">
        <label>Fecha inicio obra <span class="req">*</span></label>
        <input id="cf-fecha-obra" type="date" value="${_cf.fechaInicioObra}">
      </div>
      <div class="campo">
        <label>Fecha inicio control</label>
        <input id="cf-fecha-control" type="date" value="${_cf.fechaInicioControl}">
      </div>
    </div>
  </div>`;
}

// ── Paso 2: Departamentos por piso ──────────────────────────────────────────

function _cf_paso2() {
  const pisos = _cf.pisos || 0;
  const rows  = [];

  // Solo pisos sobre nivel 0 (sin subterráneos)
  const listaPisos = [];
  for (let p = 1; p <= pisos; p++) listaPisos.push(p);

  // Eliminar entradas fuera de rango (subterráneos viejos o pisos reducidos)
  _cf.departamentos = _cf.departamentos.filter(d => listaPisos.includes(d.piso));

  // Asegurar que _cf.departamentos tiene entrada por cada piso
  listaPisos.forEach(p => {
    if (!_cf.departamentos.find(d => d.piso === p)) {
      _cf.departamentos.push({ piso: p, cantidad: 0, deptos: [] });
    }
  });

  listaPisos.forEach(p => {
    const entry = _cf.departamentos.find(d => d.piso === p) || { piso: p, cantidad: 0 };
    rows.push(`
      <tr>
        <td>Piso ${p}</td>
        <td><input class="input-cant-depto" data-piso="${p}" type="number" min="0" max="20" value="${entry.cantidad || 0}"></td>
        <td class="preview-depto" id="prev-${p}"></td>
      </tr>`);
  });

  return `
  <div class="cf-seccion">
    <h3>Departamentos por piso</h3>
    <div class="cf-tipo-top">
      <label class="cf-tipo-label">Departamentos piso tipo</label>
      <input id="cf-input-deptos-tipo" type="number" min="0" max="20"
             value="${_cf.cantDeptosTipo || 0}" class="cf-tipo-input">
      <button id="btn-aplicar-tipo" class="btn-secundario btn-sm">Aplicar a todos →</button>
    </div>
    <div class="tabla-scroll">
      <table class="tabla-deptos">
        <thead><tr><th>Piso</th><th>Cantidad deptos</th><th>Nomenclaturas</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <div id="cf-total-deptos" class="cf-resumen-fila"></div>
  </div>`;
}

function _cf_actualizarPreviewDeptos() {
  const total = _cf.departamentos.reduce((s, p) => s + p.cantidad, 0);
  const el = document.getElementById('cf-total-deptos');
  if (el) el.textContent = `Total: ${total} departamento${total !== 1 ? 's' : ''}`;

  _cf.departamentos.forEach(entry => {
    const prev = document.getElementById('prev-' + entry.piso);
    if (!prev) return;
    prev.innerHTML = entry.deptos.slice(0, 8).map(d => `<span class="chip-depto">${d}</span>`).join('') +
      (entry.deptos.length > 8 ? `<span class="chip-depto">+${entry.deptos.length - 8}</span>` : '');
  });
}

// ── Paso 3: Actividades ──────────────────────────────────────────────────────

function _cf_paso3() {
  const fases = [1, 2, 3, 4, 5, 6];
  const bloques = fases.map(fase => {
    const color = FASE_COLORES[fase];
    const actsEnFase = logica_actividadesDeFase(_cf, fase);
    const actsDelCatalogo = actividades_porFase(fase);

    // Actividades en orden efectivo para esta fase (puede incluir reasignadas de otras)
    const enOrden = logica_ordenEfectivo(_cf).filter(o => o.faseEfectiva === fase);

    const numerosCustom = new Set((_cf.actividadesCustom || []).map(function(c) { return c.numero; }));

    const items = enOrden.map((o, idx) => {
      const checked    = _cf.actividades.includes(o.numero) ? 'checked' : '';
      const nombre     = actividades_getNombreProyecto(_cf, o.numero);
      const nombreAttr = nombre.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const esCustom   = numerosCustom.has(o.numero);
      const codigoDisp = actividades_getCodigoDisplay(_cf, o.numero);
      const codigoAttr = codigoDisp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `
      <div class="act-item${esCustom ? ' act-item-custom' : ''}" data-num="${o.numero}" data-fase="${o.faseEfectiva}" data-pos="${o.posicion}">
        <input type="checkbox" class="chk-act" data-num="${o.numero}" ${checked}>
        ${esCustom
          ? `<input type="text" class="act-codigo act-codigo-input" data-num="${o.numero}" value="${codigoAttr}" maxlength="10" title="Editar código">`
          : `<span class="act-codigo">${codigoDisp}</span>`
        }
        <input type="text" class="act-nombre-input" data-num="${o.numero}" value="${nombreAttr}" title="Clic para editar">
        <div class="act-controles">
          <button class="btn-mover" data-dir="up" data-num="${o.numero}" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-mover" data-dir="dn" data-num="${o.numero}" ${idx === enOrden.length - 1 ? 'disabled' : ''}>▼</button>
          <select class="sel-fase" data-num="${o.numero}">
            ${[1,2,3,4,5,6].map(f => `<option value="${f}" ${f === fase ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
          ${esCustom ? `<button class="btn-eliminar-custom" data-num="${o.numero}" title="Eliminar actividad">✕</button>` : ''}
        </div>
        <span class="act-drag-handle" draggable="true" title="Arrastrar para reordenar">⋮⋮</span>
      </div>`;
    });

    // Actividades del catálogo no asignadas a esta fase (para "agregar")
    const noAsignadas = actsDelCatalogo.filter(a => !enOrden.find(o => o.numero === a.numero));

    return `
    <div class="bloque-fase" style="--fase-enc:${color.enc};--fase-fondo:${color.fondo}">
      <div class="bloque-fase-header">
        <span class="fase-titulo">${NOMBRES_FASES[fase]}</span>
        <div class="fase-controles">
          <button class="btn-todas btn-sm" data-fase="${fase}">Todas</button>
          <button class="btn-ninguna btn-sm" data-fase="${fase}">Ninguna</button>
        </div>
      </div>
      <div class="acts-cabecera">
        <span class="cab-spacer-chk"></span>
        <span class="cab-codigo">Código</span>
        <span class="cab-actividad">Actividad</span>
      </div>
      <div class="acts-lista" id="acts-fase-${fase}" data-fase="${fase}">${items.join('')}</div>
      <div class="act-agregar-wrap">
        <button class="btn-agregar-custom btn-sm" data-fase="${fase}">+ Actividad</button>
        <div class="act-agregar-form" style="display:none" data-fase="${fase}">
          <input type="text" class="act-agregar-codigo" placeholder="Cód." maxlength="10" title="Código de la actividad (ej. C1)">
          <input type="text" class="act-agregar-input" placeholder="Nombre de la actividad" maxlength="80">
          <button class="btn-primario btn-sm act-agregar-confirmar" data-fase="${fase}">Agregar</button>
          <button class="btn-secundario btn-sm act-agregar-cancelar">Cancelar</button>
        </div>
      </div>
    </div>`;
  });

  return `<div class="cf-seccion">
    <h3>Actividades que aplican</h3>
    <p class="cf-hint">Selecciona las actividades para este proyecto. Puedes reordenarlas y reasignar fases.</p>
    ${bloques.join('')}
  </div>`;
}

// ── Paso 4: Programaciones ───────────────────────────────────────────────────

function _cf_paso4() {
  return `
  <div class="cf-seccion cf-paso-nodisp">
    <h3>Programación planificada</h3>
    <div class="cf-nodisp-aviso">
      <span class="cf-nodisp-icono">🔒</span>
      <div>
        <p class="cf-nodisp-titulo">No disponible en versión de prueba</p>
        <p class="cf-hint">Esta función permite importar la planificación inicial del proyecto (curvas programadas de Obra Gruesa y Terminaciones). Se habilitará en la versión completa de la plataforma.</p>
      </div>
    </div>
  </div>`;
}

// ── Registro de eventos por paso ─────────────────────────────────────────────

function _cf_registrarEventosPaso() {
  if (_cf_paso === 1) {
    ['nombre','zona','comuna'].forEach(campo => {
      document.getElementById(`cf-${campo}`)?.addEventListener('input', e => { _cf[campo === 'nombre' ? 'nombre' : campo] = e.target.value; });
    });
    document.getElementById('cf-pisos')?.addEventListener('change', e => { _cf.pisos = parseInt(e.target.value) || 0; });
    document.getElementById('cf-sub')?.addEventListener('change', e => { _cf.subterraneos = parseInt(e.target.value) || 0; });
    document.getElementById('cf-fecha-obra')?.addEventListener('change', e => { _cf.fechaInicioObra = e.target.value; });
    document.getElementById('cf-fecha-control')?.addEventListener('change', e => { _cf.fechaInicioControl = e.target.value; });
  }

  if (_cf_paso === 2) {
    document.querySelectorAll('.input-cant-depto').forEach(input => {
      input.addEventListener('input', e => {
        const piso  = parseInt(e.target.dataset.piso);
        const cant  = parseInt(e.target.value) || 0;
        const entry = _cf.departamentos.find(d => d.piso === piso);
        if (entry) {
          entry.cantidad = cant;
          entry.deptos   = [];
          for (let i = 1; i <= cant; i++) entry.deptos.push(logica_generarNomenclatura(piso, i));
        }
        _cf_actualizarPreviewDeptos();
      });
    });
    document.getElementById('cf-input-deptos-tipo')?.addEventListener('input', e => {
      _cf.cantDeptosTipo = parseInt(e.target.value) || 0;
    });
    document.getElementById('btn-aplicar-tipo')?.addEventListener('click', () => {
      const cant = _cf.cantDeptosTipo;
      if (!cant) return;
      _cf.departamentos.forEach(entry => {
        entry.cantidad = cant;
        entry.deptos = [];
        for (let i = 1; i <= cant; i++) entry.deptos.push(logica_generarNomenclatura(entry.piso, i));
        const inp = document.querySelector(`.input-cant-depto[data-piso="${entry.piso}"]`);
        if (inp) inp.value = cant;
      });
      _cf_actualizarPreviewDeptos();
    });
    _cf_actualizarPreviewDeptos();
  }

  if (_cf_paso === 3) {
    document.querySelectorAll('.chk-act').forEach(chk => {
      chk.addEventListener('change', e => {
        const num = parseInt(e.target.dataset.num);
        if (e.target.checked) {
          if (!_cf.actividades.includes(num)) _cf.actividades.push(num);
        } else {
          _cf.actividades = _cf.actividades.filter(n => n !== num);
        }
        _cf.ordenActividades = actividades_sincronizarOrden(_cf.ordenActividades, _cf.actividades);
      });
    });

    // Editar nombre de actividad: guarda nombre custom por proyecto.
    // - Si queda vacío o coincide con el default, se elimina del custom (no se
    //   almacena data redundante) y se restaura el nombre por defecto en pantalla.
    document.querySelectorAll('.act-nombre-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const num         = parseInt(e.target.dataset.num);
        const valor       = e.target.value.trim();
        const porDefecto  = actividades_getNombre(num);
        if (!_cf.nombresActividades) _cf.nombresActividades = {};
        if (!valor || valor === porDefecto) {
          delete _cf.nombresActividades[num];
          if (!valor) e.target.value = porDefecto;
        } else {
          _cf.nombresActividades[num] = valor;
        }
      });
    });

    document.querySelectorAll('.btn-mover').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        const dir = btn.dataset.dir;
        const o   = _cf.ordenActividades.find(x => x.numero === num);
        if (!o) return;
        const siblings = _cf.ordenActividades.filter(x => x.faseEfectiva === o.faseEfectiva)
          .sort((a, b) => a.posicion - b.posicion);
        const idx = siblings.findIndex(x => x.numero === num);
        const swap = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1];
        if (!swap) return;
        [o.posicion, swap.posicion] = [swap.posicion, o.posicion];
        _cf_renderizar();
      });
    });

    document.querySelectorAll('.sel-fase').forEach(sel => {
      sel.addEventListener('change', e => {
        const num       = parseInt(e.target.dataset.num);
        const nuevaFase = parseInt(e.target.value);
        const o = _cf.ordenActividades.find(x => x.numero === num);
        if (!o) return;
        o.faseEfectiva = nuevaFase;
        const enNueva = _cf.ordenActividades.filter(x => x.faseEfectiva === nuevaFase && x.numero !== num);
        o.posicion = enNueva.length;
        _cf_renderizar();
      });
    });

    // ── Drag & drop de actividades (solo desde el handle ⋮⋮) ──────────────
    _cf_registrarDragActividades();

    document.querySelectorAll('.btn-todas').forEach(btn => {
      btn.addEventListener('click', () => {
        const fase = parseInt(btn.dataset.fase);
        // Incluir actividades del catálogo Y actividades custom de esta fase
        const todasEnFase = logica_actividadesDeFase(_cf, fase);
        actividades_porFase(fase).forEach(a => {
          if (!todasEnFase.includes(a.numero)) todasEnFase.push(a.numero);
        });
        todasEnFase.forEach(num => {
          if (!_cf.actividades.includes(num)) _cf.actividades.push(num);
        });
        _cf.ordenActividades = actividades_sincronizarOrden(_cf.ordenActividades, _cf.actividades);
        _cf_renderizar();
      });
    });

    document.querySelectorAll('.btn-ninguna').forEach(btn => {
      btn.addEventListener('click', () => {
        const fase = parseInt(btn.dataset.fase);
        // Excluir actividades del catálogo Y actividades custom de esta fase
        const todasEnFase = new Set(logica_actividadesDeFase(_cf, fase));
        actividades_porFase(fase).forEach(a => todasEnFase.add(a.numero));
        _cf.actividades = _cf.actividades.filter(n => !todasEnFase.has(n));
        _cf.ordenActividades = actividades_sincronizarOrden(_cf.ordenActividades, _cf.actividades);
        _cf_renderizar();
      });
    });

    // ── Eliminar actividad custom ────────────────────────────────────────────
    document.querySelectorAll('.btn-eliminar-custom').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.num);
        const nombre = actividades_getNombreProyecto(_cf, num);
        interfaz_mostrarModal(
          'Eliminar actividad',
          '¿Eliminar la actividad "' + nombre + '"? Se perderán los avances registrados para esta actividad.',
          () => {
            _cf_eliminarActividadCustom(num);
            _cf_renderizar();
          }
        );
      });
    });

    // ── Formulario "+ Actividad" por fase ────────────────────────────────────
    document.querySelectorAll('.btn-agregar-custom').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.act-agregar-wrap');
        if (!wrap) return;
        btn.style.display = 'none';
        const form = wrap.querySelector('.act-agregar-form');
        if (form) {
          form.style.display = 'flex';
          // Pre-llenar código sugerido y limpiar nombre
          const inpCod = form.querySelector('.act-agregar-codigo');
          const inpNom = form.querySelector('.act-agregar-input');
          const faseSug = parseInt(btn.dataset.fase);
          if (inpCod) inpCod.value = _cf_siguienteCodigoCustom(faseSug);
          if (inpNom) { inpNom.value = ''; setTimeout(() => inpNom.focus(), 50); }
        }
      });
    });

    document.querySelectorAll('.act-agregar-cancelar').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.act-agregar-wrap');
        if (!wrap) return;
        const form = wrap.querySelector('.act-agregar-form');
        const btnAgregar = wrap.querySelector('.btn-agregar-custom');
        if (form) form.style.display = 'none';
        if (btnAgregar) btnAgregar.style.display = '';
      });
    });

    document.querySelectorAll('.act-agregar-confirmar').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.act-agregar-wrap');
        if (!wrap) return;
        const inpCod = wrap.querySelector('.act-agregar-codigo');
        const inpNom = wrap.querySelector('.act-agregar-input');
        const codigo = (inpCod ? inpCod.value : '').trim() || _cf_siguienteCodigoCustom(fase);
        const nombre = (inpNom ? inpNom.value : '').trim();
        if (!nombre) { interfaz_mostrarToast('Ingresa un nombre para la actividad.', 'error'); return; }
        const fase = parseInt(btn.dataset.fase);
        _cf_agregarActividadCustom(fase, codigo, nombre);
        _cf_renderizar();
      });
    });

    // Enter en el input de nombre confirma; Escape cancela
    document.querySelectorAll('.act-agregar-input, .act-agregar-codigo').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inp.closest('.act-agregar-form')?.querySelector('.act-agregar-confirmar')?.click();
        }
        if (e.key === 'Escape') {
          inp.closest('.act-agregar-form')?.querySelector('.act-agregar-cancelar')?.click();
        }
      });
    });

    // Guardar cambios en el código de actividades custom
    document.querySelectorAll('.act-codigo-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const num    = parseInt(e.target.dataset.num);
        const valor  = e.target.value.trim();
        if (!valor) { e.target.value = actividades_getCodigoDisplay(_cf, num); return; }
        const custom = (_cf.actividadesCustom || []).find(function(c) { return c.numero === num; });
        if (custom) custom.codigo = valor;
      });
    });
  }

  // Paso 4: no disponible en versión de prueba — sin eventos que registrar.
}

// ── Drag & drop de actividades en Paso 3 ─────────────────────────────────────
// El arrastre se inicia SOLO desde el handle ⋮⋮. Soltar sobre otra actividad
// inserta la fuente justo antes de ella; soltar sobre el espacio vacío de un
// bloque de fase la pone al final de esa fase. Cambiar de fase se permite.

function _cf_registrarDragActividades() {
  let _src = null; // {numero, fase} de la actividad que se está arrastrando

  // Origen: handle de cada actividad
  document.querySelectorAll('.act-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', e => {
      const item = handle.closest('.act-item');
      if (!item) return;
      _src = {
        numero: parseInt(item.dataset.num),
        fase:   parseInt(item.dataset.fase),
      };
      item.classList.add('act-arrastrando');
      e.dataTransfer.effectAllowed = 'move';
      // Necesario para Firefox: setData con algún valor.
      try { e.dataTransfer.setData('text/plain', String(_src.numero)); } catch (_) {}
    });
    handle.addEventListener('dragend', () => {
      document.querySelectorAll('.act-arrastrando').forEach(el => el.classList.remove('act-arrastrando'));
      document.querySelectorAll('.act-drop-target').forEach(el => el.classList.remove('act-drop-target'));
      document.querySelectorAll('.acts-lista-drop').forEach(el => el.classList.remove('acts-lista-drop'));
      _src = null;
    });
  });

  // Destinos posibles: otras actividades (insertar antes) y la lista misma (al final)
  document.querySelectorAll('.act-item').forEach(item => {
    item.addEventListener('dragover', e => {
      if (!_src) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.act-drop-target').forEach(el => el.classList.remove('act-drop-target'));
      if (parseInt(item.dataset.num) !== _src.numero) {
        item.classList.add('act-drop-target');
      }
    });
    item.addEventListener('drop', e => {
      if (!_src) return;
      e.preventDefault();
      e.stopPropagation();
      const numDestino  = parseInt(item.dataset.num);
      const faseDestino = parseInt(item.dataset.fase);
      if (numDestino === _src.numero) return;
      _cf_moverActividad(_src.numero, faseDestino, numDestino);
    });
  });

  document.querySelectorAll('.acts-lista').forEach(lista => {
    lista.addEventListener('dragover', e => {
      if (!_src) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      lista.classList.add('acts-lista-drop');
    });
    lista.addEventListener('dragleave', e => {
      if (!lista.contains(e.relatedTarget)) lista.classList.remove('acts-lista-drop');
    });
    lista.addEventListener('drop', e => {
      if (!_src) return;
      // Si el drop cayó sobre un act-item, ese handler se encarga (stopPropagation).
      // Acá manejamos solo el caso "soltar en el espacio vacío de la fase".
      e.preventDefault();
      const faseDestino = parseInt(lista.dataset.fase);
      _cf_moverActividad(_src.numero, faseDestino, null); // null = al final
    });
  });
}

// Mueve la actividad con `numero` a la fase `faseDestino`, insertándola antes
// de la actividad `numAntesDe`. Si `numAntesDe` es null/undefined, va al final.
function _cf_moverActividad(numero, faseDestino, numAntesDe) {
  const src = _cf.ordenActividades.find(o => o.numero === numero);
  if (!src) return;

  // Cambiar fase si corresponde.
  src.faseEfectiva = faseDestino;

  // Reordenar dentro de la fase destino.
  const enFase = _cf.ordenActividades
    .filter(o => o.faseEfectiva === faseDestino)
    .sort((a, b) => a.posicion - b.posicion);

  // Quitar la fuente de la lista para reinsertarla.
  const sinSrc = enFase.filter(o => o.numero !== numero);
  let idxInsercion = sinSrc.length; // por defecto al final
  if (numAntesDe != null) {
    const i = sinSrc.findIndex(o => o.numero === numAntesDe);
    if (i >= 0) idxInsercion = i;
  }
  sinSrc.splice(idxInsercion, 0, src);

  // Reindexar posiciones de la fase destino.
  sinSrc.forEach((o, i) => { o.posicion = i; });

  // Reindexar posiciones de la fase origen (por si era distinta).
  [1, 2, 3, 4, 5, 6].forEach(fase => {
    if (fase === faseDestino) return;
    _cf.ordenActividades
      .filter(o => o.faseEfectiva === fase)
      .sort((a, b) => a.posicion - b.posicion)
      .forEach((o, i) => { o.posicion = i; });
  });

  _cf_renderizar();
}

// ── Actividades custom ────────────────────────────────────────────────────────

function _cf_siguienteNumeroCustom() {
  const existentes = (_cf.actividadesCustom || []).map(function(a) { return a.numero; });
  if (existentes.length === 0) return 9001;
  return Math.max.apply(null, existentes) + 1;
}

function _cf_siguienteCodigoCustom(fase) {
  var maxN = 0;
  (_cf.ordenActividades || [])
    .filter(function(o) { return o.faseEfectiva === fase; })
    .forEach(function(o) {
      var custom = (_cf.actividadesCustom || []).find(function(c) { return c.numero === o.numero; });
      var codigo = custom ? custom.codigo : String(o.numero);
      var n = parseInt(codigo);
      if (!isNaN(n)) maxN = Math.max(maxN, n);
    });
  return String(maxN === 0 ? fase * 1000 + 10 : maxN + 10);
}

function _cf_agregarActividadCustom(fase, codigo, nombre) {
  const num = _cf_siguienteNumeroCustom();
  if (!_cf.actividadesCustom) _cf.actividadesCustom = [];
  if (!_cf.nombresActividades) _cf.nombresActividades = {};
  _cf.actividadesCustom.push({ numero: num, codigo: codigo || _cf_siguienteCodigoCustom(fase) });
  _cf.nombresActividades[num] = nombre;
  _cf.actividades.push(num);
  const enFase = _cf.ordenActividades.filter(function(o) { return o.faseEfectiva === fase; });
  _cf.ordenActividades.push({ numero: num, faseEfectiva: fase, posicion: enFase.length });
}

function _cf_eliminarActividadCustom(numero) {
  _cf.actividadesCustom = (_cf.actividadesCustom || []).filter(function(a) { return a.numero !== numero; });
  delete _cf.nombresActividades[numero];
  _cf.actividades = _cf.actividades.filter(function(n) { return n !== numero; });
  _cf.ordenActividades = _cf.ordenActividades.filter(function(o) { return o.numero !== numero; });
  // Reindexar posiciones
  [1, 2, 3, 4, 5, 6].forEach(function(fase) {
    _cf.ordenActividades
      .filter(function(o) { return o.faseEfectiva === fase; })
      .sort(function(a, b) { return a.posicion - b.posicion; })
      .forEach(function(o, i) { o.posicion = i; });
  });
}

// ── Botones de navegación del wizard ─────────────────────────────────────────

function configProyecto_registrarEventos() {
  document.getElementById('cf-btn-anterior')?.addEventListener('click', () => {
    if (_cf_paso > 1) { _cf_paso--; _cf_renderizar(); }
  });

  document.getElementById('cf-btn-siguiente')?.addEventListener('click', () => {
    const error = _cf_validarPasoActual();
    if (error) { interfaz_mostrarToast(error, 'error'); return; }
    if (_cf_paso < 4) { _cf_paso++; _cf_renderizar(); }
  });

  document.getElementById('cf-btn-guardar')?.addEventListener('click', () => {
    const error = _cf_validarPasoActual();
    if (error) { interfaz_mostrarToast(error, 'error'); return; }
    datos_guardarProyecto(_cf);
    interfaz_mostrarToast(`Proyecto "${_cf.nombre}" ${_cf_modoEdicion ? 'actualizado' : 'creado'}.`, 'exito');
    router_ir('v-proyecto', { idProyecto: _cf.id });
  });

  document.getElementById('cf-btn-cancelar')?.addEventListener('click', () => {
    router_ir(_cf_modoEdicion ? 'v-proyecto' : 'v-inicio');
  });
}

function _cf_validarPasoActual() {
  if (_cf_paso === 1) return logica_validarPaso1(_cf);
  if (_cf_paso === 2) return logica_validarPaso2(_cf);
  if (_cf_paso === 3) return logica_validarPaso3(_cf);
  return null;
}
