import type { MenuAdapter } from "./adapter";
import type { Candidate, Context, Fortune } from "./types";
import { DEMO_CANDIDATES } from "./demo-data";
import fortunesJson from "../data/fortunes.json";

// 演示 fixture 适配器：实现与真实适配器相同的契约。
// 带一点模拟延迟，用于驱动「看看这家店今天有什么」查询状态与抽签 ready 事件。

const rawFortunes = fortunesJson as Fortune[];

export interface FixtureOptions {
  /** 模拟查询延迟（毫秒），测试可设为 0。 */
  latencyMs?: number;
}

export function createFixtureAdapter(options: FixtureOptions = {}): MenuAdapter {
  const latencyMs = options.latencyMs ?? 450;
  return {
    kind: "fixture",
    async getCandidates(context: Context): Promise<Candidate[]> {
      await delay(latencyMs);
      // 把候选的 contextRevision 对齐当前上下文，供 UI 丢弃过期响应。
      return DEMO_CANDIDATES.map((c) => ({
        ...c,
        quote: { ...c.quote, contextRevision: context.revision },
      }));
    },
    async getFortunes(): Promise<Fortune[]> {
      return rawFortunes;
    },
  };
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 直接导出已加载的签文，供不走异步的工具复用。 */
export const ALL_FORTUNES: Fortune[] = rawFortunes;
