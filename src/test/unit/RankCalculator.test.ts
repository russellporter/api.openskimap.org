import { describe, expect, it } from 'vitest'
import * as GeoJSON from 'geojson'
import { calculateTotalRunLength, normalizeToRank, calculateRank } from '../../RankCalculator'

describe('RankCalculator', () => {
  describe('calculateTotalRunLength', () => {
    it('returns 0 for feature with no statistics', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBe(0)
    })

    it('returns 0 for feature with no runs', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {}
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBe(0)
    })

    it('calculates total run length for single activity and difficulty', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {
              byActivity: {
                downhill: {
                  byDifficulty: {
                    easy: {
                      lengthInKm: 10.5
                    }
                  }
                }
              }
            }
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBe(10.5)
    })

    it('calculates total run length for multiple difficulties', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {
              byActivity: {
                downhill: {
                  byDifficulty: {
                    easy: { lengthInKm: 10.5 },
                    intermediate: { lengthInKm: 15.3 },
                    advanced: { lengthInKm: 8.2 }
                  }
                }
              }
            }
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBeCloseTo(34.0)
    })

    it('calculates total run length for multiple activities', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {
              byActivity: {
                downhill: {
                  byDifficulty: {
                    easy: { lengthInKm: 10.5 }
                  }
                },
                nordic: {
                  byDifficulty: {
                    easy: { lengthInKm: 5.0 }
                  }
                }
              }
            }
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBe(15.5)
    })

    it('handles missing lengthInKm fields', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {
              byActivity: {
                downhill: {
                  byDifficulty: {
                    easy: { count: 5 },
                    intermediate: { lengthInKm: 10.0 }
                  }
                }
              }
            }
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateTotalRunLength(feature)).toBe(10.0)
    })
  })

  describe('normalizeToRank', () => {
    it('returns 0 for length 0', () => {
      expect(normalizeToRank(0)).toBe(0)
    })

    it('returns 0 for negative length', () => {
      expect(normalizeToRank(-5)).toBe(0)
    })

    it('returns approximately 2.6 for 10km', () => {
      expect(normalizeToRank(10)).toBeCloseTo(2.6, 1)
    })

    it('returns approximately 4.3 for 50km', () => {
      expect(normalizeToRank(50)).toBeCloseTo(4.3, 1)
    })

    it('returns approximately 5 for 100km', () => {
      expect(normalizeToRank(100)).toBeCloseTo(5, 1)
    })

    it('caps at 5 for very large lengths', () => {
      expect(normalizeToRank(1000)).toBe(5)
      expect(normalizeToRank(10000)).toBe(5)
    })
  })

  describe('calculateRank', () => {
    it('returns 0 for feature with no runs', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateRank(feature)).toBe(0)
    })

    it('calculates rank based on total run length', () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: {
          statistics: {
            runs: {
              byActivity: {
                downhill: {
                  byDifficulty: {
                    easy: { lengthInKm: 10.0 }
                  }
                }
              }
            }
          }
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
      }
      expect(calculateRank(feature)).toBeGreaterThan(0)
      expect(calculateRank(feature)).toBeLessThanOrEqual(5)
    })
  })
})
