/**
 * The `chess/lichess` source: today's puzzle (asked once a day, kept in the
 * cache folder), what you did with it (from the plugin's data folder), and,
 * with a token, your puzzle rating and the games waiting for your move.
 */
import { defineSource, HttpError, t } from '@kiosko/sdk';
import type { ChessData } from './common.ts';
import { demoData } from './demo.ts';
import { L } from './i18n.ts';
import { account, dailyPuzzle, games, type Account, type Games } from './lichess.ts';
import { startOf, type Start } from './puzzle.ts';
import { loadOutcomes, streak, utcDay } from './store.ts';

/** Your account: its numbers change slowly. */
export const ACCOUNT_EVERY_MS = 30 * 60_000;
/** Games waiting for you: often enough to notice, rarely enough to be polite. */
export const GAMES_EVERY_MS = 5 * 60_000;

export const sourceOptions = t.object({
  token: t.string({
    secret: true,
    placeholder: 'lip_…',
    label: L('Lichess token (optional)', 'Token de Lichess (opcional)', 'Lichess-Token (optional)', 'Lichess 令牌（可选）', 'Lichess 權杖（選填）'),
    help: L(
      'Only for your puzzle rating and the games waiting for your move. Create one at lichess.org/account/oauth/token with “Read puzzle activity” and nothing else. The daily puzzle needs none.',
      'Solo para tu nivel en problemas y las partidas que esperan tu jugada. Créalo en lichess.org/account/oauth/token con «Leer la actividad de problemas» y nada más. El problema del día no lo necesita.',
      'Nur für deine Aufgabenwertung und die Partien, die auf deinen Zug warten. Erstelle es unter lichess.org/account/oauth/token mit „Aufgabenaktivität lesen“ und sonst nichts. Die Aufgabe des Tages braucht keins.',
      '仅用于显示你的谜题等级分和等你走棋的对局。在 lichess.org/account/oauth/token 创建，只勾选“读取谜题活动”。每日谜题不需要令牌。',
      '僅用於顯示你的謎題等級分和等你走棋的對局。在 lichess.org/account/oauth/token 建立，只勾選「讀取謎題活動」。每日謎題不需要權杖。',
    ),
  }),
  games: t.boolean({
    default: true,
    label: L('Read my games in progress', 'Leer mis partidas en curso', 'Meine laufenden Partien lesen', '读取我进行中的对局', '讀取我進行中的對局'),
    help: L('With a token: the correspondence games waiting for your move, every 5 minutes.', 'Con token: las partidas por correspondencia que esperan tu jugada, cada 5 minutos.', 'Mit Token: die Fernschachpartien, die auf deinen Zug warten, alle 5 Minuten.', '有令牌时：每 5 分钟读取一次等你走棋的通信对局。', '有權杖時：每 5 分鐘讀取一次等你走棋的通訊對局。'),
  }),
});

/** What is kept between reads: the slow parts, so a read is mostly local. */
interface Memo {
  token: string;
  account?: Account;
  accountAt: number;
  games?: Games;
  gamesAt: number;
  error?: string;
  puzzleId?: string;
  start?: Start | null;
}
let memo: Memo = { token: '', accountAt: 0, gamesAt: 0 };

/** One read of the source (exported for the tests). */
export async function readChess(ctx: { options: { token: string; games: boolean }; now: number; cacheDir: string; dataDir: string; signal?: AbortSignal; log: (m: string) => void }): Promise<ChessData> {
  const token = ctx.options.token.trim();
  if (memo.token !== token) memo = { token, accountAt: 0, gamesAt: 0 };
  let error: string | undefined;
  const daily = await dailyPuzzle({ cacheDir: ctx.cacheDir, now: ctx.now, ...(ctx.signal ? { signal: ctx.signal } : {}), log: ctx.log }).catch((err: unknown) => {
    error = err instanceof Error ? err.message : String(err);
    return null;
  });
  if (daily && memo.puzzleId !== daily.puzzle.puzzle.id) {
    memo.puzzleId = daily.puzzle.puzzle.id;
    try {
      memo.start = startOf(daily.puzzle);
    } catch (err) {
      memo.start = null;
      ctx.log(err instanceof Error ? err.message : String(err));
    }
  }
  if (token) {
    const signal = ctx.signal ? { signal: ctx.signal } : {};
    try {
      if (ctx.now - memo.accountAt >= ACCOUNT_EVERY_MS) {
        memo.account = await account(token, signal);
        memo.accountAt = ctx.now;
      }
      if (ctx.options.games && ctx.now - memo.gamesAt >= GAMES_EVERY_MS) {
        memo.games = await games(token, signal);
        memo.gamesAt = ctx.now;
      }
      delete memo.error;
    } catch (err) {
      // A refused token stays refused until it changes; anything else is tried again next time.
      if (err instanceof HttpError && err.status === 401) {
        memo.error = 'token';
        memo.accountAt = memo.gamesAt = ctx.now;
      } else memo.error = err instanceof Error ? err.message : String(err);
      ctx.log(`account: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const list = loadOutcomes(ctx.dataDir);
  const id = daily?.puzzle.puzzle.id;
  const err = error ?? memo.error;
  return {
    daily,
    start: daily ? (memo.start ?? null) : null,
    outcome: id ? (list.findLast((o) => o.puzzleId === id) ?? null) : null,
    streak: streak(list, daily?.day ?? utcDay(ctx.now)),
    token: !!token,
    ...(token && memo.account ? { account: memo.account } : {}),
    ...(token && ctx.options.games && memo.games ? { games: memo.games } : {}),
    ...(err ? { error: err } : {}),
    at: ctx.now,
  };
}

/** Forgets what was kept (tests). */
export const resetMemo = (): void => {
  memo = { token: '', accountAt: 0, gamesAt: 0 };
};

export const lichessSource = defineSource({
  id: 'lichess',
  name: L('Lichess', 'Lichess', 'Lichess', 'Lichess', 'Lichess'),
  description: L(
    'The daily puzzle of Lichess, asked once a day; with a token, your puzzle rating and the games waiting for your move. Read every minute from what is kept here, Lichess itself only when something is due.',
    'El problema del día de Lichess, una vez al día; con token, tu nivel en problemas y las partidas que esperan tu jugada. Se lee cada minuto de lo guardado aquí; a Lichess solo se le pregunta cuando toca.',
    'Die Tagesaufgabe von Lichess, einmal am Tag abgefragt; mit Token deine Aufgabenwertung und die Partien, die auf deinen Zug warten. Jede Minute aus dem hier Gespeicherten gelesen, Lichess selbst nur, wenn etwas fällig ist.',
    'Lichess 的每日谜题，每天读取一次；有令牌时还有你的谜题等级分和等你走棋的对局。每分钟从本地保存的数据读取，只在需要时才访问 Lichess。',
    'Lichess 的每日謎題，每天讀取一次；有權杖時還有你的謎題等級分和等你走棋的對局。每分鐘從本機儲存的資料讀取，只在需要時才連線 Lichess。',
  ),
  options: sourceOptions,
  intervalMs: 60_000,
  minIntervalMs: 30_000,
  timeoutMs: 60_000,
  read: (ctx) => readChess(ctx),
  demo: ({ now }) => demoData(now),
});
