// Sticky in-page anchor nav (same look as the member page's inline one). Plain anchors,
// server-rendered; targets need a scroll-mt-* class.
export function SectionNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="sticky top-0 z-30 -mx-4 mt-6 flex gap-x-4 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
      {items.map((i) => (
        <a key={i.href} href={i.href} className="whitespace-nowrap hover:text-foreground">
          {i.label}
        </a>
      ))}
    </nav>
  );
}
