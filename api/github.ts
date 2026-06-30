/**
 * Vercel Serverless Function - GitHub API Proxy
 * 路径: /api/github
 */

const GH_API = "https://api.github.com";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
  "Access-Control-Max-Age": "86400",
};

export default async function handler(req: any, res: any) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      res.setHeader(key, value);
    }
    return res.status(204).end();
  }

  // 设置 CORS 头
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method === "POST") {
    return handlePost(req, res);
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(req: any, res: any) {
  const path = req.query.path;

  // GET /api/github → 状态检查
  if (!path) {
    const appId = process.env.GH_APP_ID || "";
    const hasAppId = !!appId;
    return res.status(200).json({
      ok: true,
      status: "proxy-ready",
      serverAuth: false,
      hasAppId,
      appId: hasAppId ? appId : "",
      message: hasAppId
        ? "GitHub proxy is running. App ID available. Import PEM key to authenticate."
        : "GitHub proxy is running. Import your .pem key to authenticate.",
    });
  }

  // GET with path → 转发 API 请求（透传客户端 Authorization）
  const clientAuth = req.headers.authorization || req.headers.Authorization;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Blog-Editor-Proxy-Vercel",
  };
  if (clientAuth) {
    headers.Authorization = clientAuth;
  }

  const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
  try {
    const resp = await fetch(targetUrl, { method: "GET", headers });
    const text = await resp.text();
    res.setHeader("Content-Type", resp.headers.get("Content-Type") || "application/json");
    return res.status(resp.status).send(text);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch from GitHub API" });
  }
}

async function handlePost(req: any, res: any) {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { path, method, headers = {}, body: reqBody } = body || {};

  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing 'path' field in request body" });
  }

  const httpMethod = (method || "POST").toUpperCase();

  const reqHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Blog-Editor-Proxy-Vercel",
  };

  // 透传客户端 Authorization
  const hasClientAuth = headers.Authorization || headers.authorization;
  if (hasClientAuth) {
    reqHeaders.Authorization = hasClientAuth;
  }

  // 添加其他客户端头
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length") continue;
    if (typeof value === "string") {
      reqHeaders[key] = value;
    }
  }

  const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
  const fetchOpts: RequestInit = {
    method: httpMethod,
    headers: reqHeaders,
  };

  if (reqBody !== undefined && httpMethod !== "GET") {
    reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
    fetchOpts.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
  }

  try {
    const resp = await fetch(targetUrl, fetchOpts);
    const text = await resp.text();
    res.setHeader("Content-Type", resp.headers.get("Content-Type") || "application/json");
    return res.status(resp.status).send(text);
  } catch (err) {
    return res.status(500).json({ error: "Failed to proxy request to GitHub API" });
  }
}
