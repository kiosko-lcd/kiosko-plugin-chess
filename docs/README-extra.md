## Playing it

Add the **Chess puzzle** interlude to a screen (Kiosko → Screens → Interludes),
then open Kiosko's **Play** page, pick that screen and press **Play**. With a
game controller, the keyboard, or the pad on the phone:

| Button | Keyboard | What it does |
|---|---|---|
| D-pad, L / R | arrows, WASD | move the cursor |
| A or X | Space, Enter | pick up the piece under the cursor (its legal moves are marked) / put it down |
| B | E, F | put the piece back |
| Y | Shift | hint: the piece to move is framed in green (again: the cursor goes to it) |
| Select | Tab, M | give up (press it twice): the solution plays out |
| Start | Esc | once it is over: solve it again |

A wrong move shakes the board and counts as a mistake; a right one gets the
opponent's answer, until it is solved. Any checkmate counts, as on Lichess,
even if it isn't the solution's. A pawn reaching the last rank opens a picker
(queen, rook, bishop, knight). What you did with each day's puzzle is kept in
the plugin's data folder (`solved.json`): the widget shows it, and the
solution, from then on.

## Lichess

The daily puzzle comes from Lichess's open API (`/api/puzzle/daily`, no key),
asked once a day (UTC) and kept in Kiosko's cache folder; if Lichess still
answers with yesterday's puzzle it is asked again an hour later. All requests
go one at a time with the plugin's User-Agent, and after a 429 none is made
until Lichess says. With a [token](https://lichess.org/account/oauth/token)
(the "Read puzzle activity" scope is enough), your puzzle rating (every 30
minutes) and the games waiting for your move (every 5 minutes) too. Kiosko
and this plugin are not affiliated with Lichess.

## The pieces

The piece set is the plugin's own, drawn for small panels: heavy silhouettes
with an outline that stays one pixel or more at any size, no inner detail
under 18 px squares. Two boards: wood and slate.
