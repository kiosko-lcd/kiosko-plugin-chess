/**
 * `chess/play`: the daily puzzle, full screen. Played from Kiosko's Play
 * page (`input: true`, like Doom) it is solved with the pad or the keyboard
 * (see play.ts for the buttons) and what you did is kept for the day. At its
 * time slot, with no one playing, it shows the puzzle, and once you have
 * solved it (or from the evening on) its solution playing out.
 */
import { defineInterlude, t, type Graphics, type InterludeContext, type PadKey, type Theme } from '@kiosko/sdk';
import * as kit from '@loksly/lcd-canvas-kit';
import { BOARD_THEMES, drawBoard, squareSize, type BoardThemeId } from './board.ts';
import { dataOf, MARKS, MIN_PX, SOURCE, turnDot, type ChessData } from './common.ts';
import { fill, L } from './i18n.ts';
import { dailyPuzzle } from './lichess.ts';
import { drawPiece } from './pieces.ts';
import { PlayMachine, PROMOTIONS, type View } from './play.ts';
import { solutionText, startOf, type LichessPuzzle, type Start } from './puzzle.ts';
import { outcomeOf, saveOutcome, utcDay, type Outcome } from './store.ts';
import { DAILY, HINTS, KEYS, MESSAGES, MISTAKES, MOVES_LEFT, PIECE_LETTERS, PLAY_IT, RATING, SOLUTION, themeNames, TO_MOVE, YOU_PLAY } from './texts.ts';
import { boardOption, coordsOption } from './widget-puzzle.ts';

export const FPS = 15;
/** At its time slot: the runtime cuts it at the slot's length; this is only the ceiling. */
const SHOW_FRAMES = 120 * FPS;

type Box = { x: number; y: number; w: number; h: number };
type Say = (x: Parameters<InterludeContext<unknown>['t']>[0]) => string;

/** Where the board and the words go on a `w × h` screen. */
export function screenLayout(w: number, h: number): { board: Box; panel: Box | null } {
  const pad = Math.max(3, Math.round(Math.min(w, h) * 0.04));
  if (w >= h * 1.35) {
    const side = squareSize(h - pad * 2) * 8;
    const px = pad + side + pad * 2;
    const panel = w - px - pad >= 110 ? { x: px, y: pad, w: w - px - pad, h: h - pad * 2 } : null;
    return { board: { x: panel ? pad : Math.floor((w - side) / 2), y: Math.floor((h - side) / 2), w: side, h: side }, panel };
  }
  if (h >= w * 1.2) {
    const side = squareSize(w - pad * 2) * 8;
    const py = pad + side + pad;
    return { board: { x: Math.floor((w - side) / 2), y: pad, w: side, h: side }, panel: h - py - pad >= MIN_PX * 3 ? { x: pad, y: py, w: w - pad * 2, h: h - py - pad } : null };
  }
  const status = Math.max(Math.round(h * 0.09), MIN_PX + 6);
  const side = squareSize(Math.min(w - pad * 2, h - pad * 2 - status)) * 8;
  return { board: { x: Math.floor((w - side) / 2), y: pad, w: side, h: side }, panel: { x: pad, y: pad + side + 2, w: w - pad * 2, h: h - side - pad - 2 } };
}

interface Line {
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  dot?: 'w' | 'b';
  max?: number;
  /** Solution moves, the current one bold. */
  tokens?: { text: string; on: boolean }[];
}

/** Writes lines down a box; returns where it stopped. Text never under MIN_PX. */
function lines(g: Graphics, theme: Theme, box: Box, list: Line[], bottom: Line[] = []): void {
  let y = box.y;
  const fam = (b?: boolean) => (b ? theme.fonts.sansBold : theme.fonts.sans);
  // The keys legend sits at the bottom, as far as it fits under the rest.
  const lh = (l: Line) => Math.round(l.size * 1.3);
  const bottomH = bottom.reduce((a, l) => a + lh(l), 0);
  const roomFor = box.y + box.h - (bottomH <= box.h * 0.45 ? bottomH : 0);
  for (const l of list) {
    if (y + lh(l) > roomFor + 1) break;
    if (l.tokens) {
      let x = box.x;
      let n = 0;
      for (const tk of l.tokens) {
        const o = { size: l.size, family: fam(tk.on), color: tk.on ? theme.colors.ink : l.color };
        const w = kit.measureTracked(g, tk.text, o);
        if (x > box.x && x + w > box.x + box.w) {
          if (++n >= (l.max ?? 3) || y + lh(l) * 2 > roomFor + 1) break;
          y += lh(l);
          x = box.x;
        }
        kit.drawTracked(g, kit.truncate(g, tk.text, box.w, o), x, y + l.size, o);
        x += w + l.size * 0.35;
      }
      y += lh(l);
      continue;
    }
    let x = box.x;
    if (l.dot) {
      const d = Math.round(l.size * 0.8);
      turnDot(g, x, y + Math.round((lh(l) - d) / 2) - 1, d, l.dot === 'w');
      x += d + Math.round(l.size * 0.4);
    }
    const o = { size: l.size, family: fam(l.bold), color: l.color };
    const rows = kit.wrapLines(g, l.text, box.x + box.w - x, Math.max(1, Math.min(l.max ?? 1, Math.floor((roomFor - y) / lh(l)))), o);
    for (const r of rows) {
      kit.drawTracked(g, r, x, y + l.size, o);
      y += lh(l);
    }
  }
  if (bottomH <= box.h * 0.45 && y + bottomH <= box.y + box.h + 1) {
    let by = box.y + box.h - bottomH;
    for (const l of bottom) {
      const o = { size: l.size, family: fam(l.bold), color: l.color };
      kit.drawTracked(g, kit.truncate(g, l.text, box.w, o), box.x, by + l.size, o);
      by += lh(l);
    }
  }
}

