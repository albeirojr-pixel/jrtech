/**
 * poster-generator.js - Digital Poster Generator for JRTech
 * Handles dynamic data injection into the template and PNG conversion.
 */

async function generatePoster(productId) {
    const item = catalogoActual.find(i => i.id === productId);
    if (!item) return;

    const template = document.getElementById('poster-template');
    
    // Rellenar datos básicos
    document.getElementById('p-marca').innerText = item.marca;
    document.getElementById('p-modelo').innerText = item.modelo;
    
    const imgElement = document.getElementById('p-img');
    const brandLogoEl = document.getElementById('p-marca-logo');
    const footerLogoEl = document.getElementById('p-logo');
    
    const productImageUrl = item.enlace_foto || item.foto || '';
    const brandLogoUrl = getBrandLogo(item) || '';
    
    const imagesToLoad = [];

    // Helper para esperar carga de imagen de forma segura
    const waitImg = (img) => new Promise(res => {
        if (img.complete) res();
        img.onload = res;
        img.onerror = res;
        setTimeout(res, 6000); // Aumentado a 6s para mayor estabilidad
    });

    try {
        // 1. Imagen del Producto
        if (productImageUrl) {
            const p64 = await getBase64Image(productImageUrl);
            imgElement.src = p64;
            imagesToLoad.push(waitImg(imgElement));
        }

        // 2. Logo de Marca
        if (brandLogoUrl) {
            const b64 = await getBase64Image(brandLogoUrl);
            brandLogoEl.src = b64;
            brandLogoEl.style.display = 'block';
            document.getElementById('p-marca').style.display = 'none';
            imagesToLoad.push(waitImg(brandLogoEl));
        } else {
            brandLogoEl.style.display = 'none';
            document.getElementById('p-marca').style.display = 'block';
        }

        // 3. Logo JRTech (Footer)
        if (typeof LOGO_BASE64 !== 'undefined') {
            footerLogoEl.src = LOGO_BASE64;
            imagesToLoad.push(waitImg(footerLogoEl));
        }
    } catch (e) {
        console.error("Error cargando imágenes:", e);
    }
    
    document.getElementById('p-price').innerText = formatMoneda(item[getPriceField(categoriaActual)]);
    
    const insightText = (item.aiInsight && item.aiInsight.resumen) 
                        ? item.aiInsight.resumen 
                        : 'Tecnología de última generación seleccionada por JRTech';
    
    const phraseEl = document.getElementById('p-phrase');
    if (phraseEl) phraseEl.innerText = `"${insightText}"`;
    
    const specsContainer = document.getElementById('p-specs');
    specsContainer.innerHTML = '';
    const specs = getPosterSpecs(item, categoriaActual);
    specs.forEach(s => {
        if (!s.val || s.val === '-' || s.val.includes('- NaN')) return;
        const box = document.createElement('div');
        box.className = 'poster-spec-item';
        box.innerHTML = `<i class="${s.icon}"></i> ${s.val}`;
        specsContainer.appendChild(box);
    });

    // Esperar imágenes antes de capturar
    await Promise.all(imagesToLoad);
    await new Promise(r => setTimeout(r, 400)); // Margen extra render

    try {
        // Feedback visual de carga
        const originalBtn = document.activeElement;
        const btnHtml = originalBtn ? originalBtn.innerHTML : '';
        if (originalBtn && originalBtn.classList.contains('btn-share-discreto')) {
            originalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const canvas = await html2canvas(template, {
            useCORS: true,
            allowTaint: false, 
            backgroundColor: '#0a0b14',
            scale: 2 
        });

        if (originalBtn && originalBtn.classList.contains('btn-share-discreto')) {
            originalBtn.innerHTML = btnHtml;
        }

        const fileName = `JRTech_Poster_${item.marca}_${item.modelo}.png`;
        
        // Procesar resultado (Blob -> Copy -> Share -> Fallback)
        canvas.toBlob(async (blob) => {
            if (!blob) {
                fallbackDownload(canvas, fileName);
                return;
            }

            let shared = false;

            // 1. Intentar Copiar al Portapapeles
            if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                try {
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    console.log("Copiado al portapapeles");
                } catch (err) { console.warn("Clipboard failed:", err); }
            }

            // 2. Intentar Compartir
            if (navigator.share) {
                try {
                    const file = new File([blob], fileName, { type: blob.type });
                    const additionalSpecs = getFullSpecsText(item, categoriaActual);
                    
                    // Pie de foto (caption) con formato profesional inspirado en el código exitoso
                    const shareText = `*${item.marca} ${item.modelo}*\n\n${additionalSpecs}\n\n_Catálogo JRTech_`;

                    // Verificar si el navegador REALMENTE puede compartir este archivo
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: `${item.marca} ${item.modelo}`,
                            text: shareText
                        });
                        shared = true;
                    } else {
                        console.warn("Navegador dice que no puede compartir este archivo específico.");
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.log("Compartir cancelado por el usuario.");
                        shared = true; // Marcamos como compartido para evitar el fallback de descarga
                    } else {
                        console.error("Error crítico en Share API:", err);
                    }
                }
            }

            // 3. Descarga como último recurso si no se compartió
            if (!shared) {
                fallbackDownload(canvas, fileName);
            }
        }, 'image/png');

    } catch (err) {
        console.error("Error generating poster:", err);
        alert("Hubo un error al generar el póster. Intenta de nuevo.");
    }
}

