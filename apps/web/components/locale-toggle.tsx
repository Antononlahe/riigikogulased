"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleToggle() {
  const t = useTranslations("locale");
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const current = (params.locale as string) ?? "et";
  const other = current === "et" ? "en" : "et";
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("label")}
      onClick={() => router.replace(pathname, { locale: other })}
    >
      {current === "et" ? t("et") : t("en")}
    </Button>
  );
}
