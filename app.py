import bcrypt
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import sqlite3
from datetime import datetime
from geopy.geocoders import Nominatim
import json
import os

FILTERS_FILE = 'filters.json'

app = Flask(__name__, static_url_path='', static_folder='')
app.secret_key = 'your_secret_key_here'


# Initialize Geopy geocoder
geolocator = Nominatim(user_agent="device_location_script")

# In-memory user storage (replace with a database in production)
users = {
    "admin": "hughes"  # username: password
}


@app.route('/api/update_device_status', methods=['POST'])
def update_device_status():
    data = request.json
    device_id = data.get('device_id')
    status = data.get('status')

    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("UPDATE locations SET status = ? WHERE device_id = ? AND time = (SELECT MAX(time) FROM locations WHERE device_id = ?)",
                  (status, device_id, device_id))
        conn.commit()

    return jsonify({'message': 'Device status updated successfully'}), 200

@app.route('/api/create_account', methods=['POST'])
def create_account():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
            conn.commit()
        return jsonify({"success": True, "message": "Account created successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "Username already exists"}), 409
    except Exception as e:
        print(f"Error creating account: {str(e)}")
        return jsonify({"success": False, "message": "Failed to create account"}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200



@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400

    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT password FROM users WHERE username = ?", (username,))
            user = c.fetchone()

        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return jsonify({"success": True, "message": "Login successful"}), 200
        else:
            return jsonify({"success": False, "message": "Invalid username or password"}), 401
    except Exception as e:
        print(f"Error during login: {str(e)}")
        return jsonify({"success": False, "message": "Login failed"}), 500


@app.route('/api/save_filters', methods=['POST'])
def save_filters():
    filters_data = request.json
    with open(FILTERS_FILE, 'w') as f:
        json.dump(filters_data, f)
    return jsonify({'message': 'Filters saved successfully'})

@app.route('/api/load_filters', methods=['GET'])
def load_filters():
    if os.path.exists(FILTERS_FILE):
        with open(FILTERS_FILE, 'r') as f:
            filters_data = json.load(f)
        return jsonify(filters_data)
    else:
        return jsonify({'states': [], 'districts': [], 'regions': [], 'locked': False})

def get_db_connection():
    conn = sqlite3.connect('locations.db')
    conn.row_factory = sqlite3.Row
    return conn

# Ensure the locations table exists with the updated schema
with get_db_connection() as conn:
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS locations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  device_id INTEGER NOT NULL,
                  time TEXT NOT NULL,
                  latitude REAL NOT NULL,
                  longitude REAL NOT NULL,
                  district TEXT,
                  state TEXT)''')
    conn.commit()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL)''')
    conn.commit()

# Function to reverse geocode and get district and state names
def get_location_details(latitude, longitude):
    try:
        location = geolocator.reverse((latitude, longitude), exactly_one=True)
        if location:
            address = location.raw.get('address', {})
            district = address.get('county', address.get('state_district', 'Unknown District'))
            state = address.get('state', 'Unknown State')
            return district, state
        else:
            return 'Unknown District', 'Unknown State'
    except Exception as e:
        print(f"Error during geocoding: {e}")
        return 'Unknown District', 'Unknown State'

@app.route('/')
def home():
    return app.send_static_file('login.html')

@app.route('/api/location', methods=['POST'])
def receive_location():
    try:
        data = request.json
        if 'device_id' not in data or 'latitude' not in data or 'longitude' not in data:
            return jsonify({'error': 'Invalid data format'}), 400

        time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        device_id = data['device_id']
        latitude = data['latitude']
        longitude = data['longitude']
        district, state = get_location_details(latitude, longitude)

        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("INSERT INTO locations (device_id, time, latitude, longitude, district, state) VALUES (?, ?, ?, ?, ?, ?)",
                      (device_id, time_str, latitude, longitude, district, state))
            conn.commit()

        return jsonify({'message': 'Location data stored successfully'}), 200
    except Exception as e:
        print(f"Error inserting data into database: {str(e)}")
        return jsonify({'error': 'Failed to store location data'}), 500

@app.route('/api/locations', methods=['GET'])
def get_locations():
    try:
        device_id = request.args.get('device_id')
        with get_db_connection() as conn:
            c = conn.cursor()
            if device_id:
                c.execute("SELECT * FROM locations WHERE device_id = ?", (device_id,))
            else:
                c.execute("SELECT * FROM locations")
            rows = c.fetchall()
            locations = [dict(row) for row in rows]
        return jsonify(locations)
    except Exception as e:
        print(f"Error fetching data from database: {str(e)}")
        return jsonify({'error': 'Failed to fetch location data'}), 500

@app.route('/api/latest_locations', methods=['GET'])
def get_latest_locations():
    try:
        with get_db_connection() as conn:
            c = conn.cursor()

            c.execute("SELECT * FROM locations WHERE (device_id, time) IN (SELECT device_id, MAX(time) FROM locations GROUP BY device_id)")
            rows = c.fetchall()
            latest_locations = [dict(row) for row in rows]
        return jsonify(latest_locations)
    except Exception as e:
        print(f"Error fetching latest data from database: {str(e)}")
        return jsonify({'error': 'Failed to fetch latest location data'}), 500

@app.route('/all_devices_map')
def all_devices_map():
    return app.send_static_file('all_devices_map.html')

@app.route('/api/states_and_districts', methods=['GET'])
def get_states_and_districts():
    try:
        conn = sqlite3.connect('states_database.db')
        cursor = conn.cursor()

        # Query states and districts data
        cursor.execute('SELECT id, state_name FROM states ORDER BY state_name')
        states = cursor.fetchall()

        states_data = []
        for state in states:
            state_id, state_name = state
            cursor.execute('SELECT district_name FROM districts WHERE state_id = ?', (state_id,))
            districts = [district[0] for district in cursor.fetchall()]
            states_data.append({
                'state_name': state_name,
                'districts': districts
            })

        conn.close()

        return jsonify(states_data)

    except sqlite3.Error as e:
        print("SQLite error:", e)
        return jsonify({'error': 'Database error'})

if __name__ == '__main__':
    app.run(debug=True)