/** The promotion picker: the four pieces in a row over the board, the one pointed at framed. */
function drawPromo(g: Graphics, board: Box, view: View): void {
  if (!view.promo) return;
  const sq = squareSize(board.w);
  const s = Math.round(sq * 1.25);
  const w = s * PROMOTIONS.length;
  const x = board.x + Math.round((board.w - w) / 2);
  const y = board.y + Math.round((board.h - s) / 2);
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(board.x, board.y, board.w, board.h);
  g.fillStyle = '#F2F2F2';
  g.fillRect(x - 3, y - 3, w + 6, s + 6);
  PROMOTIONS.forEach((p, i) => {
    if (i === view.promo!.index) {
      g.fillStyle = 'rgba(31,111,229,0.35)';
      g.fillRect(x + i * s, y, s, s);
      g.strokeStyle = MARKS.accent;
      g.lineWidth = Math.max(2, Math.round(s * 0.08));
      g.strokeRect(x + i * s + g.lineWidth / 2, y + g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth);
    }
    drawPiece(g, p, view.promo!.color, x + i * s, y, s);
  });
  g.restore();
}

export interface Paint {
  theme: Theme;
  say: Say;
  locale: string;
  board: BoardThemeId;
  coords: boolean;
  start: Start;
  puzzle: LichessPuzzle;
}

const letters = (locale: string) => PIECE_LETTERS[locale.split('-')[0]!] ?? {};

