/**
 * Solving the puzzle with a pad: a cursor over the board, a button to pick
 * a piece up and put it down. What each button does, and what the board
 * shows meanwhile (the legal squares of the piece in hand, a shake on a
 * wrong move, the opponent's answer sliding in), as a plain state machine
 * driven by the buttons and the clock, so it can be tested without a panel.
 *
 * Buttons (the Play page's pad; keyboard in brackets):
 *   arrows, L/R (arrows, WASD)   move the cursor
 *   A or X (Space, Enter)        pick up the piece under the cursor / put it down
 *   B (E, F)                     put the piece back
 *   Y (Shift)                    hint: the piece to move (again: the cursor goes to it)
 *   Select (Tab, M)              give up (twice): the solution plays out
 *   Start (Esc)                  once it is over: play it again
 */
import type { PadKey } from '@kiosko/sdk';
import { boardOf, fileOf, pieceAt, rankOf, Solver, squareOf, uciOf, type Board, type Color, type Piece, type PieceType, type Start, type Uci } from './puzzle.ts';
import type { Outcome } from './store.ts';

export type Phase =
  /** Your move. */
  | 'play'
  /** A pawn reached the last rank: which piece? */
  | 'promote'
  /** Right move: the opponent answers. */
  | 'reply'
  /** Solved: the end position, A plays the solution again. */
  | 'solved'
  /** Given up: the solution plays out, then stays. */
  | 'gaveUp';

export type Message = 'yourMove' | 'wrong' | 'good' | 'solved' | 'altMate' | 'hint' | 'confirmGiveUp' | 'gaveUp' | 'promote' | 'opponent' | 'replay' | 'alreadySolved';

/** A piece on its way from one square to another. */
export interface Slide {
  from: string;
  to: string;
  piece: Piece;
  start: number;
}

export const SLIDE_MS = 260;
export const REPLY_DELAY_MS = 420;
export const SHAKE_MS = 480;
export const REPEAT_DELAY_MS = 320;
export const REPEAT_EVERY_MS = 110;
export const STEP_MS = 1100;
export const GIVE_UP_CONFIRM_MS = 3000;
export const PROMOTIONS: PieceType[] = ['q', 'r', 'b', 'n'];

/** What to paint now. */
export interface View {
  board: Board;
  /** The solver's colour is at the bottom. */
  orientation: Color;
  cursor: string;
  selected: string | null;
  targets: string[];
  lastMove: Uci | null;
  hint: string | null;
  check: string | null;
  /** The piece moving, 0..1 along the way; it is not drawn on its square meanwhile. */
  slide: { from: string; to: string; piece: Piece; t: number } | null;
  /** Sideways shake of the board after a wrong move, in squares (signed). */
  shake: number;
  /** The square a wrong move was tried from, while it shakes. */
  wrong: string | null;
  phase: Phase;
  message: Message;
  /** The promotion picker, when open: the piece pointed at. */
  promo: { to: string; color: Color; index: number } | null;
  mistakes: number;
  hints: number;
  /** Your moves played and to play. */
  moves: { done: number; total: number };
  /** Index of the solution move last shown (for the notation), -1 before the first. */
  step: number;
}

const DIRS: Partial<Record<PadKey, [number, number]>> = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0], l: [-1, 0], r: [1, 0] };

export class PlayMachine {
  readonly start: Start;
  private solution: string[];
  private solver: Solver;
  phase: Phase = 'play';
  message: Message = 'yourMove';
  cursor: string;
  selected: string | null = null;
  hint: string | null = null;
  mistakes = 0;
  hints = 0;
  private hintPly = -1;
  private promoState: { from: string; to: string; index: number } | null = null;
  private slide: Slide | null = null;
  private shakeAt: number | null = null;
  private wrongFrom: string | null = null;
  private replyAt: number | null = null;
  private giveUpUntil = 0;
  private lastMove: Uci | null;
  /** Solution playback (giving up, or watching it again): positions shown step by step. */
  private playback: { step: number; nextAt: number } | null = null;
  private held = new Map<PadKey, { since: number; last: number }>();
  /** What happened, for the record: called once, when it is solved or given up. */
  onOutcome: ((o: Pick<Outcome, 'result' | 'mistakes' | 'hints'>) => void) | undefined;
  private reported = false;
  private boards = new Map<string, Board>();

  constructor(start: Start, solution: string[], o: { now: number; done?: Outcome | null } = { now: 0 }) {
    this.start = start;
    this.solution = solution;
    this.solver = new Solver(start, solution);
    this.lastMove = start.lastMove;
    this.cursor = start.lastMove?.to ?? (start.turn === 'w' ? 'e2' : 'e7');
    if (o.done) {
      // Already solved (or given up) today: the end position, ready to watch or play again.
      this.reported = true;
      this.solver.playOut();
      this.phase = 'solved';
      this.message = 'alreadySolved';
      this.mistakes = o.done.mistakes;
      this.hints = o.done.hints;
      this.lastMove = uciOf(solution[solution.length - 1]!);
    }
  }

  get orientation(): Color {
    return this.start.turn;
  }
  get ply(): number {
    return this.solver.ply;
  }

