import * as GeoJSON from "geojson"

interface RunStatistics {
  lengthInKm?: number
  count?: number
  maxElevation?: number
  minElevation?: number
  combinedElevationChange?: number
}

interface ActivityStatistics {
  byDifficulty?: {
    [difficulty: string]: RunStatistics
  }
}

export function calculateTotalRunLength(feature: GeoJSON.Feature): number {
  if (!feature.properties?.statistics?.runs?.byActivity) {
    return 0
  }

  const activities = feature.properties.statistics.runs.byActivity as {
    [activity: string]: ActivityStatistics
  }

  let total = 0
  for (const activity of Object.values(activities)) {
    if (!activity.byDifficulty) {
      continue
    }

    for (const difficulty of Object.values(activity.byDifficulty)) {
      total += difficulty.lengthInKm || 0
    }
  }

  return total
}

export function normalizeToRank(lengthInKm: number): number {
  if (lengthInKm <= 0) {
    return 0
  }

  // Log scale: gives ~5 points for 100km, ~3 points for 10km, ~2 points for 3km
  // This keeps rank meaningful but not dominant over name matching
  const rank = Math.log10(lengthInKm + 1) * 2.5
  return Math.min(5, Math.max(0, rank))
}

export function calculateRank(feature: GeoJSON.Feature): number {
  const totalLength = calculateTotalRunLength(feature)
  return normalizeToRank(totalLength)
}
