/**
 * The chess of it: a Lichess puzzle replayed from its game's moves to the
 * position you solve, and the moves you try, checked against the solution.
 * Move generation is chess.js's (BSD-2-Clause, see NOTICE).
 */
import { Chess, type Square } from 'chess.js';

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface Piece {
  type: PieceType;
  color: Color;
}
/** 8×8, rank 8 first (row 0 = a8..h8), as chess.js gives it. */
export type Board = (Piece | null)[][];

/** A player of the puzzle's game, as Lichess names them. */
export interface Player {
  name: string;
  id?: string;
  color: 'white' | 'black';
  rating?: number;
  title?: string;
}

/** What `/api/puzzle/daily` and `/api/puzzle/{id}` answer, the parts used here. */
export interface LichessPuzzle {
  game: { id: string; perf?: { key?: string; name?: string }; rated?: boolean; clock?: string; players: Player[]; pgn: string };
  puzzle: { id: string; rating: number; plays?: number; solution: string[]; themes: string[]; fen?: string; lastMove?: string; initialPly: number };
}

/** Throws unless `j` looks like a Lichess puzzle; returns it typed. */
export function parsePuzzle(j: unknown): LichessPuzzle {
  const o = j as Partial<LichessPuzzle> | null;
  const p = o?.puzzle;
  const g = o?.game;
  if (!p || typeof p.id !== 'string' || !Array.isArray(p.solution) || !p.solution.length || !p.solution.every((m) => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)))
    throw new Error('not a Lichess puzzle: no solution');
  if (!g || typeof g.pgn !== 'string') throw new Error('not a Lichess puzzle: no game');
  if (typeof p.initialPly !== 'number') throw new Error('not a Lichess puzzle: no initialPly');
  return {
    game: { id: String(g.id ?? ''), ...(g.perf ? { perf: g.perf } : {}), ...(g.clock ? { clock: g.clock } : {}), rated: !!g.rated, players: Array.isArray(g.players) ? g.players : [], pgn: g.pgn },
    puzzle: {
      id: p.id,
      rating: Number(p.rating) || 0,
      ...(typeof p.plays === 'number' ? { plays: p.plays } : {}),
      solution: p.solution,
      themes: Array.isArray(p.themes) ? p.themes.filter((t) => typeof t === 'string') : [],
      ...(p.fen ? { fen: p.fen } : {}),
      ...(p.lastMove ? { lastMove: p.lastMove } : {}),
      initialPly: p.initialPly,
    },
  };
}

/** A move as squares: `e2e4`, `e7e8q`. */
export interface Uci {
  from: string;
  to: string;
  promotion?: PieceType;
}
export const uciOf = (m: string): Uci => ({ from: m.slice(0, 2), to: m.slice(2, 4), ...(m.length > 4 ? { promotion: m[4] as PieceType } : {}) });
export const uciText = (m: Uci): string => `${m.from}${m.to}${m.promotion ?? ''}`;

/** The position you solve from, and how the game got there. */
export interface Start {
  fen: string;
  /** Whose move it is: the solver's colour. */
  turn: Color;
  /** The move number of the solver's first move (the game's own, for notation). */
  moveNumber: number;
  /** The opponent's move that sets the puzzle. */
  lastMove: Uci | null;
  lastSan: string | null;
  /** The solution as SAN, from the start position. */
  solutionSan: string[];
  /** Positions after each solution move (FEN), index 0 = after the first. */
  after: string[];
  /** The last solution move mates. */
  mate: boolean;
}

/** The SAN moves of Lichess's puzzle PGN ("Nf3 Nf6 d4 …", sometimes with move numbers). */
export function sanMoves(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.(\.\.)?/, ''))
    .filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t) && !/^\$\d+$/.test(t));
}

/** The four first fields of a FEN: board, turn, castling, en passant. */
const fenKey = (fen: string) => fen.split(' ').slice(0, 2).join(' ');

/**
 * Replays the game's PGN up to the puzzle (`initialPly` + 1 moves, the last
 * one being the opponent's) and the solution from there. Checks the result
 * against the puzzle's FEN when Lichess gives one. Throws if a move is not
 * legal (a broken puzzle is not shown).
 */
