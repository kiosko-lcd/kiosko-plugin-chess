/**
 * Lichess's open API, the polite way (https://lichess.org/api): one request
 * at a time, the SDK's User-Agent, and after a 429 nothing for a minute or
 * as long as it says. The daily puzzle is asked once a day and kept in the
 * cache folder; your account (with a token) every few minutes at most.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHttp, HttpError, type HttpClient } from '@kiosko/sdk';
import { parsePuzzle, type LichessPuzzle } from './puzzle.ts';
import { utcDay } from './store.ts';

export const VERSION = '0.1.1';
export const AGENT = `kiosko-plugin-chess/${VERSION}`;
export const HOST = 'lichess.org';
const BASE = `https://${HOST}`;

/** Your puzzle numbers, with a token. */
export interface Account {
  username: string;
  /** Puzzle rating and how it moved lately. */
  rating?: number;
  prog?: number;
  games?: number;
  /** The last 30 days, from the puzzle dashboard (needs the `puzzle:read` scope). */
  month?: { nb: number; firstWins: number; performance?: number };
}

/** A game of yours going on, from `/api/account/playing`. */
export interface OwnGame {
  gameId: string;
  color: 'white' | 'black';
  fen: string;
  lastMove?: string;
  opponent: string;
  opponentRating?: number;
  isMyTurn: boolean;
  /** Seconds left on your clock (correspondence: days). */
  secondsLeft?: number;
  speed: string;
}

export interface Games {
  nbMyTurn: number;
  /** Correspondence (and other) games where it is your move, most urgent first. */
  waiting: OwnGame[];
  /** All games going on. */
  total: number;
}

/** The daily puzzle as kept on disk: the answer and when it was asked. */
export interface Daily {
  puzzle: LichessPuzzle;
  /** The day it was asked (UTC, as Lichess's day). */
  day: string;
  fetchedAt: number;
  /** Lichess answered with an earlier day's puzzle: ask again later. */
  stale?: boolean;
}

let queue: Promise<unknown> = Promise.resolve();
/** Lichess asks for one request at a time: every call here waits for the one before. */
export function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

let shared: HttpClient | null = null;
export const http = (): HttpClient => (shared ??= createHttp({ agent: AGENT }));
/** Replaces the HTTP client every call here uses (tests); null goes back to the real one. */
export const useClient = (c: HttpClient | null): void => {
  shared = c;
};

