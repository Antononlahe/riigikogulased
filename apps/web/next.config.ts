import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  async redirects() {
    // Old routes (pre-2026-07 Estonian rename). Both bare (default locale et) and /en/ forms,
    // since localePrefix is "as-needed".
    const renames = [
      ["/parteidistsipliin", "/saadikud"],
      // [^.]+ so member photos (/members/<uuid>.webp, static files) are NOT redirected.
      ["/members/:slug([^.]+)", "/saadik/:slug"],
      ["/statistika", "/statistika/sonavotud"],
    ] as const;
    return renames.flatMap(([source, destination]) => [
      { source, destination, permanent: true },
      { source: `/en${source}`, destination: `/en${destination}`, permanent: true },
    ]);
  },
};

export default withNextIntl(nextConfig);
