import http from "k6/http";
import { check, fail } from "k6";
import { farmServiceBase } from "./env.js";
import { parseJsonSafely, requireField } from "./json.js";

const CREATE_PROPERTY_PATH = "/api/properties";
const CREATE_PLOT_PATH = "/api/plots";
const CREATE_SENSOR_PATH = "/api/sensors";

export function createFarmFixture(session, timeout) {
  const base = farmServiceBase();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };

  const timestamp = Date.now();

  const propertyPayload = JSON.stringify({
    name: `Smoke Farm ${timestamp}`,
    address: `Road ${timestamp}`,
    city: "Sao Paulo",
    state: "SP",
    country: "Brazil",
    areaHectares: 120.5,
    latitude: -23.5505,
    longitude: -46.6333,
    ownerId: session.userId,
  });

  const propertyResponse = http.post(
    `${base}${CREATE_PROPERTY_PATH}`,
    propertyPayload,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-create-property" },
    },
  );

  check(propertyResponse, {
    "farm create property success": (r) => r.status === 201,
  });

  if (propertyResponse.status !== 201) {
    fail(
      `Farm create property failed with status ${propertyResponse.status}: ${(propertyResponse.body || "").substring(0, 300)}`,
    );
  }

  const propertyBody = parseJsonSafely(propertyResponse);
  const propertyId = requireField(
    propertyBody,
    ["id", "propertyId"],
    "Farm create property response missing property id.",
  );

  const plotPayload = JSON.stringify({
    propertyId,
    name: `Smoke Plot ${timestamp}`,
    cropType: "Soy",
    areaHectares: 20.1,
    plantingDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    expectedHarvestDate: new Date(
      Date.now() + 80 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    irrigationType: "Center Pivot",
    additionalNotes: "Smoke test plot",
    ownerId: session.userId,
  });

  const plotResponse = http.post(`${base}${CREATE_PLOT_PATH}`, plotPayload, {
    headers,
    timeout,
    tags: { endpoint: "farm-create-plot" },
  });

  check(plotResponse, {
    "farm create plot success": (r) => r.status === 201,
  });

  if (plotResponse.status !== 201) {
    fail(
      `Farm create plot failed with status ${plotResponse.status}: ${(plotResponse.body || "").substring(0, 300)}`,
    );
  }

  const plotBody = parseJsonSafely(plotResponse);
  const plotId = requireField(
    plotBody,
    ["id", "plotId"],
    "Farm create plot response missing plot id.",
  );

  const sensorPayload = JSON.stringify({
    plotId,
    type: "Temperature",
    label: `Smoke Sensor ${timestamp}`,
    ownerId: session.userId,
  });

  const sensorResponse = http.post(
    `${base}${CREATE_SENSOR_PATH}`,
    sensorPayload,
    {
      headers,
      timeout,
      tags: { endpoint: "farm-create-sensor" },
    },
  );

  check(sensorResponse, {
    "farm create sensor success": (r) => r.status === 201,
  });

  if (sensorResponse.status !== 201) {
    fail(
      `Farm create sensor failed with status ${sensorResponse.status}: ${(sensorResponse.body || "").substring(0, 300)}`,
    );
  }

  const sensorBody = parseJsonSafely(sensorResponse);
  const sensorId = requireField(
    sensorBody,
    ["id", "sensorId"],
    "Farm create sensor response missing sensor id.",
  );

  return {
    farmBase: base,
    propertyId,
    plotId,
    sensorId,
  };
}
