import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttp } from '@kiosko/sdk';
import { fixture, fixtureText } from './fixtures.ts';
import { account, AGENT, dailyPuzzle, games, oneAtATime, readCached, RETRY_SAME_MS, useClient } from './lichess.ts';
import { readChess, resetMemo } from './source.ts';
import { saveOutcome } from './store.ts';

const dir = () => mkdtempSync(join(tmpdir(), 'kiosko-chess-'));
const DAY = Date.parse('2026-11-27T09:00:00Z');

/** A fake Lichess: answers by path, counts the calls, remembers the headers. */
function fake(routes: Record<string, () => { status?: number; body?: string; headers?: Record<string, string> }>) {
  const calls: { path: string; headers: Record<string, string> }[] = [];
  let now = DAY;
  const f = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = new URL(String(url));
    calls.push({ path: u.pathname + u.search, headers: (init.headers ?? {}) as Record<string, string> });
    const r = routes[u.pathname];
    if (!r) return new Response('{"error":"Not found"}', { status: 404 });
    const a = r();
    return new Response(a.body ?? '{}', { status: a.status ?? 200, headers: a.headers ?? {} });
  }) as typeof fetch;
  const client = createHttp({ agent: AGENT, fetch: f, now: () => now });
  return { client, calls, setNow: (t: number) => (now = t) };
}

const dailyBody = () => ({ body: fixtureText('daily-3Ksou.json') });
const otherBody = () => ({ body: fixtureText('puzzle-o5fEa.json') });

test('the daily puzzle is asked once a day, kept, and asked again the next day', async () => {
  const cache = dir();
  const f = fake({ '/api/puzzle/daily': dailyBody });
  const a = await dailyPuzzle({ cacheDir: cache, now: DAY, client: f.client });
  assert.equal(a!.puzzle.puzzle.id, '3Ksou');
  assert.equal(a!.day, '2026-11-27');
  const b = await dailyPuzzle({ cacheDir: cache, now: DAY + 6 * 3600_000, client: f.client });
  assert.equal(b!.puzzle.puzzle.id, '3Ksou');
  assert.equal(f.calls.length, 1, 'kept for the rest of the day');
  assert.match(f.calls[0]!.headers['User-Agent']!, /^kiosko-plugin-chess\/\d+\.\d+\.\d+ Kiosko/);
  assert.equal((await readCached(cache))!.puzzle.puzzle.id, '3Ksou');
  await dailyPuzzle({ cacheDir: cache, now: DAY + 24 * 3600_000, client: f.client });
  assert.equal(f.calls.length, 2, 'a new day asks again');
});

test('the same puzzle as yesterday is shown but asked again an hour later', async () => {
  const cache = dir();
  let body = dailyBody;
  const f = fake({ '/api/puzzle/daily': () => body() });
  await dailyPuzzle({ cacheDir: cache, now: DAY, client: f.client });
  const next = DAY + 24 * 3600_000;
  const same = await dailyPuzzle({ cacheDir: cache, now: next, client: f.client });
  assert.equal(same!.stale, true);
  await dailyPuzzle({ cacheDir: cache, now: next + 10 * 60_000, client: f.client });
  assert.equal(f.calls.length, 2, 'not before the hour');
  body = otherBody;
  const fresh = await dailyPuzzle({ cacheDir: cache, now: next + RETRY_SAME_MS + 1, client: f.client });
  assert.equal(fresh!.puzzle.puzzle.id, 'o5fEa');
  assert.equal(fresh!.stale, undefined);
});

test('Lichess down or rate-limiting: what is kept is shown; after a 429 nothing is asked until it says', async () => {
  const cache = dir();
  let status = 200;
  const f = fake({ '/api/puzzle/daily': () => (status === 200 ? dailyBody() : { status, body: '', headers: { 'Retry-After': '60' } }) });
  await dailyPuzzle({ cacheDir: cache, now: DAY, client: f.client });
  status = 429;
  const logs: string[] = [];
  const next = DAY + 24 * 3600_000;
  f.setNow(next);
  const kept = await dailyPuzzle({ cacheDir: cache, now: next, client: f.client, log: (m) => logs.push(m) });
  assert.equal(kept!.puzzle.puzzle.id, '3Ksou');
  assert.match(logs[0]!, /429/);
  const n = f.calls.length;
  await dailyPuzzle({ cacheDir: cache, now: next + 1000, client: f.client });
  assert.equal(f.calls.length, n, 'resting: not even asked');
  // Nothing kept and nothing to ask: an error.
  await assert.rejects(dailyPuzzle({ cacheDir: dir(), now: next + 2000, client: f.client }));
});

