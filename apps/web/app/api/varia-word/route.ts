// Clicking a party signature word searches that party's speeches for it. Dynamic (not built)
// so the margusonad page stays static/ISR while the drill-down is fetched on demand.
import { NextResponse } from "next/server";
import { searchPartyWord } from "@/lib/varia-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const party = (searchParams.get("party") ?? "").trim();
  const lemma = (searchParams.get("lemma") ?? "").trim();
  if (!party || !lemma) return NextResponse.json({ hits: [] });
  try {
    return NextResponse.json({ hits: await searchPartyWord(party, lemma) });
  } catch {
    return NextResponse.json({ hits: [] });
  }
}
