"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { scaleTime } from "@visx/scale";
import { AxisBottom } from "@visx/axis";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import {
  classifyVote,
  againstVotes,
  againstKind,
  voteType,
  voteTypeOptions,
  eelnouUrl,
  type VotePoint,
} from "@/lib/member-detail";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Compact timeline height. ParentSize fills its parent (outer div is height:100%); without an
// explicit wrapper height the measurement box collapses to 0 and clips the chart — so the
// wrapper carries this height.
const TIMELINE_HEIGHT = 92;
const FALLBACK_WIDTH = 640;
const MARGIN = { left: 8, right: 10, top: 8, bottom: 22 };
const BASE_Y = 46; // baseline the context ticks straddle / lollipop stems rise from
const DOT_Y = 20; // defection dots
const RED = "var(--destructive)";

const keyOf = (v: VotePoint) => `${v.votedAt}|${v.title}`;

type Kind = "all" | "abstain" | "differ";

function Timeline({
  width,
  all,
  activeKeys,
  hovered,
  setHovered,
}: {
  width: number;
  all: VotePoint[];
  activeKeys: Set<string>;
  hovered: string | null;
  setHovered: (k: string | null) => void;
}) {
  const t = useTranslations("memberDetail");
  if (all.length === 0) return <p className="text-sm text-muted-foreground">{t("noVotes")}</p>;

  const innerRight = width - MARGIN.right;
  const dates = all.map((v) => new Date(v.votedAt));
  const x = scaleTime({
    domain: [dates[0], dates[dates.length - 1]],
    range: [MARGIN.left, innerRight],
  });
  const active = all.filter((v) => activeKeys.has(keyOf(v)));

  return (
    <svg width={width} height={TIMELINE_HEIGHT} role="img" aria-label={t("timelineAria", { n: all.length })}>
      {/* every non-highlighted vote: faint context tick (cadence, not interactive) */}
      <Group>
        {all.map((v, i) =>
          activeKeys.has(keyOf(v)) ? null : (
            <line
              key={i}
              x1={x(new Date(v.votedAt))}
              x2={x(new Date(v.votedAt))}
              y1={BASE_Y - 6}
              y2={BASE_Y + 6}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              opacity={0.2}
            />
          ),
        )}
      </Group>

      {/* highlighted defections: big red clickable lollipops */}
      <Group>
        {active.map((v, i) => {
          const px = x(new Date(v.votedAt));
          const k = keyOf(v);
          const on = hovered === k;
          const url = eelnouUrl(v.draftUuid);
          const handlers = {
            onMouseEnter: () => setHovered(k),
            onMouseLeave: () => setHovered(null),
            onFocus: () => setHovered(k),
            onBlur: () => setHovered(null),
          };
          const glyph = (
            <g style={{ cursor: url ? "pointer" : "default" }}>
              <line x1={px} x2={px} y1={BASE_Y} y2={DOT_Y} stroke={RED} strokeWidth={1.5} opacity={0.6} />
              <circle cx={px} cy={DOT_Y} r={on ? 6 : 4} fill={RED} />
              {/* generous transparent hit target */}
              <circle cx={px} cy={DOT_Y} r={12} fill="transparent" />
              {on && (
                <text x={px} y={11} textAnchor="middle" fontSize={10} fill="var(--foreground)">
                  {v.votedAt.slice(0, 10)}
                </text>
              )}
            </g>
          );
          return url ? (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${v.draftTitle ?? v.title} — ${t("openInRiigikogu")}`}
              {...handlers}
            >
              {glyph}
            </a>
          ) : (
            <g key={i} {...handlers}>
              {glyph}
            </g>
          );
        })}
      </Group>

      <AxisBottom
        top={TIMELINE_HEIGHT - MARGIN.bottom}
        scale={x}
        numTicks={6}
        stroke="var(--border)"
        tickStroke="var(--border)"
        tickLabelProps={{ fill: "var(--muted-foreground)", fontSize: 10, textAnchor: "middle" }}
      />
    </svg>
  );
}

/**
 * Member voting block: a compact defection-first timeline (all votes as faint context, votes
 * against the faction line as large red clickable markers) over the primary "votes against"
 * list. The list has two filters (abstained vs voted-differently; vote type), and the timeline
 * reflects the current filter. Hovering a marker highlights its list row and vice-versa; both
 * link to the bill's eelnõu page on riigikogu.ee.
 */
export function MemberVotes({ votes }: { votes: VotePoint[] }) {
  const t = useTranslations("memberDetail");
  const all = useMemo(
    () => [...votes].sort((a, b) => a.votedAt.localeCompare(b.votedAt)),
    [votes],
  );
  const defs = useMemo(() => againstVotes(votes), [votes]);
  const typeOptions = useMemo(() => voteTypeOptions(defs), [defs]);

  const [hovered, setHovered] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [type, setType] = useState<string>("all");

  const filtered = useMemo(
    () =>
      defs.filter(
        (v) =>
          (kind === "all" || againstKind(v) === kind) && (type === "all" || voteType(v) === type),
      ),
    [defs, kind, type],
  );
  const activeKeys = useMemo(() => new Set(filtered.map(keyOf)), [filtered]);

  const kinds: { key: Kind; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "abstain", label: t("filterAbstain") },
    { key: "differ", label: t("filterDiffer") },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-bold">{t("timeline")}</h2>
        <div className="mt-2" style={{ height: TIMELINE_HEIGHT }}>
          <ParentSize>
            {({ width }) => (
              <Timeline
                width={width || FALLBACK_WIDTH}
                all={all}
                activeKeys={activeKeys}
                hovered={hovered}
                setHovered={setHovered}
              />
            )}
          </ParentSize>
        </div>
        {defs.length > 0 && (
          <p className="text-[11px] text-muted-foreground">{t("againstHint")}</p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-base font-bold">{t("againstTitle")}</h3>
          <span className="text-xs text-muted-foreground">{t("againstCount", { n: filtered.length })}</span>
        </div>

        {defs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("againstEmpty")}</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-md border border-border" role="radiogroup">
                {kinds.map((kopt) => (
                  <button
                    key={kopt.key}
                    type="button"
                    role="radio"
                    aria-checked={kind === kopt.key}
                    onClick={() => setKind(kopt.key)}
                    className={`px-2.5 py-1 text-xs ${
                      kind === kopt.key
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {kopt.label}
                  </button>
                ))}
              </div>

              {typeOptions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {type === "all" ? t("typeAll") : type} <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setType("all")}>{t("typeAll")}</DropdownMenuItem>
                    {typeOptions.map((ty) => (
                      <DropdownMenuItem key={ty} onClick={() => setType(ty)}>
                        {ty}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("filterEmpty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                {filtered.map((v, i) => {
                  const k = keyOf(v);
                  const on = hovered === k;
                  const url = eelnouUrl(v.draftUuid);
                  const title = v.draftTitle ?? v.title;
                  const choiceLine = t("voteVsLine", {
                    choice: t(`choiceShort.${v.memberChoice}` as "choiceShort.yes"),
                    line: t(`choiceShort.${v.partyMajorityChoice}` as "choiceShort.yes"),
                  });
                  const handlers = {
                    onMouseEnter: () => setHovered(k),
                    onMouseLeave: () => setHovered(null),
                    onFocus: () => setHovered(k),
                    onBlur: () => setHovered(null),
                  };
                  const body = (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {v.votedAt.slice(0, 10)}
                        </span>
                        <span className="font-medium">
                          {title}
                          {v.draftMark ? <span className="text-muted-foreground"> ({v.draftMark})</span> : null}
                        </span>
                      </div>
                      <div className="mt-0.5 pl-[5.5rem] text-xs text-muted-foreground">
                        {v.title !== title ? `${v.title} · ` : ""}
                        {choiceLine}
                      </div>
                    </>
                  );
                  return (
                    <li key={i} className={`px-3 py-2.5 text-sm ${on ? "bg-secondary" : "hover:bg-secondary"}`}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("openInRiigikogu")}
                          className="block hover:underline"
                          {...handlers}
                        >
                          {body}
                        </a>
                      ) : (
                        <div className="block" {...handlers}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
