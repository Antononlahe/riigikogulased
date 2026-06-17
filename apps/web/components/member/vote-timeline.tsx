"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Group } from "@visx/group";
import { scaleTime, scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath, Line } from "@visx/shape";
import { AxisBottom } from "@visx/axis";
import { ParentSize } from "@visx/responsive";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
import { curveMonotoneX } from "@visx/curve";
import {
  classifyVote,
  monthlyDiscipline,
  partySwitchPoints,
  eelnouUrl,
  type VoteClass,
  type VotePoint,
  type MonthPoint,
} from "@/lib/member-detail";
import { partyToken } from "@/lib/party";

// visx ParentSize fills its parent (outer div is height:100%); if the parent has no
// height the measurement div collapses to 0 and its overflow:hidden clips the chart to
// nothing. So the wrapper MUST carry this explicit height. Keep it in sync with the svg.
const TIMELINE_HEIGHT = 200;
// SSR / pre-measure fallback width so the prerendered chart isn't zero-width before the
// client ResizeObserver reports the real container width.
const TIMELINE_FALLBACK_WIDTH = 640;

const CLASS_COLOR: Record<VoteClass, string> = {
  aligned: "var(--foreground)",
  against: "var(--destructive)",
  excluded: "var(--muted-foreground)",
};

const MARGIN = { left: 38, right: 10, top: 10, bottom: 22 };
const TREND_H = 78;
const STRIP_Y = 108;
const STRIP_H = 22;
const CLICK_PX = 8; // screen-px radius for hover/click hit-testing a mark

type ScoredMonth = MonthPoint & { score: number };

