import { describe, expect, it } from 'vitest'

import { boundsAreaSqKm, computeBounds } from '../../geometry.ts'

describe('computeBounds', () => {
  it('returns the coordinates of a point', () => {
    expect(
      computeBounds({ type: 'Point', coordinates: [11.05, 47.47] })
    ).toEqual({
      minLon: 11.05,
      minLat: 47.47,
      maxLon: 11.05,
      maxLat: 47.47,
    })
  })

  it('ignores elevation on a 3D line string', () => {
    expect(
      computeBounds({
        type: 'LineString',
        coordinates: [
          [11.0, 47.0, 500],
          [11.1, 47.2, 900],
          [11.05, 47.1, 700],
        ],
      })
    ).toEqual({ minLon: 11.0, minLat: 47.0, maxLon: 11.1, maxLat: 47.2 })
  })

  it('spans all rings of a polygon', () => {
    expect(
      computeBounds({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 0],
          ],
        ],
      })
    ).toEqual({ minLon: 0, minLat: 0, maxLon: 2, maxLat: 2 })
  })

  it('spans every polygon of a multipolygon', () => {
    expect(
      computeBounds({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
          [
            [
              [5, 5],
              [6, 5],
              [6, 6],
              [5, 5],
            ],
          ],
        ],
      })
    ).toEqual({ minLon: 0, minLat: 0, maxLon: 6, maxLat: 6 })
  })

  it('spans every geometry of a geometry collection', () => {
    expect(
      computeBounds({
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [3, 4] },
          {
            type: 'LineString',
            coordinates: [
              [-1, -2],
              [1, 2],
            ],
          },
        ],
      })
    ).toEqual({ minLon: -1, minLat: -2, maxLon: 3, maxLat: 4 })
  })

  it('returns null for missing geometry', () => {
    expect(computeBounds(null)).toBeNull()
    expect(computeBounds(undefined)).toBeNull()
  })

  it('returns null for geometry without coordinates', () => {
    expect(computeBounds({ type: 'MultiPoint', coordinates: [] })).toBeNull()
  })
})

describe('boundsAreaSqKm', () => {
  it('computes the area of a box at mid latitude', () => {
    expect(
      boundsAreaSqKm({ minLon: 11.0, minLat: 47.4, maxLon: 11.2, maxLat: 47.5 })
    ).toBeCloseTo(167.5, 0)
  })

  it('computes the area of a box at the equator', () => {
    expect(
      boundsAreaSqKm({ minLon: 0, minLat: 0, maxLon: 0.01, maxLat: 0.01 })
    ).toBeCloseTo(1.239, 2)
  })
})
