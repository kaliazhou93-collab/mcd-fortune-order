// 可种子化的确定性 RNG（mulberry32）。
// 用途：测试可复现、商品随机与签文随机使用独立实例以保证互不耦合。

export interface Rng {
  /** 返回 [0,1) 浮点。 */
  next(): number;
  /** 返回 [0,max) 整数。 */
  int(max: number): number;
  /** 从数组等概率取一个元素。 */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(max: number): number {
      if (max <= 0) return 0;
      return Math.floor(next() * max);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("无法从空数组取样");
      }
      return items[Math.floor(next() * items.length)];
    },
  };
}

/** 由字符串生成一个稳定种子，便于 ?seed= 调试与大吉/中吉/小吉强制测试。 */
export function seedFromString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
