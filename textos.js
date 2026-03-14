const globalTexts = {
    "hero-title": "TECNOLOGÍA HUMANIZADA",
    "hero-subtitle": "Ya basta de que te atiendan Robotcitos.&nbsp;&nbsp;<div>Acá te asesora una persona experta y quedarás tan feliz que nos seguirás recomendando. Te volverás parte de nuestro equipo de publicidad voz a voz y te pagaremos por eso 💸</div>",
    "hero-btn-beneficios": "<i class=\"fas fa-arrow-down\"></i> ¿Qué ganás comprando acá?",
    "hero-loading": "<i class=\"fas fa-spinner fa-spin fa-2x\"></i><br><br>Buscando equipo estrella...",
    "nav-btn-bondades": "<i class=\"fas fa-sparkles\"></i> ¿Qué ganás?",
    "nav-btn-perfil": "<i class=\"fas fa-user-astronaut\"></i> ¿Quién soy?",
    "nav-btn-testimonios": "<i class=\"fas fa-star\"></i> Opiniones",
    "nav-btn-faq": "<i class=\"fas fa-question-circle\"></i> Dudas",
    "bondad-1-icon": "fas fa-handshake",
    "bondad-1-title": "Amigo pa' toda la vida 🛠️",
    "bondad-1-desc": "¿Tienes algún problema con tus equipos? Fresco, consúltame y te ayudaré por remoto gratuitamente. Quedamos de amigos.",
    "bondad-2-icon": "fas fa-money-bill-trend-up",
    "bondad-2-title": "Comisiones 💰",
    "bondad-2-desc": "Sabemos que tu recomendación vale muchísimo y es la base de nuestra publicidad. Acá ganas el 2% de la primera compra de tus referidos.",
    "bondad-3-icon": "fas fa-tags",
    "bondad-3-title": "Descuentos 🏷️",
    "bondad-3-desc": "¡Cliente preferencial! Luego de tu primera compra, tienes un 2% de descuento fijo en todas tus futuras adquisiciones.",
    "bondad-4-icon": "fas fa-piggy-bank",
    "bondad-4-title": "Mucho ahorro 🐷",
    "bondad-4-desc": "Somos tienda 100% virtual. Ahorramos en gastos físicos y tú te beneficias con precios muy bajos.",
    "bondad-5-icon": "fas fa-key",
    "bondad-5-title": "Configuración y Licencias 🔑",
    "bondad-5-desc": "Olvídate de sufrir por licencias. Te entregamos todo listo, sin bloqueos de Office ni letreros de activación.",
    "bondad-6-icon": "fas fa-truck-fast",
    "bondad-6-title": "Envíos Gratuitos 🚚",
    "bondad-6-desc": "Desde Punta Gallinas hasta Leticia. Clientes satisfechos en todo el país. Envíos asegurados a través de empresas reconocidas.",
    "bondades-title": "¿QUÉ NOS HACE DIFERENTES?",
    "barato-title": "LO JUSTO, SIN TANTAS VUELTAS",
    "barato-li-1": "<i class=\"fas fa-check-double\"></i> <strong>Sin intermediarios:</strong> Compramos directo de fábrica.",
    "barato-li-2": "<i class=\"fas fa-check-double\"></i> <strong>Sin pauta cara:</strong> No gastamos en comerciales, el voz a voz manda.",
    "barato-li-3": "<i class=\"fas fa-check-double\"></i> <strong>Local propio:</strong> No le cargamos arriendos caros al producto.",
    "barato-li-4": "<i class=\"fas fa-check-double\"></i> <strong>Ganancia justa:</strong> Preferimos vender mucho ganando poquito.",
    "garantia-title": "SU TRANQUILIDAD ES LO PRIMERO",
    "perfil-title": "LA PERSONA DETRÁS DE JRTECH",
    "perfil-nombre": "Albeiro López",
    "perfil-rol": "El que te asesora de verdad",
    "perfil-cita": "<i>\"En este mundo de robots, yo prefiero el contacto humano. Mi meta es que te lleves un equipazo a excelente precio y quedes con un amigo más.&nbsp; \"</i>",
    "perfil-contacto": "<i class=\"fab fa-whatsapp\"></i> Háblame de una",
    "testimonios-title": "LO QUE DICEN MIS CLIENTES",
    "testimonio-1-text": "\"Increíble atención, Albeiro me asesoró mejor que en cualquier tienda grande. ¡El equipo llegó perfecto!\"",
    "testimonio-1-autor": "Juan Camilo - Medellín",
    "testimonio-2-text": "\"La garantía es real. Tuve un pequeño problema con el Office y Albeiro me lo solucionó por remoto en 5 minutos.\"",
    "testimonio-2-autor": "Sandra M. - Bogotá",
    "testimonio-3-text": "\"Compré mi portatil gaming acá y me ahorré casi un millón comparado con centros comerciales.\"",
    "testimonio-3-autor": "Andrés F. - Cali",
    "faq-title": "PREGUNTAS FRECUENTES",
    "faq-1-q": "¿Tienen tienda física?",
    "faq-1-a": "No. Y tampoco almacenamos inventarios. Somos 100% virtuales. Eso nos permite ahorrar arriendos y logística y pasarte ese ahorro a ti en el precio final.&nbsp; Todos los equipos reposan en bodegas importadoras de ciudades capitales y son enviados directo a tus manos.&nbsp;&nbsp;",
    "faq-2-q": "¿Cómo es el proceso de compra?",
    "faq-2-a": "Eliges tu equipo, le das clic en Enviar Pedido y llenas el formulario.&nbsp; Allí te lleva a mi whatsapp, respondo a cualquier duda final que tengas, te doy las opciones de pago, me pagas y listo.&nbsp; Te hago el envio gratuito.",
    "faq-3-q": "¿Qué pasa si falla el equipo?",
    "faq-3-a": "Tienes garantía de 1 año por defectos de fábrica. Me escribes y te guío paso a paso para que realices esa reclamación. No tendrás que sacar un peso de tu bolsillo.&nbsp;",
    "catalog-cta-title": "¿LISTO PARA TU PRÓXIMO EQUIPAZO?",
    "catalog-cta-subtitle": "Después de conocer cómo trabajamos, mira lo que tenemos disponible",
    "catalog-cta-btn": "<i class=\"fas fa-shopping-cart\"></i> Ver Catálogo Completo",
    "catalogo-title": "EL CATÁLOGO",
    "footer-p1": "© 2026 Innovación Digital JRTech - Elevando Procesos Digitales",
    "footer-p2": "Expertos en Tecnología Premium | Envios Nacionales | Soporte 24/7"
};

function cargarTextos() {
    for (const [id, text] of Object.entries(globalTexts)) {
        const el = document.getElementById(id);
        if (el) {
            if (id.endsWith("-icon")) {
                el.className = text;
            } else {
                el.innerHTML = text;
            }
        }
    }
}
