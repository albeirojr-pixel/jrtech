import re

with open('main.js', 'r') as f:
    content = f.read()

# 1. Fix renderGrid
render_grid_patch1 = """    const errorDiv = document.getElementById('catalogo-error');
    if (items.length === 0) {
        errorDiv.innerText = 'No se encontraron equipos con esos filtros.';
        errorDiv.style.display = 'block';
        return;
    } else {
        errorDiv.style.display = 'none';
    }

    const fragment = document.createDocumentFragment();
    items.forEach(item => {"""

content = content.replace("""    const errorDiv = document.getElementById('catalogo-error');
    if (items.length === 0) {
        errorDiv.innerText = 'No se encontraron equipos con esos filtros.';
        errorDiv.style.display = 'block';
        return;
    } else {
        errorDiv.style.display = 'none';
    }

    items.forEach(item => {""", render_grid_patch1)

render_grid_patch2 = """        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}"""

content = content.replace("""        grid.appendChild(card);
    });
}""", render_grid_patch2)

# 2. Fix abrirModal
content = content.replace("    const grid = document.getElementById('modal-specs-grid');\n    grid.innerHTML = '';\n", "    const grid = document.getElementById('modal-specs-grid');\n    grid.innerHTML = '';\n    let specsHtmlAccumulator = '';\n")
content = content.replace("grid.insertAdjacentHTML('afterbegin', intelHtml);", "specsHtmlAccumulator += intelHtml;")
content = content.replace("grid.innerHTML +=", "specsHtmlAccumulator +=")
content = content.replace("    // Inyectar sección de productos relacionados", "    grid.innerHTML = specsHtmlAccumulator;\n\n    // Inyectar sección de productos relacionados")

with open('main.js', 'w') as f:
    f.write(content)
print("Render fixes applied")