test('one request at a time', async () => {
  let running = 0;
  let most = 0;
  const job = () => oneAtATime(async () => {
    running++;
    most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
  });
  await Promise.all([job(), job(), job(), Promise.resolve().then(job)]);
  assert.equal(most, 1);
  // A failure doesn't block the next one.
  await assert.rejects(oneAtATime(async () => { throw new Error('boom'); }));
  assert.equal(await oneAtATime(async () => 7), 7);
});

test('with a token: the puzzle rating, the month, and the games waiting for your move', async () => {
  const f = fake({
    '/api/account': () => ({ body: JSON.stringify(fixture('account.json')) }),
    '/api/puzzle/dashboard/30': () => ({ body: JSON.stringify(fixture('puzzle-dashboard.json')) }),
    '/api/account/playing': () => ({ body: JSON.stringify(fixture('account-playing-correspondence.json')) }),
  });
  const a = await account('lip_x', { client: f.client });
  assert.deepEqual(a, { username: 'Bobby', rating: 1815, prog: 44, games: 334, month: { nb: 11, firstWins: 6, performance: 1609 } });
  assert.equal(f.calls[0]!.headers.Authorization, 'Bearer lip_x');
  const g = await games('lip_x', { client: f.client });
  assert.equal(g.nbMyTurn, 2);
  assert.equal(g.total, 3);
  assert.deepEqual(g.waiting.map((x) => [x.opponent, x.color, x.secondsLeft]), [['Ana', 'white', 190800], ['Stockfish 3', 'black', 32400]]);
  const none = fake({ '/api/account/playing': () => ({ body: JSON.stringify(fixture('account-playing.json')) }) });
  assert.deepEqual((await games('t', { client: none.client })).waiting, []);
});

test('a token without the puzzle scope: the rating alone', async () => {
  const f = fake({ '/api/account': () => ({ body: JSON.stringify(fixture('account.json')) }), '/api/puzzle/dashboard/30': () => ({ status: 403, body: '{}' }) });
  const a = await account('t', { client: f.client });
  assert.equal(a.rating, 1815);
  assert.equal(a.month, undefined);
});

test('the source: puzzle, outcome and streak from disk; account and games only when due; a refused token said once', async () => {
  resetMemo();
  const cacheDir = dir();
  const dataDir = dir();
  let accountStatus = 200;
  const f = fake({
    '/api/puzzle/daily': dailyBody,
    '/api/account': () => (accountStatus === 200 ? { body: JSON.stringify(fixture('account.json')) } : { status: accountStatus, body: '{}' }),
    '/api/puzzle/dashboard/30': () => ({ body: JSON.stringify(fixture('puzzle-dashboard.json')) }),
    '/api/account/playing': () => ({ body: JSON.stringify(fixture('account-playing-correspondence.json')) }),
  });
  useClient(f.client);
  try {
    const log = () => undefined;
    saveOutcome(dataDir, { puzzleId: '3Ksou', day: '2026-11-27', result: 'solved', mistakes: 1, hints: 0, at: DAY });
    saveOutcome(dataDir, { puzzleId: 'zzz', day: '2026-11-26', result: 'solved', mistakes: 0, hints: 0, at: DAY - 86_400_000 });
    const d = await readChess({ options: { token: '', games: true }, now: DAY, cacheDir, dataDir, log });
    assert.equal(d.start!.turn, 'b');
    assert.equal(d.outcome!.mistakes, 1);
    assert.equal(d.streak, 2);
    assert.equal(d.token, false);
    assert.equal(d.account, undefined);
    assert.equal(f.calls.length, 1);
    const t1 = await readChess({ options: { token: 'lip_x', games: true }, now: DAY + 60_000, cacheDir, dataDir, log });
    assert.equal(t1.account!.rating, 1815);
    assert.equal(t1.games!.nbMyTurn, 2);
    const n = f.calls.length;
    await readChess({ options: { token: 'lip_x', games: true }, now: DAY + 120_000, cacheDir, dataDir, log });
    assert.equal(f.calls.length, n, 'nothing due a minute later');
    await readChess({ options: { token: 'lip_x', games: true }, now: DAY + 7 * 60_000, cacheDir, dataDir, log });
    assert.deepEqual(f.calls.slice(n).map((c) => c.path), ['/api/account/playing?nb=50'], 'games every 5 minutes, the account every 30');
    accountStatus = 401;
    const bad = await readChess({ options: { token: 'lip_bad', games: true }, now: DAY + 8 * 60_000, cacheDir, dataDir, log });
    assert.equal(bad.error, 'token');
    const m = f.calls.length;
    await readChess({ options: { token: 'lip_bad', games: true }, now: DAY + 9 * 60_000, cacheDir, dataDir, log });
    assert.equal(f.calls.length, m, 'a refused token is not asked again every minute');
  } finally {
    useClient(null);
    resetMemo();
  }
});
