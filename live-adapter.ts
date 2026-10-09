import type { MenuAdapter } from "./adapter";
import type { Candidate, Cart, Context, Fortune } from "./types";

export interface LiveBootstrap {
  mode: "live";
  csrf: string;
  connected: boolean;
  context: Context;
  cart: Cart;
}

export async function liveRequest<T>(path: string, csrf?: string, input?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: input === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: { ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    throw new Error("连接中断，请确认本机服务仍在运行，再重试。");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "服务未能完成操作，请重试。");
  return data as T;
}

export function createLiveAdapter(bootstrap: LiveBootstrap): MenuAdapter {
  const request = <T>(path: string, input?: unknown) => liveRequest<T>(path, bootstrap.csrf, input);
  return {
    kind: "live",
    initialContext: bootstrap.context,
    initialCart: bootstrap.cart,
    async getCandidates(_context, preference) {
      const result = await request<{ candidates: Candidate[] }>("prepare", { preference });
      return result.candidates;
    },
    getFortunes: () => request<Fortune[]>("fortunes"),
    liveCart: {
      add: (candidateId, actionId, version) => request<Cart>("cart/add", { candidateId, actionId, version }),
      change: (lineKey, quantity, version) => request<Cart>("cart/quantity", { lineKey, quantity, version }),
      refresh: version => request<Cart>("cart/refresh", { version }),
      read: () => request<Cart>("cart"),
    },
  };
}
