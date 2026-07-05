"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { PartyBadge } from "@/components/party-badge";
import { partyToken, PARTY_ORDER, isKnownParty } from "@/lib/party";
import { HL_START, HL_END } from "@/lib/speech-search";
import type { WordSpeech } from "@/lib/varia-queries";
import type { PartyWords } from "@/lib/varia";

// Mirror of signature.py MANUAL_EXCLUDE -- the hand-curated tokens dropped from the TF-IDF output
// (fillers, plenary procedure, address forms, name fragments). Shown for transparency. Keep in
// sync with the Python list; this copy is display-only.
const EXCLUDED = [
  "otsekui", "meelest", "vaatamata", "enesestmõistetavalt", "ükspuha", "miskisugune", "kuskilt",
  "kõnesoov", "saalikutsung", "kohalolija", "kohalolek", "vastusõnavõtt", "hääletamissedel",
  "täpsustav", "austatav", "auväärt", "lugupeetav", "ministrihärra", "ministriproua",
  "poo", "esm", "tanel", "vadim", "epleri", "laatsi", "sillart", "uikala", "heldna",
];

// Map a rank (1 = most distinctive) to a font size. Rank-based, not score-based, so one party's
// huge score spread doesn't make its chips dwarf another's -- every card reads on the same scale.
function sizeForRank(rank: number): string {
  return `${Math.max(12, 30 - (rank - 1) * 1.4)}px`;
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(HL_START).map((chunk, i) => {
        if (i === 0) return <Fragment key={i}>{chunk}</Fragment>;
        const [hit, ...rest] = chunk.split(HL_END);
        return (
          <Fragment key={i}>
            <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/40">{hit}</mark>
            {rest.join(HL_END)}
          </Fragment>
        );
      })}
    </>
  );
}

type Selected = { party: string; lemma: string };

export function SignatureWords({ parties }: { parties: PartyWords[] }) {
  const t = useTranslations("varia");
  const [sel, setSel] = useState<Selected | null>(null);
  const [hits, setHits] = useState<WordSpeech[] | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  const order = (p: PartyWords) => {
    const i = PARTY_ORDER.indexOf(p.partyShortName as never);
    return i === -1 ? 99 : i;
  };
  const sorted = [...parties].sort((a, b) => order(a) - order(b));

  async function pick(party: string, lemma: string) {
    if (sel?.party === party && sel?.lemma === lemma) {
      setSel(null); setHits(null); return;
    }
    setSel({ party, lemma }); setHits(null);
    try {
      const res = await fetch(`/api/varia-word?party=${encodeURIComponent(party)}&lemma=${encodeURIComponent(lemma)}`);
      const data = await res.json();
      setHits(data.hits ?? []);
    } catch {
      setHits([]);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sorted.map((p) => {
          const token = partyToken(p.partyShortName);
          return (
            <div key={p.partyShortName} className="rounded-md border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <PartyBadge shortName={p.partyShortName} />
                {isKnownParty(p.partyShortName) && (
                  <span className="text-sm font-semibold text-muted-foreground">{token.label}</span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {p.words.map((w) => {
                  const active = sel?.party === p.partyShortName && sel?.lemma === w.lemma;
                  return (
                    <button
                      key={w.lemma}
                      type="button"
                      onClick={() => pick(p.partyShortName, w.lemma)}
                      title={t("wordHint")}
                      className="font-semibold leading-tight transition-opacity hover:underline"
                      style={{
                        fontSize: sizeForRank(w.rank),
                        color: token.ink,
                        opacity: active ? 1 : undefined,
                        textDecorationLine: active ? "underline" : undefined,
                      }}
                    >
                      {w.lemma}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-down: speeches by this party using the clicked word. */}
      {sel && (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <PartyBadge shortName={sel.party} />
            <span className="font-serif text-lg font-bold">{sel.lemma}</span>
            <button
              type="button" onClick={() => { setSel(null); setHits(null); }}
              className="ml-auto text-sm text-muted-foreground hover:text-foreground"
            >
              {t("close")}
            </button>
          </div>
          {hits === null ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSpeeches")}</p>
          ) : (
            <ul className="space-y-3">
              {hits.map((h) => (
                <li key={h.speechKey} className="border-b border-border pb-3 text-sm last:border-0">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="font-semibold">{h.fullName}</span>
                    {h.date && <span className="text-xs text-muted-foreground">{h.date.slice(0, 10)}</span>}
                    {h.link && (
                      <a href={h.link} target="_blank" rel="noopener noreferrer"
                         className="ml-auto text-xs text-muted-foreground hover:underline">
                        {t("steno")}
                      </a>
                    )}
                  </div>
                  <p className="text-muted-foreground"><Highlighted text={h.snippet} /></p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Transparency: which words were manually filtered out. */}
      <div className="mt-4 text-xs text-muted-foreground">
        <button type="button" onClick={() => setShowExcluded((v) => !v)} className="inline-flex items-center gap-1 hover:text-foreground">
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px]">i</span>
          {t("excludedToggle", { n: EXCLUDED.length })}
        </button>
        {showExcluded && (
          <p className="mt-2 max-w-2xl leading-relaxed">
            {t("excludedNote")} <span className="italic">{EXCLUDED.join(", ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
