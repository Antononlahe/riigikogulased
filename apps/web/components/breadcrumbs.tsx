import { Link } from "@/i18n/routing";
import type { ComponentProps } from "react";

type Href = ComponentProps<typeof Link>["href"];

// One-line breadcrumb trail for sub-pages: linked parents, current page as plain text.
export function Breadcrumbs({ items }: { items: { label: string; href?: Href }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
