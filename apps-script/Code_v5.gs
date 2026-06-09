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
  try {
    const cached = getCacheLarge('catalog_portatiles');
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("PORTATILES");
    if (!sheet) return { error: "No existe la hoja PORTATILES." };

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
        id:      "ITM" + i,
        cod:     get(row, 'cod'),
        marca:   get(row, 'marca'),
        modelo:  get(row, 'modelo'),
        specs: {
          "Procesador":     get(row, 'procesador'),
          "RAM":            get(row, 'ram'),
          "Tipo RAM":       get(row, 'tipo_ram'),
          "SSD":            get(row, 'ssd'),
          "Sistema":        get(row, 'sistema'),
          "Pantalla": (() => {
            const match = get(row, 'pantalla').match(/(\d+[.,]\d+|\d+)/);
            return match ? match[1].replace(',', '.') + '"' : get(row, 'pantalla');
          })(),
          "Tipo Pantalla":  get(row, 'tipo_pantalla'),
          "Gráfica":        get(row, 'grafica'),
          "Modelo Gráfica": get(row, 'modelo_grafica'),
          "Tamaño Gráfica": get(row, 'vram')
        },
        precio:   parseFloat(get(row, 'precio').replace(/[^0-9.]/g, '')) || 0,
        foto:     get(row, 'enlace_foto') !== 'N/A' ? get(row, 'enlace_foto') : '',
        logo:     get(row, 'enlace_logo') !== 'N/A' ? get(row, 'enlace_logo') : '',
        banner:   get(row, 'enlace_banner') !== 'N/A' ? get(row, 'enlace_banner') : '',
        fullText: row.join(" ").toLowerCase()
      };
    }).filter(Boolean);

    const filters = {
      "Marca":          [...new Set(catalog.map(it => it.marca))].filter(v => v && v !== "N/A").sort(),
      "RAM": [...new Set(catalog.map(it => {
          const match = String(it.specs["RAM"]).match(/(\d+)\s*GB/i);
          return match ? match[1] + "GB" : null;
        }))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b)),
      "Tipo RAM": [...new Set(catalog.map(it => it.specs["Tipo RAM"]))].filter(v => v && v !== "N/A" && v !== "N/D").sort(),
      "SSD":            [...new Set(catalog.map(it => it.specs["SSD"]))].filter(v => v && v !== "N/A").sort(),
      "Procesador":     [...new Set(catalog.map(it => it.specs["Procesador"]))].filter(v => v && v !== "N/A").sort(),
      "Pantalla": [...new Set(catalog.map(it => {
          return String(it.specs["Pantalla"]).replace(',', '.').replace(/"+$/, '"').trim();
        }))].filter(v => v && v !== "N/A" && v !== "N/D").sort(),
      "Tipo Pantalla":  [...new Set(catalog.map(it => it.specs["Tipo Pantalla"]))].filter(v => v && v !== "N/A").sort(),
      "Sistema":        [...new Set(catalog.map(it => it.specs["Sistema"]))].filter(v => v && v !== "N/A").sort(),
      "Gráfica":        [...new Set(catalog.map(it => it.specs["Gráfica"]))].filter(v => v && v !== "N/A").sort(),
      "Modelo Gráfica": [...new Set(catalog.map(it => it.specs["Modelo Gráfica"]))].filter(v => v && v !== "N/A").sort()
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

    putCacheLarge('catalog_portatiles', resultado, 600);

    return resultado;

  } catch(e) {
    return { error: "Error de Servidor: " + e.toString() };
  }
}

