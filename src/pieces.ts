/**
 * The plugin's own piece set, drawn as paths on a 100×100 square: plain,
 * heavy silhouettes with a thick outline, made to read on squares of 12 to
 * 60 px on a panel across the desk. Original drawings (not derived from any
 * existing set), MIT like the rest of the plugin.
 *
 * White pieces: ivory with a dark outline. Black pieces: near-black with a
 * dark outline and a light inner line, so they don't sink into dark squares.
 */
import type { Graphics } from '@kiosko/sdk';
import type { Color, PieceType } from './puzzle.ts';

type Path = (g: Graphics) => void;

/** The foot every piece stands on. */
const base: Path = (g) => {
  g.moveTo(20, 91);
  g.lineTo(80, 91);
  g.lineTo(80, 85);
  g.quadraticCurveTo(80, 80, 74, 79);
  g.lineTo(26, 79);
  g.quadraticCurveTo(20, 80, 20, 85);
  g.closePath();
};

const BODY: Record<PieceType, Path> = {
  p: (g) => {
    g.moveTo(34, 80);
    g.quadraticCurveTo(36, 62, 44, 52);
    g.lineTo(37, 49);
    g.quadraticCurveTo(36, 45, 41, 43);
    g.arc(50, 31, 13.5, Math.PI * 0.72, Math.PI * 0.28);
    g.lineTo(59, 43);
    g.quadraticCurveTo(64, 45, 63, 49);
    g.lineTo(56, 52);
    g.quadraticCurveTo(64, 62, 66, 80);
    g.closePath();
  },
  r: (g) => {
    g.moveTo(30, 80);
    g.lineTo(33, 44);
    g.lineTo(26, 38);
    g.lineTo(26, 15);
    g.lineTo(37, 15);
    g.lineTo(37, 23);
    g.lineTo(45, 23);
    g.lineTo(45, 15);
    g.lineTo(55, 15);
    g.lineTo(55, 23);
    g.lineTo(63, 23);
    g.lineTo(63, 15);
    g.lineTo(74, 15);
    g.lineTo(74, 38);
    g.lineTo(67, 44);
    g.lineTo(70, 80);
    g.closePath();
  },
  b: (g) => {
    g.moveTo(32, 80);
    g.quadraticCurveTo(38, 72, 40, 65);
    g.lineTo(37, 65);
    g.quadraticCurveTo(33, 62, 36, 58);
    g.quadraticCurveTo(28, 44, 40, 30);
    g.quadraticCurveTo(45, 24, 50, 21);
    g.quadraticCurveTo(55, 24, 60, 30);
    g.quadraticCurveTo(72, 44, 64, 58);
    g.quadraticCurveTo(67, 62, 63, 65);
    g.lineTo(60, 65);
    g.quadraticCurveTo(62, 72, 68, 80);
    g.closePath();
  },
  n: (g) => {
    // A horse's head looking left: back of the neck on the right, nose on the left.
    g.moveTo(30, 80);
    g.quadraticCurveTo(30, 66, 42, 57);
    g.quadraticCurveTo(47, 53, 45, 49);
    g.lineTo(32, 56);
    g.quadraticCurveTo(24, 60, 20, 54);
    g.quadraticCurveTo(17, 49, 22, 45);
    g.lineTo(38, 28);
    g.lineTo(39, 19);
    g.lineTo(46, 24);
    g.lineTo(50, 13);
    g.lineTo(55, 22);
    g.quadraticCurveTo(72, 28, 74, 50);
    g.quadraticCurveTo(75, 66, 70, 80);
    g.closePath();
  },
  q: (g) => {
    g.moveTo(30, 80);
    g.lineTo(23, 36);
    g.lineTo(35, 56);
    g.lineTo(38, 29);
    g.lineTo(47, 54);
    g.lineTo(50, 25);
    g.lineTo(53, 54);
    g.lineTo(62, 29);
    g.lineTo(65, 56);
    g.lineTo(77, 36);
    g.lineTo(70, 80);
    g.closePath();
  },
  k: (g) => {
    g.moveTo(31, 80);
    g.lineTo(24, 52);
    g.quadraticCurveTo(21, 38, 34, 37);
    g.quadraticCurveTo(44, 37, 50, 47);
    g.quadraticCurveTo(56, 37, 66, 37);
    g.quadraticCurveTo(79, 38, 76, 52);
    g.lineTo(69, 80);
    g.closePath();
  },
};

