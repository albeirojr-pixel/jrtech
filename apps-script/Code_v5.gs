/**
 * JR TECH UNIFIED CORE v5.0 - PORTAL EDITION
 * ─────────────────────────────────────────────
 * NUEVO en v5.0:
 *   - Portal cliente: verificar_cliente, mis_pedidos, vincular_google
 *   - Panel admin:    todos_pedidos, todos_clientes, lista_proveedores, stats_admin
 *   - Acciones admin: actualizar_estado, subir_guia, enviar_mensaje
 *   - Lectura por NOMBRE de columna (resistente a reordenamiento)
 *   - Auth: token secreto para admin / email para cliente
 *   - registrarPedido PRESERVADO exactamente de v4.1
 */

// ══════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════
const SPREADSHEET_ID_COMPILADOS = '1kTqo_TY7P1RSYM-kp1MhCoj6f6CaQg7ZvGIVYsTmZ2A';
const SPREADSHEET_ID_CV         = '1Br6iD-Yw1Bcr1eyYncbW3XRSWMwvGi_fDFDHVh-aT0o';
const ADMIN_EMAIL                = 'albeiro.jr@gmail.com';
const PROP_ADMIN_TOKEN           = 'JRTECH_ADMIN_TOKEN';
const PORTAL_URL                 = 'https://albeirojr-pixel.github.io/jrtech/portal';

// Columnas nuevas que se agregan al FINAL (sin tocar fórmulas existentes)
const NUEVAS_COLS_CV = ['ESTADO_PORTAL', 'GUIA_NUMERO', 'GUIA_PDF_URL', 'GUIA_FECHA', 'NOTA_ADMIN'];
const NUEVA_COL_CL   = 'GOOGLE_EMAIL';

// ══════════════════════════════════════════════
// HELPERS GLOBALES
// ══════════════════════════════════════════════

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Busca el índice de una columna por su nombre (case-insensitive). Retorna -1 si no existe. */
function getColIndex(headers, name) {
  return headers.findIndex(h => String(h).trim().toLowerCase() === name.trim().toLowerCase());
}

/**
 * Convierte una hoja en array de objetos [{Header: valor, ...}].
 * @param {Sheet} sheet  - La hoja de Google Sheets
 * @param {number} headerRowIndex - Índice (0-based) de la fila con los encabezados reales.
 *   CL = 0 (encabezados en fila 1)
 *   Compra-venta = 1 (fila 1 = títulos COMPRAS/VENTAS, fila 2 = encabezados reales)
 */
function sheetToObjects(sheet, headerRowIndex) {
  headerRowIndex = (headerRowIndex === undefined) ? 0 : headerRowIndex;
  const data = sheet.getDataRange().getValues();
  if (data.length <= headerRowIndex + 1) return [];
  const headers = data[headerRowIndex].map(h => String(h).trim());
  // _rowNum = fila real en el Sheet (1-indexed)
  // Datos empiezan en: headerRowIndex + 1 (0-based) → headerRowIndex + 2 (1-based sheet row)
  return data.slice(headerRowIndex + 1).map((row, i) => {
    const obj = { _rowNum: headerRowIndex + 2 + i };
    headers.forEach((h, colIdx) => { if (h) obj[h] = row[colIdx]; });
    return obj;
  });
}

/** Verifica si el token corresponde al admin. */
function isAdmin(token) {
  const stored = PropertiesService.getScriptProperties().getProperty(PROP_ADMIN_TOKEN);
  return stored && token === stored;
}

/** Garantiza que las columnas del portal existan en la hoja (las agrega al final si faltan). */
function asegurarColumnas(sheet, colNames) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  colNames.forEach(name => {
    if (!headers.includes(name)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
    }
  });
}

/** Escribe un valor en una celda identificando la columna por nombre (no por letra). */
function escribirEnCol(sheet, rowNum, colName, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = getColIndex(headers, colName);
  if (idx === -1) return false;
  sheet.getRange(rowNum, idx + 1).setValue(value);
  return true;
}

// ══════════════════════════════════════════════
// PUNTO DE ENTRADA GET
// ══════════════════════════════════════════════

