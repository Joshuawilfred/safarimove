// Leaflet Map Module for SafariMove - Tanzania Focus (Dar es Salaam)
// Fully integrated with OSRM street routing, geocoding, and animated driver matching.

let map;
let userMarker;
let routeLine = null;
let pickupMarker = null;
let dropoffMarker = null;
let driverSimulationMarker = null;
let driverAnimationInterval = null;
let nearbyDrivers = [];

const TANZANIA_CENTER = [-6.7924, 39.2083]; // Dar es Salaam

// Custom HTML Markers using FontAwesome (loaded in HTML)
const createMarkerIcon = (iconClass, color, size = 24) => {
    return L.divIcon({
        html: `<div style="display:flex; justify-content:center; align-items:center; width:${size}px; height:${size}px; background:white; border-radius:50%; box-shadow:0 2px 10px rgba(0,0,0,0.3); border:2px solid ${color};">
                 <i class="${iconClass}" style="color:${color}; font-size:${size * 0.55}px;"></i>
               </div>`,
        className: 'custom-leaflet-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
};

function initMap() {
    const mapContainer = document.getElementById('mapView');
    if (!mapContainer || map !== undefined) return;

    // Set map to Dar es Salaam, Tanzania
    map = L.map('mapView').setView(TANZANIA_CENTER, 13);

    // Apply dark, premium custom tiles or standard OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Try to get geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                // If coordinates are inside Tanzania (rough bounds), zoom to them, otherwise stay in Dar es Salaam
                if (lat < -1.0 && lat > -12.0 && lng > 29.0 && lng < 41.0) {
                    map.setView([lat, lng], 14);
                }
                addUserMarker(lat, lng);
                simulateNearbyDrivers(lat, lng);
            },
            () => {
                console.log("Geolocation failed or denied. Falling back to Dar es Salaam.");
                addUserMarker(TANZANIA_CENTER[0], TANZANIA_CENTER[1]);
                simulateNearbyDrivers(TANZANIA_CENTER[0], TANZANIA_CENTER[1]);
            }
        );
    } else {
        addUserMarker(TANZANIA_CENTER[0], TANZANIA_CENTER[1]);
        simulateNearbyDrivers(TANZANIA_CENTER[0], TANZANIA_CENTER[1]);
    }
}

function addUserMarker(lat, lng) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], {
        icon: createMarkerIcon('fa-solid fa-user', '#3b82f6', 28)
    }).addTo(map).bindPopup("You are here").openPopup();
}

function simulateNearbyDrivers(centerLat, centerLng) {
    // Clear old nearby drivers
    nearbyDrivers.forEach(m => map.removeLayer(m));
    nearbyDrivers = [];

    const vehicleIcons = [
        { icon: 'fa-solid fa-car', color: '#10b981' },       // SafariSaver
        { icon: 'fa-solid fa-motorcycle', color: '#8b5cf6' },// SafariMoto
        { icon: 'fa-solid fa-bus', color: '#f59e0b' }        // Matatu
    ];

    for (let i = 0; i < 5; i++) {
        const offsetLat = (Math.random() - 0.5) * 0.015;
        const offsetLng = (Math.random() - 0.5) * 0.015;
        const driverLat = centerLat + offsetLat;
        const driverLng = centerLng + offsetLng;
        const randomVehicle = vehicleIcons[Math.floor(Math.random() * vehicleIcons.length)];

        const marker = L.marker([driverLat, driverLng], {
            icon: createMarkerIcon(randomVehicle.icon, randomVehicle.color, 26)
        }).addTo(map);

        const duration = Math.floor(Math.random() * 5) + 2;
        marker.bindPopup(`<b>Mock Driver</b><br>Available • ${duration} mins away`);
        nearbyDrivers.push(marker);
    }
}

// Draw polyline route using OSRM Web API, falls back to direct line
async function plotRoute(start, end) {
    // Clear prior route layers
    clearRoute();

    // Set pickup and dropoff markers
    pickupMarker = L.marker(start, {
        icon: createMarkerIcon('fa-solid fa-circle-dot', '#10b981', 30)
    }).addTo(map).bindPopup("Pickup Point");

    dropoffMarker = L.marker(end, {
        icon: createMarkerIcon('fa-solid fa-location-dot', '#ef4444', 30)
    }).addTo(map).bindPopup("Destination");

    let routeCoords = [start, end];
    let distanceKm = getHaversineDistance(start, end);
    let durationMins = Math.ceil(distanceKm * 2.5); // Approx 2.5 mins per km in city traffic

    try {
        // Query OSRM routing engine
        const queryUrl = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(queryUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                distanceKm = (route.distance / 1000).toFixed(1);
                durationMins = Math.ceil(route.duration / 60);
                
                // OSRM coordinates are in [lng, lat] order in GeoJSON
                routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            }
        }
    } catch (e) {
        console.warn("OSRM routing API error. Falling back to straight-line route.", e);
    }

    // Draw route polyline
    routeLine = L.polyline(routeCoords, {
        color: '#8b5cf6',
        weight: 5,
        opacity: 0.8,
        dashArray: '1, 8', // Uber-like path animation
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // Apply animation to route dashes
    let count = 0;
    const animateDash = setInterval(() => {
        if (!routeLine || !map.hasLayer(routeLine)) {
            clearInterval(animateDash);
            return;
        }
        count = (count + 1) % 16;
        routeLine.setStyle({ dashOffset: -count });
    }, 80);

    // Fit map view
    const bounds = L.latLngBounds([start, end]);
    map.fitBounds(bounds, { padding: [50, 50] });

    return {
        coordinates: routeCoords,
        distance: parseFloat(distanceKm),
        duration: durationMins
    };
}

function clearRoute() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; }
    if (dropoffMarker) { map.removeLayer(dropoffMarker); dropoffMarker = null; }
    if (driverSimulationMarker) { map.removeLayer(driverSimulationMarker); driverSimulationMarker = null; }
    if (driverAnimationInterval) { clearInterval(driverAnimationInterval); driverAnimationInterval = null; }
}

