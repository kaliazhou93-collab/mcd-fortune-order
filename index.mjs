import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LiveSession } from "./session.mjs";
import { LiveError } from "./catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const MAX_BODY = 8192;
const TTL = 4 * 60 * 60 * 1000;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const random = () => randomBytes(32).toString("hex");

async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new LiveError("CONTENT_TYPE", "请求格式不正确。", 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    chunks.push(chunk); size += chunk.length;
    if (size > MAX_BODY) throw new LiveError("TOO_LARGE", "请求过大。", 413);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); }
  catch { throw new LiveError("JSON", "请求格式不正确。", 400); }
}

export async function startServer({
  port = Number(process.env.PORT || 4177), token = process.env.MCD_MCP_TOKEN,
  connect, now, dist = resolve(root, "dist"),
} = {}) {
  const fortunes = JSON.parse(await readFile(new URL("../data/fortunes.json", import.meta.url), "utf8"));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid port");
  const sessions = new Map();
  let origin;
  const send = (res, status, value) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(value));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      if (req.headers.host !== new URL(origin).host)
        throw new LiveError("HOST", "只允许从本机入口访问。", 403);
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith("/api/")) {
        if ((req.headers.origin && req.headers.origin !== origin)
          || req.headers["sec-fetch-site"] === "cross-site")
          throw new LiveError("ORIGIN", "请从本机网页入口访问。", 403);
        let sid = /(?:^|;\s*)mcd_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
        let session = sid && sessions.get(sid);
        if (session && Date.now() - session.last > TTL) {
          sessions.delete(sid); await session.engine.close(); session = undefined;
        }
        if (url.pathname === "/api/session" && req.method === "GET") {
          if (!session) {
            if (sessions.size >= 30) throw new LiveError("SESSIONS", "当前连接较多，请稍后再试。", 429);
            sid = random();
            session = { csrf: random(), engine: new LiveSession({ token, connect, now }),
              last: Date.now(), busy: false, requests: [] };
            sessions.set(sid, session);
            res.setHeader("Set-Cookie", `mcd_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}`);
          }
          session.last = Date.now();
          return send(res, 200, { mode: "live", connected: Boolean(session.engine.token),
            csrf: session.csrf, context: session.engine.context, cart: session.engine.snapshot(), ordersEnabled: false });
        }
        if (!session) throw new LiveError("SESSION", "连接已过期，请刷新页面重新连接。", 401);
        const csrf = String(req.headers["x-csrf-token"] ?? "");
        if (!/^[a-f0-9]{64}$/.test(csrf)
          || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf)))
          throw new LiveError("CSRF", "请求校验失败，请刷新页面。", 403);
        session.last = Date.now();
        session.requests = session.requests.filter(t => t > Date.now() - 60000);
        if (session.requests.length >= 40) throw new LiveError("RATE", "操作有点快，请稍后再试。", 429);
        session.requests.push(Date.now());
        if (req.method === "GET" && url.pathname === "/api/fortunes") return send(res, 200, fortunes);
        if (req.method === "GET" && url.pathname === "/api/cart") return send(res, 200, session.engine.snapshot());
        if (req.method !== "POST" || req.headers.origin !== origin)
          throw new LiveError("METHOD", "请求方式不正确。", 405);
        const input = await body(req);
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new LiveError("JSON", "请求格式不正确。", 400);
        if (session.busy) throw new LiveError("BUSY", "上一项操作还在进行，请稍候。", 409);
        session.busy = true;
        try {
          let result;
          switch (url.pathname) {
            case "/api/connect":
              if (typeof input.token !== "string" || !/^[A-Za-z0-9._~-]{12,512}$/.test(input.token))
                throw new LiveError("TOKEN_FORMAT", "请粘贴有效的 MCP Token。", 400);
              await session.engine.close();
              session.engine = new LiveSession({ token: input.token, connect, now });
              result = { connected: true, cart: session.engine.snapshot() }; break;
            case "/api/disconnect":
              await session.engine.close();
              session.engine = new LiveSession({ connect, now });
              result = { connected: false }; break;
            case "/api/prepare": result = await session.engine.prepare(input.preference); break;
            case "/api/cart/add": result = await session.engine.add(input); break;
            case "/api/cart/quantity": result = await session.engine.change(input); break;
            case "/api/cart/refresh": result = await session.engine.refresh(input.version); break;
            default: throw new LiveError("NOT_FOUND", "没有这个功能。", 404);
          }
          return send(res, 200, result);
        } finally { session.busy = false; }
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw new LiveError("METHOD", "请求方式不正确。", 405);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const path = resolve(dist, relative);
      if (!path.startsWith(resolve(dist) + sep) || relative.split(/[\\/]/).some(p => p.startsWith(".")))
        throw new LiveError("PATH", "找不到页面。", 404);
      try {
        const info = await stat(path);
        if (!info.isFile()) throw new Error();
        let content = await readFile(path);
        if (relative === "index.html") content = Buffer.from(content.toString("utf8")
          .replace("<head>", '<head><meta name="mcd-mode" content="live">'));
        res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream",
          "Cache-Control": extname(path) === ".html" ? "no-store" : "public, max-age=3600" });
        res.end(req.method === "HEAD" ? undefined : content);
      } catch { throw new LiveError("NOT_FOUND", "请先构建网页，再启动真实模式。", 404); }
    } catch (error) {
      if (res.headersSent) return res.end();
      const safe = error instanceof LiveError;
      send(res, safe ? error.status : 500, { error: {
        code: safe ? error.code : "INTERNAL",
        message: safe ? error.message : "暂时未能完成操作，请稍后重试。未创建订单。",
      } });
    }
  });
  server.requestTimeout = 180000;
  server.headersTimeout = 10000;
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(port, "127.0.0.1", yes);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const cleanup = setInterval(() => {
    for (const [sid, session] of sessions) if (!session.busy && Date.now() - session.last > TTL) {
      sessions.delete(sid); void session.engine.close();
    }
  }, 60000);
  cleanup.unref();
  return { server, origin, async close() {
    clearInterval(cleanup);
    await Promise.all([...sessions.values()].map(s => s.engine.close()));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  } };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  startServer().then(app => {
    console.log(`今天麦什么 · 真实查询入口 ${app.origin}`);
    console.log("仅在本机运行；购物车会实时核价，不创建订单或付款。");
  }).catch(() => {
    console.error("启动失败。请检查端口是否被占用，以及项目文件是否完整。");
    process.exitCode = 1;
  });
}
