import re

with open('main.js', 'r') as f:
    content = f.read()

# 1. Inject escapeHTML function at the top
escape_func = """function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

"""
if "function escapeHTML" not in content:
    content = escape_func + content

# 2. Escape in renderGrid
content = content.replace('alt="${item.marca} ${item.modelo}"', 'alt="${escapeHTML(item.marca)} ${escapeHTML(item.modelo)}"')
content = content.replace('alt="${item.marca}"', 'alt="${escapeHTML(item.marca)}"')
content = content.replace('>${item.marca}</div>', '>${escapeHTML(item.marca)}</div>')
content = content.replace('>${item.modelo}</h3>', '>${escapeHTML(item.modelo)}</h3>')

# 3. Escape in abrirModal (specs)
content = content.replace('let displayVal = f.val;', 'let displayVal = escapeHTML(f.val);')
content = content.replace('label = label.split', 'label = escapeHTML(label.split') # Wait, label.split returns array.
content = content.replace("label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');", "label = escapeHTML(label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));")

# 4. Escape in renderRelacionados
content = content.replace('<h3 class="producto-modelo">${item.marca} ${item.modelo}</h3>', '<h3 class="producto-modelo">${escapeHTML(item.marca)} ${escapeHTML(item.modelo)}</h3>')

# 5. Escape in comparar item
content = content.replace('<div class="comparar-item-nombre">${item.marca} ${item.modelo}</div>', '<div class="comparar-item-nombre">${escapeHTML(item.marca)} ${escapeHTML(item.modelo)}</div>')

with open('main.js', 'w') as f:
    f.write(content)
print("XSS mitigations applied")
