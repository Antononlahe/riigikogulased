import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/factions", destination: "/fraktsioonid", permanent: false },
      { source: "/en/factions", destination: "/en/fraktsioonid", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
