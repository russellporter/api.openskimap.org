import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../../app.ts'
import getRepository from '../../RepositoryFactory.ts'

// A box comfortably larger than the 1000 sq km limit.
const OVERSIZED_BBOX = '0,0,5,5'
// A box around the Garmisch fixtures, excluding the outlier at (13, 48).
const GARMISCH_BBOX = '11.0,47.4,11.2,47.5'

function geometryRange(feature: any): {
  lon: [number, number]
  lat: [number, number]
} {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  const visit = (coordinates: any) => {
    if (typeof coordinates[0] === 'number') {
      minLon = Math.min(minLon, coordinates[0])
      maxLon = Math.max(maxLon, coordinates[0])
      minLat = Math.min(minLat, coordinates[1])
      maxLat = Math.max(maxLat, coordinates[1])
      return
    }
    for (const nested of coordinates) visit(nested)
  }

  visit(feature.geometry.coordinates)
  return { lon: [minLon, maxLon], lat: [minLat, maxLat] }
}

describe('GET /features.geojson', () => {
  let app: any

  beforeAll(async () => {
    const repository = await getRepository()
    app = createApp(repository)
  })

  describe('Bounding box queries', () => {
    it('returns a FeatureCollection of features within the bounds', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}`)
        .expect(200)
        .expect('Content-Type', /geo\+json/)

      expect(response.body.type).toBe('FeatureCollection')
      expect(Array.isArray(response.body.features)).toBe(true)
      expect(response.body.features.length).toBeGreaterThan(0)

      const names = response.body.features.map((f: any) => f.properties.name)
      expect(names).toContain('Garmisch Loipen')
      expect(names).toContain('Graseckbahn')
      expect(names).not.toContain('Gr\u00fcn-Pr\u00f6ller')
    })

    it('returns features shaped like the single feature endpoints', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}`)
        .expect(200)

      for (const feature of response.body.features) {
        expect(feature.type).toBe('Feature')
        expect(feature.properties).toBeDefined()
        expect(feature.geometry).toBeDefined()
      }
    })

    it('only returns features overlapping the bounds', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}`)
        .expect(200)

      expect(response.body.features.length).toBeGreaterThan(0)
      for (const feature of response.body.features) {
        const range = geometryRange(feature)
        expect(range.lon[1]).toBeGreaterThanOrEqual(11.0)
        expect(range.lon[0]).toBeLessThanOrEqual(11.2)
        expect(range.lat[1]).toBeGreaterThanOrEqual(47.4)
        expect(range.lat[0]).toBeLessThanOrEqual(47.5)
      }
    })

    it('returns an empty FeatureCollection when nothing matches', async () => {
      const response = await request(app)
        .get('/features.geojson?bbox=0,0,0.01,0.01')
        .expect(200)

      expect(response.body.type).toBe('FeatureCollection')
      expect(response.body.features).toEqual([])
    })
  })

  describe('Type filtering', () => {
    it('returns only the requested feature type', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}&types=lift`)
        .expect(200)

      expect(response.body.features.length).toBeGreaterThan(0)
      for (const feature of response.body.features) {
        expect(feature.properties.type).toBe('lift')
      }
    })

    it('accepts multiple types', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}&types=run,skiArea`)
        .expect(200)

      const types = new Set(
        response.body.features.map((f: any) => f.properties.type)
      )
      expect(types.size).toBeGreaterThan(0)
      for (const type of types) {
        expect(['run', 'skiArea']).toContain(type)
      }
    })

    it('matches feature types case-insensitively', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}&types=LIFT,SkiArea`)
        .expect(200)

      expect(response.body.features.length).toBeGreaterThan(0)
      for (const feature of response.body.features) {
        expect(['lift', 'skiArea']).toContain(feature.properties.type)
      }
    })

    it('rejects unknown feature types', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}&types=bogus`)
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('requires a bbox', async () => {
      const response = await request(app)
        .get('/features.geojson')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('rejects a bbox with the wrong number of values', async () => {
      const response = await request(app)
        .get('/features.geojson?bbox=1,2,3')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('rejects a non-numeric bbox', async () => {
      const response = await request(app)
        .get('/features.geojson?bbox=a,b,c,d')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('rejects an inverted bbox', async () => {
      const response = await request(app)
        .get('/features.geojson?bbox=11.2,47.5,11.0,47.4')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('rejects out-of-range coordinates', async () => {
      const response = await request(app)
        .get('/features.geojson?bbox=-200,0,10,10')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('rejects a bbox larger than 1000 sq km', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${OVERSIZED_BBOX}`)
        .expect(400)

      expect(response.body.error).toContain('1000')
    })
  })

  describe('CORS headers', () => {
    it('includes CORS headers on success', async () => {
      const response = await request(app)
        .get(`/features.geojson?bbox=${GARMISCH_BBOX}`)
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toBe('GET')
    })

    it('includes CORS headers on error', async () => {
      const response = await request(app)
        .get('/features.geojson')
        .expect(400)

      expect(response.headers['access-control-allow-origin']).toBe('*')
    })
  })
})