const auth = (token: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

async function getJson<T>(client: HttpClient, path: string, o: { token?: string; signal?: AbortSignal } = {}): Promise<T> {
  return oneAtATime(async () => (await client.json<T>(`${BASE}${path}`, { headers: auth(o.token ?? ''), ...(o.signal ? { signal: o.signal } : {}), ...(o.token ? { noCache: true } : {}) })).data);
}

const CACHE = 'daily.json';

export async function readCached(dir: string): Promise<Daily | null> {
  if (!dir) return null;
  try {
    const d = JSON.parse(await readFile(join(dir, CACHE), 'utf8')) as Daily;
    return { ...d, puzzle: parsePuzzle(d.puzzle) };
  } catch {
    return null;
  }
}

async function writeCached(dir: string, d: Daily): Promise<void> {
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${CACHE}.tmp`);
  await writeFile(tmp, JSON.stringify(d));
  await rename(tmp, join(dir, CACHE));
}

/** When the kept puzzle is the same as yesterday's (Lichess hadn't changed it yet), ask again after this long. */
export const RETRY_SAME_MS = 60 * 60_000;

/**
 * Today's puzzle: the kept one if it was asked today (UTC), else Lichess's.
 * If Lichess still answers with the puzzle of an earlier day (it hadn't
 * changed it yet), that one is shown and asked again in an hour. A failed
 * request falls back to whatever is kept.
 */
export async function dailyPuzzle(o: { cacheDir: string; now: number; signal?: AbortSignal; client?: HttpClient; log?: (m: string) => void }): Promise<Daily | null> {
  const kept = await readCached(o.cacheDir);
  const today = utcDay(o.now);
  if (kept && kept.day === today && (!kept.stale || o.now - kept.fetchedAt < RETRY_SAME_MS)) return kept;
  try {
    const j = await getJson<unknown>(o.client ?? http(), '/api/puzzle/daily', o.signal ? { signal: o.signal } : {});
    const puzzle = parsePuzzle(j);
    const stale = !!kept && kept.puzzle.puzzle.id === puzzle.puzzle.id && (kept.day !== today || !!kept.stale);
    const d: Daily = { puzzle, day: today, fetchedAt: o.now, ...(stale ? { stale } : {}) };
    await writeCached(o.cacheDir, d);
    return d;
  } catch (err) {
    o.log?.(`daily puzzle: ${err instanceof Error ? err.message : String(err)}`);
    if (kept) return kept;
    throw err;
  }
}

interface AccountJson {
  username?: string;
  perfs?: { puzzle?: { rating?: number; prog?: number; games?: number } };
}
interface DashboardJson {
  global?: { nb?: number; firstWins?: number; performance?: number };
}
interface PlayingJson {
  nbMyTurn?: number;
  nowPlaying?: { gameId: string; color: 'white' | 'black'; fen: string; lastMove?: string; opponent?: { username?: string; rating?: number; ai?: number }; isMyTurn?: boolean; secondsLeft?: number; speed?: string; variant?: { key?: string } }[];
}

/** Your puzzle rating, and the last 30 days if the token may read them. */
export async function account(token: string, o: { signal?: AbortSignal; client?: HttpClient } = {}): Promise<Account> {
  const client = o.client ?? http();
  const a = await getJson<AccountJson>(client, '/api/account', { token, ...(o.signal ? { signal: o.signal } : {}) });
  const out: Account = { username: a.username ?? '' };
  const p = a.perfs?.puzzle;
  if (p?.rating) out.rating = p.rating;
  if (typeof p?.prog === 'number') out.prog = p.prog;
  if (typeof p?.games === 'number') out.games = p.games;
  try {
    const d = await getJson<DashboardJson>(client, '/api/puzzle/dashboard/30', { token, ...(o.signal ? { signal: o.signal } : {}) });
    if (d.global && typeof d.global.nb === 'number') out.month = { nb: d.global.nb, firstWins: d.global.firstWins ?? 0, ...(d.global.performance ? { performance: d.global.performance } : {}) };
  } catch (err) {
    // A token without `puzzle:read`: the rating alone.
    if (err instanceof HttpError && err.retryAt) throw err;
  }
  return out;
}

/** Your games going on, those waiting for your move first. */
export async function games(token: string, o: { signal?: AbortSignal; client?: HttpClient } = {}): Promise<Games> {
  const j = await getJson<PlayingJson>(o.client ?? http(), '/api/account/playing?nb=50', { token, ...(o.signal ? { signal: o.signal } : {}) });
  const list = (j.nowPlaying ?? []).filter((g) => !g.variant?.key || g.variant.key === 'standard' || g.variant.key === 'fromPosition');
  const waiting = list
    .filter((g) => g.isMyTurn)
    .map(
      (g): OwnGame => ({
        gameId: g.gameId,
        color: g.color,
        fen: g.fen,
        ...(g.lastMove ? { lastMove: g.lastMove } : {}),
        opponent: g.opponent?.ai ? `Stockfish ${g.opponent.ai}` : (g.opponent?.username ?? '?'),
        ...(g.opponent?.rating ? { opponentRating: g.opponent.rating } : {}),
        isMyTurn: true,
        ...(typeof g.secondsLeft === 'number' ? { secondsLeft: g.secondsLeft } : {}),
        speed: g.speed ?? '',
      }),
    );
  return { nbMyTurn: j.nbMyTurn ?? waiting.length, waiting, total: (j.nowPlaying ?? []).length };
}
