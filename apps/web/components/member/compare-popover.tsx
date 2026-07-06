"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";

// "Compare with others" affordance: a small icon next to a panel heading that opens a light
// popover showing this member's value against the average of all other members.
export function ComparePopover({
  ariaLabel,
  memberLabel,
  memberValue,
  othersLabel,
  othersValue,
  note,
}: {
  ariaLabel: string;
  memberLabel: string;
  memberValue: string;
  othersLabel: string;
  othersValue: string;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        <Users className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{memberLabel}</span>
            <span className="font-serif text-base font-bold tabular-nums">{memberValue}</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{othersLabel}</span>
            <span className="font-serif text-base font-bold tabular-nums">{othersValue}</span>
          </div>
          {note && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}
