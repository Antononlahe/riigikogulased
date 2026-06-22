// v0.5 stenogram speech search endpoint (REMOVABLE FEATURE). Keeps the member page static
// (ISR) while search stays dynamic: the client SpeechSearch box fetches this.
import { NextResponse } from "next/server";
import { searchMemberSpeeches } from "@/lib/speech-search-queries";
import { browseMemberSpeeches } from "@/lib/speeches-queries";

export const dynamic = "force-dynamic";

// Two modes on one endpoint: a non-empty `q` searches; otherwise it's the browse list
// (sort/year/type filters, paged by `offset`).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = Number(searchParams.get("memberId"));
  const q = (searchParams.get("q") ?? "").trim();
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return NextResponse.json({ hits: [], items: [] });
  }
  try {
    if (q.length >= 2) {
      const hits = await searchMemberSpeeches(memberId, q);
      return NextResponse.json({ hits });
    }
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
    return NextResponse.json({ hits: [], items: [] });
  }
}
