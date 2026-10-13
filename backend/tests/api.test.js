const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('API Health Endpoint returns status ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'RailSafe API');
});

test('API Train Search with valid query returns matching results', async () => {
  const res = await fetch(`${baseUrl}/api/trains/search?query=12951`);
  assert.equal(res.status, 200);
  const trains = await res.json();
  assert.ok(Array.isArray(trains));
  assert.ok(trains.length > 0);
  assert.equal(trains[0].trainNumber, '12951');
});

test('API Train Search rejects missing query parameter', async () => {
  const res = await fetch(`${baseUrl}/api/trains/search`);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.msg);
});

test('API Auth Register rejects invalid email and short password', async () => {
  // Test invalid email
  const res1 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'invalid-email', password: 'secretpassword' })
  });
  assert.equal(res1.status, 400);

  // Test short password
  const res2 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', email: 'test@example.com', password: '123' })
  });
  assert.equal(res2.status, 400);
});

test('API Auth Login rejects empty credentials', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
});

test('API 404 handler returns structured JSON for unknown routes', async () => {
  const res = await fetch(`${baseUrl}/api/unknown/endpoint/does_not_exist`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.success, false);
});

test('API Alternative Travel Options returns multi-modal alternatives for route', async () => {
  const res = await fetch(`${baseUrl}/api/trains/alternatives?from=New+Delhi&to=Varanasi&distance=750`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data);
  assert.ok(Array.isArray(json.data.options));
  assert.ok(json.data.options.length >= 3);
  assert.ok(json.data.options.some(o => o.category === 'Interstate Bus'));
  assert.ok(json.data.options.some(o => o.category === 'Intercity Cab'));
});

test('API Alternative Travel Options rejects missing from or to query parameters', async () => {
  const res = await fetch(`${baseUrl}/api/trains/alternatives`);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
});

