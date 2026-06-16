"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { INDEX_MIN_VOTES, topicLabel } from "@/lib/topics";
import type { TopicIndexRow } from "@/lib/topics-queries";

export function TopicIndexList({ rows }: { rows: TopicIndexRow[] }) {
  const t = useTranslations("topics");
  const locale = useLocale();
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows.filter((r) => r.votes >= INDEX_MIN_VOTES);
    return rows.filter(
      (r) =>
        r.nameEt.toLowerCase().includes(query) ||
        (r.nameEn?.toLowerCase().includes(query) ?? false),
    );
  }, [rows, q]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        className="mb-4 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <ul className="divide-y divide-border rounded-md border border-border">
        {visible.map((r) => (
          <li key={r.edid}>
            <Link
              href={`/teemad/${r.edid}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary"
            >
              <span className="flex items-center gap-2 font-medium">
                {topicLabel(r, locale)}
                {(locale === "en" ? r.fieldEn : r.fieldEt) && (
                  <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {locale === "en" ? r.fieldEn : r.fieldEt}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {r.votes} {t("votes").toLowerCase()} · {r.defections} {t("topicDefections").toLowerCase()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
