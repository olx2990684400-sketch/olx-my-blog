<script lang="ts">
	import { onMount, createEventDispatcher, tick } from "svelte";
	const dispatch = createEventDispatcher();
	import {
		getStoredAppId,
		setStoredAppId,
		getStoredPrivateKey,
		setStoredPrivateKey,
		clearStoredCredentials,
		hasValidCredentials,
		validateCredentials,
		readFileAsText,
		showToast,
		ensureIconify,
		invalidateToken,
	} from "@/utils/editMode";

	let {
		pageName,
		saving,
		hasChanges,
		showAddButton = true,
		startInEditMode = false,
		persistentEdit = false,
		mountTo,
	}: {
		pageName: string;
		saving: boolean;
		hasChanges: boolean;
		showAddButton?: boolean;
		startInEditMode?: boolean;
		persistentEdit?: boolean;
		mountTo?: string;
	} = $props();

	let editMode = $state(false);
	let authed = $state(false);
	let validating = $state(false);
	let showKeyModal = $state(false);
	let showHelpModal = $state(false);
	let toolbarRootEl = $state<HTMLDivElement>();
	let mountedExternally = false;
	let hiddenWrapper: HTMLElement | null = null;
	let mountTarget: Element | null = null;

	let appIdInput = $state("");
	let selectedFileName = $state("");
	let pendingKeyPem = $state("");
	let fileInputEl = $state<HTMLInputElement>();

	onMount(async () => {
		ensureIconify();
		appIdInput = getStoredAppId();
		authed = hasValidCredentials();
		if (startInEditMode) {
			editMode = true;
		}
		if (mountTo) {
			mountTarget = document.querySelector(mountTo);
			await tick();
			moveToolbar();
		}
		return () => {
			if (hiddenWrapper) {
				hiddenWrapper.style.display = "";
			}
		};
	});

	function moveToolbar() {
		if (mountTo && toolbarRootEl && mountTarget && !mountedExternally) {
			const wrapper = toolbarRootEl.parentElement;
			if (wrapper && wrapper !== mountTarget) {
				hiddenWrapper = wrapper as HTMLElement;
				hiddenWrapper.style.display = "none";
			}
			const firstChild = mountTarget.firstChild;
			if (firstChild) {
				mountTarget.insertBefore(toolbarRootEl, firstChild);
			} else {
				mountTarget.appendChild(toolbarRootEl);
			}
			mountedExternally = true;
		}
	}

	$effect(() => {
		if (mountTo && toolbarRootEl && mountTarget) {
			tick().then(moveToolbar);
		}
	});

	function enterEdit() {
		editMode = true;
		dispatch("modeChange", { editing: true });
	}

	function cancelEdit() {
		if (hasChanges && !confirm("你有未保存的更改，确定要取消吗？所有修改将丢失。")) {
			return;
		}
		if (!persistentEdit) {
			editMode = false;
			dispatch("modeChange", { editing: false });
		}
		dispatch("cancel");
	}

	function handleAdd() {
		dispatch("add");
	}

	function openKeyModal() {
		appIdInput = getStoredAppId();
		pendingKeyPem = "";
		selectedFileName = "";
		showKeyModal = true;
	}

	function closeKeyModal() {
		showKeyModal = false;
		pendingKeyPem = "";
		selectedFileName = "";
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		selectedFileName = file.name;
		try {
			pendingKeyPem = await readFileAsText(file);
		} catch {
			showToast("读取文件失败", "error");
			pendingKeyPem = "";
			selectedFileName = "";
		}
	}

	function triggerFilePick() {
		fileInputEl?.click();
	}

	async function handleImportKey() {
		if (!appIdInput.trim()) {
			showToast("请填写 GitHub App ID", "error");
			return;
		}
		if (!pendingKeyPem && !getStoredPrivateKey()) {
			showToast("请选择 .pem 私钥文件", "error");
			return;
		}
		const pemToUse = pendingKeyPem || getStoredPrivateKey();
		validating = true;
		const result = await validateCredentials(appIdInput.trim(), pemToUse);
		validating = false;
		if (result.ok) {
			setStoredAppId(appIdInput.trim());
			if (pendingKeyPem) setStoredPrivateKey(pemToUse);
			authed = true;
			showKeyModal = false;
			pendingKeyPem = "";
			selectedFileName = "";
			showToast("私钥验证成功，可以开始编辑", "success");
			dispatch("authChange", { authed: true });
		} else {
			showToast(result.error || "验证失败", "error");
		}
	}

	function handleLogout() {
		if (!confirm("确定要清除已保存的私钥吗？清除后需要重新导入才能编辑。")) return;
		clearStoredCredentials();
		invalidateToken();
		authed = false;
		appIdInput = "";
		showToast("已清除私钥", "info");
		dispatch("authChange", { authed: false });
	}

	async function handleSave() {
		if (!authed) {
			showToast("请先导入 GitHub App 私钥", "warning");
			openKeyModal();
			return;
		}
		dispatch("save");
	}
