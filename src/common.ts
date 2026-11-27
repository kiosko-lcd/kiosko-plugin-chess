/** What the widgets and the interlude share: the source's data, colours and a few drawing helpers. */
import type { Graphics, RenderContext } from '@kiosko/sdk';
import type { Account, Daily, Games } from './lichess.ts';
import type { Start } from './puzzle.ts';
import type { Outcome } from './store.ts';

export const SOURCE = 'chess/lichess';
/** The smallest text drawn, in px of the box: readable on a panel across the desk. */
export const MIN_PX = 11;

/** What the `chess/lichess` source hands the widgets. */
export interface ChessData {
  /** Today's puzzle, or null before it could be read. */
  daily: Daily | null;
  /** Its position and solution, worked out once. */
  start: Start | null;
  /** What you did with it, if anything yet. */
  outcome: Outcome | null;
  /** Days in a row with the daily puzzle solved. */
  streak: number;
  /** A Lichess token is set (for the account and games). */
  token: boolean;
  account?: Account;
  games?: Games;
  /** Why something is missing (Lichess unreachable, a token refused). */
  error?: string;
  at: number;
}

export type Ctx = RenderContext<any, any>;

export const dataOf = (sources: Record<string, unknown>): ChessData | undefined => sources[SOURCE] as ChessData | undefined;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The marks on the board, in colours that read on both board themes whatever the panel's theme. */
export const MARKS = { accent: '#1F6FE5', ok: '#1FA34A', alert: '#E5372B' };

/** Paints inside the box only, whatever happens. */
export function clipped(g: Graphics, box: { x: number; y: number; w: number; h: number }, paint: () => void): void {
  g.save();
  g.beginPath();
  g.rect(box.x, box.y, box.w, box.h);
  g.clip();
  try {
    paint();
  } finally {
    g.restore();
  }
}

/** A message in the middle of the box, with an optional second line; never outside it (fonts differ from system to system). */
export function drawMessage(g: Graphics, ctx: Ctx, text: string, sub?: string): void {
  clipped(g, ctx.box, () => paintMessage(g, ctx, text, sub));
}

function paintMessage(g: Graphics, ctx: Ctx, text: string, sub?: string): void {
  const { box, kit, theme } = ctx;
  const c = theme.colors;
  const size = clamp(Math.round(Math.min(box.h * 0.3, box.w / 12)), MIN_PX, 26);
  const subSize = clamp(Math.round(size * 0.66), MIN_PX, 18);
  const font = { size, family: theme.fonts.sans, color: c.inkDim };
  const f2 = { size: subSize, family: theme.fonts.sans, color: c.inkFaint };
  const lines = kit.wrapLines(g, text, box.w, box.h >= size * 3 ? 2 : 1, font);
  const subLines = sub ? kit.wrapLines(g, sub, box.w, 2, f2) : [];
  let keep = subLines.length;
  const h = (n: number) => lines.length * size * 1.25 + (n ? subSize * 0.5 + n * subSize * 1.25 : 0);
  while (keep > 0 && h(keep) > box.h) keep--;
  let y = box.y + (box.h - h(keep)) / 2;
  for (const l of lines) {
    y += size * 1.25;
    kit.drawTracked(g, l, box.x, y - size * 0.3, font);
  }
  y += subSize * 0.5;
  for (const l of subLines.slice(0, keep)) {
    y += subSize * 1.25;
    kit.drawTracked(g, l, box.x, y - subSize * 0.3, f2);
  }
}

/** A small king of a colour, as a "to move" mark beside a text (s: its side). */
export function turnDot(g: Graphics, x: number, y: number, s: number, white: boolean): void {
  g.save();
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s / 2 - 0.75, 0, Math.PI * 2);
  g.fillStyle = white ? '#F7F3E8' : '#24262A';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = white ? '#16181B' : '#9AA0A6';
  g.stroke();
  g.restore();
}
