/**
 * reviews.js - Integración con Google Places API para JRTech
 */

const GOOGLE_PLACE_ID = "ChIJEWZx0nNnJI4RHQrl-9ZMgM4";
let reviewsTimeout;

document.addEventListener("DOMContentLoaded", () => {
    console.log("Reviews JS: Initializing...");
    
    // Safety Timeout
    reviewsTimeout = setTimeout(() => {
        const container = document.getElementById('google-reviews-container');
        if (container && container.innerHTML.includes('fa-spinner')) {
            console.warn("Reviews JS: Google API timeout.");
            renderFallbackReviews();
        }
    }, 6000);

    // Esperar a que google maps esté listo
    checkGoogleReady();
});

function checkGoogleReady() {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        initGoogleReviews();
    } else {
        setTimeout(checkGoogleReady, 500);
    }
}

function initGoogleReviews() {
    console.log("Reviews JS: Fetching reviews via PlacesService...");
    try {
        const container = document.getElementById('google-reviews-container');
        if (!container) return;

        const service = new google.maps.places.PlacesService(document.createElement('div'));

        service.getDetails({
            placeId: GOOGLE_PLACE_ID,
            fields: ['reviews', 'rating', 'name']
        }, (place, status) => {
            clearTimeout(reviewsTimeout);
            
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.reviews) {
                console.log("Reviews JS: Successfully fetched", place.reviews.length, "reviews.");
                renderReviews(place.reviews);
            } else {
                console.error("Reviews JS: API Error status:", status);
                renderFallbackReviews();
            }
        });
    } catch (e) {
        clearTimeout(reviewsTimeout);
        console.error("Reviews JS: Exception:", e);
        renderFallbackReviews();
    }
}

function renderReviews(reviews) {
    const container = document.getElementById('google-reviews-container');
    if (!container) return;

    const filteredReviews = reviews
        .filter(r => r.rating >= 4)
        .sort((a, b) => b.time - a.time)
        .slice(0, 3);

    if (filteredReviews.length === 0) {
        renderFallbackReviews();
        return;
    }

    container.innerHTML = filteredReviews.map(r => `
        <div class="testimonio-card">
            <div class="stars">
                ${Array(Math.floor(r.rating)).fill('<i class="fas fa-star"></i>').join('')}
            </div>
            <p>"${r.text.length > 200 ? r.text.substring(0, 200) + '...' : r.text}"</p>
            <div class="autor" style="display: flex; align-items: center; gap: 10px; margin-top: 15px;">
                <img src="${r.profile_photo_url}" alt="${r.author_name}" style="width: 35px; height: 35px; border-radius: 50%;" onerror="this.src='https://ui-avatars.com/api/?name=${r.author_name}'">
                <span style="font-weight: 600;">${r.author_name}</span>
            </div>
        </div>
    `).join('');
}

function renderFallbackReviews() {
    const container = document.getElementById('google-reviews-container');
    if (!container) return;
    container.innerHTML = `
        <div class="testimonio-card">
            <div class="stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
            <p>"Increíble atención, Albeiro me asesoró mejor que en cualquier tienda grande. ¡El equipo llegó perfecto!"</p>
            <div class="autor">Juan Camilo - Medellín</div>
        </div>
        <div class="testimonio-card">
            <div class="stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
            <p>"La garantía es real. Tuve un pequeño problema con el Office y Albeiro me lo solucionó por remoto en 5 minutos."</p>
            <div class="autor">Sandra M. - Bogotá</div>
        </div>
        <div class="testimonio-card">
            <div class="stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
            <p>"Compré mi portatil gaming acá y me ahorré casi un millón comparado con centros comerciales."</p>
            <div class="autor">Andrés F. - Cali</div>
        </div>
    `;
}

function abrirModalResenas() {
    const modal = document.getElementById('modal-resenas');
    modal.style.display = "flex";
    document.body.style.overflow = "hidden"; // Desactivar scroll
}

function cerrarModalResenas() {
    const modal = document.getElementById('modal-resenas');
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Reactivar scroll
}

window.addEventListener('click', (event) => {
    const modal = document.getElementById('modal-resenas');
    if (event.target == modal) {
        cerrarModalResenas();
    }
});
