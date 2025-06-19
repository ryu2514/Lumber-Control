// One Euro Filter implementation for pose landmark smoothing
export class OneEuroFilter {
  private x_prev: number = 0
  private dx_prev: number = 0
  private t_prev: number = 0
  private initialized: boolean = false

  constructor(
    private freq: number = 30, // Frequency (Hz)
    private mincutoff: number = 1.0, // Minimum cutoff frequency
    private beta: number = 0.007, // Speed coefficient
    private dcutoff: number = 1.0 // Cutoff frequency for derivative
  ) {}

  private lowPassFilter(x: number, cutoff: number, dt: number): number {
    const alpha = 1.0 / (1.0 + (2.0 * Math.PI * cutoff * dt))
    return alpha * x + (1.0 - alpha) * this.x_prev
  }

  filter(x: number, timestamp: number = Date.now()): number {
    if (!this.initialized) {
      this.initialized = true
      this.x_prev = x
      this.t_prev = timestamp
      return x
    }

    const dt = (timestamp - this.t_prev) / 1000.0 // Convert to seconds
    if (dt <= 0) return this.x_prev

    // Calculate derivative
    const dx = (x - this.x_prev) / dt
    const dx_filtered = this.lowPassFilter(dx, this.dcutoff, dt)

    // Calculate adaptive cutoff frequency
    const cutoff = this.mincutoff + this.beta * Math.abs(dx_filtered)

    // Apply low-pass filter
    const x_filtered = this.lowPassFilter(x, cutoff, dt)

    // Update state
    this.x_prev = x_filtered
    this.dx_prev = dx_filtered
    this.t_prev = timestamp

    return x_filtered
  }

  reset(): void {
    this.initialized = false
    this.x_prev = 0
    this.dx_prev = 0
    this.t_prev = 0
  }
}