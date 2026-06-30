/**
 * 在线编辑模式 - 核心工具库
 * 使用服务端代理进行 GitHub API 认证：
 * 1. 私钥和 App ID 存储在服务器环境变量（Vercel/Cloudflare）
 * 2. 所有 GitHub API 请求通过 /api/github 代理转发
 * 3. 代理服务器自动处理 JWT 签名和安装令牌刷新
 */

import { repoConfig } from "@/config/editConfig";

const PROXY_URL = "/api/github";

let proxyConfigured: boolean | null = null;

export async function checkProxyConfigured(): Promise<boolean> {
	if (proxyConfigured !== null) return proxyConfigured;
	try {
		const resp = await fetch(PROXY_URL, { method: "GET" });
		const data = await resp.json();
		proxyConfigured = data.configured === true;
		return proxyConfigured;
	} catch {
		proxyConfigured = false;
		return false;
	}
}

export function invalidateProxyCheck(): void {
	proxyConfigured = null;
}

// ============ 兼容旧的凭据管理 API（不再需要本地存储） ============

export function getStoredAppId(): string {
	return "";
}

export function setStoredAppId(_appId: string): void {
	// no-op: 凭据已在服务端配置
}

export function getStoredPrivateKey(): string {
	return "";
}

export function setStoredPrivateKey(_pem: string): void {
	// no-op: 凭据已在服务端配置
}

export function clearStoredCredentials(): void {
	invalidateProxyCheck();
}

export function hasValidCredentials(): boolean {
	return proxyConfigured === true || !!getClientKey();
}

export function hasValidToken(): boolean {
	return proxyConfigured === true || !!getClientKey();
}

export function getStoredToken(): string {
	return "";
}

export function setStoredToken(_token: string): void {
	// no-op
}

export function clearStoredToken(): void {
	invalidateProxyCheck();
}

export async function validateCredentials(_appId?: string, _pem?: string): Promise<{ ok: boolean; error?: string }> {
	const ok = await checkProxyConfigured();
	if (ok) return { ok: true };
	return {
		ok: false,
		error: "后端 GitHub 代理未配置，请在部署平台设置 GH_APP_ID 和 GH_PRIVATE_KEY 环境变量",
	};
}

// ============ 代理请求封装 ============

async function proxyRequest(
	method: string,
	apiPath: string,
	body?: unknown,
): Promise<Response> {
	const resp = await fetch(PROXY_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: apiPath, method, body }),
	});
	return resp;
}

export async function githubApi(
	method: string,
	apiPath: string,
	body?: unknown,
): Promise<Response> {
	if (getClientKey()) {
		return clientGithubApi(method, apiPath, body);
	}
	return proxyRequest(method, apiPath, body);
}

// ============ 文件读取工具 ============

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

// ============ Gist API 封装 ============

