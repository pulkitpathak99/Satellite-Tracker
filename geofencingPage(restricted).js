function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('login-overlay').style.display = 'none';
        } else {
            alert('Invalid username or password');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred during login');
    });
}

function sendLogMessage(message) {
    let logs = JSON.parse(localStorage.getItem('deviceLogs')) || [];
    logs.push({
        message: message,
        timestamp: new Date().toLocaleString()
    });
    localStorage.setItem('deviceLogs', JSON.stringify(logs));
}

(function() {
    emailjs.init("EHcP51YCyaT_aQL3a");
})();

let filtersLocked = false;

function toggleLockFilters() {
    filtersLocked = !filtersLocked;
    const lockBtn = document.getElementById('lock-btn');
    lockBtn.classList.toggle('locked', filtersLocked);

    const checkboxes = document.querySelectorAll('.state-checkbox, .district-checkbox, .region-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.disabled = filtersLocked;
    });

    lockBtn.textContent = filtersLocked ? 'Unlock Filters' : 'Lock Filters';
    updateLogs();
    populateDeviceTable(data);
    applyFilters();
    saveFilters(); // Save filters when locking/unlocking
}

function sendEmail(subject, message) {
    emailjs.send("service_puyqgie", "template_298ctia", {
        to_email: 'contactdg2003@gmail.com',
        from_name: 'Device Tracking System',
        subject: subject,
        message: message
    }).then(
        function(response) {
            console.log('SUCCESS!', response.status, response.text);
        },
        function(error) {
            console.log('FAILED...', error);
        }
    );
}

function deleteCustomRegion(index) {
    const regions = JSON.parse(localStorage.getItem('customRegions')) || [];
    regions.splice(index, 1);
    localStorage.setItem('customRegions', JSON.stringify(regions));
    loadCustomRegions();
    applyFilters();
}

