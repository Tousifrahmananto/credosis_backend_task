import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

test('server honors hosting bind/port settings and shuts down cleanly', { timeout: 15000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bus-hosting-'));
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, HOST: '0.0.0.0', PORT: '0', DATABASE_PATH: join(directory, 'bus.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  });
  const lines = createInterface({ input: child.stdout });
  t.after(() => lines.close());
  const line = await new Promise((resolve, reject) => {
    lines.once('line', resolve);
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Server exited before listening')));
  });
  const match = line.match(/listening on 0\.0\.0\.0:(\d+)/);
  assert.ok(match, line);
  const response = await fetch(`http://127.0.0.1:${match[1]}/routes/demo-mirpur-farmgate/buses`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).buses.length, 2);
});

test('invalid hosting ports fail startup', () => {
  for (const port of ['', 'invalid', '-1', '65536', '3.5']) {
    const child = spawnSync(process.execPath, ['src/server.js'], {
      env: { ...process.env, PORT: port }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(child.status, 1, port);
    assert.match(child.stderr, /PORT must be an integer/);
  }
});