function fallbackDownload(canvas, fileName) {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
}

async function getBase64Image(url) {
    if (!url || !url.startsWith('http')) return url; // Ignorar base64 directos o rutas locales

    const encodedUrl = encodeURIComponent(url);
    const proxies = [
        `https://images.weserv.nl/?url=${encodedUrl}&maxage=31d`,
        `https://api.codetabs.com/v1/proxy?quest=${url}`,
        `https://corsproxy.io/?${url}`,
        `https://api.allorigins.win/raw?url=${encodedUrl}`
    ];
    
    for (const proxyUrl of proxies) {
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;
            
            const blob = await response.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn(`Falló el proxy ${proxyUrl}. Intentando el siguiente...`);
        }
    }
    
    // Si todos fallan, devuelve la URL original como último recurso
    return url;
}


function getPosterSpecs(item, category) {
    if (category === 'portatiles') {
        const proc = getSpec(item, 'Procesador') || getSpec(item, 'procesador');
        const ram = getSpec(item, 'RAM') || getSpec(item, 'ram');
        const ssd = getSpec(item, 'SSD') || getSpec(item, 'ssd') || getSpec(item, 'almacenamiento');
        const pan = getSpec(item, 'Pantalla') || getSpec(item, 'pantalla');
        const graf = getSpec(item, 'grafica') || getSpec(item, 'Gráfica');

        const prov = getSpec(item, 'proveedor');
        const provSyllable = prov ? prov.substring(0, 2).toUpperCase() : '';
        const provTag = document.getElementById('p-prov-tag');
        if (provTag) provTag.innerText = provSyllable;

        const specs = [
            { icon: 'fas fa-microchip', val: proc },
            { icon: 'fas fa-memory', val: (ram && ssd) ? `${ram} RAM | ${ssd} SSD` : (ram || ssd) },
            { icon: 'fas fa-laptop', val: pan }
        ];

        if (graf && graf.toLowerCase() !== 'integrada' && graf.toLowerCase() !== 'no') {
            specs.push({ icon: 'fas fa-gamepad', val: graf });
        }
        return specs;
    } else {
        // Celulares y Tablets
        const proc = getSpec(item, 'procesador') || getSpec(item, 'Procesador');
        const ram = getSpec(item, 'ram', 'GB');
        const rom = getSpec(item, 'rom', 'GB') || getSpec(item, 'almacenamiento', 'GB');
        const bat = getSpec(item, 'bateria') || getSpec(item, 'capacidad_bateria');
        const camP = getSpec(item, 'camppal') || getSpec(item, 'camara_ppal') || getSpec(item, 'camara_principal') || getSpec(item, 'camara');
        const camS = getSpec(item, 'camselfie') || getSpec(item, 'camara_selfie') || getSpec(item, 'camara_frontal');
        const pan = getSpec(item, 'pantalla');

        const prov = getSpec(item, 'proveedor');
        const provSyllable = prov ? prov.substring(0, 2).toUpperCase() : '';
        const provTag = document.getElementById('p-prov-tag');
        if (provTag) provTag.innerText = provSyllable;

        return [
            { icon: 'fas fa-microchip', val: proc },
            { icon: 'fas fa-memory', val: (ram && rom) ? `${ram} / ${rom}` : (ram || rom) },
            { icon: 'fas fa-camera', val: camP ? `Principal: ${camP} MP` : '' },
            { icon: 'fas fa-camera', val: camS ? `Selfie: ${camS} MP` : '' },
            { icon: 'fas fa-battery-full', val: bat ? `${bat} mAh` : '' },
            { icon: 'fas fa-mobile-alt', val: pan }
        ];
    }
}

/**
 * Genera un texto resumen con TODA la información técnica que NO está en el póster visual.
 */
function getFullSpecsText(item, category) {
    const posterSpecsObj = getPosterSpecs(item, category);
    const valuesInPoster = posterSpecsObj.map(s => String(s.val).toLowerCase());
    
    const groups = SPECS_GROUPS[category === 'portatiles' ? 'portatiles' : 'mobile'];
    if (!groups) return "";

    let text = "";
    
    // 1. Gama y Veredicto IA (Inspirado en el código exitoso)
    if (item.aiInsight) {
        if (item.aiInsight.gama) text += `🏆 *Gama:* ${item.aiInsight.gama}\n`;
        text += `✨ *Análisis JRTech:* ${item.aiInsight.resumen || 'Equipo verificado.'}\n\n`;
    }

    text += "📋 *Ficha Técnica Extendida*:\n";
    let count = 0;

    groups.forEach(group => {
        group.fields.forEach(field => {
            const val = getSpec(item, field);
            if (!val || val === '-' || val.toLowerCase() === 'no' || val.toLowerCase() === 'n/a') return;

            const isAlreadyInPoster = valuesInPoster.some(v => v.includes(val.toLowerCase()) || val.toLowerCase().includes(v));
            if (isAlreadyInPoster) return;

            const label = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
            text += `• ${label}: ${val}\n`;
            count++;
        });
    });

    if (item.aiInsight) {
        if (item.aiInsight.idealPara) text += `\n🎯 *Ideal para*: ${item.aiInsight.idealPara}`;
        if (item.aiInsight.veredicto) text += `\n\n🧠 *Veredicto:* ${item.aiInsight.veredicto}`;
    }

    return count > 0 ? text : "¡Tecnología garantizada por JRTech!";
}