export function startOf(p: LichessPuzzle): Start {
  const chess = new Chess();
  const moves = sanMoves(p.game.pgn);
  const upto = p.puzzle.initialPly + 1;
  if (moves.length < upto) throw new Error(`puzzle ${p.puzzle.id}: the game has ${moves.length} moves, the puzzle starts after ${upto}`);
  let last: { from: string; to: string; san: string; promotion?: string } | null = null;
  for (const san of moves.slice(0, upto)) {
    try {
      last = chess.move(san);
    } catch {
      throw new Error(`puzzle ${p.puzzle.id}: illegal move in the game: ${san}`);
    }
  }
  const fen = chess.fen();
  if (p.puzzle.fen && fenKey(p.puzzle.fen) !== fenKey(fen)) throw new Error(`puzzle ${p.puzzle.id}: the game does not reach the puzzle's position`);
  if (p.puzzle.lastMove && last && `${last.from}${last.to}` !== p.puzzle.lastMove.slice(0, 4)) throw new Error(`puzzle ${p.puzzle.id}: the game's last move is not the puzzle's`);
  const turn = chess.turn() as Color;
  const moveNumber = Number(fen.split(' ')[5]) || 1;
  const solutionSan: string[] = [];
  const after: string[] = [];
  for (const m of p.puzzle.solution) {
    try {
      solutionSan.push(chess.move(uciOf(m)).san);
    } catch {
      throw new Error(`puzzle ${p.puzzle.id}: illegal move in the solution: ${m}`);
    }
    after.push(chess.fen());
  }
  return {
    fen,
    turn,
    moveNumber,
    lastMove: last ? { from: last.from, to: last.to, ...(last.promotion ? { promotion: last.promotion as PieceType } : {}) } : null,
    lastSan: last?.san ?? null,
    solutionSan,
    after,
    mate: chess.isCheckmate(),
  };
}

/** A start from a bare position (no game before it): for tests and positions typed by hand. */
export function startAt(fen: string, solution: string[]): Start {
  const chess = new Chess(fen);
  const turn = chess.turn() as Color;
  const moveNumber = Number(fen.split(' ')[5]) || 1;
  const solutionSan: string[] = [];
  const after: string[] = [];
  for (const m of solution) {
    solutionSan.push(chess.move(uciOf(m)).san);
    after.push(chess.fen());
  }
  return { fen: new Chess(fen).fen(), turn, moveNumber, lastMove: null, lastSan: null, solutionSan, after, mate: chess.isCheckmate() };
}

/** The board of a FEN, rank 8 first. */
export function boardOf(fen: string): Board {
  return new Chess(fen).board().map((row) => row.map((sq) => (sq ? { type: sq.type as PieceType, color: sq.color as Color } : null)));
}

/** The piece on `square` ("e4") of a board, if any. */
export function pieceAt(board: Board, square: string): Piece | null {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]);
  return board[8 - r]?.[f] ?? null;
}

/** "e4" from file 0..7 and rank 1..8. */
export const squareOf = (file: number, rank: number): string => `${String.fromCharCode(97 + file)}${rank}`;
export const fileOf = (sq: string): number => sq.charCodeAt(0) - 97;
export const rankOf = (sq: string): number => Number(sq[1]);

/** What a move tried while solving did. */
export type Verdict =
  /** Not a legal move at all: nothing happens. */
  | 'illegal'
  /** Legal but not the solution: try again. */
  | 'wrong'
  /** The solution's move: the opponent answers next. */
  | 'right'
  /** The last move of the solution, or a mate: solved. */
  | 'solved';

/**
 * Solving a puzzle: the moves played so far along the solution. The solver
 * plays the even moves of the solution (0, 2, …) and the opponent the odd
 * ones. A move that mates is always right (Lichess accepts any mate, so an
 * alternative mate in one counts).
 */
export class Solver {
  readonly start: Start;
  readonly solution: Uci[];
  private chess: Chess;
  /** Index in the solution of the next move to play. */
  ply = 0;
  /** Solved by a mate other than the solution's. */
  altMate = false;

