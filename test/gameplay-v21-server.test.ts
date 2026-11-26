import {randomUUID} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {expect, it} from 'vitest';
import {createApi} from '../server/api';
import {sqliteStorage} from '../server/sqlite-storage';
import {developmentMatch} from '../src/v2/development';
import {revision} from '../src/v2/game';
import {validate} from '../src/v2/replay';

it('reserves private V2.1 work under the shared budget and recovers versioned replay after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'arena-v21-'));
  const file = join(directory, 'arena.sqlite');
  let db = new DatabaseSync(file);
  const token = 'validation-test-token-with-at-least-32-characters';
  let calls = 0;
  async function start() {
    const background: Promise<void>[] = [];
    const app = createApi(sqliteStorage(db, directory), {
      key: 'v1-test', model: 'test-model', hosted: true, origin: 'https://arena.example', background: job => background.push(job),
      v2Trial: {key: 'v2-test', token, runner: async (key, model, config, coaches, _signal, attempts) => {
        calls++;
        expect(key).toBe('v2-test');
        expect(coaches[0]).toMatchObject({text: 'Explore nearby tiles.'});
        expect(coaches[0].memory).toBeUndefined();
        expect(config.rulesVersion).toBe(revision);
        attempts.push({side: 0, status: 'ok', step: 0, attempt: 1, ms: 2});
        // Test dependency only. The fixture marks attestation to exercise the persistence gate.
        return {replay: {...developmentMatch(config.seed, undefined, revision), source: 'operator-attested-gemini'},
          model, requests: 1, idleWithoutChoice: 0};
      }},
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const root = 'http://127.0.0.1:' + (server.address() as {port: number}).port + '/api/';
    return {root, background, close: () => new Promise<void>(resolve => server.close(() => resolve()))};
  }
  let app = await start();
  try {
    const origin = 'https://arena.example';
    const guest = async () => (await fetch(app.root + 'guest', {method: 'POST', headers: {origin}})).headers.get('set-cookie')!.split(';')[0];
    const owner = await guest(), stranger = await guest();
    const body = {requestId: randomUUID(), coaching: 'Explore nearby tiles.', rulesVersion: revision};
    const create = (cookie: string, trial: string, data: object) => fetch(app.root + 'matches', {method: 'POST',
      headers: {origin, cookie, 'x-arena-trial': trial, 'content-type': 'application/json'}, body: JSON.stringify(data)});
    expect((await create('', token, body)).status).toBe(401);
    expect((await create(owner, 'wrong', body)).status).toBe(404);
    expect((await create(owner, token, {...body, seed: 1})).status).toBe(400);
    const response = await create(owner, token, body);
    expect(response.status).toBe(202);
    const {id} = await response.json();
    await Promise.all(app.background);
    expect((await (await create(owner, token, body)).json()).id).toBe(id);
    expect((await create(owner, '', {...body, rulesVersion: 'lane-v1'})).status).toBe(409);
    expect((await create(owner, '', {...body, requestId: randomUUID(), rulesVersion: 'lane-v1'})).status).toBe(429);
    expect((await fetch(app.root + 'matches/' + id, {headers: {cookie: stranger}})).status).toBe(404);
    await app.close();
    db.close();
    db = new DatabaseSync(file);
    app = await start();
    const persisted = await (await fetch(app.root + 'matches/' + id, {headers: {cookie: owner}})).json();
    expect(persisted).toMatchObject({status: 'completed', rulesVersion: revision, reflection: {status: 'unavailable'}});
    expect(validate(persisted.replay).source).toBe('operator-attested-gemini');
    const stored = JSON.parse(String(db.prepare('SELECT config FROM matches WHERE id=?').get(id)?.config));
    expect(stored).toMatchObject({memoryRevisions: [0, 0], attempts: [{status: 'ok'}], seed: persisted.replay.config.seed});
    expect(calls).toBe(1);
  } finally {
    await app.close();
    db.close();
    rmSync(directory, {recursive: true, force: true});
  }
});