export async function readGistFile(
	gistId: string,
	fileName: string,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("GET", `gists/${gistId}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		const file = data.files?.[fileName];
		return file?.content || null;
	} catch {
		return null;
	}
}

export async function writeGistFile(
	gistId: string,
	fileName: string,
	content: string,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("PATCH", `gists/${gistId}`, {
			files: { [fileName]: { content } },
		});
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
		return false;
	}
}

export async function createGist(
	description: string,
	fileName: string,
	content: string,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("POST", "gists", {
			description,
			public: false,
			files: { [fileName]: { content } },
		});
		if (!resp.ok) return null;
		const data = await resp.json();
		return data.id || null;
	} catch {
		return null;
	}
}

// ============ GitHub Repo 文件操作 ============

export interface RepoConfig {
	owner: string;
	repo: string;
	branch: string;
}

function repoPath(config: RepoConfig, path: string): string {
	return `repos/${config.owner}/${config.repo}/contents/${path}`;
}

export async function getRepoFile(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<{ content: string; sha: string } | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
		return { content, sha: data.sha };
	} catch {
		return null;
	}
}

export async function updateRepoFile(
	path: string,
	content: string,
	sha: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: encodedContent,
			sha,
			branch: config.branch,
		});
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
		return false;
	}
}

export async function createRepoFile(
	path: string,
	content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: encodedContent,
			branch: config.branch,
		});
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
		return false;
	}
}

/** 创建仓库文件，内容已经是 base64 编码（用于二进制文件如图片） */
export async function createRepoFileRawBase64(
	path: string,
	base64Content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: base64Content,
			branch: config.branch,
		});
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
		return false;
	}
}

export async function deleteRepoFile(
	path: string,
	sha: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("DELETE", repoPath(config, path), {
			message,
			sha,
			branch: config.branch,
		});
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
		return false;
	}
}

/** 获取仓库文件元信息（SHA、大小），不解码内容，适合二进制文件 */
export async function getRepoFileMeta(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<{ sha: string; size: number } | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		return { sha: data.sha, size: data.size || 0 };
	} catch {
		return null;
	}
}

/** 批量获取目录中所有文件的元信息 */
export async function listRepoFiles(
	dirPath: string,
	config: RepoConfig = repoConfig,
): Promise<Array<{ name: string; path: string; sha: string; size: number }>> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, dirPath)}?ref=${config.branch}`);
		if (!resp.ok) return [];
		const items = await resp.json();
		if (!Array.isArray(items)) return [];
		return items
			.filter((i: any) => i.type === "file")
			.map((i: any) => ({ name: i.name, path: i.path, sha: i.sha, size: i.size || 0 }));
	} catch {
		return [];
	}
}

/** 获取文件原始 base64 内容（不解码，适合二进制文件如图片） */
export async function getRepoFileBase64(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		return data.content?.replace(/\n/g, "") || null;
	} catch {
		return null;
	}
}

// ============ 图片上传（Base64 通过 Contents API） ============