/** One frame of the game being played. */
export function paintPlay(g: Graphics, w: number, h: number, p: Paint, view: View, played: boolean): void {
  const { theme, say } = p;
  const c = theme.colors;
  g.fillStyle = c.bg;
  g.fillRect(0, 0, w, h);
  const lay = screenLayout(w, h);
  const sq = squareSize(lay.board.w);
  drawBoard(g, {
    x: lay.board.x + Math.round(view.shake * sq),
    y: lay.board.y,
    size: lay.board.w,
    board: view.board,
    orientation: view.orientation,
    theme: BOARD_THEMES[p.board] ?? BOARD_THEMES.wood,
    ...MARKS,
    lastMove: view.lastMove,
    selected: view.selected,
    targets: view.targets,
    cursor: played && view.phase !== 'solved' && view.phase !== 'gaveUp' ? view.cursor : null,
    hint: view.hint,
    check: view.check,
    wrong: view.wrong,
    slide: view.slide,
    coords: p.coords,
    text: (s, x, y, size, color, align) => kit.drawTracked(g, s, x, y, { size, family: theme.fonts.sansBold, color, align }),
  });
  drawPromo(g, lay.board, view);
  const panel = lay.panel;
  if (!panel) return;
  // A long strip: the words in columns (what happens, the solution, the keys).
  const strip = panel.w >= 500 && panel.w >= panel.h * 3;
  const small = !strip && (panel.h < 110 || panel.w < 200);
  const head = Math.max(MIN_PX + 2, Math.min(34, Math.round(strip ? panel.h / 3.4 : Math.min(panel.h / (small ? 3.2 : 7), panel.w / 9))));
  const body = Math.max(MIN_PX, Math.round(head * 0.68));
  const done = view.phase === 'solved' || view.phase === 'gaveUp';
  const msgColor = view.message === 'wrong' ? c.alert : view.message === 'confirmGiveUp' || view.message === 'gaveUp' ? c.warn : view.message === 'good' || view.message === 'solved' || view.message === 'altMate' || view.message === 'alreadySolved' ? c.ok : c.ink;
  const turn = p.start.turn;
  const out: Line[] = [];
  if (played) {
    out.push({ text: say(MESSAGES[view.message]), size: head, color: msgColor, bold: true, max: 2 });
    out.push({ text: `${say(YOU_PLAY[turn])} · ${p.puzzle.puzzle.rating}`, size: body, color: c.inkDim, dot: turn });
    const stats = [fill(say(MOVES_LEFT), { i: Math.min(view.moves.total, view.moves.done + (done ? 0 : 1)), n: view.moves.total }), fill(say(MISTAKES), { n: view.mistakes }), fill(say(HINTS), { n: view.hints })];
    out.push({ text: stats.join(' · '), size: body, color: c.inkDim, max: 2 });
  } else {
    out.push({ text: say(DAILY), size: body, color: c.inkFaint, bold: true });
    out.push({ text: say(TO_MOVE[turn]), size: head, color: c.ink, bold: true, dot: turn });
    out.push({ text: [fill(say(RATING), { n: p.puzzle.puzzle.rating }), ...themeNames(p.puzzle.puzzle.themes, say)].join(' · '), size: body, color: c.inkDim, max: 2 });
  }
  if (done || (!played && view.step >= 0)) {
    const sol = solutionText(p.start, letters(p.locale));
    out.push({ text: '', size: body, color: c.inkDim, tokens: [{ text: `${say(SOLUTION)}:`, on: false }, ...sol.map((s, i) => ({ text: s, on: i === view.step }))], max: 3 });
  } else if (!played) out.push({ text: say(PLAY_IT), size: body, color: c.inkDim, max: 2 });
  const keys: Line[] = [];
  if (played && (!small || strip)) {
    const k = done ? [KEYS.watch, KEYS.again] : [KEYS.move, KEYS.pick, KEYS.back, KEYS.hint, KEYS.giveUp];
    const size = Math.max(MIN_PX, Math.round(body * 0.85));
    // Two to a line when the panel is wide enough.
    const pairs = panel.w >= 360 ? k.reduce<string[]>((a, x, i) => (i % 2 ? (a[a.length - 1] += ` · ${say(x)}`, a) : [...a, say(x)]), []) : k.map((x) => say(x));
    for (const s of pairs) keys.push({ text: s, size, color: c.inkFaint });
  }
  if (strip) {
    const gap = Math.round(head * 1.2);
    const w1 = Math.round(panel.w * 0.42);
    const w3 = keys.length ? Math.round(panel.w * 0.24) : 0;
    const w2 = panel.w - w1 - w3 - gap * (keys.length ? 2 : 1);
    const sol = out.filter((l) => l.tokens || l.text === say(PLAY_IT));
    lines(g, theme, { ...panel, w: w1 }, out.filter((l) => !sol.includes(l)));
    lines(g, theme, { ...panel, x: panel.x + w1 + gap, w: w2 }, sol);
    if (keys.length) lines(g, theme, { ...panel, x: panel.x + w1 + w2 + gap * 2, w: w3 }, keys);
    return;
  }
  lines(g, theme, panel, out, keys);
}

