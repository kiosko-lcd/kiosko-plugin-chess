/**
 * `chess/games`: your Lichess games waiting for your move (correspondence
 * above all), with a token. The most urgent one's board when there is room,
 * and each opponent with the time you have left.
 */
import { defineWidget, t, type Graphics } from '@kiosko/sdk';
import { BOARD_THEMES, drawBoard, squareSize, type BoardThemeId } from './board.ts';
import { clamp, clipped, dataOf, drawMessage, MARKS, MIN_PX, SOURCE, turnDot, type Ctx } from './common.ts';
import { demoData } from './demo.ts';
import { fill, L } from './i18n.ts';
import { boardOf, uciOf } from './puzzle.ts';
import { GAMES, WAITING } from './texts.ts';
import { MIN_BOARD, boardOption, coordsOption } from './widget-puzzle.ts';
import type { OwnGame } from './lichess.ts';

const options = t.object({ board: boardOption, coordinates: coordsOption });

/** One game: the opponent on the left, the time you have on the right; the rating goes first when it doesn't fit. */
function drawRow(g: Graphics, ctx: Ctx, gm: OwnGame, x: number, y: number, w: number, size: number): void {
  const { kit, theme } = ctx;
  const f = { size, family: theme.fonts.sans, color: theme.colors.inkDim };
  const fr = { size, family: theme.fonts.sansBold, color: theme.colors.ink };
  const time = typeof gm.secondsLeft === 'number' ? ctx.fmt.duration(gm.secondsLeft * 1000, { compact: true }) : '';
  const tw = time ? kit.measureTracked(g, time, fr) + Math.round(size * 0.6) : 0;
  const full = fill(ctx.t(GAMES.vs), { name: `${gm.opponent}${gm.opponentRating ? ` ${gm.opponentRating}` : ''}` });
  const bare = fill(ctx.t(GAMES.vs), { name: gm.opponent });
  const left = kit.measureTracked(g, full, f) <= w - tw ? full : bare;
  if (time && tw < w * 0.5) kit.drawTracked(g, time, x + w, y, { ...fr, align: 'right' });
  kit.drawTracked(g, kit.truncate(g, left, time && tw < w * 0.5 ? w - tw : w, f), x, y, f);
}

export function renderGames(g: Graphics, ctx: Ctx): void {
  const data = dataOf(ctx.sources);
  const { box, kit, theme } = ctx;
  const c = theme.colors;
  if (!data) return drawMessage(g, ctx, ctx.t(WAITING));
  if (!data.token) return drawMessage(g, ctx, ctx.t(GAMES.noToken), ctx.t(GAMES.noTokenSub));
  if (!data.games) return drawMessage(g, ctx, data.error === 'token' ? ctx.t(GAMES.refused) : ctx.t(WAITING), data.error === 'token' ? ctx.t(GAMES.noTokenSub) : undefined);
  const list = data.games.waiting;
  if (!list.length) return drawMessage(g, ctx, ctx.t(GAMES.none));
  const o = ctx.options as { board: BoardThemeId; coordinates: boolean };
  clipped(g, box, () => {
    let area = { ...box };
    const first = list[0]!;
    // The most urgent game's board, beside the list on a wide tile, above it on a tall one.
    const wide = box.w >= box.h * 1.45 && box.h >= MIN_BOARD && box.w - box.h >= 110;
    const tall = box.h >= box.w * 1.3 && box.w >= MIN_BOARD && box.h - box.w >= MIN_PX * 3;
    if (wide || tall) {
      const side = squareSize(wide ? box.h : box.w) * 8;
      const bx = wide ? box.x : box.x + Math.floor((box.w - side) / 2);
      drawBoard(g, {
        x: bx,
        y: box.y,
        size: side,
        board: boardOf(first.fen),
        orientation: first.color === 'white' ? 'w' : 'b',
        theme: BOARD_THEMES[o.board] ?? BOARD_THEMES.wood,
        ...MARKS,
        lastMove: first.lastMove ? uciOf(first.lastMove) : null,
        coords: o.coordinates,
        text: (s, x, y, size, color, align) => kit.drawTracked(g, s, x, y, { size, family: theme.fonts.sansBold, color, align }),
      });
      const gap = Math.max(8, Math.round(side * 0.05));
      area = wide ? { x: box.x + side + gap, y: box.y, w: box.w - side - gap, h: box.h } : { x: box.x, y: box.y + side + gap, w: box.w, h: box.h - side - gap };
    }
    const head = clamp(Math.round(Math.min(area.h / 4.2, area.w / 10)), MIN_PX + 1, 28);
    const body = clamp(Math.round(head * 0.74), MIN_PX, 20);
    let y = area.y;
    const d = Math.round(head * 0.8);
    const hf = { size: head, family: theme.fonts.sansBold, color: c.ink };
    const long = ctx.plural(data.games!.nbMyTurn, GAMES.waiting);
    const headText = kit.measureTracked(g, long, hf) <= area.w - d - 6 ? long : ctx.plural(data.games!.nbMyTurn, GAMES.short);
    turnDot(g, area.x, y + Math.round((head * 1.3 - d) / 2) - 1, d, first.color === 'white');
    kit.drawTracked(g, kit.truncate(g, headText, area.w - d - 6, hf), area.x + d + 6, y + head, hf);
    y += Math.round(head * 1.35);
    for (const gm of list) {
      const lh = Math.round(body * 1.32);
      if (y + lh > area.y + area.h + 1) break;
      drawRow(g, ctx, gm, area.x, y + body, area.w, body);
      y += lh;
    }
  });
}

export const games = defineWidget({
  id: 'games',
  name: L('Your Lichess games', 'Tus partidas de Lichess', 'Deine Lichess-Partien', '你的 Lichess 对局', '你的 Lichess 對局'),
  description: L(
    'The Lichess games waiting for your move (correspondence and others), the most urgent one’s board and the time you have left. Needs a Lichess token in Settings → Data sources.',
    'Las partidas de Lichess que esperan tu jugada (por correspondencia y otras), el tablero de la más urgente y el tiempo que te queda. Necesita un token de Lichess en Ajustes → Fuentes de datos.',
    'Die Lichess-Partien, die auf deinen Zug warten (Fernschach und andere), das Brett der dringendsten und deine Restzeit. Braucht ein Lichess-Token unter Einstellungen → Datenquellen.',
    '等你走棋的 Lichess 对局（通信对局等），最紧急那局的棋盘和你剩余的时间。需要在 设置 → 数据源 中填写 Lichess 令牌。',
    '等你走棋的 Lichess 對局（通訊對局等），最緊急那局的棋盤和你剩餘的時間。需要在 設定 → 資料來源 中填入 Lichess 權杖。',
  ),
  icon: 'chess-pawn',
  category: 'fun',
  tags: ['chess', 'lichess', 'correspondence'],
  size: { min: { w: 120, h: 36 }, preferred: { w: 400, h: 160 } },
  sources: [SOURCE],
  options,
  redraw: 'minute',
  idle: (ctx) => !dataOf(ctx.sources)?.games?.waiting.length,
  // Read, but no games to list: no token, the token refused, games switched off or none waiting for you.
  empty: (ctx) => {
    const d = dataOf(ctx.sources);
    return !!d && !d.games?.waiting.length;
  },
  render: (g, ctx) => renderGames(g, ctx as Ctx),
  demo: ({ now }) => ({ sources: { [SOURCE]: demoData(now) } }),
});
