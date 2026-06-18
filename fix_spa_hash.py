import re

# Fix redirect files
html_files = ['celulares.html', 'tablets.html', 'portatiles.html', 'escritorio.html', 'impresoras.html']
for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    content = content.replace("window.location.replace('index.html?cat=' + page);", "window.location.replace('index.html#cat=' + page);")
    with open(file, 'w') as f:
        f.write(content)

# Fix main.js
with open('main.js', 'r') as f:
    main_js = f.read()

# Replace pushState and popstate logic
spa_logic_old = """    // SPA: Interceptar clicks en enlaces del menú
    document.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;

        const catMatch = href.match(/^(celulares|tablets|portatiles|escritorio|impresoras)\.html/);
        if (catMatch) {
            e.preventDefault();
            const cat = catMatch[1];
            window.history.pushState(null, '', '?cat=' + cat);
            cargarCatalogo(cat);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else if (href === 'index.html' || href === '/') {
            e.preventDefault();
            window.history.pushState(null, '', 'index.html');
            // Restaurar vista de landing page
            document.querySelectorAll("main section").forEach(sec => sec.style.display = "block");
            const catSec = document.getElementById('catalogo');
            if (catSec) catSec.style.display = "none";
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    // SPA: Detectar botón Atrás del navegador
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const cat = params.get('cat');
        if (cat) {
            cargarCatalogo(cat);
        } else {
            // Landing page
            document.querySelectorAll("main section").forEach(sec => sec.style.display = "block");
            const catSec = document.getElementById('catalogo');
            if (catSec) catSec.style.display = "none";
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    // Cargar catálogo inicial por URL
    const urlParams = new URLSearchParams(window.location.search);
    const catFromUrl = urlParams.get('cat');
    if (catFromUrl) {
        cargarCatalogo(catFromUrl);
    } else if (typeof window.PAGE_CATEGORY !== 'undefined' && window.PAGE_CATEGORY) {
        cargarCatalogo(window.PAGE_CATEGORY);
    }"""

spa_logic_new = """    // SPA: Interceptar clicks en enlaces del menú
    document.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http')) return;
        
        // Ignorar anclas internas regulares que no son de catálogo
        if (href.startsWith('#') && !href.startsWith('#cat=')) return;

        const catMatch = href.match(/^(celulares|tablets|portatiles|escritorio|impresoras)\.html/);
        if (catMatch) {
            e.preventDefault();
            const cat = catMatch[1];
            window.location.hash = 'cat=' + cat; // Evita el error de pushState en file:///
            cargarCatalogo(cat);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else if (href === 'index.html' || href === '/') {
            e.preventDefault();
            window.location.hash = ''; // Limpia el hash
            // Restaurar vista de landing page
            document.querySelectorAll("main section").forEach(sec => sec.style.display = "block");
            const catSec = document.getElementById('catalogo');
            if (catSec) catSec.style.display = "none";
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    // SPA: Detectar cambios en el Hash (Atrás/Adelante o clics)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (hash.startsWith('#cat=')) {
            cargarCatalogo(hash.substring(5));
        } else if (hash === '' || hash === '#') {
            // Landing page
            document.querySelectorAll("main section").forEach(sec => sec.style.display = "block");
            const catSec = document.getElementById('catalogo');
            if (catSec) catSec.style.display = "none";
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    // Cargar catálogo inicial por URL (Hash)
    const hash = window.location.hash;
    let catFromUrl = null;
    if (hash.startsWith('#cat=')) {
        catFromUrl = hash.substring(5);
    }
    if (catFromUrl) {
        cargarCatalogo(catFromUrl);
    } else if (typeof window.PAGE_CATEGORY !== 'undefined' && window.PAGE_CATEGORY) {
        cargarCatalogo(window.PAGE_CATEGORY);
    }"""

main_js = main_js.replace(spa_logic_old, spa_logic_new)

with open('main.js', 'w') as f:
    f.write(main_js)

print("SPA hash logic applied.")