function doGet(e) {
  const p   = (e && e.parameter) ? e.parameter : {};
  const api = p.api   || '';
  const tok = p.token || '';

  // Catálogo (sin cambios)
  if (api === 'celulares')  return jsonResponse(getCelularesData());
  if (api === 'portatiles') return jsonResponse(getCatalogData());
  if (api === 'tablets')    return jsonResponse(getTabletsData());

  // Portal cliente
  if (api === 'verificar_cliente') return jsonResponse(verificarCliente(p.email || ''));
  if (api === 'mis_pedidos')       return jsonResponse(getMisPedidos(p.email || ''));

  // Panel admin (requieren token)
  if (api === 'todos_pedidos')     return jsonResponse(getTodosPedidos(tok));
  if (api === 'todos_clientes')    return jsonResponse(getTodosClientes(tok));
  if (api === 'lista_proveedores') return jsonResponse(getListaProveedores());
  if (api === 'stats_admin')       return jsonResponse(getStatsAdmin(tok));

  return ContentService.createTextOutput('JR Tech API v5.0 - Portal Edition activa.');
}

// ══════════════════════════════════════════════
// PUNTO DE ENTRADA POST
// ══════════════════════════════════════════════

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action || '';

    // ERP (preservado de v4.1)
    if (action === 'registrarPedido')   return jsonResponse(registrarPedido(data.pedido));

    // Portal cliente
    if (action === 'vincular_google')   return jsonResponse(vincularGoogleEmail(data));

    // Panel admin
    if (action === 'actualizar_estado') return jsonResponse(actualizarEstado(data));
    if (action === 'subir_guia')        return jsonResponse(subirGuia(data));
    if (action === 'enviar_mensaje')    return jsonResponse(enviarMensaje(data));

    return jsonResponse({ error: 'Acción no reconocida: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ══════════════════════════════════════════════
// PORTAL CLIENTE
// ══════════════════════════════════════════════

/**
 * Verifica si un email existe en CL (por E-MAIL o GOOGLE_EMAIL).
 * Retorna datos básicos del cliente si existe.
 */
function verificarCliente(email) {
  if (!email) return { existe: false, error: 'Email requerido' };
  try {
    const ss     = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const clData = sheetToObjects(ss.getSheetByName('Cl'));
    const em     = email.toLowerCase().trim();

    const cl = clData.find(c =>
      String(c['E-MAIL']       || '').toLowerCase().trim() === em ||
      String(c['GOOGLE_EMAIL'] || '').toLowerCase().trim() === em
    );

    if (cl) return { existe: true, id: cl['ID'], nombre: cl['CLIENTE'], municipio: cl['MUNICIPIO'] };
    return { existe: false };
  } catch(err) { return { existe: false, error: err.toString() }; }
}

/**
 * Devuelve todos los pedidos de un cliente identificado por su email.
 */
function getMisPedidos(email) {
  if (!email) return { error: 'Email requerido' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const clData  = sheetToObjects(ss.getSheetByName('Cl'),          0); // CL: encabezados en fila 1
    const cvData  = sheetToObjects(ss.getSheetByName('Compra-venta'), 1); // CV: encabezados en fila 2
    const em      = email.toLowerCase().trim();

    // Buscar cliente por email
    const cl = clData.find(c =>
      String(c['E-MAIL']       || '').toLowerCase().trim() === em ||
      String(c['GOOGLE_EMAIL'] || '').toLowerCase().trim() === em
    );
    if (!cl) return { error: 'Cliente no encontrado', pedidos: [] };

    const clienteId = String(cl['ID']).trim();

    // Filtrar pedidos de este cliente
    const pedidos = cvData
      .filter(p => String(p['Id Cliente'] || '').trim() === clienteId)
      .map(p => ({
        rowNum:      p._rowNum,
        factura:     p['# Fact.'],
        item:        p['Item'],
        equipo:      p['EQUIPO'],
        fechaVenta:  p['Fecha'] instanceof Date ? p['Fecha'].toLocaleDateString('es-CO') : p['Fecha'],
        precio:      p['Precio Venta'],
        garantia:    p['Garantia'],
        estado:      p['ESTADO_PORTAL'] || 'Procesando',
        guiaNumero:  p['GUIA_NUMERO']   || '',
        guiaPdfUrl:  p['GUIA_PDF_URL']  || '',
        guiaFecha:   p['GUIA_FECHA'] instanceof Date ? p['GUIA_FECHA'].toLocaleDateString('es-CO') : (p['GUIA_FECHA'] || ''),
        nota:        p['NOTA_ADMIN']    || '',
      }));

    return {
      cliente: { nombre: cl['CLIENTE'], municipio: cl['MUNICIPIO'] },
      pedidos
    };
  } catch(err) { return { error: err.toString(), pedidos: [] }; }
}

/**
 * Vincula el email de Google a un cliente existente (primera vez que hace login).
 * El cliente se identifica por cédula, teléfono o email registrado.
 */
function vincularGoogleEmail(data) {
  const { email, cedula, telefono } = data;
  if (!email) return { success: false, error: 'Email requerido' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheetCl = ss.getSheetByName('Cl');

    asegurarColumnas(sheetCl, [NUEVA_COL_CL]);

    const rows    = sheetCl.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());
    const iID     = getColIndex(headers, 'ID');
    const iTel    = getColIndex(headers, 'TELEFONO');
    const iEmail  = getColIndex(headers, 'E-MAIL');
    const iGmail  = getColIndex(headers, 'GOOGLE_EMAIL');

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const matchCed   = cedula   && String(r[iID]    || '').trim() === String(cedula).trim();
      const matchTel   = telefono && String(r[iTel]   || '').trim() === String(telefono).trim();
      const matchEmail = String(r[iEmail] || '').toLowerCase().trim() === email.toLowerCase().trim();

      if (matchCed || matchTel || matchEmail) {
        sheetCl.getRange(i + 1, iGmail + 1).setValue(email);
        return { success: true, id: r[iID], nombre: r[1] };
      }
    }
    return { success: false, error: 'No se encontró cliente. Contacta a Albeiro.' };
  } catch(err) { return { success: false, error: err.toString() }; }
}