  constructor(start: Start, solution: string[]) {
    this.start = start;
    this.solution = solution.map(uciOf);
    this.chess = new Chess(start.fen);
  }

  get fen(): string {
    return this.chess.fen();
  }
  get board(): Board {
    return boardOf(this.chess.fen());
  }
  get turn(): Color {
    return this.chess.turn() as Color;
  }
  /** Solved: every move of the solution played, or a mate. */
  get done(): boolean {
    return this.altMate || this.ply >= this.solution.length;
  }
  /** It is the opponent's turn to answer. */
  get replyDue(): boolean {
    return !this.done && this.ply % 2 === 1;
  }
  /** The move the solver should play now (for hints and for giving up). */
  get expected(): Uci | null {
    return this.done || this.ply % 2 === 1 ? null : this.solution[this.ply]!;
  }
  /** The king in check, if any: its square. */
  get checkSquare(): string | null {
    if (!this.chess.inCheck()) return null;
    const color = this.chess.turn();
    for (const row of this.chess.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === color) return sq.square;
    return null;
  }

  /** Where the piece on `square` may go now (the solver's pieces only, on the solver's turn). */
  targets(square: string): string[] {
    if (this.done || this.ply % 2 === 1) return [];
    return [...new Set(this.chess.moves({ square: square as Square, verbose: true }).map((m) => m.to))];
  }
  /** A move from `from` to `to` would promote a pawn. */
  promotes(from: string, to: string): boolean {
    return this.chess.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && !!m.promotion);
  }

  /** The solver tries a move. Only a right move changes the position. */
  tryMove(m: Uci): Verdict {
    if (this.done || this.ply % 2 === 1) return 'illegal';
    const legal = this.chess.moves({ square: m.from as Square, verbose: true }).filter((x) => x.to === m.to);
    if (!legal.length) return 'illegal';
    const promotion = legal.some((x) => x.promotion) ? (m.promotion ?? 'q') : undefined;
    const want = this.solution[this.ply]!;
    const same = want.from === m.from && want.to === m.to && (want.promotion ?? undefined) === promotion;
    if (!same) {
      // A mate other than the solution's still wins.
      const probe = new Chess(this.chess.fen());
      probe.move({ from: m.from, to: m.to, ...(promotion ? { promotion } : {}) });
      if (!probe.isCheckmate()) return 'wrong';
      this.chess = probe;
      this.altMate = true;
      return 'solved';
    }
    this.chess.move({ from: m.from, to: m.to, ...(promotion ? { promotion } : {}) });
    this.ply++;
    return this.done ? 'solved' : 'right';
  }

  /** Plays the opponent's answer; returns it. */
  reply(): Uci | null {
    if (!this.replyDue) return null;
    const m = this.solution[this.ply]!;
    this.chess.move({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
    this.ply++;
    return m;
  }

  /** Plays the rest of the solution, both sides (giving up). Returns the moves played. */
  playOut(): Uci[] {
    const out: Uci[] = [];
    while (!this.done) {
      const m = this.solution[this.ply]!;
      this.chess.move({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) });
      this.ply++;
      out.push(m);
    }
    return out;
  }
}

/** The solution in notation: "23… Nf4+ 24. exf4 Rh6+". Pieces' letters as `letters` says (K Q R B N in English). */
export function solutionText(start: Start, letters: Record<string, string> = {}): string[] {
  const out: string[] = [];
  let n = start.moveNumber;
  let turn = start.turn;
  start.solutionSan.forEach((san, i) => {
    const local = localSan(san, letters);
    if (turn === 'w') out.push(`${n}. ${local}`);
    else out.push(i === 0 ? `${n}… ${local}` : local);
    if (turn === 'b') n++;
    turn = turn === 'w' ? 'b' : 'w';
  });
  return out;
}

/** SAN with the pieces' letters of a language (`{ N: 'C', B: 'A', R: 'T', Q: 'D', K: 'R' }` in Spanish). */
export function localSan(san: string, letters: Record<string, string>): string {
  if (!Object.keys(letters).length) return san;
  return san.replace(/[KQRBN]/g, (c) => letters[c] ?? c);
}
