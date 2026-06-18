import re

with open('apps-script/Code_v5.gs', 'r') as f:
    content = f.read()

# Extract getCelularesData and getTabletsData
celulares_func_regex = re.compile(r"function getCelularesData\(\) \{.*?(?=function getTabletsData\(\) \{)", re.DOTALL)
tablets_func_regex = re.compile(r"function getTabletsData\(\) \{.*?(?=function getImpresorasData\(\) \{)", re.DOTALL)

match_celulares = celulares_func_regex.search(content)
match_tablets = tablets_func_regex.search(content)

if match_celulares and match_tablets:
    mobile_code = """function getCelularesData() {
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
      litografia: headers.indexOf('litografia'),
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
"""
    new_content = content[:match_celulares.start()] + mobile_code + content[match_tablets.end():]
    
    with open('apps-script/Code_v5.gs', 'w') as f:
        f.write(new_content)
    print("Mobile Refactor success")
else:
    print("Regex failed to match")
