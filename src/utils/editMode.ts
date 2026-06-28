/**
 * 在线编辑模式 - 核心工具库
 * 严格参考 RyuChan 设计模式：
 * 1. 先编辑（内存中暂存变更），后导入密钥保存
 * 2. 导入密钥按钮直接触发文件选择框
 * 3. 支持 GitHub PAT Token（简单模式）
 * 4. 卡片就地编辑（inline edit），非模态框
 * 5. 原始数据快照用于取消回滚
 */

const TOKEN_KEY = "gh_edit_token";

// ============ Token 管理 ============

export function getStoredToken(): string {
	try {
		return localStorage.getItem(TOKEN_KEY) || "";
	} catch {
		return "";
	}
}

export function setStoredToken(token: string): void {
	try {
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		// ignore
	}
}

export function clearStoredToken(): void {
	try {
		localStorage.removeItem(TOKEN_KEY);
	} catch {
		// ignore
	}
}

export function hasValidToken(): boolean {
	return !!getStoredToken();
}

/**
 * 验证 GitHub Token 是否有效
 */
export async function validateToken(token: string): Promise<boolean> {
	try {
		const resp = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		return resp.ok;
	} catch {
		return false;
	}
}

/**
 * 从文件读取文本内容（用于导入密钥文件）
 */
export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

// ============ Gist API 封装 ============

/**
 * 读取 Gist 文件内容
 */
export async function readGistFile(
	gistId: string,
	fileName: string,
	token?: string,
): Promise<string | null> {
	const authToken = token || getStoredToken();
	try {
		const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
			headers: authToken
				? {
						Authorization: `Bearer ${authToken}`,
						Accept: "application/vnd.github+json",
					}
				: { Accept: "application/vnd.github+json" },
		});
		if (!resp.ok) return null;
		const data = await resp.json();
		const file = data.files?.[fileName];
		return file?.content || null;
	} catch {
		return null;
	}
}

/**
 * 写入 Gist 文件内容
 */
export async function writeGistFile(
	gistId: string,
	fileName: string,
	content: string,
	token?: string,
): Promise<boolean> {
	const authToken = token || getStoredToken();
	if (!authToken) return false;
	try {
		const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${authToken}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({
				files: {
					[fileName]: { content },
				},
			}),
		});
		return resp.ok;
	} catch {
		return false;
	}
}

/**
 * 创建新的 Secret Gist
 */
export async function createGist(
	description: string,
	fileName: string,
	content: string,
	token?: string,
): Promise<string | null> {
	const authToken = token || getStoredToken();
	if (!authToken) return null;
	try {
		const resp = await fetch("https://api.github.com/gists", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				Accept: "application/vnd.github+json",
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({
				description,
				public: false,
				files: {
					[fileName]: { content },
				},
			}),
		});
		if (!resp.ok) return null;
		const data = await resp.json();
		return data.id || null;
	} catch {
		return null;
	}
}

// ============ GitHub Repo 文件操作（用于站点配置/导航/文章等） ============

export interface RepoConfig {
	owner: string;
	repo: string;
	branch: string;
}

/**
 * 获取仓库文件内容（通过 GitHub API）
 */
export async function getRepoFile(
	path: string,
	config: RepoConfig,
	token?: string,
): Promise<{ content: string; sha: string } | null> {
	const authToken = token || getStoredToken();
	try {
		const resp = await fetch(
			`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`,
			{
				headers: authToken
					? {
							Authorization: `Bearer ${authToken}`,
							Accept: "application/vnd.github+json",
							"X-GitHub-Api-Version": "2022-11-28",
						}
					: { Accept: "application/vnd.github+json" },
			},
		);
		if (!resp.ok) return null;
		const data = await resp.json();
		// content is base64 encoded
		const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
		return { content, sha: data.sha };
	} catch {
		return null;
	}
}

/**
 * 更新仓库文件（通过 GitHub API）
 */
export async function updateRepoFile(
	path: string,
	content: string,
	sha: string,
	message: string,
	config: RepoConfig,
	token?: string,
): Promise<boolean> {
	const authToken = token || getStoredToken();
	if (!authToken) return false;
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await fetch(
			`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					Accept: "application/vnd.github+json",
					"Content-Type": "application/json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				body: JSON.stringify({
					message,
					content: encodedContent,
					sha,
					branch: config.branch,
				}),
			},
		);
		return resp.ok;
	} catch {
		return false;
	}
}

/**
 * 创建仓库文件（通过 GitHub API）
 */
export async function createRepoFile(
	path: string,
	content: string,
	message: string,
	config: RepoConfig,
	token?: string,
): Promise<boolean> {
	const authToken = token || getStoredToken();
	if (!authToken) return false;
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await fetch(
			`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					Accept: "application/vnd.github+json",
					"Content-Type": "application/json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				body: JSON.stringify({
					message,
					content: encodedContent,
					branch: config.branch,
				}),
			},
		);
		return resp.ok;
	} catch {
		return false;
	}
}

// ============ Toast 通知 ============

export function showToast(
	message: string,
	type: "success" | "error" | "info" | "warning" = "info",
) {
	if (typeof window === "undefined") return;
	const event = new CustomEvent("edit-mode:toast", {
		detail: { message, type },
	});
	window.dispatchEvent(event);
}

// ============ 深拷贝工具 ============

export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * 生成唯一ID
 */
export function genId(prefix: string = "id"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 确保 Iconify 脚本已加载
 */
export function ensureIconify(): void {
	if (typeof window === "undefined") return;
	if ((window as any)._iconifyLoaded) return;
	(window as any)._iconifyLoaded = true;
	const script = document.createElement("script");
	script.src = "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js";
	script.async = true;
	document.head.appendChild(script);
}
