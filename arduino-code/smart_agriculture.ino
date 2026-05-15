#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "DHT.h"
#include "time.h"

// -------- CONFIG --------
#define WIFI_SSID "moto g35 5G_7772"
#define WIFI_PASSWORD "aartim12"

#define API_KEY "AIzaSyCVmnzXsLivk6wnQZHrpM5C5n1eCRyfIPA"
#define DATABASE_URL "https://fir-b8587-default-rtdb.asia-southeast1.firebasedatabase.app/"

#define DHTPIN 4       // GPIO4 for DHT22 data
#define DHTTYPE DHT22
#define SOIL_PIN 34    // GPIO34 analog input

DHT dht(DHTPIN, DHTTYPE);

// Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Time (NTP for timestamps)
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // +5:30 IST
const int daylightOffset_sec = 0;

unsigned long getTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return 0;
  }
  time(&now);
  return now * 1000ULL; // ms
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  // WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected, IP: " + WiFi.localIP().toString());

  // NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.print("Syncing time");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\n✅ Time synced!");

  // Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✅ Firebase signUp OK");
  } else {
    Serial.printf("❌ Firebase signUp failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("✅ Firebase connected");
}

void loop() {
  // Read DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // Soil moisture (as %)
  int soilRaw = analogRead(SOIL_PIN);
  float soilPercent = map(soilRaw, 0, 4095, 100, 0);

  if (isnan(t) || isnan(h)) {
    Serial.println("❌ Failed to read from DHT22!");
    delay(2000);
    return;
  }

  Serial.printf("T=%.1f°C  H=%.1f%%  Soil=%.0f%%\n", t, h, soilPercent);

  // -------- Realtime paths (keep existing ones) --------
  Firebase.RTDB.setFloat(&fbdo, "/Sensors/DHT22/temperature", t);
  Firebase.RTDB.setFloat(&fbdo, "/Sensors/DHT22/humidity", h);
  Firebase.RTDB.setFloat(&fbdo, "/Sensors/SoilMoisture/percent", soilPercent);

  // -------- History path --------
  unsigned long ts = getTime();
  if (ts > 0) {
    FirebaseJson json;
    json.set("ts", (long long)ts);
    json.set("t", t);
    json.set("h", h);
    json.set("s", soilPercent);
    Firebase.RTDB.pushJSON(&fbdo, "/History/readings", &json);
  } else {
    Serial.println("⚠️ Skipping history (no valid time yet)");
  }

  delay(5000); // every 10s
}
