/** Every text the plugin paints, in its five languages. */
import type { Localized } from '@kiosko/sdk';
import { L } from './i18n.ts';
import type { Message } from './play.ts';

export const TO_MOVE = {
  w: L('White to move', 'Juegan blancas', 'Weiß am Zug', '白方走棋', '白方走棋'),
  b: L('Black to move', 'Juegan negras', 'Schwarz am Zug', '黑方走棋', '黑方走棋'),
};
export const YOU_PLAY = {
  w: L('You play White', 'Llevas las blancas', 'Du spielst Weiß', '你执白', '你執白'),
  b: L('You play Black', 'Llevas las negras', 'Du spielst Schwarz', '你执黑', '你執黑'),
};
export const RATING = L('Rating {n}', 'Nivel {n}', 'Wertung {n}', '难度 {n}', '難度 {n}');
export const PLAYS = L('{n} plays', '{n} intentos', '{n}× gespielt', '{n} 次尝试', '{n} 次嘗試');
export const SOLUTION = L('Solution', 'Solución', 'Lösung', '答案', '答案');
export const SOLVED = L('Solved', 'Resuelto', 'Gelöst', '已解出', '已解出');
export const SOLVED_IN = L('Solved · {n} wrong', 'Resuelto · {n} fallos', 'Gelöst · {n} Fehler', '已解出 · 错 {n} 次', '已解出 · 錯 {n} 次');
export const SOLVED_CLEAN = L('Solved first try', 'Resuelto a la primera', 'Auf Anhieb gelöst', '一次解出', '一次解出');
export const GAVE_UP = L('Given up', 'Abandonado', 'Aufgegeben', '已放弃', '已放棄');
export const DAILY = L('Puzzle of the day', 'Problema del día', 'Aufgabe des Tages', '每日谜题', '每日謎題');
export const PLAY_IT = L('Play it on Kiosko’s Play page', 'Juégalo en la página Jugar de Kiosko', 'Spiel sie auf Kioskos Seite „Spielen“', '在 Kiosko 的“游戏”页面上解题', '在 Kiosko 的「遊戲」頁面上解題');
export const YOUR_RATING = L('Your puzzle rating {n}', 'Tu nivel en problemas {n}', 'Deine Aufgabenwertung {n}', '你的谜题等级分 {n}', '你的謎題等級分 {n}');
export const STREAK = L('{n} days in a row', '{n} días seguidos', '{n} Tage in Folge', '连续 {n} 天', '連續 {n} 天');
export const WAITING = L('Loading the puzzle of the day…', 'Cargando el problema del día…', 'Aufgabe des Tages wird geladen…', '正在载入每日谜题…', '正在載入每日謎題…');
export const UNAVAILABLE = L('No puzzle today', 'Hoy no hay problema', 'Heute keine Aufgabe', '今天没有谜题', '今天沒有謎題');
export const UNAVAILABLE_SUB = L('Lichess could not be reached', 'No se ha podido contactar con Lichess', 'Lichess war nicht erreichbar', '无法连接 Lichess', '無法連線 Lichess');
export const MOVES_LEFT = L('Move {i} of {n}', 'Jugada {i} de {n}', 'Zug {i} von {n}', '第 {i}/{n} 步', '第 {i}/{n} 步');
export const MISTAKES = L('Wrong: {n}', 'Fallos: {n}', 'Fehler: {n}', '错误：{n}', '錯誤：{n}');
export const HINTS = L('Hints: {n}', 'Pistas: {n}', 'Tipps: {n}', '提示：{n}', '提示：{n}');

