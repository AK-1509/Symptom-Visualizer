import type { Region, Sex } from '../lib/types.ts';

/** Body is drawn in a 360-wide space centered on x = 180; the viewBox adds room for callouts. */
export const VIEWBOX = '-90 0 540 800';
export const MIRROR = 'matrix(-1 0 0 1 360 0)';

type Tag = '' | 's' | 'w' | 'p' | 'l';
type Pt = [x: number, y: number, tag?: Tag];

/** Right half of a front-facing figure, from the crown down the outside and back up the inside of the leg. */
const HALF: Pt[] = [
  [180, 16], [203, 21], [216, 40], [219, 66], [215, 92], [206, 112], [196, 126], [197, 144],
  [212, 154, 's'], [242, 164, 's'], [260, 180, 's'], [268, 206, 's'],
  [272, 244, 's'], [278, 290, 's'], [286, 336, 's'], [294, 380, 's'],
  [302, 400, 's'], [304, 424, 's'], [296, 440, 's'], [286, 436, 's'], [282, 412, 's'],
  [274, 384, 's'], [262, 338, 's'], [254, 294, 's'], [248, 252, 's'], [242, 226, 's'],
  [240, 262, 'w'], [234, 306, 'w'],
  [238, 350, 'p'], [246, 392, 'p'], [248, 430, 'p'],
  [244, 488, 'l'], [236, 548], [232, 590], [234, 632], [228, 690], [220, 740],
  [224, 764], [220, 780], [198, 782], [196, 764],
  [200, 740], [198, 690], [194, 610], [192, 548], [190, 488], [186, 446],
  [180, 440],
];

const SHIFTS: Record<Sex, Record<Exclude<Tag, ''>, number>> = {
  amab: { s: 0, w: 0, p: 0, l: 0 },
  afab: { s: -8, w: -9, p: 8, l: 4 },
};

