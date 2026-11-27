import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.ts';
import { boardOf, localSan, parsePuzzle, pieceAt, sanMoves, Solver, solutionText, startAt, startOf, uciOf, type LichessPuzzle } from './puzzle.ts';
import { PIECE_LETTERS } from './texts.ts';

const load = (name: string): LichessPuzzle => parsePuzzle(fixture(name));
const FIXTURES = ['daily-3Ksou.json', 'puzzle-o5fEa.json', 'puzzle-k2eHg.json', 'puzzle-8zPl0.json', 'puzzle-2WyFZ.json', 'puzzle-YynlB.json'];
const fenKey = (fen: string) => fen.split(' ').slice(0, 2).join(' ');

test('every fixture replays from its game to the puzzle position Lichess gives, last move included', () => {
  for (const f of FIXTURES) {
    const p = load(f);
    const s = startOf(p);
    assert.equal(fenKey(s.fen), fenKey(p.puzzle.fen!), f);
    assert.equal(`${s.lastMove!.from}${s.lastMove!.to}`, p.puzzle.lastMove, f);
    assert.equal(s.solutionSan.length, p.puzzle.solution.length, f);
    assert.equal(s.after.length, p.puzzle.solution.length, f);
  }
});

test('the daily puzzle: Black to move at move 23, a mate in three', () => {
  const s = startOf(load('daily-3Ksou.json'));
  assert.equal(s.turn, 'b');
  assert.equal(s.moveNumber, 23);
  assert.equal(s.lastSan, 'Rg1');
  assert.deepEqual(s.solutionSan, ['Nf4+', 'exf4', 'Rh6+', 'Bh5', 'Rxh5#']);
  assert.equal(s.mate, true);
  assert.deepEqual(solutionText(s), ['23… Nf4+', '24. exf4', 'Rh6+', '25. Bh5', 'Rxh5#']);
  assert.deepEqual(solutionText(s, PIECE_LETTERS.es), ['23… Cf4+', '24. exf4', 'Th6+', '25. Ah5', 'Txh5#']);
  assert.deepEqual(solutionText(s, PIECE_LETTERS.de).slice(0, 3), ['23… Sf4+', '24. exf4', 'Th6+']);
});

