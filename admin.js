/**
 * admin.js - Editor Interactivo para JRTech
 */

let editModeActive = false;

function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    panel.classList.toggle('active');
}

function toggleEditMode() {
    editModeActive = !editModeActive;
    const btn = document.getElementById('edit-mode-toggle');
    
    if (editModeActive) {
        btn.innerText = "ACTIVADO";
        btn.classList.add('active');
        enableVisualEditing();
    } else {
        btn.innerText = "DESACTIVADO";
        btn.classList.remove('active');
        disableVisualEditing();
    }
}

function enableVisualEditing() {
    // Buscar todos los elementos que tienen un ID que coincide con globalTexts
    for (const id in globalTexts) {
        if (id.endsWith("-icon")) continue; // No editar iconos visualmente para evitar corrupción
        const el = document.getElementById(id);
        if (el) {
            el.contentEditable = "true";
            el.addEventListener('blur', updateGlobalTextFromElement);
        }
    }
    alert("Modo Edición Activado. Ahora puedes hacer clic en cualquier texto y cambiarlo.");
}

function disableVisualEditing() {
    for (const id in globalTexts) {
        if (id.endsWith("-icon")) continue;
        const el = document.getElementById(id);
        if (el) {
            el.contentEditable = "false";
            el.removeEventListener('blur', updateGlobalTextFromElement);
        }
    }
}

function updateGlobalTextFromElement(event) {
    const id = event.target.id;
    const newText = event.target.innerHTML;
    if (globalTexts.hasOwnProperty(id)) {
        globalTexts[id] = newText;
        console.log(`Texto actualizado [${id}]:`, newText);
    }
}

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('jrtech-theme', themeName);
    console.log("Tema cambiado a:", themeName);
}

function descargarTextosJs() {
    const content = `const globalTexts = ${JSON.stringify(globalTexts, null, 4)};\n\nfunction cargarTextos() {\n    for (const [id, text] of Object.entries(globalTexts)) {\n        const el = document.getElementById(id);\n        if (el) {\n            if (id.endsWith("-icon")) {\n                el.className = text;\n            } else {\n                el.innerHTML = text;\n            }\n        }\n    }\n}\n`;
    
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'textos.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert("¡Archivo textos.js generado! Reemplaza el archivo original en tu proyecto con este que acabas de descargar.");
}

// Cargar tema guardado al iniciar
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('jrtech-theme');
    if (savedTheme) {
        setTheme(savedTheme);
    }
    
    // Iniciar carga de textos si no se ha hecho
    if (typeof cargarTextos === 'function') {
        cargarTextos();
    }
});
