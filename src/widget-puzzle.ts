/**
 * `chess/puzzle`: today's puzzle at rest. The position (from the solver's
 * side, the opponent's last move marked), whose move it is, its rating and
 * themes; on a long strip the board on one side and the words on the other.
 * Once solved, or from the evening on, the solution plays on the board, one
 * move every two seconds, and is written out beside it.
 */
import { defineWidget, t, type Graphics } from '@kiosko/sdk';
import { BOARD_THEMES, drawBoard, squareSize, type BoardThemeId } from './board.ts';
import { clamp, clipped, dataOf, drawMessage, MARKS, MIN_PX, SOURCE, turnDot, type ChessData, type Ctx } from './common.ts';
import { demoData } from './demo.ts';
import { fill, L } from './i18n.ts';
import { boardOf, solutionText, uciOf, type Start } from './puzzle.ts';
import { DAILY, GAVE_UP, PIECE_LETTERS, PLAYS, RATING, SOLUTION, SOLVED_CLEAN, SOLVED_IN, STREAK, themeNames, TO_MOVE, UNAVAILABLE, UNAVAILABLE_SUB, WAITING, YOUR_RATING } from './texts.ts';

/** One solution move every this long while it is shown. */
export const STEP_MS = 2000;
/** Steps the end position stays before it starts again. */
const HOLD_STEPS = 2;
/** Boards smaller than this are not drawn: words only. */
export const MIN_BOARD = 88;

export const boardOption = t.enum(['wood', 'slate'] as const, {
  default: 'wood',
  label: L('Board', 'Tablero', 'Brett', '棋盘', '棋盤'),
  labels: {
    wood: L('Wood', 'Madera', 'Holz', '木纹', '木紋'),
    slate: L('Slate', 'Pizarra', 'Schiefer', '石板', '石板'),
  },
});
export const coordsOption = t.boolean({
  default: true,
  label: L('Coordinates', 'Coordenadas', 'Koordinaten', '坐标', '座標'),
  help: L('Letters and numbers on the edge squares, when they are big enough.', 'Letras y números en las casillas del borde, cuando son bastante grandes.', 'Buchstaben und Zahlen auf den Randfeldern, wenn sie groß genug sind.', '棋盘够大时，在边缘格子上显示字母和数字。', '棋盤夠大時，在邊緣格子上顯示字母和數字。'),
});

const options = t.object({
  board: boardOption,
  coordinates: coordsOption,
  reveal: t.enum(['evening', 'solved', 'never'] as const, {
    default: 'evening',
    label: L('Show the solution', 'Mostrar la solución', 'Lösung zeigen', '显示答案', '顯示答案'),
    labels: {
      evening: L('Once solved, or from the hour below', 'Al resolverlo, o desde la hora de abajo', 'Wenn gelöst, oder ab der Uhrzeit unten', '解出后，或从下面的时间起', '解出後，或從下面的時間起'),
      solved: L('Only once solved or given up', 'Solo al resolverlo o rendirse', 'Nur wenn gelöst oder aufgegeben', '仅在解出或放弃后', '僅在解出或放棄後'),
      never: L('Never', 'Nunca', 'Nie', '从不', '從不'),
    },
  }),
  revealHour: t.integer({
    default: 20,
    min: 0,
    max: 23,
    label: L('Solution from (hour)', 'Solución desde (hora)', 'Lösung ab (Uhr)', '答案显示时间（时）', '答案顯示時間（時）'),
  }),
  animate: t.boolean({
    default: true,
    label: L('Play the solution on the board', 'Reproducir la solución en el tablero', 'Lösung auf dem Brett abspielen', '在棋盘上演示答案', '在棋盤上演示答案'),
    help: L('One move every two seconds (a frame each).', 'Una jugada cada dos segundos (un fotograma cada una).', 'Ein Zug alle zwei Sekunden (je ein Bild).', '每两秒走一步（每步一帧）。', '每兩秒走一步（每步一幀）。'),
  }),
});

type Options = { board: BoardThemeId; coordinates: boolean; reveal: 'evening' | 'solved' | 'never'; revealHour: number; animate: boolean };

/** The solution is shown: solved or given up, or (if so set) from the evening of the puzzle's day. */
export function revealed(data: ChessData, o: Pick<Options, 'reveal' | 'revealHour'>, now: number): boolean {
  if (o.reveal === 'never') return false;
  if (data.outcome) return true;
  return o.reveal === 'evening' && new Date(now).getHours() >= o.revealHour;
}