</script>

<div class="edit-toolbar" bind:this={toolbarRootEl} class:edit-toolbar--mounted={mountedExternally} class:edit-mode-toolbar={editMode}>
	{#if !editMode}
		<button class="edit-main-btn" onclick={enterEdit} title={`编辑${pageName}`}>
			<iconify-icon icon="material-symbols:edit-rounded" class="text-base"></iconify-icon>
			编辑{pageName}
		</button>
	{:else}
		<button class="edit-btn edit-btn-cancel" onclick={cancelEdit} title={persistentEdit ? "重置更改" : "取消编辑"}>
			<iconify-icon icon={persistentEdit ? "material-symbols:undo-rounded" : "material-symbols:close-rounded"} class="text-sm"></iconify-icon>
			{persistentEdit ? "重置" : "取消"}
		</button>
		{#if authed}
			<button class="edit-btn edit-btn-key edit-btn-key-ok" onclick={openKeyModal} title="已导入私钥，点击管理">
				<iconify-icon icon="material-symbols:vpn-key-rounded" class="text-sm"></iconify-icon>
				已认证
			</button>
		{:else}
			<button class="edit-btn edit-btn-key edit-btn-key-err" onclick={openKeyModal} title="点击导入 GitHub App 私钥">
				<iconify-icon icon="material-symbols:key-rounded" class="text-sm"></iconify-icon>
				导入密钥
			</button>
		{/if}
		<button class="edit-btn edit-btn-help" onclick={() => (showHelpModal = true)} title="使用帮助">
			<iconify-icon icon="material-symbols:help-outline-rounded" class="text-sm"></iconify-icon>
		</button>
		{#if showAddButton !== false}
			<button class="edit-btn edit-btn-add" onclick={handleAdd}>
				<iconify-icon icon="material-symbols:add-rounded" class="text-base"></iconify-icon>
				添加
			</button>
		{/if}
		<button
			class="edit-btn edit-btn-save"
			onclick={handleSave}
			disabled={saving}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-base animate-spin"></iconify-icon>
				保存中...
			{:else}
				<iconify-icon icon="material-symbols:save-rounded" class="text-base"></iconify-icon>
				保存
			{/if}
		</button>
	{/if}
</div>

<!-- 密钥导入弹窗 -->
{#if showKeyModal}
	<div class="modal-overlay" onclick={closeKeyModal}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:key-rounded" class="text-lg mr-2"></iconify-icon>
					GitHub App 私钥认证
				</h3>
				<button class="modal-close" onclick={closeKeyModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body">
				<p class="modal-desc">
					导入你的 GitHub App 私钥文件（.pem）并填写 App ID，即可在浏览器内安全地编辑和发布内容。
					私钥仅存储在本地浏览器中，不会上传到服务器。
				</p>

				<div class="form-group">
					<label>GitHub App ID</label>
					<input
						type="text"
						bind:value={appIdInput}
						placeholder="输入 App ID（纯数字）"
						class="form-input"
					/>
				</div>

				<div class="form-group">
					<label>私钥文件 (.pem)</label>
					<div class="file-pick-area">
						<button class="file-pick-btn" onclick={triggerFilePick} type="button">
							<iconify-icon icon="material-symbols:upload-file-rounded" class="text-base mr-1"></iconify-icon>
							选择文件
						</button>
						<span class="file-name">
							{#if selectedFileName}
								<iconify-icon icon="material-symbols:check-circle-rounded" style="color:#22c55e" class="mr-1"></iconify-icon>
								{selectedFileName}
							{:else if getStoredPrivateKey()}
								<iconify-icon icon="material-symbols:check-circle-rounded" style="color:#22c55e" class="mr-1"></iconify-icon>
								已保存私钥（可重新选择覆盖）
							{:else}
								未选择文件
							{/if}
						</span>
						<input
							type="file"
							accept=".pem,application/x-pem-file,text/plain"
							bind:this={fileInputEl}
							onchange={handleFileSelect}
							style="display:none"
						/>
					</div>
				</div>

				{#if authed}
				<div class="auth-status auth-ok">
					<iconify-icon icon="material-symbols:check-circle-rounded" class="mr-1"></iconify-icon>
					当前已认证，可直接保存内容。
					<button class="logout-link" onclick={handleLogout}>清除私钥</button>
				</div>
				{/if}

				<div class="form-hint">
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-sm mr-1"></iconify-icon>
					在 GitHub App 设置页面 → "Private keys" → "Generate a private key" 下载 .pem 文件。
				</div>
			</div>
			<div class="modal-footer">
				<button class="modal-btn modal-btn-cancel" onclick={closeKeyModal}>取消</button>
				<button class="modal-btn modal-btn-ok" onclick={handleImportKey} disabled={validating}>
					{#if validating}
						<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-sm animate-spin mr-1"></iconify-icon>
						验证中...
					{:else}
						<iconify-icon icon="material-symbols:check-rounded" class="text-sm mr-1"></iconify-icon>
						{authed ? "更新密钥" : "导入并验证"}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 使用帮助弹窗 -->
{#if showHelpModal}
	<div class="modal-overlay" onclick={() => (showHelpModal = false)}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:help-outline-rounded" class="text-lg mr-2"></iconify-icon>
					在线编辑使用帮助
				</h3>
				<button class="modal-close" onclick={() => (showHelpModal = false)}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body help-body">
				<h4>🔑 认证方式</h4>
				<p>本系统使用 <strong>GitHub App 私钥认证</strong>，在浏览器端完成签名，私钥仅保存在本地浏览器：</p>
				<ol>
					<li>在 GitHub 上创建一个 GitHub App，并安装到你的博客仓库</li>
					<li>为 App 授予仓库 Contents 读写权限</li>
					<li>在 App 设置页生成并下载私钥文件（.pem）</li>
					<li>点击工具栏 <strong>"导入密钥"</strong> 按钮，填写 App ID 并选择 .pem 文件</li>
					<li>验证成功后即可编辑、保存、上传图片</li>
				</ol>

				<h4>📝 可编辑内容</h4>
				<ul>
					<li>文章管理：<code>/write</code> 页面编写和发布文章</li>
					<li>更新日志：changelog 页面编辑更新记录</li>
					<li>生活记录：日程、足迹、笔记本</li>
					<li>友链管理、收藏、动态、赞助、番剧、站点配置等</li>
				</ul>

				<h4>🔒 安全说明</h4>
				<p>私钥文件不会上传到博客服务器，仅存储在你当前浏览器的 localStorage 中。清除浏览器数据或点击"清除私钥"后需要重新导入。由于通过服务端 CORS 代理访问 GitHub API，代理服务器只做请求转发，无法读取或篡改你的认证凭据。</p>

				<h4>🌐 代理说明</h4>
				<p><code>/api/github</code> 是纯 CORS 透传代理，不需要在 Vercel/Cloudflare 配置任何 GH_* 环境变量。所有认证头由浏览器端生成。</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.edit-toolbar {
		display: inline-flex;
		justify-content: flex-start;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
		vertical-align: middle;
	}

	.edit-toolbar--mounted {
		margin-bottom: 0;
	}

	.edit-main-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.9);
		background: transparent;
		color: rgba(0, 0, 0, 0.9);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
		white-space: nowrap;
		line-height: 1.5;
		height: auto;
	}
	.edit-main-btn:hover {
		background: rgba(0, 0, 0, 0.9);
		color: white;
	}
	:global(.dark) .edit-main-btn {
		border-color: rgba(255, 255, 255, 0.9);
		color: rgba(255, 255, 255, 0.9);
	}
	:global(.dark) .edit-main-btn:hover {
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.edit-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 14px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		background: transparent;
		white-space: nowrap;
	}

	.edit-btn-cancel {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-cancel:hover {
		border-color: rgba(0, 0, 0, 0.9);
		color: white;
		background: rgba(0, 0, 0, 0.9);
	}
	:global(.dark) .edit-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-cancel:hover {
		border-color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.edit-btn-key {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-key:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 45%);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	.edit-btn-key-ok {
		border-color: #22c55e !important;
		color: #16a34a !important;
		background: rgba(34, 197, 94, 0.1) !important;
	}
	.edit-btn-key-err {
		border-color: #f59e0b !important;
		color: #d97706 !important;
		background: rgba(245, 158, 11, 0.12) !important;
	}
	:global(.dark) .edit-btn-key {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-key:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	:global(.dark) .edit-btn-key-ok {
		border-color: #4ade80 !important;
		color: #4ade80 !important;
		background: rgba(74, 222, 128, 0.15) !important;
	}
	:global(.dark) .edit-btn-key-err {
		border-color: #fbbf24 !important;
		color: #fbbf24 !important;
		background: rgba(251, 191, 36, 0.15) !important;
	}

	.edit-btn-help {
		border-color: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.5);
		padding: 7px 10px;
	}
	.edit-btn-help:hover {
		border-color: rgba(0, 0, 0, 0.3);
		color: rgba(0, 0, 0, 0.8);
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .edit-btn-help {
		border-color: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.5);
	}
	:global(.dark) .edit-btn-help:hover {
		border-color: rgba(255, 255, 255, 0.3);
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.08);
	}

	.edit-btn-add {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-add:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 45%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .edit-btn-add {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-add:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}

	.edit-btn-save {
		border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-weight: 600;
	}
	.edit-btn-save:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.edit-btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ====== 模态弹窗 ====== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 9998;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-card {
		background: #ffffff;
		border-radius: 16px;
		width: 100%;
		max-width: 500px;
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.25s ease;
		border: 1px solid rgba(0, 0, 0, 0.08);
		color: #1a1a2e;
	}
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .modal-card {
		background: #1e1e32;
		border-color: rgba(255, 255, 255, 0.1);
		color: #f0f0f0;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 22px 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
		display: flex;
		align-items: center;
	}
	.modal-close {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		transition: all 0.15s;
		font-size: 14px;
	}
	.modal-close:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #333;
	}
	:global(.dark) .modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.modal-body {
		padding: 18px 22px;
		font-size: 14px;
		line-height: 1.65;
		color: #444;
	}
	:global(.dark) .modal-body {
		color: #c0c0d0;
	}
	.modal-desc {
		margin: 0 0 18px;
		padding: 12px 14px;
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.08);
		border-radius: 10px;
		color: hsl(var(--theme-hue, 165), 70%, 35%);
		font-size: 13px;
		border-left: 3px solid hsl(var(--theme-hue, 165), 70%, 50%);
	}
	:global(.dark) .modal-desc {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.12);
	}

	.form-group {
		margin-bottom: 16px;
	}
	.form-group label {
		display: block;
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 6px;
		color: #222;
	}
	:global(.dark) .form-group label {
		color: #e0e0e0;
	}
	.form-input {
		width: 100%;
		padding: 10px 14px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: #fff;
		font-size: 14px;
		box-sizing: border-box;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		color: #1a1a2e;
	}
	.form-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
	}
	:global(.dark) .form-input {
		background: #2a2a40;
		border-color: rgba(255, 255, 255, 0.12);
		color: #f0f0f0;
	}
	:global(.dark) .form-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.2);
	}

	.file-pick-area {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.file-pick-btn {
		display: inline-flex;
		align-items: center;
		padding: 9px 16px;
		border-radius: 8px;
		border: 1px dashed rgba(0, 0, 0, 0.3);
		background: rgba(0, 0, 0, 0.03);
		color: #333;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}
	.file-pick-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.08);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .file-pick-btn {
		border-color: rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.05);
		color: #ddd;
	}
	:global(.dark) .file-pick-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}
	.file-name {
		font-size: 13px;
		color: #666;
		display: inline-flex;
		align-items: center;
	}
	:global(.dark) .file-name {
		color: #aaa;
	}

	.auth-status {
		padding: 10px 14px;
		border-radius: 8px;
		font-size: 13px;
		margin: 12px 0;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.auth-ok {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		border: 1px solid rgba(34, 197, 94, 0.25);
	}
	:global(.dark) .auth-ok {
		background: rgba(74, 222, 128, 0.1);
		color: #4ade80;
		border-color: rgba(74, 222, 128, 0.2);
	}
	.logout-link {
		margin-left: auto;
		background: none;
		border: none;
		color: #dc2626;
		font-size: 12px;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
	.logout-link:hover { color: #b91c1c; }
	:global(.dark) .logout-link { color: #f87171; }
	:global(.dark) .logout-link:hover { color: #fca5a5; }

	.form-hint {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin-top: 8px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(59, 130, 246, 0.08);
		color: #1e40af;
		font-size: 12px;
		line-height: 1.5;
	}
	:global(.dark) .form-hint {
		background: rgba(96, 165, 250, 0.1);
		color: #93c5fd;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 22px 18px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.06);
	}
	.modal-btn {
		display: inline-flex;
		align-items: center;
		padding: 9px 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid transparent;
	}
	.modal-btn-cancel {
		background: transparent;
		border-color: rgba(0, 0, 0, 0.15);
		color: #555;
	}
	.modal-btn-cancel:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.3);
	}
	:global(.dark) .modal-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: #bbb;
	}
	:global(.dark) .modal-btn-cancel:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.3);
	}
	.modal-btn-ok {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.modal-btn-ok:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.modal-btn-ok:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.help-body h4 {
		margin: 16px 0 8px;
		font-size: 14px;
		font-weight: 700;
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	.help-body h4:first-child { margin-top: 0; }
	:global(.dark) .help-body h4 {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}
	.help-body p { margin: 0 0 8px; }
	.help-body ol, .help-body ul {
		margin: 0 0 12px;
		padding-left: 22px;
	}
	.help-body li { margin-bottom: 4px; font-size: 13px; }
	.help-body code {
		font-family: "SF Mono", "Fira Code", monospace;
		font-size: 12px;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0,0,0,0.06);
		color: #d63384;
	}
	:global(.dark) .help-body code {
		background: rgba(255,255,255,0.08);
		color: #f472b6;
	}
	.help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}
</style>
