/**
 * TC Agro Solutions - k6 Sensor Feed Script
 * ===========================================
 * Simulates IoT sensors continuously sending readings to the Sensor Ingest API.
 *
 * Prerequisites:
 *   - Services running (docker compose up)
 *   - At least one sensor created via Farm Service (test-stack.sh --seed)
 *
 * Usage:
 *   # Default: 5 VUs, 2 minutes, 1 reading/sec per VU
 *   k6 run scripts/k6-sensor-feed.js
 *
 *   # Custom duration and VUs
 *   k6 run --vus 10 --duration 5m scripts/k6-sensor-feed.js
 *
 *   # Override service URLs
 *   k6 run -e SENSOR_URL=http://localhost:5003 \
 *          -e IDENTITY_URL=http://localhost:5001 \
 *          scripts/k6-sensor-feed.js
 *
 *   # Use batch endpoint (sends 10 readings per request)
 *   k6 run -e MODE=batch scripts/k6-sensor-feed.js
 *
 *   # Custom credentials
 *   k6 run -e EMAIL=admin@test.com -e PASSWORD=Admin@123 scripts/k6-sensor-feed.js
 *
 *   # Higher throughput stress test
 *   k6 run --vus 20 --duration 10m -e INTERVAL=200 scripts/k6-sensor-feed.js
 */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SENSOR_URL = __ENV.SENSOR_URL || 'http://localhost:5003';
const IDENTITY_URL = __ENV.IDENTITY_URL || 'http://localhost:5001';
const FARM_URL = __ENV.FARM_URL || 'http://localhost:5002';
const EMAIL = __ENV.EMAIL || 'producer@test.com';
const PASSWORD = __ENV.PASSWORD || 'Test@123456';
const MODE = __ENV.MODE || 'single'; // 'single' or 'batch'
const BATCH_SIZE = parseInt(__ENV.BATCH_SIZE || '10');
const INTERVAL_MS = parseInt(__ENV.INTERVAL || '1000'); // ms between readings

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const readingsAccepted = new Counter('readings_accepted');
const readingsRejected = new Counter('readings_rejected');
const readingLatency = new Trend('reading_latency_ms');
const successRate = new Rate('reading_success_rate');

// =============================================================================
// k6 OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    sensor_feed: {
      executor: 'constant-vus',
      vus: parseInt(__ENV.VUS || '5'),
      duration: __ENV.DURATION || '2m',
    },
  },
  thresholds: {
    reading_success_rate: ['rate>0.95'],       // 95% success rate
    reading_latency_ms: ['p(95)<500'],         // p95 latency < 500ms
    http_req_duration: ['p(99)<2000'],         // p99 < 2s
  },
};

// =============================================================================
// SENSOR SIMULATION HELPERS
// =============================================================================

/**
 * Simulates realistic sensor metrics with gradual drift and noise.
 * Each VU maintains its own sensor state across iterations.
 */
class SensorSimulator {
  constructor(sensorId, plotId) {
    this.sensorId = sensorId;
    this.plotId = plotId;
    // Base values with some per-sensor variation
    this.baseTemp = 22 + Math.random() * 10;       // 22-32°C base
    this.baseHumidity = 45 + Math.random() * 25;    // 45-70% base
    this.baseSoilMoisture = 30 + Math.random() * 20; // 30-50% base
    this.battery = 80 + Math.random() * 20;          // 80-100% start
    this.tick = 0;
  }

  generateReading() {
    this.tick++;

    // Simulate diurnal temperature cycle (±5°C sine wave)
    const hourAngle = (this.tick % 360) * (Math.PI / 180);
    const diurnalShift = Math.sin(hourAngle) * 5;

    // Add random noise
    const tempNoise = (Math.random() - 0.5) * 2;
    const humNoise = (Math.random() - 0.5) * 5;
    const soilNoise = (Math.random() - 0.5) * 3;

    // Gradual battery drain
    this.battery = Math.max(5, this.battery - (0.01 + Math.random() * 0.02));

    // Occasional rainfall (5% chance per reading)
    const rainfall = Math.random() < 0.05 ? Math.random() * 15 : null;

    // If it rains, soil moisture increases
    if (rainfall) {
      this.baseSoilMoisture = Math.min(90, this.baseSoilMoisture + rainfall * 0.5);
    } else {
      // Slow drying
      this.baseSoilMoisture = Math.max(15, this.baseSoilMoisture - 0.05);
    }

    return {
      sensorId: this.sensorId,
      plotId: this.plotId,
      timestamp: new Date().toISOString(),
      temperature: clamp(this.baseTemp + diurnalShift + tempNoise, -50, 70),
      humidity: clamp(this.baseHumidity + humNoise - diurnalShift * 0.5, 0, 100),
      soilMoisture: clamp(this.baseSoilMoisture + soilNoise, 0, 100),
      rainfall: rainfall,
      batteryLevel: clamp(this.battery, 0, 100),
    };
  }
}

function clamp(value, min, max) {
  return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
}

// =============================================================================
// SETUP - Runs once before VUs start
// =============================================================================

