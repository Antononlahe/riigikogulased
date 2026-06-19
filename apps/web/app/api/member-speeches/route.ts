// v0.5 stenogram speech search endpoint (REMOVABLE FEATURE). Keeps the member page static
// (ISR) while search stays dynamic: the client SpeechSearch box fetches this.
import { NextResponse } from "next/server";
import { searchMemberSpeeches } from "@/lib/speech-search-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = Number(searchParams.get("memberId"));
  const q = searchParams.get("q") ?? "";
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return NextResponse.json({ hits: [] });
  }
  try {
    const hits = await searchMemberSpeeches(memberId, q);
    return NextResponse.json({ hits });
  } catch {
    // table absent (feature not migrated here) or query error -> empty, never 500
    return NextResponse.json({ hits: [] });
  }
}