export const MESSAGES: Record<Message, Localized> = {
  yourMove: L('Your move', 'Te toca', 'Du bist am Zug', '轮到你走', '輪到你走'),
  wrong: L('Not that one, try again', 'Esa no, prueba otra', 'Nicht dieser, versuch’s noch mal', '不对，再试一次', '不對，再試一次'),
  good: L('Good move!', '¡Bien!', 'Guter Zug!', '好棋！', '好棋！'),
  solved: L('Solved!', '¡Resuelto!', 'Gelöst!', '解出来了！', '解出來了！'),
  altMate: L('Checkmate! Solved', '¡Mate! Resuelto', 'Matt! Gelöst', '将死！解出', '將死！解出'),
  hint: L('Hint: move the marked piece', 'Pista: mueve la pieza marcada', 'Tipp: zieh die markierte Figur', '提示：走标记的棋子', '提示：走標記的棋子'),
  confirmGiveUp: L('Press Select again to give up', 'Pulsa Select otra vez para rendirte', 'Nochmal Select zum Aufgeben', '再按 Select 放弃', '再按 Select 放棄'),
  gaveUp: L('The solution', 'La solución', 'Die Lösung', '答案', '答案'),
  promote: L('Promote to…', 'Coronar en…', 'Umwandeln in…', '升变为…', '升變為…'),
  opponent: L('Opponent’s move', 'Responde el rival', 'Der Gegner zieht', '对手走棋', '對手走棋'),
  replay: L('The solution again', 'La solución otra vez', 'Die Lösung noch einmal', '再看一遍答案', '再看一遍答案'),
  alreadySolved: L('Already solved today', 'Ya resuelto hoy', 'Heute schon gelöst', '今天已解出', '今天已解出'),
};

/** What each button does, for the side panel. */
export const KEYS = {
  move: L('Arrows: cursor', 'Flechas: cursor', 'Pfeile: Cursor', '方向键：光标', '方向鍵：游標'),
  pick: L('A: pick up / move', 'A: coger / mover', 'A: nehmen / ziehen', 'A：拿起 / 走子', 'A：拿起 / 走子'),
  back: L('B: put back', 'B: soltar', 'B: zurücklegen', 'B：放回', 'B：放回'),
  hint: L('Y: hint', 'Y: pista', 'Y: Tipp', 'Y：提示', 'Y：提示'),
  giveUp: L('Select: give up', 'Select: rendirse', 'Select: aufgeben', 'Select：放弃', 'Select：放棄'),
  again: L('Start: play again', 'Start: otra vez', 'Start: noch mal', 'Start：再来一次', 'Start：再來一次'),
  watch: L('A: watch the solution', 'A: ver la solución', 'A: Lösung ansehen', 'A：观看答案', 'A：觀看答案'),
};

export const GAMES = {
  none: L('No game waiting for you', 'Ninguna partida te espera', 'Keine Partie wartet auf dich', '没有等你走棋的对局', '沒有等你走棋的對局'),
  waiting: { en: { one: '{n} game waits for your move', other: '{n} games wait for your move' }, es: { one: '{n} partida espera tu jugada', other: '{n} partidas esperan tu jugada' }, de: { one: '{n} Partie wartet auf deinen Zug', other: '{n} Partien warten auf deinen Zug' }, 'zh-Hans': { other: '{n} 局等你走棋' }, 'zh-Hant': { other: '{n} 局等你走棋' } },
  short: { en: { one: '{n} game', other: '{n} games' }, es: { one: '{n} partida', other: '{n} partidas' }, de: { one: '{n} Partie', other: '{n} Partien' }, 'zh-Hans': { other: '{n} 局' }, 'zh-Hant': { other: '{n} 局' } },
  noToken: L('Add a Lichess token', 'Añade un token de Lichess', 'Füge ein Lichess-Token hinzu', '添加 Lichess 令牌', '新增 Lichess 權杖'),
  noTokenSub: L('In Settings → Data sources → Lichess', 'En Ajustes → Fuentes de datos → Lichess', 'Unter Einstellungen → Datenquellen → Lichess', '在 设置 → 数据源 → Lichess', '在 設定 → 資料來源 → Lichess'),
  vs: L('vs {name}', 'contra {name}', 'gegen {name}', '对 {name}', '對 {name}'),
  left: L('{t} left', 'quedan {t}', 'noch {t}', '剩余 {t}', '剩餘 {t}'),
  refused: L('Lichess refused the token', 'Lichess ha rechazado el token', 'Lichess hat das Token abgelehnt', 'Lichess 拒绝了令牌', 'Lichess 拒絕了權杖'),
};

