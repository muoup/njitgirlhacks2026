#include <Arduino.h>
#include <SPL07-003.h>
#include <Air_Quality_Sensor.h>
#include "../lib/Grove_I2C_Color_Sensor_TCS3472/Adafruit_TCS34725.h"
#include <WiFi.h>
#include "arduino_secrets.h"

/**
 * Parameters for soil sensor
 */
#define GREEN_LED 7 // Green LED connected to digital pin 2
#define YELLOW_LED 6 // Yellow LED connected to digital pin 3
#define RED_LED 5 // Red LED connected to digital pin 4
#define SOIL_SENSOR_PIN A0 // Soil moisture sensor connected to analog pin A5
// Defining soil moisture readings thresholds
// From 0 to 500 - extremely wet
// From 501 to 800 - wet
// From 801 - dry
#define DRY_THRESHOLD 800
#define WET_THRESHOLD 500

/**
 * Parameters for AQ sensor
 */
#define AQS_AIR_LOW 80
#define AQS_AIR_GOOD 50
#define AQS_AIR_HIGH 20

AirQualitySensor aqs(A1);

/**
 * Parameters for light sensor
 */
#define LIGHT_SENSOR_PIN A2

/**
 * Parameters for barometer
 */
// Define SPL07-006 I2C address
#define SPL07_ADDR (uint8_t) 0x77
// Create SPL07-003 sensor instance
SPL07_003 spl;

/**
 * Parameters for colour sensor
 */
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);

/**
 * Parameters for wireless module
 */
WiFiServer server(80);

void printMacAddress(byte mac[]) {
    for (int i = 0; i < 6; i++) {
        if (i > 0) {
            Serial.print(":");
        }
        if (mac[i] < 16) {
            Serial.print("0");
        }
        Serial.print(mac[i], HEX);
    }
    Serial.println();
}

void printWifiData() {
    // print your board's IP address:
    IPAddress ip = WiFi.localIP();
    Serial.print("IP Address: ");

    Serial.println(ip);

    // print your MAC address:
    byte mac[6];
    WiFi.macAddress(mac);
    Serial.print("MAC address: ");
    printMacAddress(mac);
}

void printCurrentNet() {
    // print the SSID of the network you're attached to:
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());

    // print the MAC address of the router you're attached to:
    byte bssid[6];
    WiFi.BSSID(bssid);
    Serial.print("BSSID: ");
    printMacAddress(bssid);

    // print the received signal strength:
    long rssi = WiFi.RSSI();
    Serial.print("signal strength (RSSI):");
    Serial.println(rssi);

    // print the encryption type:
    byte encryption = WiFi.encryptionType();
    Serial.print("Encryption Type:");
    Serial.println(encryption, HEX);
    Serial.println();
}

bool aqsStatus = false;
bool barometerStatus = false;
bool tcsStatus = false;
int wlStatus = WL_IDLE_STATUS;

void setup() {
    Serial.begin(9600);
    // write your initialization code here

    // Setup LED outputs
    pinMode(GREEN_LED, OUTPUT);
    pinMode(YELLOW_LED, OUTPUT);
    pinMode(RED_LED, OUTPUT);
    // Setup I2C
    Wire.begin();

    // set LEDs low
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(YELLOW_LED, LOW);
    digitalWrite(RED_LED, LOW);

    // Init colour sensor
    if (tcs.begin()) {
        tcsStatus = true;
    } else {
        tcsStatus = false;
        Serial.println("Error initializing TCS34725 :(");
    }

    // Init air quality sensor
    if (aqs.init()) {
        aqsStatus = true;
    } else {
        Serial.println("AQS init fail");
    }
    // Connect to SPL07-003
    if (spl.begin(SPL07_ADDR, &Wire) == false) {
        Serial.println("Error initializing SPL07-003 :(");
        barometerStatus = false;
    }//if
    else {
        barometerStatus = true;
        Serial.println("Connected to SPL07-003! :)");
    }
    // Set pressure & temperature sampling settings
    spl.setPressureConfig(SPL07_4HZ, SPL07_32SAMPLES);
    spl.setTemperatureConfig(SPL07_4HZ, SPL07_1SAMPLE);
    // Set SPL07-003 to continuous measurements
    spl.setMode(SPL07_CONT_PRES_TEMP);
    // check for the WiFi module:
    if (WiFi.status() == WL_NO_MODULE) {
        Serial.println("Communication with WiFi module failed!");
        // don't continue
        while (true);
    }
    String fv = WiFi.firmwareVersion();
    if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
        Serial.println("Please upgrade the firmware");
    }
    // attempt to connect to WiFi network:
    while (wlStatus != WL_CONNECTED) {
        Serial.print("Attempting to connect to WPA SSID: ");
        Serial.println(SECRET_SSID);
        // Connect to WPA/WPA2 network:
        wlStatus = WiFi.begin(SECRET_SSID, SECRET_PASS);

        // wait 10 seconds for connection:
        delay(10000);
    }
    // you're connected now, so print out the data:
    Serial.print("You're connected to the network");
    printCurrentNet();
    printWifiData();
}

