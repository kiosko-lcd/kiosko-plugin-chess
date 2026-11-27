/**
 * What you did with each day's puzzle, on disk (`solved.json` in the
 * plugin's data folder), so the widget and the next game know it: solved
 * (in how many tries, with how many hints) or given up. The last 60 kept.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Outcome {
  puzzleId: string;
  /** The day it was the daily puzzle (UTC, YYYY-MM-DD). */
  day: string;
  result: 'solved' | 'gaveUp';
  /** Wrong moves before solving it. */
  mistakes: number;
  hints: number;
  /** When (epoch ms). */
  at: number;
}

const FILE = 'solved.json';
const KEEP = 60;

/** Today in UTC, as Lichess's daily puzzle counts days. */
export const utcDay = (at: number): string => new Date(at).toISOString().slice(0, 10);

/** Every outcome kept, newest last. A missing or broken file is no outcomes. */
export function loadOutcomes(dir: string): Outcome[] {
  if (!dir) return [];
  try {
    const list = JSON.parse(readFileSync(join(dir, FILE), 'utf8')) as unknown;
    return Array.isArray(list) ? list.filter((o): o is Outcome => !!o && typeof o.puzzleId === 'string' && (o.result === 'solved' || o.result === 'gaveUp')) : [];
  } catch {
    return [];
  }
}

/** The outcome for one puzzle, if there is one. */
export const outcomeOf = (dir: string, puzzleId: string): Outcome | null => loadOutcomes(dir).findLast((o) => o.puzzleId === puzzleId) ?? null;

/**
 * Keeps an outcome. A puzzle already solved stays solved (playing it again
 * doesn't change the record); a give-up is replaced by a later solve.
 */
export function saveOutcome(dir: string, o: Outcome): Outcome {
  if (!dir) return o;
  const list = loadOutcomes(dir);
  const old = list.find((x) => x.puzzleId === o.puzzleId);
  if (old && (old.result === 'solved' || o.result === 'gaveUp')) return old;
  const next = [...list.filter((x) => x.puzzleId !== o.puzzleId), o].slice(-KEEP);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `${FILE}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(next, null, 1)}\n`);
  renameSync(tmp, join(dir, FILE));
  return o;
}

/** Days in a row up to `day` with the daily puzzle solved (a streak). */
export function streak(list: Outcome[], day: string): number {
  const solved = new Set(list.filter((o) => o.result === 'solved').map((o) => o.day));
  let n = 0;
  let d = Date.parse(`${day}T00:00:00Z`);
  // Today not solved yet doesn't break yesterday's streak.
  if (!solved.has(day)) d -= 86_400_000;
  while (solved.has(new Date(d).toISOString().slice(0, 10))) {
    n++;
    d -= 86_400_000;
  }
  return n;
}
