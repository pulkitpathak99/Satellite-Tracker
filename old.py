import sqlite3
import random
from datetime import datetime, timedelta
import time

# Define the bounding box for India
INDIA_BOUNDARY = {
    "lat_min": 10.4,
    "lat_max": 30.5,
    "lng_min": 72.7,
    "lng_max": 85.25
}

def generate_initial_location():
    return {
        "lat": random.uniform(INDIA_BOUNDARY["lat_min"], INDIA_BOUNDARY["lat_max"]),
        "lng": random.uniform(INDIA_BOUNDARY["lng_min"], INDIA_BOUNDARY["lng_max"])
    }

def update_location(current_location):
    max_change = 0.01
    delta_lat = random.uniform(-max_change, max_change)
    delta_lng = random.uniform(-max_change, max_change)
    new_lat = max(INDIA_BOUNDARY["lat_min"], min(INDIA_BOUNDARY["lat_max"], current_location['lat'] + delta_lat))
    new_lng = max(INDIA_BOUNDARY["lng_min"], min(INDIA_BOUNDARY["lng_max"], current_location['lng'] + delta_lng))
    return {"lat": new_lat, "lng": new_lng}

def init_db():
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS locations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  device_id INTEGER NOT NULL,
                  time TEXT NOT NULL,
                  latitude REAL NOT NULL,
                  longitude REAL NOT NULL,
                  status TEXT)''')
    conn.commit()
    conn.close()

def batch_insert_locations(locations_data):
    conn = sqlite3.connect('locations.db')
    c = conn.cursor()
    c.executemany("INSERT INTO locations (device_id, time, latitude, longitude, status) VALUES (?, ?, ?, ?, ?)", locations_data)
    conn.commit()
    conn.close()

def generate_historical_data():
    num_devices = 35
    end_date = datetime.now()-timedelta(days=30)
    start_date = end_date - timedelta(days=360)  # 6 months ago

    locations = {device_id: generate_initial_location() for device_id in range(1, num_devices + 1)}
    statuses = {device_id: "Active" for device_id in range(1, num_devices + 1)}

    batch_size = 10000
    batch_data = []

    current_date = start_date
    while current_date <= end_date:
        for device_id in range(1, num_devices + 1):
            locations[device_id] = update_location(locations[device_id])



            batch_data.append((
                device_id,
                current_date.strftime('%Y-%m-%d %H:%M:%S'),
                locations[device_id]['lat'],
                locations[device_id]['lng'],
                statuses[device_id]
            ))

            if len(batch_data) >= batch_size:
                batch_insert_locations(batch_data)
                batch_data = []
                print(f"Inserted batch of data up to {current_date}")

        current_date += timedelta(minutes=20)

    if batch_data:
        batch_insert_locations(batch_data)
        print(f"Inserted final batch of data up to {current_date}")

if __name__ == "__main__":
    init_db()
    start_time = time.time()
    generate_historical_data()
    end_time = time.time()
    print(f"Data generation completed in {end_time - start_time:.2f} seconds")