/** Which solution move is on the board at `now` (0: the puzzle's position), cycling. */
export function stepAt(start: Start, now: number): number {
  const n = start.solutionSan.length;
  const k = Math.floor(now / STEP_MS) % (n + 1 + HOLD_STEPS);
  return Math.min(k, n);
}

type Area = { x: number; y: number; w: number; h: number };

export function layout(box: Area): { board: Area | null; text: Area | null; caption: boolean } {
  const min = Math.min(box.w, box.h);
  if (min < MIN_BOARD) return { board: null, text: box, caption: false };
  const gap = Math.max(8, Math.round(min * 0.05));
  if (box.w >= box.h * 1.45) {
    const side = squareSize(box.h) * 8;
    const rest = box.w - side - gap;
    if (rest < 80) return { board: { x: box.x + Math.floor((box.w - side) / 2), y: box.y + Math.floor((box.h - side) / 2), w: side, h: side }, text: null, caption: false };
    return { board: { x: box.x, y: box.y + Math.floor((box.h - side) / 2), w: side, h: side }, text: { x: box.x + side + gap, y: box.y, w: rest, h: box.h }, caption: false };
  }
  if (box.h >= box.w * 1.3) {
    const side = squareSize(box.w) * 8;
    const rest = box.h - side - gap;
    if (rest < MIN_PX * 2.6) return { board: { x: box.x + Math.floor((box.w - side) / 2), y: box.y, w: side, h: side }, text: null, caption: false };
    return { board: { x: box.x + Math.floor((box.w - side) / 2), y: box.y, w: side, h: side }, text: { x: box.x, y: box.y + side + gap, w: box.w, h: rest }, caption: false };
  }
  // Square-ish: the board, and one line under it if it fits.
  const capH = Math.round(MIN_PX * 1.7);
  const side = squareSize(Math.min(box.w, box.h - capH)) * 8;
  if (side < MIN_BOARD) return { board: { x: box.x + Math.floor((box.w - squareSize(min) * 8) / 2), y: box.y, w: squareSize(min) * 8, h: squareSize(min) * 8 }, text: null, caption: false };
  return { board: { x: box.x + Math.floor((box.w - side) / 2), y: box.y, w: side, h: side }, text: { x: box.x, y: box.y + side, w: box.w, h: box.h - side }, caption: true };
}

interface Line {
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  dot?: boolean;
  /** Solution tokens, the current one highlighted. */
  tokens?: { text: string; on: boolean }[];
}

/** Writes lines from the top of `area`, as many as fit; each wraps to `maxLines`. */
function drawLines(g: Graphics, ctx: Ctx, area: Area, lines: (Line & { maxLines?: number })[], white: boolean): void {
  const { kit, theme } = ctx;
  let y = area.y;
  for (const l of lines) {
    const family = l.bold ? theme.fonts.sansBold : theme.fonts.sans;
    const lh = Math.round(l.size * 1.32);
    if (y + lh > area.y + area.h + 1) break;
    if (l.tokens) {
      // The solution, move by move, wrapping on move boundaries.
      let x = area.x;
      const space = kit.measureTracked(g, ' ', { size: l.size, family });
      let lineNo = 0;
      for (const tk of l.tokens) {
        const w = kit.measureTracked(g, tk.text, { size: l.size, family: tk.on ? theme.fonts.sansBold : family });
        if (x > area.x && x + w > area.x + area.w) {
          lineNo++;
          if (lineNo >= (l.maxLines ?? 2) || y + lh * 2 > area.y + area.h + 1) break;
          y += lh;
          x = area.x;
        }
        if (w > area.w) break;
        kit.drawTracked(g, tk.text, x, y + l.size, { size: l.size, family: tk.on ? theme.fonts.sansBold : family, color: tk.on ? theme.colors.ink : l.color });
        x += w + space;
      }
      y += lh;
      continue;
    }
    let x = area.x;
    if (l.dot) {
      const d = Math.round(l.size * 0.8);
      turnDot(g, x, y + Math.round((lh - d) / 2) - 1, d, white);
      x += d + Math.round(l.size * 0.4);
    }
    const font = { size: l.size, family, color: l.color };
    const rows = kit.wrapLines(g, l.text, area.x + area.w - x, Math.max(1, Math.min(l.maxLines ?? 1, Math.floor((area.y + area.h - y) / lh))), font);
    for (const r of rows) {
      kit.drawTracked(g, r, x, y + l.size, font);
      y += lh;
    }
  }
}

