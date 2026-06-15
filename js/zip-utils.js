// ─────────────────────────────────────────────────────────────────────────────
// zip-utils.js — Utilidad ZIP mínima para modificar archivos .xlsx
//
// Permite leer un .xlsx (que es un ZIP internamente), actualizar el contenido
// de un archivo XML específico, y volver a empaquetarlo sin tocar nada más.
//
// Sin dependencias externas. Usa DecompressionStream / CompressionStream,
// APIs nativas disponibles en Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+.
// ─────────────────────────────────────────────────────────────────────────────


// Lee un ZIP desde un ArrayBuffer.
// Retorna un objeto con el mapa de entradas y los bytes originales.
async function zipLeer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view  = new DataView(arrayBuffer);

  // Buscar la firma del End of Central Directory (EOCD): PK\x05\x06
  let eocdPos = -1;
  const limite = Math.max(0, bytes.length - 65558); // ZIP permite comentario de hasta 65535 bytes
  for (let i = bytes.length - 22; i >= limite; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
  }
  if (eocdPos < 0) throw new Error('El archivo no es un ZIP válido');

  const cdOffset = view.getUint32(eocdPos + 16, true); // offset del directorio central
  const cdCount  = view.getUint16(eocdPos + 10, true); // cantidad de entradas

  // Parsear el directorio central
  const dec      = new TextDecoder('utf-8');
  const entradas = {};
  let pos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break; // firma PK\x01\x02

    const metodo        = view.getUint16(pos + 10, true);
    const crc32         = view.getUint32(pos + 16, true);
    const tamComprimido = view.getUint32(pos + 20, true);
    const tamOriginal   = view.getUint32(pos + 24, true);
    const nombreLen     = view.getUint16(pos + 28, true);
    const extraLen      = view.getUint16(pos + 30, true);
    const comentLen     = view.getUint16(pos + 32, true);
    const localOffset   = view.getUint32(pos + 42, true);
    const nombre        = dec.decode(bytes.subarray(pos + 46, pos + 46 + nombreLen));

    entradas[nombre] = { metodo, crc32, tamComprimido, tamOriginal, localOffset };
    pos += 46 + nombreLen + extraLen + comentLen;
  }

  return { entradas, bytes, view };
}


// Lee y descomprime un archivo del ZIP. Retorna su contenido como string UTF-8.
async function zipLeerArchivo(zip, nombre) {
  const e = zip.entradas[nombre];
  if (!e) throw new Error('Archivo no encontrado en ZIP: ' + nombre);

  const { bytes, view } = zip;

  // Saltar el local file header para llegar a los datos
  const lhNomLen  = view.getUint16(e.localOffset + 26, true);
  const lhExtLen  = view.getUint16(e.localOffset + 28, true);
  const dataStart = e.localOffset + 30 + lhNomLen + lhExtLen;
  const compressed = bytes.subarray(dataStart, dataStart + e.tamComprimido);

  // Método 0: almacenado sin compresión
  if (e.metodo === 0) {
    return new TextDecoder('utf-8').decode(compressed);
  }

  // Método 8: deflate (el más común en xlsx)
  if (e.metodo === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const w  = ds.writable.getWriter();
    const r  = ds.readable.getReader();
    w.write(compressed.slice()); // .slice() para desanclar del buffer original
    w.close();
    const chunks = [];
    for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out   = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return new TextDecoder('utf-8').decode(out);
  }

  throw new Error('Método de compresión no soportado: ' + e.metodo);
}