// Tracks how often loops are called
unsigned long intervalTimer = 0;

void loop() {
    // write your code here
    if (millis() - intervalTimer > 1000) {
        /**
         * Poll soil sensor
         */
        int sensorValue = analogRead(SOIL_SENSOR_PIN);
        // Print the sensor reading values
        Serial.print("Soil moisture sensor value: ");
        Serial.println(sensorValue);

        if(sensorValue > 0 && sensorValue <= WET_THRESHOLD) {
            // Extremely wet (green LED)
            digitalWrite(GREEN_LED, HIGH);
            digitalWrite(YELLOW_LED, LOW);
            digitalWrite(RED_LED, LOW);
        } else if (sensorValue > WET_THRESHOLD && sensorValue <= DRY_THRESHOLD) {
            // Wet (yellow LED)
            digitalWrite(GREEN_LED, LOW);
            digitalWrite(YELLOW_LED, HIGH);
            digitalWrite(RED_LED, LOW);
        } else {
            // Extremely dry (red LED)
            digitalWrite(GREEN_LED, LOW);
            digitalWrite(YELLOW_LED, LOW);
            digitalWrite(RED_LED, HIGH);
        }

        // Poll AQS
        int quality = aqs.getValue();

        Serial.print("AQ sensor value: ");
        Serial.println(aqs.getValue());
        if (quality >= AQS_AIR_LOW) {
            Serial.println("Not enough CO2");
        } else if (quality >= AQS_AIR_GOOD) {
            Serial.println("CO2 output good");
        } else if (quality >= AQS_AIR_HIGH) {
            Serial.println("Excess CO2!");
        } else {
            Serial.println("AQ sensor reading invalid");
        }

        // Poll light sensor
        int lightLevel = analogRead(LIGHT_SENSOR_PIN);
        Serial.print("Light level: ");
        Serial.println(lightLevel);

        // Poll barometer
        // Wait for available reading
        if (spl.pressureAvailable() || spl.temperatureAvailable()) {
            // Read latest values
            double pres = spl.readPressure();
            double temp = spl.readTemperature();
            double altitude = spl.calcAltitude();
            // Print to serial
            Serial.print("Pres: ");
            Serial.print(pres, 3);
            Serial.print(" Pa, Temp: ");
            Serial.print(temp, 3);
            Serial.print(" C, Altitude: ");
            Serial.print(altitude, 3);
            Serial.println(" m");

            // Poll colour sensor
            uint16_t clear, red, green, blue;
            tcs.setInterrupt(false);      // turn on LED
            delay(60);  // takes 50ms to read
            tcs.getRawData(&red, &green, &blue, &clear);
            tcs.setInterrupt(true);  // turn off LED
            Serial.print("C:\t"); Serial.print(clear);
            Serial.print("\tR:\t"); Serial.print(red);
            Serial.print("\tG:\t"); Serial.print(green);
            Serial.print("\tB:\t"); Serial.print(blue);

            // Convert RGB values to hex
            uint32_t sum = clear;
            float r, g, b;
            r = red; r /= sum;
            g = green; g /= sum;
            b = blue; b /= sum;
            r *= 256; g *= 256; b *= 256;
            Serial.print("\t");
            Serial.print((int)r, HEX); Serial.print((int)g, HEX); Serial.print((int)b, HEX);
            Serial.println();
        }//if
        intervalTimer = millis();
    }
}