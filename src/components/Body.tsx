import { memo, useMemo, useState, type KeyboardEvent } from 'react';
import { REGION_INFO } from '../lib/anatomy.ts';
import type { RegionState } from '../lib/effects.ts';
import type { Region, Sex } from '../lib/types.ts';
import {
  DRAW_ORDER,
  MIRROR,
  SKIN_ANCHOR,
  VIEWBOX,
  WHOLE_BODY_ANCHOR,
  armShift,
  regionGeometry,
  silhouette,
  type Shape,
} from './bodyGeometry.ts';

interface BodyProps {
  sex: Sex;
  states: Map<Region, RegionState>;
  /** Number of active drugs mapped to each region. */
  overlap: Map<Region, number>;
  drugSelected: boolean;
  selectedRegion: Region | null;
  dropTarget: Region | null;
  onSelect: (region: Region) => void;
}

function describe(region: Region, state: RegionState | undefined, count: number): string {
  const parts: string[] = [];
  if (state?.therapeutic) parts.push('therapeutic use');
  if (state?.adverse) parts.push('adverse reactions');
  if (state?.warning) parts.push('warnings');
  let text = REGION_INFO[region].label;
  if (parts.length) text += `: ${parts.join(', ')}`;
  if (count > 1) text += ` (${count} active drugs)`;
  return text;
}

function stateClass(state: RegionState | undefined, drugSelected: boolean): string {
  if (!state) return drugSelected ? ' is-quiet' : '';
  return `${state.therapeutic ? ' is-therapeutic' : ''}${state.adverse ? ' is-adverse' : ''}${state.warning ? ' is-warning' : ''} is-affected`;
}

function ShapePaths({ shape, dx }: { shape: Shape; dx: number }) {
  const inner = shape.detail ? (
    <path className="detail" d={shape.d} />
  ) : shape.line ? (
    <>
      <path className="hit" d={shape.d} />
      <path className="line" d={shape.d} />
    </>
  ) : (
    <>
      <path className="fill" d={shape.d} />
      <path className="hatch" d={shape.d} />
      <path className="outline" d={shape.d} />
    </>
  );
  const shift = shape.arm && dx ? `translate(${dx} 0)` : undefined;
  return (
    <>
      <g transform={shift}>{inner}</g>
      {shape.mirror && <g transform={shift ? `${MIRROR} ${shift}` : MIRROR}>{inner}</g>}
    </>
  );
}

/** Front-facing SVG body. Every region is a focusable, clickable group addressable by its region id (#liver, #heart, ...). */
export const Body = memo(function Body({ sex, states, overlap, drugSelected, selectedRegion, dropTarget, onSelect }: BodyProps) {
  const [hover, setHover] = useState<Region | null>(null);
  const geometry = useMemo(() => regionGeometry(sex), [sex]);
  const outline = useMemo(() => silhouette(sex), [sex]);
  const dx = armShift(sex);

  const regionProps = (region: Region) => {
    const state = states.get(region);
    const count = overlap.get(region) ?? 0;
    const classes =
      `region r-${region}${stateClass(state, drugSelected)}` +
      `${selectedRegion === region ? ' is-selected' : ''}${dropTarget === region ? ' is-drop' : ''}`;
    return {
      id: region,
      'data-region': region,
      className: classes,
      role: 'button',
      tabIndex: 0,
      'aria-label': describe(region, state, count),
      'aria-pressed': selectedRegion === region,
      onClick: () => onSelect(region),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(region);
        }
      },
      onPointerEnter: () => setHover(region),
      onPointerLeave: () => setHover((h) => (h === region ? null : h)),
      onFocus: () => setHover(region),
      onBlur: () => setHover((h) => (h === region ? null : h)),
    };
  };

  const anchorOf = (region: Region): [number, number, 'left' | 'right'] => {
    if (region === 'skin') return [...SKIN_ANCHOR, 'left'];
    if (region === 'whole_body') return [...WHOLE_BODY_ANCHOR, 'left'];
    const g = geometry[region];
    const [x, y] = g.anchor;
    return [region === 'immune' ? x + dx : x, y, g.side];
  };

  const callout = dropTarget ?? hover ?? selectedRegion;
  // With a drug selected, overlap is shown only where it touches that drug's mapped regions.
  const badges = [...overlap.entries()].filter(([region, n]) => n > 1 && (!drugSelected || states.has(region)));

  return (
    <svg className={`body body-${sex}`} viewBox={VIEWBOX} role="group" aria-label={`${sex === 'amab' ? 'AMAB' : 'AFAB'} body map`}>
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
        </pattern>
        <radialGradient id="halo" cx="50%" cy="45%" r="60%">
          <stop offset="0%" className="halo-stop-in" />
          <stop offset="100%" className="halo-stop-out" />
        </radialGradient>
      </defs>
      <ellipse className="floor" cx="180" cy="784" rx="90" ry="8" />

      <g {...regionProps('whole_body')}>
        <title>{REGION_INFO.whole_body.label}</title>
        <path className="halo" d={outline} />
      </g>
      <g {...regionProps('skin')}>
        <title>{REGION_INFO.skin.label}</title>
        <path className="skin-fill" d={outline} />
        <path className="hatch" d={outline} />
        <path className="skin-outline" d={outline} />
      </g>

      {DRAW_ORDER.map((region) => (
        <g key={region} {...regionProps(region)}>
          <title>{REGION_INFO[region].label}</title>
          {geometry[region].shapes.map((shape, i) => (
            <ShapePaths key={i} shape={shape} dx={dx} />
          ))}
        </g>
      ))}

      <g className="badges" aria-hidden="true">
        {badges.map(([region, n]) => {
          const [x, y] = anchorOf(region);
          return (
            <g key={region} className="badge" transform={`translate(${x} ${y})`}>
              <circle r="6" />
              <text dy="2.7">{n}</text>
            </g>
          );
        })}
      </g>

      {callout && <Callout region={callout} at={anchorOf(callout)} />}
    </svg>
  );
});

function Callout({ region, at: [x, y, side] }: { region: Region; at: [number, number, 'left' | 'right'] }) {
  const end = side === 'right' ? 372 : -12;
  return (
    <g className="callout" aria-hidden="true">
      <circle cx={x} cy={y} r="2.4" />
      <path d={`M${x},${y} L${end},${y}`} />
      <text x={side === 'right' ? end + 6 : end - 6} y={y + 4} textAnchor={side === 'right' ? 'start' : 'end'}>
        {REGION_INFO[region].label}
      </text>
    </g>
  );
}