// Reempaqueta el ZIP con un archivo modificado. Retorna un Blob listo para descargar.
// Solo el archivo indicado en "nombreModificado" cambia; todo lo demás se copia verbatim.
async function zipGuardarConCambios(zip, nombreModificado, nuevoContenido) {
  const enc      = new TextEncoder();
  const rawBytes = enc.encode(nuevoContenido);

  // Comprimir el nuevo contenido con deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const w  = cs.writable.getWriter();
  const r  = cs.readable.getReader();
  w.write(rawBytes);
  w.close();
  const chunks = [];
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  const totalComp = chunks.reduce((n, c) => n + c.length, 0);
  const compBytes = new Uint8Array(totalComp);
  let off = 0;
  for (const c of chunks) { compBytes.set(c, off); off += c.length; }

  const crcNuevo = _zip_crc32(rawBytes);
  const enc2     = new TextEncoder();
  const partes   = [];   // segmentos del nuevo archivo ZIP
  const cdItems  = [];   // info para el directorio central
  let cursor     = 0;

  for (const nombre of Object.keys(zip.entradas)) {
    const e = zip.entradas[nombre];
    const { bytes, view } = zip;

    if (nombre !== nombreModificado) {
      // ── Archivo sin cambios: copiar local header + datos verbatim ──────────
      const lhNomLen = view.getUint16(e.localOffset + 26, true);
      const lhExtLen = view.getUint16(e.localOffset + 28, true);
      const tamChunk = 30 + lhNomLen + lhExtLen + e.tamComprimido;
      const chunk    = bytes.subarray(e.localOffset, e.localOffset + tamChunk);

      cdItems.push({
        nombreBytes: enc2.encode(nombre),
        metodo:      e.metodo,
        crc:         e.crc32,
        tamComp:     e.tamComprimido,
        tamOrig:     e.tamOriginal,
        lhOffset:    cursor,
      });
      partes.push(chunk);
      cursor += tamChunk;

    } else {
      // ── Archivo modificado: escribir nuevo local header + datos comprimidos ─
      const nombreBytes = enc2.encode(nombre);
      const lh  = new ArrayBuffer(30 + nombreBytes.length);
      const lhV = new DataView(lh);
      lhV.setUint32(0,  0x04034b50, true); // firma PK\x03\x04
      lhV.setUint16(4,  20,              true); // versión requerida
      lhV.setUint16(6,  0,               true); // flags
      lhV.setUint16(8,  8,               true); // método: deflate
      lhV.setUint16(10, 0,               true); // hora mod
      lhV.setUint16(12, 0,               true); // fecha mod
      lhV.setUint32(14, crcNuevo,        true); // CRC-32
      lhV.setUint32(18, compBytes.length,true); // tam comprimido
      lhV.setUint32(22, rawBytes.length, true); // tam original
      lhV.setUint16(26, nombreBytes.length, true);
      lhV.setUint16(28, 0,               true); // extra field: ninguno
      new Uint8Array(lh).set(nombreBytes, 30);

      cdItems.push({
        nombreBytes,
        metodo:   8,
        crc:      crcNuevo,
        tamComp:  compBytes.length,
        tamOrig:  rawBytes.length,
        lhOffset: cursor,
      });
      partes.push(new Uint8Array(lh));
      partes.push(compBytes);
      cursor += lh.byteLength + compBytes.length;
    }
  }

  // ── Directorio central ────────────────────────────────────────────────────
  const cdStart = cursor;
  for (const e of cdItems) {
    const cd  = new ArrayBuffer(46 + e.nombreBytes.length);
    const cdV = new DataView(cd);
    cdV.setUint32(0,  0x02014b50,       true); // firma PK\x01\x02
    cdV.setUint16(4,  20,               true); // versión creado por
    cdV.setUint16(6,  20,               true); // versión requerida
    cdV.setUint16(8,  0,                true); // flags
    cdV.setUint16(10, e.metodo,         true);
    cdV.setUint16(12, 0,                true); // hora mod
    cdV.setUint16(14, 0,                true); // fecha mod
    cdV.setUint32(16, e.crc,            true);
    cdV.setUint32(20, e.tamComp,        true);
    cdV.setUint32(24, e.tamOrig,        true);
    cdV.setUint16(28, e.nombreBytes.length, true);
    cdV.setUint16(30, 0, true); // extra
    cdV.setUint16(32, 0, true); // comentario
    cdV.setUint16(34, 0, true); // disco inicio
    cdV.setUint16(36, 0, true); // atributos internos
    cdV.setUint32(38, 0, true); // atributos externos
    cdV.setUint32(42, e.lhOffset, true);
    new Uint8Array(cd).set(e.nombreBytes, 46);
    partes.push(new Uint8Array(cd));
    cursor += cd.byteLength;
  }

  const cdSize = cursor - cdStart;

  // ── End of Central Directory ──────────────────────────────────────────────
  const eocd  = new ArrayBuffer(22);
  const eocdV = new DataView(eocd);
  eocdV.setUint32(0,  0x06054b50,   true); // firma PK\x05\x06
  eocdV.setUint16(4,  0,            true); // número de disco
  eocdV.setUint16(6,  0,            true); // disco donde empieza el CD
  eocdV.setUint16(8,  cdItems.length, true);
  eocdV.setUint16(10, cdItems.length, true);
  eocdV.setUint32(12, cdSize,       true);
  eocdV.setUint32(16, cdStart,      true);
  eocdV.setUint16(20, 0,            true); // sin comentario
  partes.push(new Uint8Array(eocd));

  return new Blob(partes, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


// CRC-32 estándar. Tabla de lookup generada una sola vez.
function _zip_crc32(data) {
  if (!_zip_crc32._tabla) {
    _zip_crc32._tabla = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _zip_crc32._tabla[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const b of data) crc = _zip_crc32._tabla[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
