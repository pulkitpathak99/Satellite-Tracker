import sqlite3
import time
import random
from datetime import datetime
import requests


# Define the bounding box for India
INDIA_BOUNDARY = {
    "lat_min": 10.4,
    "lat_max": 30.5,
    "lng_min": 72.7,
    "lng_max": 85.25
}

# Function to generate an initial valid location within India
def generate_initial_location():
    return {
        "lat": random.uniform(INDIA_BOUNDARY["lat_min"], INDIA_BOUNDARY["lat_max"]),
        "lng": random.uniform(INDIA_BOUNDARY["lng_min"], INDIA_BOUNDARY["lng_max"])
    }

# Function to update the location within India with small changes
def update_location(current_location):
    # Define maximum allowed change (in degrees)
    max_change = 0.25

    # Generate small random changes
    delta_lat = random.uniform(-max_change, max_change)
    delta_lng = random.uniform(-max_change, max_change)

    # Apply changes to current location
    new_lat = current_location['lat'] + delta_lat
    new_lng = current_location['lng'] + delta_lng

    # Ensure the new location stays within India's bounds
    new_lat = max(INDIA_BOUNDARY["lat_min"], min(INDIA_BOUNDARY["lat_max"], new_lat))
    new_lng = max(INDIA_BOUNDARY["lng_min"], min(INDIA_BOUNDARY["lng_max"], new_lng))

    return {"lat": new_lat, "lng": new_lng}

# Function to initialize the database
def init_db():
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS locations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  device_id INTEGER NOT NULL,
                  time TEXT NOT NULL,
                  latitude REAL NOT NULL,
                  longitude REAL NOT NULL,
                  district TEXT,
                  state TEXT,
                  status TEXT DEFAULT 'Active')''')
    conn.commit()
    conn.close()

# Function to reverse geocode and get district and state names
def get_location_details(latitude, longitude, max_retries=3):
    url = f"https://nominatim.openstreetmap.org/reverse?lat={latitude}&lon={longitude}&format=json"
    headers = {
        "User-Agent": "device_location_script/1.0"
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()  # Raise an exception for bad status codes
            data = response.json()

            address = data.get('address', {})
            district = address.get('state_district', 'Unknown District')
            if district.endswith(' District'):
                district = district[:-9]
            state = address.get('state', 'Out of India')
            return district, state
        except requests.exceptions.RequestException as e:
            print(f"Error during geocoding (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2)  # Wait for 2 seconds before retrying

    return 'Unknown District', 'Unknown State'

# Function to save location data to the database
def save_location_to_db(device_id, location,status):
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    district, state = get_location_details(location['lat'], location['lng'])
    c.execute("INSERT INTO locations (device_id, time, latitude, longitude, district, state,status) VALUES (?, ?, ?, ?, ?, ?,?)",
              (device_id, time_str, location['lat'], location['lng'], district, state, status))
    conn.commit()
    conn.close()

# Function to generate and update location data
def generate_and_update_locations():
    num_devices = 35
    locations = {}
    statuses={}
    for device_id in range(1, num_devices + 1):
        last_status = get_last_status(device_id)
        if last_status:
            statuses[device_id] = last_status
        else:
            statuses[device_id] = "Active"
    # Get the last known location for each device or generate a new one
    for device_id in range(1, num_devices + 1):
        last_location = get_last_location(device_id)
        if last_location:
            locations[device_id] = last_location
        else:
            locations[device_id] = generate_initial_location()

    while True:
        for device_id in range(1, num_devices + 1):
            locations[device_id] = update_location(locations[device_id])
            save_location_to_db(device_id, locations[device_id], statuses[device_id])
            print(f"Updated location for device {device_id}: {locations[device_id]}")
        time.sleep(5)

# Function to get the last known location for a device from the database
def get_last_location(device_id):
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    c.execute("SELECT latitude, longitude FROM locations WHERE device_id = ? ORDER BY time DESC LIMIT 1", (device_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return {"lat": row[0], "lng": row[1]}
    return None
def get_last_status(device_id):
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    c.execute("SELECT status FROM locations WHERE device_id = ? ORDER BY time DESC LIMIT 1", (device_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0]
    return None
if __name__ == "__main__":
    init_db()
    generate_and_update_locations()
