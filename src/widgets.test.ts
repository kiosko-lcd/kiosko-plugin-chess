import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import * as kit from '@loksly/lcd-canvas-kit';
import { THEMES, createBaseContext, defaultsOf, type WidgetDefinition } from '@kiosko/sdk';
import { renderWidget, widgetState } from '@kiosko/sdk/testing';
import { MIN_PX, SOURCE, type ChessData } from './common.ts';
import { demoData } from './demo.ts';
import { games } from './widget-games.ts';
import { layout, puzzle, revealed, STEP_MS, stepAt } from './widget-puzzle.ts';

const NOON = new Date(2026, 10, 27, 12, 10).getTime();
const EVENING = new Date(2026, 10, 27, 21, 10).getTime();
const SIZES = [{ w: 172, h: 320 }, { w: 240, h: 70 }, { w: 320, h: 200 }, { w: 480, h: 240 }, { w: 800, h: 160 }, { w: 1920, h: 140 }, { w: 200, h: 36 }, { w: 320, h: 320 }];
const LOCALES = ['en', 'es', 'zh-Hant'];
const WIDGETS = [puzzle, games] as WidgetDefinition<any, any>[];

/** The states that paint differently. */
function variants(): [string, ChessData, number][] {
  const d = demoData(NOON);
  const solved = demoData(NOON, { solved: true });
  const gaveUp: ChessData = { ...solved, outcome: { ...solved.outcome!, result: 'gaveUp' } };
  const noToken: ChessData = { ...d, token: false, account: undefined, games: undefined } as ChessData;
  const refused: ChessData = { ...d, games: undefined, error: 'token' } as ChessData;
  const noGames: ChessData = { ...d, games: { nbMyTurn: 0, waiting: [], total: 1 } };
  const down: ChessData = { daily: null, start: null, outcome: null, streak: 0, token: false, error: 'HTTP 503 from lichess.org', at: NOON };
  return [['demo', d, NOON], ['evening', d, EVENING], ['solved', solved, NOON], ['gave up', gaveUp, NOON], ['no token', noToken, NOON], ['refused', refused, NOON], ['no games', noGames, NOON], ['down', down, NOON]];
}

test('every widget paints at 8 sizes × 3 languages, in every state, without throwing or spilling, and says something', () => {
  for (const w of WIDGETS)
    for (const [name, data, now] of variants())
      for (const size of SIZES)
        for (const locale of LOCALES) {
          const r = renderWidget(w, { size, locale, now, sources: { [SOURCE]: data } });
          const where = `${w.id} ${name} ${size.w}x${size.h} ${locale}`;
          assert.equal(r.error, undefined, where);
          assert.equal(r.outside, 0, where);
          assert.ok(r.texts.length > 0, `${where} paints text`);
        }
});

/** Paints a widget and returns every text drawn, with its size. */
function sizesOf(w: WidgetDefinition<any, any>, data: ChessData, size: { w: number; h: number }, locale: string, now: number) {
  const texts: { text: string; size: number }[] = [];
  const spy = { ...kit, drawTracked: (g: never, text: string, x: number, y: number, o: { size: number }) => (texts.push({ text, size: o.size }), kit.drawTracked(g, text, x, y, o as never)) };
  const g = createCanvas(size.w, size.h).getContext('2d');
  const theme = THEMES[0]!;
  w.render(g as never, { ...createBaseContext({ now, locale }), options: w.options ? defaultsOf(w.options as never) : {}, data: undefined, sources: { [SOURCE]: data }, working: true, box: { x: 0, y: 0, w: size.w, h: size.h }, theme, fonts: theme.fonts, kit: spy, canvas: { createCanvas }, preview: false } as never);
  return texts;
}

test('nothing under 11 px, in every language, size and state (board coordinates included)', () => {
  for (const w of WIDGETS)
    for (const [name, data, now] of variants())
      for (const size of [...SIZES, { w: 600, h: 600 }])
        for (const locale of LOCALES) {
          const small = sizesOf(w, data, size, locale, now).filter((x) => x.size < MIN_PX);
          assert.deepEqual(small, [], `${w.id} ${name} ${size.w}x${size.h} ${locale}`);
        }
});

test('puzzle: whose move, the rating and the themes, in each language', () => {
  const en = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'en', now: NOON });
  const all = en.texts.join(' | ');
  assert.ok(en.texts.includes('Black to move'), all);
  assert.ok(en.texts.some((t) => t.startsWith('Rating 1969 · Mate in 3 · ')), all);
  assert.ok(!en.texts.some((t) => /Solution/.test(t)), 'no solution at noon');
  const es = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'es', now: NOON });
  assert.ok(es.texts.includes('Juegan negras'), es.texts.join(' | '));
  const de = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'de', now: NOON });
  assert.ok(de.texts.includes('Schwarz am Zug'), de.texts.join(' | '));
  const zh = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'zh-Hans', now: NOON });
  assert.ok(zh.texts.includes('黑方走棋'), zh.texts.join(' | '));
});

