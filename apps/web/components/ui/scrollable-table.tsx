import { cn } from "@/lib/utils";

/**
 * Shared wrapper for the site's data tables. Gives a wide table a working horizontal scroll on
 * narrow screens (the `min-w` forces overflow instead of squishing `w-full` to nothing), a
 * CSS-only edge scroll-shadow (`.scroll-x`), and a sticky first column (`.sticky-1`) so the row's
 * identity stays visible while the numbers scroll. Pass `thead`/`tbody` as children.
 */
export function ScrollableTable({
  children,
  className,
  tableClassName,
  minWidthClass = "min-w-[40rem]",
  stickyFirst = true,
}: {
  children: React.ReactNode;
  className?: string;
  tableClassName?: string;
  minWidthClass?: string;
  stickyFirst?: boolean;
}) {
  return (
    <div className={cn("scroll-x rounded-md border border-border", stickyFirst && "sticky-1", className)}>
      <table className={cn("w-full text-sm", minWidthClass, tableClassName)}>{children}</table>
    </div>
  );
}
