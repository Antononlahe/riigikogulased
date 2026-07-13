// Smooth-scroll an element into view, deferred one frame so it runs AFTER the browser has laid out
// content that just changed (list expanded, filter applied, panel loaded). Scrolling in the same
// tick snaps to a stale target position, which reads as a jump. Honors prefers-reduced-motion.
// Returns the rAF id so effects can cancel it on cleanup; ignore it for one-off click handlers.
export function scrollIntoViewSmooth(
  el: HTMLElement | null,
  block: ScrollLogicalPosition = "start",
): number | undefined {
  if (!el || typeof window === "undefined") return undefined;
  return window.requestAnimationFrame(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
  });
}
