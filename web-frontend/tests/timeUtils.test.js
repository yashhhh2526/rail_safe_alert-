import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToIsoIST, calculateLiveETA, formatTimeWithContext, isRouteStationPassed } from '../src/utils/timeUtils.js';

test('TimeUtils - normalizeToIsoIST parses plain time string with IST offset', () => {
  const normalized = normalizeToIsoIST('10:30 AM', '2026-10-15');
  assert.ok(normalized);
  const d = new Date(normalized);
  assert.ok(!isNaN(d.getTime()));
});

test('TimeUtils - normalizeToIsoIST preserves existing ISO datetimes', () => {
  const iso = '2026-10-15T14:30:00.000Z';
  const result = normalizeToIsoIST(iso);
  assert.equal(result, iso);
});

test('TimeUtils - calculateLiveETA adds delay correctly when delay > 0', () => {
  const schedTime = '2026-10-15T10:00:00.000Z';
  const station = {
    scheduledArrival: schedTime,
    delayMinutes: 20
  };

  const etaIso = calculateLiveETA(station, 20);
  assert.ok(etaIso);
  const diffMinutes = (new Date(etaIso).getTime() - new Date(schedTime).getTime()) / (60 * 1000);
  assert.equal(diffMinutes, 20);
});

test('TimeUtils - isRouteStationPassed flags passed stations accurately', () => {
  assert.equal(isRouteStationPassed({ status: 'PASSED' }), true);
  assert.equal(isRouteStationPassed({ actualArrival: '2026-10-15T09:00:00Z' }), true);
  assert.equal(isRouteStationPassed({ cumulativeDistanceKm: 50 }, null, 100), true);
  assert.equal(isRouteStationPassed({ cumulativeDistanceKm: 150 }, null, 100), false);
});

test('TimeUtils - formatTimeWithContext handles valid timestamps and dashes for empty', () => {
  assert.equal(formatTimeWithContext(null), '—');
  assert.equal(formatTimeWithContext(''), '—');
  const formatted = formatTimeWithContext('2026-10-15T10:30:00.000Z');
  assert.ok(formatted && formatted !== '—');
});
