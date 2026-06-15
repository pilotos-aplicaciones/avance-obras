// Catálogo de 88 actividades en 6 fases — nombres reales del proyecto
const CATALOGO_ACTIVIDADES = [
  // FASE 1
  { fase: 1, numero: 1010, nombre: 'Recepción Obra Gruesa' },
  { fase: 1, numero: 1020, nombre: 'Control Geométrico' },
  { fase: 1, numero: 1030, nombre: 'Pulido y Descarachado de Muros - Losas' },
  { fase: 1, numero: 1040, nombre: 'Trazado de Tabiques' },
  { fase: 1, numero: 1050, nombre: 'Rectificado Inst. Eléctrica' },
  { fase: 1, numero: 1060, nombre: 'Rectificado Inst. Sanitarias y Gas' },
  { fase: 1, numero: 1070, nombre: 'Refuerzo Metálico y Tabique Mocheta Ventana' },
  { fase: 1, numero: 1080, nombre: 'Inst. de Barandas (con film protección)' },
  { fase: 1, numero: 1090, nombre: 'Maquillaje y Estuco Terraza' },
  { fase: 1, numero: 1100, nombre: 'Inst. Ducto de Extracción' },
  { fase: 1, numero: 1110, nombre: 'Inst. Sanitaria Vertical Alcantarillado' },
  { fase: 1, numero: 1130, nombre: 'Colocación de Pasobarcos' },
  { fase: 1, numero: 1140, nombre: 'Sobrelosa Terraza' },
  { fase: 1, numero: 1150, nombre: 'Rasgos Ventanas y Puertas' },
  { fase: 1, numero: 1160, nombre: 'Impermeabilización Rasgos Ventana' },
  { fase: 1, numero: 1170, nombre: 'Enlauchado o Cableado en H.A' },
  // FASE 2
  { fase: 2, numero: 2180, nombre: 'Recepción Fase 1' },
  { fase: 2, numero: 2010, nombre: 'Prueba Alcantarillado' },
  { fase: 2, numero: 2020, nombre: 'Tabique 1ra Cara' },
  { fase: 2, numero: 2030, nombre: 'Inst. Eléctricas en Tabique y Caja PAU' },
  { fase: 2, numero: 2040, nombre: 'Inst. Sanitarias en Tabique' },
  { fase: 2, numero: 2050, nombre: 'Aislación y Tabique 2da Cara' },
  { fase: 2, numero: 2060, nombre: 'Confección de Shaft y Dinteles' },
  { fase: 2, numero: 2070, nombre: 'Prueba Presión' },
  { fase: 2, numero: 2080, nombre: 'Inst. Volcapol' },
  { fase: 2, numero: 2090, nombre: 'Huincha' },
  { fase: 2, numero: 2100, nombre: 'Cuadratura de Cajas - Canterías - Varios Yeso' },
  { fase: 2, numero: 2110, nombre: 'Impermeabilización Baños' },
  { fase: 2, numero: 2120, nombre: 'Impermeabilización Terraza' },
  { fase: 2, numero: 2130, nombre: 'Inst. de Soporte y Tina' },
  { fase: 2, numero: 2140, nombre: 'Zócalos y Faldones de Tina' },
  { fase: 2, numero: 2150, nombre: 'Inst. Ventanas (marco y cristales)' },
  // FASE 3
  { fase: 3, numero: 3190, nombre: 'Recepción Fase 2' },
  { fase: 3, numero: 3010, nombre: 'Remates Yeso' },
  { fase: 3, numero: 3020, nombre: 'Placostic' },
  { fase: 3, numero: 3030, nombre: 'Empastes (interior closet)' },
  { fase: 3, numero: 3040, nombre: 'Inst. Pavimento Cerámico o Porcelanato (Interior)' },
  { fase: 3, numero: 3050, nombre: 'Inst. Pavimento (Terraza)' },
  { fase: 3, numero: 3060, nombre: 'Inst. Revestimiento Cerámica o Porcelanato (Muro)' },
  { fase: 3, numero: 3070, nombre: 'Frague' },
  { fase: 3, numero: 3110, nombre: 'Inst. Puerta Acceso (con quincallería)' },
  { fase: 3, numero: 3080, nombre: 'Aplicación de Mortero Nivelador de Piso' },
  { fase: 3, numero: 3090, nombre: 'Pintura Int. Closet para Mueble' },
  { fase: 3, numero: 3100, nombre: 'Inst. Pierna, Cenefa, Zócalo Closet' },
  { fase: 3, numero: 3120, nombre: 'Inst. Puertas Interiores' },
  { fase: 3, numero: 3130, nombre: 'Atraques (piernas closet - marcos puertas)' },
  { fase: 3, numero: 3140, nombre: 'Inst. Quincallería' },
  { fase: 3, numero: 3150, nombre: 'Inst. Cornisas' },
  { fase: 3, numero: 3160, nombre: 'Empastes (incluye remate alféizar)' },
  { fase: 3, numero: 3170, nombre: 'Cableado Eléctrico' },
  // FASE 4
  { fase: 4, numero: 4140, nombre: 'Recepción Fase 3' },
  { fase: 4, numero: 4010, nombre: 'Losalin Cielo' },
  { fase: 4, numero: 4020, nombre: 'Canaleta Agua Lluvia Terraza' },
  { fase: 4, numero: 4030, nombre: 'Pintura Terraza' },
  { fase: 4, numero: 4150, nombre: 'Instalación EIFS Terraza' },
  { fase: 4, numero: 4040, nombre: 'Pintura 1° Mano' },
  { fase: 4, numero: 4050, nombre: 'Pintura 1° Mano Puertas' },
  { fase: 4, numero: 4060, nombre: 'Inst. Mueble Base Cocina' },
  { fase: 4, numero: 4070, nombre: 'Inst. Mueble Aéreo Cocina' },
  { fase: 4, numero: 4080, nombre: 'Inst. Cubierta Cocina' },
  { fase: 4, numero: 4090, nombre: 'Artefactos Sanitarios Baño' },
  { fase: 4, numero: 4100, nombre: 'Inst. Mueble Vanitorio Baño' },
  { fase: 4, numero: 4110, nombre: 'Artefactos de Cocina' },
  { fase: 4, numero: 4120, nombre: 'Inst. de Extractor' },
  // FASE 5
  { fase: 5, numero: 5100, nombre: 'Recepción Fase 4' },
  { fase: 5, numero: 5020, nombre: 'Inst. Calefont' },
  { fase: 5, numero: 5030, nombre: 'Cableado CCDD' },
  { fase: 5, numero: 5040, nombre: 'Inst. TDA (Enchufes, Interruptores)' },
  { fase: 5, numero: 5050, nombre: 'Inst. Interior y Puertas Closet' },
  { fase: 5, numero: 5060, nombre: 'Accesorios Baño' },
  { fase: 5, numero: 5070, nombre: 'Inst. Grifería' },
  { fase: 5, numero: 5080, nombre: 'Inst. Piso SPC' },
  // FASE 6
  { fase: 6, numero: 6160, nombre: 'Recepción Fase 5' },
  { fase: 6, numero: 6010, nombre: 'Inst. Espejos' },
  { fase: 6, numero: 6020, nombre: 'Inst. Alfombra (dormitorios)' },
  { fase: 6, numero: 6030, nombre: 'Inst. Papel Mural' },
  { fase: 6, numero: 6040, nombre: 'Inst. Artefactos Corrientes Débiles' },
  { fase: 6, numero: 6050, nombre: 'Inst. GP, Junquillo, Cubrejunta y Topes' },
  { fase: 6, numero: 6060, nombre: 'Prueba Funcionamiento Instalaciones' },
  { fase: 6, numero: 6070, nombre: 'Pintura Final Muros' },
  { fase: 6, numero: 6080, nombre: 'Pintura Final Puertas' },
  { fase: 6, numero: 6170, nombre: 'Inst. Gabinete Calefont' },
  { fase: 6, numero: 6090, nombre: 'Inst. Puertas Enchapadas' },
  { fase: 6, numero: 6100, nombre: 'Endolado' },
  { fase: 6, numero: 6110, nombre: 'Barniz Puerta de Acceso' },
  { fase: 6, numero: 6120, nombre: 'Sellos en General' },
  { fase: 6, numero: 6130, nombre: 'Ajuste y Entrega Ventanas' },
  { fase: 6, numero: 6140, nombre: 'Telecomunicaciones (fibra-artefactos-pruebas)' },
];