// ══════════════════════════════════════════════
// PANEL ADMIN
// ══════════════════════════════════════════════

function getTodosPedidos(token) {
  if (!isAdmin(token)) return { error: 'No autorizado' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheet   = ss.getSheetByName('Compra-venta');
    const range   = sheet.getDataRange();
    const values  = range.getValues();
    const bgs     = range.getBackgrounds();
    
    // Compra-venta tiene 2 filas de encabezado: fila 1 = títulos, fila 2 = encabezados reales
    const headerRowIndex = 1;
    if (values.length <= headerRowIndex + 1) return { pedidos: [] };
    
    const headers = values[headerRowIndex].map(h => String(h).trim());
    
    // Funciones helper para buscar celdas de forma robusta
    const getVal = (row, headerName) => {
      const idx = getColIndex(headers, headerName);
      return idx === -1 ? null : row[idx];
    };

    const pedidos = [];
    for (let i = headerRowIndex + 1; i < values.length; i++) {
        const row = values[i];
        
        // FILTRO CRÍTICO: Solo mostrar filas con celda resaltada en columna E (Índice 4)
        // El color que usa registrarPedido es '#ff9900', pero cualquier color != blanco se considera resaltado.
        const colorResalte = bgs[i][4];
        if (colorResalte === '#ffffff') continue;

        const rowNum = i + 1;
        const p = {
          rowNum:     rowNum,
          factura:    getVal(row, '# Fact.'),
          item:       getVal(row, 'Item'),
          equipo:     getVal(row, 'EQUIPO'),
          fechaVenta: getVal(row, 'Fecha') instanceof Date ? getVal(row, 'Fecha').toLocaleDateString('es-CO') : getVal(row, 'Fecha'),
          cliente:    getVal(row, 'Cliente'),
          idCliente:  getVal(row, 'Id Cliente'),
          precio:     getVal(row, 'Precio Venta'),
          costo:      getVal(row, '$ Compra mercancia'),
          proveedor:  getVal(row, 'Proveedor'),
          utilidad:   getVal(row, 'Utilidad OP'),
          estado:     getVal(row, 'ESTADO_PORTAL') || 'Sin estado',
          guiaNumero: getVal(row, 'GUIA_NUMERO')  || '',
          guiaPdfUrl: getVal(row, 'GUIA_PDF_URL') || '',
          guiaFecha:  getVal(row, 'GUIA_FECHA') instanceof Date ? getVal(row, 'GUIA_FECHA').toLocaleDateString('es-CO') : (getVal(row, 'GUIA_FECHA') || ''),
          nota:       getVal(row, 'NOTA_ADMIN')   || '',
        };
        
        // Si no hay equipo o factura, podría ser una fila vacía resaltada por error, pero el usuario pidió basarse en el resalte.
        if (p.equipo || p.factura) {
          pedidos.push(p);
        }
    }
    
    return { pedidos };
  } catch(err) { return { error: err.toString() }; }
}

