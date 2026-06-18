/**
 * CONFIGURACIÓN DE APIS Y VARIABLES GLOBALES
 * Asegúrate de configurar las Propiedades del Script en el editor:
 * - OPENAI_API_KEY
 * - GOOGLE_SEARCH_API_KEY (Opcional)
 * - GOOGLE_SEARCH_CX (Opcional)
 */
function getBusinessConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("CONFIG");
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    const config = {};
    
    data.forEach(row => {
      if (row[0] && row[1]) {
        config[row[0]] = row[1];
      }
    });
    
    return config;
  } catch(e) {
    return null;
  }
}

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    OPENAI_KEY: props.getProperty('OPENAI_API_KEY'),
    GOOGLE_SEARCH_KEY: props.getProperty('GOOGLE_SEARCH_API_KEY'),
    SEARCH_CX: props.getProperty('GOOGLE_SEARCH_CX')
  };
}

function getCatalogData() {
  return getLaptopStyleData('PORTATILES', 'catalog_portatiles_v2', 'ITM');
}

function getEscritorioData() {
  return getLaptopStyleData('ESCRITORIO', 'catalog_escritorio_v2', 'ESC');
}

function getLaptopStyleData(sheetName, cacheKey, idPrefix) {
  try {
    const cached = getCacheLarge(cacheKey);
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: `No existe la hoja ${sheetName}.` };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { error: "La hoja está vacía." };

    // Mapeo dinámico por encabezados
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = data.slice(1);

    const idx = {
      cod:            headers.indexOf('cod'),
      marca:          headers.indexOf('marca'),
      modelo:         headers.indexOf('modelo'),
      procesador:     headers.indexOf('procesador'),
      ram:            headers.indexOf('ram'),
      tipo_ram:       headers.indexOf('tipo_ram'),
      ssd:            headers.indexOf('ssd'),
      sistema:        headers.indexOf('sistema'),
      pantalla:       headers.indexOf('pantalla'),
      tipo_pantalla:  headers.indexOf('tipo_pantalla'),
      grafica:        headers.indexOf('grafica'),
      modelo_grafica: headers.indexOf('modelo_grafica'),
      vram:           headers.indexOf('vram'),
      precio:         headers.indexOf('precio'),
      enlace_foto:    headers.indexOf('enlace_foto'),
      enlace_logo:    headers.indexOf('enlace_logo'),
      enlace_banner:  headers.indexOf('enlace_banner'),
      uso_recomendado: headers.indexOf('uso recomendado')
    };

    const get = (row, key) => {
      const i = idx[key];
      return i >= 0 && row[i] !== undefined && row[i] !== null
        ? String(row[i]).trim()
        : "N/A";
    };

    const catalog = rows.map((row, i) => {
      if (!get(row, 'marca') || get(row, 'marca') === 'N/A') return null;

      return {
        id:      idPrefix + i,
        cod:     get(row, 'cod'),
        marca:   get(row, 'marca'),
        modelo:  get(row, 'modelo'),
        specs: {
          "Procesador":     get(row, 'procesador'),
          "RAM":            get(row, 'ram'),
          "Tipo RAM":       get(row, 'tipo_ram'),
          "SSD":            get(row, 'ssd'),
          "Almacenamiento": get(row, 'ssd'),
          "Sistema":        get(row, 'sistema'),
          "Pantalla": (() => {
            const match = get(row, 'pantalla').match(/(\d+[.,]\d+|\d+)/);
            return match ? match[1].replace(',', '.') + '"' : get(row, 'pantalla');
          })(),
          "Tipo Pantalla":  get(row, 'tipo_pantalla'),
          "Gráfica":        get(row, 'grafica'),
          "Modelo Gráfica": get(row, 'modelo_grafica'),
          "Tamaño Gráfica": get(row, 'vram'),
          "VRAM":           get(row, 'vram')
        },
        precio:   parseFloat(get(row, 'precio').replace(/[^0-9.]/g, '')) || 0,
        foto:     get(row, 'enlace_foto') !== 'N/A' ? get(row, 'enlace_foto') : '',
        logo:     get(row, 'enlace_logo') !== 'N/A' ? get(row, 'enlace_logo') : '',
        banner:   get(row, 'enlace_banner') !== 'N/A' ? get(row, 'enlace_banner') : '',
        uso_recomendado: get(row, 'uso_recomendado') !== 'N/A' ? get(row, 'uso_recomendado') : '',
        fullText: row.join(" ").toLowerCase()
      };

      item.aiInsight = generarComentarioPortatilIA(item);
      return item;
    }).filter(Boolean);

    const filters = {
      "Marca":          [...new Set(catalog.map(it => it.marca))].filter(v => v && v !== "N/A").sort(),
      "RAM": [...new Set(catalog.map(it => it.specs["RAM"]))].filter(v => v && v !== "N/A" && v !== "0").sort((a, b) => parseInt(a) - parseInt(b)),
      "Tipo RAM": [...new Set(catalog.map(it => it.specs["Tipo RAM"]))].filter(v => v && v !== "N/A" && v !== "N/D").sort(),
      "Almacenamiento": [...new Set(catalog.map(it => it.specs["Almacenamiento"]))].filter(v => v && v !== "N/A").sort(),
      "Procesador":     [...new Set(catalog.map(it => it.specs["Procesador"]))].filter(v => v && v !== "N/A").sort(),
      "Pantalla": [...new Set(catalog.map(it => {
          return String(it.specs["Pantalla"]).replace(',', '.').replace(/"+$/, '"').trim();
        }))].filter(v => v && v !== "N/A" && v !== "N/D").sort(),
      "Tipo Pantalla":  [...new Set(catalog.map(it => it.specs["Tipo Pantalla"]))].filter(v => v && v !== "N/A").sort(),
      "Sistema":        [...new Set(catalog.map(it => it.specs["Sistema"]))].filter(v => v && v !== "N/A").sort(),
      "Gráfica":        [...new Set(catalog.map(it => it.specs["Gráfica"]))].filter(v => v && v !== "N/A").sort(),
      "Modelo Gráfica": [...new Set(catalog.map(it => it.specs["Modelo Gráfica"]))].filter(v => v && v !== "N/A").sort(),
      "VRAM":           [...new Set(catalog.map(it => it.specs["VRAM"]))].filter(v => v && v !== "N/A").sort()
    };

    const resultado = {
      items: catalog,
      filters: filters,
      headers: Object.keys(catalog[0]?.specs || {}),
      rangos: {
        "RAM": {
          min: Math.min(...catalog.map(it => parseInt(it.specs["RAM"]) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.specs["RAM"]) || 0))
        },
        "SSD": {
          min: Math.min(...catalog.map(it => parseInt(it.specs["SSD"]) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.specs["SSD"]) || 0))
        },
        "Pantalla": {
          min: Math.min(...catalog.map(it => parseFloat(String(it.specs["Pantalla"])) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseFloat(String(it.specs["Pantalla"])) || 0))
        },
        "Precio": {
          min: Math.min(...catalog.map(it => it.precio || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => it.precio || 0))
        }
      }
    };

    putCacheLarge(cacheKey, resultado, 600);

    return resultado;

  } catch(e) {
    return { error: "Error de Servidor: " + e.toString() };
  }
}

function getCelularesData() {
  return getMobileStyleData({
    sheetName: "CELULARES",
    cacheKey: "catalog_celulares",
    idPrefix: "CEL",
    colE: 5,
    fallbackStr: "N/A",
    isTablet: false
  });
}

function getTabletsData() {
  return getMobileStyleData({
    sheetName: "TABLETS",
    cacheKey: "catalog_tablets",
    idPrefix: "TAB",
    colE: 4,
    fallbackStr: "N/D",
    isTablet: true
  });
}

