import { describe, expect, it } from 'vitest'
import { CAMPUS25_BOUNDARY } from '@/data/campus25'
import { centroid, line, placeBlockLabels, project } from './campus-projection'

const SQUARE = [
  { lat: 20.35, lng: 85.81 },
  { lat: 20.36, lng: 85.81 },
  { lat: 20.36, lng: 85.82 },
  { lat: 20.35, lng: 85.82 },
]

describe('project', () => {
  it('puts north above south and east right of west', () => {
    const plan = project(SQUARE)
    const north = plan.toXY({ lat: 20.36, lng: 85.815 })
    const south = plan.toXY({ lat: 20.35, lng: 85.815 })
    const east = plan.toXY({ lat: 20.355, lng: 85.82 })
    const west = plan.toXY({ lat: 20.355, lng: 85.81 })

    // SVG y grows downward, so a higher latitude means a smaller y.
    expect(north.y).toBeLessThan(south.y)
    expect(east.x).toBeGreaterThan(west.x)
  })

  it('keeps every framed point inside the canvas', () => {
    const plan = project(CAMPUS25_BOUNDARY)
    for (const point of CAMPUS25_BOUNDARY) {
      const { x, y } = plan.toXY(point)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(plan.width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(plan.height)
    }
  })

  it('corrects for longitude convergence so the campus is not stretched', () => {
    // A degree of longitude at 20°N covers ~94% of a degree of latitude. An
    // uncorrected projection would make this square markedly wider than tall.
    const plan = project(SQUARE)
    const aspect = plan.width / plan.height
    expect(aspect).toBeGreaterThan(0.9)
    expect(aspect).toBeLessThan(1.0)
  })

  it('reports a scale a bar can be drawn from', () => {
    const plan = project(CAMPUS25_BOUNDARY)
    expect(plan.metresPerUnit).toBeGreaterThan(0)
    // The campus is a few hundred metres across, not a few thousand.
    expect(plan.metresPerUnit * plan.width).toBeLessThan(5_000)
  })
})

describe('placeBlockLabels', () => {
  const plan = project(CAMPUS25_BOUNDARY)

  it('names every block exactly once', () => {
    const placed = placeBlockLabels(plan)
    expect(new Set(placed.map((label) => label.id)).size).toBe(placed.length)
    expect(placed.length).toBeGreaterThan(0)
  })

  it('never leaves two labels stacked on the same spot', () => {
    // The bug this replaced: names printed over each other, which is what
    // made the map look hand-drawn.
    const placed = placeBlockLabels(plan)
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const sameRow = Math.abs(placed[i].y - placed[j].y) < 1
        const sameColumn = Math.abs(placed[i].x - placed[j].x) < 1
        expect(sameRow && sameColumn).toBe(false)
      }
    }
  })

  it('is deterministic — the same campus places labels identically', () => {
    expect(placeBlockLabels(plan)).toEqual(placeBlockLabels(plan))
  })
})

describe('centroid', () => {
  it('finds the middle of a rectangle', () => {
    const plan = project(SQUARE)
    const middle = centroid(SQUARE, plan)
    expect(middle.x).toBeCloseTo(plan.width / 2, 0)
    expect(middle.y).toBeCloseTo(plan.height / 2, 0)
  })
})

describe('line', () => {
  it('emits one rounded pair per point', () => {
    const points = line(SQUARE, project(SQUARE)).split(' ')
    expect(points).toHaveLength(SQUARE.length)
    for (const pair of points) expect(pair).toMatch(/^\d+\.\d,\d+\.\d$/)
  })
})