export async function uploadImageToRepo(
	imagePath: string,
	base64Content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<string | null> {
	try {
		const existing = await getRepoFile(imagePath, config);
		let resp;
		if (existing) {
			resp = await proxyRequest("PUT", repoPath(config, imagePath), {
				message,
				content: base64Content,
				sha: existing.sha,
				branch: config.branch,
			});
		} else {
			resp = await proxyRequest("PUT", repoPath(config, imagePath), {
				message,
				content: base64Content,
				branch: config.branch,
			});
		}
		if (!resp.ok) {
			invalidateProxyCheck();
			const text = await resp.text().catch(() => "");
			throw new Error(`上传失败 (${resp.status}): ${text}`);
		}
		return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${imagePath}`;
	} catch (e) {
		console.error("图片上传失败:", e);
		return null;
	}
}

export async function validateToken(_token?: string): Promise<boolean> {
	return checkProxyConfigured();
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

export function genId(prefix: string = "id"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureIconify(): void {
	if (typeof window === "undefined") return;
	if ((window as any)._iconifyLoaded) return;
	(window as any)._iconifyLoaded = true;
	const script = document.createElement("script");
	script.src = "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js";
	script.async = true;
	document.head.appendChild(script);
}

// ============ 草稿管理（localStorage） ============

const DRAFT_PREFIX = "blog-draft:";
const DRAFT_INDEX_KEY = "blog-draft-index";

export interface DraftMeta {
	pageName: string;
	key: string;
	timestamp: number;
	preview?: string;
}

export function saveDraft(key: string, pageName: string, data: unknown, preview?: string): void {
	const draftKey = `${DRAFT_PREFIX}${key}`;
	localStorage.setItem(draftKey, JSON.stringify(data));
	const index = getDraftIndex();
	const existing = index.findIndex((d) => d.key === key);
	const meta: DraftMeta = { pageName, key, timestamp: Date.now(), preview };
	if (existing >= 0) index[existing] = meta;
	else index.push(meta);
	localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
}

export function getDraft<T = unknown>(key: string): T | null {
	try {
		const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

export function deleteDraft(key: string): void {
	localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
	const index = getDraftIndex();
	const filtered = index.filter((d) => d.key !== key);
	localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(filtered));
}

export function clearAllDrafts(): void {
	const index = getDraftIndex();
	for (const d of index) {
		localStorage.removeItem(`${DRAFT_PREFIX}${d.key}`);
	}
	localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify([]));
}

export function getDraftIndex(): DraftMeta[] {
	try {
		const raw = localStorage.getItem(DRAFT_INDEX_KEY);
		return raw ? (JSON.parse(raw) as DraftMeta[]) : [];
	} catch {
		return [];
	}
}

export function hasAnyDrafts(): boolean {
	return getDraftIndex().length > 0;
}

// 监听 storage 变化，保持草稿状态同步
let _draftListenerAdded = false;
export function onDraftsChanged(cb: () => void): void {
	if (typeof window === "undefined" || _draftListenerAdded) return;
	_draftListenerAdded = true;
	window.addEventListener("storage", (e) => {
		if (e.key?.startsWith(DRAFT_PREFIX) || e.key === DRAFT_INDEX_KEY) cb();
	});
}

// ============ 客户端密钥管理（.pem 导入） ============

let _clientPem: string | null = null;
let _clientAppId: string | null = null;

export function storeClientKey(pem: string): void {
	_clientPem = pem;
	try { sessionStorage.setItem("blog-pem-key", pem); } catch {}
}

export function getClientKey(): string | null {
	if (_clientPem) return _clientPem;
	try {
		const stored = sessionStorage.getItem("blog-pem-key");
		if (stored) { _clientPem = stored; return stored; }
	} catch {}
	return null;
}

export function getClientAppId(): string {
	if (_clientAppId) return _clientAppId;
	try {
		const stored = sessionStorage.getItem("blog-app-id");
		if (stored) { _clientAppId = stored; return stored; }
	} catch {}
	const envId = (import.meta as any).env?.PUBLIC_GITHUB_APP_ID;
	if (envId) { _clientAppId = envId; return envId; }
	return "";
}

export function storeClientAppId(id: string): void {
	_clientAppId = id;
	try { sessionStorage.setItem("blog-app-id", id); } catch {}
}

export function hasClientAuth(): boolean {
	return !!getClientKey() && !!getClientAppId();
}

export async function importPemFile(file: File): Promise<boolean> {
	try {
		const text = await readFileAsText(file);
		if (!text.includes("PRIVATE KEY")) {
			showToast("无效的私钥文件，请选择 .pem 格式文件", "error");
			return false;
		}
		storeClientKey(text);
		const appId = getClientAppId();
		if (appId) {
			showToast(`密钥已导入，App ID: ${appId}`, "success");
		} else {
			showToast("密钥已导入，但未找到 PUBLIC_GITHUB_APP_ID 环境变量", "warning");
		}
		return true;
	} catch {
		showToast("读取密钥文件失败", "error");
		return false;
	}
}

// ============ 客户端 GitHub API（浏览器直接调用） ============

let _clientInstallToken: string | null = null;
let _clientTokenExpiry = 0;

function _b64url(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let bin = "";
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function _b64ToBuf(b64: string): Uint8Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

function _derLen(len: number): Uint8Array {
	if (len < 128) return new Uint8Array([len]);
	const bytes: number[] = [];
	let temp = len;
	while (temp > 0) { bytes.unshift(temp & 0xff); temp >>= 8; }
	return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function _concatBufs(...arrays: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const a of arrays) total += a.length;
	const result = new Uint8Array(total);
	let offset = 0;
	for (const a of arrays) { result.set(a, offset); offset += a.length; }
	return result;
}

function _derSeq(...parts: Uint8Array[]): Uint8Array {
	const body = _concatBufs(...parts);
	return _concatBufs(new Uint8Array([0x30]), _derLen(body.length), body);
}

function _derInt(val: number): Uint8Array {
	const bytes: number[] = [];
	let v = val;
	if (v === 0) bytes.push(0);
	else { while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; } if (bytes[0] & 0x80) bytes.unshift(0); }
	return _concatBufs(new Uint8Array([0x02]), _derLen(bytes.length), new Uint8Array(bytes));
}

function _derOctetStr(data: Uint8Array): Uint8Array {
	return _concatBufs(new Uint8Array([0x04]), _derLen(data.length), data);
}

function _derOid(oidStr: string): Uint8Array {
	const parts = oidStr.split(".").map(Number);
	const bytes = [40 * parts[0] + parts[1]];
	for (let i = 2; i < parts.length; i++) {
		let v = parts[i];
		if (v < 128) bytes.push(v);
		else {
			const enc: number[] = [];
			enc.unshift(v & 0x7f); v >>= 7;
			while (v > 0) { enc.unshift(0x80 | (v & 0x7f)); v >>= 7; }
			bytes.push(...enc);
		}
	}
	return _concatBufs(new Uint8Array([0x06]), _derLen(bytes.length), new Uint8Array(bytes));
}

function _pkcs1ToPkcs8(pkcs1Der: Uint8Array): Uint8Array {
	const algId = _derSeq(_derOid("1.2.840.113549.1.1.1"), new Uint8Array([0x05, 0x00]));
	return _derSeq(_derInt(0), algId, _derOctetStr(pkcs1Der));
}

function _pemToDer(pem: string): Uint8Array {
	const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
	const base64 = pem.replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----/, "")
		.replace(/-----END [A-Z ]+PRIVATE KEY-----/, "").replace(/\s+/g, "");
	const der = _b64ToBuf(base64);
	return isPkcs1 ? _pkcs1ToPkcs8(der) : der;
}

async function _clientSignJwt(appId: string, pem: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = { iat: now - 60, exp: now + 8 * 60, iss: String(appId) };
	const enc = (obj: unknown) => _b64url(new TextEncoder().encode(JSON.stringify(obj)));
	const signingInput = `${enc(header)}.${enc(payload)}`;
	const der = _pemToDer(pem);
	const key = await crypto.subtle.importKey("pkcs8", der.buffer as ArrayBuffer,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
	const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key,
		new TextEncoder().encode(signingInput));
	return `${signingInput}.${_b64url(sig)}`;
}

async function _getClientInstallToken(): Promise<string> {
	if (_clientInstallToken && Date.now() < _clientTokenExpiry) return _clientInstallToken;
	const pem = getClientKey();
	const appId = getClientAppId();
	if (!pem || !appId) throw new Error("客户端密钥未配置，请先导入 .pem 文件");
	const jwt = await _clientSignJwt(appId, pem);
	const { owner, repo } = repoConfig;
	const instResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
		headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Blog-Editor" },
	});
	if (!instResp.ok) throw new Error(`获取安装 ID 失败 (${instResp.status})`);
	const instData = await instResp.json();
	const tokenResp = await fetch(
		`https://api.github.com/app/installations/${instData.id}/access_tokens`,
		{ method: "POST", headers: { Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor" } },
	);
	if (!tokenResp.ok) throw new Error(`获取令牌失败 (${tokenResp.status})`);
	const tokenData = await tokenResp.json();
	_clientInstallToken = tokenData.token as string;
	_clientTokenExpiry = new Date(tokenData.expires_at).getTime() - 60000;
	return _clientInstallToken!;
}

async function clientGithubApi(method: string, apiPath: string, body?: unknown): Promise<Response> {
	try {
		const token = await _getClientInstallToken();
		const url = apiPath.startsWith("http") ? apiPath : `https://api.github.com/${apiPath.replace(/^\//, "")}`;
		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Blog-Editor",
		};
		const opts: RequestInit = { method, headers };
		if (body !== undefined && method !== "GET") {
			headers["Content-Type"] = "application/json";
			opts.body = typeof body === "string" ? body : JSON.stringify(body);
		}
		const resp = await fetch(url, opts);
		if (!resp.ok && (resp.status === 401 || resp.status === 403)) {
			_clientInstallToken = null; _clientTokenExpiry = 0;
		}
		return resp;
	} catch (e: unknown) {
		_clientInstallToken = null; _clientTokenExpiry = 0;
		throw e;
	}
}
