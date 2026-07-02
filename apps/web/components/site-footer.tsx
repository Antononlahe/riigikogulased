import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const footer = await getTranslations("footer");
  return (
    <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
      <p>{footer("source")}</p>
      <p>
        {footer("contact")}{" "}
        <a href="mailto:anton.zatkin@gmail.com" className="hover:text-foreground">
          anton.zatkin@gmail.com
        </a>
      </p>
    </footer>
  );
}
