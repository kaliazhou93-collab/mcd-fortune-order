import type { Candidate, Cart, Context, Fortune, Preference } from "./types";

// 适配器契约：演示用 fixture 适配器与未来真实 MCP 适配器共享此接口。
// UI 只依赖这个契约，不直接依赖具体数据来源，便于 M2 替换为服务端 MCP。

export interface MenuAdapter {
  /** 返回当前上下文下、已核价的候选集合（服务端生成 opaque id）。 */
  getCandidates(context: Context, preference?: Preference): Promise<Candidate[]>;
  /** 返回全部签文（UI 侧抽样，签文与商品随机独立）。 */
  getFortunes(): Promise<Fortune[]>;
  /** 适配器标识，用于页面明确标注演示/真实。 */
  readonly kind: "fixture" | "live";
  readonly initialContext?: Context;
  readonly initialCart?: Cart;
  liveCart?: {
    add(candidateId: string, actionId: string, version: number): Promise<Cart>;
    change(lineKey: string, quantity: number, version: number): Promise<Cart>;
    refresh(version: number): Promise<Cart>;
    read(): Promise<Cart>;
  };
}
