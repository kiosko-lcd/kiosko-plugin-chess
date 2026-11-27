import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PadKey } from '@kiosko/sdk';
import { cellOf } from './board.ts';
import { fixture } from './fixtures.ts';
import { GIVE_UP_CONFIRM_MS, PlayMachine, REPEAT_DELAY_MS, REPEAT_EVERY_MS, REPLY_DELAY_MS, SHAKE_MS, SLIDE_MS, STEP_MS } from './play.ts';
import { parsePuzzle, pieceAt, startOf, uciOf, type LichessPuzzle } from './puzzle.ts';

const load = (name: string): LichessPuzzle => parsePuzzle(fixture(name));
const daily = load('daily-3Ksou.json');

/** A machine on a puzzle with a clock of its own, and a few helpers to drive it as the Play page does. */
function rig(p: LichessPuzzle = daily, done: Parameters<typeof PlayMachine.prototype.press>[1] | null = null) {
  const start = startOf(p);
  let now = 10_000;
  const outcomes: unknown[] = [];
  const m = new PlayMachine(start, p.puzzle.solution, { now, done: done as never });
  m.onOutcome = (o) => outcomes.push(o);
  const tap = (k: PadKey) => {
    m.press(k, now);
    m.release(k);
    now += 50;
    m.tick(now);
  };
  const wait = (ms: number) => {
    now += ms;
    m.tick(now);
  };
  const goTo = (sq: string) => {
    for (let i = 0; i < 20 && m.cursor !== sq; i++) {
      const a = cellOf(m.cursor, start.turn);
      const b = cellOf(sq, start.turn);
      tap(b.col > a.col ? 'right' : b.col < a.col ? 'left' : b.row > a.row ? 'down' : 'up');
    }
    assert.equal(m.cursor, sq);
  };
  const move = (uci: string) => {
    const u = uciOf(uci);
    goTo(u.from);
    tap('a');
    goTo(u.to);
    tap('a');
  };
  return { m, start, outcomes, tap, wait, goTo, move, now: () => now };
}

test('the cursor starts on the last move and moves as seen from the solver (Black: up goes to rank 1)', () => {
  const { m, tap } = rig();
  assert.equal(m.cursor, 'g1');
  assert.equal(m.orientation, 'b');
  tap('down');
  assert.equal(m.cursor, 'g2');
  tap('right');
  assert.equal(m.cursor, 'f2', 'right is towards the a-file for Black');
  tap('l');
  assert.equal(m.cursor, 'g2', 'L (the A key) is left too');
  tap('up');
  tap('up');
  assert.equal(m.cursor, 'g1', 'clamped at the edge');
  for (let i = 0; i < 10; i++) tap('left');
  assert.equal(m.cursor, 'h1');
});

test('White sees it the other way round: up goes to rank 8', () => {
  const { m, tap } = rig(load('puzzle-o5fEa.json'));
  assert.equal(m.orientation, 'w');
  const from = m.cursor;
  tap('up');
  assert.equal(Number(m.cursor[1]), Number(from[1]) + 1);
  tap('r');
  assert.equal(m.cursor.charCodeAt(0), from.charCodeAt(0) + 1);
});

test('held arrows repeat after a delay', () => {
  const { m, wait, now } = rig();
  m.press('down', now());
  assert.equal(m.cursor, 'g2');
  wait(REPEAT_DELAY_MS - 10);
  assert.equal(m.cursor, 'g2', 'not before the delay');
  wait(20);
  assert.equal(m.cursor, 'g3');
  wait(REPEAT_EVERY_MS);
  assert.equal(m.cursor, 'g4');
  m.release('down');
  wait(1000);
  assert.equal(m.cursor, 'g4', 'stops when let go');
});