  /** A button pressed. */
  press(key: PadKey, now: number): void {
    if (DIRS[key]) this.held.set(key, { since: now, last: now });
    this.act(key, now);
  }

  /** A button let go. */
  release(key: PadKey): void {
    this.held.delete(key);
  }

  private act(key: PadKey, now: number): void {
    if (this.phase === 'promote') return this.promoKey(key, now);
    const dir = DIRS[key];
    if (dir) return this.moveCursor(dir);
    switch (key) {
      case 'a':
      case 'x':
        if (this.phase === 'solved' || this.phase === 'gaveUp') return this.watch(now);
        return this.pick(now);
      case 'b':
        this.selected = null;
        return;
      case 'y':
        return this.askHint();
      case 'select':
        return this.giveUp(now);
      case 'start':
        if (this.phase === 'solved' || this.phase === 'gaveUp') this.restart(now);
        return;
      default:
        return;
    }
  }

  private moveCursor([df, dr]: [number, number]): void {
    // The board is seen from the solver's side: up is towards the far rank.
    const s = this.orientation === 'w' ? 1 : -1;
    const f = Math.max(0, Math.min(7, fileOf(this.cursor) + df * s));
    const r = Math.max(1, Math.min(8, rankOf(this.cursor) + dr * s));
    this.cursor = squareOf(f, r);
  }

  private own(square: string): boolean {
    const p = pieceAt(this.solver.board, square);
    return !!p && p.color === this.orientation;
  }

  private pick(now: number): void {
    if (this.phase !== 'play') return;
    const sq = this.cursor;
    if (!this.selected) {
      if (this.own(sq)) this.selected = sq;
      return;
    }
    if (sq === this.selected) {
      this.selected = null;
      return;
    }
    if (this.own(sq)) {
      this.selected = sq;
      return;
    }
    if (!this.solver.targets(this.selected).includes(sq)) return;
    if (this.solver.promotes(this.selected, sq)) {
      this.promoState = { from: this.selected, to: sq, index: 0 };
      this.phase = 'promote';
      this.message = 'promote';
      return;
    }
    this.play({ from: this.selected, to: sq }, now);
  }

  private promoKey(key: PadKey, now: number): void {
    const p = this.promoState!;
    if (key === 'left' || key === 'up' || key === 'l') p.index = (p.index + PROMOTIONS.length - 1) % PROMOTIONS.length;
    else if (key === 'right' || key === 'down' || key === 'r') p.index = (p.index + 1) % PROMOTIONS.length;
    else if (key === 'a' || key === 'x') {
      this.promoState = null;
      this.phase = 'play';
      this.play({ from: p.from, to: p.to, promotion: PROMOTIONS[p.index]! }, now);
    } else if (key === 'b') {
      this.promoState = null;
      this.selected = null;
      this.phase = 'play';
      this.message = 'yourMove';
    }
  }

  /** Tries a move (also what the cursor and A end up doing). */
  play(m: Uci, now: number): void {
    const piece = pieceAt(this.solver.board, m.from);
    const verdict = this.solver.tryMove(m);
    if (verdict === 'illegal') return;
    if (verdict === 'wrong') {
      this.mistakes++;
      this.shakeAt = now;
      this.wrongFrom = m.from;
      this.selected = null;
      this.message = 'wrong';
      return;
    }
    this.selected = null;
    this.hint = null;
    this.giveUpUntil = 0;
    this.lastMove = m;
    if (piece) this.slide = { from: m.from, to: m.to, piece, start: now };
    if (verdict === 'solved') {
      this.phase = 'solved';
      this.message = this.solver.altMate ? 'altMate' : 'solved';
      this.report('solved');
      return;
    }
    this.phase = 'reply';
    this.message = 'good';
    this.replyAt = now + SLIDE_MS + REPLY_DELAY_MS;
  }

  private askHint(): void {
    if (this.phase !== 'play') return;
    const want = this.solver.expected;
    if (!want) return;
    if (this.hint === want.from) {
      // Asked again: the cursor goes to it.
      this.cursor = want.from;
      return;
    }
    this.hint = want.from;
    if (this.hintPly !== this.solver.ply) this.hints++;
    this.hintPly = this.solver.ply;
    this.message = 'hint';
  }

  private giveUp(now: number): void {
    if (this.phase !== 'play' && this.phase !== 'reply') return;
    if (now > this.giveUpUntil) {
      this.giveUpUntil = now + GIVE_UP_CONFIRM_MS;
      this.message = 'confirmGiveUp';
      return;
    }
    const from = this.solver.ply;
    this.solver.playOut();
    this.selected = null;
    this.hint = null;
    this.slide = null;
    this.replyAt = null;
    this.phase = 'gaveUp';
    this.message = 'gaveUp';
    this.report('gaveUp');
    // The rest of the solution, one move at a time, from where it was left.
    this.playback = { step: from, nextAt: now + STEP_MS / 2 };
  }

  /** Plays the whole solution again from the puzzle's position, slowly. */
  private watch(now: number): void {
    this.playback = { step: 0, nextAt: now + STEP_MS / 2 };
    this.message = 'replay';
    this.slide = null;
  }

