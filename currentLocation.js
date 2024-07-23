let allLocations = [];
let map;
let markersLayer = new L.LayerGroup();
let disabledDevices = new Set(JSON.parse(localStorage.getItem('disabledDevices')) || []);

document.addEventListener('DOMContentLoaded', function () {
    fetchDeviceData();
    setInterval(fetchDeviceData, 15000); // Refresh data every 15 seconds
    initializeMap();
});

function fetchDeviceData() {
    fetch('/api/latest_locations')
        .then(response => response.json())
        .then(data => {
            data.sort((a, b) => a.device_id - b.device_id); // Sort data by device_id ascending
            populateTable(data);
            plotDevicesOnMap(data);
        })
        .catch(error => console.error('Error fetching device data:', error));
}

function populateTable(data) {
    const tableBody = document.getElementById('deviceTableBody');
    tableBody.innerHTML = ''; // Clear existing data

    data.forEach(device => {
        const row = tableBody.insertRow();
        row.setAttribute('data-device-id', device.device_id);


        row.insertCell(0).textContent = device.device_id;
        row.insertCell(1).textContent = device.time;
        row.insertCell(2).textContent = device.latitude.toFixed(4);
        row.insertCell(3).textContent = device.longitude.toFixed(4);
        row.insertCell(4).textContent = device.district;
        row.insertCell(5).textContent = device.state;
        row.insertCell(6).textContent = device.status;
        row.insertCell(7).innerHTML = `<a href="map.html?lat=${device.latitude}&lng=${device.longitude}">View on Map</a>`;

    });
}





function updateDeviceStatus(deviceId, status) {
    return fetch('/api/update_device_status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId, status: status }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    });
}
function plotDevicesOnMap(data) {
    markersLayer.clearLayers(); // Clear existing markers
    const defaultIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [12, 20],
        iconAnchor: [6, 20],
        popupAnchor: [1, -17],
        shadowSize: [20, 20]
    });
    data.forEach(device => {
            const marker = L.marker([device.latitude, device.longitude], {icon:defaultIcon})
                            .bindPopup(`Device ID: ${device.device_id}<br>Time: ${device.time}<br>Latitude: ${device.latitude}<br>Longitude: ${device.longitude}<br>District: ${device.district}<br>State: ${device.state}<br>Status: ${device.status || 'Unknown'}<br>`);
            markersLayer.addLayer(marker);
    });
    markersLayer.addTo(map);
}

// ... (rest of the code remains the same)
function initializeMap() {
    map = L.map('map', {
        center: [20.5937, 78.9629], // Centered at [20.5937, 78.9629]
        zoom: 4, // Zoom level 4
        zoomControl: true, // Disable zoom control
        scrollWheelZoom: false // Disable scroll wheel zoom
    });
    L.tileLayer('https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=mbDwiByVth6NBS6Gcy1g', {
        attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
    }).addTo(map);
}

function exportTableToCSV(filename) {
    const csv = [];
    const rows = document.querySelectorAll("table tr");

    for (const row of rows) {
        const cols = row.querySelectorAll("th, td");
        const rowData = Array.from(cols).slice(0, -1).map(col => col.innerText); // Exclude last column
        csv.push(rowData.join(","));
    }

    // Create a blob with the CSV content
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });

    // Create a link element
    const downloadLink = document.createElement("a");

    // Set the download attribute with the filename
    downloadLink.download = filename;

    // Create a URL for the blob and set it as the href attribute
    downloadLink.href = window.URL.createObjectURL(csvFile);

    // Append the link to the body
    document.body.appendChild(downloadLink);

    // Simulate a click on the link to trigger the download
    downloadLink.click();

    // Remove the link from the document
    document.body.removeChild(downloadLink);
}