const NOMBRES_FASES = {
  1: 'F1 – Terminaciones Iniciales',
  2: 'F2 – Tabiquería y Sanitarias',
  3: 'F3 – Revestimientos',
  4: 'F4 – Muebles y Artefactos',
  5: 'F5 – Terminaciones Medias',
  6: 'F6 – Terminaciones Finales',
};

const FASE_COLORES = {
  1: { enc: '#4dd0e1', fondo: '#80deea', txt: '#004d60' },
  2: { enc: '#9c27b0', fondo: '#ce93d8', txt: '#ffffff' },
  3: { enc: '#e65100', fondo: '#ff8f00', txt: '#ffffff' },
  4: { enc: '#a1887f', fondo: '#bcaaa4', txt: '#ffffff' },
  5: { enc: '#90a4ae', fondo: '#b0bec5', txt: '#1a2327' },
  6: { enc: '#f48fb1', fondo: '#f8bbd0', txt: '#4a0020' },
};

const OG_COLOR = { enc: '#000000', fondo: '#42a5f5', txt: '#ffffff' };

// ── Abreviaciones aprobadas para uso en terreno (móvil) ─────────────────────
const ABREV_ACTIVIDADES = {
  1010: 'Rec. OG',          1020: 'Ctrl. Geom.',       1030: 'Pul y Des.',
  1040: 'Traz. Tab.',       1050: 'Rect. Eléc.',        1060: 'Rect. San./Gas',
  1070: 'Ref. y Mocheta.',  1080: 'Barandas',           1090: 'Maq./Est. Terr.',
  1100: 'Ducto Ext.',       1110: 'Vert. Alc.',         1130: 'Pasobarcos',
  1140: 'Sobrelosa Terr.',  1150: 'Rasgos V./P.',       1160: 'Imp. Rasgos',
  1170: 'Enlauchado',

  2180: 'Rec. F1',          2010: 'Pr. Alc.',           2020: 'Tab. 1ª Cara',
  2030: 'Inst. Elec.',      2040: 'Inst. San.',         2050: 'Aisl y 2ª Cara',
  2060: 'Shaft/Dint.',      2070: 'Pr. Presión',        2080: 'Volcapol',
  2090: 'Huincha',          2100: 'Cuad. Cajas',        2110: 'Imp. Baños',
  2120: 'Imp. Terraza',     2130: 'Soporte/Tina',       2140: 'Zóc./Fald. Tina',
  2150: 'Ventanas',

  3190: 'Rec. F2',          3010: 'Rem. Yeso',          3020: 'Placostic',
  3030: 'Empa. Closet',     3040: 'Pav. Int.',          3050: 'Pav. Terraza',
  3060: 'Rev. Muro',        3070: 'Frague',             3110: 'P. Acceso',
  3080: 'Nivelador',        3090: 'Pint. Closet',       3100: 'Pierna/Cenefa',
  3120: 'P. Interiores',    3130: 'Atraques',           3140: 'Quinc.',
  3150: 'Cornisas',         3160: 'Empastes',           3170: 'Cab. Eléc.',

  4140: 'Rec. F3',          4010: 'Losalin',            4020: 'Canal. A.Ll.',
  4030: 'Pint. Terraza',    4150: 'EIFS',               4040: 'Pint. 1ª',
  4050: 'Pint. 1ª Puertas', 4060: 'Mueble Base',        4070: 'Mueble Aéreo',
  4080: 'Cubierta Coc.',    4090: 'Art. Sanitarios',    4100: 'Vanitorio',
  4110: 'Art. Cocina',      4120: 'Extractor',

  5100: 'Rec. F4',          5020: 'Calefont',           5030: 'Cab. CCDD',
  5040: 'TDA',              5050: 'Int./P. Closet',     5060: 'Acc. Baño',
  5070: 'Grifería',         5080: 'SPC',

  6160: 'Rec. F5',          6010: 'Espejos',            6020: 'Alfombra',
  6030: 'Papel',            6040: 'Art. CC.DD.',        6050: 'GP/Junq./Topes',
  6060: 'Pr. Func.',        6070: 'Pint. Final M.',     6080: 'Pint. Final P.',
  6170: 'Gabinete',         6090: 'P. Enchapadas',      6100: 'Endolado',
  6110: 'Barniz P.A.',      6120: 'Sellos',             6130: 'Aj. Ventanas',
  6140: 'Telecom.',
};

