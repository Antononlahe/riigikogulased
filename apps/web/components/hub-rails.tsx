"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { partyToken } from "@/lib/party";
import type { HubRail, RailCard, RailPerson } from "@/lib/hub-queries";

// v2 front page: one horizontally scrollable rail per theme. The card data (values, labels) is
// fully formatted server-side by getHubRails(); this component only renders + handles scroll.

const CARD =
  "flex w-[210px] shrink-0 snap-start flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors";
const CARD_LINK = `${CARD} hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground`;

function Avatar({ p }: { p: RailPerson }) {
  return <MemberAvatar fullName={p.name} photoThumbPath={p.photoThumbPath} shortName={p.party} />;
}

function StackedAvatars({ people }: { people: RailPerson[] }) {
  return (
    <div className="flex -space-x-2">
      {people.map((p, i) => (
        <span key={i} className="rounded-full ring-2 ring-card">
          <Avatar p={p} />
        </span>
      ))}
    </div>
  );
}

function Bar({ pct, party }: { pct: number; party: string | null }) {
  return (
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: partyToken(party).fill }} />
    </div>
  );
}

const EYEBROW = "text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground";
const NAME = "mt-1.5 truncate font-serif text-base font-bold leading-tight";
const VALUE = "font-bold tabular-nums";
const SUB = "mt-1 text-[11.5px] text-muted-foreground/80";
const CHIP = "rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground";

function CardView({ card, seeAll }: { card: RailCard; seeAll: string }) {
  const shared = useTranslations("hub")("rail.shared");

  if (card.kind === "quote") {
    return (
      <Link href={card.href} className={`${CARD_LINK} w-[250px]`}>
        <Avatar p={card.person} />
        <div className={`mt-2.5 ${EYEBROW}`}>{card.eyebrow}</div>
        <div className="mt-1.5 font-serif text-xl font-bold leading-tight">{card.word}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{card.person.name}</span>
          <PartyBadge shortName={card.person.party} />
        </div>
        {card.sub && <div className={SUB}>{card.sub}</div>}
      </Link>
    );
  }

  if (card.kind === "tie2") {
    return (
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <StackedAvatars people={card.people} />
          <span className={CHIP}>{shared}</span>
        </div>
        <div className={`mt-2.5 ${EYEBROW}`}>{card.eyebrow}</div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className={`text-lg ${VALUE}`}>{card.value}</span>
          {card.sub && <span className="text-[11.5px] text-muted-foreground/80">{card.sub}</span>}
        </div>
        <div className="mt-1.5 space-y-1 text-sm">
          {card.people.map((p) => (
            <div key={p.slug} className="flex items-center gap-2">
              <Link href={`/saadik/${p.slug}`} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              <PartyBadge shortName={p.party} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.kind === "tieN") {
    return (
      <Link href={card.href} className={CARD_LINK}>
        <div className="flex items-center gap-2">
          <StackedAvatars people={card.sample} />
          {card.more > 0 && <span className={CHIP}>+{card.more}</span>}
        </div>
        <div className={`mt-2.5 ${EYEBROW}`}>{card.eyebrow}</div>
        <div className={NAME}>{card.value}</div>
        {card.sub && <div className={SUB}>{card.sub}</div>}
        <div className="mt-auto pt-3 text-xs font-semibold text-muted-foreground">{seeAll} →</div>
      </Link>
    );
  }

  // single
  return (
    <Link href={card.href} className={CARD_LINK}>
      <Avatar p={card.person} />
      <div className={`mt-2.5 ${EYEBROW}`}>{card.eyebrow}</div>
      <div className={NAME}>{card.person.name}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={`text-[15px] ${VALUE}`}>{card.value}</span>
        <PartyBadge shortName={card.person.party} />
      </div>
      {card.sub && <div className={SUB}>{card.sub}</div>}
      {typeof card.barPct === "number" && <Bar pct={card.barPct} party={card.person.party} />}
    </Link>
  );
}

const ARROW =
  "absolute top-[calc(50%-6px)] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md md:group-hover:flex";

function Rail({ rail }: { rail: HubRail }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2);
  }, []);

  const page = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * 464, behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <section className="mt-8 first:mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{rail.title}</h2>
          <span className="text-xs text-muted-foreground/70">{rail.kicker}</span>
        </div>
        <Link
          href={rail.moreHref}
          className="whitespace-nowrap text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          {rail.seeAll} →
        </Link>
      </div>
      <div className="group relative -mx-4 px-4">
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => page(-1)}
          className={`${ARROW} left-1 ${atStart ? "!hidden" : ""}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={ref}
          onScroll={onScroll}
          className="scroll-x flex snap-x gap-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rail.cards.map((c, i) => (
            <CardView key={i} card={c} seeAll={rail.seeAll} />
          ))}
        </div>
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => page(1)}
          className={`${ARROW} right-1 ${atEnd ? "!hidden" : ""}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

export function HubRails({ rails, className }: { rails: HubRail[]; className?: string }) {
  const t = useTranslations("hub");
  if (rails.length === 0) return null;
  return (
    <div className={className}>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/70 md:hidden">
        <ChevronRight className="h-3.5 w-3.5" />
        {t("rail.swipeHint")}
      </p>
      {rails.map((r) => (
        <Rail key={r.key} rail={r} />
      ))}
    </div>
  );
}
