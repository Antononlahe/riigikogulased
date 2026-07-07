import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

// Default OG card for every page without a more specific one: site title, tagline, and the
// six-party color stripe. Satori has no CSS-var support, so party colors are inlined hex
// (same values as globals.css light theme).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Riigikogulased";

const PARTY_STRIPE = ["#f5c518", "#16315e", "#00a35b", "#16b6be", "#e4002b", "#1f5aa8"];

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#faf8f3",
          color: "#1c1a16",
        }}
      >
        <div style={{ display: "flex", marginBottom: 40 }}>
          {PARTY_STRIPE.map((c) => (
            <div key={c} style={{ width: 60, height: 12, backgroundColor: c }} />
          ))}
        </div>
        <div style={{ fontSize: 84, fontWeight: 700 }}>{t("title")}</div>
        <div style={{ marginTop: 20, fontSize: 34, color: "#6b6357" }}>{t("tagline")}</div>
      </div>
    ),
    size,
  );
}
