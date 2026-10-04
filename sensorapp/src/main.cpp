#include <Arduino.h>
#include <SPL07-003.h>
#include <Air_Quality_Sensor.h>
#include "../lib/Grove_I2C_Color_Sensor_TCS3472/Adafruit_TCS34725.h"
#include <WiFi.h>
#include "arduino_secrets.h"
#include "NTPClient.h"

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
//IPAddress serverIP(20,121,136,26);
char server[] = "loamgnome.garden";
int port = 3001;
WiFiClient client;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);

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

    // Update RTC
    timeClient.begin();
    timeClient.update();

    // Connect to webserver
    Serial.print("\nStarting connection to server ");
    Serial.println(server);
    // if you get a connection, report back via serial:

    if (client.connect(server, port)) {
        Serial.println("connected to server");
    } else {
        Serial.println("Initial connection check failed (will retry in loop)");
    }
}

/* just wrap the received data up to 80 columns in the serial print*/
/* -------------------------------------------------------------------------- */
void read_response() {
    /* -------------------------------------------------------------------------- */
    unsigned long timeout = millis();
    while (client.connected() && !client.available()) {
        if (millis() - timeout > 5000) {
            Serial.println(">>> Client Timeout !");
            client.stop();
            return;
        }
        delay(10);
    }

    uint32_t received_data_num = 0;
    while (client.connected() || client.available()) {
        if (client.available()) {
            /* actual data reception */
            char c = client.read();
            /* print data to serial port */
            Serial.print(c);
            /* wrap data to 80 columns*/
            received_data_num++;
            if (received_data_num % 80 == 0) {
                Serial.println();
            }
            timeout = millis();
        } else if (millis() - timeout > 2000) {
            break;
        }
    }
    Serial.println();
    client.stop();
}

// Tracks how often loops are called
unsigned long intervalTimer = 0;

void loop() {
    // write your code here
    if (millis() - intervalTimer > 15000) {
        /**
         * Poll soil sensor
         */
        int soilRawValue = analogRead(SOIL_SENSOR_PIN);
        // Print the sensor reading values
        Serial.print("Soil moisture sensor value: ");
        Serial.println(soilRawValue);

        if(soilRawValue > 0 && soilRawValue <= WET_THRESHOLD) {
            // Extremely wet (green LED)
            digitalWrite(GREEN_LED, HIGH);
            digitalWrite(YELLOW_LED, LOW);
            digitalWrite(RED_LED, LOW);
        } else if (soilRawValue > WET_THRESHOLD && soilRawValue <= DRY_THRESHOLD) {
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

        Serial.print("AQS\t");
        Serial.print(aqs.getValue());
        if (quality >= AQS_AIR_LOW) {
            Serial.println("\tCO2 LOW");
        } else if (quality >= AQS_AIR_GOOD) {
            Serial.println("\tCO2 OK");
        } else if (quality >= AQS_AIR_HIGH) {
            Serial.println("\tCO2 HI");
        } else {
            Serial.println("\tINOP");
        }

        // Poll light sensor
        int lightLevel = analogRead(LIGHT_SENSOR_PIN);
        Serial.print("Light level: ");
        Serial.println(lightLevel);

        // Poll barometer
        double pres = 0.0;
        double temp = 0.0;
        double altitude = 0.0;
        // Wait for available reading
        if (spl.pressureAvailable() || spl.temperatureAvailable()) {
            // Read latest values
            pres = spl.readPressure();
            temp = spl.readTemperature();
            altitude = spl.calcAltitude();
            // Print to serial
            Serial.print("Pres: ");
            Serial.print(pres, 3);
            Serial.print(" Pa, Temp: ");
            Serial.print(temp, 3);
            Serial.print(" C, Altitude: ");
            Serial.print(altitude, 3);
            Serial.println(" m");
        }//if

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

        // Make a HTTP request
        String requestBody = R"({"sampleId": ")"
        + String(BEARER_TOKEN).substring(48, 56)
        + String(timeClient.getDay())
        + String(timeClient.getHours())
        + String(timeClient.getMinutes())
        + String(timeClient.getSeconds())
        + R"(","measurements": [{"metric":"soil_moisture_raw","unit":"ADC","value":)" +
            String(soilRawValue) + R"(},{"metric":"light_level_raw","unit":"ADC","value":)" +
                String(lightLevel) + R"(},{"metric":"temperature","unit":"°C","value":)" +
                    String(temp) + R"(},{"metric":"air_quality_raw","unit":"raw","value":)" +
                        String(aqs.getValue()) + R"(},{"metric":"pressure","unit":"Pa","value":)" +
                            String(pres) + R"(},{"metric":"altitude","unit":"m","value":)" +
                                String(altitude) + R"(}],"color":"#)" +
                                    String(static_cast<int>(r), HEX) +
                                        String(static_cast<int>(g), HEX) +
                                            String(static_cast<int>(b), HEX) + R"("})";
        Serial.println(requestBody);

        if (client.connect(server, port)) {
            client.println("POST /api/v1/ingest/readings HTTP/1.1");
            client.print("Authorization: Bearer ");
            client.println(BEARER_TOKEN);
            client.print("Host: ");
            client.println(server);
            client.println("Connection: close");
            client.println("Content-type: application/json");
            client.print("Content-length: ");
            client.println(requestBody.length());
            client.println();
            client.println(requestBody);

            // Await and print response
            read_response();
        } else {
            Serial.println("Connection to server failed");
        }

        intervalTimer = millis();
    }
}