function getCelularesData() {
  try {
    const cached = getCacheLarge('catalog_celulares');
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("CELULARES");
    if (!sheet) return { error: "No existe la hoja CELULARES." };

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
      litografia: headers.indexOf('litografia'),
      jack: headers.indexOf('jack'),
      antutu: headers.indexOf('antutu'),
      precio: headers.indexOf('precio'),
      enlace_foto: headers.indexOf('enlace_foto'),
      enlace_logo: headers.indexOf('enlace_logo'),
      uso_recomendado: headers.indexOf('uso recomendado')
    };

    // Identificar columnas de proveedores (desde columna E hasta antes de antutu)
    const colE = 5;
    const colAntutu = idx.antutu;
    const proveedoresHeaders = headers.slice(colE, colAntutu).filter(h => h && h !== '');

    const get = (row, key) => {
      const i = idx[key];
      return i >= 0 && row[i] !== undefined && row[i] !== null
        ? String(row[i]).trim()
        : "N/A";
    };

    const catalog = rows.map((row, i) => {
      if (!get(row, 'marca') || get(row, 'marca') === 'N/A') return null;

      // 🔥 Recopilar TODOS los proveedores con sus precios
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

      // Ordenar por precio (menor a mayor)
      proveedoresConPrecio.sort((a, b) => a.precio - b.precio);

      // Concatenar todas las iniciales en orden
      const palabraProveedores = proveedoresConPrecio.map(p => p.iniciales).join('');

      return {
        id: "CEL" + i,
        marca: get(row, 'marca').toUpperCase(),
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
        precio: parseFloat(get(row, 'precio').replace(/[^0-9.]/g, '')) || 0, // ✅ PRECIO ORIGINAL
        foto: get(row, 'enlace_foto') !== 'N/A' ? get(row, 'enlace_foto') : '',
        logo: get(row, 'enlace_logo') !== 'N/A' ? get(row, 'enlace_logo') : '',
        proveedor: palabraProveedores, // 🔥 Palabra completa con todas las iniciales
        uso_recomendado: get(row, 'uso_recomendado') !== 'N/A' ? get(row, 'uso_recomendado') : '',
        fullText: row.join(" ").toLowerCase()
      };
    }).filter(Boolean);

    const filters = {
      "Marca": [...new Set(catalog.map(it => it.marca))].filter(v => v && v !== "N/A").sort(),
      "Procesador": [...new Set(catalog.map(it => it.procesador))].filter(v => v && v !== "N/A").sort(),
      "RAM": [...new Set(catalog.map(it => it.ram))].filter(v => v && v !== "N/A").sort(),
      "Almacenamiento": [...new Set(catalog.map(it => it.rom))].filter(v => v && v !== "N/A").sort(),
      "Pantalla": [...new Set(catalog.map(it => it.pantalla))].filter(v => v && v !== "N/A").sort(),
      "Tipo Panel": [...new Set(catalog.map(it => it.tipo_panel))].filter(v => v && v !== "N/A").sort(),
      "Batería": [...new Set(catalog.map(it => it.bateria))].filter(v => v && v !== "N/A").sort(),
      "AnTuTu": [...new Set(catalog.map(it => it.antutu))].filter(v => v && v !== "N/A").sort(),
      "5G": [...new Set(catalog.map(it => it.red_5g))].filter(v => v).sort(),
      "NFC": [...new Set(catalog.map(it => it.nfc))].filter(v => v).sort(),
      "Android": [...new Set(catalog.map(it => it.android))].filter(v => v && v !== "N/A").sort()
    };

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

    putCacheLarge('catalog_celulares', resultado, 600);
    return resultado;

  } catch(e) {
    return { error: "Error de Servidor: " + e.toString() };
  }
}

