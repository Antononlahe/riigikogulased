import { partyToken } from "@/lib/party";

export function PartyBadge({ shortName, name }: { shortName: string | null; name?: string | null }) {
  const token = partyToken(shortName);
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold leading-none"
      style={{ backgroundColor: token.fill, color: token.onFill }}
      title={name ?? undefined}
    >
      {shortName ?? token.label}
    </span>
  );
}