/** Today's puzzle for the interlude: from the source if it runs, else read (or asked) here. */
async function puzzleFor(ctx: InterludeContext<unknown>): Promise<{ start: Start; data: Pick<ChessData, 'daily'> & { daily: NonNullable<ChessData['daily']> } } | null> {
  const fromSource = dataOf(ctx.sources);
  if (fromSource?.daily && fromSource.start) return { start: fromSource.start, data: { daily: fromSource.daily } };
  const daily = await dailyPuzzle({ cacheDir: ctx.cacheDir, now: Date.now(), log: (m) => ctx.log(`chess: ${m}`) }).catch(() => null);
  if (!daily) return null;
  try {
    return { start: startOf(daily.puzzle), data: { daily } };
  } catch (err) {
    ctx.log(`chess: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export const play = defineInterlude({
  id: 'play',
  name: L('Chess puzzle', 'Problema de ajedrez', 'Schachaufgabe', '国际象棋谜题', '西洋棋謎題'),
  description: L(
    'The daily puzzle of Lichess, to solve from Kiosko’s Play page with a game controller or the keyboard: move the cursor, pick a piece up (its legal moves are marked) and put it down. A wrong move shakes the board; a right one gets the opponent’s answer, until it is solved. Y gives a hint, Select twice gives up. At its time slot it shows the puzzle, and its solution once solved or in the evening.',
    'El problema del día de Lichess, para resolverlo desde la página Jugar de Kiosko con un mando o el teclado: mueve el cursor, coge una pieza (se marcan sus jugadas legales) y suéltala. Una jugada equivocada sacude el tablero; una buena trae la respuesta del rival, hasta resolverlo. Y da una pista, Select dos veces te rinde. A su hora muestra el problema, y la solución una vez resuelto o por la noche.',
    'Die Tagesaufgabe von Lichess, zu lösen auf Kioskos Seite „Spielen“ mit Controller oder Tastatur: Cursor bewegen, Figur aufnehmen (ihre legalen Züge werden markiert) und absetzen. Ein falscher Zug schüttelt das Brett; ein richtiger bringt die Antwort des Gegners, bis sie gelöst ist. Y gibt einen Tipp, zweimal Select gibt auf. Zu seiner Zeit zeigt es die Aufgabe, und die Lösung, wenn gelöst oder abends.',
    'Lichess 的每日谜题，在 Kiosko 的“游戏”页面用手柄或键盘来解：移动光标，拿起棋子（会标出它的合法走法）再放下。走错棋盘会晃动；走对了对手会应着，直到解出。Y 给提示，按两次 Select 放弃。到时间时显示谜题，解出后或到晚上显示答案。',
    'Lichess 的每日謎題，在 Kiosko 的「遊戲」頁面用手把或鍵盤來解：移動游標，拿起棋子（會標出它的合法走法）再放下。走錯棋盤會晃動；走對了對手會應著，直到解出。Y 給提示，按兩次 Select 放棄。到時間時顯示謎題，解出後或到晚上顯示答案。',
  ),
  icon: 'chess-knight',
  fps: FPS,
  input: true,
  sources: [SOURCE],
  preview: { poster: 'docs/play.jpg', video: 'docs/play.webm' },
  options: t.object({
    board: boardOption,
    coordinates: coordsOption,
    revealHour: t.integer({
      default: 20,
      min: 0,
      max: 24,
      label: L('Solution at its time slot from (hour)', 'Solución en su franja desde (hora)', 'Lösung im Zeitfenster ab (Uhr)', '定时播放时显示答案的时间（时）', '定時播放時顯示答案的時間（時）'),
      help: L('With no one playing, the solution plays from this hour on (24: only once solved).', 'Sin nadie jugando, la solución se reproduce desde esta hora (24: solo una vez resuelto).', 'Ohne Spieler läuft die Lösung ab dieser Uhrzeit (24: nur wenn gelöst).', '无人操作时，从这个时间起演示答案（24：仅在解出后）。', '無人操作時，從這個時間起演示答案（24：僅在解出後）。'),
    }),
  }),
  async prepare(ctx) {
    const found = await puzzleFor(ctx as InterludeContext<unknown>);
    if (!found) {
      ctx.log('chess: no puzzle to show (Lichess could not be reached and none is kept)');
      return null;
    }
    const { start, data } = found;
    const p = data.daily.puzzle;
    const paint: Paint = { theme: ctx.theme, say: ctx.t, locale: ctx.locale, board: ctx.options.board, coords: ctx.options.coordinates, start, puzzle: p };
    const done = outcomeOf(ctx.dataDir, p.puzzle.id);
    const input = ctx.input;
    const machine = new PlayMachine(start, p.puzzle.solution, { now: Date.now(), done });
    if (input) {
      machine.onOutcome = (r) => {
        try {
          saveOutcome(ctx.dataDir, { puzzleId: p.puzzle.id, day: data.daily.day ?? utcDay(Date.now()), ...r, at: Date.now() } satisfies Outcome);
        } catch (err) {
          ctx.log(`chess: could not keep the result: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      input.on((e) => {
        if (e.pressed) machine.press(e.key as PadKey, Date.now());
        else machine.release(e.key as PadKey);
      });
      ctx.log(`chess: puzzle ${p.puzzle.id} being played from the Play page`);
      return {
        frames: Infinity,
        draw(g) {
          const now = Date.now();
          machine.tick(now);
          paintPlay(g, ctx.width, ctx.height, paint, machine.view(now), true);
        },
      };
    }
    // At its slot: the puzzle, and the solution on a loop once it may be shown.
    const show = !!done || new Date().getHours() >= ctx.options.revealHour;
    let nextLoop = 0;
    return {
      frames: SHOW_FRAMES,
      draw(g) {
        const now = Date.now();
        if (show && now >= nextLoop) {
          machine.demo(now);
          nextLoop = now + (p.puzzle.solution.length + 3) * 1100;
        }
        machine.tick(now);
        const v = machine.view(now);
        paintPlay(g, ctx.width, ctx.height, paint, show ? v : { ...v, step: -1, lastMove: start.lastMove }, false);
      },
    };
  },
});
