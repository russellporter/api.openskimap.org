import type * as GeoJSON from "geojson"

export type Bounds = {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

const KM_PER_DEGREE = 111.32

/**
 * Computes the WGS84 bounding box of a GeoJSON geometry.
 * Only the horizontal (x/y) coordinates are used, so elevations are ignored.
 * Returns null when the geometry is missing or contains no usable coordinates.
 */
export function computeBounds(
  geometry: GeoJSON.Geometry | null | undefined
): Bounds | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  let found = false

  forEachPosition(geometry, (lon, lat) => {
    found = true
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  })

  return found ? { minLon, minLat, maxLon, maxLat } : null
}

/**
 * Approximate area of a bounding box in square kilometers, using an
 * equirectangular projection at the box's mid latitude.
 */
export function boundsAreaSqKm(bounds: Bounds): number {
  const latSpanKm = (bounds.maxLat - bounds.minLat) * KM_PER_DEGREE
  const midLatRad = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180)
  const lonSpanKm =
    (bounds.maxLon - bounds.minLon) * KM_PER_DEGREE * Math.cos(midLatRad)
  return latSpanKm * lonSpanKm
}

/** Invokes the callback for every horizontal coordinate pair in the geometry. */
function forEachPosition(
  geometry: GeoJSON.Geometry | null | undefined,
  callback: (lon: number, lat: number) => void
): void {
  const visitPosition = (position: unknown) => {
    if (!Array.isArray(position) || position.length < 2) {
      return
    }
    const lon = position[0]
    const lat = position[1]
    if (typeof lon !== "number" || typeof lat !== "number") {
      return
    }
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return
    }
    callback(lon, lat)
  }

  const visitCoordinates = (coordinates: unknown) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return
    }
    if (typeof coordinates[0] === "number") {
      visitPosition(coordinates)
      return
    }
    for (const nested of coordinates) {
      visitCoordinates(nested)
    }
  }

  const visitGeometry = (candidate: GeoJSON.Geometry | null | undefined) => {
    if (!candidate) {
      return
    }
    if (candidate.type === "GeometryCollection") {
      for (const child of candidate.geometries) {
        visitGeometry(child)
      }
      return
    }
    visitCoordinates((candidate as { coordinates?: unknown }).coordinates)
  }

  visitGeometry(geometry)
}
