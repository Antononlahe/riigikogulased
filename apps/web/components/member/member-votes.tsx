"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  billOutcome,
  type VotePoint,
  type VoteResult,
  type FactionTally,
  type BillOutcome,
} from "@/lib/member-detail";
import { PARTY_ORDER } from "@/lib/party";
import { PartyBadge } from "@/components/party-badge";
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
  contextMs,
  defs,
  activeKeys,
  hovered,
  setHovered,
}: {
  width: number;
  contextMs: number[]; // non-defection vote timestamps, ascending (faint context ticks)
  defs: VotePoint[]; // against-the-line votes (the only ones with full data)
  activeKeys: Set<string>;
  hovered: string | null;
  setHovered: (k: string | null) => void;
}) {
  const t = useTranslations("memberDetail");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  const defMs = defs.map((v) => new Date(v.votedAt).getTime());
  const total = contextMs.length + defs.length;
  const hasData = total > 0;
  // contextMs is ascending, defMs is not (defs come most-recent-first).
  const fullMin = hasData ? Math.min(contextMs[0] ?? Infinity, ...defMs) : 0;
  const fullMax = hasData ? Math.max(contextMs[contextMs.length - 1] ?? -Infinity, ...defMs) : 0;
  const domMin = zoom ? zoom[0] : fullMin;
  const domMax = zoom ? zoom[1] : fullMax;

  // Latest geometry for the native (non-passive) wheel handler, which needs preventDefault.
  const stateRef = useRef({ width, domMin, domMax, fullMin, fullMax });
  stateRef.current = { width, domMin, domMax, fullMin, fullMax };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const left = MARGIN.left;
      const right = s.width - MARGIN.right;
      const span0 = s.domMax - s.domMin;
      const fullSpan = s.fullMax - s.fullMin;
      if (right <= left || span0 <= 0 || fullSpan <= 0) return;
      const r = el.getBoundingClientRect();
      const cx = Math.max(left, Math.min(right, e.clientX - r.left));
      const cursorMs = s.domMin + ((cx - left) / (right - left)) * span0;
      let span = span0 * (e.deltaY < 0 ? 0.8 : 1.25);
      if (span >= fullSpan) {
        setZoom(null); // zoomed all the way out → back to full range
        return;
      }
      const minSpan = Math.min(fullSpan, 1000 * 60 * 60 * 24 * 3); // floor at ~3 days
      span = Math.max(minSpan, span);
      const ratio = (cursorMs - s.domMin) / span0; // keep the cursor's date fixed
      let nMin = cursorMs - ratio * span;
      let nMax = nMin + span;
      if (nMin < s.fullMin) {
        nMin = s.fullMin;
        nMax = nMin + span;
      }
      if (nMax > s.fullMax) {
        nMax = s.fullMax;
        nMin = Math.max(s.fullMin, nMax - span);
      }
      setZoom([nMin, nMax]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!hasData) return <p className="text-sm text-muted-foreground">{t("noVotes")}</p>;

  const innerRight = width - MARGIN.right;
  const inDom = (ms: number) => ms >= domMin && ms <= domMax;
  const x = scaleTime({
    domain: [new Date(domMin), new Date(domMax)],
    range: [MARGIN.left, innerRight],
  });
  const active = defs.filter((v) => activeKeys.has(keyOf(v)) && inDom(new Date(v.votedAt).getTime()));

  // Faint context ticks: every non-defection vote plus non-highlighted defections, decimated to
  // one tick per pixel column -- thousands of overplotted 1px lines convey nothing more than one,
  // and undecimated they ballooned the SSR HTML (~4k SVG nodes per page).
  const seenPx = new Set<number>();
  const ticks = [
    ...contextMs,
    ...defs.filter((v) => !activeKeys.has(keyOf(v))).map((v) => new Date(v.votedAt).getTime()),
  ].filter((ms) => {
    if (!inDom(ms)) return false;
    const px = Math.round(x(new Date(ms)));
    if (seenPx.has(px)) return false;
    seenPx.add(px);
    return true;
  });

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
      <svg ref={svgRef} width={width} height={TIMELINE_HEIGHT} role="img" aria-label={t("timelineAria", { n: total })}>
      {/* every non-highlighted vote in view: faint context tick (cadence, not interactive) */}
      <Group>
        {ticks.map((ms, i) => (
          <line
            key={i}
            x1={x(new Date(ms))}
            x2={x(new Date(ms))}
            y1={BASE_Y - 6}
            y2={BASE_Y + 6}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            opacity={0.2}
          />
        ))}
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
    </div>
  );
}

// Per-outcome chip styling. The label text comes from translations (memberDetail.outcome.*).
const OUTCOME_STYLE: Record<BillOutcome, string> = {
  adopted: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  withdrawn: "border-border bg-secondary text-muted-foreground",
  pending: "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-500",
};

