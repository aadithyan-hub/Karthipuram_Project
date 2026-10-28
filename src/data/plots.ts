import type { Facing, Plot, PlotStatus } from './types'
import type { Rng } from './ids'

/** The site plan lives in a 1000 x 640 drawing space shared by the SVG and the seed. */
export const PLAN = {
  width: 1000,
  height: 640,
  boundary: { x: 20, y: 20, w: 960, h: 600 },
  avenue: { x: 470, w: 60 }, // 40 ft main avenue, entrance at the bottom
  crossRoads: [
    { y: 200, h: 36, label: '30 ft road' },
    { y: 400, h: 36, label: '30 ft road' },
  ],
  park: { x: 32, y: 448, w: 426, h: 160 },
}

const BLOCKS: { block: string; x0: number; y0: number; x1: number; y1: number }[] = [
  { block: 'A', x0: 20, y0: 20, x1: 470, y1: 200 },
  { block: 'B', x0: 530, y0: 20, x1: 980, y1: 200 },
  { block: 'C', x0: 20, y0: 236, x1: 470, y1: 400 },
  { block: 'D', x0: 530, y0: 236, x1: 980, y1: 400 },
  { block: 'E', x0: 530, y0: 436, x1: 980, y1: 620 },
]

const COL_WEIGHTS = [1.25, 1, 1, 1, 1, 1, 1, 1.25]
const SQFT_PER_UNIT = 0.36

export function buildPlots(rng: Rng): Plot[] {
  const plots: Plot[] = []
  for (const b of BLOCKS) {
    const pad = 12
    const innerW = b.x1 - b.x0 - pad * 2
    const innerH = b.y1 - b.y0 - pad * 2
    const rowH = innerH / 2
    const totalWeight = COL_WEIGHTS.reduce((s, w) => s + w, 0)
    let number = 1
    for (let row = 0; row < 2; row++) {
      let x = b.x0 + pad
      for (let col = 0; col < COL_WEIGHTS.length; col++) {
        const w = (innerW * COL_WEIGHTS[col]) / totalWeight
        const corner = col === 0 || col === COL_WEIGHTS.length - 1
        const facing: Facing = row === 0 ? 'North' : 'South'
        const raw = w * rowH * SQFT_PER_UNIT
        const areaSqft = Math.round(raw / 50) * 50
        const r = rng()
        const status: PlotStatus = r < 0.44 ? 'sold' : r < 0.56 ? 'reserved' : 'available'
        plots.push({
          id: `${b.block}-${number}`,
          block: b.block,
          number,
          areaSqft,
          facing,
          corner,
          status,
          x: x + 1.5,
          y: b.y0 + pad + row * rowH + 1.5,
          w: w - 3,
          h: rowH - 3,
        })
        x += w
        number++
      }
    }
  }
  return plots
}
