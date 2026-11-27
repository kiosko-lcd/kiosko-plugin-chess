/**
 * The board: squares in one of two themes, the last move, the piece in hand
 * and where it may go, the cursor, the hint, a king in check, coordinates
 * when there is room, and the pieces (pieces.ts). Shared by the widgets and
 * the interlude; text goes through `text` so each paints it its own way.
 */
import type { Graphics } from '@kiosko/sdk';
import { drawPiece } from './pieces.ts';
import { fileOf, rankOf, type Board, type Color, type Piece } from './puzzle.ts';

export interface BoardTheme {
  light: string;
  dark: string;
  /** Text of the coordinates on light and dark squares. */
  onLight: string;
  onDark: string;
  lastMove: string;
}

/** Two of the plugin's own: warm wood, and cool slate for blue and dark panel themes. */
export const BOARD_THEMES: Record<'wood' | 'slate', BoardTheme> = {
  wood: { light: '#EBD8B7', dark: '#B4875C', onLight: '#9A7149', onDark: '#F3E6CF', lastMove: 'rgba(240, 200, 60, 0.5)' },
  slate: { light: '#D6DEE3', dark: '#71889A', onLight: '#5E7385', onDark: '#E7EDF1', lastMove: 'rgba(120, 200, 255, 0.45)' },
};
export type BoardThemeId = keyof typeof BOARD_THEMES;

export interface BoardMarks {
  lastMove?: { from: string; to: string } | null;
  selected?: string | null;
  targets?: string[];
  cursor?: string | null;
  hint?: string | null;
  check?: string | null;
  wrong?: string | null;
  slide?: { from: string; to: string; piece: Piece; t: number } | null;
}

export interface BoardPaint extends BoardMarks {
  /** Top left corner and side; the side is rounded down to a multiple of 8. */
  x: number;
  y: number;
  size: number;
  board: Board;
  /** Whose side is at the bottom. */
  orientation: Color;
  theme: BoardTheme;
  /** Colours of the panel's theme for the marks. */
  accent: string;
  ok: string;
  alert: string;
  coords?: boolean;
  /** Paints a coordinate letter (size in px, baseline y). */
  text?: (s: string, x: number, y: number, size: number, color: string, align: 'left' | 'right') => void;
}

/** The smallest coordinate text. */
export const COORD_MIN_PX = 11;
/** Coordinates only on squares at least this big (smaller, they cover the pieces). */
export const COORD_MIN_SQUARE = 36;

/** Side of one square for a board of `size` px. */
export const squareSize = (size: number): number => Math.max(1, Math.floor(size / 8));

/** Column and row on screen (0..7, top left first) of a square, seen from `orientation`. */
export function cellOf(square: string, orientation: Color): { col: number; row: number } {
  const f = fileOf(square);
  const r = rankOf(square);
  return orientation === 'w' ? { col: f, row: 8 - r } : { col: 7 - f, row: r - 1 };
}

export function drawBoard(g: Graphics, p: BoardPaint): void {
  const sq = squareSize(p.size);
  const x0 = Math.round(p.x);
  const y0 = Math.round(p.y);
  const at = (square: string) => {
    const { col, row } = cellOf(square, p.orientation);
    return { x: x0 + col * sq, y: y0 + row * sq };
  };
  g.save();
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      g.fillStyle = (row + col) % 2 === 0 ? p.theme.light : p.theme.dark;
      g.fillRect(x0 + col * sq, y0 + row * sq, sq, sq);
    }
  // The last move: both squares tinted.
  if (p.lastMove) {
    g.fillStyle = p.theme.lastMove;
    for (const s of [p.lastMove.from, p.lastMove.to]) {
      const c = at(s);
      g.fillRect(c.x, c.y, sq, sq);
    }
  }
  if (p.check) {
    const c = at(p.check);
    const grad = g.createRadialGradient(c.x + sq / 2, c.y + sq / 2, sq * 0.1, c.x + sq / 2, c.y + sq / 2, sq * 0.7);
    grad.addColorStop(0, 'rgba(230, 40, 30, 0.95)');
    grad.addColorStop(1, 'rgba(230, 40, 30, 0)');
    g.fillStyle = grad;
    g.fillRect(c.x, c.y, sq, sq);
  }
  if (p.selected) {
    const c = at(p.selected);
    g.fillStyle = withAlpha(p.accent, 0.55);
    g.fillRect(c.x, c.y, sq, sq);
  }
  if (p.wrong) {
    const c = at(p.wrong);
    g.fillStyle = withAlpha(p.alert, 0.6);
    g.fillRect(c.x, c.y, sq, sq);
  }
  if (p.coords && sq >= COORD_MIN_SQUARE && p.text) {
    const size = Math.max(COORD_MIN_PX, Math.round(sq * 0.24));
    for (let i = 0; i < 8; i++) {
      // Files along the bottom row, ranks down the left column.
      const file = p.orientation === 'w' ? i : 7 - i;
      const onDark = (7 + i) % 2 === 1;
      p.text(String.fromCharCode(97 + file), x0 + (i + 1) * sq - 2, y0 + 8 * sq - 3, size, onDark ? p.theme.onDark : p.theme.onLight, 'right');
      const rank = p.orientation === 'w' ? 8 - i : i + 1;
      p.text(String(rank), x0 + 2, y0 + i * sq + size, size, i % 2 === 1 ? p.theme.onDark : p.theme.onLight, 'left');
    }
  }
  // The pieces, but not the one on its way somewhere.
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const rank = p.orientation === 'w' ? 8 - row : row + 1;
      const file = p.orientation === 'w' ? col : 7 - col;
      const piece = p.board[8 - rank]?.[file];
      if (!piece) continue;
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      if (p.slide && p.slide.to === square) continue;
      drawPiece(g, piece.type, piece.color, x0 + col * sq, y0 + row * sq, sq);
    }
  // Where the piece in hand may go: a dot on an empty square, a ring around a piece.
  if (p.targets?.length) {
    g.fillStyle = 'rgba(20, 30, 40, 0.38)';
    g.strokeStyle = 'rgba(20, 30, 40, 0.42)';
    for (const t of p.targets) {
      const c = at(t);
      const occupied = !!p.board[8 - rankOf(t)]?.[fileOf(t)];
      g.beginPath();
      if (occupied) {
        g.lineWidth = Math.max(2, sq * 0.09);
        g.arc(c.x + sq / 2, c.y + sq / 2, sq * 0.45, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.arc(c.x + sq / 2, c.y + sq / 2, Math.max(2, sq * 0.15), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  if (p.slide) {
    const a = at(p.slide.from);
    const b = at(p.slide.to);
    const t = ease(Math.min(1, Math.max(0, p.slide.t)));
    drawPiece(g, p.slide.piece.type, p.slide.piece.color, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, sq);
  }
  if (p.hint) {
    const c = at(p.hint);
    frame(g, c.x, c.y, sq, p.ok, Math.max(2, sq * 0.1));
  }
  if (p.cursor) {
    const c = at(p.cursor);
    frame(g, c.x, c.y, sq, p.accent, Math.max(2, Math.round(sq * 0.11)));
  }
  g.restore();
}

/** A square's outline drawn inside it. */
function frame(g: Graphics, x: number, y: number, s: number, color: string, w: number): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.strokeRect(x + w / 2, y + w / 2, s - w, s - w);
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** `#RRGGBB` with an alpha, as rgba(). Other colours as they are. */
export function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
