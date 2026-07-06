"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { PARTY_ORDER } from "@/lib/party";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Shared controls for the member tables: a "Kõik fraktsioonid" party dropdown, a "Näita endisi
 *  liikmeid" toggle, and a live count. Each host owns the state and applies the filter itself. */
export function PartyFilterBar({
  party,
  onParty,
  showFormer,
  onShowFormer,
  count,
}: {
  party: string | null;
  onParty: (p: string | null) => void;
  showFormer: boolean;
  onShowFormer: (v: boolean) => void;
  count: number;
}) {
  const f = useTranslations("filter");
  const t = useTranslations("table");
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {party ?? f("all")} <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onParty(null)}>{f("all")}</DropdownMenuItem>
          {PARTY_ORDER.map((p) => (
            <DropdownMenuItem key={p} onClick={() => onParty(p)}>
              {p}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-foreground"
          checked={showFormer}
          onChange={(e) => onShowFormer(e.target.checked)}
        />
        {f("showFormer")}
      </label>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {t("showing", { count })}
      </span>
    </div>
  );
}
