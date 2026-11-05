import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { app } from '../src/app.js';
import { buses } from '../src/buses.js';

test('GPS updates enforce per-bus authorization and preserve data on every rejected request', async (t) => {
  const tokenKey = 'TRACKER_TOKEN_DEMO_BUS_01';
  const originalToken = process.env[tokenKey];
  const otherTokenKey = 'TRACKER_TOKEN_DEMO_BUS_02';
  const originalOtherToken = process.env[otherTokenKey];
  const originalBus = { ...buses[0] };
  const otherBus = { ...buses[1] };
  const token = 'test-only-bus-one-token-12345678901234567890';
  const otherToken = 'test-only-bus-two-token-12345678901234567890';
  process.env[tokenKey] = token;
  process.env[otherTokenKey] = otherToken;
  t.after(() => {
    Object.assign(buses[0], originalBus);
    if (originalToken === undefined) delete process.env[tokenKey];
    else process.env[tokenKey] = originalToken;
    if (originalOtherToken === undefined) delete process.env[otherTokenKey];
    else process.env[otherTokenKey] = originalOtherToken;
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = `${base}/buses/demo-bus-01/location`;
  const valid = { latitude: 23.799, longitude: 90.371, recordedAt: new Date(Date.now() - 1000).toISOString() };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function rejectUpdate(status, body, requestHeaders = headers, url = endpoint) {
    const before = structuredClone(buses);
    const response = await fetch(url, { method: 'POST', headers: requestHeaders, body: typeof body === 'string' ? body : JSON.stringify(body) });
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(typeof (await response.json()).error, 'string');
    assert.deepEqual(buses, before, 'Rejected input must never change bus readings');
    return response;
  }

  await t.test('missing, wrong and other-bus tokens cannot write; missing configuration fails closed', async () => {
    const missing = await rejectUpdate(401, valid, { 'Content-Type': 'application/json' });
    assert.equal(missing.headers.get('www-authenticate'), 'Bearer');
    await rejectUpdate(401, valid, { ...headers, Authorization: `Bearer ${otherToken}` });
    await rejectUpdate(401, valid, headers, `${base}/buses/demo-bus-02/location`);
    await rejectUpdate(404, valid, headers, `${base}/buses/unknown/location`);
    delete process.env[tokenKey];
    await rejectUpdate(503, valid);
    process.env[tokenKey] = 'short';
    await rejectUpdate(503, valid);
    process.env[tokenKey] = token;
  });

  await t.test('invalid JSON, content types, oversized bodies and invalid fields are rejected', async () => {
    await rejectUpdate(400, '{');
    await rejectUpdate(415, valid, { ...headers, 'Content-Type': 'text/plain' });
    await rejectUpdate(413, { ...valid, padding: 'x'.repeat(1100) });
    for (const body of [null, [], {}, { ...valid, latitude: '23.799' },
      { ...valid, latitude: 90.01 }, { ...valid, latitude: -90.01 },
      { ...valid, longitude: 180.01 }, { ...valid, longitude: -180.01 },
      { ...valid, latitude: null }, { ...valid, routeId: 'another-route' },
      { latitude: 0, longitude: 0 }, { ...valid, recordedAt: 123 },
      { ...valid, recordedAt: 'not-a-date' },
      { ...valid, recordedAt: '2026-02-30T10:00:00.000Z' },
      { ...valid, recordedAt: new Date(Date.now() + 60_000).toISOString() }]) {
      await rejectUpdate(400, body);
    }
  });

  await t.test('valid updates are visible on reads; duplicate and older readings cannot overwrite them', async () => {
    const payload = { ...valid, latitude: 90, longitude: -180 };
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.dataMode, 'simulated');
    assert.equal(saved.bus.latitude, 90);
    assert.equal(saved.bus.longitude, -180);
    assert.equal(saved.bus.lastUpdated, payload.recordedAt);
    assert.equal(saved.bus.isStale, false);
    const read = await (await fetch(`${base}/routes/demo-mirpur-farmgate/buses`)).json();
    assert.deepEqual(read.buses[0], saved.bus);
    await rejectUpdate(409, payload);
    await rejectUpdate(409, { ...payload, recordedAt: new Date(Date.parse(payload.recordedAt) - 1).toISOString() });
    const zero = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({
      latitude: 0, longitude: 0, recordedAt: new Date(Date.parse(payload.recordedAt) + 1).toISOString(),
    }) });
    assert.equal(zero.status, 200);
    assert.equal((await zero.json()).bus.latitude, 0);
    assert.deepEqual(buses[1], otherBus, 'Updating one bus must not change another bus');
  });

  await t.test('Swagger documents authentication, input rules and every expected rejection', async () => {
    const spec = await (await fetch(`${base}/openapi.json`)).json();
    const operation = spec.paths['/buses/{id}/location'].post;
    assert.deepEqual(operation.security, [{ TrackerToken: [] }]);
    assert.equal(spec.components.securitySchemes.TrackerToken.scheme, 'bearer');
    assert.equal(spec.components.schemas.LocationUpdate.additionalProperties, false);
    for (const status of ['200', '400', '401', '404', '409', '413', '415', '503']) {
      assert.ok(operation.responses[status], `Undocumented status: ${status}`);
    }
    assert.ok(!JSON.stringify(spec).includes(token), 'Never expose server credentials in documentation');
  });
});