test('PGN: move numbers, comments, variations and results are skipped', () => {
  assert.deepEqual(sanMoves('1. e4 e5 2. Nf3 {a comment} Nc6 (2... d6) 3. Bb5 $1 a6 1-0'), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  assert.deepEqual(sanMoves('Nf3 Nf6 d4'), ['Nf3', 'Nf6', 'd4']);
  assert.deepEqual(sanMoves('12... Qxd4 13. O-O-O'), ['Qxd4', 'O-O-O']);
});

test('a broken puzzle is refused: illegal game move, a position that does not match, an illegal solution, junk', () => {
  const p = load('daily-3Ksou.json');
  assert.throws(() => startOf({ ...p, game: { ...p.game, pgn: p.game.pgn.replace('Nf3', 'Nf4') } }), /illegal move in the game/);
  assert.throws(() => startOf({ ...p, puzzle: { ...p.puzzle, initialPly: 40 } }), /does not reach/);
  assert.throws(() => startOf({ ...p, puzzle: { ...p.puzzle, solution: ['g6f4', 'a2a3'] } }), /illegal move in the solution/);
  assert.throws(() => startOf({ ...p, puzzle: { ...p.puzzle, initialPly: 400 } }), /the game has/);
  assert.throws(() => parsePuzzle({ hello: 1 }), /not a Lichess puzzle/);
  assert.throws(() => parsePuzzle({ game: { pgn: 'e4' }, puzzle: { id: 'x', solution: ['e2e9'], initialPly: 0 } }), /no solution/);
});

test('board helpers: pieces on squares after the replay', () => {
  const s = startOf(load('daily-3Ksou.json'));
  const b = boardOf(s.fen);
  assert.deepEqual(pieceAt(b, 'h3'), { type: 'k', color: 'w' });
  assert.deepEqual(pieceAt(b, 'g6'), { type: 'n', color: 'b' });
  assert.equal(pieceAt(b, 'e5'), null);
});

/** Plays the whole solution with the solver, both sides; returns the verdicts of the solver's moves. */
function solve(p: LichessPuzzle): string[] {
  const solver = new Solver(startOf(p), p.puzzle.solution);
  const verdicts: string[] = [];
  while (!solver.done) {
    verdicts.push(solver.tryMove(solver.expected!));
    solver.reply();
  }
  return verdicts;
}

test('solving: right, right, … solved, for every fixture', () => {
  for (const f of FIXTURES) {
    const v = solve(load(f));
    assert.equal(v.at(-1), 'solved', f);
    assert.ok(v.slice(0, -1).every((x) => x === 'right'), `${f}: ${v.join(' ')}`);
  }
});

test('en passant inside a solution: exd6 takes the pawn that just went d7-d5', () => {
  const p = load('puzzle-o5fEa.json');
  const solver = new Solver(startOf(p), p.puzzle.solution);
  assert.equal(solver.tryMove(uciOf('d1b3')), 'right');
  solver.reply(); // …d5
  assert.ok(solver.targets('e5').includes('d6'), 'the en passant square is a legal target');
  assert.equal(solver.tryMove(uciOf('e5d6')), 'right');
  const b = solver.board;
  assert.equal(pieceAt(b, 'd5'), null, 'the captured pawn is gone');
  assert.deepEqual(pieceAt(b, 'd6'), { type: 'p', color: 'w' });
});

test('castling inside a solution: O-O-O as e8c8, the rook goes to d8', () => {
  const p = load('puzzle-8zPl0.json');
  const solver = new Solver(startOf(p), p.puzzle.solution);
  for (let i = 0; i < 4; i++) solver.ply % 2 === 0 ? solver.tryMove(solver.expected!) : solver.reply();
  assert.ok(solver.targets('e8').includes('c8'));
  assert.equal(solver.tryMove(uciOf('e8c8')), 'right');
  assert.deepEqual(pieceAt(solver.board, 'd8'), { type: 'r', color: 'b' });
  assert.deepEqual(pieceAt(solver.board, 'c8'), { type: 'k', color: 'b' });
});

test('promotion: only the piece of the solution is right; a knight that mates is the underpromotion', () => {
  const p = load('puzzle-k2eHg.json');
  const solver = new Solver(startOf(p), p.puzzle.solution);
  solver.tryMove(solver.expected!);
  solver.reply();
  assert.equal(solver.promotes('g7', 'g8'), true);
  assert.equal(solver.promotes('f4', 'f5'), false);
  assert.equal(solver.tryMove(uciOf('g7g8r')), 'wrong');
  assert.equal(solver.tryMove(uciOf('g7g8q')), 'solved');

  const under = load('puzzle-2WyFZ.json');
  const s2 = new Solver(startOf(under), under.puzzle.solution);
  assert.equal(s2.tryMove(uciOf('c7c8q')), 'wrong', 'a queen is not mate here');
  assert.equal(s2.tryMove(uciOf('c7c8n')), 'solved');
  assert.equal(s2.altMate, false);
});

test('an alternative mate in one is accepted (Lichess convention), any other move is wrong, nonsense is illegal', () => {
  // Two rooks, both can mate on the back rank; the solution names one.
  const start = startAt('6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1', ['a1a8']);
  const other = new Solver(start, ['a1a8']);
  assert.equal(other.tryMove(uciOf('a1a7')), 'wrong');
  assert.equal(other.tryMove(uciOf('h2h5')), 'illegal');
  assert.equal(other.tryMove(uciOf('b1b8')), 'solved');
  assert.equal(other.altMate, true);
  assert.equal(other.done, true);
  // The real mate in one of the fixtures, and its only answer.
  const p = load('puzzle-YynlB.json');
  const s = new Solver(startOf(p), p.puzzle.solution);
  assert.equal(s.tryMove(uciOf('f8h7')), 'solved');
});

test('the solver only moves its own pieces, on its own turn', () => {
  const p = load('daily-3Ksou.json');
  const s = new Solver(startOf(p), p.puzzle.solution);
  assert.deepEqual(s.targets('h3'), [], "the opponent's king");
  assert.ok(s.targets('g6').includes('f4'));
  assert.equal(s.tryMove(uciOf('g6f4')), 'right');
  assert.equal(s.replyDue, true);
  assert.deepEqual(s.targets('e6'), [], 'not while the opponent is to answer');
  assert.equal(s.tryMove(uciOf('e6h6')), 'illegal');
  assert.deepEqual(s.reply(), uciOf('e3f4'));
  assert.equal(s.checkSquare, null);
  assert.equal(s.tryMove(uciOf('e6h6')), 'right');
  assert.equal(s.checkSquare, 'h3', 'Rh6+ checks the king on h3');
});

test('localSan: piece letters of a language, castling untouched', () => {
  assert.equal(localSan('Qxd4+', PIECE_LETTERS.de!), 'Dxd4+');
  assert.equal(localSan('O-O-O', PIECE_LETTERS.es!), 'O-O-O');
  assert.equal(localSan('g8=Q#', PIECE_LETTERS.es!), 'g8=D#');
  assert.equal(localSan('Nf3', {}), 'Nf3');
});
