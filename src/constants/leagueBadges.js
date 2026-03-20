const LEAGUE_BADGE_MAP = {
  BRONZE: '/images/league-badges/bronze.png',
  SILVER: '/images/league-badges/silver.png',
  GOLD: '/images/league-badges/gold.png',
  PLATINUM: '/images/league-badges/platinum.png',
  DIAMOND: '/images/league-badges/diamond.png',
  브론즈: '/images/league-badges/bronze.png',
  실버: '/images/league-badges/silver.png',
  골드: '/images/league-badges/gold.png',
  플래티넘: '/images/league-badges/platinum.png',
  다이아몬드: '/images/league-badges/diamond.png',
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
