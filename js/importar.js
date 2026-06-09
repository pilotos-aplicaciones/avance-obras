// Importación de Planificación inicial.xlsx usando SheetJS.
// Requiere que xlsx.full.min.js esté cargado antes en index.html.

function importar_planificacion(file, onExito, onError) {
  if (!file) { onError('No se seleccionó ningún archivo.'); return; }

  const reader = new FileReader();
  reader.onerror = () => onError('No se pudo leer el archivo.');
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), {
        type: 'array',
        cellDates: true,   // convierte seriales de fecha a objetos Date
        cellNF: false,
      });

      const hojaOG   = wb.SheetNames.find(n => n.trim() === 'Obra Gruesa');
      const hojaT    = wb.SheetNames.find(n => n.trim() === 'Terminaciones');

      if (!hojaOG) { onError('No se encontró la hoja "Obra Gruesa" en el archivo.'); return; }
      if (!hojaT)  { onError('No se encontró la hoja "Terminaciones" en el archivo.'); return; }

      const og   = _importar_hojaOG(wb.Sheets[hojaOG]);
      const term = _importar_hojaTerm(wb.Sheets[hojaT]);

      if (og.length === 0)   { onError('La hoja "Obra Gruesa" no contiene datos válidos.'); return; }
      if (term.length === 0) { onError('La hoja "Terminaciones" no contiene datos válidos.'); return; }

      onExito({ og, term });
    } catch (err) {
      onError('Error al procesar el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Hoja Obra Gruesa ─────────────────────────────────────────────────────────
// Estructura: Col1=Fecha Inicio, Col7=Avance Semanal (m3), Col8=Avance Acum (m3)

function _importar_hojaOG(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const resultado = [];

  // Fila 0 = encabezados → empezar en fila 1
  for (let i = 1; i < rows.length; i++) {
    const r    = rows[i];
    const fecha = _importar_fechaCelda(r[0]);
    if (!fecha) continue;

    resultado.push({
      fecha,
      fecha_termino: _importar_fechaCelda(r[1]),  // col 2 (índice 1) — viernes
      fundaciones:   _importar_num(r[2]),          // col 3 (índice 2)
      subterraneo:   _importar_num(r[3]),          // col 4 (índice 3)
      placa:         _importar_num(r[4]),          // col 5 (índice 4)
      nucleo:        _importar_num(r[5]),          // col 6 (índice 5)
      m3_semanal:    _importar_num(r[6]),          // col 7 (índice 6)
      m3_acumulado:  _importar_num(r[7]),          // col 8 (índice 7)
    });
  }
  return resultado;
}

// ── Hoja Terminaciones ───────────────────────────────────────────────────────
// Col1=Fecha Inicio (lunes), Col2=Fecha Término (viernes),
// Col3=Piso OG,
// Col4=% F1,  Col5=Piso F1,
// Col6=% F2,  Col7=Piso F2,
// Col8=% F3,  Col9=Piso F3,
// Col10=% F4, Col11=Piso F4,
// Col12=% F5, Col13=Piso F5,
// Col14=% F6, Col15=Piso F6
//
// `f1`..`f6`     guardan el PISO aproximado programado (los usa el gráfico).
// `f1_pct`..`f6_pct` guardan el % acumulado (lo usa la pestaña Consolidado).

function _importar_hojaTerm(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const resultado = [];

  for (let i = 1; i < rows.length; i++) {
    const r     = rows[i];
    const fecha = _importar_fechaCelda(r[0]);
    if (!fecha) continue;

    resultado.push({
      fecha,
      fecha_termino: _importar_fechaCelda(r[1]),  // col 2 (índice 1) — viernes
      piso_og: _importar_num(r[2]),   // col 3
      // Piso aproximado programado por fase (lo que ya teníamos)
      f1:      _importar_num(r[4]),   // col 5
      f2:      _importar_num(r[6]),   // col 7
      f3:      _importar_num(r[8]),   // col 9
      f4:      _importar_num(r[10]),  // col 11
      f5:      _importar_num(r[12]),  // col 13
      f6:      _importar_num(r[14]),  // col 15
      // % acumulado programado por fase (se guarda como fracción 0–1, igual que el Excel)
      f1_pct:  _importar_num(r[3]),   // col 4
      f2_pct:  _importar_num(r[5]),   // col 6
      f3_pct:  _importar_num(r[7]),   // col 8
      f4_pct:  _importar_num(r[9]),   // col 10
      f5_pct:  _importar_num(r[11]),  // col 12
      f6_pct:  _importar_num(r[13]),  // col 14
    });
  }
  return resultado;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _importar_fechaCelda(val) {
  if (val === null || val === undefined || val === '') return null;

  // SheetJS con cellDates:true devuelve objetos Date para celdas de fecha
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    // Ajustar zona horaria para evitar desfase de un día
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Número serial de Excel (por si cellDates no funcionó)
  if (typeof val === 'number' && val > 40000 && val < 60000) {
    const d = new Date((val - 25569) * 86400000);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }

  // Texto (fecha almacenada como string en Excel)
  if (typeof val === 'string') {
    return _logica_parsearFecha(val.trim()) || null;
  }

  return null;
}

function _importar_num(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    // Manejar formato español: "1.044,50" → 1044.50
    const limpio = val.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpio);
    return isNaN(n) ? null : n;
  }
  return null;
}
