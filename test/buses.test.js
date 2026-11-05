import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createBusStore } from '../src/buses.js';
import { routes } from '../src/routes.js';
import { createApp } from '../src/app.js';

test('freshness switches at exactly two minutes without rewriting the reading', (t) => {
  const store = createBusStore();
  t.after(() => store.close());
  const bus = store.get('demo-bus-01');
  const recordedAt = Date.parse(bus.lastUpdated);
  assert.equal(store.list(bus.routeId, recordedAt + 119_999)[0].isStale, false);
  assert.equal(store.list(bus.routeId, recordedAt + 120_000)[0].isStale, true);
  assert.equal(store.list(bus.routeId, recordedAt + 120_001)[0].isStale, true);
  assert.equal(store.list(bus.routeId, recordedAt + 600_000)[0].lastUpdated, bus.lastUpdated);
  assert.deepEqual(store.list('another-route', recordedAt), []);
});

test('bus endpoint reports simulated locations, an empty route and unknown route distinctly', async (t) => {
  const store = createBusStore();
  t.after(() => store.close());
  const app = createApp(store);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/routes/demo-mirpur-farmgate/buses`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.dataMode, 'simulated');
  assert.match(body.notice, /Not live/);
  assert.equal(body.staleAfterSeconds, 120);
  assert.equal(body.buses.length, 2);
  for (const bus of body.buses) {
    assert.equal(bus.routeId, body.routeId);
    assert.ok(Number.isFinite(bus.latitude) && Math.abs(bus.latitude) <= 90);
    assert.ok(Number.isFinite(bus.longitude) && Math.abs(bus.longitude) <= 180);
    assert.equal(bus.isStale, Date.parse(body.checkedAt) - Date.parse(bus.lastUpdated) >= 120_000);
  }
  assert.equal(body.buses.find((bus) => bus.id === 'demo-bus-02').isStale, true);
  const unknown = await fetch(`${base}/routes/no-such-route/buses`);
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'Route not found' });

  const emptyRoute = { id: 'test-empty-route', name: 'Test fixture', stops: [] };
  routes.push(emptyRoute);
  t.after(() => routes.splice(routes.indexOf(emptyRoute), 1));
  const empty = await fetch(`${base}/routes/test-empty-route/buses`);
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).buses, []);

  const spec = await (await fetch(`${base}/openapi.json`)).json();
  const operation = spec.paths['/routes/{id}/buses'].get;
  assert.equal(operation.parameters[0].required, true);
  assert.deepEqual(operation.responses['404'].content['application/json'].example, { error: 'Route not found' });
  for (const key of spec.components.schemas.BusLocationsResponse.required) {
    assert.ok(Object.hasOwn(body, key), `Missing documented field: ${key}`);
  }
  for (const key of spec.components.schemas.BusLocation.required) {
    assert.ok(Object.hasOwn(body.buses[0], key), `Missing documented bus field: ${key}`);
  }
});