function actividades_getAbrev(numero) {
  return ABREV_ACTIVIDADES[numero] || actividades_getNombre(numero);
}

// Devuelve el código de visualización de una actividad.
// Catálogo: número tal cual (ej. 1010). Custom: código guardado en actividadesCustom (ej. "C1").
function actividades_getCodigoDisplay(config, numero) {
  if (config && config.actividadesCustom) {
    const custom = config.actividadesCustom.find(function(c) { return c.numero === numero; });
    if (custom && custom.codigo) return custom.codigo;
  }
  return String(numero);
}

function actividades_porFase(fase) {
  return CATALOGO_ACTIVIDADES.filter(a => a.fase === fase);
}

function actividades_fasesActivas(numerosSeleccionados) {
  const fases = new Set();
  numerosSeleccionados.forEach(num => {
    const a = CATALOGO_ACTIVIDADES.find(x => x.numero === num);
    if (a) fases.add(a.fase);
  });
  return Array.from(fases).sort();
}

function actividades_getNombre(numero) {
  const a = CATALOGO_ACTIVIDADES.find(x => x.numero === numero);
  return a ? a.nombre : `Actividad ${numero}`;
}

// Devuelve el nombre custom del proyecto si existe, sino el del catálogo.
// Se usa donde se muestre el nombre de una actividad en el contexto de un
// proyecto específico (tablas de Terminaciones, wizard Paso 3, etc.).
function actividades_getNombreProyecto(config, numero) {
  if (config && config.nombresActividades && config.nombresActividades[numero]) {
    return config.nombresActividades[numero];
  }
  return actividades_getNombre(numero);
}

