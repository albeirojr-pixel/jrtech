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
            // Si getBase64Image devolvió una URL real (no base64), habilitar CORS
            if (p64 && p64.startsWith('http')) {
                imgElement.crossOrigin = "anonymous";
            } else {
                imgElement.removeAttribute('crossOrigin');
            }
            imgElement.src = p64;
            imagesToLoad.push(waitImg(imgElement));
        }

        // 2. Logo de Marca
        if (brandLogoUrl) {
            const b64 = await getBase64Image(brandLogoUrl);
            if (b64 && b64.startsWith('http')) {
                brandLogoEl.crossOrigin = "anonymous";
            } else {
                brandLogoEl.removeAttribute('crossOrigin');
            }
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

    const insightText = (item.aiInsight && item.aiInsight.idealPara)
        ? `🎯 Ideal para: ${item.aiInsight.idealPara}`
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
    await new Promise(r => setTimeout(r, 600)); // Margen extra render aumentado a 600ms

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
    if (!url || !url.startsWith('http')) return url;

    // FIX FOR GOOGLE DRIVE URLS: Convert various patterns to direct 'uc?id='
    let directUrl = url;
    if (directUrl.includes('drive.google.com/file/d/')) {
        const parts = directUrl.split('/d/');
        if (parts.length > 1) {
            const id = parts[1].split('/')[0].split('?')[0];
            directUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        }
    } else if (directUrl.includes('drive.google.com/open?id=')) {
        const id = directUrl.split('id=')[1].split('&')[0];
        directUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    } else if (directUrl.includes('docs.google.com/uc?')) {
        // Ensure it has export=download
        if (!directUrl.includes('export=download')) {
            directUrl += directUrl.includes('?') ? '&export=download' : '?export=download';
        }
    }

    const encodedUrl = encodeURIComponent(directUrl);
    const proxies = [
        `https://images.weserv.nl/?url=${encodedUrl}&maxage=31d`,
        `https://api.allorigins.win/raw?url=${encodedUrl}`,
        `https://corsproxy.io/?${encodedUrl}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`
    ];

    for (const proxyUrl of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per proxy

            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const blob = await response.blob();
            if (blob.type.startsWith('image/')) {
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
        } catch (e) {
            console.warn(`Falló el proxy ${proxyUrl}. Error:`, e.message);
        }
    }

    // Si todos los proxies fallan, devolvemos la URL original (o la de Drive corregida)
    console.warn("Todos los proxies de imagen fallaron para:", directUrl);
    return directUrl;
}


function getPosterSpecs(item, category) {
    if (category === 'portatiles') {
        const proc = getSpec(item, 'Procesador') || getSpec(item, 'procesador');
        const ramVal = getSpec(item, 'RAM') || getSpec(item, 'ram');
        const ramType = getSpec(item, 'tipo_ram') || getSpec(item, 'tipo ram');
        const ssd = getSpec(item, 'SSD') || getSpec(item, 'ssd') || getSpec(item, 'almacenamiento');
        const panVal = getSpec(item, 'Pantalla') || getSpec(item, 'pantalla');
        const panType = getSpec(item, 'tipo_pantalla') || getSpec(item, 'tipo pantalla');
        const graf = getSpec(item, 'grafica') || getSpec(item, 'Gráfica');
        const sist = getSpec(item, 'Sistema') || getSpec(item, 'sistema');

        const specs = [
            { icon: 'fas fa-microchip', val: proc },
            { icon: 'fas fa-memory', val: ramVal ? `Memoria RAM: ${ramVal}${ramVal.toLowerCase().includes('gb') ? '' : ' GB'}` : '' },
            { icon: 'fas fa-dna', val: ramType ? `Tipo de memoria RAM: ${ramType}` : '' },
            { icon: 'fas fa-hdd', val: ssd ? `Almacenamiento SSD: ${ssd}${ssd.toLowerCase().includes('gb') || ssd.toLowerCase().includes('tb') ? '' : ' GB'}` : '' },
            { icon: 'fas fa-laptop', val: panVal ? `Tamaño de Pantalla: ${panVal}${panVal.includes('"') ? '' : '"'}` : '' },
            { icon: 'fas fa-tv', val: panType ? `Tipo de pantalla: ${panType}` : '' },
            { icon: 'fas fa-window-maximize', val: sist ? `Sistema operativo: ${sist}` : '' },
            { icon: 'fas fa-file-invoice', val: 'Office licenciado: SI' }
        ];

        // Lógica para Tarjeta Gráfica SI/NO
        const tieneGrafica = (graf && graf.toLowerCase() !== 'integrada' && graf.toLowerCase() !== 'no' && graf !== '');
        specs.push({
            icon: 'fas fa-image',
            val: tieneGrafica ? `Tarjeta grafica: SI (${graf})` : 'Tarjeta grafica: NO'
        });

        return specs.filter(s => s.val);
    } else {
        // Celulares y Tablets
        const proc = getSpec(item, 'procesador') || getSpec(item, 'Procesador');
        const ram = getSpec(item, 'ram', 'GB');
        const rom = getSpec(item, 'rom', 'GB') || getSpec(item, 'almacenamiento', 'GB');
        const bat = getSpec(item, 'bateria') || getSpec(item, 'capacidad_bateria');
        const camP = getSpec(item, 'camppal') || getSpec(item, 'camara_ppal') || getSpec(item, 'camara_principal') || getSpec(item, 'camara');
        const camS = getSpec(item, 'camselfie') || getSpec(item, 'camara_selfie') || getSpec(item, 'camara_frontal');
        const pan = getSpec(item, 'pantalla');
        const ref = getSpec(item, 'refresco') || getSpec(item, 'tasa_refresco');
        const ant = getSpec(item, 'antutu');
        const nfc = getSpec(item, 'nfc');
        const cga = getSpec(item, 'carga');

        return [
            { icon: 'fas fa-microchip', val: proc },
            { icon: 'fas fa-memory', val: (ram && rom) ? `${ram} / ${rom}` : (ram || rom) },
            { icon: 'fas fa-rocket', val: ant ? `Antutu: ${ant}` : '' },
            { icon: 'fas fa-camera', val: camP ? `Principal: ${camP} MP` : '' },
            { icon: 'fas fa-camera', val: camS ? `Selfie: ${camS} MP` : '' },
            { icon: 'fas fa-battery-full', val: bat ? `Batería: ${bat} mAh` : '' },
            { icon: 'fas fa-bolt', val: cga ? `Carga: ${cga}` : '' },
            { icon: 'fas fa-mobile-alt', val: pan && ref ? `${pan} @ ${ref}` : (pan || ref) },
            { icon: 'fas fa-rss', val: (nfc && nfc.toLowerCase() !== 'no' && nfc !== '') ? 'NFC: Sí' : '' }
        ].filter(s => s.val);
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
