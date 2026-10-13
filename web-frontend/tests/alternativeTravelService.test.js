import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAlternateTravelOptions } from '../src/services/alternativeTravelService.js';

test('AlternativeTravelService - fetchAlternateTravelOptions returns options with fallback resilience', async () => {
  const result = await fetchAlternateTravelOptions({
    from: 'Bangalore Cantt',
    to: 'KSR Bengaluru',
    distance: 4.2
  });

  assert.ok(result);
  assert.ok(Array.isArray(result.options));
  assert.ok(result.options.length >= 3);
  assert.ok(result.summary);
  assert.ok(result.options.some(o => o.category === 'Interstate Bus'));
  assert.ok(result.options.some(o => o.category === 'Intercity Cab'));
});

test('AlternativeTravelService - rejects missing from or to with meaningful error', async () => {
  await assert.rejects(
    async () => {
      await fetchAlternateTravelOptions({ from: '', to: '' });
    },
    /required/i
  );
});