test('puzzle: in the evening or once solved the solution is written out and played on the board, a move every two seconds', () => {
  const r = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'es', now: EVENING });
  assert.ok(r.texts.includes('Solución:') && r.texts.includes('23… Cf4+') && r.texts.includes('Txh5#'), r.texts.join(' | '));
  const d = demoData(NOON);
  assert.equal(revealed(d, { reveal: 'evening', revealHour: 20 }, NOON), false);
  assert.equal(revealed(d, { reveal: 'evening', revealHour: 20 }, EVENING), true);
  assert.equal(revealed(d, { reveal: 'solved', revealHour: 20 }, EVENING), false);
  assert.equal(revealed(demoData(NOON, { solved: true }), { reveal: 'solved', revealHour: 20 }, NOON), true);
  assert.equal(revealed(demoData(NOON, { solved: true }), { reveal: 'never', revealHour: 20 }, NOON), false);
  const steps = Array.from({ length: 8 }, (_, i) => stepAt(d.start!, i * STEP_MS));
  assert.deepEqual(steps, [0, 1, 2, 3, 4, 5, 5, 5]);
  assert.deepEqual(stepAt(d.start!, 8 * STEP_MS), 0, 'and again');
  const solved = renderWidget(puzzle, { size: { w: 480, h: 240 }, locale: 'en', now: NOON, sources: { [SOURCE]: demoData(NOON, { solved: true }) } });
  assert.ok(solved.texts.includes('Solved · 1 wrong'), solved.texts.join(' | '));
  assert.equal(typeof puzzle.redraw === 'function' && JSON.stringify(puzzle.redraw({ options: defaultsOf(puzzle.options as never), data: undefined, sources: { [SOURCE]: d }, now: EVENING } as never)), JSON.stringify({ everyMs: STEP_MS }));
  assert.equal(typeof puzzle.redraw === 'function' && puzzle.redraw({ options: defaultsOf(puzzle.options as never), data: undefined, sources: { [SOURCE]: d }, now: NOON } as never), 'minute');
});

test('puzzle: a strip gets words only; a long strip a board beside the words; a tall tile the board on top', () => {
  assert.equal(layout({ x: 0, y: 0, w: 240, h: 70 }).board, null);
  const wide = layout({ x: 0, y: 0, w: 1920, h: 140 });
  assert.deepEqual([wide.board!.w, wide.text!.x > wide.board!.w], [136, true]);
  const tall = layout({ x: 0, y: 0, w: 172, h: 320 });
  assert.equal(tall.board!.w, 168);
  assert.ok(tall.text!.y >= 168);
  const strip = renderWidget(puzzle, { size: { w: 240, h: 70 }, locale: 'en', now: NOON });
  assert.equal(strip.texts[0], 'Black to move · 1969');
});

test('puzzle: before the first read, and when Lichess cannot be reached', () => {
  assert.equal(renderWidget(puzzle, { size: { w: 320, h: 200 }, locale: 'en', demo: false }).texts.join(' '), 'Loading the puzzle of the day…');
  const down = variants().find(([n]) => n === 'down')![1];
  assert.equal(renderWidget(puzzle, { size: { w: 320, h: 200 }, locale: 'en', sources: { [SOURCE]: down } }).texts.join(' '), 'No puzzle today Lichess could not be reached');
});

test('games: how many wait, each opponent with the time left; a message without a token or games', () => {
  const r = renderWidget(games, { size: { w: 480, h: 240 }, locale: 'en', now: NOON });
  assert.ok(r.texts.includes('2 games wait for your move') || r.texts.includes('2 games'), r.texts.join(' | '));
  assert.ok(r.texts.includes('vs Ana_Lopez 1720') && r.texts.includes('2 d 5 h'), r.texts.join(' | '));
  const v = Object.fromEntries(variants().map(([n, d]) => [n, d]));
  assert.deepEqual(renderWidget(games, { size: { w: 320, h: 200 }, locale: 'es', sources: { [SOURCE]: v['no token']! } }).texts, ['Añade un token de Lichess', 'En Ajustes → Fuentes de datos → Lichess']);
  assert.deepEqual(renderWidget(games, { size: { w: 320, h: 200 }, locale: 'de', sources: { [SOURCE]: v['no games']! } }).texts, ['Keine Partie wartet auf dich']);
  assert.equal(widgetState(games, 'idle', { sources: { [SOURCE]: v['no games']! } }), true);
  assert.equal(widgetState(games, 'idle', { now: NOON }), false);
});