function info(ctx: Ctx, data: ChessData, start: Start, step: number | null, sizes: { head: number; body: number }): (Line & { maxLines?: number })[] {
  const c = ctx.theme.colors;
  const p = data.daily!.puzzle;
  const out: (Line & { maxLines?: number })[] = [];
  out.push({ text: ctx.t(TO_MOVE[start.turn]), size: sizes.head, color: c.ink, bold: true, dot: true });
  const oc = data.outcome;
  if (oc) out.push({ text: oc.result === 'gaveUp' ? ctx.t(GAVE_UP) : oc.mistakes ? fill(ctx.t(SOLVED_IN), { n: oc.mistakes }) : ctx.t(SOLVED_CLEAN), size: sizes.body, color: oc.result === 'gaveUp' ? c.warn : c.ok, bold: true });
  if (step !== null) {
    const text = solutionText(start, PIECE_LETTERS[ctx.pickLanguage(['en', 'es', 'de'])] ?? {});
    out.push({ text: `${ctx.t(SOLUTION)}:`, size: sizes.body, color: c.inkDim, tokens: [{ text: `${ctx.t(SOLUTION)}:`, on: false }, ...text.map((s, i) => ({ text: s, on: i === step - 1 }))], maxLines: 3 });
  }
  const themes = themeNames(p.puzzle.themes, ctx.t);
  const meta = [fill(ctx.t(RATING), { n: p.puzzle.rating }), ...themes].join(' · ');
  out.push({ text: meta, size: sizes.body, color: c.inkDim, maxLines: 2 });
  const you: string[] = [];
  if (data.account?.rating) you.push(fill(ctx.t(YOUR_RATING), { n: data.account.rating }));
  if (data.streak > 1) you.push(fill(ctx.t(STREAK), { n: data.streak }));
  if (you.length) out.push({ text: you.join(' · '), size: sizes.body, color: c.inkDim, maxLines: 2 });
  const players = p.game.players.map((pl) => `${pl.title ? `${pl.title} ` : ''}${pl.name}${pl.rating ? ` ${pl.rating}` : ''}`);
  const game = [players.join(' – '), [p.game.perf?.name, p.game.clock].filter(Boolean).join(' '), p.puzzle.plays ? fill(ctx.t(PLAYS), { n: new Intl.NumberFormat(ctx.locale).format(p.puzzle.plays) }) : ''].filter(Boolean).join(' · ');
  if (game) out.push({ text: game, size: sizes.body, color: c.inkFaint });
  return out;
}