function Chart({
  width,
  votes,
  partyShortName,
}: {
  width: number;
  votes: VotePoint[];
  partyShortName: string | null;
}) {
  const t = useTranslations("memberDetail");
  const tip = useTooltip<VotePoint>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Zoomed time window as [startMs, endMs], or null for the full range.
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  // Live drag selection in svg-x pixels, or null when not dragging.
  const [sel, setSel] = useState<{ x0: number; x1: number } | null>(null);
  const dragging = useRef(false);

  const fill = partyToken(partyShortName).fill;
  const innerRight = width - MARGIN.right;

  const sorted = useMemo(
    () => [...votes].sort((a, b) => a.votedAt.localeCompare(b.votedAt)),
    [votes],
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noVotes")}</p>;
  }

  const fullMin = new Date(sorted[0].votedAt).getTime();
  const fullMax = new Date(sorted[sorted.length - 1].votedAt).getTime();
  const domMin = zoom ? zoom[0] : fullMin;
  const domMax = zoom ? zoom[1] : fullMax;

  const x = scaleTime({
    domain: [new Date(domMin), new Date(domMax)],
    range: [MARGIN.left, innerRight],
  });

  const inDomain = (ms: number) => ms >= domMin && ms <= domMax;
  const visible = sorted.filter((v) => inDomain(new Date(v.votedAt).getTime()));

  const months = monthlyDiscipline(sorted);
  const scored = months.filter(
    (m): m is ScoredMonth =>
      m.score !== null && inDomain(new Date(`${m.month}-15T00:00:00Z`).getTime()),
  );
  const switches = partySwitchPoints(sorted).filter((s) =>
    inDomain(new Date(s.date).getTime()),
  );

  // Tighten the y-domain to the data so the ~90-100% range is readable instead of a flat
  // band hugging the top. Floor to a 5% step a little below the minimum scored month.
  const minScore = scored.length ? Math.min(...scored.map((m) => m.score)) : 0.8;
  const lo = Math.max(0, Math.min(0.95, Math.floor((minScore - 0.051) * 20) / 20));
  const yTrend = scaleLinear({ domain: [lo, 1], range: [MARGIN.top + TREND_H, MARGIN.top] });
  const monthX = (m: string) => x(new Date(`${m}-15T00:00:00Z`));
  const yTicks = [lo, lo + (1 - lo) / 2, 1];

  function svgX(clientX: number): number {
    const r = svgRef.current?.getBoundingClientRect();
    return r ? clientX - r.left : 0;
  }
  function clamp(px: number) {
    return Math.max(MARGIN.left, Math.min(innerRight, px));
  }
  function nearest(px: number): { v: VotePoint; mx: number } | null {
    let best: { v: VotePoint; mx: number } | null = null;
    for (const v of visible) {
      const mx = x(new Date(v.votedAt));
      const d = Math.abs(mx - px);
      if (d <= CLICK_PX && (!best || d < Math.abs(best.mx - px))) best = { v, mx };
    }
    return best;
  }

  function onDown(e: React.PointerEvent) {
    const px = clamp(svgX(e.clientX));
    dragging.current = true;
    setSel({ x0: px, x1: px });
    e.currentTarget.setPointerCapture(e.pointerId);
    tip.hideTooltip();
  }
  function onMove(e: React.PointerEvent) {
    const px = clamp(svgX(e.clientX));
    if (dragging.current && sel) {
      setSel({ x0: sel.x0, x1: px });
      return;
    }
    const hit = nearest(px);
    if (hit) tip.showTooltip({ tooltipData: hit.v, tooltipLeft: hit.mx, tooltipTop: STRIP_Y });
    else tip.hideTooltip();
  }
  function onUp(e: React.PointerEvent) {
    const px = clamp(svgX(e.clientX));
    const start = sel?.x0 ?? px;
    dragging.current = false;
    setSel(null);
    if (Math.abs(px - start) >= 5) {
      const a = x.invert(Math.min(px, start)).getTime();
      const b = x.invert(Math.max(px, start)).getTime();
      if (b - a > 0) setZoom([a, b]);
      tip.hideTooltip();
    } else {
      const hit = nearest(start);
      const url = hit ? eelnouUrl(hit.v.draftUuid) : null;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  function onLeave() {
    dragging.current = false;
    setSel(null);
    tip.hideTooltip();
  }

  return (
    <div className="relative">
      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="absolute right-0 top-0 z-10 rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("zoomReset")}
        </button>
      )}
      <svg
        ref={svgRef}
        width={width}
        height={TIMELINE_HEIGHT}
        role="img"
        aria-label={t("timelineAria", { n: votes.length })}
      >
        {/* y reference lines + % labels */}
        {yTicks.map((tv, i) => (
          <Group key={i}>
            <line
              x1={MARGIN.left}
              x2={innerRight}
              y1={yTrend(tv)}
              y2={yTrend(tv)}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={tv === 1 ? 0.8 : 0.4}
            />
            <text x={MARGIN.left - 6} y={yTrend(tv) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
              {Math.round(tv * 100)}%
            </text>
          </Group>
        ))}

        <AreaClosed<ScoredMonth>
          data={scored}
          x={(m) => monthX(m.month)}
          y={(m) => yTrend(m.score)}
          yScale={yTrend}
          fill={fill}
          opacity={0.1}
          curve={curveMonotoneX}
        />
        <LinePath<ScoredMonth>
          data={scored}
          x={(m) => monthX(m.month)}
          y={(m) => yTrend(m.score)}
          stroke={fill}
          strokeWidth={1.75}
          curve={curveMonotoneX}
        />

        {switches.map((s, i) => (
          <Line
            key={i}
            from={{ x: x(new Date(s.date)), y: MARGIN.top }}
            to={{ x: x(new Date(s.date)), y: STRIP_Y + STRIP_H + 4 }}
            stroke="var(--border)"
            strokeDasharray="2,2"
          />
        ))}

        <Group>
          {visible.map((v, i) => {
            const c = classifyVote(v);
            const color = c === "aligned" ? fill : CLASS_COLOR[c];
            const px = x(new Date(v.votedAt));
            return (
              <rect
                key={i}
                x={px}
                y={STRIP_Y}
                width={1.5}
                height={c === "excluded" ? 10 : STRIP_H}
                fill={color}
                opacity={c === "excluded" ? 0.4 : 0.9}
              />
            );
          })}
        </Group>

        {sel && (
          <rect
            x={Math.min(sel.x0, sel.x1)}
            y={MARGIN.top}
            width={Math.abs(sel.x1 - sel.x0)}
            height={STRIP_Y + STRIP_H - MARGIN.top}
            fill="var(--foreground)"
            opacity={0.08}
          />
        )}

        {/* interaction overlay: hover tooltip, click-to-open, drag-to-zoom */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={Math.max(0, innerRight - MARGIN.left)}
          height={STRIP_Y + STRIP_H - MARGIN.top}
          fill="transparent"
          style={{ cursor: "crosshair", touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onLeave}
        />

        <AxisBottom
          top={TIMELINE_HEIGHT - MARGIN.bottom}
          scale={x}
          numTicks={6}
          stroke="var(--border)"
          tickStroke="var(--border)"
          tickLabelProps={{ fill: "var(--muted-foreground)", fontSize: 10, textAnchor: "middle" }}
        />
      </svg>

      {tip.tooltipOpen && tip.tooltipData && (
        <TooltipWithBounds left={tip.tooltipLeft} top={tip.tooltipTop} style={{ ...defaultStyles }}>
          <div className="max-w-60 text-xs">
            <div className="font-semibold">{tip.tooltipData.votedAt.slice(0, 10)}</div>
            <div className="line-clamp-2">{tip.tooltipData.draftTitle ?? tip.tooltipData.title}</div>
            <div className="mt-1 text-muted-foreground">{t(`class.${classifyVote(tip.tooltipData)}`)}</div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function VoteTimeline({
  votes,
  partyShortName,
}: {
  votes: VotePoint[];
  partyShortName: string | null;
}) {
  const t = useTranslations("memberDetail");
  return (
    <div className="mt-3">
      {/* explicit height so ParentSize's overflow:hidden box can't collapse and clip the chart */}
      <div style={{ height: TIMELINE_HEIGHT }}>
        <ParentSize>
          {({ width }) => (
            <Chart
              width={width || TIMELINE_FALLBACK_WIDTH}
              votes={votes}
              partyShortName={partyShortName}
            />
          )}
        </ParentSize>
      </div>
      {votes.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">{t("zoomHint")}</p>
      )}
    </div>
  );
}
