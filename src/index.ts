/**
 * The daily chess puzzle of Lichess on the panel: a widget with the
 * position, its rating and themes (and its solution once solved), an
 * interlude to solve it from Kiosko's Play page with a game controller or
 * the keyboard, and, with a token, your games waiting for your move.
 */
import { definePlugin } from '@kiosko/sdk';
import { L, LANGUAGES } from './i18n.ts';
import { play } from './interlude.ts';
import { HOST, VERSION } from './lichess.ts';
import { lichessSource } from './source.ts';
import { games } from './widget-games.ts';
import { puzzle } from './widget-puzzle.ts';

export { play } from './interlude.ts';
export { lichessSource } from './source.ts';
export { games } from './widget-games.ts';
export { puzzle } from './widget-puzzle.ts';

export default definePlugin({
  id: 'chess',
  name: L('Chess puzzle of the day', 'Problema de ajedrez del día', 'Schachaufgabe des Tages', '每日国际象棋谜题', '每日西洋棋謎題'),
  version: VERSION,
  description: L(
    'The daily chess puzzle of Lichess on your panel: the position, its rating and themes, and its solution once you solve it; solve it from Kiosko’s Play page with a game controller or the keyboard. With a Lichess token, your puzzle rating and the games waiting for your move.',
    'El problema de ajedrez del día de Lichess en tu panel: la posición, su nivel y sus temas, y la solución una vez resuelto; resuélvelo desde la página Jugar de Kiosko con un mando o el teclado. Con un token de Lichess, tu nivel en problemas y las partidas que esperan tu jugada.',
    'Die Schachaufgabe des Tages von Lichess auf deinem Panel: die Stellung, ihre Wertung und Themen, und die Lösung, sobald du sie gelöst hast; lös sie auf Kioskos Seite „Spielen“ mit Controller oder Tastatur. Mit einem Lichess-Token deine Aufgabenwertung und die Partien, die auf deinen Zug warten.',
    '在副屏上显示 Lichess 的每日国际象棋谜题：局面、难度和主题，解出后显示答案；在 Kiosko 的“游戏”页面用手柄或键盘解题。填写 Lichess 令牌后，还能看到你的谜题等级分和等你走棋的对局。',
    '在面板上顯示 Lichess 的每日西洋棋謎題：局面、難度和主題，解出後顯示答案；在 Kiosko 的「遊戲」頁面用手把或鍵盤解題。填入 Lichess 權杖後，還能看到你的謎題等級分和等你走棋的對局。',
  ),
  author: 'Loksly',
  license: 'MIT',
  homepage: 'https://github.com/kiosko-lcd/kiosko-plugin-chess#readme',
  repository: 'https://github.com/kiosko-lcd/kiosko-plugin-chess',
  icon: 'chess-knight',
  sdk: '^0.2.0',
  platforms: ['linux', 'darwin', 'win32'],
  languages: LANGUAGES,
  permissions: { network: [HOST] },
  resources: { memoryMb: 10, cpu: 'low' },
  widgets: [puzzle, games],
  sources: [lichessSource],
  interludes: [play],
  templates: [
    {
      id: 'chess',
      name: L('Chess', 'Ajedrez', 'Schach', '国际象棋', '西洋棋'),
      icon: 'chess-knight',
      wide: [
        { x: 0, y: 0, w: 0.7, h: 1, widgets: ['puzzle'] },
        { x: 0.7, y: 0, w: 0.3, h: 1, widgets: ['games'] },
      ],
      tall: [
        { x: 0, y: 0, w: 1, h: 0.7, widgets: ['puzzle'] },
        { x: 0, y: 0.7, w: 1, h: 0.3, widgets: ['games'] },
      ],
    },
  ],
});
