import { partyToken } from "@/lib/party";

export function PartyBadge({ shortName, name }: { shortName: string | null; name?: string | null }) {
  const token = partyToken(shortName);
  return (
    <span
      className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold leading-none"
      style={{ color: token.ink, borderColor: token.ink }}
      title={name ?? undefined}
    >
      {shortName ?? token.label}
    </span>
  );
}
