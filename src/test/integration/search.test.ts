import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import getRepository from '../../RepositoryFactory'
import { createApp } from '../../app'

describe('GET /search', () => {
  let app: any

  beforeAll(async () => {
    const repository = await getRepository()
    app = createApp(repository)
  })

  describe('Valid searches', () => {
    it('returns results for exact name match', async () => {
      const response = await request(app)
        .get('/search?query=Garmisch')
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0]).toHaveProperty('type', 'Feature')
      expect(response.body[0]).toHaveProperty('properties')
      expect(response.body[0]).toHaveProperty('geometry')
    })

    it('returns results for exact name match with single character second word', async () => {
      const response = await request(app)
        .get('/search?query=Garmisch%20L')
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
      expect(response.body[0].properties).toHaveProperty('type', 'skiArea')
      expect(response.body[0].properties).toHaveProperty('name', 'Garmisch Loipen')
    })

    it('returns results for partial name match', async () => {
      const response = await request(app)
        .get('/search?query=Eckbauer')
        .expect(200)

      expect(response.body).toBeInstanceOf(Array)
      expect(response.body.length).toBeGreaterThan(0)
    })

    it('is case insensitive', async () => {
      const response1 = await request(app)
        .get('/search?query=garmisch')
        .expect(200)

      const response2 = await request(app)
        .get('/search?query=GARMISCH')
        .expect(200)

      expect(response1.body).toEqual(response2.body)
      expect(response1.body.length).toBeGreaterThan(0)
    })

    it('prioritizes ski areas over lifts and runs', async () => {
      const response = await request(app)
        .get('/search?query=Garmisch')
        .expect(200)

        const types = response.body.map((f: any) => f.properties.type)
        const firstSkiAreaIndex = types.indexOf('skiArea')
        const firstLiftIndex = types.indexOf('lift')
        const firstRunIndex = types.indexOf('run')

        expect(firstSkiAreaIndex).toBeLessThan(firstLiftIndex)
        expect(firstLiftIndex).toBeLessThan(firstRunIndex)
    })

    it('returns relevant results for a single character, and limits to to 10', async () => {
      const response = await request(app)
        .get('/search?query=a')
        .expect(200)

      expect(response.body.length).toEqual(10)
      const names = response.body.map((f: any) => f.properties.name)
      expect(names).toMatchInlineSnapshot(`
        [
          "Alpspitzbahn",
          "Garmisch Loipen",
          "Skigebiet Eckbauer",
          "Skigebiet Garmisch-Classic",
          "Kreuzeckbahn",
          "Graseckbahn",
          "Hausbergbahn",
          "Kreuzjochlift",
          "Kreuzwankl-Umfahrung",
          "Mittlerer Skiweg",
        ]
      `)
    })

    it('returns relevant results for a two characters', async () => {
      const response = await request(app)
        .get('/search?query=al')
        .expect(200)

      const names = response.body.map((f: any) => f.properties.name)
      expect(names).toMatchInlineSnapshot(`
        [
          "Alpspitzbahn",
        ]
      `)
    })

    it('returns relevant results for a place search', async () => {
      const response = await request(app)
        .get('/search?query=Garmisch-Partenkirchen')
        .expect(200)

      const names = response.body.map((f: any) => f.properties.name)
      expect(names).toMatchInlineSnapshot(`
        [
          "Garmisch Loipen",
          "Skigebiet Eckbauer",
          "Skigebiet Garmisch-Classic",
          "Graseckbahn",
          "Alpspitzbahn",
          "Kreuzeckbahn",
          "Hausbergbahn",
          "Kreuzjochlift",
          "Mittlerer Skiweg",
          "Kreuzwankl-Umfahrung",
        ]
      `)
    })

    it('returns empty array for no matches', async () => {
      const response = await request(app)
        .get('/search?query=NonexistentSkiArea12345')
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('returns empty array for empty query', async () => {
      const response = await request(app)
        .get('/search?query=')
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('trims whitespace from query', async () => {
      const response = await request(app)
        .get('/search?query=  Garmisch  ')
        .expect(200)

      expect(response.body.length).toBeGreaterThan(0)
    })

    it('prefers word-start matches over word-middle matches', async () => {
      const response = await request(app)
        .get('/search?query=eck')
        .expect(200)

      const names = response.body.map((f: any) => f.properties.name)

      // "Eckbauer" (word start) should rank higher than
      // "Graseckbahn" or "Kreuzeckbahn" (word middle)
      expect(names).toMatchInlineSnapshot(`
        [
          "Skigebiet Eckbauer",
          "Graseckbahn",
          "Kreuzeckbahn",
        ]
      `)
    })
  })

  describe('Error handling', () => {
    it('returns 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/search')
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('error')
    })

    it('returns 400 for non-string query parameter', async () => {
      const response = await request(app)
        .get('/search?query[]=invalid')
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('CORS headers', () => {
    it('includes CORS headers in response', async () => {
      const response = await request(app)
        .get('/search?query=test')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toBe('GET')
    })
  })

  describe('GeoJSON format', () => {
    it('returns valid GeoJSON features', async () => {
      const response = await request(app)
        .get('/search?query=Garmisch')
        .expect(200)

      expect(response.body.length).toBeGreaterThan(0)
      const feature = response.body[0]
      expect(feature.type).toBe('Feature')
      expect(feature.geometry).toBeDefined()
      expect(feature.geometry.type).toBeDefined()
      expect(feature.geometry.coordinates).toBeDefined()
      expect(feature.properties).toBeDefined()
      expect(feature.properties.type).toBeDefined()
    })
  })
})
