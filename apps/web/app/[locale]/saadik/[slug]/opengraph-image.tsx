import { ImageResponse } from "next/og";
import { pool } from "@/lib/db";

// Per-member OG card: photo, name, party color, discipline headline. This is what a shared
// member link shows on social media — the main reason links to the site spread.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Riigikogulased";

// Satori can't resolve CSS vars; light-theme party fills/inks inlined from globals.css
// (ink for text — RE's yellow fill is unreadable on the cream background).
const PARTY_FILL: Record<string, string> = {
  RE: "#f5c518", EKRE: "#16315e", KE: "#00a35b", E200: "#16b6be", SDE: "#e4002b", I: "#1f5aa8",
};
const PARTY_INK: Record<string, string> = {
  RE: "#8a6d00", EKRE: "#16315e", KE: "#007a43", E200: "#0c7e84", SDE: "#c20021", I: "#16508f",
};

type Row = {
  fullName: string;
  photoUrl: string | null;
  party: string | null;
  counted: number | null;
  aligned: number | null;
  defections: number | null;
};

// Satori can't decode our local .webp thumbs; fetch the API's full-res JPEG and inline it.
// Any failure (dead URL, timeout) just drops the photo from the card.
async function photoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/jpeg|png|gif/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  let r: Row | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT m.full_name AS "fullName", m.photo_url AS "photoUrl",
              mcp.party_short_name AS party,
              md.counted_votes AS counted, md.aligned_votes AS aligned, md.defections
         FROM members m
         LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
         LEFT JOIN member_discipline md ON md.member_id = m.id
        WHERE m.slug = $1`,
      [slug],
    );
    r = (rows[0] as Row | undefined) ?? null;
  } catch {
    r = null;
  }

  const fill = (r?.party && PARTY_FILL[r.party]) || "#6b6357";
  const ink = (r?.party && PARTY_INK[r.party]) || "#1c1a16";
  const photo = await photoDataUri(r?.photoUrl ?? null);
  const pct =
    r?.counted && r.aligned != null ? Math.round((100 * r.aligned) / r.counted) : null;
  const en = locale === "en";
  const sub =
    pct != null && r
      ? en
        ? `voted against the faction line ${r.defections} times out of ${r.counted}`
        : `hääletas fraktsiooni vastu ${r.defections} korral ${r.counted}-st`
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#faf8f3",
          color: "#1c1a16",
        }}
      >
        <div style={{ width: 24, height: "100%", backgroundColor: fill }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 60,
            padding: "0 80px",
          }}
        >
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- satori renders raw <img>
            <img
              alt=""
              src={photo}
              width={280}
              height={350}
              style={{ borderRadius: 16, objectFit: "cover" }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 30, color: "#6b6357", textTransform: "uppercase", letterSpacing: 2 }}>
              {r?.party ?? ""}
            </div>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, marginTop: 8 }}>
              {r?.fullName ?? "Riigikogulased"}
            </div>
            {pct != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 36 }}>
                <div style={{ fontSize: 90, fontWeight: 700, color: ink }}>{`${pct}%`}</div>
                <div style={{ fontSize: 34, color: "#6b6357" }}>
                  {en ? "discipline" : "distsipliin"}
                </div>
              </div>
            )}
            {sub && <div style={{ fontSize: 28, color: "#6b6357", marginTop: 8 }}>{sub}</div>}
            <div style={{ fontSize: 28, color: "#6b6357", marginTop: 44 }}>
              riigikogulased.zatkin.ee
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
