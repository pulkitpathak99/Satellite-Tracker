let map;
let circleLayer = new L.LayerGroup();
let polygonLayer = new L.LayerGroup();
let drawLayer = new L.LayerGroup();
let polygonCoordinates = [];
let currentData = [];
let drawControl;

document.addEventListener('DOMContentLoaded', function () {
    map = L.map('map').setView([20.5937, 78.9629], 5); // Center of India

    L.tileLayer('https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=mbDwiByVth6NBS6Gcy1g', {
        attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
    }).addTo(map);

    circleLayer.addTo(map);
    polygonLayer.addTo(map);
    drawLayer.addTo(map);

    fetchAllDevices();

    // Initialize drawing controls
    drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            polyline: false,
            rectangle: true,
            circle: true,
            marker: false,
            circlemarker: false
        },
        edit: false
    });

    document.getElementById('shape-select').addEventListener('change', function () {
        const shape = this.value;
        document.getElementById('polygon-controls').style.display = shape === 'polygon' ? 'block' : 'none';
        document.getElementById('circle-controls').style.display = shape === 'circle' ? 'block' : 'none';
        document.getElementById('custom-controls').style.display = shape === 'custom' ? 'block' : 'none';
    });

    document.getElementById('start-drawing').addEventListener('click', function() {
        map.addControl(drawControl);
        this.style.display = 'none';
        document.getElementById('stop-drawing').style.display = 'inline-block';
    });

    document.getElementById('stop-drawing').addEventListener('click', function() {
        map.removeControl(drawControl);
        this.style.display = 'none';
        document.getElementById('start-drawing').style.display = 'inline-block';
    });

    document.getElementById('clear-drawing').addEventListener('click', function() {
        drawLayer.clearLayers();
        document.getElementById('terminals-list').style.display = 'none';
    });

    document.getElementById('save-drawing').addEventListener('click', saveDrawing);

    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        drawLayer.addLayer(layer);
        findTerminalsInShape(layer);
    });
});

function fetchAllDevices() {
    fetch('/api/latest_locations')
        .then(response => response.json())
        .then(data => {
            currentData = data;
            plotDevices(currentData);
        })
        .catch(error => console.error('Error fetching device data:', error));
}

function addCoordinateInput() {
    const container = document.createElement('div');
    container.innerHTML = '<input type="text" placeholder="Latitude" class="lat-input"> <input type="text" placeholder="Longitude" class="lng-input">';
    document.getElementById('coordinate-inputs').appendChild(container);
}

function createPolygon() {
    polygonCoordinates = [];
    document.querySelectorAll('#coordinate-inputs div').forEach(inputContainer => {
        const lat = parseFloat(inputContainer.querySelector('.lat-input').value);
        const lng = parseFloat(inputContainer.querySelector('.lng-input').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            polygonCoordinates.push([lat, lng]);
        }
    });

    if (polygonCoordinates.length >= 3) {
        polygonLayer.clearLayers();
        const polygon = L.polygon(polygonCoordinates).addTo(polygonLayer);
        map.fitBounds(polygon.getBounds());
        findTerminalsInShape(polygon);
    } else {
        alert('Please enter at least 3 valid coordinates to form a polygon.');
    }
}

function savePolygon() {
    if (polygonCoordinates.length >= 3) {
        const polygonName = prompt('Enter a name for this custom region:');
        if (polygonName) {
            const regions = JSON.parse(localStorage.getItem('customRegions')) || [];
            regions.push({ name: polygonName, type: 'polygon', coordinates: polygonCoordinates });
            localStorage.setItem('customRegions', JSON.stringify(regions));
            alert('Custom region saved successfully!');
        }
    } else {
        alert('Please create a valid polygon before saving.');
    }
}

function createCircle() {
    const lat = parseFloat(document.getElementById('circle-lat').value);
    const lng = parseFloat(document.getElementById('circle-lng').value);
    const radius = parseFloat(document.getElementById('circle-radius').value) * 1000;

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
        circleLayer.clearLayers();
        const circle = L.circle([lat, lng], { radius: radius }).addTo(circleLayer);
        map.fitBounds(circle.getBounds());
        findTerminalsInShape(circle);
    } else {
        alert('Please enter valid coordinates and radius.');
    }
}

function saveCircle() {
    const lat = parseFloat(document.getElementById('circle-lat').value);
    const lng = parseFloat(document.getElementById('circle-lng').value);
    const radius = parseFloat(document.getElementById('circle-radius').value) * 1000;

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
        const circleName = prompt('Enter a name for this custom region:');
        if (circleName) {
            const regions = JSON.parse(localStorage.getItem('customRegions')) || [];
            regions.push({ name: circleName, type: 'circle', center: [lat, lng], radius: radius });
            localStorage.setItem('customRegions', JSON.stringify(regions));
            alert('Custom region saved successfully!');
        }
    } else {
        alert('Please create a valid circle before saving.');
    }
}

function saveDrawing() {
    if (drawLayer.getLayers().length > 0) {
        const drawingName = prompt('Enter a name for this custom region:');
        if (drawingName) {
            const regions = JSON.parse(localStorage.getItem('customRegions')) || [];
            const drawnItems = drawLayer.toGeoJSON();
            regions.push({ name: drawingName, type: 'custom', geoJSON: drawnItems });
            localStorage.setItem('customRegions', JSON.stringify(regions));
            alert('Custom region saved successfully!');
        }
    } else {
        alert('Please create a valid drawing before saving.');
    }
}

function plotDevices(devices) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    devices.forEach(device => {
        const marker = L.marker([device.latitude, device.longitude]).addTo(map);
        marker.bindPopup(`<b>Device ID:</b> ${device.device_id}<br>Latitude: ${device.latitude}<br>Longitude: ${device.longitude}<br>District: ${device.district}<br>State: ${device.state}<br>Time: ${device.time}`);
    });
}

function findTerminalsInShape(shape) {
    const terminalsInside = currentData.filter(device => {
        const point = L.latLng(device.latitude, device.longitude);
        return shape.getBounds().contains(point);
    });

    displayTerminals(terminalsInside);
}

function displayTerminals(terminals) {
    const terminalsList = document.getElementById('terminals');
    terminalsList.innerHTML = '';
    terminals.forEach(terminal => {
        const li = document.createElement('li');
        li.textContent = `Device ID: ${terminal.device_id}, Lat: ${terminal.latitude}, Lng: ${terminal.longitude}`;
        terminalsList.appendChild(li);
    });
    document.getElementById('terminals-list').style.display = 'block';
}