export function setup() {
  console.log(`\n=== TC Agro - k6 Sensor Feed ===`);
  console.log(`Mode: ${MODE} | Interval: ${INTERVAL_MS}ms | Batch size: ${BATCH_SIZE}`);
  console.log(`Sensor Ingest: ${SENSOR_URL}`);
  console.log(`Identity: ${IDENTITY_URL}\n`);

  // 1. Login
  const loginRes = http.post(
    `${IDENTITY_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const loginOk = check(loginRes, {
    'login: status 200': (r) => r.status === 200,
    'login: has token': (r) => {
      try { return !!JSON.parse(r.body).jwtToken; } catch { return false; }
    },
  });

  if (!loginOk) {
    console.error(`Login failed (${loginRes.status}): ${loginRes.body}`);
    console.error('Make sure services are running and user exists (run test-stack.sh --seed first)');
    fail('Login failed');
  }

  const token = JSON.parse(loginRes.body).jwtToken;
  console.log(`Authenticated as ${EMAIL}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Get sensors from Sensor Ingest
  const sensorsRes = http.get(`${SENSOR_URL}/api/sensors?pageSize=100`, {
    headers: authHeaders,
  });

  let sensors = [];
  if (sensorsRes.status === 200) {
    try {
      const body = JSON.parse(sensorsRes.body);
      sensors = (body.data || []).map((s) => ({
        id: s.sensorId || s.id,
        plotId: s.plotId,
        plotName: s.plotName,
      }));
    } catch (e) {
      console.warn(`Failed to parse sensors response: ${e}`);
    }
  }

  if (sensors.length === 0) {
    // Try listing from Farm service as fallback
    console.warn('No sensors found in Sensor Ingest. Trying Farm service...');
    const farmSensorsRes = http.get(`${FARM_URL}/api/sensors?pageSize=100`, {
      headers: authHeaders,
    });

    if (farmSensorsRes.status === 200) {
      try {
        const body = JSON.parse(farmSensorsRes.body);
        const farmSensors = body.data || body;
        sensors = (Array.isArray(farmSensors) ? farmSensors : []).map((s) => ({
          id: s.id,
          plotId: s.plotId,
          plotName: s.plotName || 'Unknown',
        }));
      } catch (e) {
        console.warn(`Failed to parse farm sensors: ${e}`);
      }
    }
  }

  if (sensors.length === 0) {
    console.error('\nNo sensors found! Create sensors first:');
    console.error('  ./scripts/test-stack.sh --seed');
    fail('No sensors available');
  }

  console.log(`\nFound ${sensors.length} sensor(s):`);
  sensors.forEach((s) => console.log(`  - ${s.id} (plot: ${s.plotName})`));
  console.log('');

  return { token, sensors };
}

// =============================================================================
// VU CODE - Runs for each virtual user
// =============================================================================

export default function (data) {
  const { token, sensors } = data;

  // Each VU picks a sensor based on its VU ID (round-robin)
  const sensorIdx = (__VU - 1) % sensors.length;
  const sensor = sensors[sensorIdx];

  // Initialize simulator (persists across iterations via closure hack)
  if (!globalThis.__simulators) {
    globalThis.__simulators = {};
  }
  if (!globalThis.__simulators[__VU]) {
    globalThis.__simulators[__VU] = new SensorSimulator(sensor.id, sensor.plotId);
  }
  const sim = globalThis.__simulators[__VU];

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (MODE === 'batch') {
    sendBatchReading(sim, headers);
  } else {
    sendSingleReading(sim, headers);
  }

  // Wait before next reading
  sleep(INTERVAL_MS / 1000);
}

// =============================================================================
// SEND FUNCTIONS
// =============================================================================

function sendSingleReading(sim, headers) {
  const reading = sim.generateReading();

  const res = http.post(`${SENSOR_URL}/api/readings`, JSON.stringify(reading), {
    headers,
    tags: { endpoint: 'POST /api/readings' },
  });

  const ok = check(res, {
    'reading: status 200-202': (r) => r.status >= 200 && r.status < 300,
  });

  readingLatency.add(res.timings.duration);

  if (ok) {
    readingsAccepted.add(1);
    successRate.add(1);
  } else {
    readingsRejected.add(1);
    successRate.add(0);
    if (__ITER < 3) {
      // Log first few errors for debugging
      console.warn(`[VU${__VU}] Reading rejected (${res.status}): ${res.body}`);
    }
  }
}

function sendBatchReading(sim, headers) {
  const readings = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    readings.push(sim.generateReading());
    // Small time offset per reading in batch
    sleep(0.01);
  }

  const payload = JSON.stringify({ readings });

  const res = http.post(`${SENSOR_URL}/api/readings/batch`, payload, {
    headers,
    tags: { endpoint: 'POST /api/readings/batch' },
  });

  const ok = check(res, {
    'batch: status 200-202': (r) => r.status >= 200 && r.status < 300,
  });

  readingLatency.add(res.timings.duration);

  if (ok) {
    try {
      const body = JSON.parse(res.body);
      readingsAccepted.add(body.processedCount || BATCH_SIZE);
      readingsRejected.add(body.failedCount || 0);
      successRate.add(body.failedCount === 0 ? 1 : 0);
    } catch {
      readingsAccepted.add(BATCH_SIZE);
      successRate.add(1);
    }
  } else {
    readingsRejected.add(BATCH_SIZE);
    successRate.add(0);
    if (__ITER < 3) {
      console.warn(`[VU${__VU}] Batch rejected (${res.status}): ${res.body}`);
    }
  }
}

// =============================================================================
// TEARDOWN
// =============================================================================

export function teardown(data) {
  console.log('\n=== Sensor Feed Complete ===');
  console.log(`Sensors used: ${data.sensors.length}`);
  console.log(`Mode: ${MODE}`);
  console.log('Check Grafana at http://localhost:3000 for metrics.');
  console.log('Check the frontend at http://localhost:5010 to see the data.\n');
}
