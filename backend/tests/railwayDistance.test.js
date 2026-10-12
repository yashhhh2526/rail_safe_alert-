const test = require('node:test');
const assert = require('node:assert/strict');
const { processTrainRouteDistances, estimateRailwayDistance, KNOWN_RAILWAY_SEGMENTS } = require('../services/railwayDistanceService');

test('Railway Distance Service - Known Railway Segments', () => {
  assert.equal(KNOWN_RAILWAY_SEGMENTS['SBC-BNC'], 4.2);
  assert.equal(KNOWN_RAILWAY_SEGMENTS['BNC-SBC'], 4.2);
  assert.equal(KNOWN_RAILWAY_SEGMENTS['NDLS-CNB'], 440.0);
  assert.equal(KNOWN_RAILWAY_SEGMENTS['MMCT-BVI'], 30.0);
});

test('Railway Distance Service - Monotonic distance calculation on route', () => {
  const sampleStations = [
    { name: 'KSR Bengaluru', code: 'SBC', coords: { lat: 12.9781, lng: 77.5696 } },
    { name: 'Bangalore Cantt', code: 'BNC', coords: { lat: 12.9934, lng: 77.5985 } },
    { name: 'Krishnarajapuram', code: 'KJM', coords: { lat: 13.0012, lng: 77.6775 } },
    { name: 'Bangarapet Jn', code: 'BWT', coords: { lat: 12.9984, lng: 78.1994 } }
  ];

  const processed = processTrainRouteDistances(sampleStations, 'TestTrain-101');

  assert.equal(processed.length, 4);

  // Check 1: Origin distance is 0
  assert.equal(processed[0].distanceFromOrigin, 0);
  assert.equal(processed[0].distanceFromPrevious, 0);

  // Check 2: Known segment SBC-BNC is 4.2 km
  assert.equal(processed[1].distanceFromPrevious, 4.2);
  assert.equal(processed[1].distanceFromOrigin, 4.2);

  // Check 3: Cumulative distance monotonically increases
  for (let i = 1; i < processed.length; i++) {
    assert.ok(processed[i].distanceFromOrigin >= processed[i - 1].distanceFromOrigin);
    assert.ok(processed[i].distanceFromPrevious >= 0);
  }

  // Check 4: Final station has distanceRemaining = 0
  const last = processed[processed.length - 1];
  assert.equal(last.distanceRemaining, 0);
  assert.equal(last.distanceRemainingKm, 0);
});

test('Railway Distance Service - Straight-line fallback with tortuosity factor', () => {
  const c1 = { lat: 12.9781, lng: 77.5696 };
  const c2 = { lat: 13.0827, lng: 80.2707 }; // Bangalore to Chennai
  const dist = estimateRailwayDistance(c1, c2);

  assert.ok(dist > 250 && dist < 450, `Expected distance between 250 and 450 km, got ${dist}`);
});
