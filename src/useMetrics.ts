import { useState, useRef, useCallback } from 'react'

// OneEuroFilter implementation (compact version)
class OneEuroFilter {
  private x_prev = 0
  private dx_prev = 0
  private t_prev = 0
  private initialized = false

  constructor(
    private freq = 60,
    private minCutoff = 1,
    private beta = 0,
    private dcutoff = 1
  ) {}

  private lowpass(x: number, cutoff: number, dt: number): number {
    const alpha = 1 / (1 + (2 * Math.PI * cutoff * dt))
    return alpha * x + (1 - alpha) * this.x_prev
  }

  filter(x: number, timestamp = Date.now()): number {
    if (!this.initialized) {
      this.initialized = true
      this.x_prev = x
      this.t_prev = timestamp
      return x
    }

    const dt = (timestamp - this.t_prev) / 1000
    if (dt <= 0) return this.x_prev

    const dx = (x - this.x_prev) / dt
    const dx_filtered = this.lowpass(dx, this.dcutoff, dt)
    const cutoff = this.minCutoff + this.beta * Math.abs(dx_filtered)
    const x_filtered = this.lowpass(x, cutoff, dt)

    this.x_prev = x_filtered
    this.dx_prev = dx_filtered
    this.t_prev = timestamp

    return x_filtered
  }

  reset() { this.initialized = false }
}

// Metrics hook with OneEuroFilter integration
export function useMetrics() {
  const [angles, setAngles] = useState<number[]>([])
  const [filteredAngles, setFilteredAngles] = useState<number[]>([])
  
  const filters = useRef<OneEuroFilter[]>([])

  const updateAngles = useCallback((newAngles: number[], timestamp?: number) => {
    // Ensure we have enough filters
    while (filters.current.length < newAngles.length) {
      filters.current.push(new OneEuroFilter(60, 1, 0))
    }

    // Apply filters
    const filtered = newAngles.map((angle, index) => 
      filters.current[index].filter(angle, timestamp)
    )

    setAngles(newAngles)
    setFilteredAngles(filtered)
  }, [])

  const resetFilters = useCallback(() => {
    filters.current.forEach(filter => filter.reset())
    setAngles([])
    setFilteredAngles([])
  }, [])

  return { angles, filteredAngles, updateAngles, resetFilters }
}