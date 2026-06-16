"use client";

import { useMemo } from "react";
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
  type VoteClass,
  type VotePoint,
  type MonthPoint,
} from "@/lib/member-detail";
import { partyToken } from "@/lib/party";

const CLASS_COLOR: Record<VoteClass, string> = {
  aligned: "var(--foreground)",
  against: "var(--destructive)",
  excluded: "var(--muted-foreground)",
};

// visx ParentSize fills its parent (outer div is height:100%); if the parent has no
// height the measurement div collapses to 0 and its overflow:hidden clips the chart to
// nothing. So the wrapper MUST carry this explicit height. Keep it in sync with the svg.
const TIMELINE_HEIGHT = 200;
// SSR / pre-measure fallback width so the prerendered chart isn't zero-width before the
// client ResizeObserver reports the real container width.
const TIMELINE_FALLBACK_WIDTH = 640;

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
  const height = TIMELINE_HEIGHT;
  const trendH = 70;
  const stripY = 110;
  const margin = { left: 8, right: 8, top: 8, bottom: 24 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const fill = partyToken(partyShortName).fill;

  const { months, switches, dates } = useMemo(() => {
    const sorted = [...votes].sort((a, b) => a.votedAt.localeCompare(b.votedAt));
    return {
      months: monthlyDiscipline(sorted),
      switches: partySwitchPoints(sorted),
      dates: sorted.map((v) => new Date(v.votedAt)),
    };
  }, [votes]);

  if (votes.length === 0) return <p className="text-sm text-muted-foreground">{t("noVotes")}</p>;

  const x = scaleTime({
    domain: [dates[0], dates[dates.length - 1]],
    range: [margin.left, margin.left + innerW],
  });
  const yTrend = scaleLinear({ domain: [0, 1], range: [margin.top + trendH, margin.top] });
  const monthX = (m: string) => x(new Date(`${m}-15T00:00:00Z`));
  const scored = months.filter((m): m is MonthPoint & { score: number } => m.score !== null);

  return (
    <div className="relative">
      <svg width={width} height={height} role="img" aria-label={t("timelineAria", { n: votes.length })}>
        <AreaClosed<MonthPoint & { score: number }>
          data={scored}
          x={(m) => monthX(m.month)}
          y={(m) => yTrend(m.score)}
          yScale={yTrend}
          fill={fill}
          opacity={0.18}
          curve={curveMonotoneX}
        />
        <LinePath<MonthPoint & { score: number }>
          data={scored}
          x={(m) => monthX(m.month)}
          y={(m) => yTrend(m.score)}
          stroke={fill}
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
        {switches.map((s, i) => (
          <Line
            key={i}
            from={{ x: x(new Date(s.date)), y: margin.top }}
            to={{ x: x(new Date(s.date)), y: stripY + 26 }}
            stroke="var(--border)"
            strokeDasharray="2,2"
          />
        ))}
        <Group>
          {votes.map((v, i) => {
            const c = classifyVote(v);
            const color = c === "aligned" ? fill : CLASS_COLOR[c];
            const px = x(new Date(v.votedAt));
            return (
              <rect
                key={i}
                x={px}
                y={stripY}
                width={1.5}
                height={c === "excluded" ? 10 : 22}
                fill={color}
                opacity={c === "excluded" ? 0.4 : 0.9}
                tabIndex={0}
                aria-label={`${v.votedAt.slice(0, 10)}: ${t(`class.${c}`)}`}
                onMouseMove={() => tip.showTooltip({ tooltipData: v, tooltipLeft: px, tooltipTop: stripY })}
                onMouseLeave={tip.hideTooltip}
                onFocus={() => tip.showTooltip({ tooltipData: v, tooltipLeft: px, tooltipTop: stripY })}
                onBlur={tip.hideTooltip}
              />
            );
          })}
        </Group>
        <AxisBottom
          top={height - margin.bottom}
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
            <div className="line-clamp-2">{tip.tooltipData.title}</div>
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
  return (
    <div className="mt-3" style={{ height: TIMELINE_HEIGHT }}>
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
  );
}
