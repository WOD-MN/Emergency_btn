/*
 * LoRa Highway Emergency Node
 * Heltec LoRa32 V3 + BME680 + Emergency Button
 * 
 * Hardware Connections:
 * - BME680: I2C (SDA=GPIO21, SCL=GPIO22)
 * - Emergency Button: GPIO13 (pullup enabled)
 * - Battery Voltage: GPIO1 (ADC, voltage divider)
 */

#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_BME680.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>

// LoRa pins for Heltec LoRa32 V3
#define LORA_SCK 9
#define LORA_MISO 11
#define LORA_MOSI 10
#define LORA_CS 8
#define LORA_RST 12
#define LORA_DIO0 14

// Pin definitions
#define EMERGENCY_BUTTON 13
#define BATTERY_ADC 1
#define GPS_RX 44
#define GPS_TX 43

// Node configuration
#define NODE_ID 1  // Change for each node
#define LORA_FREQUENCY 915E6  // 915MHz for US, 868E6 for Europe
#define TRANSMIT_INTERVAL 600000  // 10 minutes in ms
#define EMERGENCY_HOLD_TIME 10000  // 10 seconds

// Sensors
Adafruit_BME680 bme;
TinyGPSPlus gps;
HardwareSerial GPS_Serial(1);

// Packet structure (25 bytes)
struct __attribute__((packed)) LoRaPacket {
    uint8_t header;
    uint16_t node_id;
    int32_t latitude;
    int32_t longitude;
    int16_t temperature;
    uint16_t humidity;
    uint16_t pressure;
    uint16_t iaq;
    uint8_t emergency;
    uint16_t battery_mv;
    uint8_t rssi;
    uint16_t crc;
};

// Variables
unsigned long lastTransmit = 0;
unsigned long buttonPressStart = 0;
bool emergencyActive = false;

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("LoRa Emergency Node Starting...");

    // Initialize pins
    pinMode(EMERGENCY_BUTTON, INPUT_PULLUP);

    // Initialize I2C
    Wire.begin(21, 22);

    // Initialize BME680
    if (!bme.begin(0x76)) {
        Serial.println("BME680 not found!");
        while (1);
    }
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(320, 150);

    // Initialize GPS
    GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

    // Initialize LoRa
    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
    LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("LoRa init failed!");
        while (1);
    }

    // Configure LoRa for long range
    LoRa.setSpreadingFactor(12);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);
    LoRa.setTxPower(20);

    Serial.println("Initialization complete!");
    Serial.printf("Node ID: %d\n", NODE_ID);
}

void loop() {
    // Update GPS
    while (GPS_Serial.available() > 0) {
        gps.encode(GPS_Serial.read());
    }

    // Check emergency button
    checkEmergencyButton();

    // Regular transmission interval
    if (millis() - lastTransmit >= TRANSMIT_INTERVAL || emergencyActive) {
        sendLoRaPacket();
        lastTransmit = millis();

        if (emergencyActive) {
            emergencyActive = false;  // Reset after sending
        }

        // Enter deep sleep until next transmission
        enterDeepSleep();
    }
}

void checkEmergencyButton() {
    if (digitalRead(EMERGENCY_BUTTON) == LOW) {
        if (buttonPressStart == 0) {
            buttonPressStart = millis();
        }

        if (millis() - buttonPressStart >= EMERGENCY_HOLD_TIME) {
            Serial.println("EMERGENCY TRIGGERED!");
            emergencyActive = true;
            buttonPressStart = 0;
        }
    } else {
        buttonPressStart = 0;
    }
}

void sendLoRaPacket() {
    LoRaPacket packet;

    // Read BME680
    if (bme.performReading()) {
        packet.header = 0x01;
        packet.node_id = NODE_ID;

        // GPS coordinates (multiply by 10^7)
        if (gps.location.isValid()) {
            packet.latitude = (int32_t)(gps.location.lat() * 10000000);
            packet.longitude = (int32_t)(gps.location.lng() * 10000000);
        } else {
            packet.latitude = 0;
            packet.longitude = 0;
        }

        // Environmental data
        packet.temperature = (int16_t)(bme.temperature * 100);
        packet.humidity = (uint16_t)(bme.humidity * 100);
        packet.pressure = (uint16_t)bme.pressure / 100;
        packet.iaq = (uint16_t)(bme.gas_resistance / 1000);  // Simplified IAQ

        // Status
        packet.emergency = emergencyActive ? 1 : 0;
        packet.battery_mv = readBatteryVoltage();
        packet.rssi = 0;  // Updated at receiver

        // Calculate CRC
        packet.crc = calculateCRC16((uint8_t*)&packet, sizeof(packet) - 2);

        // Transmit
        LoRa.beginPacket();
        LoRa.write((uint8_t*)&packet, sizeof(packet));
        LoRa.endPacket();

        Serial.println("Packet sent:");
        Serial.printf("Temp: %.2f°C, Hum: %.2f%%, Press: %d hPa\n", 
                      bme.temperature, bme.humidity, (int)packet.pressure);
        Serial.printf("Lat: %.6f, Lon: %.6f\n", 
                      packet.latitude/10000000.0, packet.longitude/10000000.0);
        Serial.printf("Emergency: %d, Battery: %dmV\n", packet.emergency, packet.battery_mv);
    }
}

uint16_t readBatteryVoltage() {
    // Read battery voltage via ADC with voltage divider
    uint32_t adc = analogRead(BATTERY_ADC);
    // Assuming 2:1 voltage divider, 3.3V ref, 12-bit ADC
    uint16_t voltage = (adc * 3300 * 2) / 4095;
    return voltage;
}

uint16_t calculateCRC16(uint8_t* data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc = crc >> 1;
            }
        }
    }
    return crc;
}

void enterDeepSleep() {
    Serial.println("Entering deep sleep...");
    delay(100);

    // Wake on timer or button press
    esp_sleep_enable_timer_wakeup(TRANSMIT_INTERVAL * 1000);
    esp_sleep_enable_ext0_wakeup((gpio_num_t)EMERGENCY_BUTTON, 0);

    LoRa.sleep();
    esp_deep_sleep_start();
}