function getTabletsData() {
  try {
    const cached = getCacheLarge('catalog_tablets');
    if (cached) return cached;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("TABLETS");
    if (!sheet) return { error: "No existe la hoja TABLETS" };

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { error: "La hoja está vacía." };

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = data.slice(1);

    const idx = {
      marca: headers.indexOf('marca'),
      modelo: headers.indexOf('modelo'),
      rom: headers.indexOf('rom'),
      ram: headers.indexOf('ram'),
      precio: headers.indexOf('precio'),
      enlace_foto: headers.indexOf('enlace_foto'),
      enlace_logo: headers.indexOf('enlace_logo'),
      pantalla: headers.indexOf('pantalla'),
      tipo_panel: headers.indexOf('tipo_panel'),
      resolucion: headers.indexOf('resolucion'),
      refresco: headers.indexOf('refresco'),
      peso: headers.indexOf('peso'),
      grosor: headers.indexOf('grosor'),
      procesador: headers.indexOf('procesador'),
      litografia: headers.indexOf('litografia'),
      antutu: headers.indexOf('antutu'),
      bateria: headers.indexOf('bateria'),
      carga: headers.indexOf('carga'),
      cam_ppal: headers.indexOf('cam_ppal'),
      cam_selfie: headers.indexOf('cam_selfie'),
      red_5g: headers.indexOf('red_5g'),
      android: headers.indexOf('android'),
      bluetooth: headers.indexOf('bluetooth'),
      wlan: headers.indexOf('wlan'),
      nfc: headers.indexOf('nfc'),
      jack: headers.indexOf('jack'),
      uso_recomendado: headers.indexOf('uso recomendado')
    };

    // Identificar columnas de proveedores (desde columna E hasta antes de antutu)
    const colE = 4;
    const colAntutu = idx.antutu;
    const proveedoresHeaders = headers.slice(colE, colAntutu).filter(h => h && h !== '');

    const get = (row, key) => {
      const i = idx[key];
      return i >= 0 && row[i] !== undefined && row[i] !== null
        ? String(row[i]).trim()
        : "N/D";
    };

    const catalog = rows.map((row, i) => {
      if (!get(row, 'marca') || get(row, 'marca') === 'N/D') return null;

      // 🔥 Recopilar TODOS los proveedores con sus precios
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

      // Ordenar por precio (menor a mayor)
      proveedoresConPrecio.sort((a, b) => a.precio - b.precio);

      // Concatenar todas las iniciales en orden
      const palabraProveedores = proveedoresConPrecio.map(p => p.iniciales).join('');

      return {
        id: "TAB" + i,
        marca: get(row, 'marca'),
        modelo: get(row, 'modelo'),
        rom: get(row, 'rom'),
        ram: get(row, 'ram'),
        precio: parseFloat(get(row, 'precio').replace(/[^0-9.]/g, '')) || 0, // ✅ PRECIO ORIGINAL
        foto: get(row, 'enlace_foto') !== 'N/D' ? get(row, 'enlace_foto') : '',
        logo: get(row, 'enlace_logo') !== 'N/D' ? get(row, 'enlace_logo') : '',
        pantalla: get(row, 'pantalla'),
        tipo_panel: get(row, 'tipo_panel'),
        resolucion: get(row, 'resolucion'),
        refresco: get(row, 'refresco'),
        peso: get(row, 'peso'),
        grosor: get(row, 'grosor'),
        procesador: get(row, 'procesador'),
        litografia: get(row, 'litografia'),
        antutu: get(row, 'antutu'),
        bateria: get(row, 'bateria'),
        carga: get(row, 'carga'),
        cam_ppal: get(row, 'cam_ppal'),
        cam_selfie: get(row, 'cam_selfie'),
        red_5g: get(row, 'red_5g'),
        android: get(row, 'android'),
        bluetooth: get(row, 'bluetooth'),
        wlan: get(row, 'wlan'),
        nfc: get(row, 'nfc'),
        jack: get(row, 'jack'),
        proveedor: palabraProveedores, // 🔥 Palabra completa con todas las iniciales
        uso_recomendado: get(row, 'uso_recomendado') !== 'N/D' ? get(row, 'uso_recomendado') : '',
        fullText: `${get(row,'marca')} ${get(row,'modelo')} ${get(row,'ram')} ${get(row,'rom')} ${get(row,'procesador')}`.toLowerCase()
      };
    }).filter(Boolean);

    const filters = {
      "Marca": [...new Set(catalog.map(it => it.marca))].filter(v => v && v !== "N/D").sort(),
      "RAM": [...new Set(catalog.map(it => it.ram))].filter(v => v && v !== "N/D").sort(),
      "Almacenamiento": [...new Set(catalog.map(it => it.rom))].filter(v => v && v !== "N/D").sort(),
      "Procesador": [...new Set(catalog.map(it => it.procesador))].filter(v => v && v !== "N/D").sort(),
      "Pantalla": [...new Set(catalog.map(it => it.pantalla))].filter(v => v && v !== "N/D").sort(),
      "Tipo Panel": [...new Set(catalog.map(it => it.tipo_panel))].filter(v => v && v !== "N/D").sort(),
      "Batería": [...new Set(catalog.map(it => it.bateria))].filter(v => v && v !== "N/D").sort(),
      "Carga": [...new Set(catalog.map(it => it.carga))].filter(v => v && v !== "N/D").sort(),
      "5G": [...new Set(catalog.map(it => it.red_5g))].filter(v => v).sort(),
      "NFC": [...new Set(catalog.map(it => it.nfc))].filter(v => v).sort(),
      "Android": [...new Set(catalog.map(it => it.android))].filter(v => v && v !== "N/D").sort()
    };

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

    putCacheLarge('catalog_tablets', resultado, 600);
    return resultado;

  } catch(e) {
    return { error: e.toString() };
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

    // Cargar portátiles con todas las specs
    let inventarioPortatiles = "";
    const hojaPort = ss.getSheetByName('PORTATILES');
    if (hojaPort) {
      const dataPort = hojaPort.getDataRange().getValues();
      const h = dataPort[0].map(x => String(x).trim().toLowerCase());

      inventarioPortatiles = dataPort.slice(1)
        .filter(r => {
          if (!r[h.indexOf('marca')] || !r[h.indexOf('precio')]) return false;
          const precio = parseFloat(String(r[h.indexOf('precio')]).replace(/[^0-9.]/g, '')) || 0;
          return precio > 0;
        })
        .map(r => {
          const g = (key) => {
            const i = h.indexOf(key);
            return i >= 0 && r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : 'N/D';
          };

          // Análisis interno de portátil
          const proc = g('procesador').toLowerCase();
          const ram = parseInt(g('ram')) || 0;
          const ssd = parseInt(g('ssd')) || 0;
          const grafica = g('grafica').toLowerCase();

          let rendimiento = '';
          if (proc.includes('i7') || proc.includes('i9') || proc.includes('ryzen 7') || proc.includes('ryzen 9')) {
            rendimiento = 'Alto rendimiento — ideal para diseño, edición de video, programming, gaming';
          } else if (proc.includes('i5') || proc.includes('ryzen 5')) {
            rendimiento = 'Rendimiento medio-alto — ideal para trabajo, estudio, multitarea exigente';
          } else if (proc.includes('i3') || proc.includes('ryzen 3')) {
            rendimiento = 'Rendimiento medio — ideal para ofimática, estudio, navegación';
          } else {
            rendimiento = 'Rendimiento básico — ideal para tareas simples, navegación, documentos';
          }

          const tieneGrafica = grafica !== 'no' && grafica !== 'n/a' && grafica !== 'n/d' && grafica !== '';
          const memoriaAdecuada = ram >= 16 ? 'RAM alta — multitarea fluida' : ram >= 8 ? 'RAM suficiente para uso general' : 'RAM limitada';
          const almacenamiento = ssd >= 512 ? 'Almacenamiento amplio' : ssd >= 256 ? 'Almacenamiento suficiente' : 'Almacenamiento básico';

          return `💻 ${g('marca')} ${g('modelo')}
   Procesador: ${g('procesador')} | RAM: ${g('ram')}GB | SSD: ${g('ssd')}GB
   Pantalla: ${g('pantalla')} ${g('tipo_pantalla')} | Sistema: ${g('sistema')}
   Gráfica: ${tieneGrafica ? g('grafica') + ' ' + g('modelo_grafica') + ' ' + g('vram') : 'Integrada'}
   Análisis: ${rendimiento} | ${memoriaAdecuada} | ${almacenamiento}
   ${tieneGrafica ? 'Tiene gráfica dedicada — apta para gaming y diseño' : 'Sin gráfica dedicada — no apta para gaming exigente'}
   Precio: $${g('precio')}
   Valor agregado: Envío gratis + Soporte técnico remoto + Windows y Office licenciados + Equipo configurado`;
        }).join('\n\n');
    }

    // Cargar celulares con todas las specs
    let inventarioCelulares = "";
    const hojaCel = ss.getSheetByName('CELULARES');
    if (hojaCel) {
      const dataCel = hojaCel.getDataRange().getValues();
      const h = dataCel[0].map(x => String(x).trim().toLowerCase());

      inventarioCelulares = dataCel.slice(1)
        .filter(r => {
          if (!r[h.indexOf('marca')] || !r[h.indexOf('precio')]) return false;
          const precio = parseFloat(String(r[h.indexOf('precio')]).replace(/[^0-9.]/g, '')) || 0;
          return precio > 0;
        })
        .map(r => {
          const g = (key) => {
            const i = h.indexOf(key);
            return i >= 0 && r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : 'N/D';
          };

          // Análisis interno de celular
          const antutu = parseInt(g('antutu')) || 0;
          const bateria = parseInt(g('bateria')) || 0;
          const refresco = parseInt(g('refresco')) || 0;
          const camPpal = parseInt(g('cam_ppal')) || 0;
          const panel = g('tipo_panel').toLowerCase();

          let rendimiento = '';
          if (antutu >= 800000) rendimiento = 'Rendimiento premium — gaming exigente, multitarea pesada';
          else if (antutu >= 500000) rendimiento = 'Rendimiento alto — gaming moderado, multitarea fluida';
          else if (antutu >= 300000) rendimiento = 'Rendimiento medio — uso diario, redes, fotos';
          else if (antutu >= 150000) rendimiento = 'Rendimiento básico-medio — uso sencillo, redes, llamadas';
          else rendimiento = 'Rendimiento básico — llamadas, WhatsApp, navegación simple';

          const calidadPanel = panel.includes('amoled') ? 'Pantalla AMOLED — colores vibrantes, ideal para fotos y videos' :
                               panel.includes('ips') ? 'Pantalla IPS LCD — buena calidad, colores naturales' :
                               'Pantalla estándar';

          const calidadBateria = bateria >= 5000 ? 'Batería de larga duración — todo el día sin problema' :
                                 bateria >= 4000 ? 'Batería suficiente — uso normal del día' :
                                 'Batería limitada — carga frecuente';

          const calidadCamara = camPpal >= 108 ? 'Cámara principal 108MP — fotografía de alta resolución' :
                                camPpal >= 64 ? 'Cámara principal 64MP — fotografía detallada' :
                                camPpal >= 48 ? 'Cámara principal 48MP — buena fotografía' :
                                camPpal >= 13 ? 'Cámara principal ' + camPpal + 'MP — fotografía básica' :
                                'Cámara básica';

          return `📱 ${g('marca')} ${g('modelo')}
   Procesador: ${g('procesador')} (${g('litografia')}nm) | AnTuTu: ${g('antutu')}
   RAM: ${g('ram')}GB | Almacenamiento: ${g('rom')}GB
   Pantalla: ${g('pantalla')}" ${g('tipo_panel')} | Resolución: ${g('resolucion')} | Refresco: ${g('refresco')}Hz
   Cámara ppal: ${g('cam_ppal')}MP | Cámara selfie: ${g('cam_selfie')}MP
   Batería: ${g('bateria')}mAh | Carga rápida: ${g('carga')}W
   5G: ${g('red_5g')} | NFC: ${g('nfc')} | Android: ${g('android')} | Jack 3.5mm: ${g('jack')}
   Análisis: ${rendimiento}
   ${calidadPanel}
   ${calidadCamara}
   ${calidadBateria}
   Precio: $${g('precio')}`;
        }).join('\n\n');
    }
    // Cargar tablets con todas las specs
    let inventarioTablets = "";
    const hojaTab = ss.getSheetByName('TABLETS');
    if (hojaTab) {
      const dataTab = hojaTab.getDataRange().getValues();
      const h = dataTab[0].map(x => String(x).trim().toLowerCase());

      inventarioTablets = dataTab.slice(1)
        .filter(r => {
          if (!r[h.indexOf('marca')] || !r[h.indexOf('precio')]) return false;
          const precio = parseFloat(String(r[h.indexOf('precio')]).replace(/[^0-9.]/g, '')) || 0;
          return precio > 0;
        })
        .map(r => {
          const g = (key) => {
            const i = h.indexOf(key);
            return i >= 0 && r[i] !== undefined && r[i] !== null ? String(r[i]).trim() : 'N/D';
          };

          // Análisis interno de tablet (igual que celulares)
          const antutu = parseInt(g('antutu')) || 0;
          const bateria = parseInt(g('bateria')) || 0;
          const refresco = parseInt(g('refresco')) || 0;
          const camPpal = parseInt(g('cam_ppal')) || 0;
          const panel = g('tipo_panel').toLowerCase();

          let rendimiento = '';
          if (antutu >= 800000) rendimiento = 'Rendimiento premium — gaming exigente, multitarea pesada';
          else if (antutu >= 500000) rendimiento = 'Rendimiento alto — gaming moderado, multitarea fluida';
          else if (antutu >= 300000) rendimiento = 'Rendimiento medio — uso diario, redes, multimedia';
          else if (antutu >= 150000) rendimiento = 'Rendimiento básico-medio — uso sencillo, redes, lectura';
          else rendimiento = 'Rendimiento básico — navegación, videos, lectura';

          const calidadPanel = panel.includes('amoled') ? 'Pantalla AMOLED — colores vibrantes, ideal para multimedia' :
                               panel.includes('ips') ? 'Pantalla IPS LCD — buena calidad, colores naturales' :
                               'Pantalla estándar';

          const calidadBateria = bateria >= 8000 ? 'Batería de larga duración — días de uso sin problema' :
                                 bateria >= 6000 ? 'Batería suficiente — día completo sin problema' :
                                 'Batería moderada';

          return `📱 ${g('marca')} ${g('modelo')}
   Procesador: ${g('procesador')} (${g('litografia')}nm) | AnTuTu: ${g('antutu')}
   RAM: ${g('ram')}GB | Almacenamiento: ${g('rom')}GB
   Pantalla: ${g('pantalla')}" ${g('tipo_panel')} | Resolución: ${g('resolucion')} | Refresco: ${g('refresco')}Hz
   Cámara ppal: ${g('cam_ppal')}MP | Batería: ${g('bateria')}mAh | Carga: ${g('carga')}W
   5G: ${g('red_5g')} | NFC: ${g('nfc')} | Android: ${g('android')}
   Análisis: ${rendimiento}
   ${calidadPanel}
   ${calidadBateria}
   Precio: $${g('precio')}`;
        }).join('\n\n');
    }

    const sistemaPrompt = `
Eres Camilo, asesor comercial senior de JR TECH — tienda de tecnología colombiana.

DIFERENCIADORES DE JR TECH:
- Honestidad absoluta: prefieres NO vender antes que vender algo que no le sirve
- En portátiles: envío gratis, soporte técnico remoto, Windows y Office licenciados, equipo configurado y listo para usar
- Garantías atendidas con diligencia

TU MÉTODO DE TRABAJO:
1. 1. Identifica desde el primer mensaje si el cliente busca celular, tablet o portátil. Si no es claro, pregúntalo primero.
2. Una vez definida la categoría, SOLO recomiendas productos de esa categoría. Nunca mezcles.
3. Antes de recomendar SIEMPRE debes conocer:
   - Para qué va a usar el equipo
   - Cuál es su presupuesto disponible
   Si no los tienes, pregúntalos de forma natural en un solo mensaje.
4. Nunca hagas más de 2 preguntas en toda la conversación.
5. Cuando vayas a recomendar, ANALIZA TODO EL INVENTARIO usando el análisis incluido en cada equipo.
   Escoge el que MEJOR satisfaga la necesidad específica del cliente dentro de su presupuesto.
   - Si necesita fotos → prioriza megapixeles, calidad de panel, batería
   - Si necesita gaming → prioriza AnTuTu, RAM, gráfica dedicada
   - Si necesita trabajo/estudio → prioriza procesador, RAM, SSD
   - Si necesita redes sociales → prioriza pantalla AMOLED, cámara selfie, batería
   - Si necesita todo el día de uso → prioriza batería grande y carga rápida
6. REGLA DE PRESUPUESTO ESTRICTA: Nunca recomiendes un equipo que supere el presupuesto.
   Dentro del presupuesto, recomienda el MEJOR, no el más barato.
   Si ningún equipo cabe en el presupuesto, díselo honestamente y muéstrale la opción más cercana.
7. Al recomendar sé específico: menciona los megapixeles de la cámara, el AnTuTu, la batería,
   el tipo de pantalla — los datos concretos que justifican por qué ese equipo satisface su necesidad.
8. Cierra siempre invitando al cliente a hablar con Albeiro. Construye el enlace reemplazando
   [EQUIPO] con el nombre real: https://wa.me/573128590469?text=Hola+Albeiro%2C+Camilo+me+recomendó+el+[EQUIPO]

INVENTARIO PORTÁTILES:
${inventarioPortatiles}

INVENTARIO CELULARES:
${inventarioCelulares}

INVENTARIO TABLETS:
${inventarioTablets}

REGLAS FINALES:
- Nunca inventes productos que no estén en el inventario
- Responde en español colombiano, cálido y profesional
- Respuestas concisas — el cliente está en un chat, no leyendo un informe
- Sin markdown, sin asteriscos, sin negrillas. Solo texto plano y emojis ocasionales
- Recuerda TODO lo que el cliente ha dicho y nunca repitas preguntas
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
        temperature: 0.7,
        max_tokens: 500
      }),
      muteHttpExceptions: true
    };
    console.log("Tamaño del prompt:", JSON.stringify(messages).length, "caracteres");
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
  } else if (apiParam === 'impresoras') {  // <--- ESTO ES LO QUE AGREGAS
    return ContentService.createTextOutput(JSON.stringify(getImpresorasData()))
      .setMimeType(ContentService.MimeType.JSON);
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
    veredicto: `Portátil de gama ${gama} bien orientado a ${idealFinal.split(",")[0] || "uso general"}, con limitaciones previsibles en escenarios extremos.`
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
    const cellsOk = subirArchivoAGitHub('data/celulares.json', celulares);
    const portOk = subirArchivoAGitHub('data/portatiles.json', portatiles);
    const tabOk = subirArchivoAGitHub('data/tablets.json', tablets);
    const impOk = subirArchivoAGitHub('data/impresoras.json', impresoras);

    let statusMsg = '✅ Caché del servidor limpiado.';
    if (cellsOk && portOk && tabOk && impOk) {
      statusMsg += '\n\n🚀 ¡Archivos de catálogo subidos exitosamente a GitHub! En 1-2 minutos se reflejarán los cambios para todos los usuarios.';
    } else {
      statusMsg += '\n\n⚠️ Los archivos no pudieron subirse a GitHub (esto es normal si aún no has configurado tu GITHUB_TOKEN en las Propiedades del Script). Los usuarios verán las actualizaciones vía la API de fallback.';
    }
    
    SpreadsheetApp.getUi().alert(statusMsg);
  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ Error al actualizar: ' + e.toString());
  }
}

function subirArchivoAGitHub(path, contentJson) {
  const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  const GITHUB_OWNER = PropertiesService.getScriptProperties().getProperty('GITHUB_OWNER') || 'albeirojr-pixel';
  const GITHUB_REPO = PropertiesService.getScriptProperties().getProperty('GITHUB_REPO') || 'jrtech';
  const GITHUB_BRANCH = PropertiesService.getScriptProperties().getProperty('GITHUB_BRANCH') || 'main';

  if (!GITHUB_TOKEN) {
    Logger.log('No GITHUB_TOKEN configured in Script Properties. Skipping GitHub push.');
    return false;
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
    
    if (getResponse.getResponseCode() === 200) {
      const getJson = JSON.parse(getResponse.getContentText());
      sha = getJson.sha;
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
      return true;
    } else {
      Logger.log(`Error al subir ${path} a GitHub (HTTP ${putCode}): ` + putResponse.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log(`Excepción al subir ${path} a GitHub: ` + e.toString());
    return false;
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