  /** The whole solution played out from the puzzle's position, with no one playing (nothing is reported). */
  demo(now: number): void {
    this.restart(now);
    this.solver.playOut();
    this.phase = 'solved';
    this.message = 'replay';
    this.playback = { step: 0, nextAt: now + STEP_MS / 2 };
  }

  /** Back to the start, to solve it again (the record keeps the first result). */
  restart(now: number): void {
    this.solver = new Solver(this.start, this.solution);
    this.phase = 'play';
    this.message = 'yourMove';
    this.selected = null;
    this.hint = null;
    this.hintPly = -1;
    this.mistakes = 0;
    this.hints = 0;
    this.playback = null;
    this.slide = null;
    this.replyAt = null;
    this.shakeAt = null;
    this.giveUpUntil = 0;
    this.lastMove = this.start.lastMove;
    this.cursor = this.start.lastMove?.to ?? this.cursor;
    void now;
  }

  private report(result: Outcome['result']): void {
    if (this.reported) return;
    this.reported = true;
    this.onOutcome?.({ result, mistakes: this.mistakes, hints: this.hints });
  }

  /** Time passes: held arrows repeat, the opponent answers, the playback steps on. */
  tick(now: number): void {
    for (const [key, h] of this.held) {
      if (now - h.since >= REPEAT_DELAY_MS && now - h.last >= REPEAT_EVERY_MS) {
        h.last = now;
        this.act(key, now);
      }
    }
    if (this.shakeAt !== null && now - this.shakeAt > SHAKE_MS) {
      this.shakeAt = null;
      this.wrongFrom = null;
      if (this.message === 'wrong' && this.phase === 'play') this.message = 'yourMove';
    }
    if (this.giveUpUntil && now > this.giveUpUntil && this.message === 'confirmGiveUp') {
      this.giveUpUntil = 0;
      this.message = 'yourMove';
    }
    if (this.slide && now - this.slide.start >= SLIDE_MS) this.slide = null;
    if (this.replyAt !== null && now >= this.replyAt) {
      this.replyAt = null;
      const board = this.solver.board;
      const m = this.solver.reply();
      if (m) {
        const piece = pieceAt(board, m.from);
        if (piece) this.slide = { from: m.from, to: m.to, piece, start: now };
        this.lastMove = m;
      }
      this.phase = 'play';
      this.message = 'yourMove';
      // The cursor follows the game: to the square the opponent moved to.
      if (m) this.cursor = m.to;
    }
    if (this.playback && now >= this.playback.nextAt) {
      const total = this.solution.length;
      if (this.playback.step >= total) this.playback = null;
      else {
        const before = this.boardAt(this.playback.step);
        const m = uciOf(this.solution[this.playback.step]!);
        const piece = pieceAt(before, m.from);
        if (piece) this.slide = { from: m.from, to: m.to, piece, start: now };
        this.lastMove = m;
        this.playback.step++;
        this.playback.nextAt = now + STEP_MS;
      }
    }
  }

  /** The board after `n` solution moves. */
  private boardAt(n: number): Board {
    const fen = n === 0 ? this.start.fen : this.start.after[n - 1]!;
    let b = this.boards.get(fen);
    if (!b) {
      b = boardOf(fen);
      this.boards.set(fen, b);
    }
    return b;
  }

  view(now: number): View {
    const showing = this.playback ? this.playback.step : this.solver.ply;
    const board = this.playback ? this.boardAt(this.playback.step) : this.boardAt(Math.min(this.solver.ply, this.solution.length));
    const altBoard = this.solver.altMate && !this.playback ? this.solver.board : null;
    const shakeT = this.shakeAt === null ? 1 : (now - this.shakeAt) / SHAKE_MS;
    const shake = shakeT >= 1 ? 0 : Math.sin(shakeT * Math.PI * 6) * (1 - shakeT) * 0.16;
    const slide = this.slide && now - this.slide.start < SLIDE_MS ? { from: this.slide.from, to: this.slide.to, piece: this.slide.piece, t: Math.max(0, (now - this.slide.start) / SLIDE_MS) } : null;
    const total = Math.ceil(this.solution.length / 2);
    const p = this.promoState;
    return {
      board: altBoard ?? board,
      orientation: this.orientation,
      cursor: this.cursor,
      selected: this.selected,
      targets: this.selected && this.phase === 'play' ? this.solver.targets(this.selected) : [],
      lastMove: this.lastMove,
      hint: this.phase === 'play' ? this.hint : null,
      check: this.playback || this.phase === 'gaveUp' ? null : this.solver.checkSquare,
      slide,
      shake,
      wrong: this.shakeAt === null ? null : this.wrongFrom,
      phase: this.phase,
      message: this.message,
      promo: p ? { to: p.to, color: this.orientation, index: p.index } : null,
      mistakes: this.mistakes,
      hints: this.hints,
      moves: { done: Math.min(total, Math.ceil(Math.min(showing, this.solution.length) / 2)), total },
      step: showing - 1,
    };
  }
}
