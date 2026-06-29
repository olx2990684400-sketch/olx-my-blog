/**
 * GitHub API CORS 透传代理
 * 解决浏览器直接调用 GitHub API 的跨域问题
 * 所有认证凭据（Authorization header）由前端传入，服务端不存储私钥
 * 同时支持 Cloudflare Workers 和 Vercel Edge Functions
 */

const GH_API = "https://api.github.com";

function corsHeaders(extra = {}) {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
		"Access-Control-Max-Age": "86400",
		...extra,
	};
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...corsHeaders(),
		},
	});
}

/**
 * 处理 GitHub API 代理请求
 * 前端 POST body: { path, method, headers, body }
 * - path: GitHub API 路径（如 "repos/owner/repo/contents/..."）或完整URL
 * - method: HTTP 方法
 * - headers: 包含 Authorization 等请求头
 * - body: 请求体
 */
export async function handleGithubProxy(request) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(),
		});
	}

	if (request.method === "GET") {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		if (!path) {
			return jsonResponse({
				ok: true,
				status: "proxy-ready",
				message: "GitHub API CORS proxy is running. Import your .pem key in the editor to authenticate.",
			});
		}
		return forwardRequest("GET", path, null, {});
	}

	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Invalid JSON body" }, 400);
		}
		const { path, method, headers = {}, body: reqBody } = body;
		if (!path || typeof path !== "string") {
			return jsonResponse({ error: "Missing 'path' field in request body" }, 400);
		}
		const httpMethod = (method || request.method).toUpperCase();
		return forwardRequest(httpMethod, path, reqBody, headers);
	}

	return jsonResponse({ error: "Method not allowed" }, 405);
}

async function forwardRequest(method, path, reqBody, clientHeaders) {
	try {
		const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;

		const headers = {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor-Proxy",
		};

		if (clientHeaders && typeof clientHeaders === "object") {
			for (const [key, value] of Object.entries(clientHeaders)) {
				const lower = key.toLowerCase();
				if (lower === "host" || lower === "content-length") continue;
				if (typeof value === "string") {
					headers[key] = value;
				}
			}
		}

		const fetchOpts = { method, headers };
		if (reqBody !== undefined && method !== "GET") {
			headers["Content-Type"] = headers["Content-Type"] || "application/json";
			fetchOpts.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
		}

		const resp = await fetch(targetUrl, fetchOpts);
		const text = await resp.text();

		const responseHeaders = {
			"Content-Type": resp.headers.get("Content-Type") || "application/json",
			...corsHeaders(),
		};

		return new Response(text, {
			status: resp.status,
			headers: responseHeaders,
		});
	} catch (e) {
		return jsonResponse(
			{ error: "Proxy request failed", message: e?.message || String(e) },
			502,
		);
	}
}
