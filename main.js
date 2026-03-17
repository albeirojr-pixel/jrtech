/**
 * main.js - Innovación Digital JRTech
 * Client-side logic for catalog loading, modals, and order processing.
 */

if (typeof CONFIG === 'undefined') {
    console.error("CONFIG no definido. Asegúrate de que config.js esté cargado.");
}

const API_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_URL : '';
const TEL_WHATSAPP = typeof CONFIG !== 'undefined' ? CONFIG.TEL_WHATSAPP : '573128590469';
let catalogoActual = [];
let filtrosDisponibles = {};
let rangosDisponibles = {};
let categoriaActual = '';
let marcaSeleccionada = 'Todos';
let listaComparar = [];

// Whitelists for security and UI
const WHITELIST_LAPTOPS = ['cod', 'marca', 'modelo', 'procesador', 'ram', 'tipo_ram', 'ssd', 'Sistema', 'pantalla', 'tipo_pantalla', 'grafica', 'modelo_grafica', 'vram'];
const WHITELIST_MOBILE = ['COD', 'marca', 'modelo', 'rom', 'ram', 'pantalla', 'tipo_panel', 'resolucion', 'grosor', 'peso', 'procesador', 'litografia', 'refresco', 'antutu', 'bateria', 'carga', 'cam_ppal', 'cam_selfie', 'red_5g', 'android', 'bluetooth', 'wlan', 'nfc', 'jack', 'proveedor'];

const GRID_LAPTOPS = ['procesador', 'ram', 'ssd', 'grafica'];
const GRID_MOBILE = ['procesador', 'ram', 'rom', 'pantalla', 'antutu'];

const SPECS_GROUPS = {
    portatiles: [
        { name: 'Identificación', fields: ['cod', 'marca', 'modelo'] },
        { name: 'Rendimiento', fields: ['procesador', 'ram', 'tipo_ram', 'ssd', 'grafica', 'modelo_grafica', 'vram'] },
        { name: 'Pantalla y Software', fields: ['Sistema', 'pantalla', 'tipo_pantalla'] }
    ],
    mobile: [
        { name: 'Identificación', fields: ['COD', 'marca', 'modelo'] },
        { name: 'Rendimiento', fields: ['procesador', 'ram', 'rom', 'antutu', 'litografia'] },
        { name: 'Pantalla', fields: ['pantalla', 'tipo_panel', 'resolucion', 'refresco'] },
        { name: 'Cámaras', fields: ['cam_ppal', 'cam_selfie'] },
        { name: 'Autonomía', fields: ['bateria', 'carga'] },
        { name: 'Conectividad y Extras', fields: ['red_5g', 'android', 'bluetooth', 'wlan', 'nfc', 'jack', 'grosor', 'peso'] }
    ]
};

function getPriceField(categoria) {
    return 'precio';
}

function reverseString(str) {
    if (!str) return '';
    return String(str).split('').reverse().join('');
}

function formatMoneda(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return "$0";
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);
}

function normalizeKey(key) {
    if (!key) return '';
    return key.toString().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
        .replace(/[^a-z0-9]/g, "");    // Elimina espacios y símbolos
}

function getSpec(item, key, unit = '') {
    const targetKey = normalizeKey(key);
    let val = undefined;

    // 1. Buscar en nivel superior
    for (let k in item) {
        if (normalizeKey(k) === targetKey) {
            val = item[k];
            break;
        }
    }

    // 2. Buscar en .specs
    if ((val === undefined || val === null) && item.specs) {
        for (let k in item.specs) {
            if (normalizeKey(k) === targetKey) {
                val = item.specs[k];
                break;
            }
        }
    }

    if (val === undefined || val === null || val === 'undefined') return '';

    const cleanStr = String(val).trim();
    if (cleanStr === '' || cleanStr.toLowerCase() === 'undefined') return '';

    // Si queremos ser exhaustivos, devolvemos N/A o N/D si el usuario los ve en el Excel
    // pero para la GRID principal preferimos ocultarlos. 
    // Por simplicidad, los permitimos aquí y filtramos en renderGrid si es necesario.
    // Si es un código (COD o cod), lo devolvemos invertido por confidencialidad
    if (targetKey === 'cod' || targetKey === 'codigo') {
        return reverseString(cleanStr);
    }

    return cleanStr + unit;
}

function mostrar(id) {
    document.querySelectorAll("main section").forEach(sec => {
        sec.style.display = "none";
    });
    const section = document.getElementById(id);
    if (section) {
        section.style.display = "block";
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

async function cargarCatalogo(categoria) {
    mostrar('catalogo');
    categoriaActual = categoria;
    marcaSeleccionada = 'Todos';

    const title = document.getElementById('catalogo-title');
    const loader = document.getElementById('catalogo-loader');
    const grid = document.getElementById('catalogo-grid');
    const errorDiv = document.getElementById('catalogo-error');
    const controlsDiv = document.getElementById('catalogo-controls');

    title.innerText = categoria.toUpperCase();
    // Mostrar Skeletons dinámicos
    grid.innerHTML = Array(6).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-img skeleton"></div>
            <div class="skeleton-text skeleton" style="width: 30%"></div>
            <div class="skeleton-title skeleton"></div>
            <div class="skeleton-text skeleton"></div>
            <div class="skeleton-text skeleton" style="width: 50%"></div>
            <div class="skeleton-price skeleton"></div>
            <div class="skeleton-btn skeleton"></div>
            <div class="skeleton-btn skeleton"></div>
        </div>
    `).join('');

    errorDiv.style.display = 'none';
    controlsDiv.style.display = 'none';
    loader.style.display = 'none'; // Ya no usamos el spinner central en el grid

    // Resetear UI
    document.getElementById('catalogo-search').value = '';
    document.getElementById('catalogo-sort').value = 'precio-asc';
    document.getElementById('filtros-avanzados').style.display = 'none';
    const optAntutu = document.getElementById('opt-antutu');
    // Mostrar AnTuTu solo si es categoría con potencia (ahora lo habilitamos siempre por petición del usuario si hay dato, pero por defecto lo mostramos en celulares/tablets)
    optAntutu.style.display = 'block';

    try {
        const response = await fetch(`${API_URL}?api=${categoria}`);
        if (!response.ok) throw new Error('Error en la red');

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        catalogoActual = data.items || [];
        filtrosDisponibles = data.filters || {};
        rangosDisponibles = data.rangos || {};

        loader.style.display = 'none';

        if (catalogoActual.length === 0) {
            errorDiv.innerText = 'No hay productos disponibles por el momento.';
            errorDiv.style.display = 'block';
            return;
        }

        controlsDiv.style.display = 'block';
        configurarControles(filtrosDisponibles, rangosDisponibles);
        procesarCatalogoConIA();
        renderSugerenciasBusqueda();
        actualizarEstadoHub();
        aplicarFiltros();

    } catch (err) {
        console.error(err);
        loader.style.display = 'none';
        grid.innerHTML = '';
        errorDiv.innerHTML = `
            <p>Hubo un problema al cargar el catálogo. Por favor intenta de nuevo más tarde.</p>
            <button class="btn-secundario" onclick="cargarCatalogo('${categoria}')" style="margin-top: 20px;">
                <i class="fas fa-sync-alt"></i> Reintentar Carga
            </button>
        `;
        errorDiv.style.display = 'block';
    }
}

function configurarControles(filters, rangos) {
    const sliderPrecio = document.getElementById('catalogo-price');
    const priceField = getPriceField(categoriaActual);
    const maxPrecio = (rangos[priceField] || rangos['Precio']) ? (rangos[priceField]?.max || rangos['Precio'].max) : 10000000;
    sliderPrecio.max = maxPrecio;
    sliderPrecio.value = maxPrecio;
    actualizarLabelPrecio();

    // 1. Filtro de Marcas (Horizontal)
    const marcas = filters['marca'] || [];
    const containerMarcas = document.getElementById('catalogo-filtros-marcas');
    containerMarcas.innerHTML = '';

    const btnTodos = document.createElement('button');
    btnTodos.className = 'filtro-btn active';
    btnTodos.innerHTML = `<i class="fas fa-th-large"></i> Todos`;
    btnTodos.onclick = (e) => seleccionarMarca(e.currentTarget, 'Todos');
    containerMarcas.appendChild(btnTodos);

    marcas.forEach(marca => {
        const btn = document.createElement('button');
        btn.className = 'filtro-btn';
        
        // Buscar el logo de esta marca en el catálogo actual
        const itemConLogo = catalogoActual.find(it => it.marca === marca && getBrandLogo(it));
        const logoUrl = itemConLogo ? getBrandLogo(itemConLogo) : null;
        
        if (logoUrl) {
            btn.innerHTML = `<img src="${logoUrl}" alt="${marca}" title="${marca}" style="height: 25px; width: auto; max-width: 80px; object-fit: contain;">`;
        } else {
            btn.innerHTML = `${marca}`;
        }
        
        btn.onclick = (e) => seleccionarMarca(e.currentTarget, marca);
        containerMarcas.appendChild(btn);
    });

    // 2. Filtros Avanzados (Dropdowns)
    const containerAvanzados = document.getElementById('filtros-avanzados');
    containerAvanzados.innerHTML = '';

    // Filtrar Marca porque ya tiene su control arriba
    Object.keys(filters).forEach(key => {
        if (key.toLowerCase() === 'marca') return;

        const filterOptions = filters[key];
        if (filterOptions && filterOptions.length > 0) {
            const wrap = document.createElement('div');
            wrap.className = 'filtro-group';
            wrap.style.cssText = "flex: 1; min-width: 140px; position: relative;";

            const icon = getFiltroIcono(key);
            const select = document.createElement('select');
            select.className = 'filtro-avanzado-select';
            select.dataset.filtro = key;
            select.onchange = aplicarFiltros;

            const optTodos = document.createElement('option');
            optTodos.value = "Todos";
            optTodos.innerText = `${key}: Todos`;
            select.appendChild(optTodos);

            filterOptions.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = `${val}`;
                select.appendChild(opt);
            });

            wrap.innerHTML = `<i class="${icon}" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--primary); font-size: 0.8rem; pointer-events: none;"></i>`;
            wrap.appendChild(select);
            containerAvanzados.appendChild(wrap);
        }
    });

    // Ajuste de estilos inline para los selects
    document.querySelectorAll('.filtro-avanzado-select').forEach(s => {
        s.style.cssText = "width: 100%; padding: 10px 10px 10px 32px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text); font-family: 'Outfit'; font-size: 0.85rem; outline: none; cursor:pointer; transition: all 0.3s ease; appearance: none;";
    });
}

