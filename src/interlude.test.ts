import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createBaseContext, defaultsOf, themeById, type InterludePlayer, type PadEvent, type PadKey } from '@kiosko/sdk';
import { createHttp } from '@kiosko/sdk';
import { cellOf } from './board.ts';
import { MIN_PX, SOURCE, type ChessData } from './common.ts';
import { demoData } from './demo.ts';
import { fixtureText } from './fixtures.ts';
import { play, screenLayout } from './interlude.ts';
import { AGENT, useClient } from './lichess.ts';
import { uciOf } from './puzzle.ts';
import { loadOutcomes, saveOutcome } from './store.ts';

const dir = () => mkdtempSync(join(tmpdir(), 'kiosko-chess-'));
const SIZES = [{ w: 172, h: 320 }, { w: 240, h: 70 }, { w: 320, h: 240 }, { w: 480, h: 320 }, { w: 800, h: 480 }, { w: 1920, h: 140 }, { w: 1920, h: 462 }, { w: 320, h: 320 }];
const LOCALES = ['en', 'es', 'zh-Hant'];

/** What Kiosko hands the interlude, with a pad the test presses. */
function context(o: { w: number; h: number; locale?: string; data?: ChessData | null; played?: boolean; dataDir?: string; cacheDir?: string }) {
  const listeners = new Set<(e: PadEvent) => void>();
  const logs: string[] = [];
  const ctx = {
    ...createBaseContext({ now: Date.now(), locale: o.locale ?? 'en', dataDir: o.dataDir ?? dir(), cacheDir: o.cacheDir ?? dir(), log: (m: string) => logs.push(m) }),
    options: defaultsOf(play.options as never),
    width: o.w,
    height: o.h,
    seed: 1,
    theme: themeById('midnight'),
    canvas: { createCanvas, loadImage },
    sources: o.data === null ? {} : { [SOURCE]: o.data ?? demoData(Date.now()) },
    ...(o.played === false ? {} : { input: { on: (l: (e: PadEvent) => void) => (listeners.add(l), () => listeners.delete(l)) } }),
  };
  const press = (key: PadKey) => {
    for (const l of listeners) l({ key, pressed: true });
    for (const l of listeners) l({ key, pressed: false });
  };
  return { ctx, press, logs };
}

/** Paints a frame and says which font sizes its text used. */
function frame(p: InterludePlayer, w: number, h: number, i = 0) {
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  const sizes: number[] = [];
  const fill = g.fillText.bind(g);
  g.fillText = ((text: string, x: number, y: number, max?: number) => {
    if (text.trim()) sizes.push(Number(/(\d+(?:\.\d+)?)px/.exec(g.font)?.[1] ?? 0));
    return max === undefined ? fill(text, x, y) : fill(text, x, y, max);
  }) as typeof g.fillText;
  void p.draw(g as never, i);
  return { canvas: c, sizes, pixels: g.getImageData(0, 0, w, h).data };
}

test('played: frames at 8 sizes × 3 languages, no text under 11 px, for as long as someone plays', async () => {
  for (const s of SIZES)
    for (const locale of LOCALES) {
      const { ctx } = context({ ...s, locale });
      const p = (await play.prepare(ctx as never))!;
      assert.equal(p.frames, Infinity);
      const f = frame(p, s.w, s.h);
      assert.ok(f.sizes.length > 0, `${s.w}x${s.h} ${locale} writes something`);
      assert.deepEqual(f.sizes.filter((x) => x < MIN_PX), [], `${s.w}x${s.h} ${locale}`);
    }
});

test('the layout: board beside the words on wide screens, above them on tall ones, always whole squares', () => {
  for (const s of SIZES) {
    const l = screenLayout(s.w, s.h);
    assert.equal(l.board.w % 8, 0);
    assert.ok(l.board.x >= 0 && l.board.y >= 0 && l.board.x + l.board.w <= s.w && l.board.y + l.board.h <= s.h, `${s.w}x${s.h}`);
    if (l.panel) assert.ok(l.panel.x + l.panel.w <= s.w && l.panel.y + l.panel.h <= s.h, `${s.w}x${s.h} panel`);
  }
  assert.ok(screenLayout(800, 480).panel!.x > screenLayout(800, 480).board.w);
  assert.ok(screenLayout(172, 320).panel!.y > screenLayout(172, 320).board.h);
});