function getTodosClientes(token) {
  if (!isAdmin(token)) return { error: 'No autorizado' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const clientes = sheetToObjects(ss.getSheetByName('Cl'));
    return { clientes };
  } catch(err) { return { error: err.toString() }; }
}

function getListaProveedores() {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    // CV: encabezados reales en fila 2 → headerRowIndex = 1
    const cvData  = sheetToObjects(ss.getSheetByName('Compra-venta'), 1);
    const proveedores = [...new Set(
      cvData.map(p => String(p['Proveedor'] || '').trim()).filter(v => v && v !== 'N/A')
    )].sort();
    return { proveedores };
  } catch(err) { return { error: err.toString() }; }
}

function getStatsAdmin(token) {
  if (!isAdmin(token)) return { error: 'No autorizado' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheet   = ss.getSheetByName('Compra-venta');
    const range   = sheet.getDataRange();
    const values  = range.getValues();
    const bgs     = range.getBackgrounds();
    
    // headerRowIndex = 1 (fila 2)
    const headerRowIndex = 1;
    if (values.length <= headerRowIndex + 1) return { totalPedidos:0, pedidosMes:0, ventasMes:0, utilidadMes:0, porEstado:{} };
    
    const headers = values[headerRowIndex].map(h => String(h).trim());
    const getVal = (row, headerName) => {
      const idx = getColIndex(headers, headerName);
      return idx === -1 ? null : row[idx];
    };

    const hoy       = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const stats     = { totalPedidos: 0, pedidosMes: 0, ventasMes: 0, utilidadMes: 0, porEstado: {} };

    for (let i = headerRowIndex + 1; i < values.length; i++) {
      const row = values[i];
      
      // Filtro de resalte (coincidir con getTodosPedidos)
      if (bgs[i][4] === '#ffffff') continue;
      
      const equipo  = getVal(row, 'EQUIPO');
      const factura = getVal(row, '# Fact.');
      if (!equipo && !factura) continue;

      stats.totalPedidos++;
      
      const estado = getVal(row, 'ESTADO_PORTAL') || 'Sin estado';
      stats.porEstado[estado] = (stats.porEstado[estado] || 0) + 1;
      
      const fecha = getVal(row, 'Fecha');
      if (fecha instanceof Date && fecha >= inicioMes) {
        stats.pedidosMes++;
        stats.ventasMes    += Number(getVal(row, 'Precio Venta') || 0);
        stats.utilidadMes  += Number(getVal(row, 'Utilidad OP')  || 0);
      }
    }
    return stats;
  } catch(err) { return { error: err.toString() }; }
}

/**
 * Actualiza el estado del pedido (ESTADO_PORTAL) y opcionalmente agrega nota.
 * Estados válidos: 'Recibido' | 'En proceso' | 'Enviado' | 'Entregado' | 'Cancelado'
 */
function actualizarEstado(data) {
  if (!isAdmin(data.token)) return { error: 'No autorizado' };
  const { rowNum, estado, nota } = data;
  if (!rowNum || !estado) return { error: 'rowNum y estado son requeridos' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheetCV = ss.getSheetByName('Compra-venta');
    asegurarColumnas(sheetCV, NUEVAS_COLS_CV);
    escribirEnCol(sheetCV, rowNum, 'ESTADO_PORTAL', estado);
    if (nota) escribirEnCol(sheetCV, rowNum, 'NOTA_ADMIN', nota);
    if (estado === 'Enviado' || estado === 'Entregado') notificarCliente(sheetCV, rowNum, estado, null);
    return { success: true };
  } catch(err) { return { error: err.toString() }; }
}

/**
 * Registra número de guía y URL del PDF en el pedido, y lo marca como Enviado.
 */
