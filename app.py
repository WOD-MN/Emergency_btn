from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import serial
import json
import threading
import time
import struct

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///lora_data.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, cors_allowed_origins="*")
db = SQLAlchemy(app)

# Database Models
class Node(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.Integer, unique=True, nullable=False)
    name = db.Column(db.String(100))
    last_seen = db.Column(db.DateTime)

class SensorReading(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.Integer, db.ForeignKey('node.node_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    pressure = db.Column(db.Float)
    iaq = db.Column(db.Float)
    battery_mv = db.Column(db.Integer)
    rssi = db.Column(db.Integer)
    emergency = db.Column(db.Boolean, default=False)

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.Integer, db.ForeignKey('node.node_id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    acknowledged = db.Column(db.Boolean, default=False)

# Create tables
with app.app_context():
    db.create_all()

# Serial port configuration (modify for your setup)
SERIAL_PORT = '/dev/serial0'  # Raspberry Pi UART
SERIAL_BAUDRATE = 115200
ser = None

# GPIO for siren control (if using Raspberry Pi)
SIREN_ENABLED = False
try:
    import RPi.GPIO as GPIO
    SIREN_PIN = 17  # GPIO 17
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(SIREN_PIN, GPIO.OUT)
    GPIO.output(SIREN_PIN, GPIO.LOW)
    SIREN_ENABLED = True
except:
    print("GPIO not available - siren control disabled")

def init_serial():
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, SERIAL_BAUDRATE, timeout=1)
        print(f"Serial port {SERIAL_PORT} opened successfully")
        return True
    except Exception as e:
        print(f"Failed to open serial port: {e}")
        return False

def decode_lora_packet(data):
    try:
        unpacked = struct.unpack('<BHIIhHHHHBHB', data[:25])

        packet = {
            'header': unpacked[0],
            'node_id': unpacked[1],
            'latitude': unpacked[2] / 10000000.0,
            'longitude': unpacked[3] / 10000000.0,
            'temperature': unpacked[4] / 100.0,
            'humidity': unpacked[5] / 100.0,
            'pressure': unpacked[6],
            'iaq': unpacked[7],
            'emergency': bool(unpacked[8]),
            'battery_mv': unpacked[9],
            'rssi': unpacked[10] - 128,
            'crc': unpacked[11]
        }
        return packet
    except Exception as e:
        print(f"Packet decode error: {e}")
        return None

def read_serial_data():
    while True:
        if ser and ser.in_waiting > 0:
            try:
                data = ser.read(25)
                if len(data) == 25:
                    packet = decode_lora_packet(data)
                    if packet:
                        process_packet(packet)
            except Exception as e:
                print(f"Serial read error: {e}")
        time.sleep(0.1)

def process_packet(packet):
    with app.app_context():
        node = Node.query.filter_by(node_id=packet['node_id']).first()
        if not node:
            node = Node(node_id=packet['node_id'], name=f"Node {packet['node_id']}")
            db.session.add(node)
        node.last_seen = datetime.utcnow()

        reading = SensorReading(
            node_id=packet['node_id'],
            latitude=packet['latitude'],
            longitude=packet['longitude'],
            temperature=packet['temperature'],
            humidity=packet['humidity'],
            pressure=packet['pressure'],
            iaq=packet['iaq'],
            battery_mv=packet['battery_mv'],
            rssi=packet['rssi'],
            emergency=packet['emergency']
        )
        db.session.add(reading)

        if packet['emergency']:
            alert = Alert(
                node_id=packet['node_id'],
                latitude=packet['latitude'],
                longitude=packet['longitude']
            )
            db.session.add(alert)
            trigger_siren()

        db.session.commit()

        socketio.emit('sensorUpdate', {
            'node_id': packet['node_id'],
            'timestamp': datetime.utcnow().isoformat(),
            'latitude': packet['latitude'],
            'longitude': packet['longitude'],
            'temperature': packet['temperature'],
            'humidity': packet['humidity'],
            'pressure': packet['pressure'],
            'iaq': packet['iaq'],
            'battery_mv': packet['battery_mv'],
            'rssi': packet['rssi'],
            'emergency': packet['emergency']
        }, broadcast=True)

def trigger_siren():
    if SIREN_ENABLED:
        GPIO.output(SIREN_PIN, GPIO.HIGH)
        threading.Timer(10.0, lambda: GPIO.output(SIREN_PIN, GPIO.LOW)).start()
    print("EMERGENCY ALERT!")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/nodes')
def get_nodes():
    nodes = Node.query.all()
    result = []
    for node in nodes:
        latest = SensorReading.query.filter_by(node_id=node.node_id).order_by(SensorReading.timestamp.desc()).first()
        result.append({
            'node_id': node.node_id,
            'name': node.name,
            'last_seen': node.last_seen.isoformat() if node.last_seen else None,
            'latest_data': {
                'latitude': latest.latitude if latest else None,
                'longitude': latest.longitude if latest else None,
                'temperature': latest.temperature if latest else None,
                'humidity': latest.humidity if latest else None,
                'pressure': latest.pressure if latest else None,
                'iaq': latest.iaq if latest else None,
                'battery_mv': latest.battery_mv if latest else None,
                'rssi': latest.rssi if latest else None,
                'emergency': latest.emergency if latest else False
            } if latest else {}
        })
    return jsonify(result)

@app.route('/api/alerts')
def get_alerts():
    alerts = Alert.query.filter_by(acknowledged=False).order_by(Alert.timestamp.desc()).all()
    return jsonify([{
        'id': alert.id,
        'node_id': alert.node_id,
        'timestamp': alert.timestamp.isoformat(),
        'latitude': alert.latitude,
        'longitude': alert.longitude
    } for alert in alerts])

@app.route('/api/alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    alert = Alert.query.get(alert_id)
    if alert:
        alert.acknowledged = True
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

@app.route('/api/history/<int:node_id>')
def get_history(node_id):
    limit = request.args.get('limit', 100, type=int)
    readings = SensorReading.query.filter_by(node_id=node_id).order_by(SensorReading.timestamp.desc()).limit(limit).all()
    return jsonify([{
        'timestamp': r.timestamp.isoformat(),
        'temperature': r.temperature,
        'humidity': r.humidity,
        'pressure': r.pressure,
        'iaq': r.iaq,
        'battery_mv': r.battery_mv,
        'rssi': r.rssi
    } for r in readings])

@app.route('/api/siren/control', methods=['POST'])
def control_siren():
    action = request.json.get('action')
    if SIREN_ENABLED:
        if action == 'on':
            GPIO.output(SIREN_PIN, GPIO.HIGH)
        elif action == 'off':
            GPIO.output(SIREN_PIN, GPIO.LOW)
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'GPIO not available'}), 400

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to LoRa Dashboard'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    init_serial()
    serial_thread = threading.Thread(target=read_serial_data, daemon=True)
    serial_thread.start()
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)
