/** Sample data for the gallery, the editor and the tests: a real daily puzzle, an account and two games. */
import type { ChessData } from './common.ts';
import { DEMO_PUZZLE } from './demo-puzzle.ts';
import { startOf } from './puzzle.ts';
import { utcDay } from './store.ts';

export function demoData(now: number, o: { solved?: boolean } = {}): ChessData {
  const start = startOf(DEMO_PUZZLE);
  return {
    daily: { puzzle: DEMO_PUZZLE, day: utcDay(now), fetchedAt: now - 3 * 3600_000 },
    start,
    outcome: o.solved ? { puzzleId: DEMO_PUZZLE.puzzle.id, day: utcDay(now), result: 'solved', mistakes: 1, hints: 0, at: now - 600_000 } : null,
    streak: o.solved ? 4 : 3,
    token: true,
    account: { username: 'you', rating: 1874, prog: 12, games: 412, month: { nb: 38, firstWins: 27, performance: 1902 } },
    games: {
      nbMyTurn: 2,
      total: 3,
      waiting: [
        { gameId: 'demo0001', color: 'white', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', lastMove: 'g8f6', opponent: 'Ana_Lopez', opponentRating: 1720, isMyTurn: true, secondsLeft: 2 * 86_400 + 5 * 3600, speed: 'correspondence' },
        { gameId: 'demo0002', color: 'black', fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5', lastMove: 'b1c3', opponent: 'Kurt1960', opponentRating: 1655, isMyTurn: true, secondsLeft: 9 * 3600, speed: 'correspondence' },
      ],
    },
    at: now,
  };
}
