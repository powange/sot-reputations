import { describe, expect, it } from 'vitest'
import { fingerprintDistance, similarityScore } from '../server/utils/chest-image-similarity'

// Empreinte 2 pixels RGBA.
const px = (...values: number[]) => Buffer.from(values)

describe('fingerprintDistance / similarityScore', () => {
  it('images identiques : distance 0, score 100 %', () => {
    const a = px(200, 100, 50, 255, 10, 200, 30, 255)
    expect(fingerprintDistance(a, a)).toBe(0)
    expect(similarityScore(0)).toBe(100)
  })

  it('ignore le fond transparent et le noir pur', () => {
    const a = px(200, 100, 50, 255, 0, 0, 0, 255)
    const b = px(200, 100, 50, 255, 5, 5, 5, 0)
    expect(fingerprintDistance(a, b)).toBe(0)
  })

  it('score borné entre 0 et 100', () => {
    expect(similarityScore(10)).toBe(80)
    expect(similarityScore(80)).toBe(0)
  })
})