function subirGuia(data) {
  if (!isAdmin(data.token)) return { error: 'No autorizado' };
  const { rowNum, guiaNumero, guiaPdfUrl } = data;
  if (!rowNum || !guiaNumero) return { error: 'rowNum y guiaNumero son requeridos' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheetCV = ss.getSheetByName('Compra-venta');
    asegurarColumnas(sheetCV, NUEVAS_COLS_CV);
    escribirEnCol(sheetCV, rowNum, 'GUIA_NUMERO',   guiaNumero);
    escribirEnCol(sheetCV, rowNum, 'GUIA_PDF_URL',  guiaPdfUrl || '');
    escribirEnCol(sheetCV, rowNum, 'GUIA_FECHA',    new Date());
    escribirEnCol(sheetCV, rowNum, 'ESTADO_PORTAL', 'Enviado');
    notificarCliente(sheetCV, rowNum, 'Enviado', guiaNumero);
    return { success: true };
  } catch(err) { return { error: err.toString() }; }
}

/**
 * Guarda un mensaje en NOTA_ADMIN y se lo envía al cliente por email.
 */
function enviarMensaje(data) {
  if (!isAdmin(data.token)) return { error: 'No autorizado' };
  const { rowNum, mensaje } = data;
  if (!rowNum || !mensaje) return { error: 'rowNum y mensaje son requeridos' };
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheetCV = ss.getSheetByName('Compra-venta');
    const sheetCl = ss.getSheetByName('Cl');
    asegurarColumnas(sheetCV, NUEVAS_COLS_CV);
    escribirEnCol(sheetCV, rowNum, 'NOTA_ADMIN', mensaje);

    // Buscar email del cliente — usar fila 2 como encabezados (índice 1 en getValues)
    const allHeaders = sheetCV.getRange(1, 1, 2, sheetCV.getLastColumn()).getValues();
    const headers  = allHeaders[1]; // fila 2 = encabezados reales
    const rowVals  = sheetCV.getRange(rowNum, 1, 1, sheetCV.getLastColumn()).getValues()[0];
    const idxId    = getColIndex(headers, 'Id Cliente');
    const idxEq    = getColIndex(headers, 'EQUIPO');
    const idxFact  = getColIndex(headers, '# Fact.');
    const clientId = String(rowVals[idxId]   || '').trim();
    const equipo   = String(rowVals[idxEq]   || 'tu equipo').trim();
    const factura  = String(rowVals[idxFact] || '').trim();

    const clData   = sheetToObjects(sheetCl, 0); // CL: encabezados en fila 1
    const cl       = clData.find(c => String(c['ID']).trim() === clientId);
    if (cl) {
      const emailCl = cl['GOOGLE_EMAIL'] || cl['E-MAIL'] || '';
      if (emailCl) {
        GmailApp.sendEmail(
          emailCl,
          `📦 Mensaje de JRTech sobre tu pedido #${factura}`,
          `Hola ${cl['CLIENTE']},\n\nAlbeiro de JRTech te escribe sobre tu pedido: ${equipo}\n\n"${mensaje}"\n\nVe tus pedidos en: ${PORTAL_URL}\n\nSaludos,\nAlbeiro - JRTech 📱 3128590469`
        );
      }
    }
    return { success: true };
  } catch(err) { return { error: err.toString() }; }
}

// ══════════════════════════════════════════════
// HELPER: NOTIFICACIÓN POR EMAIL AL CLIENTE
// ══════════════════════════════════════════════

function notificarCliente(sheetCV, rowNum, estado, guiaNumero) {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
    const sheetCl = ss.getSheetByName('Cl');
    // CV: encabezados reales están en fila 2 → getValues()[1]
    const allH    = sheetCV.getRange(1, 1, 2, sheetCV.getLastColumn()).getValues();
    const headers = allH[1];
    const rowVals = sheetCV.getRange(rowNum, 1, 1, sheetCV.getLastColumn()).getValues()[0];

    const clientId = String(rowVals[getColIndex(headers, 'Id Cliente')] || '').trim();
    const equipo   = String(rowVals[getColIndex(headers, 'EQUIPO')]     || 'tu equipo').trim();
    const factura  = String(rowVals[getColIndex(headers, '# Fact.')]    || '').trim();

    if (!clientId) return;
    const cl = sheetToObjects(sheetCl, 0).find(c => String(c['ID']).trim() === clientId); // CL: fila 1
    if (!cl) return;

    const emailCl = cl['GOOGLE_EMAIL'] || cl['E-MAIL'] || '';
    if (!emailCl) return;

    const msgs = {
      'Enviado': {
        asunto:  `🚀 Tu pedido #${factura} fue enviado - JRTech`,
        cuerpo:  `Hola ${cl['CLIENTE']},\n\n¡Tu pedido (${equipo}) fue despachado!\n${guiaNumero ? 'Guía: ' + guiaNumero : ''}\n\nSeguimiento en: ${PORTAL_URL}\n\nAlbeiro - JRTech 📱 3128590469`
      },
      'Entregado': {
        asunto:  `✅ Tu pedido #${factura} fue entregado - JRTech`,
        cuerpo:  `Hola ${cl['CLIENTE']},\n\nTu pedido (${equipo}) fue marcado como entregado.\n\n¡Gracias por tu compra! Cualquier duda: 3128590469\n\nAlbeiro - JRTech`
      }
    };

    const m = msgs[estado];
    if (m) GmailApp.sendEmail(emailCl, m.asunto, m.cuerpo);
  } catch(err) {
    Logger.log('Error notificando cliente: ' + err.toString());
  }
}

