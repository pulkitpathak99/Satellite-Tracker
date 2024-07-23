let map;
let currentData = []; // To store all location data
let filterNumber = 1; // Default filter number
let filterUnit = 'hours'; // Default filter unit

document.addEventListener('DOMContentLoaded', function () {
    map = L.map('map').setView([20.5937, 78.9629], 5); // Default to the center of India

    // Add MapTiler tile layer
    L.tileLayer('https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=mbDwiByVth6NBS6Gcy1g', {
        zoom: 5,
        attribution: '\u003ca href="https://www.maptiler.com/copyright/" target="_blank">\u0026copy; MapTiler\u003c/a\u003e \u003ca href="https://www.openstreetmap.org/copyright" target="_blank">\u0026copy; OpenStreetMap contributors\u003c/a\u003e'
    }).addTo(map);

    const deviceSelect = document.getElementById('device-select');
    for (let i = 1; i <= 35; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Device ${i}`;
        deviceSelect.appendChild(option);
    }
    setInterval(fetchAndPlotLocations, 15000);
});

function fetchAndPlotLocations() {
    const deviceId = document.getElementById('device-select').value || 1; // Default to Device 1 if no device is selected
    fetch(`/api/locations?device_id=${deviceId}`)
        .then(response => response.json())
        .then(data => {
            currentData = data; // Store all location data
            applyCurrentFilter(); // Apply the current filter
        })
        .catch(error => console.error('Error fetching location data:', error));
}
function plotLocations(data) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    const latlngs = data.map(loc => [loc.latitude, loc.longitude]);

    if (latlngs.length > 0) {
        // Add dotted red polyline
        L.polyline(latlngs, {
            color: '#003366', // Red color
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10', // This creates the dotted effect
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        // Add start marker
        const startMarker = L.marker(latlngs[0], {icon: createCustomIcon('start')}).addTo(map);
        startMarker.bindPopup(getPopupContent(data[0], 'start'));

        // Add waypoint markers
        for (let i = 1; i < latlngs.length - 1; i++) {
            const waypointMarker = L.marker(latlngs[i], {icon: createCustomIcon('waypoint')}).addTo(map);
            waypointMarker.bindPopup(getPopupContent(data[i], 'waypoint'));
        }

        // Add end marker if there's more than one point
        if (latlngs.length > 1) {
            const endMarker = L.marker(latlngs[latlngs.length - 1], {icon: createCustomIcon('end')}).addTo(map);
            endMarker.bindPopup(getPopupContent(data[data.length - 1], 'end'));
        }

        map.fitBounds(L.polyline(latlngs).getBounds(), {padding: [50, 50]});
    }
}

function createCustomIcon(type) {
    let color, size;
    switch (type) {
        case 'start':
            color = '#008000'; // Green
            size = 36;
            break;
        case 'end':
            color = '#FF0000'; // Red
            size = 36;
            break;
        case 'waypoint':
            color = '#ffb700'; // Orange
            size = 14; // Smaller size for waypoints
            break; 
    }
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
                <circle cx="12" cy="12" r="10" fill="white" />
                <circle cx="12" cy="12" r="8" fill="${color}" />
            </svg>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
}

function getPopupContent(data, type) {
    const time = new Date(data.time).toLocaleString();
    const district = data.district;
    const state = data.state;
    let title, color;
    switch (type) {
        case 'start':
            title = 'Starting Point';
            color = '#008000';
            break;
        case 'end':
            title = 'Current Location';
            color = '#FF0000';
            break;
        case 'waypoint':
            title = 'Waypoint';
            color = '#FFA500';
            break;
    }
    return `
        <div style="font-family: Arial, sans-serif; padding: 5px;">
            <h3 style="margin: 0 0 10px; color: ${color};">${title}</h3>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 5px 0;"><strong>District:</strong> ${district}</p>
            <p style="margin: 5px 0;"><strong>State:</strong> ${state}</p>
        </div>`;
}
function applyTimeFilter() {
    filterNumber = parseInt(document.getElementById('time-number').value);
    filterUnit = document.getElementById('time-unit').value;
    applyCurrentFilter();
}

function applyCurrentFilter() {
    const fromDate = new Date();
    switch (filterUnit) {
        case 'hours':
            fromDate.setHours(fromDate.getHours() - filterNumber);
            break;
        case 'days':
            fromDate.setDate(fromDate.getDate() - filterNumber);
            break;
        case 'weeks':
            fromDate.setDate(fromDate.getDate() - (filterNumber * 7));
            break;
        case 'months':
            fromDate.setMonth(fromDate.getMonth() - filterNumber);
            break;
        default:
            break;
    }

    const filteredData = currentData.filter(item => new Date(item.time) >= fromDate);
    plotLocations(filteredData);
}

function showLastLocation() {
    if (currentData.length > 0) {
        const lastLocation = currentData[currentData.length - 1];
        const latlng = [lastLocation.latitude, lastLocation.longitude];

        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });

        const marker = L.marker(latlng).addTo(map);
        marker.bindPopup(getPopupContent(lastLocation)).openPopup();
        map.setView(latlng, 15);
    } else {
        alert('No location data available.');
    }
}

document.getElementById('device-select').addEventListener('change', fetchAndPlotLocations);