/** Closed Catmull-Rom spline through the points, as cubic Bézier segments. */
function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  const p = (i: number) => points[(i + n) % n];
  let d = `M${p(0)[0]},${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return `${d} Z`;
}

export const armShift = (sex: Sex) => SHIFTS[sex].s;

export function silhouette(sex: Sex): string {
  const shift = SHIFTS[sex];
  const right: [number, number][] = HALF.map(([x, y, tag]) => [x + (tag ? shift[tag] : 0), y]);
  // Mirror the right half (excluding the two centerline points) to build the left half.
  const left = right
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [360 - x, y] as [number, number]);
  return smoothClosed([...right, ...left]);
}

export interface Shape {
  d: string;
  /** Lines are drawn with strokes; organs with fills. */
  line?: boolean;
  /** Decorative internal detail: not part of the hit area or state fill. */
  detail?: boolean;
  /** Draw a mirrored copy as well. */
  mirror?: boolean;
  /** Follows the arm, which sits closer to the torso in the AFAB silhouette. */
  arm?: boolean;
}

export interface RegionGeometry {
  shapes: Shape[];
  /** Callout anchor and the side its label sits on. */
  anchor: [number, number];
  side: 'left' | 'right';
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;

const shared: Record<Exclude<Region, 'reproductive' | 'bladder' | 'skin' | 'whole_body'>, RegionGeometry> = {
  musculoskeletal: {
    anchor: [215, 520],
    side: 'right',
    shapes: [
      { d: 'M182,162 Q204,158 236,168', line: true, mirror: true },
      { d: 'M252,192 L262,288 M265,298 L282,384', line: true, mirror: true, arm: true },
      { d: 'M146,372 C138,396 150,418 172,422', line: true, mirror: true },
      { d: 'M216,450 L214,570 M213,582 L208,732', line: true, mirror: true },
    ],
  },
  blood: {
    anchor: [187, 300],
    side: 'right',
    shapes: [
      { d: 'M187,262 L187,380', line: true },
      { d: 'M187,380 Q204,392 222,446 L222,560 L214,700', line: true },
      { d: 'M187,380 Q156,392 138,446 L138,560 L146,700', line: true },
      { d: 'M172,120 L172,160 M188,120 L188,160', line: true },
      { d: 'M222,170 Q244,178 258,196 L268,288 L286,378', line: true, mirror: true, arm: true },
    ],
  },
  nervous_system: {
    anchor: [180, 470],
    side: 'left',
    shapes: [
      { d: 'M180,128 L180,432', line: true },
      { d: 'M180,176 Q214,180 244,204 L256,292 L274,386', line: true, mirror: true, arm: true },
      { d: 'M182,420 Q200,432 206,452 L204,570 L200,730', line: true, mirror: true },
    ],
  },
  immune: {
    anchor: [236, 226],
    side: 'right',
    shapes: [
      { d: ellipse(166, 138, 4, 4), mirror: true },
      { d: ellipse(226, 222, 4.5, 4.5), mirror: true },
      { d: ellipse(208, 426, 4.5, 4.5), mirror: true },
      { d: ellipse(180, 176, 6, 5) },
    ],
  },
  brain: {
    anchor: [212, 46],
    side: 'right',
    shapes: [
      { d: 'M180,26 C200,24 212,38 212,55 C212,71 202,82 190,82 L170,82 C158,82 148,71 148,55 C148,38 160,24 180,26 Z' },
      { d: 'M180,30 L180,80 M160,42 Q168,48 162,56 M200,42 Q192,48 198,56 M156,66 Q166,64 170,72 M204,66 Q194,64 190,72', detail: true, line: true },
    ],
  },
  eyes: {
    anchor: [200, 93],
    side: 'right',
    shapes: [{ d: ellipse(193, 93, 6, 3.5), mirror: true }],
  },
  mouth_throat: {
    anchor: [189, 112],
    side: 'right',
    shapes: [{ d: ellipse(180, 111, 8.5, 3.2) }, { d: 'M175,118 L185,118 L185,145 Q180,148 175,145 Z' }],
  },
  thyroid: {
    anchor: [192, 152],
    side: 'right',
    shapes: [{ d: 'M168,151 C168,144 176,144 178,149 L182,149 C184,144 192,144 192,151 C192,159 184,161 180,156 C176,161 168,159 168,151 Z' }],
  },
  lungs: {
    anchor: [138, 214],
    side: 'left',
    shapes: [
      { d: 'M172,180 C160,176 140,190 136,216 C132,242 134,262 140,272 C150,277 164,273 172,266 C176,240 177,206 172,180 Z' },
      { d: 'M188,180 C200,176 220,190 224,216 C228,242 226,262 220,272 C210,277 200,273 194,268 C198,256 200,246 196,238 C191,226 189,204 188,180 Z' },
      { d: 'M180,160 L180,182 M180,182 L171,192 M180,182 L189,192', line: true },
    ],
  },
  heart: {
    anchor: [212, 236],
    side: 'right',
    shapes: [{ d: 'M186,214 C198,208 214,216 212,232 C210,248 196,258 186,264 C178,256 170,246 170,234 C170,222 177,215 186,214 Z' }],
  },
  liver: {
    anchor: [131, 292],
    side: 'left',
    shapes: [{ d: 'M130,280 C140,268 176,266 200,272 C206,274 206,281 200,285 C186,297 162,309 144,311 C134,311 128,299 130,280 Z' }],
  },
  stomach: {
    anchor: [228, 294],
    side: 'right',
    shapes: [{ d: 'M200,276 C208,268 225,271 229,284 C233,298 229,315 215,321 C205,325 193,321 189,313 C197,313 205,307 207,299 C207,291 200,287 200,276 Z' }],
  },
  pancreas: {
    anchor: [218, 325],
    side: 'right',
    shapes: [{ d: 'M164,323 C176,316 196,318 214,319 C221,320 223,327 214,329 C198,331 178,333 166,331 C160,330 160,325 164,323 Z' }],
  },
  kidneys: {
    anchor: [130, 350],
    side: 'left',
    shapes: [{ d: 'M142,332 C132,332 128,344 130,354 C132,366 140,370 146,366 C142,360 142,352 148,346 C150,338 148,332 142,332 Z', mirror: true }],
  },
  intestines: {
    anchor: [206, 362],
    side: 'right',
    shapes: [
      { d: 'M158,340 C158,335 202,335 202,340 L205,380 C205,388 155,388 155,380 Z' },
      { d: 'M166,348 Q180,342 194,348 Q200,356 186,358 Q170,358 168,366 Q170,374 184,372 Q196,370 194,378', detail: true, line: true },
    ],
  },
  endocrine: {
    anchor: [150, 322],
    side: 'left',
    shapes: [{ d: ellipse(180, 76, 3.5, 3.5) }, { d: 'M136,330 L144,320 L151,329 Z', mirror: true }],
  },
};

const bySex: Record<Sex, Pick<Record<Region, RegionGeometry>, 'bladder' | 'reproductive'>> = {
  amab: {
    bladder: { anchor: [193, 402], side: 'right', shapes: [{ d: ellipse(180, 402, 13, 10) }] },
    reproductive: {
      anchor: [194, 438],
      side: 'right',
      shapes: [{ d: ellipse(180, 419, 5.5, 5) }, { d: ellipse(187, 440, 6, 8), mirror: true }],
    },
  },
  afab: {
    bladder: { anchor: [192, 424], side: 'right', shapes: [{ d: ellipse(180, 424, 12, 8) }] },
    reproductive: {
      anchor: [205, 393],
      side: 'right',
      shapes: [
        { d: 'M170,392 C170,384 190,384 190,392 C190,402 186,410 182,414 L178,414 C174,410 170,402 170,392 Z' },
        { d: ellipse(200, 393, 5, 4), mirror: true },
        { d: 'M190,389 C194,386 197,387 199,389', line: true, mirror: true },
      ],
    },
  },
};

export function regionGeometry(sex: Sex): Record<Exclude<Region, 'skin' | 'whole_body'>, RegionGeometry> {
  return { ...shared, ...bySex[sex] };
}

/** Draw order: systemic networks first, organs on top, endocrine glands last so they stay clickable. */
export const DRAW_ORDER: Exclude<Region, 'skin' | 'whole_body'>[] = [
  'musculoskeletal',
  'blood',
  'nervous_system',
  'immune',
  'brain',
  'eyes',
  'mouth_throat',
  'thyroid',
  'lungs',
  'heart',
  'liver',
  'kidneys',
  'stomach',
  'intestines',
  'pancreas',
  'bladder',
  'reproductive',
  'endocrine',
];

export const SKIN_ANCHOR: [number, number] = [118, 560];
export const WHOLE_BODY_ANCHOR: [number, number] = [150, 24];
