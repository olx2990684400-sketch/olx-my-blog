/**
 * GitHub API 代理端点
 * 用于处理前端对 GitHub API 的请求，避免 CORS 问题
 * 支持通过环境变量配置 GitHub App 认证
 */

import { handleGithubProxy } from "../../workers/github-proxy.js";

export const prerender = false; // 确保这是动态路由

export async function POST({ request }: { request: Request }) {
	// Vercel Edge: 通过 process.env 传递环境变量给代理
	const env = {
		GH_APP_ID: (import.meta as any).env?.GH_APP_ID || process.env.GH_APP_ID || "",
		GH_PRIVATE_KEY: (import.meta as any).env?.GH_PRIVATE_KEY || process.env.GH_PRIVATE_KEY || "",
		GH_USER: (import.meta as any).env?.GH_USER || process.env.GH_USER || "",
		GH_REPO: (import.meta as any).env?.GH_REPO || process.env.GH_REPO || "",
	};
	return handleGithubProxy(request, env);
}

export async function GET({ request }: { request: Request }) {
	// Vercel Edge: 通过 process.env 传递环境变量给代理
	const env = {
		GH_APP_ID: (import.meta as any).env?.GH_APP_ID || process.env.GH_APP_ID || "",
		GH_PRIVATE_KEY: (import.meta as any).env?.GH_PRIVATE_KEY || process.env.GH_PRIVATE_KEY || "",
		GH_USER: (import.meta as any).env?.GH_USER || process.env.GH_USER || "",
		GH_REPO: (import.meta as any).env?.GH_REPO || process.env.GH_REPO || "",
	};
	return handleGithubProxy(request, env);
}
