"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortOption<K extends string> = { key: K; label: string };

/** Mobile sort control: a dropdown that drives the host's existing sort state. Each card list
 *  (sm:hidden) renders this so phone users can reorder -- desktop keeps its clickable headers.
 *  `onToggle` is the host's own toggleSort/choose, so semantics match a header click exactly
 *  (pick a field, or flip direction if it's already the active field). */
export function SortMenu<K extends string>({
  label,
  options,
  sortKey,
  sortDir,
  onToggle,
  className,
}: {
  label: string;
  options: SortOption<K>[];
  sortKey: K;
  sortDir: "asc" | "desc";
  onToggle: (key: K) => void;
  className?: string;
}) {
  const arrow = sortDir === "asc" ? "↑" : "↓";
  const active = options.find((o) => o.key === sortKey);
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={label}>
            {label}: {active?.label} {arrow} <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {options.map((o) => (
            <DropdownMenuItem
              key={o.key}
              onClick={() => onToggle(o.key)}
              className={o.key === sortKey ? "font-semibold text-foreground" : ""}
            >
              {o.label} {o.key === sortKey ? arrow : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
