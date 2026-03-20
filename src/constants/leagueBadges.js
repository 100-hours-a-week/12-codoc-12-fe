const LEAGUE_BADGE_MAP = {
  BRONZE: 'https://images.codoc.cloud/images/league-badges/bronze.png',
  SILVER: 'https://images.codoc.cloud/images/league-badges/silver.png',
  GOLD: 'https://images.codoc.cloud/images/league-badges/gold.png',
  PLATINUM: 'https://images.codoc.cloud/images/league-badges/platinum.png',
  DIAMOND: 'https://images.codoc.cloud/images/league-badges/diamond.png',
  브론즈: 'https://images.codoc.cloud/images/league-badges/bronze.png',
  실버: 'https://images.codoc.cloud/images/league-badges/silver.png',
  골드: 'https://images.codoc.cloud/images/league-badges/gold.png',
  플래티넘: 'https://images.codoc.cloud/images/league-badges/platinum.png',
  다이아몬드: 'https://images.codoc.cloud/images/league-badges/diamond.png',
}

const normalizeLeagueName = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()

export const getLeagueBadgeImage = (leagueName) => {
  const normalized = normalizeLeagueName(leagueName)
  if (!normalized) {
    return null
  }

  return LEAGUE_BADGE_MAP[normalized] ?? null
}
