import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { app } from '../src/app.js';

test('route discovery returns labelled demo data, ordered stops and JSON errors', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${base}/routes`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.dataMode, 'simulated');
  assert.match(body.notice, /Not live/);
  assert.equal(body.routes.length, 1);
  const route = body.routes[0];
  assert.equal(route.id, 'demo-mirpur-farmgate');
  assert.deepEqual(route.stops.map((stop) => stop.id), ['mirpur-10', 'kazipara', 'farmgate']);
  for (const stop of route.stops) {
    assert.ok(stop.name);
    assert.ok(Number.isFinite(stop.latitude) && Math.abs(stop.latitude) <= 90);
    assert.ok(Number.isFinite(stop.longitude) && Math.abs(stop.longitude) <= 180);
  }

  const specResponse = await fetch(`${base}/openapi.json`);
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.deepEqual(spec.servers, [{ url: '/' }]);
  const documented = spec.paths['/routes'].get.responses['200'].content['application/json'];
  assert.deepEqual(documented.example, body, 'Documentation example must match the API');
  for (const field of spec.components.schemas.RoutesResponse.required) {
    assert.ok(Object.hasOwn(body, field), `Missing documented response field: ${field}`);
  }
  assert.equal(spec.components.schemas.Stop.properties.latitude.minimum, -90);
  assert.equal(spec.components.schemas.Stop.properties.longitude.maximum, 180);
  for (const path of ['/docs', '/docs/']) {
    const docs = await fetch(`${base}${path}`);
    assert.equal(docs.status, 200);
    assert.match(docs.headers.get('content-type'), /text\/html/);
    assert.match(await docs.text(), /url: '\/openapi.json'/);
  }
  for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
    const assetResponse = await fetch(`${base}/docs/${asset}`);
    assert.equal(assetResponse.status, 200, `Swagger asset unavailable: ${asset}`);
  }

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Endpoint not found' });
  const unsupported = await fetch(`${base}/routes`, { method: 'POST' });
  assert.equal(unsupported.status, 404);
});
