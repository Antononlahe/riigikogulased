"use client";

import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** "Statistika" nav heading -> tap/click opens the two boards (Sõnavõtud, Kuluhüvitised) that
 *  used to be buried in Varia. Radix handles tap, keyboard, escape, outside-click and keeps the
 *  menu on-screen on mobile -- no bespoke a11y or positioning. Server passes translated labels. */
export function StatistikaMenu({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-0.5 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {label}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((it) => (
          <DropdownMenuItem key={it.href} asChild>
            <Link href={it.href}>{it.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