function getFiltroIcono(key) {
    const k = key.toLowerCase();
    if (k.includes('ram')) return 'fas fa-memory';
    if (k.includes('rom') || k.includes('ssd')) return 'fas fa-hdd';
    if (k.includes('procesador')) return 'fas fa-microchip';
    if (k.includes('pantalla')) return 'fas fa-laptop';
    if (k.includes('sistema') || k.includes('android')) return 'fab fa-android';
    if (k.includes('bateria')) return 'fas fa-battery-full';
    if (k.includes('grafica') || k.includes('gpu')) return 'fas fa-image';
    if (k.includes('vram')) return 'fas fa-vr-cardboard';
    if (k.includes('5g')) return 'fas fa-broadcast-tower';
    if (k.includes('nfc')) return 'fas fa-contactless-payment';
    if (k.includes('jack')) return 'fas fa-headphones';
    return 'fas fa-filter';
}

function limpiarFiltros() {
    // 1. Limpiar buscador
    const search = document.getElementById('catalogo-search');
    if (search) search.value = '';

    // 2. Limpiar marca seleccionada
    marcaSeleccionada = 'Todos';
    document.querySelectorAll('#catalogo-filtros-marcas .filtro-btn').forEach(b => {
        if (b.innerText.trim().toLowerCase().includes('todos')) b.classList.add('active');
        else b.classList.remove('active');
    });

    // 3. Limpiar dropdowns avanzados
    document.querySelectorAll('.filtro-avanzado-select').forEach(s => s.value = 'Todos');

    // 4. Limpiar precio (volver al máximo)
    const priceSlider = document.getElementById('catalogo-price');
    if (priceSlider) {
        priceSlider.value = priceSlider.max;
        actualizarLabelPrecio();
    }

    // 5. Aplicar
    aplicarFiltros();
}