function getMobileStyleData(config) {
  try {
    const cached = getCacheLarge(config.cacheKey);
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(config.sheetName);
    if (!sheet) return { error: `No existe la hoja ${config.sheetName}.` };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { error: "La hoja está vacía." };

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = data.slice(1);

    const idx = {
      marca: headers.indexOf('marca'),
      modelo: headers.indexOf('modelo'),
      procesador: headers.indexOf('procesador'),
      ram: headers.indexOf('ram'),
      rom: headers.indexOf('rom'),
      pantalla: headers.indexOf('pantalla'),
      tipo_panel: headers.indexOf('tipo_panel'),
      resolucion: headers.indexOf('resolucion'),
      refresco: headers.indexOf('refresco'),
      bateria: headers.indexOf('bateria'),
      carga: headers.indexOf('carga'),
      cam_ppal: headers.indexOf('cam_ppal'),
      cam_selfie: headers.indexOf('cam_selfie'),
      red_5g: headers.indexOf('red_5g'),
      nfc: headers.indexOf('nfc'),
      android: headers.indexOf('android'),
      bluetooth: headers.indexOf('bluetooth'),
      litografia: headers.indexOf('litografia') !== -1 ? headers.indexOf('litografia') : headers.indexOf('nm'),
      jack: headers.indexOf('jack'),
      antutu: headers.indexOf('antutu'),
      precio: headers.indexOf('precio'),
      enlace_foto: headers.indexOf('enlace_foto'),
      enlace_logo: headers.indexOf('enlace_logo'),
      uso_recomendado: headers.indexOf('uso recomendado'),
      peso: headers.indexOf('peso'),
      grosor: headers.indexOf('grosor'),
      wlan: headers.indexOf('wlan')
    };

    const colE = config.colE;
    const colAntutu = idx.antutu;
    const proveedoresHeaders = headers.slice(colE, colAntutu).filter(h => h && h !== '');

    const get = (row, key) => {
      const i = idx[key];
      return i >= 0 && row[i] !== undefined && row[i] !== null
        ? String(row[i]).trim()
        : config.fallbackStr;
    };

    const catalog = rows.map((row, i) => {
      if (!get(row, 'marca') || get(row, 'marca') === config.fallbackStr) return null;

      let proveedoresConPrecio = [];
      
      proveedoresHeaders.forEach((provHeader, idx) => {
        const colIndex = colE + idx;
        const precio = parseFloat(String(row[colIndex] || '0').replace(/[^0-9.]/g, '')) || 0;
        if (precio > 0) {
          proveedoresConPrecio.push({
            nombre: provHeader,
            precio: precio,
            iniciales: provHeader.substring(0, 2).toUpperCase()
          });
        }
      });

      proveedoresConPrecio.sort((a, b) => a.precio - b.precio);
      const palabraProveedores = proveedoresConPrecio.map(p => p.iniciales).join('');

      const item = {
        id: config.idPrefix + i,
        marca: config.isTablet ? get(row, 'marca') : get(row, 'marca').toUpperCase(),
        modelo: get(row, 'modelo'),
        procesador: get(row, 'procesador'),
        ram: get(row, 'ram'),
        rom: get(row, 'rom'),
        pantalla: get(row, 'pantalla'),
        tipo_panel: get(row, 'tipo_panel'),
        resolucion: get(row, 'resolucion'),
        refresco: get(row, 'refresco'),
        bateria: get(row, 'bateria'),
        carga: get(row, 'carga'),
        cam_ppal: get(row, 'cam_ppal'),
        cam_selfie: get(row, 'cam_selfie'),
        red_5g: get(row, 'red_5g'),
        nfc: get(row, 'nfc'),
        android: get(row, 'android'),
        bluetooth: get(row, 'bluetooth'),
        litografia: get(row, 'litografia'),
        jack: get(row, 'jack'),
        antutu: get(row, 'antutu'),
        precio: parseFloat(get(row, 'precio').replace(/[^0-9.]/g, '')) || 0,
        foto: get(row, 'enlace_foto') !== config.fallbackStr ? get(row, 'enlace_foto') : '',
        logo: get(row, 'enlace_logo') !== config.fallbackStr ? get(row, 'enlace_logo') : '',
        proveedor: palabraProveedores,
        uso_recomendado: get(row, 'uso_recomendado') !== config.fallbackStr ? get(row, 'uso_recomendado') : '',
        fullText: config.isTablet ? `${get(row,'marca')} ${get(row,'modelo')} ${get(row,'ram')} ${get(row,'rom')} ${get(row,'procesador')}`.toLowerCase() : row.join(" ").toLowerCase()
      };

      if (config.isTablet) {
        item.peso = get(row, 'peso');
        item.grosor = get(row, 'grosor');
        item.wlan = get(row, 'wlan');
      }

      return item;
    }).filter(Boolean);

    let filters = {
      "Marca": [...new Set(catalog.map(it => it.marca))].filter(v => v && v !== config.fallbackStr).sort(),
      "Procesador": [...new Set(catalog.map(it => it.procesador))].filter(v => v && v !== config.fallbackStr).sort(),
      "RAM": [...new Set(catalog.map(it => it.ram))].filter(v => v && v !== config.fallbackStr).sort(),
      "Almacenamiento": [...new Set(catalog.map(it => it.rom))].filter(v => v && v !== config.fallbackStr).sort(),
      "Pantalla": [...new Set(catalog.map(it => it.pantalla))].filter(v => v && v !== config.fallbackStr).sort(),
      "Tipo Panel": [...new Set(catalog.map(it => it.tipo_panel))].filter(v => v && v !== config.fallbackStr).sort(),
      "Batería": [...new Set(catalog.map(it => it.bateria))].filter(v => v && v !== config.fallbackStr).sort(),
      "5G": [...new Set(catalog.map(it => it.red_5g))].filter(v => v).sort(),
      "NFC": [...new Set(catalog.map(it => it.nfc))].filter(v => v).sort(),
      "Android": [...new Set(catalog.map(it => it.android))].filter(v => v && v !== config.fallbackStr).sort()
    };

    if (config.isTablet) {
      filters["Carga"] = [...new Set(catalog.map(it => it.carga))].filter(v => v && v !== config.fallbackStr).sort();
    } else {
      filters["AnTuTu"] = [...new Set(catalog.map(it => it.antutu))].filter(v => v && v !== config.fallbackStr).sort();
    }

    const resultado = {
      items: catalog,
      filters: filters,
      rangos: {
        "Precio": {
          min: Math.min(...catalog.map(it => it.precio || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => it.precio || 0))
        },
        "Batería": {
          min: Math.min(...catalog.map(it => parseInt(it.bateria) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.bateria) || 0))
        },
        "RAM": {
          min: Math.min(...catalog.map(it => parseInt(it.ram) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.ram) || 0))
        },
        "Almacenamiento": {
          min: Math.min(...catalog.map(it => parseInt(it.rom) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.rom) || 0))
        },
        "AnTuTu": {
          min: Math.min(...catalog.map(it => parseInt(it.antutu) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.antutu) || 0))
        },
        "Cámara principal": {
          min: Math.min(...catalog.map(it => parseInt(it.cam_ppal) || 0).filter(v => v > 0)),
          max: Math.max(...catalog.map(it => parseInt(it.cam_ppal) || 0))
        }
      }
    };

    putCacheLarge(config.cacheKey, resultado, 600);
    return resultado;

  } catch(e) {
    return { error: "Error de Servidor: " + e.toString() };
  }
}
function getImpresorasData() {
  try {
    const cached = getCacheLarge('catalog_impresoras');
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("IMPRESORAS");
    if (!sheet) return { error: "No existe la hoja IMPRESORAS." };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { error: "La hoja está vacía." };

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = data.slice(1);

    const items = rows.map((row, i) => {
      const item = { id: 'IMP' + i, specs: {} };
      
      headers.forEach((h, c) => {
        const val = String(row[c] || '').trim();
        if      (h === 'enlace foto') item.foto   = val;
        else if (h === 'precio')      item.precio = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        else if (h === 'marca')       item.marca  = val;
        else if (h === 'modelo')      item.modelo = val;
        else if (h === 'enlace logo') item.specs.enlace_logo = val;
        else if (h === 'especificaciones') {
    item.especificaciones_texto = val;
    const text = val.toUpperCase();
    
    // 1. Tipo
    if (text.includes('MULTIFUNCIONAL')) item.specs.tipo = 'Multifuncional';
    else item.specs.tipo = 'Solo Impresión';
    
    // 2. Tecnología + Color (con lógica de negocio)
    if (text.includes('TINTA CONTINUA') || text.includes('RECARGA CONTINUA')) {
        item.specs.tecnologia = 'Tinta Continua';
        // Tinta continua puede ser color o mono
        item.specs.color = text.includes('MONOCROMATICA') ? 'Monocromática' : 'A Color';
    } else if (text.includes('MATRIZ DE PUNTO')) {
        item.specs.tecnologia = 'Matriz de Punto';
        item.specs.color = 'Monocromática'; // Siempre mono
    } else if (text.includes('LASER') || text.includes('LASERJET') || text.includes('MONOCROMATICA')) {
        item.specs.tecnologia = 'Láser';
        item.specs.color = 'Monocromática'; // Siempre mono
    } else {
        // Si no es mono ni las anteriores, es tinta a color
        item.specs.tecnologia = 'Tinta Continua';
        item.specs.color = 'A Color';
    }
    
    // 3. Dúplex
    if (text.includes('DUPLEX')) item.specs.duplex = 'Sí';
    else item.specs.duplex = 'No';
    
    // 4. Conectividad
    let conectividad = [];
    if (text.includes('WIFI') || text.includes('WI-FI')) conectividad.push('Wi-Fi');
    if (text.includes('ETHERNET') || text.includes('LAN') || text.includes('PUERTO RED')) conectividad.push('Ethernet (Red)');
    if (text.includes('USB')) conectividad.push('USB');
    item.specs.conectividad = conectividad.length > 0 ? conectividad.join(' + ') : 'No especificada';
}

      });
      
      if (!item.marca || item.marca === 'N/A' || item.marca === '') return null;
      return item;
    }).filter(Boolean);

    // Extraer filtros únicos
    const filters = {
      "Marca": [...new Set(items.map(it => it.marca))].filter(v => v).sort(),
      "Tipo": [...new Set(items.map(it => it.specs.tipo))].filter(v => v).sort(),
      "Tecnología": [...new Set(items.map(it => it.specs.tecnologia))].filter(v => v).sort(),
      "Color": [...new Set(items.map(it => it.specs.color))].filter(v => v).sort(),
      "Doble Cara": [...new Set(items.map(it => it.specs.duplex))].filter(v => v).sort()
    };

    const minPrecio = items.length > 0 ? Math.min(...items.map(i=>i.precio).filter(v=>v>0)) : 0;
    const maxPrecio = items.length > 0 ? Math.max(...items.map(i=>i.precio)) : 0;

    const resultado = {
      items: items,
      filters: filters,
      rangos: { "Precio": { min: minPrecio, max: maxPrecio } }
    };

    putCacheLarge('catalog_impresoras', resultado, 600);
    return resultado;

  } catch(e) { return { error: "Error de Servidor: " + e.toString() }; }
}