function actividades_getFase(numero) {
  const a = CATALOGO_ACTIVIDADES.find(x => x.numero === numero);
  return a ? a.fase : 0;
}

function actividades_construirOrden(numerosSeleccionados) {
  const orden = [];
  [1, 2, 3, 4, 5, 6].forEach(fase => {
    const deEstaFase = CATALOGO_ACTIVIDADES
      .filter(a => a.fase === fase && numerosSeleccionados.includes(a.numero));
    deEstaFase.forEach((a, idx) => {
      orden.push({ numero: a.numero, faseEfectiva: fase, posicion: idx });
    });
  });
  return orden;
}

function actividades_sincronizarOrden(ordenActual, nuevaSeleccion) {
  // Mantener orden existente para actividades que siguen seleccionadas
  const mantenidas = ordenActual.filter(o => nuevaSeleccion.includes(o.numero));
  // Agregar nuevas actividades al final de su fase
  nuevaSeleccion.forEach(num => {
    if (!mantenidas.find(o => o.numero === num)) {
      const a = CATALOGO_ACTIVIDADES.find(x => x.numero === num);
      if (!a) {
        // Actividad custom: recuperar fase desde el orden anterior
        const orig = ordenActual.find(o => o.numero === num);
        if (!orig) return;
        const enFase = mantenidas.filter(o => o.faseEfectiva === orig.faseEfectiva);
        mantenidas.push({ numero: num, faseEfectiva: orig.faseEfectiva, posicion: enFase.length });
        return;
      }
      const enFase = mantenidas.filter(o => o.faseEfectiva === a.fase);
      mantenidas.push({ numero: num, faseEfectiva: a.fase, posicion: enFase.length });
    }
  });
  // Reindexar posiciones por fase
  [1, 2, 3, 4, 5, 6].forEach(fase => {
    mantenidas
      .filter(o => o.faseEfectiva === fase)
      .sort((a, b) => a.posicion - b.posicion)
      .forEach((o, idx) => { o.posicion = idx; });
  });
  return mantenidas;
}
