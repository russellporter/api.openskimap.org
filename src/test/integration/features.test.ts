import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import getRepository from '../../RepositoryFactory'
import { createApp } from '../../app'
import { Repository } from '../../Repository'

describe('GET /features/:id.geojson', () => {
  let app: any
  let repository: Repository
  let validSkiAreaId: string
  let validLiftId: string

  beforeAll(async () => {
    repository = await getRepository()
    app = createApp(repository)

    const skiAreaResults = await repository.search('Garmisch', 10)
    const skiArea = skiAreaResults.find(f => f.properties.type === 'skiArea')
    expect(skiArea, 'Test data must include a ski area with "Garmisch" in name').toBeDefined()
    validSkiAreaId = skiArea!.properties.id

    const liftResults = await repository.search('Graseck', 10)
    const lift = liftResults.find(f => f.properties.type === 'lift')
    expect(lift, 'Test data must include a lift named Graseckbahn').toBeDefined()
    validLiftId = lift!.properties.id
  }, 60000)

  describe('Valid feature requests', () => {
    it('returns a ski area by ID', async () => {
      const response = await request(app)
        .get(`/features/${validSkiAreaId}.geojson`)
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toHaveProperty('type', 'Feature')
      expect(response.body).toHaveProperty('properties')
      expect(response.body).toHaveProperty('geometry')
      expect(response.body.properties).toHaveProperty('type', 'skiArea')
      expect(response.body.properties).toHaveProperty('id', validSkiAreaId)
    })

    it('returns a lift by ID', async () => {
      const response = await request(app)
        .get(`/features/${validLiftId}.geojson`)
        .expect(200)

      expect(response.body.properties).toHaveProperty('type', 'lift')
      expect(response.body.properties).toHaveProperty('id', validLiftId)
    })


    it('returns valid GeoJSON structure', async () => {
      const response = await request(app)
        .get(`/features/${validSkiAreaId}.geojson`)
        .expect(200)

      expect(response.body.type).toBe('Feature')
      expect(response.body.geometry).toBeDefined()
      expect(response.body.geometry.type).toBeDefined()
      expect(response.body.geometry.coordinates).toBeInstanceOf(Array)
      expect(response.body.properties).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('returns 404 for non-existent feature ID', async () => {
      await request(app)
        .get('/features/nonexistent-id-12345.geojson')
        .expect(404)
    })

    it('returns 404 for empty ID', async () => {
      await request(app)
        .get('/features/.geojson')
        .expect(404)
    })
  })

  describe('CORS headers', () => {
    it('includes CORS headers in response', async () => {
      const response = await request(app)
        .get(`/features/${validSkiAreaId}.geojson`)
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('*')
      expect(response.headers['access-control-allow-methods']).toBe('GET')
    })

    it('includes CORS headers even on 404', async () => {
      const response = await request(app)
        .get('/features/nonexistent.geojson')
        .expect(404)

      expect(response.headers['access-control-allow-origin']).toBe('*')
    })
  })
})