function procesarSolicitudChat(historial) {
  try {
    const config = getConfig();
    const OPENAI_API_KEY = config.OPENAI_KEY;
    if (!OPENAI_API_KEY) return "Error: API Key no configurada.";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. PRE-FILTRADO INTELIGENTE (Reduce el tamaño del prompt y aumenta precisión)
    // Analizar el historial para detectar intención de categoría
    const lastUserMessage = historial.length > 0 ? historial[historial.length - 1].content.toLowerCase() : "";
    let categoriasRequeridas = {
      portatiles: /port[aá]til|computador|laptop|pc/i.test(lastUserMessage),
      celulares: /celular|tel[eé]fono|smartphone|iphone|movil|cel/i.test(lastUserMessage),
      tablets: /tablet|ipad|tableta/i.test(lastUserMessage)
    };
    
    // Si no detecta nada específico en este mensaje, miramos todo el historial rápidamente
    const sinCategoriaClara = !categoriasRequeridas.portatiles && !categoriasRequeridas.celulares && !categoriasRequeridas.tablets;
    if (sinCategoriaClara) {
      const fullHistory = historial.map(h => h.content.toLowerCase()).join(" ");
      categoriasRequeridas.portatiles = /port[aá]til|computador|laptop|pc/i.test(fullHistory);
      categoriasRequeridas.celulares = /celular|tel[eé]fono|smartphone|iphone|movil|cel/i.test(fullHistory);
      categoriasRequeridas.tablets = /tablet|ipad|tableta/i.test(fullHistory);
      
      // Si aún así no hay nada, cargamos todo por precaución
      if (!categoriasRequeridas.portatiles && !categoriasRequeridas.celulares && !categoriasRequeridas.tablets) {
        categoriasRequeridas = { portatiles: true, celulares: true, tablets: true };
      }
    }

    let inventarioFiltrado = {};

    // 2. EXTRACCIÓN EN FORMATO JSON MINIFICADO
    const extractData = (sheetName, type) => {
      const hoja = ss.getSheetByName(sheetName);
      if (!hoja) return [];
      const data = hoja.getDataRange().getValues();
      const h = data[0].map(x => String(x).trim().toLowerCase());
      
      return data.slice(1).filter(r => {
        if (!r[h.indexOf('marca')] || !r[h.indexOf('precio')]) return false;
        const precio = parseFloat(String(r[h.indexOf('precio')]).replace(/[^0-9.]/g, '')) || 0;
        return precio > 0;
      }).map(r => {
        const g = (key) => {
          const i = h.indexOf(key);
          return i >= 0 && r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : '';
        };
        
        // Claves súper cortas para ahorrar tokens: m=marca, mod=modelo, p=precio, cpu=procesador, etc.
        let item = { m: g('marca'), mod: g('modelo'), p: parseFloat(String(g('precio')).replace(/[^0-9.]/g, '')) };
        
        if (type === 'portatil') {
          item.cpu = g('procesador'); item.ram = parseInt(g('ram')) || 0; item.ssd = parseInt(g('ssd')) || 0;
          const grafica = g('grafica').toLowerCase();
          item.gpu = (grafica !== 'no' && grafica !== 'n/a' && grafica !== '') ? g('grafica') : 'Int';
        } else {
          item.cpu = g('procesador'); item.ram = parseInt(g('ram')) || 0; item.rom = parseInt(g('rom')) || 0;
          item.bat = parseInt(g('bateria')) || 0; item.antutu = parseInt(g('antutu')) || 0;
          if (type === 'celular') { item.cam = parseInt(g('cam_ppal')) || 0; }
        }
        return item;
      });
    };

    if (categoriasRequeridas.portatiles) inventarioFiltrado.portatiles = extractData('PORTATILES', 'portatil');
    if (categoriasRequeridas.celulares) inventarioFiltrado.celulares = extractData('CELULARES', 'celular');
    if (categoriasRequeridas.tablets) inventarioFiltrado.tablets = extractData('TABLETS', 'tablet');

    const jsonInventarioStr = JSON.stringify(inventarioFiltrado);

    // 3. PROMPT OPTIMIZADO PARA RAZONAMIENTO ESTRUCTURADO
    const sistemaPrompt = `
Eres Camilo, asesor comercial senior de JR TECH — tienda de tecnología colombiana. Eres un experto apasionado por la tecnología y te tomas el tiempo de asesorar de forma detallada, profunda y muy persuasiva a cada cliente.

DIFERENCIADORES DE JR TECH:
- Honestidad absoluta: prefieres NO vender antes que vender algo que no le sirve al cliente.
- En portátiles: envío gratis, soporte técnico remoto, Windows y Office licenciados, equipo configurado.
- Garantías atendidas con diligencia.

TU MÉTODO DE TRABAJO:
1. IDENTIFICA: Asegúrate de saber qué busca, uso principal y presupuesto disponible. Si no los tienes, consúltalos amablemente.
2. RECOMIENDA EL MEJOR EQUIPO: Usa el JSON de INVENTARIO para encontrar el equipo perfecto que no supere el presupuesto.
3. ASESORÍA PROFUNDA Y CONVINCENTE (MUY IMPORTANTE): ¡No seas breve! Toma la información del JSON y crea un argumento de venta sólido, completo y persuasivo. 
   - Tómate el tiempo de listar y explicar sus características (Procesador, Batería, RAM, Almacenamiento, Cámara, Pantalla).
   - EXPRIME LOS DATOS: Si tiene batería de 5000mAh, explícale que "le durará el día entero sin preocuparse por el cargador". Si es para fotos, resalta los megapíxeles y cómo eso mejorará sus redes. Si tiene RAM alta, menciónale que "podrá abrir muchas aplicaciones al tiempo sin que se trabe".
   - Hazle sentir al cliente que analizaste todo el catálogo y elegiste este equipo específicamente para resolver SU necesidad puntual.
   - Menciona el precio del equipo y demuestra por qué es una inversión excelente por todo el valor que aporta.
4. REGLA ESTRICTA DE PRESUPUESTO: NUNCA recomiendes un equipo más caro que el presupuesto indicado. Si no hay, ofrécele la alternativa más cercana y justifícala.
5. NO INVENTES: Recomienda SOLO los modelos incluidos en el JSON adjunto.
6. CIERRE: Siempre finaliza invitando a contactar a Albeiro para ver fotos reales o concretar la compra. Genera el enlace así (cambiando [EQUIPO] por el nombre del modelo): https://wa.me/573128590469?text=Hola+Albeiro%2C+Camilo+me+recomendó+el+[EQUIPO]

INVENTARIO DISPONIBLE (JSON - m:marca, mod:modelo, p:precio, cpu:procesador, bat:batería mAh, cam:cámara MP, gpu:gráfica):
${jsonInventarioStr}

REGLAS DE TONO:
- Español colombiano, muy cálido, empático y servicial.
- Evita el uso de Markdown como asteriscos (*) o negrillas. Escribe texto limpio, separado por párrafos cortos para facilitar la lectura.
- Usa emojis de manera estratégica para hacer la lectura agradable.
- Esfuérzate en dar una respuesta completa, entusiasta y muy bien argumentada. ¡Demuestra todo tu conocimiento técnico!
`;

    const messages = [
      { role: "system", content: sistemaPrompt },
      ...historial
    ];

    const opciones = {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + OPENAI_API_KEY },
      payload: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.5, // Más precisión lógica
        max_tokens: 500
      }),
      muteHttpExceptions: true
    };
    
    console.log("Tamaño del prompt optimizado:", JSON.stringify(messages).length, "caracteres");
    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", opciones);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      console.error("Error OpenAI:", json.error);
      return "Tuve un lapso técnico, pregúntame de nuevo 🙏";
    }

    return json.choices[0].message.content.trim();

  } catch(e) {
    console.error("Error Chat:", e.toString());
    return "Dame un momento... pregúntame de nuevo por favor 🔧";
  }
}