// ══════════════════════════════════════════════
// ERP - PRESERVADO EXACTAMENTE DE v4.1
// ══════════════════════════════════════════════

function registrarPedido(pedido) {
  const ssCV    = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
  const sheetCl = ssCV.getSheetByName('Cl');
  const sheetCV = ssCV.getSheetByName('Compra-venta');

  const c      = pedido.cliente;
  const cedula = c.cedula || c.id || c.telefono;
  const fechaHoy = new Date();

  // 1. REGISTRO EN "Cl"
  let clIdx  = -1;
  const clVal = sheetCl.getDataRange().getValues();
  for (let i = 1; i < clVal.length; i++) {
    if (clVal[i][0] == cedula || clVal[i][2] == c.telefono) { clIdx = i + 1; break; }
  }
  const newClRow = [cedula, c.nombre, c.telefono, c.email || '', c.direccion, c.municipio, c.departamento, fechaHoy];
  if (clIdx > 0) sheetCl.getRange(clIdx, 1, 1, newClRow.length).setValues([newClRow]);
  else           sheetCl.appendRow(newClRow);

  // 2. REGISTRO EN "Compra-venta" (mapeo exacto de v4.1 - NO MODIFICAR)
  // NOTA: I1 en la hoja tiene la fórmula del contador de facturas (el valor 1877)
  let currentFactura = parseInt(sheetCV.getRange('I1').getValue()) || 0;
  const nextF = currentFactura + 1;
  const pV    = pedido.producto.precio;

  var rowData  = new Array(20).fill('');
  rowData[0]   = pedido.producto.specsConcatenadas;
  rowData[1]   = fechaHoy;
  rowData[2]   = pedido.producto.costo || 0;
  rowData[5]   = pedido.producto.provider || pedido.producto.proveedor || 'JRTech';
  rowData[8]   = 'Vendido';
  rowData[11]  = 1;
  rowData[12]  = nextF;
  rowData[13]  = fechaHoy;
  rowData[14]  = 365;
  rowData[15]  = cedula;
  rowData[16]  = pV;
  rowData[17]  = pV;
  rowData[19]  = pV - (pedido.producto.costo || 0);

  sheetCV.appendRow(rowData);
  const lastRow = sheetCV.getLastRow();
  sheetCV.getRange(lastRow, 5).setBackground('#ff9900');
  sheetCV.getRange('I1').setValue(nextF);

  // NUEVO: Estado inicial en columna del portal
  asegurarColumnas(sheetCV, NUEVAS_COLS_CV);
  escribirEnCol(sheetCV, lastRow, 'ESTADO_PORTAL', 'Recibido');

  return { success: true, factura: nextF };
}

// ══════════════════════════════════════════════
// CATÁLOGO (SIN CAMBIOS DE v4.2)
// ══════════════════════════════════════════════

function getCatalogData() {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_COMPILADOS);
    const sheet   = ss.getSheetByName('PORTATILES');
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const catalog = data.slice(1).map((row, i) => {
      const item = { id: 'ITM' + i, specs: {} };
      headers.forEach((h, c) => {
        const val = String(row[c] || '').trim();
        if      (h === 'enlace_foto') item.foto   = val;
        else if (h === 'precio')      item.precio = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        else if (h === 'marca')       item.marca  = val;
        else if (h === 'modelo')      item.modelo = val;
        else if (h !== '')            item.specs[h] = val;
      });
      if (!item.marca || item.marca === 'N/A' || item.marca === 'N/D') return null;
      return item;
    }).filter(Boolean);
    const f = ['marca','procesador','ram','tipo_ram','ssd','pantalla','grafica','vram'];
    return { items: catalog, filters: extractFilters(catalog, f), rangos: { Precio: { min: Math.min(...catalog.map(i=>i.precio)), max: Math.max(...catalog.map(i=>i.precio)) } } };
  } catch(e) { return { error: e.toString() }; }
}

