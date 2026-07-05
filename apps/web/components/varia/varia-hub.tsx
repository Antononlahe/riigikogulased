import { Link } from "@/i18n/routing";

export type VariaTile = { href: string; title: string; desc: string };

/** Responsive tile grid for the varia hub. Only tiles for built routes are passed in (no dead
 *  links) -- later phases append their tiles as they ship. */
export function VariaHub({ tiles }: { tiles: VariaTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className="group rounded-lg border border-border p-5 transition-colors hover:border-foreground hover:bg-secondary"
        >
          <h2 className="font-serif text-lg font-bold tracking-tight group-hover:underline">
            {tile.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{tile.desc}</p>
        </Link>
      ))}
    </div>
  );
}