function seleccionarMarca(btnEl, marca) {
    document.querySelectorAll('#catalogo-filtros-marcas .filtro-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    marcaSeleccionada = marca;
    aplicarFiltros();
}

function toggleFiltrosAvanzados() {
    const div = document.getElementById('filtros-avanzados');
    div.style.display = div.style.display === 'none' ? 'flex' : 'none';
}

function actualizarLabelPrecio() {
    const val = document.getElementById('catalogo-price').value;
    const priceField = getPriceField(categoriaActual);
    const maxReal = (rangosDisponibles[priceField] || rangosDisponibles['Precio']) ? (rangosDisponibles[priceField]?.max || rangosDisponibles['Precio'].max) : 10000000;
    const label = document.getElementById('precio-valor-label');
    if (parseInt(val) >= maxReal) {
        label.innerText = "Sin límite";
    } else {
        label.innerText = "Hasta " + formatMoneda(val);
    }
}

function aplicarFiltros() {
    if (!catalogoActual || catalogoActual.length === 0) return;

    const searchQuery = document.getElementById('catalogo-search').value.toLowerCase();
    const sortVal = document.getElementById('catalogo-sort').value;
    const maxPrecio = parseInt(document.getElementById('catalogo-price').value);
    const priceField = getPriceField(categoriaActual);

    // Obtener filtros avanzados activos
    const selectsAv = document.querySelectorAll('.filtro-avanzado-select');
    const filtrosElegidos = {};
    selectsAv.forEach(s => {
        if (s.value !== "Todos") filtrosElegidos[s.dataset.filtro] = s.value;
    });

    let filtrados = catalogoActual.filter(item => {
        // 1. Filtro de Precio
        const valPrecio = parseInt(item[priceField]) || 0;
        if (valPrecio > maxPrecio) return false;

        // 2. Filtro de Marca
        if (marcaSeleccionada !== 'Todos' && item.marca !== marcaSeleccionada) return false;

        // 3. Búsqueda de Texto (Sobre campos de la Lista Blanca)
        if (searchQuery) {
            const isLaptop = categoriaActual === 'portatiles';
            const whitelist = isLaptop ? WHITELIST_LAPTOPS : WHITELIST_MOBILE;
            
            let searchableText = '';
            whitelist.forEach(k => {
                const val = getSpec(item, k);
                if (val) searchableText += ' ' + val;
            });

            if (item.aiInsight) {
                searchableText += ` ${item.aiInsight.resumen || ''} ${item.aiInsight.idealPara || ''} ${item.aiInsight.gama || ''}`;
            }

            if (!searchableText.toLowerCase().includes(searchQuery)) return false;
        }

        // 4. Filtros Avanzados Dinámicos
        for (let prop in filtrosElegidos) {
            const itemVal = item[prop] || (item.specs && item.specs[prop]);
            if (String(itemVal) !== filtrosElegidos[prop]) return false;
        }

        return true;
    });

    filtrados.sort((a, b) => {
        const pA = parseInt(a[priceField]) || 0;
        const pB = parseInt(b[priceField]) || 0;
        if (sortVal === 'precio-asc') return pA - pB;
        if (sortVal === 'precio-desc') return pB - pA;
        if (sortVal === 'antutu-desc') {
            const aNtutu = parseInt(a.antutu || a.specs?.['AnTuTu'] || 0);
            const bNtutu = parseInt(b.antutu || b.specs?.['AnTuTu'] || 0);
            return bNtutu - aNtutu;
        }
        if (sortVal === 'marca-asc') {
            const m = a.marca.localeCompare(b.marca);
            if (m !== 0) return m;
            return pA - pB;
        }
        return 0;
    });

    renderGrid(filtrados);
}

function renderGrid(items) {
    const grid = document.getElementById('catalogo-grid');
    grid.innerHTML = '';

    const errorDiv = document.getElementById('catalogo-error');
    if (items.length === 0) {
        errorDiv.innerText = 'No se encontraron equipos con esos filtros.';
        errorDiv.style.display = 'block';
        return;
    } else {
        errorDiv.style.display = 'none';
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'producto-card';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';

        let specsHtml = '';
        const esCelTab = (categoriaActual === 'celulares' || categoriaActual === 'tablets');
        const prov = getSpec(item, 'proveedor');
        const provSyllable = prov ? prov.substring(0, 2).toUpperCase() : '';

        if (esCelTab) {
            const proc = getSpec(item, 'procesador') || getSpec(item, 'Procesador');
            const ram = getSpec(item, 'ram', 'GB');
            const rom = getSpec(item, 'rom', 'GB') || getSpec(item, 'almacenamiento', 'GB');
            const bat = getSpec(item, 'bateria') || getSpec(item, 'capacidad_bateria');
            const camP = getSpec(item, 'camppal') || getSpec(item, 'camara_ppal') || getSpec(item, 'camara_principal') || getSpec(item, 'camara');
            const camS = getSpec(item, 'camselfie') || getSpec(item, 'camara_selfie') || getSpec(item, 'camara_frontal');
            const pan = getSpec(item, 'pantalla');

            specsHtml = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        ${proc ? `<div class="producto-spec"><i class="fas fa-microchip"></i> ${proc}</div>` : ''}
                        ${(ram || rom) ? `<div class="producto-spec"><i class="fas fa-memory"></i> ${ram}${ram && rom ? ' / ' : ''}${rom}</div>` : ''}
                    </div>
                </div>
                ${camP ? `<div class="producto-spec"><i class="fas fa-camera"></i> Principal: ${camP} MP</div>` : ''}
                ${camS ? `<div class="producto-spec"><i class="fas fa-camera"></i> Selfie: ${camS} MP</div>` : ''}
                ${bat ? `<div class="producto-spec"><i class="fas fa-battery-full"></i> ${bat} mAh</div>` : ''}
                ${pan ? `<div class="producto-spec"><i class="fas fa-mobile-alt"></i> ${pan}</div>` : ''}
            `;
        } else {
            const proc = getSpec(item, 'Procesador') || getSpec(item, 'procesador');
            const ram = getSpec(item, 'RAM') || getSpec(item, 'ram');
            const ssd = getSpec(item, 'SSD') || getSpec(item, 'ssd') || getSpec(item, 'almacenamiento');
            const pan = getSpec(item, 'Pantalla') || getSpec(item, 'pantalla');
            const graf = getSpec(item, 'grafica') || getSpec(item, 'Gráfica');

            specsHtml = `
                ${proc ? `<div class="producto-spec"><i class="fas fa-microchip"></i> ${proc}</div>` : ''}
                ${(ram || ssd) ? `<div class="producto-spec"><i class="fas fa-memory"></i> ${ram} RAM | ${ssd} Almacenamiento</div>` : ''}
                ${pan ? `<div class="producto-spec"><i class="fas fa-laptop"></i> ${pan}</div>` : ''}
                ${(graf && graf.toLowerCase() !== 'integrada' && graf.toLowerCase() !== 'no') ? `<div class="producto-spec"><i class="fas fa-gamepad"></i> ${graf}</div>` : ''}
            `;
        }

        const priceField = getPriceField(categoriaActual);
        const priceFormatted = formatMoneda(item[priceField]);
        // Priorizar enlaces directos de la hoja de Google
        const logoSrc = getBrandLogo(item);
        const imgFallback = 'https://placehold.co/300x300/f8fafc/4f46e5?text=' + categoriaActual.toUpperCase();
        const imgSrc = item.enlace_foto || item.foto || logoSrc || imgFallback;

        card.innerHTML = `
            <div class="producto-img-container">
                <img src="${imgSrc}" alt="${item.marca} ${item.modelo}" class="producto-img" onerror="this.src='${imgFallback}'">
                ${provSyllable ? `<span class="prov-tag-discreto">${provSyllable}</span>` : ''}
            </div>
            <div class="producto-marca-container">
                ${logoSrc ? `<img src="${logoSrc}" alt="${item.marca}" class="producto-marca-logo">` : `<div class="producto-marca-text">${item.marca}</div>`}
            </div>
            <h3 class="producto-modelo">${item.modelo}</h3>
            <div class="producto-specs">
                ${specsHtml}
            </div>
            <div class="producto-precio">${priceFormatted}</div>
            
            <label class="comparar-checkbox-container" onclick="event.stopPropagation()">
                <input type="checkbox" onchange="toggleComparar('${item.id}')" ${listaComparar.includes(item.id) ? 'checked' : ''}>
                <span>Comparar</span>
            </label>

            <button class="btn-secundario" onclick="abrirModal('${item.id}')">
                <i class="fas fa-list-ul"></i> Ver Especificaciones
            </button>

            <button class="producto-btn" onclick="abrirModalPedido('${item.id}')">
                <i class="fab fa-whatsapp"></i> Lo quiero
            </button>

            <!-- Boton de compartir póster (Discreto para el admin) -->
            <button class="btn-share-discreto" onclick="event.stopPropagation(); generatePoster('${item.id}')" title="Generar Póster Publicitario">
                <i class="fas fa-share-nodes"></i>
            </button>
        `;
        grid.appendChild(card);
    });
}

function abrirModal(itemId) {
    const item = catalogoActual.find(i => i.id === itemId);
    if (!item) return;

    // Poblar cabecera básica
    document.getElementById('modal-marca').innerText = item.marca || 'GENERICO';
    document.getElementById('modal-modelo').innerHTML = `${item.modelo || 'MODELO'} <span style="color: var(--primary); margin-left:15px;">${formatMoneda(item[getPriceField(categoriaActual)])}</span>`;

    let imgFallback = 'https://placehold.co/300x300/f8fafc/4f46e5?text=' + categoriaActual.toUpperCase();
    document.getElementById('modal-img').src = item.enlace_foto || item.foto || item.enlace_logo || item.logo || imgFallback;

    const grid = document.getElementById('modal-specs-grid');
    grid.innerHTML = '';

    // Inyectar JRTech Intel (Solo si tiene AI Insight)
    if (item.aiInsight) {
        const intelHtml = `
            <div class="ai-intel-section" style="grid-column: 1/-1; background: linear-gradient(135deg, rgba(0, 240, 255, 0.05), rgba(188, 19, 254, 0.05)); border: 1px solid var(--glass-border); border-radius: 20px; padding: 25px; margin-bottom: 25px; position: relative; overflow: hidden;">
                <div style="position: absolute; right: -10px; top: -10px; opacity: 0.1; font-size: 5rem; color: var(--primary);">
                    <i class="fas fa-robot"></i>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <span style="background: var(--primary); color: white; padding: 5px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">JRTech Intel</span>
                    <span style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">Gama ${item.aiInsight.gama}</span>
                </div>
                <p style="font-size: 1.1rem; font-weight: 600; line-height: 1.4; color: var(--text-main); margin-bottom: 15px;">"${item.aiInsight.resumen}"</p>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 1; min-width: 200px;">
                        <p style="color: var(--secondary); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;"><i class="fas fa-check-circle"></i> Ideal para:</p>
                        <p style="font-size: 0.9rem; color: var(--text-dim);">${item.aiInsight.idealPara}</p>
                    </div>
                    ${item.aiInsight.noRecomendado ? `
                    <div style="flex: 1; min-width: 200px;">
                        <p style="color: #ff4757; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;"><i class="fas fa-exclamation-triangle"></i> No recomendado:</p>
                        <p style="font-size: 0.9rem; color: var(--text-dim);">${item.aiInsight.noRecomendado}</p>
                    </div>
                    ` : ''}
                </div>
                ${item.aiInsight.veredicto ? `
                <div style="border-top: 1px solid var(--glass-border); padding-top: 15px;">
                    <p style="color: var(--primary); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;"><i class="fas fa-gavel"></i> Veredicto:</p>
                    <p style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); font-style: italic;">"${item.aiInsight.veredicto}"</p>
                </div>
                ` : ''}
            </div>
        `;
        grid.insertAdjacentHTML('afterbegin', intelHtml);
    }

    const allEntries = [];
    const added = new Set();
    const skip = ['id', 'marca', 'modelo', 'precio', 'foto', 'logo', 'specs', 'categoria', 'fullText', 'proveedor', 'banner', 'categoria_manual'];

    // Función auxiliar para agregar entrada normalizando la llave
    const addEntry = (k, v) => {
        if (v === undefined || v === null || String(v).trim() === '') return;
        const sVal = String(v).trim();
        if (sVal.toLowerCase() === 'undefined' || sVal.toLowerCase() === 'null') return;

        const norm = normalizeKey(k);
        if (!added.has(norm)) {
            allEntries.push({ key: k, val: sVal });
            added.add(norm);
        }
    };

    const isLaptop = categoriaActual === 'portatiles';
    const groups = isLaptop ? SPECS_GROUPS.portatiles : SPECS_GROUPS.mobile;

    groups.forEach(group => {
        // Filtrar campos del grupo que tengan valor
        const groupFields = group.fields.map(k => ({ key: k, val: getSpec(item, k) }))
                                        .filter(f => f.val && f.val.trim() !== '' && f.val.toLowerCase() !== 'undefined');

        if (groupFields.length > 0) {
            grid.innerHTML += `<div class="spec-group-header" style="grid-column: 1/-1; margin-top: 20px; padding-bottom: 5px; border-bottom: 1px solid var(--primary); color: var(--primary); font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">
                ${group.name}
            </div>`;

            groupFields.forEach(f => {
                let displayVal = f.val;

                let label = f.key.replace(/_/g, ' ');
                label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                grid.innerHTML += `
                    <div class="spec-item">
                        <label>${label}</label>
                        <span>${displayVal}</span>
                    </div>
                `;
            });
        }
    });

    // Botón de compra central en la ficha
    grid.innerHTML += `
        <div style="grid-column: 1/-1; margin-top: 30px; text-align: center;">
            <button class="producto-btn" onclick="cerrarModal(true); abrirModalPedido('${item.id}')" style="max-width: 400px; margin: 0 auto; padding: 18px; font-size: 1.1rem; margin-bottom: 15px;">
                <i class="fab fa-whatsapp"></i> Lo quiero de una
            </button>
            <p style="margin-top: 10px; font-size: 0.8rem; color: var(--text-dim);">Entrega inmediata y garantía real de 1 año.</p>
        </div>
    `;

    // Inyectar sección de productos relacionados
    renderRelacionados(item);

    const modal = document.getElementById('specs-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Scroll al inicio del modal por si venimos de otro producto relacionado
    document.querySelector('#specs-modal .modal-content').scrollTop = 0;
}

function renderRelacionados(currentItem) {
    const container = document.getElementById('modal-specs-grid');
    const priceField = getPriceField(categoriaActual);
    
    // Todos los candidatos de la misma categoría excepto el actual
    let candidatos = catalogoActual.filter(it => it.id !== currentItem.id);

    // Calcular puntaje para cada candidato
    let puntuados = candidatos.map(cand => {
        return {
            item: cand,
            score: calcularPuntajeSimilitud(currentItem, cand)
        };
    });

    // Ordenar por puntaje (mejor primero) y tomar los 3 mejores
    let relacionados = puntuados
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(p => p.item);

    if (relacionados.length > 0) {
        const sectionHtml = `
            <div class="relacionados-section" style="grid-column: 1/-1; margin-top: 40px; padding-top: 30px; border-top: 2px dashed var(--glass-border);">
                <h3 style="margin-bottom: 20px; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-magic" style="color: var(--secondary);"></i> También te podría interesar...
                </h3>
                <div class="relacionados-grid">
                    ${relacionados.map(it => `
                        <div class="relacionado-card" onclick="abrirModal('${it.id}')">
                            <div class="relacionado-img-container">
                                <img src="${it.foto || 'https://placehold.co/100x100?text=EQUIPO'}" alt="${it.modelo}">
                            </div>
                            <div class="relacionado-info">
                                <p class="relacionado-marca">${it.marca}</p>
                                <p class="relacionado-modelo">${it.modelo}</p>
                                <p class="relacionado-precio">${formatMoneda(it[priceField])}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', sectionHtml);
    }
}

function calcularPuntajeSimilitud(itemA, itemB) {
    let score = 0;
    const priceField = getPriceField(categoriaActual);
    
    // 1. Cercanía de Precio (Máximo 40 puntos)
    const precioA = parseInt(itemA[priceField]) || 0;
    const precioB = parseInt(itemB[priceField]) || 0;
    if (precioA > 0 && precioB > 0) {
        const diferencia = Math.abs(precioA - precioB);
        const ratio = diferencia / precioA;
        if (ratio <= 0.1) score += 40;
        else if (ratio <= 0.2) score += 30;
        else if (ratio <= 0.4) score += 15;
    }

    // 2. Misma Marca (Bonus 15 puntos)
    if (itemA.marca === itemB.marca) score += 15;

    // 3. Similitud Técnica (Máximo 45 puntos)
    if (categoriaActual === 'portatiles') {
        // Comparar RAM (15 pts)
        if (getSpec(itemA, 'ram') === getSpec(itemB, 'ram')) score += 15;
        // Comparar Procesador/Gama (30 pts)
        if (itemA.aiInsight?.gama === itemB.aiInsight?.gama) score += 30;
    } else {
        // Móviles/Tablets
        // Comparar Antutu/Potencia (20 pts)
        const pA = parseInt(getSpec(itemA, 'antutu')) || 0;
        const pB = parseInt(getSpec(itemB, 'antutu')) || 0;
        if (pA > 0 && pB > 0) {
            const diffPotencia = Math.abs(pA - pB);
            if (diffPotencia < 100000) score += 20;
            else if (diffPotencia < 200000) score += 10;
        }
        // Comparar RAM (10 pts)
        if (getSpec(itemA, 'ram') === getSpec(itemB, 'ram')) score += 10;
        // Comparar Gama (15 pts)
        if (itemA.aiInsight?.gama === itemB.aiInsight?.gama) score += 15;
    }

    return score;
}

function cerrarModal(force = false, event = null) {
    if (force || (event && event.target.id === 'specs-modal')) {
        const modal = document.getElementById('specs-modal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Logic for copying product info for sharing
function copiarEstilo(estilo, itemId) {
    const item = catalogoActual.find(i => i.id === itemId);
    if (!item) return;
    
    const isLaptop = categoriaActual === 'portatiles';
    const icon = isLaptop ? '💻 Portátil' : (categoriaActual === 'celulares' ? '📱 Celular' : '📱 Tablet');
    
    let specsTxt = '';
    if (isLaptop) {
        const proc = getSpec(item, 'procesador') || getSpec(item, 'Procesador') || '-';
        const ram = getSpec(item, 'ram') || getSpec(item, 'RAM') || '-';
        const ssd = getSpec(item, 'ssd') || getSpec(item, 'SSD') || getSpec(item, 'almacenamiento') || '-';
        const estado = getSpec(item, 'estado') || 'Reacondicionado Grado A';

        specsTxt = `▫️ Procesador: ${proc}\n▫️ RAM: ${ram}\n▫️ Almacenamiento: ${ssd}\n▫️ Estado: ${estado}`;
    } else {
        const proc = getSpec(item, 'procesador') || '-';
        const ram = getSpec(item, 'ram', 'GB') || '-';
        const rom = getSpec(item, 'rom', 'GB') || getSpec(item, 'almacenamiento', 'GB') || '-';
        
        specsTxt = `▫️ Procesador: ${proc}\n▫️ RAM: ${ram}\n▫️ Almacenamiento: ${rom}`;
    }

    const priceField = getPriceField(categoriaActual);
    const precio = formatMoneda(item[priceField]);

    let extraText = '';
    if (estilo === 1) {
        const aiMsg = item.aiInsight ? item.aiInsight.resumen : 'Un equipo excelente y equilibrado, ideal para tus tareas del día a día sin complicaciones.';
        extraText = `🤖 *El ojo de la IA:*\n> "${aiMsg}"`;
    } else {
        extraText = `🏢 *El respaldo de JRTech:*\n> En JRTech nos aseguramos de que cada equipo pase por las pruebas más rigurosas antes de llegar a tus manos. Te entregamos tecnología de punta con garantía total y el servicio al cliente que nos caracteriza. ¡Tu inversión está segura con nosotros!`;
    }

    const textoCopiado = `${icon} *${item.marca} ${item.modelo}*\n${specsTxt}\n💰 Precio de venta: ${precio}\n\n${extraText}`;

    navigator.clipboard.writeText(textoCopiado).then(() => {
        alert("¡Texto copiado al portapapeles! Listo para pegar en WhatsApp.");
    }).catch(err => {
        console.error('Error al copiar: ', err);
        alert("No se pudo copiar el texto. Tu navegador puede estar bloqueando esta acción.");
    });
}

// Comparison Logic
function toggleComparar(id) {
    const index = listaComparar.indexOf(id);
    if (index === -1) {
        if (listaComparar.length >= 4) {
            alert("Solo puedes comparar hasta 4 equipos a la vez.");
            aplicarFiltros(); // Refrescar para resetear checkbox
            return;
        }
        listaComparar.push(id);
    } else {
        listaComparar.splice(index, 1);
    }
    actualizarDrawerComparar();
}

function actualizarDrawerComparar() {
    const drawer = document.getElementById('comparar-drawer');
    const num = document.getElementById('comparar-num');

    if (listaComparar.length > 0) {
        drawer.classList.add('active');
        num.innerText = listaComparar.length;
    } else {
        drawer.classList.remove('active');
    }
}

function limpiarComparativa() {
    listaComparar = [];
    actualizarDrawerComparar();
    aplicarFiltros(); // Refrescar grid para desmarcar checkboxes
}

function renderHeaderVersus(items) {
    if (items.length < 2) return '';
    
    const priceField = getPriceField(categoriaActual);
    
    // Identificar ganadores en campos clave
    const winAntutu = determinarGanador(items, 'antutu', 'max');
    const winRam = determinarGanador(items, 'ram', 'max');
    const winPrecio = determinarGanador(items, priceField, 'min');

    let duelHtml = '';
    items.forEach((item, idx) => {
        const isWinnerGeneral = (idx === 0); // Placeholder o lógica más compleja
        const imgFallback = 'https://placehold.co/200x200/f8fafc/4f46e5?text=PROD';
        
        duelHtml += `
            <div class="versus-item">
                <div class="versus-img-wrap">
                    <img src="${item.enlace_foto || item.foto || item.enlace_logo || item.logo || imgFallback}" alt="${item.modelo}" onerror="this.src='${imgFallback}'">
                </div>
                <div class="versus-item-info">
                    <div style="font-weight: 800; color: var(--primary); font-size: 0.8rem; text-transform: uppercase;">${item.marca}</div>
                    <div style="font-weight: 700; font-size: 1.1rem; color: white;">${item.modelo}</div>
                </div>
            </div>
            ${idx < items.length - 1 ? '<div class="versus-divider">VS</div>' : ''}
        `;
    });

    const statsToCompare = [
        { label: 'Potencia Antutu', key: 'antutu', winnerId: winAntutu },
        { label: 'Memoria RAM', key: 'ram', winnerId: winRam },
        { label: 'Precio', key: priceField, winnerId: winPrecio, isPrice: true }
    ];

    let statsHtml = '<div class="versus-stats-grid">';
    statsToCompare.forEach(stat => {
        statsHtml += `
            <div class="versus-stat-card">
                <div class="versus-stat-label">${stat.label}</div>
                <div style="display: flex; justify-content: space-around; gap: 10px; align-items: center;">
                    ${items.map(it => {
                        const val = getSpec(it, stat.key) || it[stat.key] || '0';
                        const displayVal = stat.isPrice ? formatMoneda(val) : val;
                        const isWin = it.id === stat.winnerId;
                        return `
                            <div style="position: relative; flex: 1; ${isWin ? 'color: var(--primary); font-weight: 900;' : 'color: var(--text-dim);'}">
                                ${displayVal}
                                ${isWin ? '<div class="winner-crown"><i class="fas fa-crown"></i></div>' : ''}
                            </div>
                        `;
                    }).join('<div style="opacity: 0.2">|</div>')}
                </div>
            </div>
        `;
    });
    statsHtml += '</div>';

    return `
        <div class="versus-header">
            <div class="versus-duel-container">
                ${duelHtml}
            </div>
            ${statsHtml}
        </div>
    `;
}

function determinarGanador(items, key, mode) {
    let bestVal = mode === 'max' ? -Infinity : Infinity;
    let winnerId = null;

    items.forEach(it => {
        let raw = getSpec(it, key) || it[key] || '0';
        // Limpiar para extraer número (ej: "8 GB" -> 8)
        let val = parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
        
        if (val === 0) return;

        if (mode === 'max' && val > bestVal) {
            bestVal = val;
            winnerId = it.id;
        } else if (mode === 'min' && val < bestVal) {
            bestVal = val;
            winnerId = it.id;
        }
    });

    return winnerId;
}

function abrirModalComparar() {
    const items = listaComparar.map(id => catalogoActual.find(it => it.id === id)).filter(it => it);
    if (items.length === 0) return;

    const tabla = document.getElementById('tabla-comparativa');
    const modalBody = document.querySelector('#comparar-modal .modal-body');
    
    // Limpiar Versus previo si existe
    const oldVersus = modalBody.querySelector('.versus-header');
    if (oldVersus) oldVersus.remove();

    // Renderizar Versus Visual
    const versusHtml = renderHeaderVersus(items);
    if (versusHtml) {
        modalBody.insertAdjacentHTML('afterbegin', versusHtml);
    }

    // Recopilar todas las llaves posibles de todos los items
    const allSpecKeys = new Set();
    const labelMap = {};
    const skip = ['id', 'marca', 'modelo', 'precio', 'foto', 'logo', 'specs', 'categoria', 'fullText', 'proveedor', 'banner', 'categoria_manual'];

    // Función para registrar llaves
    const scanKeys = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(k => {
            if (skip.includes(k)) return;
            const val = obj[k];
            if (val === undefined || val === null || String(val).trim() === '') return;

            const norm = normalizeKey(k);
            allSpecKeys.add(norm);
            if (!labelMap[norm]) labelMap[norm] = k;
        });
    };

    items.forEach(item => {
        scanKeys(item);
        if (item.specs) {
            let s = item.specs;
            if (typeof s === 'string') try { s = JSON.parse(s); } catch (e) { }
            scanKeys(s);
        }
    });

    let html = `<thead><tr><th>Especificación</th>`;
    const priceField = getPriceField(categoriaActual);

    items.forEach(item => {
        html += `
            <td>
                <div class="comparar-item-header">
                    <img src="${item.enlace_logo || item.logo || item.enlace_foto || item.foto || ''}" class="comparar-item-img" onerror="this.src='https://placehold.co/100x100?text=SIN+FOTO'">
                    <div class="comparar-item-nombre">${item.marca} ${item.modelo}</div>
                    <div class="comparar-item-precio">${formatMoneda(item[priceField])}</div>
                </div>
            </td>
        `;
    });
    html += `</tr></thead><tbody>`;

    const isLaptop = categoriaActual === 'portatiles';
    const groups = isLaptop ? SPECS_GROUPS.portatiles : SPECS_GROUPS.mobile;
    // priceField already declared above at line 551

    groups.forEach(group => {
        // Verificar si algún equipo tiene algún dato en este grupo
        const hasAnyData = group.fields.some(k => items.some(it => getSpec(it, k)));
        if (!hasAnyData) return;

        // Cabecera de Categoría en la Tabla
        html += `<tr class="tabla-comparativa-categoria"><th colspan="${items.length + 1}" style="background: var(--bg-accent); color: var(--primary); text-align: left; padding: 12px 20px; font-weight: 800; border-left: 4px solid var(--primary);">${group.name}</th></tr>`;

        group.fields.forEach(key => {
            let label = key.replace(/_/g, ' ');
            label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

            html += `<tr><th>${label}</th>`;
            items.forEach(item => {
                let val = getSpec(item, key) || '-';
                if (key.toLowerCase() === 'cod') val = reverseString(val);
                html += `<td>${val}</td>`;
            });
            html += `</tr>`;
        });
    });

    html += `</tbody>`;
    tabla.innerHTML = html;

    document.getElementById('comparar-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModalComparar(force = false, event = null) {
    if (force || (event && event.target.id === 'comparar-modal')) {
        document.getElementById('comparar-modal').classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Hero Random Product Logic
let heroProducts = [];
let currentHeroIndex = 0;
let heroInterval = null;

async function cargarProductoAleatorio() {
    try {
        const [resCel, resTab, resPor] = await Promise.all([
            fetch(`${API_URL}?api=celulares`),
            fetch(`${API_URL}?api=tablets`),
            fetch(`${API_URL}?api=portatiles`)
        ]);

        const [dataCel, dataTab, dataPor] = await Promise.all([
            resCel.json(),
            resTab.json(),
            resPor.json()
        ]);

        const cels = (dataCel && dataCel.items) ? dataCel.items.map(i => ({ ...i, categoria_manual: 'Celular' })) : [];
        const tabs = (dataTab && dataTab.items) ? dataTab.items.map(i => ({ ...i, categoria_manual: 'Tablet' })) : [];
        const pors = (dataPor && dataPor.items) ? dataPor.items.map(i => ({ ...i, categoria_manual: 'Portátil' })) : [];

        // Aseguramos que el hero contenga una mezcla real de al menos 3 de cada si hay
        let mezcla = [];
        mezcla = mezcla.concat(cels.sort(() => Math.random() - 0.5).slice(0, 4));
        mezcla = mezcla.concat(tabs.sort(() => Math.random() - 0.5).slice(0, 4));
        mezcla = mezcla.concat(pors.sort(() => Math.random() - 0.5).slice(0, 4));

        if (mezcla.length > 0) {
            heroProducts = mezcla.sort(() => Math.random() - 0.5);
            currentHeroIndex = 0;

            renderHeroRandomProduct(heroProducts[currentHeroIndex]);

            if (heroInterval) clearInterval(heroInterval);
            heroInterval = setInterval(() => {
                currentHeroIndex = (currentHeroIndex + 1) % heroProducts.length;
                renderHeroRandomProduct(heroProducts[currentHeroIndex]);
            }, 5000);
        }
    } catch (err) {
        console.error("Error cargando producto aleatorio", err);
    }
}

function renderHeroRandomProduct(item) {
    const container = document.getElementById('random-product-container');
    if (!container || !item) return;

    const imgFallback = 'https://placehold.co/300x300/f8fafc/4f46e5?text=DESTACADO';
    const imgSrc = item.enlace_foto || item.foto || item.enlace_logo || item.logo || imgFallback;

    // Generar specs resumidos y exhaustivos para el Hero
    let specsHtml = '';
    const ram = getSpec(item, 'ram', 'GB');
    const rom = getSpec(item, 'rom', 'GB');
    const ssd = getSpec(item, 'ssd', 'GB');
    const proc = getSpec(item, 'procesador') || getSpec(item, 'Procesador');
    const bat = getSpec(item, 'bateria', 'mAh');

    const mainSpec = proc || 'Equipo de alta calidad';
    const memSpec = (ram || rom || ssd) ? ` | ${ram}${ram && (rom || ssd) ? '/' : ''}${rom || ssd}` : '';
    const extraSpec = bat ? ` | ${bat}` : '';

    specsHtml = `<div class="producto-specs" style="margin-bottom:15px; font-size:0.85rem; color:var(--text-dim);">
        <i class="fas fa-microchip"></i> ${mainSpec}${memSpec}${extraSpec}
    </div>`;

    container.innerHTML = `
        <div class="producto-card" style="margin: 0; transform: translateY(0); opacity: 0; transition: opacity 0.5s ease-in-out;">
            <div class="producto-img-container" style="height: 180px;">
                <img src="${imgSrc}" alt="${item.marca} ${item.modelo}" class="producto-img" onerror="this.src='${imgFallback}'">
            </div>
            <div class="producto-marca" style="color: var(--primary); font-weight: 800; font-size: 1rem;"><i class="fas fa-star"></i> ${item.categoria_manual?.toUpperCase() || 'EQUIPO'} DESTACADO</div>
            <h3 class="producto-modelo">${item.marca} ${item.modelo}</h3>
            
            ${specsHtml}

            <div class="producto-precio">${formatMoneda(item[getPriceField(item.categoria_manual?.toLowerCase() === 'portátil' ? 'portatiles' : 'celulares')])}</div>
            
            <p style="text-align: center; font-size: 0.85rem; color: var(--text-dim); margin-bottom: 20px; font-weight: 500;">Disponible para entrega inmediata con garantía total.</p>

            <button onclick="abrirModalPedido('${item.id}', true)" class="producto-btn" style="padding: 12px;">
                <i class="fab fa-whatsapp"></i> Lo quiero ya
            </button>
        </div>
    `;

    requestAnimationFrame(() => {
        const card = container.querySelector('.producto-card');
        if (card) card.style.opacity = '1';
    });
}

// Order Form Logic
let itemSeleccionadoParaPedido = null;

function abrirModalPedido(itemId, isHero = false) {
    let item = null;
    if (isHero) {
        item = heroProducts.find(i => i.id === itemId);
    } else {
        item = catalogoActual.find(i => i.id === itemId);
    }

    if (!item) return;
    itemSeleccionadoParaPedido = item;

    const priceField = getPriceField(item.categoria_manual?.toLowerCase() === 'portátil' ? 'portatiles' : categoriaActual);
    document.getElementById('pedido-modal-modelo').innerText = `${item.marca} ${item.modelo}`;
    document.getElementById('pedido-modal-precio').innerText = formatMoneda(item[priceField]);

    const modal = document.getElementById('pedido-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModalPedido(force = false, event = null) {
    if (force || (event && event.target.id === 'pedido-modal')) {
        const modal = document.getElementById('pedido-modal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function enviarPedido(event) {
    event.preventDefault();
    if (!itemSeleccionadoParaPedido) return;

    const nombre = document.getElementById('pedido-nombre').value;
    const cedula = document.getElementById('pedido-cedula').value;
    const telefono = document.getElementById('pedido-telefono').value;
    const email = document.getElementById('pedido-email').value;
    const municipio = document.getElementById('pedido-municipio').value;
    const departamento = document.getElementById('pedido-departamento').value;
    const direccion = document.getElementById('pedido-direccion').value;
    const pago = document.getElementById('pedido-metodopago').value;
    const notas = document.getElementById('pedido-notas').value;

    const purchaseData = obtenerDatosCompra(itemSeleccionadoParaPedido, categoriaActual);

    const statusDiv = document.getElementById('pedido-estado');
    statusDiv.style.display = 'block';
    statusDiv.style.background = 'rgba(34, 197, 94, 0.1)';
    statusDiv.style.color = '#22c55e';
    statusDiv.innerText = '¡Procesando pedido y sincronizando datos! Espere un momento...';

    // Preparar datos para el ERP
    const datosPedido = {
        action: 'registrarPedido',
        pedido: {
            producto: {
                id: itemSeleccionadoParaPedido.id,
                marca: itemSeleccionadoParaPedido.marca,
                modelo: itemSeleccionadoParaPedido.modelo,
                precio: itemSeleccionadoParaPedido[getPriceField(itemSeleccionadoParaPedido.categoria_manual?.toLowerCase() === 'portátil' ? 'portatiles' : categoriaActual)],
                codReal: itemSeleccionadoParaPedido.cod || itemSeleccionadoParaPedido.COD || '',
                costo: purchaseData.costo,
                proveedor: purchaseData.proveedor,
                specsConcatenadas: purchaseData.specsConcatenadas
            },
            cliente: {
                nombre: nombre,
                cedula: cedula,
                telefono: telefono,
                email: email,
                municipio: municipio,
                departamento: departamento,
                direccion: direccion
            },
            pago: pago,
            notas: notas
        }
    };

    // Sincronización con Google Sheets
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Evita problemas de preflight en Apps Script
        body: JSON.stringify(datosPedido)
    })
        .then(response => response.json())
        .then(res => {
            // La sugerencia ya no se incluye aquí para que el cliente no la vea.
            // Solo se envía por correo al administrador.

            // Redirigir a WhatsApp con la sugerencia incluida
            const mensaje = `*NUEVO PEDIDO DESDE LA WEB*%0A%0A` +
                `*Equipo:* ${itemSeleccionadoParaPedido.marca} ${itemSeleccionadoParaPedido.modelo}%0A` +
                `*Precio:* ${formatMoneda(itemSeleccionadoParaPedido[getPriceField(itemSeleccionadoParaPedido.categoria_manual?.toLowerCase() === 'portátil' ? 'portatiles' : categoriaActual)])}%0A%0A` +
                `*DATOS DEL CLIENTE*%0A` +
                `*Nombre:* ${nombre}%0A` +
                `*Teléfono:* ${telefono}%0A` +
                `*Email:* ${email || 'No proporcionado'}%0A` +
                `*Ubicación:* ${municipio}, ${departamento}%0A` +
                `*Dirección:* ${direccion}%0A` +
                `*Método de Pago:* ${pago}%0A` +
                `*Notas:* ${notas || 'Ninguna'}%0A%0A` +
                `Hola Albeiro, acabo de completar el formulario en la web. ¿Cómo procedemos?`;

            window.open(`https://wa.me/${CONFIG.TEL_WHATSAPP}?text=${mensaje}`, '_blank');
            cerrarModalPedido(true);
            statusDiv.style.display = 'none';
        })
        .catch(err => {
            console.error("Error en sincronización:", err);
            statusDiv.style.background = 'rgba(239, 68, 68, 0.1)';
            statusDiv.style.color = '#ef4444';
            statusDiv.innerText = 'Error al sincronizar, pero abriendo WhatsApp...';

            // WhatsApp fallback sin sugerencia si falla el API
            const mensajeFallback = `*NUEVO PEDIDO (SYNC PENDIENTE)*%0A%0A...`;
            setTimeout(() => {
                window.open(`https://wa.me/${CONFIG.TEL_WHATSAPP}?text=${mensajeFallback}`, '_blank');
                cerrarModalPedido(true);
                statusDiv.style.display = 'none';
            }, 1500);
        });
}

function actualizarEstadoHub() {
    const buttons = document.querySelectorAll('.hub-btn');
    buttons.forEach(btn => {
        const onClickAttr = btn.getAttribute('onclick');
        if (onClickAttr && onClickAttr.includes(`'${categoriaActual}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function obtenerDatosCompra(item, categoria) {
    let costoMinimo = 0;
    let proveedor = "Desconocido";
    const esPortatil = (categoria === 'portatiles' || item.categoria_manual?.toLowerCase() === 'portátil');

    if (esPortatil) {
        // En portátiles solo hay un proveedor
        costoMinimo = parseInt(item.compra || item.costo || item.minimo || 0);
        proveedor = item.proveedor || "JRTech Global";
    } else {
        // Buscar el precio mínimo entre los campos de proveedores
        // Buscamos campos con nombres de proveedores conocidos o simplemente números
        const camposIgnorar = ['id', 'precio', 'marca', 'modelo', 'foto', 'enlace_foto', 'categoria_manual', 'specs', 'aiinsight', 'rom', 'ram', 'antutu', 'cod', 'codigo', 'cod_real'];
        let min = Infinity;
        let provFound = "No asignado";

        for (let key in item) {
            const val = item[key];
            const numVal = parseInt(val);
            if (!camposIgnorar.includes(key.toLowerCase()) && !isNaN(numVal) && numVal > 10000) {
                if (numVal < min) {
                    min = numVal;
                    provFound = key.toUpperCase();
                }
            }
        }
        costoMinimo = (min === Infinity) ? 0 : min;
        proveedor = provFound;
    }

    // Concatenar especificaciones para la columna A
    // COD real + marca + modelo + ssd + ram + tamaño pantalla + tipo de pantalla
    const cod = item.cod || item.COD || '';
    const marca = item.marca || '';
    const modelo = item.modelo || '';
    const ssd = getSpec(item, 'ssd') || getSpec(item, 'rom') || '';
    const ram = getSpec(item, 'ram') || '';
    const pant = getSpec(item, 'pantalla') || '';
    const tipoPant = getSpec(item, 'tipo_pantalla') || getSpec(item, 'tipo_panel') || '';

    const specsConcatenadas = `${cod} ${marca} ${modelo} ${ssd} ${ram} ${pant} ${tipoPant}`.replace(/\s+/g, ' ').trim();

    return { costo: costoMinimo, proveedor: proveedor, specsConcatenadas: specsConcatenadas };
}


// ============================================
// WIZARD "AYÚDAME A ELEGIR"
// ============================================

let wizardPasoActual = 0;
let wizardRespuestas = {};

const WIZARD_STEPS = [
    {
        pregunta: "¿Qué uso principal le va a dar al equipo?",
        opciones: [
            { texto: "🎮 Solo para juegos pesados", val: "gamer", score: { key: 'idealPara', match: 'Gamer' } },
            { texto: "💼 Trabajo y oficina (Multitarea)", val: "trabajo", score: { key: 'idealPara', match: 'trabajo' } },
            { texto: "🎬 Redes sociales y streaming", val: "basico", score: { key: 'idealPara', match: 'streaming' } },
            { texto: "📸 Fotografía y cámaras pro", val: "foto", score: { key: 'idealPara', match: 'Cámara Pro' } }
        ]
    },
    {
        pregunta: "¿Cuál es su presupuesto aproximado?",
        opciones: [
            { texto: "💎 No importa, quiero lo mejor", val: 'high' },
            { texto: "⚖️ Algo equilibrado (Calidad/Precio)", val: 'mid' },
            { texto: "💰 Busco lo más económico", val: 'low' }
        ]
    },
    {
        pregunta: "¿Qué es lo que más le importa?",
        opciones: [
            { texto: "🔋 Que la batería dure todo el día", val: 'bateria', score: { key: 'idealPara', match: 'Battery' } },
            { texto: "⚡ Que sea ultra rápido", val: 'potencia', score: { key: 'gama', match: 'Alta' } },
            { texto: "📱 Una pantalla espectacular", val: 'pantalla', score: { key: 'resumen', match: 'Pantalla' } }
        ]
    }
];

function abrirWizard() {
    wizardPasoActual = 0;
    wizardRespuestas = {};
    renderPasoWizard();
    document.getElementById('wizard-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarWizard(force = false, event = null) {
    if (force || (event && event.target.id === 'wizard-modal')) {
        document.getElementById('wizard-modal').classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function renderPasoWizard() {
    const container = document.getElementById('wizard-body');
    const step = WIZARD_STEPS[wizardPasoActual];

    let html = `
        <div class="wizard-step-indicator" style="display: flex; gap: 5px; margin-bottom: 20px;">
            ${WIZARD_STEPS.map((_, i) => `<div style="flex: 1; height: 4px; border-radius: 10px; background: ${i <= wizardPasoActual ? 'var(--primary)' : 'var(--glass-border)'}"></div>`).join('')}
        </div>
        <h3 style="font-size: 1.2rem; margin-bottom: 25px; color: white;">${step.pregunta}</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${step.opciones.map((opt, idx) => `
                <button class="wizard-opt-btn" onclick="seleccionarOpcionWizard(${idx})" style="text-align: left; padding: 15px 20px; background: var(--bg-main); border: 1px solid var(--glass-border); border-radius: 15px; color: var(--text-main); font-weight: 600; cursor: pointer; transition: var(--transition);">
                    ${opt.texto}
                </button>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;

    // Agregar estilos dinámicos para hover de opciones
    document.querySelectorAll('.wizard-opt-btn').forEach(btn => {
        btn.onmouseover = () => { btn.style.borderColor = 'var(--primary)'; btn.style.background = 'rgba(0, 240, 255, 0.05)'; };
        btn.onmouseout = () => { btn.style.borderColor = 'var(--glass-border)'; btn.style.background = 'var(--bg-main)'; };
    });
}

function seleccionarOpcionWizard(idx) {
    const opt = WIZARD_STEPS[wizardPasoActual].opciones[idx];
    wizardRespuestas[wizardPasoActual] = opt;

    if (wizardPasoActual < WIZARD_STEPS.length - 1) {
        wizardPasoActual++;
        renderPasoWizard();
    } else {
        mostrarResultadoWizard();
    }
}

function mostrarResultadoWizard() {
    const container = document.getElementById('wizard-body');
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-cog fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 20px;"></i>
            <p style="font-weight: 700; font-size: 1.1rem;">Consultando con Albeiro e Inteligencia JRTech...</p>
        </div>
    `;

    setTimeout(() => {
        const recomendacion = calcularRecomendacion();
        if (!recomendacion) {
            container.innerHTML = `
                <div style="text-align: center;">
                    <p style="margin-bottom: 20px;">No encontré un equipo exacto, pero pilla estos que son geniales.</p>
                    <button class="producto-btn" onclick="cerrarWizard(true)">Ver catálogo completo</button>
                </div>
            `;
            return;
        }

        const priceField = getPriceField(categoriaActual);
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="background: rgba(0, 240, 255, 0.1); padding: 10px; border-radius: 50px; display: inline-block; margin-bottom: 15px; color: var(--primary); font-weight: 800; font-size: 0.8rem; text-transform: uppercase;">✨ ¡ESTE ES SU GALLO! ✨</div>
                <div style="display: flex; align-items: center; gap: 20px; background: var(--bg-main); padding: 20px; border-radius: 20px; border: 1px solid var(--primary); margin-bottom: 25px; text-align: left;">
                    <img src="${recomendacion.enlace_logo || recomendacion.logo || recomendacion.enlace_foto || recomendacion.foto || ''}" style="width: 100px; height: 100px; object-fit: contain; background: white; border-radius: 12px; padding: 5px;" onerror="this.src='https://placehold.co/100x100?text=EQUIPO'">
                    <div>
                        <div style="font-weight: 800; color: var(--primary); font-size: 0.75rem;">${recomendacion.marca}</div>
                        <div style="font-weight: 700; font-size: 1.1rem; color: white; line-height: 1.2;">${recomendacion.modelo}</div>
                        <div style="font-weight: 800; font-size: 1.2rem; margin-top: 5px; color: white;">${formatMoneda(recomendacion[priceField])}</div>
                    </div>
                </div>
                <div style="background: var(--bg-accent); padding: 15px; border-radius: 15px; margin-bottom: 25px; font-style: italic; color: var(--text-dim); font-size: 0.9rem;">
                    "${recomendacion.aiInsight?.resumen || 'Un equipo excelente para lo que busca.'}"
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-secundario" style="margin:0; flex:1" onclick="cerrarWizard(true); abrirModal('${recomendacion.id}')">Ver ficha técnica</button>
                    <button class="producto-btn" style="margin:0; flex:2" onclick="cerrarWizard(true); abrirModalPedido('${recomendacion.id}')">Lo quiero de una</button>
                </div>
            </div>
        `;
    }, 1500);
}

function calcularRecomendacion() {
    let puntuados = catalogoActual.map(it => {
        let score = 0;
        const priceField = getPriceField(categoriaActual);
        const precio = parseInt(it[priceField]) || 0;

        // Analizar cada respuesta dada
        Object.values(wizardRespuestas).forEach(resp => {
            if (resp.score) {
                const itemData = (it.aiInsight?.[resp.score.key] || "").toLowerCase() + " " + (it.aiInsight?.resumen || "").toLowerCase();
                if (itemData.includes(resp.score.match.toLowerCase())) score += 10;
            }
            
            // Filtro de Presupuesto
            if (resp.val === 'low' && precio < 2000000) score += 5;
            if (resp.val === 'mid' && precio >= 2000000 && precio < 3500000) score += 5;
            if (resp.val === 'high' && precio >= 3500000) score += 5;
        });

        return { item: it, score };
    });

    puntuados.sort((a, b) => b.score - a.score);
    return puntuados[0]?.score > 0 ? puntuados[0].item : catalogoActual[0];
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (typeof cargarTextos === 'function') {
        cargarTextos();
    }

    cargarProductoAleatorio();

    const drop = document.querySelector(".dropbtn");
    const menu = document.querySelector(".dropdown-content");

    if (drop && menu) {
        drop.addEventListener("click", () => {
            const expanded = drop.getAttribute("aria-expanded") === "true";
            drop.setAttribute("aria-expanded", !expanded);
            menu.style.display = expanded ? "none" : "block";
        });
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll("section:not(#catalogo)").forEach(s => {
        s.style.opacity = "0";
        s.style.transform = "translateY(30px)";
        s.style.transition = "all 0.8s ease-out";
        observer.observe(s);
    });
});

function renderSugerenciasBusqueda() {
    const container = document.getElementById('search-suggestions');
    if (!container) return;

    const sugerencias = {
        portatiles: [
            { text: 'Gamer', icon: 'fas fa-gamepad' },
            { text: 'Económico', icon: 'fas fa-tag' },
            { text: 'Diseño', icon: 'fas fa-paint-brush' },
            { text: 'Ryzen', icon: 'fas fa-microchip' }
        ],
        mobile: [
            { text: 'Cámara Pro', icon: 'fas fa-camera' },
            { text: 'Gamer', icon: 'fas fa-bolt' },
            { text: 'Amoled', icon: 'fas fa-clapperboard' },
            { text: 'Batería', icon: 'fas fa-battery-full' }
        ],
        tablets: [
            { text: 'Económica', icon: 'fas fa-wallet' },
            { text: 'Estudio', icon: 'fas fa-pen-nib' },
            { text: 'Potente', icon: 'fas fa-rocket' }
        ]
    };

    const slugs = sugerencias[categoriaActual] || sugerencias.mobile;
    container.innerHTML = slugs.map(s => `
        <div class="search-chip" onclick="ejecutarSugerencia('${s.text}')">
            <i class="${s.icon}"></i> ${s.text}
        </div>
    `).join('');
}

function ejecutarSugerencia(texto) {
    const input = document.getElementById('catalogo-search');
    input.value = texto;
    aplicarFiltros();
}

// ============================================
// AI INSIGHTS LOGIC (JRTech Intel)
// ============================================

function procesarCatalogoConIA() {
    catalogoActual = catalogoActual.map(item => {
        const isLaptop = categoriaActual === 'portatiles';
        const itemWithIA = { ...item };
        
        if (isLaptop) {
            itemWithIA.aiInsight = generarComentarioPortatilIA(item);
        } else {
            // Preparar datos para móviles/Tablets
            const datosParaIA = {
                antutu: parseInt(getSpec(item, 'antutu')) || 0,
                bateria: parseInt(getSpec(item, 'bateria')) || 0,
                pantalla: parseFloat(getSpec(item, 'pantalla')) || 0,
                refresco: parseInt(getSpec(item, 'refresco')) || 0,
                camPrincipal: parseInt(getSpec(item, 'cam_ppal')) || 0,
                camSelfie: parseInt(getSpec(item, 'cam_selfie')) || 0,
                precio: parseInt(item.precio) || 0,
                red5g: getSpec(item, 'red_5g')
            };
            itemWithIA.aiInsight = generarComentarioIA(datosParaIA);
        }
        return itemWithIA;
    });
}

function generarComentarioIA(datos) {
    const { antutu = 0, bateria = 0, refresco = 0, camPrincipal = 0, camSelfie = 0, precio = 0, red5g = "" } = datos;

    let puntosFuertes = [];
    let idealPara = [];
    let noRecomendado = [];

    let gama = "Entrada";
    if (antutu >= 900000) gama = "Alta";
    else if (antutu >= 600000) gama = "Media-Alta";
    else if (antutu >= 400000) gama = "Media";
    else if (antutu >= 250000) gama = "Media-Baja";

    let score = 0;
    if (antutu >= 900000) score += 4;
    else if (antutu >= 600000) score += 3;
    else if (antutu >= 400000) score += 2;
    else if (antutu >= 250000) score += 1;

    if (refresco >= 120) {
        score += 1;
        puntosFuertes.push("Pantalla de alta fluidez");
    }
    if (bateria >= 5000) {
        score += 1;
        puntosFuertes.push("Batería de larga duración");
        idealPara.push("uso intensivo");
    }

    if (score >= 5) {
        puntosFuertes.unshift("Rendimiento sobresaliente");
        idealPara.push("gaming exigente", "multitarea pesada");
    } else if (score >= 3) {
        puntosFuertes.unshift("Rendimiento sólido y equilibrado");
        idealPara.push("redes sociales", "streaming");
    } else {
        puntosFuertes.unshift("Uso funcional para tareas básicas");
        idealPara.push("WhatsApp", "llamadas");
        noRecomendado.push("gaming pesado");
    }

    if (camPrincipal >= 108) {
        puntosFuertes.push("Cámara de alta resolución");
        idealPara.push("fotografía detallada");
    }

    return {
        gama,
        resumen: puntosFuertes.slice(0, 3).join(". ") + ".",
        idealPara: [...new Set(idealPara)].join(", "),
        noRecomendado: [...new Set(noRecomendado)].join(", "),
        veredicto: `Un equipo de gama ${gama} que destaca por su ${puntosFuertes[0].toLowerCase()}, ideal para quienes buscan ${idealPara[0] || 'un buen equilibrio'}.`
    };
}

function generarComentarioPortatilIA(item) {
    const safe = (v) => (v ?? "").toString().toLowerCase();
    const num = (v) => parseInt((v ?? "").toString().replace(/[^\d]/g, "")) || 0;

    const cpu = safe(getSpec(item, 'procesador'));
    const ram = num(getSpec(item, 'ram'));
    const ssd = num(getSpec(item, 'ssd'));
    const grafica = safe(getSpec(item, 'modelo_grafica') || getSpec(item, 'grafica'));
    const precio = Number(item.precio) || 0;

    let puntosFuertes = [];
    let idealPara = [];
    let noRecomendado = [];
    let gama = "Entrada";

    if (cpu.includes("i7") || cpu.includes("ryzen 7") || cpu.includes("i9") || cpu.includes("ryzen 9")) {
        gama = "Alta";
        puntosFuertes.push("Procesador de alto rendimiento para cargas exigentes");
        idealPara.push("programación avanzada", "edición multimedia");
    } else if (cpu.includes("i5") || cpu.includes("ryzen 5")) {
        gama = "Media-Alta";
        puntosFuertes.push("Procesador equilibrado para trabajo profesional");
        idealPara.push("trabajo", "estudio");
    }

    if (ram >= 16) puntosFuertes.push("Memoria RAM de gran capacidad");
    if (ssd >= 512) puntosFuertes.push("Almacenamiento rápido y espacioso");

    if (grafica.includes("rtx") || grafica.includes("gtx") || (grafica.includes("radeon") && !grafica.includes("integrated"))) {
        gama = "Alta";
        puntosFuertes.push("Gráfica dedicada apta para gaming y diseño");
        idealPara.push("gaming", "renderizado");
    } else {
        noRecomendado.push("gaming exigente");
    }

    const resumen = puntosFuertes.length ? puntosFuertes.slice(0, 3).join(". ") + "." : "Equipo funcional para tareas generales.";
    const idealFinal = idealPara.length ? [...new Set(idealPara)].join(", ") : "uso general";

    return {
        gama,
        resumen,
        idealPara: idealFinal,
        noRecomendado: noRecomendado.join(", "),
        veredicto: `Portátil de gama ${gama} bien orientado a ${idealFinal.split(",")[0] || "uso general"}.`
    };
}

// --- NUEVA LÓGICA UX REDESIGN ---

document.addEventListener('DOMContentLoaded', () => {
    const hub = document.getElementById('catalog-nav-row');
    const catalogCta = document.getElementById('catalog-cta');
    
    // Revelar hub con Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (hub) hub.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    if (catalogCta) observer.observe(catalogCta);

    // Revelar hub por scroll (respaldo para móviles)
    window.addEventListener('scroll', () => {
        if (window.scrollY > (document.documentElement.scrollHeight * 0.3)) {
            if (hub) hub.classList.add('visible');
        }
    });

    // Cargar textos iniciales
    if (typeof cargarTextos === 'function') cargarTextos();

    // Lógica de ocultar/mostrar botones por dirección de scroll
    let lastScrollY = window.scrollY;
    const navElement = document.querySelector('nav');
    const waButton = document.querySelector('.whatsapp-float');
    const adminBtn = document.getElementById('admin-trigger');

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        
        // El usuario baja: Mostrar botones (según pedido específico)
        // El usuario sube: Ocultar botones
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Bajando (DOWN) -> MOSTRAR
            navElement?.classList.remove('hidden-scroll');
            waButton?.classList.remove('hidden-scroll');
            adminBtn?.classList.remove('hidden-scroll');
        } else if (currentScrollY < lastScrollY && currentScrollY > 0) {
            // Subiendo (UP) -> OCULTAR
            navElement?.classList.add('hidden-scroll');
            waButton?.classList.add('hidden-scroll');
            adminBtn?.classList.add('hidden-scroll');
        }

        // Si llega al tope, siempre mostrar
        if (currentScrollY <= 0) {
            navElement?.classList.remove('hidden-scroll');
            waButton?.classList.remove('hidden-scroll');
            adminBtn?.classList.remove('hidden-scroll');
        }

        lastScrollY = currentScrollY;
    }, { passive: true });
    
    // Inyectar logo oficial en los placeholders
    inyectarLogo();
    
    // Cargar textos iniciales
    if (typeof cargarTextos === 'function') {
        cargarTextos();
    }
});

function inyectarLogo() {
    if (typeof LOGO_BASE64 === 'undefined') return;
    
    const headerLogoContainer = document.getElementById('header-logo-placeholder');
    
    const logoHtml = `<img src="${LOGO_BASE64}" alt="JRTech Logo" class="brand-logo-img">`;
    
    if (headerLogoContainer) {
        headerLogoContainer.innerHTML = logoHtml;
    }
}

function toggleFaq(el) {
    const item = el.closest('.faq-item');
    item.classList.toggle('active');
}

function mostrarCatalogAction() {
    const catalogo = document.getElementById('catalogo');
    if (catalogo) {
        catalogo.style.display = 'block';
        catalogo.scrollIntoView({ behavior: 'smooth' });
    }
    const hub = document.getElementById('catalog-nav-row');
    if (hub) hub.classList.add('visible');
}

// Sobrescribir mostrar para integrar con el catálogo
const originalMostrar = mostrar;
mostrar = function(id) {
    if (id === 'catalogo') {
        mostrarCatalogAction();
    } else {
        originalMostrar(id);
    }
};

function getBrandLogo(item) {
    if (!item) return null;
    
    // 1. Intentar en el nivel raíz
    if (item.enlace_logo) return item.enlace_logo;
    if (item.logo) return item.logo;
    
    // 2. Intentar dentro de specs (común en portátiles)
    if (item.specs) {
        if (item.specs.enlace_logo) return item.specs.enlace_logo;
        if (item.specs.logo) return item.specs.logo;
    }
    
    return null;
}