document.addEventListener('DOMContentLoaded', function () {

    const map = L.map('map', {
        center: [20.5937, 78.9629],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: false
    });

    L.tileLayer('https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=mbDwiByVth6NBS6Gcy1g', {
        attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
    }).addTo(map);

    localStorage.setItem('filteredData', JSON.stringify([]));
    localStorage.setItem('deviceLogs', JSON.stringify([]));
    localStorage.setItem('filteredDeviceIds', JSON.stringify([]));

    let deviceMarkers = {};
    let allData = [];
    let statesData = [];
    let highlightedRegions = [];

    function fetchStatesAndDistricts() {
        return fetch('/api/states_and_districts')
            .then(response => response.json())
            .then(data => {
                statesData = data;
                populateStateFilter(data);
            })
            .catch(error => console.error('Error fetching states and districts:', error));
    }

    function populateStateFilter(data) {
        const stateSelect = document.getElementById('state-select');
        stateSelect.innerHTML = '';

        const noneOption = document.createElement('label');
        noneOption.innerHTML = `<input type="checkbox" value="" class="state-checkbox" checked> (None)`;
        stateSelect.appendChild(noneOption);

        data.forEach(state => {
            const stateCheckbox = document.createElement('label');
            stateCheckbox.innerHTML = `<input type="checkbox" value="${state.state_name}" class="state-checkbox"> ${state.state_name}`;
            stateSelect.appendChild(stateCheckbox);
        });

        stateSelect.addEventListener('change', function(event) {
            if (event.target.classList.contains('state-checkbox')) {
                const noneCheckbox = stateSelect.querySelector('input[value=""]');
                if (event.target !== noneCheckbox) {
                    noneCheckbox.checked = false;
                } else if (noneCheckbox.checked) {
                    stateSelect.querySelectorAll('.state-checkbox:not([value=""])').forEach(cb => cb.checked = false);
                }
            }
        });
    }

    function populateDistrictFilter() {
        const selectedStates = Array.from(document.querySelectorAll('.state-checkbox:checked')).map(cb => cb.value);
        const districtSelect = document.getElementById('district-select');
        districtSelect.innerHTML = '';

        if (selectedStates.length > 0) {
            const x = allData.filter(location => selectedStates.includes(location.state));
            const uniqueDistricts = [...new Set(x.map(location => location.district))];

            uniqueDistricts.forEach(district => {
                const districtCheckbox = document.createElement('label');
                districtCheckbox.innerHTML = `<input type="checkbox" value="${district}" class="district-checkbox"> ${district}`;
                districtSelect.appendChild(districtCheckbox);
            });
        }
    }

    function fetchAllDevices() {
        fetch('/api/latest_locations')
            .then(response => response.json())

            .then(data => {
                allData = data;
                applyFilters();
                data.sort((a, b) => a.device_id - b.device_id); // Sort data by device_id ascending
                populateDeviceTable(data);
            })
            .catch(error => console.error('Error fetching device locations:', error));
    }
    function loadCustomRegions() {
        const regions = JSON.parse(localStorage.getItem('customRegions')) || [];
        const regionSelect = document.getElementById('region-select');
        regionSelect.innerHTML = '';

        regions.forEach((region, index) => {
            const regionCheckbox = document.createElement('div');
            regionCheckbox.classList.add('custom-region-item');
            regionCheckbox.innerHTML = `
                <input type="checkbox" id="region-checkbox-${index}" value='${JSON.stringify(region)}' class="region-checkbox">
                <label for="region-checkbox-${index}">${region.name}</label>
                <button class="delete-region-btn" onclick="deleteCustomRegion(${index})">&#10006;</button>
            `;
            regionSelect.appendChild(regionCheckbox);
        });
    }
    function saveFilters() {
        const selectedStates = Array.from(document.querySelectorAll('.state-checkbox:checked')).map(cb => cb.value);
        const selectedDistricts = Array.from(document.querySelectorAll('.district-checkbox:checked')).map(cb => cb.value);
        const selectedRegions = Array.from(document.querySelectorAll('.region-checkbox:checked')).map(cb => JSON.parse(cb.value));

        const filtersData = {
            states: selectedStates,
            districts: selectedDistricts,
            regions: selectedRegions,
            locked: filtersLocked
        };

        if (filtersData.states.length || filtersData.districts.length || filtersData.regions.length || filtersData.locked) {
            fetch('/api/save_filters', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filtersData),
            })
            .then(response => response.json())
            .then(data => console.log('Filters saved:', data))
            .catch(error => console.error('Error saving filters:', error));
        } else {
            console.log('No filters to save');
        }
    }

    function loadFilters() {
        console.log('Loading filters...');
        fetch('/api/load_filters')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Filters loaded:', data);

            if (Object.keys(data).length === 0) {
                console.log('No filters saved, setting default state.');
                const defaultCheckbox = document.querySelector('.state-checkbox[value=""]');
                if (defaultCheckbox) {
                    defaultCheckbox.checked = true;
                    console.log('Default state checkbox checked');
                } else {
                    console.log('Default state checkbox not found');
                }
            } else {
                // Check state checkboxes
                data.states.forEach(state => {
                    const checkbox = document.querySelector(`.state-checkbox[value="${state}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        console.log(`State checkbox checked: ${state}`);
                    } else {
                        console.log(`State checkbox not found: ${state}`);
                    }
                });

                // Populate and check district checkboxes
                populateDistrictFilter();
                data.districts.forEach(district => {
                    const checkbox = document.querySelector(`.district-checkbox[value="${district}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        console.log(`District checkbox checked: ${district}`);
                    } else {
                        console.log(`District checkbox not found: ${district}`);
                    }
                });
                loadCustomRegions();
                // Check custom region checkboxes
                data.regions.forEach(region => {
                    const checkbox = document.querySelector(`.region-checkbox[value="${(region)}"]`);
                    console.log(document.querySelector(`.region-checkbox`));
                    if (checkbox) {
                        checkbox.checked = true;
                        console.log(`Region checkbox checked: ${region.name}`);
                    } else {
                        console.log(`Region checkbox not found: ${region.name}`);
                    }
                });


            }

            // Apply filters and update logs
            applyFilters();
            updateLogs();
        })
        .catch(error => {
            console.error('Error loading filters:', error);
            // Set default state on error
            const defaultCheckbox = document.querySelector('.state-checkbox[value=""]');
            if (defaultCheckbox) {
                defaultCheckbox.checked = true;
                console.log('Default state checkbox checked (error case)');
            } else {
                console.log('Default state checkbox not found (error case)');
            }
            applyFilters();
            updateLogs();
        });
    }
    function applyFilters() {
        const selectedStates = Array.from(document.querySelectorAll('.state-checkbox:checked')).map(cb => cb.value);
        const selectedDistricts = Array.from(document.querySelectorAll('.district-checkbox:checked')).map(cb => cb.value);
        const selectedRegions = Array.from(document.querySelectorAll('.region-checkbox:checked')).map(cb => JSON.parse(cb.value));

        highlightedRegions.forEach(region => map.removeLayer(region));
        highlightedRegions = [];

        let filteredData = allData;

        if (selectedStates.length > 0) {
            filteredData = filteredData.filter(location => selectedStates.includes(location.state));
        }
        if (selectedDistricts.length > 0) {
            filteredData = filteredData.filter(location => selectedDistricts.includes(location.district));
        }

        if (selectedRegions.length > 0) {
            let regionFilteredData = [];

            selectedRegions.forEach(region => {
                if (region.radius) {
                    // Handle circle
                    const circle = L.circle(region.center, { radius: region.radius, color: 'red', fillColor: '#f03', fillOpacity: 0.5 }).addTo(map);
                    highlightedRegions.push(circle);
    
                    regionFilteredData = regionFilteredData.concat(allData.filter(location => {
                        const distance = map.distance(region.center, [location.latitude, location.longitude]);
                        return distance <= region.radius;
                    }));
                } else if (region.coordinates) {
                    // Handle polygon
                    const polygon = L.polygon(region.coordinates, { color: 'red', fillColor: '#f03', fillOpacity: 0.5 }).addTo(map);
                    highlightedRegions.push(polygon);
    
                    regionFilteredData = regionFilteredData.concat(allData.filter(location => {
                        return polygon.getBounds().contains([location.latitude, location.longitude]);
                    }));
                } else if (region.type === 'custom' && region.geoJSON) {
                    // Handle custom drawing
                    const geoJSONLayer = L.geoJSON(region.geoJSON, { 
                        style: { color: 'red', fillColor: '#f03', fillOpacity: 0.5 }
                    }).addTo(map);
                    highlightedRegions.push(geoJSONLayer);
    
                    regionFilteredData = regionFilteredData.concat(allData.filter(location => {
                        const point = L.latLng(location.latitude, location.longitude);
                        return geoJSONLayer.getBounds().contains(point);
                    }));
                }
            });

            regionFilteredData = regionFilteredData.filter((value, index, self) =>
                index === self.findIndex((t) => (t.device_id === value.device_id))
            );

            filteredData = filteredData.concat(regionFilteredData);
            filteredData = filteredData.filter((value, index, self) =>
                index === self.findIndex((t) => (t.device_id === value.device_id))
            );
        }

        const defaultIcon = L.icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [12, 20],
            iconAnchor: [6, 20],
            popupAnchor: [1, -17],
            shadowSize: [20, 20]
    });

        const highlightedIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [12, 20],
            iconAnchor: [6, 20],
            popupAnchor: [1, -17],
            shadowSize: [20, 20]
        });

        allData.forEach(location => {
            const { device_id, latitude, longitude, time, district, state } = location;
            const latlng = [latitude, longitude];
            const isFiltered = filteredData.some(filteredLocation => filteredLocation.device_id === device_id);

            if (deviceMarkers[device_id]) {
                deviceMarkers[device_id].setLatLng(latlng);
                deviceMarkers[device_id].setIcon(isFiltered ? highlightedIcon : defaultIcon);
                deviceMarkers[device_id].getPopup().setContent(`<b>Device ${device_id}</b><br>Time: ${time}<br>District: ${district}<br>State: ${state}`);
            } else {
                const marker = L.marker(latlng, {icon: isFiltered ? highlightedIcon : defaultIcon})
                    .bindPopup(`<b>Device ${device_id}</b><br>Time: ${time}<br>District: ${district}<br>State: ${state}`)
                    .addTo(map);
                deviceMarkers[device_id] = marker;
            }
        });

        if (!filtersLocked) return;
        const filteredDeviceIds = filteredData.map(location => location.device_id);
        const previouslyFilteredDeviceIds = JSON.parse(localStorage.getItem('filteredDeviceIds')) || [];

        const devicesEntered = filteredDeviceIds.filter(id => !previouslyFilteredDeviceIds.includes(id));
        devicesEntered.forEach(deviceId => {
            const message = `Device ${deviceId} entered the geofenced area.`;
            console.log(message);
            sendLogMessage(message);
        });
        allData.forEach(location => {
            updateDeviceStatus(location.device_id, filteredDeviceIds.includes(location.device_id) ? 'InActive' : 'Active');
        });

        const devicesLeft = previouslyFilteredDeviceIds.filter(id => !filteredDeviceIds.includes(id));
        devicesLeft.forEach(deviceId => {
            const message = `Device ${deviceId} left the geofenced area.`;
            console.log(message);
            sendLogMessage(message);
        });

        localStorage.setItem('filteredDeviceIds', JSON.stringify(filteredDeviceIds));
        localStorage.setItem('filteredData', JSON.stringify(filteredData));
        updateFilteredLocationsTable(filteredData);
    }
    function updateDeviceStatus(deviceId, status) {
        fetch('/api/update_device_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_id: deviceId, status: status }),
        })
        .then(response => response.json())

    }
    function updateFilteredLocationsTable(data) {
        const tbody = document.getElementById('filteredLocationsBody');
        tbody.innerHTML = '';
        data.forEach(location => {
            const row = tbody.insertRow();
            row.insertCell().textContent = location.device_id;
            row.insertCell().textContent = location.time;
            row.insertCell().textContent = location.latitude.toFixed(4);
            row.insertCell().textContent = location.longitude.toFixed(4);
            row.insertCell().textContent = location.district;
            row.insertCell().textContent = location.state;
            row.insertCell().textContent = location.status || 'Unknown'; // Add this line
        });
    }

    function updateLogs() {
        var deviceLogs = JSON.parse(localStorage.getItem('deviceLogs'));
        var deviceLogsDiv = document.getElementById('deviceLogs');
        deviceLogsDiv.innerHTML = '';

        if (deviceLogs && deviceLogs.length > 0) {
            var table = document.createElement('table');
            var thead = document.createElement('thead');
            var tbody = document.createElement('tbody');

            var headerRow = document.createElement('tr');
            ['Timestamp', 'Message'].forEach(header => {
                var th = document.createElement('th');
                th.textContent = header;
                th.onclick = () => sortTable(headerRow.cells.length - 1, 'deviceLogs');
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            table.appendChild(thead);

            deviceLogs.forEach((log, index) => {
                var row = tbody.insertRow();
                row.insertCell().textContent = log.timestamp || 'N/A';
                row.insertCell().textContent = log.message || log;
            });

            table.appendChild(tbody);
            deviceLogsDiv.appendChild(table);
        } else {
            deviceLogsDiv.textContent = 'No logs available';
        }
    }

    function sortTable(columnIndex, tableId) {
        const table = document.getElementById(tableId);
        const tbody = table.getElementsByTagName('tbody')[0];
        const rows = Array.from(tbody.rows);

        rows.sort((rowA, rowB) => {
            const cellA = rowA.cells[columnIndex].textContent.trim();
            const cellB = rowB.cells[columnIndex].textContent.trim();

            if (columnIndex === 0 && tableId === 'filteredLocationsTable') {
                return Number(cellA) - Number(cellB);
            } else {
                return cellA.localeCompare(cellB, undefined, { numeric: true, sensitivity: 'base' });
            }
        });

        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }

    function populateDeviceTable(data) {
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
            row.insertCell(6).textContent = device.status || 'Unknown';

            const toggleCell = row.insertCell(7);
            const toggleButton = document.createElement('button');
            toggleButton.classList.add('toggle-button');
            toggleButton.textContent = device.status === "Inactive" ? 'Enable' : 'Disable';
            toggleButton.classList.add(device.status === "Inactive" ? 'enable' : 'disable');
            toggleButton.onclick = () => toggleDevice(device, toggleButton);
            toggleCell.appendChild(toggleButton);

        });
    }

    function toggleDevice(device, button) {
        const newStatus = device.status === "Inactive" ? "Active" : "Inactive";
        updateButtonUI(button, newStatus);
        device.status = newStatus;
        updateTableRow(device);
        updateMapMarker(device);

        updateDeviceStatus(device.device_id, newStatus)
            .catch(error => {
                console.error('Error updating device status:', error);
                device.status = device.status === "Inactive" ? "Active" : "Inactive";
                updateButtonUI(button, device.status);
                updateTableRow(device);
                updateMapMarker(device);
            });
    }

    function updateButtonUI(button, status) {
        button.textContent = status === "Inactive" ? 'Enable' : 'Disable';
        button.classList.remove(status === "Inactive" ? 'disable' : 'enable');
        button.classList.add(status === "Inactive" ? 'enable' : 'disable');
    }

    function updateTableRow(device) {
        const row = document.querySelector(`tr[data-device-id="${device.device_id}"]`);
        if (row) {
            row.cells[6].textContent = device.status;
        }
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
    document.getElementById('state-select').addEventListener('change', populateDistrictFilter);
    document.getElementById('state-select').addEventListener('change', applyFilters);
    document.getElementById('district-select').addEventListener('change', applyFilters);
    document.getElementById('region-select').addEventListener('change', applyFilters);
    document.getElementById('lock-btn').addEventListener('click', applyFilters);

    document.getElementById('login-overlay').style.display = 'flex';
    fetchStatesAndDistricts().then(() => {

        fetchAllDevices();
        loadCustomRegions();
        loadFilters();
        updateLogs();
    });

    setInterval(function() {
        fetchAllDevices();
        updateLogs();
    }, 15000);
});