export function renderPuzzle(g: Graphics, ctx: Ctx): void {
  const data = dataOf(ctx.sources);
  const o = ctx.options as Options;
  const { box } = ctx;
  if (!data || (!data.daily && !data.error)) return drawMessage(g, ctx, ctx.t(WAITING));
  if (!data.daily || !data.start) return drawMessage(g, ctx, ctx.t(UNAVAILABLE), ctx.t(UNAVAILABLE_SUB));
  const start = data.start;
  const show = revealed(data, o, ctx.now);
  const n = start.solutionSan.length;
  const step = show ? (o.animate ? stepAt(start, ctx.now) : n) : null;
  const L0 = layout(box);
  const c = ctx.theme.colors;
  clipped(g, box, () => {
    if (L0.board) {
      const k = step ?? 0;
      const fen = k === 0 ? start.fen : start.after[k - 1]!;
      const last = k === 0 ? start.lastMove : uciOf(data.daily!.puzzle.puzzle.solution[k - 1]!);
      drawBoard(g, {
        x: L0.board.x,
        y: L0.board.y,
        size: L0.board.w,
        board: boardOf(fen),
        orientation: start.turn,
        theme: BOARD_THEMES[o.board] ?? BOARD_THEMES.wood,
        ...MARKS,
        lastMove: last,
        coords: o.coordinates,
        text: (s, x, y, size, color, align) => ctx.kit.drawTracked(g, s, x, y, { size, family: ctx.theme.fonts.sansBold, color, align }),
      });
    }
    const area = L0.text;
    if (!area) return;
    if (L0.caption) {
      // One line under a square board.
      const size = clamp(Math.round(area.h * 0.62), MIN_PX, 18);
      const text = `${ctx.t(TO_MOVE[start.turn])} · ${data.daily!.puzzle.puzzle.rating}`;
      const font = { size, family: ctx.theme.fonts.sansBold, color: c.ink };
      const d = Math.round(size * 0.8);
      const fit = ctx.kit.truncate(g, text, area.w - d - 6, font);
      const w = ctx.kit.measureTracked(g, fit, font) + d + 6;
      const x = area.x + Math.max(0, Math.floor((area.w - w) / 2));
      const y = area.y + Math.round((area.h + size * 0.7) / 2);
      turnDot(g, x, y - size * 0.75 - 1, d, start.turn === 'w');
      ctx.kit.drawTracked(g, fit, x + d + 6, y, font);
      return;
    }
    const textOnly = !L0.board;
    const head = clamp(Math.round(textOnly ? Math.min(area.h * 0.36, area.w / 13) : Math.min(area.h / 5.2, area.w / 11)), MIN_PX + 1, 30);
    const body = clamp(Math.round(head * 0.74), MIN_PX, 20);
    let lines = info(ctx, data, start, step, { head, body });
    if (textOnly) {
      // A strip: whose move and the rating on one line, then the rest as it fits.
      lines = lines.map((l, i) => (i === 0 ? { ...l, text: `${l.text} · ${data.daily!.puzzle.puzzle.rating}` } : l));
      const themes = themeNames(data.daily!.puzzle.puzzle.themes, ctx.t).join(' · ');
      lines = [lines[0]!, ...(data.outcome ? [lines[1]!] : []), ...(step !== null ? lines.filter((l) => l.tokens) : []), { text: themes || ctx.t(DAILY), size: body, color: c.inkDim }];
    }
    // A very wide strip: two columns of words.
    if (!textOnly && area.w > 640 && area.w > area.h * 4) {
      const half = Math.floor((area.w - 24) / 2);
      const left = lines.filter((l) => !l.tokens && l.color !== c.inkFaint);
      const right = lines.filter((l) => l.tokens || l.color === c.inkFaint);
      drawLines(g, ctx, { ...area, w: half }, left, start.turn === 'w');
      drawLines(g, ctx, { ...area, x: area.x + half + 24, w: area.w - half - 24 }, right, start.turn === 'w');
      return;
    }
    drawLines(g, ctx, area, lines, start.turn === 'w');
  });
}

export const puzzle = defineWidget({
  id: 'puzzle',
  name: DAILY,
  description: L(
    'The daily puzzle of Lichess: the position from your side with the last move marked, whose move it is, its rating and themes. Once you solve it (or in the evening) the solution plays on the board. Solve it from Kiosko’s Play page with the “Chess puzzle” interlude.',
    'El problema del día de Lichess: la posición desde tu lado con la última jugada marcada, a quién le toca, su nivel y sus temas. Al resolverlo (o por la noche) la solución se reproduce en el tablero. Resuélvelo desde la página Jugar de Kiosko con el interludio «Problema de ajedrez».',
    'Die Tagesaufgabe von Lichess: die Stellung aus deiner Sicht mit markiertem letztem Zug, wer am Zug ist, Wertung und Themen. Wenn du sie gelöst hast (oder abends), läuft die Lösung auf dem Brett ab. Löse sie auf Kioskos Seite „Spielen“ mit dem Zwischenspiel „Schachaufgabe“.',
    'Lichess 的每日谜题：从你这一方看的局面（标出上一步）、轮到谁走、难度和主题。解出后（或到晚上）答案会在棋盘上演示。在 Kiosko 的“游戏”页面用“国际象棋谜题”过场动画来解题。',
    'Lichess 的每日謎題：從你這一方看的局面（標出上一步）、輪到誰走、難度和主題。解出後（或到晚上）答案會在棋盤上演示。在 Kiosko 的「遊戲」頁面用「西洋棋謎題」過場動畫來解題。',
  ),
  icon: 'chess-knight',
  category: 'fun',
  tags: ['chess', 'lichess', 'puzzle'],
  size: { min: { w: 120, h: 36 }, preferred: { w: 480, h: 240 } },
  sources: [SOURCE],
  options,
  redraw: (ctx) => {
    const data = dataOf(ctx.sources);
    return data?.start && ctx.options.animate && revealed(data, ctx.options, ctx.now) ? { everyMs: STEP_MS } : 'minute';
  },
  // Read, but no puzzle: Lichess could not be reached for today's.
  empty: (ctx) => {
    const d = dataOf(ctx.sources);
    return !!d && !d.start;
  },
  render: (g, ctx) => renderPuzzle(g, ctx as Ctx),
  demo: ({ now }) => ({ sources: { [SOURCE]: demoData(now) } }),
});