test('solving it with the pad, frame by frame: the picture follows the buttons and the result is kept', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-27T10:00:00Z') });
  try {
    const dataDir = dir();
    const { ctx, press } = context({ w: 480, h: 320, dataDir });
    const p = (await play.prepare(ctx as never))!;
    const data = ctx.sources[SOURCE] as ChessData;
    const start = data.start!;
    let i = 0;
    const draw = () => frame(p, 480, 320, i++);
    const before = draw().pixels;
    press('down');
    const after = draw().pixels;
    assert.notDeepEqual(Buffer.from(after), Buffer.from(before), 'the cursor moved on the panel');
    let cursor = 'g2';
    const goTo = (sq: string) => {
      for (let k = 0; k < 20 && cursor !== sq; k++) {
        const a = cellOf(cursor, start.turn);
        const b = cellOf(sq, start.turn);
        const key: PadKey = b.col > a.col ? 'right' : b.col < a.col ? 'left' : b.row > a.row ? 'down' : 'up';
        press(key);
        const f = cursor.charCodeAt(0) - 97;
        const r = Number(cursor[1]);
        // Black at the bottom: right is towards a, down towards rank 8.
        cursor = key === 'right' ? `${String.fromCharCode(97 + f - 1)}${r}` : key === 'left' ? `${String.fromCharCode(97 + f + 1)}${r}` : key === 'down' ? `${String.fromCharCode(97 + f)}${r + 1}` : `${String.fromCharCode(97 + f)}${r - 1}`;
        draw();
      }
    };
    for (const m of data.daily!.puzzle.puzzle.solution.filter((_, k) => k % 2 === 0)) {
      const u = uciOf(m);
      goTo(u.from);
      press('a');
      goTo(u.to);
      press('a');
      // The opponent answers after a moment, sliding in over a few frames.
      for (let k = 0; k < 12; k++) {
        mock.timers.tick(100);
        draw();
      }
      cursor = u.to;
      const reply = data.daily!.puzzle.puzzle.solution[data.daily!.puzzle.puzzle.solution.indexOf(m) + 1];
      if (reply) cursor = uciOf(reply).to;
    }
    const kept = loadOutcomes(dataDir);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.puzzleId, '3Ksou');
    assert.equal(kept[0]!.result, 'solved');
    assert.equal(kept[0]!.mistakes, 0);
  } finally {
    mock.timers.reset();
  }
});

test('at its time slot: a few minutes of frames at most; the solution shows only once solved (or in the evening)', async () => {
  const dataDir = dir();
  const { ctx } = context({ w: 480, h: 320, played: false, dataDir });
  ctx.options = { ...(ctx.options as object), revealHour: 24 } as never;
  const p = (await play.prepare(ctx as never))!;
  assert.ok(Number.isFinite(p.frames) && p.frames > 0);
  frame(p, 480, 320, 0);
  saveOutcome(dataDir, { puzzleId: '3Ksou', day: '2026-11-27', result: 'solved', mistakes: 0, hints: 0, at: Date.now() });
  const p2 = (await play.prepare(ctx as never))!;
  for (let i = 0; i < 5; i++) frame(p2, 480, 320, i);
});

test('without the source running: the puzzle is asked (or read from the cache) by the interlude itself; none at all: nothing to play', async () => {
  let calls = 0;
  const ok = createHttp({ agent: AGENT, fetch: (async () => (calls++, new Response(fixtureText('daily-3Ksou.json')))) as typeof fetch });
  const cacheDir = dir();
  useClient(ok);
  try {
    const { ctx } = context({ w: 320, h: 240, data: null, cacheDir });
    const p = await play.prepare(ctx as never);
    assert.ok(p);
    assert.equal(calls, 1);
    assert.ok(existsSync(join(cacheDir, 'daily.json')));
    await play.prepare(ctx as never);
    assert.equal(calls, 1, 'kept for the day');
    const down = createHttp({ agent: AGENT, fetch: (async () => new Response('', { status: 503 })) as typeof fetch });
    useClient(down);
    const none = context({ w: 320, h: 240, data: null });
    assert.equal(await play.prepare(none.ctx as never), null);
    assert.ok(none.logs.some((l) => /no puzzle/.test(l)));
  } finally {
    useClient(null);
  }
});
