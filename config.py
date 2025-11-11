# Configuration for LoRa Dashboard

# Serial Port Settings
SERIAL_PORT = '/dev/serial0'  # Change to COM port on Windows (e.g., 'COM3')
SERIAL_BAUDRATE = 115200

# Database
DATABASE_URI = 'sqlite:///lora_data.db'

# GPIO Settings (Raspberry Pi only)
ENABLE_GPIO = True
SIREN_GPIO_PIN = 17

# LoRa Parameters (for reference)
LORA_FREQUENCY = 915  # MHz (915 for US, 868 for EU)
LORA_SPREADING_FACTOR = 12
LORA_BANDWIDTH = 125  # kHz
LORA_CODING_RATE = 8

# Map Settings
DEFAULT_MAP_CENTER = [27.7, 85.3]  # [latitude, longitude]
DEFAULT_MAP_ZOOM = 12

# Data Retention
MAX_SENSOR_READINGS_PER_NODE = 10000  # Limit database size
AUTO_DELETE_OLD_DATA_DAYS = 90

# Alert Settings
ALERT_SOUND_ENABLED = True
SIREN_AUTO_OFF_SECONDS = 10
