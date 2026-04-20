export function normalizeFKText(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function prettifyFKIdentifier(value: string | null | undefined): string {
  const cleaned = String(value || "")
    .replace(/^@+/, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || String(value || "").replace(/^@+/, "").trim();
}

export function canonicalizeFKProfileIdentity(value: string | null | undefined): string {
  const normalized = normalizeFKText(prettifyFKIdentifier(value)).replace(/\s+/g, "");
  const stripped = normalized.replace(/(mexico|mex|mx|analisis)$/g, "");
  return stripped || normalized;
}

export function getFKProfileDisplayName(profile: {
  display_name?: string | null;
  profile_id?: string | null;
}): string {
  const preferred = String(profile.display_name || "").trim();
  if (preferred) return prettifyFKIdentifier(preferred);
  return prettifyFKIdentifier(profile.profile_id);
}

export function getFKProfileTechnicalLabel(profileId: string | null | undefined): string {
  const cleaned = String(profileId || "").replace(/^@+/, "").trim();
  return cleaned ? `@${cleaned}` : "";
}

export function getFKProfileSeriesLabel(profile: {
  display_name?: string | null;
  profile_id?: string | null;
  network?: string | null;
}): string {
  const base = getFKProfileDisplayName(profile);
  const network = String(profile.network || "").trim();
  if (!network) return base;

  const networkLabelMap: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    twitter: "Twitter/X",
    threads: "Threads",
  };

  return `${base} · ${networkLabelMap[network] || network}`;
}