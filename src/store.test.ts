import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOutcomes, outcomeOf, saveOutcome, streak, utcDay, type Outcome } from './store.ts';

const dir = () => mkdtempSync(join(tmpdir(), 'kiosko-chess-'));
const o = (puzzleId: string, day: string, result: Outcome['result'] = 'solved', mistakes = 0): Outcome => ({ puzzleId, day, result, mistakes, hints: 0, at: Date.parse(`${day}T20:00:00Z`) });

test('an outcome is kept on disk and read back; nothing there is nothing', () => {
  const d = dir();
  assert.deepEqual(loadOutcomes(d), []);
  assert.equal(outcomeOf(d, '3Ksou'), null);
  saveOutcome(d, o('3Ksou', '2026-11-27', 'solved', 2));
  assert.deepEqual(outcomeOf(d, '3Ksou'), o('3Ksou', '2026-11-27', 'solved', 2));
  assert.ok(JSON.parse(readFileSync(join(d, 'solved.json'), 'utf8')).length === 1);
});

test('solved stays solved; a give-up gives way to a later solve', () => {
  const d = dir();
  saveOutcome(d, o('a', '2026-11-26', 'gaveUp'));
  saveOutcome(d, o('a', '2026-11-26', 'solved', 3));
  assert.equal(outcomeOf(d, 'a')!.result, 'solved');
  saveOutcome(d, o('a', '2026-11-26', 'gaveUp'));
  saveOutcome(d, o('a', '2026-11-26', 'solved', 0));
  assert.equal(outcomeOf(d, 'a')!.mistakes, 3, 'the first solve is the record');
});

test('only the last 60 are kept; a broken file reads as none', () => {
  const d = dir();
  for (let i = 0; i < 70; i++) saveOutcome(d, o(`p${i}`, utcDay(Date.UTC(2026, 0, 1) + i * 86_400_000)));
  const all = loadOutcomes(d);
  assert.equal(all.length, 60);
  assert.equal(all[0]!.puzzleId, 'p10');
  writeFileSync(join(d, 'solved.json'), '{ not json');
  assert.deepEqual(loadOutcomes(d), []);
  assert.deepEqual(loadOutcomes(''), []);
});

test('streak: days in a row solved, today not solved yet does not break it, a give-up does', () => {
  const list = [o('a', '2026-11-24'), o('b', '2026-11-25'), o('c', '2026-11-26')];
  assert.equal(streak(list, '2026-11-27'), 3);
  assert.equal(streak([...list, o('d', '2026-11-27')], '2026-11-27'), 4);
  assert.equal(streak([o('a', '2026-11-24'), o('b', '2026-11-25', 'gaveUp'), o('c', '2026-11-26')], '2026-11-27'), 1);
  assert.equal(streak([], '2026-11-27'), 0);
});