test('select and deselect: own pieces only, A again or B puts it back, another own piece switches', () => {
  const { m, tap, goTo, now } = rig();
  goTo('h3');
  tap('a');
  assert.equal(m.selected, null, "the opponent's king can't be picked up");
  goTo('g6');
  tap('a');
  assert.equal(m.selected, 'g6');
  assert.deepEqual([...m.view(now()).targets].sort(), ['e5', 'e7', 'f4', 'f8', 'h4', 'h8'].sort());
  tap('a');
  assert.equal(m.selected, null, 'A on the same square puts it back');
  tap('x');
  assert.equal(m.selected, 'g6', 'X picks up too (Enter)');
  tap('b');
  assert.equal(m.selected, null, 'B puts it back');
  tap('a');
  goTo('g5');
  tap('a');
  assert.equal(m.selected, 'g5', 'another own piece is picked up instead');
  goTo('a1');
  tap('a');
  assert.equal(m.selected, 'g5', 'a square it cannot go to does nothing');
});

test('a wrong move shakes the board, counts, and leaves the position as it was', () => {
  const { m, move, wait, now } = rig();
  move('g5g2');
  const v = m.view(now());
  assert.equal(m.mistakes, 1);
  assert.equal(v.message, 'wrong');
  assert.equal(v.wrong, 'g5');
  assert.ok(Math.abs(m.view(now() + SHAKE_MS / 12).shake) > 0, 'it shakes');
  assert.deepEqual(pieceAt(v.board, 'g5'), { type: 'q', color: 'b' }, 'the queen is still there');
  assert.equal(m.phase, 'play');
  wait(SHAKE_MS + 10);
  assert.equal(m.view(now()).shake, 0);
  assert.equal(m.view(now()).message, 'yourMove');
});

test('a right move: good, then the opponent answers sliding in, and it is your move again', () => {
  const { m, move, wait, now } = rig();
  move('g6f4');
  assert.equal(m.phase, 'reply');
  assert.equal(m.view(now()).message, 'good');
  assert.ok(m.view(now()).slide, 'the knight slides');
  wait(SLIDE_MS + REPLY_DELAY_MS);
  const v = m.view(now());
  assert.equal(m.phase, 'play');
  assert.deepEqual(v.lastMove, uciOf('e3f4'));
  assert.equal(v.slide?.to, 'f4', "the opponent's pawn slides to f4");
  assert.equal(m.cursor, 'f4', 'the cursor follows the answer');
  assert.deepEqual(v.moves, { done: 1, total: 3 });
});

test('solving it all: solved once, with its mistakes and hints, reported once', () => {
  const { m, move, wait, tap, outcomes, now } = rig();
  tap('y');
  move('g6f4');
  wait(1000);
  move('e6h6');
  wait(1000);
  move('h6h5');
  assert.equal(m.phase, 'solved');
  assert.equal(m.view(now()).message, 'solved');
  assert.deepEqual(outcomes, [{ result: 'solved', mistakes: 0, hints: 1 }]);
  assert.equal(m.view(now()).check, 'h3', 'mate: the king is marked');
  // A plays the solution again; Start solves it again, and the record keeps the first result.
  tap('a');
  assert.equal(m.view(now()).message, 'replay');
  for (let i = 0; i < 8; i++) wait(STEP_MS);
  tap('start');
  assert.equal(m.phase, 'play');
  assert.equal(m.mistakes, 0);
  move('g6f4');
  wait(1000);
  move('e6h6');
  wait(1000);
  move('h6h5');
  assert.equal(outcomes.length, 1);
});

test('hint: the piece to move is marked, counted once per move; asked again, the cursor goes there', () => {
  const { m, tap, now } = rig();
  tap('y');
  assert.equal(m.view(now()).hint, 'g6');
  assert.equal(m.view(now()).message, 'hint');
  assert.equal(m.hints, 1);
  assert.equal(m.cursor, 'g1');
  tap('y');
  assert.equal(m.cursor, 'g6');
  assert.equal(m.hints, 1, 'the same hint is not counted twice');
});

