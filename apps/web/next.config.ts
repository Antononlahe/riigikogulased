import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    return [
      { source: "/topics", destination: "/teemad", permanent: false },
      { source: "/en/topics", destination: "/en/teemad", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
