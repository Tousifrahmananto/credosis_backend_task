import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createBusStore } from '../src/buses.js';
import { createApp } from '../src/app.js';

test('accepted locations survive reopening in another process; seeds never reset timestamps', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bus-persistence-'));
  let reopened;
  t.after(() => {
    reopened?.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const filename = join(directory, 'bus.sqlite');
  const store = createBusStore(filename);
  const recordedAt = new Date(Date.now() - 1000).toISOString();
  const untouched = store.get('demo-bus-02');
  assert.equal(store.update('demo-bus-01', { latitude: 23.799, longitude: 90.371, recordedAt }), true);
  const expected = store.get('demo-bus-01');
  store.close();
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createBusStore } from ${JSON.stringify(new URL('../src/buses.js', import.meta.url).href)};
    const store = createBusStore(process.argv[1]);
    console.log(JSON.stringify([store.get('demo-bus-01'), store.get('demo-bus-02')]));
    store.close();
  `, filename], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [expected, untouched]);

  reopened = createBusStore(filename);
  assert.equal(reopened.update('demo-bus-01', { latitude: 0, longitude: 0, recordedAt }), false);
  assert.equal(reopened.update('demo-bus-01', { latitude: 0, longitude: 0, recordedAt: new Date(Date.parse(recordedAt) - 1).toISOString() }), false);
  assert.deepEqual(reopened.get('demo-bus-01'), expected);
  assert.throws(() => reopened.update('demo-bus-01', {
    latitude: 91, longitude: 0, recordedAt: new Date(Date.parse(recordedAt) + 1).toISOString(),
  }), /CHECK constraint failed/);
  assert.deepEqual(reopened.get('demo-bus-01'), expected);
});

test('a locked database returns JSON 503 without accepting or losing a location', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bus-locked-'));
  const filename = join(directory, 'bus.sqlite');
  const store = createBusStore(filename);
  const lock = new DatabaseSync(filename);
  const originalToken = process.env.TRACKER_TOKEN_DEMO_BUS_01;
  const token = 'test-only-lock-token-123456789012345678901';
  process.env.TRACKER_TOKEN_DEMO_BUS_01 = token;
  const server = createApp(store).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    lock.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
    if (originalToken === undefined) delete process.env.TRACKER_TOKEN_DEMO_BUS_01;
    else process.env.TRACKER_TOKEN_DEMO_BUS_01 = originalToken;
  });
  await once(server, 'listening');
  const before = store.get('demo-bus-01');
  lock.exec('BEGIN IMMEDIATE');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/buses/demo-bus-01/location`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 23.799, longitude: 90.371, recordedAt: new Date().toISOString() }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Location storage is temporarily unavailable' });
  lock.exec('ROLLBACK');
  assert.deepEqual(store.get('demo-bus-01'), before);
});

test('an unreadable database fails startup instead of silently replacing saved data', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bus-corrupt-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'broken.sqlite');
  writeFileSync(filename, 'invalid database contents');
  assert.throws(() => createBusStore(filename), /not a database/);
});