// Mathematical distance calculation (fallback)
function getHaversineDistance(coords1, coords2) {
    const lon1 = coords1[1], lat1 = coords1[0];
    const lon2 = coords2[1], lat2 = coords2[0];
    const R = 6371; // radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return parseFloat((R * c).toFixed(1));
}

// Animate a driver marker moving along the route coordinates
function simulateDriverTrip(routeCoords, vehicleType, onStatusUpdate, onComplete) {
    if (driverSimulationMarker) map.removeLayer(driverSimulationMarker);
    if (driverAnimationInterval) clearInterval(driverAnimationInterval);

    let vehicleIcon = 'fa-solid fa-car';
    let vehicleColor = '#10b981';
    if (vehicleType === 'moto') {
        vehicleIcon = 'fa-solid fa-motorcycle';
        vehicleColor = '#8b5cf6';
    } else if (vehicleType === 'transit') {
        vehicleIcon = 'fa-solid fa-bus';
        vehicleColor = '#f59e0b';
    }

    // Spawn driver slightly offset from pickup initially
    const driverStart = [
        routeCoords[0][0] + (Math.random() - 0.5) * 0.005,
        routeCoords[0][1] + (Math.random() - 0.5) * 0.005
    ];

    driverSimulationMarker = L.marker(driverStart, {
        icon: createMarkerIcon(vehicleIcon, vehicleColor, 32)
    }).addTo(map).bindPopup("Driver assigned!").openPopup();

    let step = 0;
    const totalMatchSteps = 20; // steps for driver to arrive at pickup
    const routeTotalSteps = routeCoords.length;
    let state = 'matching'; // matching, arriving, in_progress, completed

    // We animate at 300ms intervals (quick simulation, ~10-15 seconds total)
    driverAnimationInterval = setInterval(() => {
        if (state === 'matching') {
            // Move driver towards pickup point (routeCoords[0])
            const lat = driverStart[0] + (routeCoords[0][0] - driverStart[0]) * (step / totalMatchSteps);
            const lng = driverStart[1] + (routeCoords[0][1] - driverStart[1]) * (step / totalMatchSteps);
            driverSimulationMarker.setLatLng([lat, lng]);
            
            const eta = Math.ceil((totalMatchSteps - step) / 4);
            onStatusUpdate('arriving', eta);
            driverSimulationMarker.setPopupContent(`<b>Driver assigned</b><br>Arriving in ${eta} min`);

            step++;
            if (step > totalMatchSteps) {
                state = 'arrived';
                step = 0;
            }
        } else if (state === 'arrived') {
            driverSimulationMarker.setLatLng(routeCoords[0]);
            driverSimulationMarker.setPopupContent("<b>Driver has arrived</b><br>Board the vehicle!");
            onStatusUpdate('arrived', 0);
            
            // Wait 2 seconds at pickup
            state = 'waiting';
            setTimeout(() => {
                state = 'in_progress';
            }, 2500);
        } else if (state === 'in_progress') {
            // Animate along route coordinates
            if (step < routeTotalSteps) {
                driverSimulationMarker.setLatLng(routeCoords[step]);
                
                const percent = Math.round((step / routeTotalSteps) * 100);
                onStatusUpdate('in_progress', percent);
                driverSimulationMarker.setPopupContent(`<b>Trip in progress</b><br>${percent}% completed`);
                
                // Track driver marker with map pan occasionally
                if (step % 5 === 0) {
                    map.panTo(routeCoords[step]);
                }
                step++;
            } else {
                state = 'completed';
                clearInterval(driverAnimationInterval);
                driverSimulationMarker.setPopupContent("<b>Trip completed!</b><br>Thank you for riding with SafariMove.");
                onStatusUpdate('completed', 100);
                if (onComplete) onComplete();
            }
        }
    }, 400);
}

// Nominatim search tailored to Tanzania
async function searchTanzaniaLocation(query) {
    if (!query || query.length < 3) return [];
    try {
        const queryWithTanzania = `${query}, Tanzania`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithTanzania)}&countrycodes=tz&limit=5`;
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (response.ok) {
            const data = await response.json();
            return data.map(item => ({
                display_name: item.display_name,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon)
            }));
        }
    } catch (e) {
        console.error("Geocoding fetch failed:", e);
    }
    return [];
}
