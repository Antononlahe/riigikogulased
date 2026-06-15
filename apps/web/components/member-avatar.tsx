import Image from "next/image";
import { partyToken } from "@/lib/party";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function MemberAvatar({
  fullName,
  photoThumbPath,
  shortName,
}: {
  fullName: string;
  photoThumbPath: string | null;
  shortName: string | null;
}) {
  if (photoThumbPath) {
    return (
      <Image
        src={photoThumbPath}
        alt={fullName}
        width={30}
        height={30}
        className="h-[30px] w-[30px] flex-none rounded-full object-cover"
      />
    );
  }
  const token = partyToken(shortName);
  return (
    <span
      aria-hidden
      className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-muted text-[11px] font-semibold"
      style={{ color: token.ink }}
    >
      {initials(fullName)}
    </span>
  );
}