/** The pieces' letters in notation, for languages that don't use the English ones. */
export const PIECE_LETTERS: Record<string, Record<string, string>> = {
  es: { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' },
  de: { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' },
};

/** Lichess's puzzle themes (https://lichess.org/training/themes), the ones worth showing. */
export const THEMES: Record<string, Localized> = {
  mateIn1: L('Mate in 1', 'Mate en 1', 'Matt in 1', '一步杀', '一步殺'),
  mateIn2: L('Mate in 2', 'Mate en 2', 'Matt in 2', '两步杀', '兩步殺'),
  mateIn3: L('Mate in 3', 'Mate en 3', 'Matt in 3', '三步杀', '三步殺'),
  mateIn4: L('Mate in 4', 'Mate en 4', 'Matt in 4', '四步杀', '四步殺'),
  mateIn5: L('Mate in 5+', 'Mate en 5+', 'Matt in 5+', '五步以上杀', '五步以上殺'),
  mate: L('Checkmate', 'Jaque mate', 'Schachmatt', '将杀', '將殺'),
  opening: L('Opening', 'Apertura', 'Eröffnung', '开局', '開局'),
  middlegame: L('Middlegame', 'Medio juego', 'Mittelspiel', '中局', '中局'),
  endgame: L('Endgame', 'Final', 'Endspiel', '残局', '殘局'),
  advancedPawn: L('Advanced pawn', 'Peón avanzado', 'Vorgerückter Bauer', '冲兵', '衝兵'),
  attackingF2F7: L('Attacking f2/f7', 'Ataque a f2/f7', 'Angriff auf f2/f7', '攻击 f2/f7', '攻擊 f2/f7'),
  attraction: L('Attraction', 'Atracción', 'Hinlenkung', '引入', '引入'),
  backRankMate: L('Back rank mate', 'Mate del pasillo', 'Grundreihenmatt', '底线杀', '底線殺'),
  capturingDefender: L('Capture the defender', 'Captura del defensor', 'Verteidiger schlagen', '吃掉防守子', '吃掉防守子'),
  castling: L('Castling', 'Enroque', 'Rochade', '王车易位', '王車易位'),
  clearance: L('Clearance', 'Despeje', 'Räumung', '腾挪', '騰挪'),
  defensiveMove: L('Defensive move', 'Jugada defensiva', 'Verteidigungszug', '防守着法', '防守著法'),
  deflection: L('Deflection', 'Desviación', 'Ablenkung', '引离', '引離'),
  discoveredAttack: L('Discovered attack', 'Ataque a la descubierta', 'Abzugsangriff', '闪击', '閃擊'),
  discoveredCheck: L('Discovered check', 'Jaque a la descubierta', 'Abzugsschach', '闪将', '閃將'),
  doubleCheck: L('Double check', 'Jaque doble', 'Doppelschach', '双将', '雙將'),
  enPassant: L('En passant', 'Al paso', 'En passant', '吃过路兵', '吃過路兵'),
  exposedKing: L('Exposed king', 'Rey expuesto', 'Ungeschützter König', '王暴露', '王暴露'),
  fork: L('Fork', 'Ataque doble', 'Gabel', '捉双', '捉雙'),
  hangingPiece: L('Hanging piece', 'Pieza colgada', 'Hängende Figur', '悬子', '懸子'),
  interference: L('Interference', 'Interferencia', 'Unterbrechung', '拦截', '攔截'),
  intermezzo: L('Intermezzo', 'Jugada intermedia', 'Zwischenzug', '中间着', '中間著'),
  kingsideAttack: L('Kingside attack', 'Ataque al flanco de rey', 'Königsangriff', '王翼进攻', '王翼進攻'),
  queensideAttack: L('Queenside attack', 'Ataque al flanco de dama', 'Damenflügelangriff', '后翼进攻', '后翼進攻'),
  pin: L('Pin', 'Clavada', 'Fesselung', '牵制', '牽制'),
  promotion: L('Promotion', 'Coronación', 'Umwandlung', '升变', '升變'),
  underPromotion: L('Underpromotion', 'Subpromoción', 'Unterverwandlung', '低升变', '低升變'),
  quietMove: L('Quiet move', 'Jugada tranquila', 'Stiller Zug', '静着', '靜著'),
  sacrifice: L('Sacrifice', 'Sacrificio', 'Opfer', '弃子', '棄子'),
  skewer: L('Skewer', 'Enfilada', 'Spieß', '串击', '串擊'),
  smotheredMate: L('Smothered mate', 'Mate de la coz', 'Ersticktes Matt', '闷杀', '悶殺'),
  trappedPiece: L('Trapped piece', 'Pieza atrapada', 'Gefangene Figur', '困子', '困子'),
  xRayAttack: L('X-ray attack', 'Rayos X', 'Röntgenangriff', '透射攻击', '透射攻擊'),
  zugzwang: L('Zugzwang', 'Zugzwang', 'Zugzwang', '楚茨文格', '楚茨文格'),
  bishopEndgame: L('Bishop endgame', 'Final de alfiles', 'Läuferendspiel', '象残局', '象殘局'),
  knightEndgame: L('Knight endgame', 'Final de caballos', 'Springerendspiel', '马残局', '馬殘局'),
  pawnEndgame: L('Pawn endgame', 'Final de peones', 'Bauernendspiel', '兵残局', '兵殘局'),
  queenEndgame: L('Queen endgame', 'Final de damas', 'Damenendspiel', '后残局', '后殘局'),
  rookEndgame: L('Rook endgame', 'Final de torres', 'Turmendspiel', '车残局', '車殘局'),
  queenRookEndgame: L('Queen and rook', 'Dama y torre', 'Dame und Turm', '后车残局', '后車殘局'),
  anastasiaMate: L('Anastasia’s mate', 'Mate de Anastasia', 'Anastasias Matt', '阿纳斯塔西亚杀', '阿納斯塔西亞殺'),
  arabianMate: L('Arabian mate', 'Mate árabe', 'Arabisches Matt', '阿拉伯杀', '阿拉伯殺'),
  bodenMate: L('Boden’s mate', 'Mate de Boden', 'Bodens Matt', '博登杀', '博登殺'),
  doubleBishopMate: L('Double bishop mate', 'Mate de dos alfiles', 'Läuferpaar-Matt', '双象杀', '雙象殺'),
  dovetailMate: L('Dovetail mate', 'Mate de la cola de golondrina', 'Schwalbenschwanzmatt', '燕尾杀', '燕尾殺'),
  hookMate: L('Hook mate', 'Mate del gancho', 'Hakenmatt', '钩子杀', '鉤子殺'),
  cornerMate: L('Corner mate', 'Mate en la esquina', 'Eckmatt', '角落杀', '角落殺'),
  killBoxMate: L('Kill box mate', 'Mate de la caja', 'Kastenmatt', '方框杀', '方框殺'),
  vukovicMate: L('Vuković mate', 'Mate de Vuković', 'Vuković-Matt', '武科维奇杀', '武科維奇殺'),
  triangleMate: L('Triangle mate', 'Mate del triángulo', 'Dreiecksmatt', '三角杀', '三角殺'),
  balestraMate: L('Balestra mate', 'Mate de la ballesta', 'Balestra-Matt', '弩杀', '弩殺'),
  blindSwineMate: L('Blind swine mate', 'Mate de los cerdos ciegos', 'Blinde-Schweine-Matt', '盲猪杀', '盲豬殺'),
};

/** Themes that say nothing about what to look for: left out. */
const QUIET = new Set(['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'advantage', 'crushing', 'equality', 'playerGames', 'puzzleDownloadInformation']);
const PHASES = new Set(['opening', 'middlegame', 'endgame']);

/** "camelCase" → "Camel case", for a theme Lichess adds later. */
const humanize = (k: string): string => {
  const s = k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The puzzle's themes worth showing, mates first and the phase last, in the user's language. */
export function themeNames(themes: string[], t: (x: Localized) => string): string[] {
  const keys = themes.filter((k) => !QUIET.has(k));
  const hasMateIn = keys.some((k) => /^mateIn\d$/.test(k));
  const rank = (k: string) => (/^mateIn\d$/.test(k) ? 0 : PHASES.has(k) ? 2 : 1);
  return keys
    .filter((k) => !(k === 'mate' && hasMateIn))
    .sort((a, b) => rank(a) - rank(b))
    .map((k) => (THEMES[k] ? t(THEMES[k]) : humanize(k)));
}