/** Drawn first, so the body covers where they meet: the queen's pearls, the king's cross, the bishop's knob. */
const UNDER: Partial<Record<PieceType, Path>> = {
  q: (g) => {
    for (const [x, y] of [[23, 33], [38, 26], [50, 21], [62, 26], [77, 33]] as const) {
      g.moveTo(x + 5.5, y);
      g.arc(x, y, 5.5, 0, Math.PI * 2);
    }
  },
  b: (g) => {
    g.moveTo(56, 16);
    g.arc(50, 16, 6, 0, Math.PI * 2);
  },
  k: (g) => {
    g.moveTo(46, 8);
    g.lineTo(54, 8);
    g.lineTo(54, 15);
    g.lineTo(61, 15);
    g.lineTo(61, 22);
    g.lineTo(54, 22);
    g.lineTo(54, 38);
    g.lineTo(46, 38);
    g.lineTo(46, 22);
    g.lineTo(39, 22);
    g.lineTo(39, 15);
    g.lineTo(46, 15);
    g.closePath();
  },
};

/** Inner lines: collars, the mitre's slit, the eye. Only drawn when there are pixels for them. */
const DETAIL: Record<PieceType, Path> = {
  p: (g) => {
    g.moveTo(40, 49);
    g.lineTo(60, 49);
  },
  r: (g) => {
    g.moveTo(33, 44);
    g.lineTo(67, 44);
    g.moveTo(31, 72);
    g.lineTo(69, 72);
  },
  b: (g) => {
    g.moveTo(38, 65);
    g.lineTo(62, 65);
    g.moveTo(56, 35);
    g.lineTo(47, 47);
  },
  n: (g) => {
    g.moveTo(43.5, 33);
    g.arc(41, 33, 2.5, 0, Math.PI * 2);
    g.moveTo(60, 27);
    g.quadraticCurveTo(68, 40, 66, 62);
  },
  q: (g) => {
    g.moveTo(31, 72);
    g.lineTo(69, 72);
  },
  k: (g) => {
    g.moveTo(31, 72);
    g.lineTo(69, 72);
    g.moveTo(50, 48);
    g.lineTo(50, 70);
  },
};

export const PIECE_COLORS = {
  w: { fill: '#F7F3E8', edge: '#16181B', detail: '#16181B' },
  b: { fill: '#24262A', edge: '#0A0B0C', detail: '#C9CDD2' },
};

/**
 * Paints a piece filling the square at (x, y) of side `s` (pixels). The
 * outline keeps at least one pixel at any size; inner lines only from 18 px.
 */
export function drawPiece(g: Graphics, type: PieceType, color: Color, x: number, y: number, s: number, alpha = 1): void {
  const c = PIECE_COLORS[color];
  const k = s / 100;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.scale(k, k);
  // Small squares: a little bigger, the margins matter less than the shape.
  if (s < 24) {
    g.translate(50, 52);
    g.scale(1.12, 1.12);
    g.translate(-50, -52);
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Outline width in panel pixels, whatever the size.
  const edge = Math.max(s < 16 ? 1 : 1.1, s * 0.05) / k;
  // Under 18 px the queen's pearls are only a blur: her crown alone.
  for (const part of [s >= 18 || type !== 'q' ? UNDER[type] : undefined, BODY[type], base]) {
    if (!part) continue;
    g.beginPath();
    part(g);
    g.fillStyle = c.fill;
    g.fill('nonzero');
    g.strokeStyle = c.edge;
    g.lineWidth = edge;
    g.stroke();
  }
  if (s >= 18) {
    g.beginPath();
    DETAIL[type](g);
    g.strokeStyle = c.detail;
    g.lineWidth = Math.max(1, s * 0.035) / k;
    g.stroke();
    if (color === 'b' && s >= 26) {
      // A faint light rim inside the outline: a black piece on a dark square still has a shape.
      g.beginPath();
      BODY[type](g);
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = Math.max(1, s * 0.02) / k;
      g.save();
      g.clip();
      g.stroke();
      g.restore();
    }
  }
  g.restore();
}