/** Small chip showing the bill's final fate (adopted / rejected / ...). */
function OutcomeBadge({ outcome }: { outcome: BillOutcome }) {
  const t = useTranslations("memberDetail");
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_STYLE[outcome]}`}
    >
      {t(`outcome.${outcome}` as "outcome.adopted")}
    </span>
  );
}

const TALLY_COLS = ["yes", "no", "abstain", "absent"] as const;

/** Per-faction ballot tally for one voting, the member's own faction + choice highlighted. */
function ResultPanel({
  result,
  memberParty,
  memberChoice,
}: {
  result: VoteResult;
  memberParty: string | null;
  memberChoice: string;
}) {
  const t = useTranslations("memberDetail");
  const head: Record<(typeof TALLY_COLS)[number], string> = {
    yes: t("choiceShort.yes"),
    no: t("choiceShort.no"),
    abstain: t("choiceShort.abstain"),
    absent: t("tallyAbsent"),
  };
  const ordered = PARTY_ORDER.map((s) => result.factions.find((f) => f.party === s)).filter(
    (f): f is FactionTally => Boolean(f),
  );
  return (
    <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3 text-xs">
      <table className="w-full">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-medium">&nbsp;</th>
            {TALLY_COLS.map((c) => (
              <th key={c} className="px-1 text-right font-medium">
                {head[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((f) => {
            const mine = f.party === memberParty;
            return (
              <tr key={f.party} className={mine ? "font-semibold" : ""}>
                <td className="py-0.5">
                  <PartyBadge shortName={f.party} />
                </td>
                {TALLY_COLS.map((c) => (
                  <td
                    key={c}
                    className={`px-1 text-right tabular-nums ${
                      mine && c === memberChoice ? "rounded bg-destructive/15 text-foreground" : ""
                    }`}
                  >
                    {f[c] || "·"}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t border-border text-muted-foreground">
            <td className="py-0.5">{t("resultOverall")}</td>
            {TALLY_COLS.map((c) => (
              <td key={c} className="px-1 text-right tabular-nums">
                {result.overall[c]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Member voting block: a compact defection-first timeline (all votes as faint context, votes
 * against the faction line as large red clickable markers) over the primary "votes against"
 * list. The list has two filters (abstained vs voted-differently; vote type), and the timeline
 * reflects the current filter. Hovering a marker highlights its list row and vice-versa; both
 * link to the bill's eelnõu page on riigikogu.ee.
 */
export function MemberVotes({
  votes,
  contextDates,
  voteResults,
}: {
  votes: VotePoint[]; // against-the-line votes only (full rows)
  contextDates: string[]; // "YYYY-MM-DD" of every other vote, ascending (timeline context)
  voteResults: Record<number, VoteResult>;
}) {
  const t = useTranslations("memberDetail");
  const contextMs = useMemo(() => contextDates.map((d) => new Date(d).getTime()), [contextDates]);
  const defs = useMemo(() => againstVotes(votes), [votes]);
  const typeOptions = useMemo(() => voteTypeOptions(defs), [defs]);

  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [type, setType] = useState<string>("all");
  // Long defection lists bury everything below them on the member page, so collapse to the
  // first few by default once there are more than COLLAPSE_OVER.
  const [expanded, setExpanded] = useState(false);
  const COLLAPSE_OVER = 10;
  const COLLAPSED_COUNT = 3;

  const filtered = useMemo(
    () =>
      defs.filter(
        (v) =>
          (kind === "all" || againstKind(v) === kind) && (type === "all" || voteType(v) === type),
      ),
    [defs, kind, type],
  );
  const activeKeys = useMemo(() => new Set(filtered.map(keyOf)), [filtered]);
  const collapsible = filtered.length > COLLAPSE_OVER;
  const shown = collapsible && !expanded ? filtered.slice(0, COLLAPSED_COUNT) : filtered;

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
                contextMs={contextMs}
                defs={defs}
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
                {shown.map((v, i) => {
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
                  const outcome = billOutcome(v.outcomeStage);
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
                        {outcome ? <OutcomeBadge outcome={outcome} /> : null}
                      </div>
                      <div className="mt-0.5 pl-[5.5rem] text-xs text-muted-foreground">
                        {v.title !== title ? `${v.title} · ` : ""}
                        {choiceLine}
                      </div>
                    </>
                  );
                  const result = voteResults[v.voteId];
                  const isOpen = open === k;
                  return (
                    <li key={i} className={`px-3 py-2.5 text-sm ${on ? "bg-secondary" : "hover:bg-secondary"}`} {...handlers}>
                      <div className="flex items-start justify-between gap-3">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("openInRiigikogu")}
                            className="block min-w-0 flex-1 hover:underline"
                          >
                            {body}
                          </a>
                        ) : (
                          <div className="min-w-0 flex-1">{body}</div>
                        )}
                        {result && (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : k)}
                            aria-expanded={isOpen}
                            className="shrink-0 whitespace-nowrap rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {t("howVoted")} {isOpen ? "▴" : "▾"}
                          </button>
                        )}
                      </div>
                      {isOpen && result && (
                        <ResultPanel
                          result={result}
                          memberParty={v.partyShortName}
                          memberChoice={v.memberChoice}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="mt-2 text-xs font-medium text-ring hover:underline"
              >
                {expanded
                  ? t("showLess")
                  : t("showAll", { n: filtered.length })}{" "}
                {expanded ? "▴" : "▾"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