test('give up: Select once asks, the question goes away; twice plays the solution out and keeps it', () => {
  const { m, tap, wait, outcomes, now } = rig();
  tap('select');
  assert.equal(m.view(now()).message, 'confirmGiveUp');
  wait(GIVE_UP_CONFIRM_MS + 10);
  assert.equal(m.view(now()).message, 'yourMove');
  tap('select');
  tap('select');
  assert.equal(m.phase, 'gaveUp');
  assert.deepEqual(outcomes, [{ result: 'gaveUp', mistakes: 0, hints: 0 }]);
  // The solution plays out from the puzzle's position, one move at a time.
  assert.equal(m.view(now()).step, -1);
  wait(STEP_MS);
  assert.equal(m.view(now()).step, 0);
  for (let i = 0; i < 6; i++) wait(STEP_MS);
  const v = m.view(now());
  assert.equal(v.step, 4);
  assert.deepEqual(pieceAt(v.board, 'h5'), { type: 'r', color: 'b' });
});

test('promotion: the picker opens, arrows choose, B cancels, A confirms; the wrong piece is a mistake', () => {
  const p = load('puzzle-k2eHg.json');
  const { m, move, tap, wait, outcomes, now } = rig(p);
  move('f6e6');
  wait(1000);
  move('g7g8');
  assert.equal(m.phase, 'promote');
  assert.equal(m.view(now()).promo?.index, 0);
  tap('right');
  assert.equal(m.view(now()).promo?.index, 1);
  tap('b');
  assert.equal(m.phase, 'play');
  move('g7g8');
  tap('right');
  tap('a');
  assert.equal(m.mistakes, 1, 'a rook is not the solution');
  wait(SHAKE_MS + 10);
  move('g7g8');
  tap('left');
  tap('right');
  tap('a');
  assert.equal(m.phase, 'solved');
  assert.deepEqual(pieceAt(m.view(now()).board, 'g8'), { type: 'q', color: 'w' });
  assert.deepEqual(outcomes, [{ result: 'solved', mistakes: 1, hints: 0 }]);
});

test('castling and en passant with the cursor', () => {
  const c = rig(load('puzzle-8zPl0.json'));
  c.move('c6d4');
  c.wait(1000);
  c.move('b4d2');
  c.wait(1000);
  c.move('e8c8');
  assert.equal(c.m.mistakes, 0);
  assert.deepEqual(pieceAt(c.m.view(c.now()).board, 'd8'), { type: 'r', color: 'b' });
  const e = rig(load('puzzle-o5fEa.json'));
  e.move('d1b3');
  e.wait(1000);
  e.move('e5d6');
  assert.equal(e.m.mistakes, 0);
  assert.equal(pieceAt(e.m.view(e.now()).board, 'd5'), null);
});

test('an alternative mate is solved and says so', () => {
  const { m, move, outcomes, now } = rig(load('puzzle-YynlB.json'));
  move('f8h7');
  assert.equal(m.phase, 'solved');
  assert.equal(outcomes.length, 1);
  assert.equal(m.view(now()).message, 'solved');
});

test('already solved today: the end position, nothing reported again; demo plays it without reporting', () => {
  const start = startOf(daily);
  const m = new PlayMachine(start, daily.puzzle.solution, { now: 0, done: { puzzleId: '3Ksou', day: '2026-11-27', result: 'solved', mistakes: 2, hints: 1, at: 0 } });
  let reported = 0;
  m.onOutcome = () => reported++;
  const v = m.view(0);
  assert.equal(v.phase, 'solved');
  assert.equal(v.message, 'alreadySolved');
  assert.equal(v.mistakes, 2);
  assert.deepEqual(pieceAt(v.board, 'h5'), { type: 'r', color: 'b' });
  m.demo(100);
  m.tick(100 + STEP_MS);
  assert.equal(m.view(100 + STEP_MS).step, 0);
  assert.equal(reported, 0);
});