function getCelularesData() {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_COMPILADOS);
    const sheet   = ss.getSheetByName('CELULARES');
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const items   = data.slice(1).map((row, i) => {
      const item = { id: 'CEL' + i };
      headers.forEach((h, c) => {
        const val = String(row[c] || '').trim();
        if      (h === 'enlace_foto') item.foto   = val;
        else if (h === 'precio')      item.precio = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        else if (h !== '')            item[h]     = val;
      });
      if (!item.marca || item.marca === 'N/A') return null;
      return item;
    }).filter(Boolean);
    const f = ['marca','ram','rom','procesador','red_5g','nfc','jack'];
    return { items, filters: extractFilters(items, f), rangos: { Precio: { min: Math.min(...items.map(i=>i.precio)), max: Math.max(...items.map(i=>i.precio)) } } };
  } catch(e) { return { error: e.toString() }; }
}

function getTabletsData() {
  try {
    const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_COMPILADOS);
    const sheet   = ss.getSheetByName('TABLETS');
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const items   = data.slice(1).map((row, i) => {
      const item = { id: 'TAB' + i };
      headers.forEach((h, c) => {
        const val = String(row[c] || '').trim();
        if      (h === 'enlace_foto') item.foto   = val;
        else if (h === 'precio')      item.precio = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        else if (h !== '')            item[h]     = val;
      });
      if (!item.marca || item.marca === 'N/D') return null;
      return item;
    }).filter(Boolean);
    return { items, filters: extractFilters(items, ['marca','ram','rom']), rangos: { Precio: { min: Math.min(...items.map(i=>i.precio)), max: Math.max(...items.map(i=>i.precio)) } } };
  } catch(e) { return { error: e.toString() }; }
}

function extractFilters(items, keys) {
  const filters = {};
  keys.forEach(k => {
    const vals = items.map(it => it[k] || (it.specs && it.specs[k])).filter(v => v && v !== '' && v !== 'N/A' && v !== 'N/D');
    if (vals.length > 0) filters[k] = [...new Set(vals)].sort();
  });
  return filters;
}

// ══════════════════════════════════════════════
// UTILIDADES DE CONFIGURACIÓN (ejecutar una sola vez)
// ══════════════════════════════════════════════

/**
 * ▶ PASO 1: Ejecuta esta función UNA VEZ para establecer el token secreto del admin.
 *   Cámbia el valor de 'miToken' antes de correrla.
 */
function setAdminToken() {
  const miToken = 'CAMBIA_ESTO_POR_TU_CLAVE_SECRETA_2025';
  PropertiesService.getScriptProperties().setProperty(PROP_ADMIN_TOKEN, miToken);
  Logger.log('✅ Token admin guardado: ' + miToken);
}

/**
 * ▶ PASO 2: Ejecuta esta función UNA VEZ para crear las columnas del portal
 *   en tus hojas (al final, sin tocar nada existente).
 */
function inicializarColumnasPortal() {
  const ss      = SpreadsheetApp.openById(SPREADSHEET_ID_CV);
  asegurarColumnas(ss.getSheetByName('Compra-venta'), NUEVAS_COLS_CV);
  asegurarColumnas(ss.getSheetByName('Cl'),           [NUEVA_COL_CL]);
  SpreadsheetApp.getUi().alert('✅ Columnas del portal creadas correctamente.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🧠 JR Tech Tools')
    .addItem('🔄 Limpiar Caché',            'invalidarCache')
    .addItem('🏗️ Inicializar Portal',       'inicializarColumnasPortal')
    .addItem('🔑 Establecer Token Admin',   'setAdminToken')
    .addToUi();
}

function invalidarCache() {
  const cache = CacheService.getScriptCache();
  ['catalog_portatiles','catalog_celulares','catalog_tablets'].forEach(k => cache.remove(k));
  SpreadsheetApp.getUi().alert('Caché limpiado.');
}
