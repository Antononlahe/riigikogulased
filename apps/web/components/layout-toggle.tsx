"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Flips the home page between v1 (card grid, default) and v2 (themed rails). The preference is a
// global data attribute on <html> + localStorage; only the home page reacts to it (via CSS in
// globals.css). Mirrors ThemeToggle, but hand-rolled -- next-themes owns a single attribute.
export function LayoutToggle() {
  const t = useTranslations("layout");
  const [v2, setV2] = useState(false);

  useEffect(() => {
    setV2(document.documentElement.dataset.hubLayout === "v2");
  }, []);

  const toggle = () => {
    const next = v2 ? "v1" : "v2";
    try {
      localStorage.setItem("hub-layout", next);
    } catch {
      // private mode / storage disabled -> preference just won't persist
    }
    document.documentElement.dataset.hubLayout = next;
    setV2(!v2);
  };

  return (
    <Button variant="ghost" size="icon" aria-label={t("label")} title={t(v2 ? "v2" : "v1")} onClick={toggle}>
      {v2 ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
    </Button>
  );
}
