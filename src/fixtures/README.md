# Fixtures

Real answers of the Lichess API (https://lichess.org/api), saved for the tests:

- `daily-3Ksou.json`: `GET /api/puzzle/daily` on 27 November 2026 (mate in 3, Black to move).
- `puzzle-o5fEa.json`: `GET /api/puzzle/o5fEa`, with an en passant capture in its solution.
- `puzzle-k2eHg.json`: a promotion to a queen (`g7g8q`) at the end.
- `puzzle-8zPl0.json`: queenside castling (`e8c8`) in the solution.
- `puzzle-2WyFZ.json`: an underpromotion to a knight that mates (`c7c8n`).
- `puzzle-YynlB.json`: a mate in one.

The last four came from `GET /api/puzzle/next?angle=<theme>` (anonymous), which
answers in the same shape as `/api/puzzle/{id}`. Lichess's puzzles and games
are released under CC0.

From the examples of Lichess's API documentation
(https://github.com/lichess-org/api, `doc/specs/examples`), as they need a token:

- `account.json`: `GET /api/account`.
- `puzzle-dashboard.json`: `GET /api/puzzle/dashboard/30`.
- `account-playing.json`: `GET /api/account/playing`.

Written by hand following the same schema (`doc/specs/tags/games/api-account-playing.yaml`):

- `account-playing-correspondence.json`: three correspondence games, two
  waiting for your move (one against the computer).
