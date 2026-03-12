export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextFloat() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  }

  nextInt(max: number) {
    if (max <= 0) return 0;
    return Math.floor(this.nextFloat() * max);
  }
}