function doGet(e) {
  // 1. CAPTURAMOS PARÁMETROS
  const viewParam = (e && e.parameter && e.parameter.view) ? e.parameter.view : '';
  const apiParam = (e && e.parameter && e.parameter.api) ? e.parameter.api : '';
  // 2. NUEVO: LÓGICA DE API JSON
  // Si la URL recibe ?api=categoria devolvemos los datos puros en JSON
  if (apiParam === 'celulares') {
    return ContentService.createTextOutput(JSON.stringify(getCelularesData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (apiParam === 'portatiles') {
    return ContentService.createTextOutput(JSON.stringify(getCatalogData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (apiParam === 'tablets') {
    return ContentService.createTextOutput(JSON.stringify(getTabletsData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (apiParam === 'impresoras') {
    return ContentService.createTextOutput(JSON.stringify(getImpresorasData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (apiParam === 'escritorio') {
    return ContentService.createTextOutput(JSON.stringify(getEscritorioData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (apiParam === 'proxy') {
    const proxyUrl = (e && e.parameter && e.parameter.url) ? e.parameter.url : '';
    if (proxyUrl) {
      try {
        const response = UrlFetchApp.fetch(proxyUrl, { muteHttpExceptions: true });
        if (response.getResponseCode() === 200) {
          const blob = response.getBlob();
          const b64 = Utilities.base64Encode(blob.getBytes());
          const contentType = blob.getContentType();
          return ContentService.createTextOutput(`data:${contentType};base64,${b64}`)
            .setMimeType(ContentService.MimeType.TEXT);
        } else {
          return ContentService.createTextOutput("ERROR_HTTP_" + response.getResponseCode()).setMimeType(ContentService.MimeType.TEXT);
        }
      } catch(err) {
        return ContentService.createTextOutput("ERROR_" + err.toString()).setMimeType(ContentService.MimeType.TEXT);
      }
    }
    return ContentService.createTextOutput("ERROR_NO_URL").setMimeType(ContentService.MimeType.TEXT);
  }

  // 3. LÓGICA ANTERIOR: Si no hay parámetro API, cargamos la página web normal
  const biz = getBusinessConfig();
  const titulo = biz ? biz['texto_titulo'] : 'Catálogo Oficial';
  const template = HtmlService.createTemplateFromFile('index');
  template.pubUrl = ScriptApp.getService().getUrl();
  template.bizConfig = JSON.stringify(biz || {});
  template.viewParam = viewParam;
  return template.evaluate()
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function generarComentarioIA(datos) {
  const {
    antutu = 0,
    bateria = 0,
    pantalla = 0,
    refresco = 0,
    camPrincipal = 0,
    camSelfie = 0,
    precio = 0,
    red5g = ""
  } = datos;

  let puntosFuertes = [];
  let idealPara = [];
  let noRecomendado = [];

  // =========================
  // CLASIFICACIÓN DE GAMA
  // =========================
  let gama = "Entrada";
  if (antutu >= 900000) gama = "Alta";
  else if (antutu >= 600000) gama = "Media-Alta";
  else if (antutu >= 400000) gama = "Media";
  else if (antutu >= 250000) gama = "Media-Baja";

  // =========================
  // SCORE DE RENDIMIENTO
  // =========================
  let score = 0;

  if (antutu >= 900000) score += 4;
  else if (antutu >= 600000) score += 3;
  else if (antutu >= 400000) score += 2;
  else if (antutu >= 250000) score += 1;

  if (refresco >= 120) score += 1;
  if (bateria >= 5000) score += 1;

  // =========================
  // RENDIMIENTO
  // =========================
  if (score >= 5) {
    puntosFuertes.push("Rendimiento sobresaliente con excelente proyección a varios años");
    idealPara.push("gaming exigente", "multitarea intensiva", "usuarios avanzados");
  } else if (score >= 3) {
    puntosFuertes.push("Rendimiento sólido y equilibrado para uso diario exigente");
    idealPara.push("redes sociales", "streaming", "trabajo móvil");
  } else {
    puntosFuertes.push("Rendimiento enfocado en tareas básicas con consumo contenido");
    idealPara.push("llamadas", "WhatsApp", "uso ligero");
    noRecomendado.push("gaming pesado", "edición de video");
  }

  // =========================
  // PANTALLA
  // =========================
  if (refresco >= 120) {
    puntosFuertes.push("Pantalla de alta fluidez que mejora la experiencia visual");
  }

  // =========================
  // BATERÍA
  // =========================
  if (bateria >= 6000) {
    puntosFuertes.push("Autonomía sobresaliente pensada para jornadas extensas");
    idealPara.push("viajes", "trabajo en movilidad");
  } else if (bateria < 4500 && bateria > 0) {
    noRecomendado.push("uso intensivo todo el día sin recarga");
  }

  // =========================
  // CÁMARAS
  // =========================
  if (camPrincipal >= 108) {
    puntosFuertes.push("Sensor de alta resolución ideal para fotografía detallada");
    idealPara.push("creadores de contenido", "fotografía social");
  } else if (camPrincipal > 0 && camPrincipal < 48) {
    noRecomendado.push("fotografía exigente en baja luz");
  }

  if (camSelfie >= 32) {
    puntosFuertes.push("Cámara frontal destacada para videollamadas y redes");
  }

  // =========================
  // 5G
  // =========================
  if (String(red5g).toUpperCase() === "SI") {
    puntosFuertes.push("Compatibilidad 5G que mejora su proyección futura");
  }

  // =========================
  // PRECIO VS GAMA
  // =========================
  if (precio > 0) {
    if (precio < 1000000 && gama === "Media") {
      puntosFuertes.push("Muy buena relación precio-rendimiento dentro de su segmento");
    }
    if (precio > 3000000 && gama === "Media-Baja") {
      noRecomendado.push("usuarios que buscan máxima potencia por su inversión");
    }
  }

  return {
    resumen: puntosFuertes.slice(0, 3).join(". ") + ".",
    idealPara: [...new Set(idealPara)].slice(0, 5).join(", "),
    noRecomendado: [...new Set(noRecomendado)].slice(0, 4).join(", ")
  };
}

function convertirSeleccionAMayusculas() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rango = hoja.getActiveRange();
  var valores = rango.getValues();

  for (var i = 0; i < valores.length; i++) {
    for (var j = 0; j < valores[i].length; j++) {

      if (typeof valores[i][j] === 'string') {
        valores[i][j] = valores[i][j].toUpperCase();
      }

    }
  }

  rango.setValues(valores);
}

function generarFichaWhatsApp() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sh.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert("Selecciona una fila antes de generar la ficha");
    return;
  }

  // Mapeo dinámico por encabezados
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const fila = range.getRow();
  const r = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];

  const get = (key) => {
    const i = headers.indexOf(key);
    return i >= 0 && r[i] !== undefined && r[i] !== null ? r[i] : "";
  };

  const nf = (v) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? v : n.toLocaleString("es-CO");
  };

  const marca        = get('marca');
  const modelo       = get('modelo');
  const ram          = get('ram');
  const rom          = get('rom');
  const precio       = parseFloat(String(get('precio')).replace(/[^0-9.]/g, '')) || 0;
  const pantalla     = get('pantalla');
  const tipo_panel   = get('tipo_panel');
  const resolucion   = get('resolucion');
  const refresco     = get('refresco');
  const peso         = get('peso');
  const grosor       = get('grosor');
  const procesador   = get('procesador');
  const litografia   = get('litografia');
  const antutu       = get('antutu');
  const bateria      = get('bateria');
  const carga        = get('carga');
  const cam_ppal     = get('cam_ppal');
  const cam_selfie   = get('cam_selfie');
  const red_5g       = get('red_5g');
  const android      = get('android');
  const bluetooth    = get('bluetooth');
  const wlan         = get('wlan');
  const nfc          = get('nfc');
  const jack         = get('jack');

  const ia = generarComentarioIA({
    antutu:       parseFloat(antutu) || 0,
    bateria:      parseFloat(bateria) || 0,
    pantalla:     parseFloat(pantalla) || 0,
    refresco:     parseFloat(refresco) || 0,
    camPrincipal: parseFloat(cam_ppal) || 0,
    camSelfie:    parseFloat(cam_selfie) || 0,
    precio:       precio,
    red5g:        String(red_5g).toUpperCase()
  });

  const mensaje =
`📱 *${marca} ${modelo}*

✨ *Lo mejor de este equipo:*
${ia.resumen}

🎯 *Uso recomendado:*
${ia.idealPara}

⚠️ *No muy recomendado para:*
${ia.noRecomendado}
💾 *Memoria RAM:* ${nf(ram)} GB
💾 *Almacenamiento:* ${nf(rom)} GB
⚡ *Procesador:* ${procesador} (${nf(litografia)} nm)
🚀 *Rendimiento:* ${nf(antutu)} puntos Antutu
📺 *PANTALLA:*
- Tamaño: ${nf(pantalla)}"
- Tipo: ${tipo_panel}
- Resolución: ${resolucion}
- Frecuencia: ${nf(refresco)} Hz
📸 *CÁMARAS:*
- Principal: ${nf(cam_ppal)} MP
- Frontal: ${nf(cam_selfie)} MP
🔋 *Batería:* ${nf(bateria)} mAh
⚡ *Carga rápida:* ${nf(carga)} W
📡 *CONECTIVIDAD:*
- 5G: ${red_5g}
- Wi-Fi: ${wlan}
- Bluetooth: ${bluetooth}
- NFC: ${nfc}
- Jack 3.5 mm: ${jack}
📏 *DISEÑO:*
- Grosor: ${nf(grosor)} mm
- Peso: ${nf(peso)} g
🤖 *Android:* ${android}

💰 *Precio:* $${nf(precio)}
📦 Equipo nuevo, original y con garantía de un año.`;

  const htmlOutput = HtmlService
    .createHtmlOutput(`
      <html>
        <head>
          <base target="_top">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            textarea { width:100%; height:400px; font-family:monospace; font-size:14px; padding:10px; border:1px solid #ccc; border-radius:5px; resize:none; box-sizing:border-box; }
            button { margin-top:15px; padding:10px 20px; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer; font-size:16px; }
            button:hover { background:#15803d; }
          </style>
        </head>
        <body>
          <textarea id="mensaje" readonly>${mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
          <button onclick="copiarTexto()">📋 Copiar al portapapeles</button>
          <script>
            const textarea = document.getElementById('mensaje');
            textarea.focus();
            textarea.select();
            function copiarTexto() {
              textarea.select();
              document.execCommand('copy');
              alert('✅ Texto copiado al portapapeles');
            }
          <\/script>
        </body>
      </html>
    `)
    .setWidth(600)
    .setHeight(600);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📋 Ficha para WhatsApp');
}

function generarComentarioPortatilIA(item) {

  const safe = (v) => (v ?? "").toString().toLowerCase();
  const num = (v) => parseInt((v ?? "").toString().replace(/[^\d]/g, "")) || 0;

  const specs = item?.specs || {};

  const cpu = safe(specs["Procesador"]);
  const ram = num(specs["RAM"]);
  const ssd = num(specs["SSD"]);
  const pantallaTipo = safe(specs["Tipo Pantalla"]);
  const grafica = safe(specs["Modelo Gráfica"]);
  const precio = Number(item?.precio) || 0;

  let puntosFuertes = [];
  let idealPara = [];
  let noRecomendado = [];
  let gama = "Entrada";
  let score = 0;

  // ================= CPU =================
  if (cpu.includes("i7") || cpu.includes("ryzen 7")) {
    gama = "Alta";
    score += 3;
    puntosFuertes.push("Procesador de alto rendimiento preparado para cargas exigentes");
    idealPara.push("programación avanzada", "edición multimedia");
  }
  else if (cpu.includes("i5") || cpu.includes("ryzen 5")) {
    gama = "Media-Alta";
    score += 2;
    puntosFuertes.push("Procesador equilibrado para trabajo profesional y multitarea");
  }
  else if (cpu.includes("i3") || cpu.includes("ryzen 3")) {
    gama = "Media";
    score += 1;
  }

  // ================= RAM =================
  if (ram >= 16) {
    score += 2;
    puntosFuertes.push("Memoria adecuada para multitarea intensiva");
  } else if (ram >= 8) {
    score += 1;
  } else {
    noRecomendado.push("multitarea exigente");
  }

  // ================= SSD =================
  if (ssd >= 512) {
    puntosFuertes.push("Almacenamiento amplio con buena proyección de uso");
  } else if (ssd < 256 && ssd > 0) {
    noRecomendado.push("almacenamiento de grandes proyectos");
  }

  // ================= GRÁFICA =================
  if (grafica.includes("rtx") || grafica.includes("gtx")) {
    gama = "Alta";
    score += 2;
    puntosFuertes.push("Gráfica dedicada apta para gaming y diseño");
    idealPara.push("gaming", "renderizado");
  } else {
    noRecomendado.push("gaming exigente");
  }

  // ================= PANTALLA =================
  if (pantallaTipo.includes("fhd")) {
    puntosFuertes.push("Pantalla Full HD adecuada para productividad y multimedia");
  }

  // ================= DESBALANCE =================
  if (ram >= 16 && (cpu.includes("celeron") || cpu.includes("pentium"))) {
    noRecomendado.push("usuarios que esperan alto rendimiento del procesador");
  }

  // ================= PRECIO =================
  if (precio > 0) {
    if (precio < 2500000 && gama === "Alta") {
      puntosFuertes.push("Excelente relación potencia-precio en su segmento");
    }
    if (precio > 4500000 && gama === "Media") {
      noRecomendado.push("quienes buscan la mejor relación costo-beneficio");
    }
  }

  // ================= USO RECOMENDADO MANUAL =================
  if (item && item.uso_recomendado && item.uso_recomendado !== 'N/A' && item.uso_recomendado !== '') {
    idealPara = item.uso_recomendado.split(',').map(s => s.trim());
  }

  const resumen = puntosFuertes.length
    ? puntosFuertes.slice(0, 3).join(". ") + "."
    : "Equipo funcional para tareas generales.";

  const idealFinal = idealPara.length
    ? [...new Set(idealPara)].slice(0, 5).join(", ")
    : "uso general";

  const noRecFinal = noRecomendado.length
    ? [...new Set(noRecomendado)].slice(0, 4).join(", ")
    : "tareas altamente especializadas";

  return {
    gama: gama,
    resumen: resumen,
    idealPara: idealFinal,
    noRecomendado: noRecFinal,
    veredicto: `Equipo de gama ${gama} bien orientado a ${idealFinal.split(",")[0] || "uso general"}, con limitaciones previsibles en escenarios extremos.`
  };
}

function generarFichaWhatsAppPortatil() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sh.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert("Selecciona una fila antes de generar la ficha");
    return;
  }

  // Mapeo dinámico por encabezados
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const fila = range.getRow();
  const r = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];

  const get = (key) => {
    const i = headers.indexOf(key);
    return i >= 0 && r[i] !== undefined && r[i] !== null ? r[i] : "";
  };

  const nf = (v) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? v : n.toLocaleString("es-CO");
  };

  const item = {
    marca:  String(get('marca') || "Genérico"),
    modelo: String(get('modelo') || "Modelo"),
    precio: parseFloat(String(get('precio')).replace(/[^0-9.]/g, '')) || 0,
    specs: {
      "Procesador":     get('procesador'),
      "RAM":            get('ram'),
      "SSD":            get('ssd'),
      "Sistema":        get('sistema'),
      "Pantalla":       get('pantalla'),
      "Tipo Pantalla":  get('tipo_pantalla'),
      "Gráfica":        get('grafica'),
      "Modelo Gráfica": get('modelo_grafica'),
      "Tamaño Gráfica": get('vram')
    }
  };

  const ia = generarComentarioPortatilIA(item);

  const mensaje =
`💻 *${item.marca} ${item.modelo}*
🏆 *Gama:* ${ia.gama}

✨ *Lo mejor de este equipo:*
${ia.resumen}

🎯 *Uso recomendado:*
${ia.idealPara}

⚠️ *No recomendado para:*
${ia.noRecomendado}
🧠 *Procesador:* ${item.specs["Procesador"]}
💾 *Memoria RAM:* ${item.specs["RAM"]}
⚡ *Almacenamiento:* ${item.specs["SSD"]}
🖥️ *Pantalla:* ${item.specs["Pantalla"]} ${item.specs["Tipo Pantalla"]}
🎮 *Gráficos:* ${item.specs["Modelo Gráfica"]} ${item.specs["Tamaño Gráfica"]}
💻 *Sistema Operativo:* ${item.specs["Sistema"]}

💰 *Precio:* $${nf(item.precio)}
📦 Equipo nuevo, original y con garantía de un año.

🧠 *Veredicto IA:*
${ia.veredicto}`;

  const htmlOutput = HtmlService
    .createHtmlOutput(`
      <html>
        <head>
          <base target="_top">
          <style>
            body { font-family: Arial; padding: 20px; }
            textarea { width:100%; height:450px; font-family:monospace; font-size:14px; padding:10px; border:1px solid #ccc; border-radius:5px; resize:none; box-sizing:border-box; }
            button { margin-top:15px; padding:10px 20px; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer; font-size:16px; }
            button:hover { background:#15803d; }
          </style>
        </head>
        <body>
          <textarea id="mensaje" readonly>${mensaje.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
          <button onclick="copiarTexto()">📋 Copiar al portapapeles</button>
          <script>
            const textarea = document.getElementById('mensaje');
            textarea.focus();
            textarea.select();
            function copiarTexto() {
              textarea.select();
              document.execCommand('copy');
              alert('✅ Texto copiado');
            }
          <\/script>
        </body>
      </html>
    `)
    .setWidth(650)
    .setHeight(650);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📋 Ficha Portátil para WhatsApp');
}

function generarAnalisisIAWeb(item, categoria) {
  if (categoria === "celulares") {
    return generarComentarioIA({
      antutu: item.antutu,
      bateria: item.bateria,
      pantalla: item.pantalla,
      refresco: item.refresco,
      camPrincipal: item.cam_ppal,
      camSelfie: item.cam_selfie,
      precio: item.precio,
      red5g: item.red_5g
    });
  }
  if (categoria === "portatiles") {
    return generarComentarioPortatilIA(item);
  }
  return {
    resumen: "Sin análisis disponible",
    idealPara: "—",
    noRecomendado: "—",
    gama: "—",
    veredicto: ""
  };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛒 Catálogo')
    .addItem('🔄 Actualizar catálogo ahora', 'invalidarCache')
    .addItem('🔡 Convertir selección a minúsculas', 'convertirSeleccionAMinusculas')
    .addItem('🔑 Probar conexión GitHub', 'probarConexionGitHub')
    .addSeparator()
    .addItem('🤖 Abrir asistente', 'abrirAsistente')
    .addToUi();
}

function abrirAsistente() {
  const html = HtmlService.createHtmlOutputFromFile('asistente')
    .setTitle('🤖 Asistente JR TECH')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

function obtenerImagenBase64(url) {
  try {
    if (!url) throw new Error("URL vacía");
    const response = UrlFetchApp.fetch(url, {
      followRedirects: true,
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    const code = response.getResponseCode();
    if (code !== 200) {
      throw new Error("Error HTTP: " + code);
    }
    const blob = response.getBlob();
    const contentType = blob.getContentType();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    Logger.log(error);
    return null;
  }
}

function obtenerFichaCompleta(item, categoria) {
  const ia = generarAnalisisIAWeb(item, categoria);
  let imagenBase64 = null;
  try {
    imagenBase64 = obtenerImagenBase64(item?.foto || null);
  } catch (e) {
    imagenBase64 = null;
  }
  return {
    ia: ia,
    imagen: imagenBase64
  };
}

function precargarAnalisisIA(data, categoria) {
  return data.map(item => {
    try {
      const ia = generarAnalisisIAWeb(item, categoria);
      item._iaCache = ia;
    } catch (e) {
      item._iaCache = null;
    }
    return item;
  });
}

function invalidarCache() {
  try {
    // 1. Limpiar caché interno
    removeCacheLarge('catalog_portatiles');
    removeCacheLarge('catalog_celulares');
    removeCacheLarge('catalog_tablets');
    removeCacheLarge('catalog_impresoras');
    
    // 2. Obtener datos frescos
    const celulares = getCelularesData();
    const portatiles = getCatalogData();
    const tablets = getTabletsData();
    const impresoras = getImpresorasData();

    // 3. Subir a GitHub
    const cellsRes = subirArchivoAGitHub('data/celulares.json', celulares);
    const portRes = subirArchivoAGitHub('data/portatiles.json', portatiles);
    const tabRes = subirArchivoAGitHub('data/tablets.json', tablets);
    const impRes = subirArchivoAGitHub('data/impresoras.json', impresoras);

    const results = [
      { name: 'celulares.json', res: cellsRes },
      { name: 'portatiles.json', res: portRes },
      { name: 'tablets.json', res: tabRes },
      { name: 'impresoras.json', res: impRes }
    ];

    const failures = results.filter(r => !r.res.success);

    let statusMsg = '✅ Caché del servidor limpiado.';
    if (failures.length === 0) {
      statusMsg += '\n\n🚀 ¡Archivos de catálogo subidos exitosamente a GitHub! En 1-2 minutos se reflejarán los cambios para todos los usuarios.';
    } else {
      statusMsg += '\n\n⚠️ Los archivos no pudieron subirse a GitHub.';
      statusMsg += '\n\nDetalles del error:';
      const uniqueErrors = [];
      failures.forEach(f => {
        if (!uniqueErrors.includes(f.res.error)) {
          uniqueErrors.push(f.res.error);
        }
      });
      uniqueErrors.forEach(err => {
        statusMsg += `\n❌ ${err}`;
      });
      statusMsg += '\n\nNota: Los usuarios seguirán viendo actualizaciones usando la API de fallback desde la hoja de cálculo.';
    }
    
    SpreadsheetApp.getUi().alert(statusMsg);
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Error al actualizar: ' + e.toString());
  }
}

function subirArchivoAGitHub(path, contentJson) {
  const rawToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const GITHUB_TOKEN = rawToken ? rawToken.trim() : '';
  const GITHUB_OWNER = (PropertiesService.getScriptProperties().getProperty('GITHUB_OWNER') || 'albeirojr-pixel').trim();
  const GITHUB_REPO = (PropertiesService.getScriptProperties().getProperty('GITHUB_REPO') || 'jrtech').trim();
  const GITHUB_BRANCH = (PropertiesService.getScriptProperties().getProperty('GITHUB_BRANCH') || 'main').trim();

  if (!GITHUB_TOKEN) {
    return { success: false, error: 'No se encontró el GITHUB_TOKEN (o está vacío) en las Propiedades del Script.' };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  
  // 1. Obtener el SHA del archivo existente si existe
  let sha = null;
  try {
    const getResponse = UrlFetchApp.fetch(`${url}?ref=${GITHUB_BRANCH}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    });
    
    const getCode = getResponse.getResponseCode();
    if (getCode === 200) {
      const getJson = JSON.parse(getResponse.getContentText());
      sha = getJson.sha;
    } else if (getCode === 401) {
      return { success: false, error: 'GitHub retornó 401 Unauthorized. Es probable que tu GITHUB_TOKEN haya expirado o sea inválido.' };
    } else if (getCode === 403) {
      return { success: false, error: 'GitHub retornó 403 Forbidden. El token puede no tener permisos de escritura (repo/workflow scopes) o haber alcanzado límites.' };
    } else if (getCode === 404) {
      Logger.log(`El archivo ${path} no existe en GitHub, se intentará crear de cero.`);
    }
  } catch (e) {
    Logger.log(`Error al obtener SHA para ${path}: ` + e.toString());
  }

  // 2. Codificar el contenido en Base64 (usando UTF-8 seguro)
  const bytes = Utilities.newBlob(JSON.stringify(contentJson, null, 2), 'application/json').getBytes();
  const base64Content = Utilities.base64Encode(bytes);

  // 3. Hacer el commit
  const payload = {
    message: `Actualización automática de catálogo: ${path}`,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }

  const options = {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const putResponse = UrlFetchApp.fetch(url, options);
    const putCode = putResponse.getResponseCode();
    if (putCode === 200 || putCode === 201) {
      Logger.log(`Archivo ${path} subido exitosamente a GitHub.`);
      return { success: true };
    } else {
      let extra = '';
      try {
        const errObj = JSON.parse(putResponse.getContentText());
        extra = ` - ${errObj.message}`;
      } catch(ex) {}
      return { success: false, error: `Error HTTP ${putCode} al subir: ${putResponse.getContentText() || 'Sin respuesta'}` };
    }
  } catch (e) {
    return { success: false, error: `Excepción de red/Apps Script: ${e.toString()}` };
  }
}

function probarConexionGitHub() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const rawToken = props.getProperty('GITHUB_TOKEN');
  const token = rawToken ? rawToken.trim() : '';
  const owner = (props.getProperty('GITHUB_OWNER') || 'albeirojr-pixel').trim();
  const repo = (props.getProperty('GITHUB_REPO') || 'jrtech').trim();
  
  if (!token) {
    ui.alert('❌ Error: El GITHUB_TOKEN no está configurado (o está vacío) en las Propiedades del Script.');
    return;
  }
  
  let diagInfo = `\n\n🔍 Información de diagnóstico:\n` +
                 `- Longitud del token: ${rawToken.length} caracteres.\n` +
                 `- Espacios/saltos de línea al inicio/final: ${rawToken.length !== token.length ? '⚠️ Sí (fueron recortados)' : 'No'}.\n` +
                 `- Formato del token: ${token.startsWith('ghp_') ? 'Clásico (ghp_...)' : token.startsWith('github_pat_') ? 'Fine-grained (github_pat_...)' : '⚠️ Formato desconocido'}.\n` +
                 `- Propietario (owner): "${owner}"\n` +
                 `- Repositorio (repo): "${repo}"`;

  const url = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      muteHttpExceptions: true
    });
    
    const code = response.getResponseCode();
    const body = response.getContentText();
    
    if (code === 200) {
      ui.alert(`✅ ¡Conexión exitosa! El token es válido y tiene acceso al repositorio "${owner}/${repo}".` + diagInfo);
    } else if (code === 401) {
      ui.alert(`❌ Error 401: No autorizado. El GITHUB_TOKEN ha expirado, fue revocado, es incorrecto o tiene caracteres extraños.` + diagInfo);
    } else if (code === 403) {
      ui.alert(`❌ Error 403: Prohibido. El token no tiene los permisos suficientes o se alcanzó el límite de peticiones.` + diagInfo);
    } else if (code === 404) {
      ui.alert(`❌ Error 404: No encontrado. El repositorio "${owner}/${repo}" no existe, es privado y el token no lo ve, o el nombre de usuario/repositorio está mal configurado.` + diagInfo);
    } else {
      ui.alert(`❌ Error de conexión (HTTP ${code}):\n\n${body}` + diagInfo);
    }
  } catch (e) {
    ui.alert(`❌ Error al conectar con GitHub:\n\n${e.toString()}` + diagInfo);
  }
}


function consultarAsistente(historial, hoja) {
  try {
    const config = getConfig();
    const OPENAI_API_KEY = config.OPENAI_KEY;
    if (!OPENAI_API_KEY) return "Error: API Key no configurada.";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let contexto = "";
    let tipoInventario = "";

    // ============ PORTÁTILES ============
    if (hoja === "PORTATILES") {
      tipoInventario = "portátiles";
      const data = ss.getSheetByName("PORTATILES").getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      contexto = "INVENTARIO PORTÁTILES:\n" + data.slice(1)
        .filter(r => r[headers.indexOf('marca')] && r[headers.indexOf('precio')])
        .map(r => {
          const g = (k) => { const i = headers.indexOf(k); return i >= 0 ? String(r[i]).trim() : 'N/D'; };
          return `${g('marca')} ${g('modelo')} | ${g('procesador')} | ${g('ram')} | ${g('ssd')} | Pantalla ${g('pantalla')} | Gráfica: ${g('grafica')} ${g('modelo_grafica')} | $${g('precio')}`;
        }).join('\n');
    }

    // ============ CELULARES ============
    else if (hoja === "CELULARES") {
      tipoInventario = "celulares";
      const data = ss.getSheetByName("CELULARES").getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      contexto = "INVENTARIO CELULARES:\n" + data.slice(1)
        .filter(r => r[headers.indexOf('marca')] && r[headers.indexOf('precio')])
        .map(r => {
          const g = (k) => { const i = headers.indexOf(k); return i >= 0 ? String(r[i]).trim() : 'N/D'; };
          return `${g('marca')} ${g('modelo')} | ${g('procesador')} | ${g('ram')}RAM/${g('rom')}ROM | ${g('cam_ppal')}MP | ${g('bateria')}mAh | AnTuTu:${g('antutu')} | $${g('precio')}`;
        }).join('\n');
    }

    // ============ TABLETS ============
    else if (hoja === "TABLETS") {
      tipoInventario = "tablets";
      const data = ss.getSheetByName("TABLETS").getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      contexto = "INVENTARIO TABLETS:\n" + data.slice(1)
        .filter(r => r[headers.indexOf('marca')] && r[headers.indexOf('precio')])
        .map(r => {
          const g = (k) => { const i = headers.indexOf(k); return i >= 0 ? String(r[i]).trim() : 'N/D'; };
          return `${g('marca')} ${g('modelo')} | Pantalla ${g('pantalla')}" ${g('tipo_panel')} ${g('resolucion')} ${g('refresco')}Hz | ${g('procesador')} | ${g('ram')}RAM/${g('rom')}ROM | Batería ${g('bateria')}mAh | Cám ${g('cam_ppal')}MP | 5G: ${g('red_5g')} | Android ${g('android')} | $${g('precio')}`;
        }).join('\n');
    }

    // ============ IMPRESORAS ============
    else if (hoja === "IMPRESORAS") {
      tipoInventario = "impresoras";
      const data = ss.getSheetByName("IMPRESORAS").getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      contexto = "INVENTARIO IMPRESORAS:\n" + data.slice(1)
        .filter(r => r[headers.indexOf('marca')] && r[headers.indexOf('precio')])
        .map(r => {
          const g = (k) => { const i = headers.indexOf(k); return i >= 0 ? String(r[i]).trim() : 'N/D'; };
          return `${g('cod')} | ${g('marca')} ${g('referencia')} | ${g('especificaciones')} | $${g('precio')}`;
        }).join('\n');
    }

    // ============ PROCESADORES ============
    else if (hoja === "Proces") {
      tipoInventario = "procesadores";
      const data = ss.getSheetByName("Proces").getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      contexto = "BASE DE DATOS DE PROCESADORES:\n" + data.slice(1)
        .filter(r => r[headers.indexOf('procesador')])
        .map(r => {
          const g = (k) => { const i = headers.indexOf(k); return i >= 0 ? String(r[i]).trim() : 'N/D'; };
          return `${g('procesador')} | ${g('nucleos')} núcleos / ${g('hilos')} hilos | Base ${g('base')}GHz / Turbo ${g('turbo')}GHz | Vel.Media: ${g('vel.media')} | ${g('resumen')}`;
        }).join('\n');
    }

    // ============ HOJA DESCONOCIDA ============
    else {
      contexto = `El usuario está en la hoja "${hoja}" que no tiene inventario configurado. Puedes ayudar con preguntas generales sobre el proyecto JR TECH.`;
      tipoInventario = "general";
    }

    // Prompt del sistema adaptado al contexto
    const sistemaPrompt = `
Eres un asistente experto en el proyecto JR TECH de Google Sheets y Apps Script.
Actualmente el usuario está viendo la hoja de ${tipoInventario.toUpperCase()}.

Puedes ayudar con tres cosas:

1. CONSULTAS DE INVENTARIO: Responde preguntas sobre los productos disponibles usando el inventario que te doy.
   - Para portátiles: procesadores, RAM, gráficas, pantallas, precios
   - Para celulares: procesadores, cámaras, batería, AnTuTu, precios
   - Para tablets: pantallas, procesadores, batería, conectividad 5G, precios
   - Para impresoras: tipo (láser/tinta), funciones (WiFi, duplex, ADF), precios
   - Para procesadores: comparar rendimiento, núcleos, frecuencias, recomendaciones

2. CÓDIGO: Ayuda a escribir, corregir o mejorar funciones de Google Apps Script para este proyecto.
   Cuando des código, entrégalo completo y listo para pegar.

3. ERRORES EN DATOS: Detecta inconsistencias como precios en cero, campos vacíos, formatos mezclados.

CONTEXTO ACTUAL:
${contexto}

REGLAS:
- Respuestas concisas y directas
- Cuando des código, siempre completo — nunca fragmentos
- Si detectas errores en datos, sé específico: menciona marca y modelo del equipo
- Responde en español
- Si te preguntan por productos de otra categoría, indica que deben cambiar a esa hoja
`;

    const messages = [
      { role: "system", content: sistemaPrompt },
      ...historial
    ];

    const opciones = {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + OPENAI_API_KEY },
      payload: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.4,
        max_tokens: 800
      }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", opciones);
    const json = JSON.parse(response.getContentText());
    if (json.error) return "Error OpenAI: " + json.error.message;
    return json.choices[0].message.content.trim();

  } catch(e) {
    return "Error: " + e.toString();
  }
}

function getHojaActiva() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}


function onEdit(e) {
  var hoja = e.source.getActiveSheet();
  var rango = hoja.getRange('R1:AZ' + hoja.getLastRow()); // Ajusta 'Z' si necesitas más columnas
  var valores = rango.getValues();
  
  for (var i = 0; i < valores.length; i++) {
    for (var j = 0; j < valores[i].length; j++) {
      if (valores[i][j] === "N/A") {
        rango.getCell(i + 1, j + 1).setBackground("orange");
      } else {
        rango.getCell(i + 1, j + 1).setBackground(null); // Restablece el color si no es "N/A"
      }
    }
  }
}

// ============================================
// LARGE DATA CACHING UTILITIES (Bypasses 100KB limit)
// ============================================

function putCacheLarge(key, dataObj, seconds) {
  const cache = CacheService.getScriptCache();
  const json = JSON.stringify(dataObj);
  const chunkSize = 90 * 1024; // Chunks de 90KB (Límite seguro bajo 100KB)
  
  // Limpiar chunks previos
  const infoKey = key + '_info';
  const oldInfoStr = cache.get(infoKey);
  if (oldInfoStr) {
    try {
      const oldInfo = JSON.parse(oldInfoStr);
      for (let i = 0; i < oldInfo.chunks; i++) {
        cache.remove(key + '_' + i);
      }
    } catch (e) {}
  }
  
  const numChunks = Math.ceil(json.length / chunkSize);
  const info = { chunks: numChunks, timestamp: Date.now() };
  
  try {
    cache.put(infoKey, JSON.stringify(info), seconds);
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, json.length);
      const chunk = json.substring(start, end);
      cache.put(key + '_' + i, chunk, seconds);
    }
    return true;
  } catch(e) {
    console.error('Error guardando cache grande para ' + key + ': ' + e.toString());
    return false;
  }
}

function getCacheLarge(key) {
  const cache = CacheService.getScriptCache();
  const infoStr = cache.get(key + '_info');
  if (!infoStr) return null;
  
  try {
    const info = JSON.parse(infoStr);
    let json = '';
    for (let i = 0; i < info.chunks; i++) {
      const chunk = cache.get(key + '_' + i);
      if (chunk === null) return null; // Si falta algún fragmento (expirado), invalidar todo
      json += chunk;
    }
    return JSON.parse(json);
  } catch(e) {
    console.error('Error obteniendo cache grande para ' + key + ': ' + e.toString());
    return null;
  }
}

function removeCacheLarge(key) {
  const cache = CacheService.getScriptCache();
  const infoKey = key + '_info';
  const infoStr = cache.get(infoKey);
  if (infoStr) {
    try {
      const info = JSON.parse(infoStr);
      for (let i = 0; i < info.chunks; i++) {
        cache.remove(key + '_' + i);
      }
    } catch (e) {}
  }
  cache.remove(infoKey);
}
