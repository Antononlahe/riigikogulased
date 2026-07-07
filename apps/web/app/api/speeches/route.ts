// Stenogram speech endpoint. Keeps pages static (ISR) while search stays dynamic: the client
// search boxes (site-wide, member-page, signature-word drill-down) all fetch this.
import { NextResponse } from "next/server";
import { searchSpeeches } from "@/lib/speech-search-queries";
import { browseMemberSpeeches } from "@/lib/speeches-queries";

export const dynamic = "force-dynamic";

// Two modes on one endpoint: a non-empty `q` searches (corpus-wide, or narrowed by
// `memberId`/`party`); otherwise it's a member's browse list (sort/year/type, paged by `offset`).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberIdRaw = Number(searchParams.get("memberId"));
  const memberId = Number.isInteger(memberIdRaw) && memberIdRaw > 0 ? memberIdRaw : undefined;
  const q = (searchParams.get("q") ?? "").trim();
  try {
    if (q.length >= 2) {
      const limitRaw = Number(searchParams.get("limit"));
      const { hits, total } = await searchSpeeches(q, {
        memberId,
        party: searchParams.get("party") || undefined,
        limit: Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : undefined,
        offset: Number(searchParams.get("offset") ?? 0) || 0,
      });
      return NextResponse.json({ hits, total });
    }
    if (!memberId) return NextResponse.json({ hits: [], items: [] });
    const yearRaw = searchParams.get("year");
    const items = await browseMemberSpeeches(memberId, {
      sort: searchParams.get("sort") ?? "recent",
      year: yearRaw ? Number(yearRaw) : null,
      type: searchParams.get("type") || null,
      offset: Number(searchParams.get("offset") ?? 0) || 0,
    });
    return NextResponse.json({ items });
  } catch {
    // table absent (feature not migrated here) or query error -> empty, never 500
    return NextResponse.json({ hits: [], items: [], total: 0 });
  }
}
