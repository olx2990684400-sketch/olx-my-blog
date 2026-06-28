<script lang="ts">
  import { onMount, tick } from "svelte";
  import EditToolbar from "./EditToolbar.svelte";
  import EditToast from "./EditToast.svelte";
  import { marked } from "marked";
  import {
    hasValidToken,
    showToast,
    ensureIconify,
    getRepoFile,
    updateRepoFile,
    createRepoFile,
  } from "@/utils/editMode";
  import { repoConfig } from "@/config/editConfig";

  interface ChangelogEntry {
    id: string;
    slug: string;
    element: HTMLElement;
    version: string;
    date: string;
    type: string;
    description: string;
    sha?: string;
    _isNew?: boolean;
    _newMd?: string;
  }

  const typeOptions = [
    { value: "feature", label: "新功能" },
    { value: "improvement", label: "改进" },
    { value: "fix", label: "修复" },
    { value: "removal", label: "移除" },
  ];

  let editMode = $state(false);
  let saving = $state(false);
  let hasChanges = $state(false);
  let entries = $state<ChangelogEntry[]>([]);
  let showAddForm = $state(false);
  let showEditForm = $state(false);
  let editingEntry = $state<ChangelogEntry | null>(null);

  let newVersion = $state("");
  let newType = $state("improvement");
  let newDate = $state(new Date().toISOString().slice(0, 10));
  let newDescription = $state("");
  let newContent = $state("");

  let editRawMd = $state("");

  const injectedClass = "__cl_injected_edit__";

  onMount(() => {
    ensureIconify();
    collectEntries();
  });

  function collectEntries() {
    const timeline = document.getElementById("cl-timeline");
    if (!timeline) return;
    const result: ChangelogEntry[] = [];
    timeline.querySelectorAll<HTMLElement>(".cl-entry").forEach((el) => {
      const slug = el.dataset.slug || "";
      if (!slug) return;
      const type = el.dataset.type || "improvement";
      const version = el.querySelector(".cl-entry-version")?.textContent?.trim() || "";
      const timeEl = el.querySelector("time");
      const date = (timeEl?.getAttribute("datetime") || "").slice(0, 10);
      const description = el.querySelector(".cl-entry-text")?.textContent?.trim() || "";
      result.push({
        id: slug,
        slug,
        element: el,
        version,
        date,
        type,
        description,
      });
    });
    entries = result;
  }

  function injectEditButtons() {
    entries.forEach((entry) => {
      if (entry.element.querySelector(`.${injectedClass}`)) return;
      const wrapper = document.createElement("div");
      wrapper.className = injectedClass;
      wrapper.style.cssText = "position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:10;";
      wrapper.innerHTML = `
        <button class="${injectedClass}-edit" title="编辑" style="width:28px;height:28px;border-radius:6px;border:none;background:var(--card-bg,#fff);color:var(--content-meta);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.15);">
          <iconify-icon icon="material-symbols:edit-rounded" width="16"></iconify-icon>
        </button>
        <button class="${injectedClass}-del" title="删除" style="width:28px;height:28px;border-radius:6px;border:none;background:var(--card-bg,#fff);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.15);">
          <iconify-icon icon="material-symbols:delete-outline-rounded" width="16"></iconify-icon>
        </button>
      `;
      entry.element.style.position = "relative";
      entry.element.appendChild(wrapper);
      wrapper.querySelector<HTMLButtonElement>(`.${injectedClass}-edit`)?.addEventListener("click", () => {
        openEdit(entry);
      });
      wrapper.querySelector<HTMLButtonElement>(`.${injectedClass}-del`)?.addEventListener("click", () => {
        if (confirm(`确定删除「${entry.version}」？（保存后生效）`)) {
          pendingDeletes.push(entry.slug);
          entry.element.style.opacity = "0.4";
          entry.element.style.pointerEvents = "none";
          hasChanges = true;
          showToast("已标记删除，点击保存提交", "info");
        }
      });
    });
  }

  let pendingDeletes = $state<string[]>([]);

  function removeEditButtons() {
    document.querySelectorAll(`.${injectedClass}`).forEach((el) => el.remove());
    entries.forEach((entry) => {
      entry.element.style.opacity = "";
      entry.element.style.pointerEvents = "";
    });
  }

  function enterEditMode() {
    editMode = true;
    tick().then(() => {
      injectEditButtons();
    });
  }

  function cancelEdit() {
    removeEditButtons();
    pendingDeletes = [];
    hasChanges = false;
    showAddForm = false;
    showEditForm = false;
    editingEntry = null;
    resetAddForm();
    editMode = false;
  }

  function resetAddForm() {
    newVersion = "";
    newType = "improvement";
    newDate = new Date().toISOString().slice(0, 10);
    newDescription = "";
    newContent = "";
  }

  function openAddForm() {
    editingEntry = null;
    showEditForm = false;
    showAddForm = true;
    newDate = new Date().toISOString().slice(0, 10);
  }

  async function openEdit(entry: ChangelogEntry) {
    showAddForm = false;
    editingEntry = entry;
    showEditForm = true;
    editRawMd = "";
    const filePath = `src/content/changelog/${entry.slug}.md`;
    const file = await getRepoFile(filePath, repoConfig);
    if (file) {
      editRawMd = file.content;
      entry.sha = file.sha;
    } else {
      showToast("无法加载文件内容，请检查网络或Token", "error");
      showEditForm = false;
    }
  }

  function parseChangelogMd(raw: string): {
    version: string;
    date: string;
    type: string;
    description: string;
    body: string;
  } | null {
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];
    const body = fmMatch[2] || "";
    const getField = (key: string) => {
      const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return m ? m[1].replace(/^["']|["']$/g, "").trim() : "";
    };
    return {
      version: getField("version"),
      date: getField("date"),
      type: getField("type"),
      description: getField("description"),
      body: body.trim(),
    };
  }

  function buildChangelogMd(e: {
    version: string;
    date: string;
    type: string;
    description: string;
    content: string;
  }): string {
    const lines = ["---"];
    lines.push(`version: "${e.version.replace(/"/g, '\\"')}"`);
    lines.push(`date: ${e.date}`);
    lines.push(`type: ${e.type}`);
    if (e.description) {
      lines.push(`description: "${e.description.replace(/"/g, '\\"')}"`);
    }
    lines.push("---");
    lines.push("");
    lines.push(e.content.trim());
    lines.push("");
    return lines.join("\n");
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s]+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "entry";
  }

  function addNewEntry() {
    if (!newVersion.trim()) {
      showToast("请填写版本号", "warning");
      return;
    }
    if (!newDescription.trim()) {
      showToast("请填写更新简述", "warning");
      return;
    }
    const slug = `${newDate}-${slugify(newVersion + " " + newDescription).slice(0, 30)}`;
    const md = buildChangelogMd({
      version: newVersion,
      date: newDate,
      type: newType,
      description: newDescription,
      content: newContent,
    });
    hasChanges = true;
    pendingNewEntries.push({ slug, md });
    showAddForm = false;
    resetAddForm();
    showToast("已添加更新日志条目，点击保存提交到仓库", "success");
  }

  let pendingNewEntries = $state<{ slug: string; md: string }[]>([]);

  function saveEditContent() {
    if (!editingEntry) return;
    const parsed = parseChangelogMd(editRawMd);
    if (!parsed) {
      showToast("Frontmatter 解析失败，请检查格式", "error");
      return;
    }
    editingEntry._newMd = editRawMd;
    showEditForm = false;
    hasChanges = true;
    showToast("已修改，点击保存提交", "success");
  }

  async function handleSave() {
    if (!hasValidToken()) {
      showToast("请先导入密钥（需要repo权限）", "warning");
      return;
    }
    saving = true;
    try {
      let allOk = true;
      for (const newItem of pendingNewEntries) {
        const filePath = `src/content/changelog/${newItem.slug}.md`;
        const ok = await createRepoFile(
          filePath,
          newItem.md,
          `chore(changelog): add ${newItem.slug}`,
          repoConfig,
        );
        if (!ok) allOk = false;
      }
      for (const entry of entries) {
        if (entry._newMd && entry.sha) {
          const filePath = `src/content/changelog/${entry.slug}.md`;
          const ok = await updateRepoFile(
            filePath,
            entry._newMd,
            entry.sha,
            `chore(changelog): update ${entry.slug}`,
            repoConfig,
          );
          if (!ok) allOk = false;
        }
      }
      for (const delSlug of pendingDeletes) {
        const filePath = `src/content/changelog/${delSlug}.md`;
        const file = await getRepoFile(filePath, repoConfig);
        if (file && file.sha) {
          const ok = await deleteRepoFile(filePath, file.sha, `chore(changelog): remove ${delSlug}`);
          if (!ok) allOk = false;
        }
      }
      if (allOk) {
        pendingNewEntries = [];
        pendingDeletes = [];
        hasChanges = false;
        showToast("保存成功！刷新页面查看效果", "success");
      } else {
        showToast("部分操作失败，请检查Token权限（需要repo权限）", "error");
      }
    } catch (err) {
      showToast("保存出错，请检查网络连接", "error");
      console.error(err);
    } finally {
      saving = false;
    }
  }

  async function deleteRepoFile(
    path: string,
    sha: string,
    message: string,
  ): Promise<boolean> {
    const token = localStorage.getItem("gh_repo_token") || localStorage.getItem("gh_token") || "";
    if (!token) return false;
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}/contents/${path}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            message,
            sha,
            branch: repoConfig.branch,
          }),
        },
      );
      return resp.ok;
    } catch {
      return false;
    }
  }

  const renderedNewPreview = $derived.by(() => {
    if (!newContent) return "";
    try {
      return marked.parse(newContent, { gfm: true, breaks: true }) as string;
    } catch {
      return newContent;
    }
  });

  const renderedEditPreview = $derived.by(() => {
    if (!editRawMd) return "";
    try {
      const parsed = parseChangelogMd(editRawMd);
      return parsed ? (marked.parse(parsed.body, { gfm: true, breaks: true }) as string) : "";
    } catch {
      return "";
    }
  });
</script>

<EditToast />

<div class="cl-editor-toolbar-slot">
  <EditToolbar
    pageName="更新日志"
    saving={saving}
    hasChanges={hasChanges}
    showAddButton={true}
    persistentEdit={false}
    on:modeChange={(e) => {
      if (e.detail.editing) enterEditMode();
      else cancelEdit();
    }}
    on:cancel={cancelEdit}
    on:save={handleSave}
    on:add={openAddForm}
  />
</div>

{#if showAddForm}
  <div class="cl-modal-overlay" on:click={() => (showAddForm = false)}>
    <div class="cl-modal" on:click|stopPropagation>
      <div class="cl-modal-header">
        <h3>添加更新日志</h3>
        <button class="cl-modal-close" onclick={() => (showAddForm = false)}>
          <iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
        </button>
      </div>
      <div class="cl-modal-body">
        <div class="cl-form-row">
          <label>版本号</label>
          <input type="text" bind:value={newVersion} placeholder="如 v1.2.0" />
        </div>
        <div class="cl-form-grid">
          <div class="cl-form-row">
            <label>类型</label>
            <select bind:value={newType}>
              {#each typeOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div class="cl-form-row">
            <label>日期</label>
            <input type="date" bind:value={newDate} />
          </div>
        </div>
        <div class="cl-form-row">
          <label>更新简述</label>
          <input type="text" bind:value={newDescription} placeholder="一句话描述这次更新" />
        </div>
        <div class="cl-form-row">
          <label>详细内容（Markdown）</label>
          <div class="cl-split">
            <textarea
              class="cl-textarea"
              bind:value={newContent}
              placeholder="详细的更新说明，支持 Markdown..."
              spellcheck="false"
            ></textarea>
            <div class="cl-preview">{@html renderedNewPreview}</div>
          </div>
        </div>
      </div>
      <div class="cl-modal-footer">
        <button class="cl-btn cl-btn-ghost" onclick={() => (showAddForm = false)}>取消</button>
        <button class="cl-btn cl-btn-primary" onclick={addNewEntry}>添加</button>
      </div>
    </div>
  </div>
{/if}

{#if showEditForm && editingEntry}
  <div class="cl-modal-overlay" on:click={() => (showEditForm = false)}>
    <div class="cl-modal cl-modal-lg" on:click|stopPropagation>
      <div class="cl-modal-header">
        <h3>编辑：{editingEntry.version}</h3>
        <button class="cl-modal-close" onclick={() => (showEditForm = false)}>
          <iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
        </button>
      </div>
      <div class="cl-modal-body">
        <div class="cl-form-row">
          <label>完整 Markdown 文件内容（含 Frontmatter）</label>
          <div class="cl-split">
            <textarea
              class="cl-textarea cl-textarea-code"
              bind:value={editRawMd}
              spellcheck="false"
            ></textarea>
            <div class="cl-preview">{@html renderedEditPreview}</div>
          </div>
        </div>
      </div>
      <div class="cl-modal-footer">
        <button class="cl-btn cl-btn-ghost" onclick={() => (showEditForm = false)}>取消</button>
        <button class="cl-btn cl-btn-primary" onclick={saveEditContent}>确定修改</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cl-editor-toolbar-slot {
    margin-bottom: 1rem;
    display: flex;
    justify-content: flex-end;
  }

  .cl-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .cl-modal {
    background: var(--card-bg, #fff);
    border-radius: 16px;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .cl-modal-lg {
    max-width: 960px;
  }

  .cl-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--line-divider);
  }
  .cl-modal-header h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--deep-text);
  }
  .cl-modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--content-meta);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
  }
  .cl-modal-close:hover {
    background: var(--btn-plain-bg-hover);
  }

  .cl-modal-body {
    padding: 1rem 1.25rem;
    overflow-y: auto;
    flex: 1;
  }

  .cl-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--line-divider);
  }

  .cl-form-row {
    margin-bottom: 1rem;
  }
  .cl-form-row label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--content-meta);
    margin-bottom: 0.25rem;
  }
  .cl-form-row input,
  .cl-form-row select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line-divider);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--page-bg);
    color: var(--deep-text);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }
  .cl-form-row input:focus,
  .cl-form-row select:focus {
    border-color: var(--primary);
  }
  .cl-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .cl-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid var(--line-divider);
    border-radius: 8px;
    overflow: hidden;
    min-height: 280px;
  }

  .cl-textarea {
    width: 100%;
    padding: 0.6rem;
    border: none;
    resize: none;
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    line-height: 1.6;
    background: var(--page-bg);
    color: var(--deep-text);
    outline: none;
    min-height: 280px;
  }
  .cl-textarea-code {
    font-size: 0.75rem;
  }

  .cl-preview {
    padding: 0.6rem;
    overflow-y: auto;
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--deep-text);
    border-left: 1px solid var(--line-divider);
    background: var(--card-bg, #fff);
    min-height: 280px;
  }
  .cl-preview :global(h1),
  .cl-preview :global(h2),
  .cl-preview :global(h3) {
    margin: 0.5rem 0 0.25rem;
    font-size: 1em;
  }
  .cl-preview :global(p) {
    margin: 0.25rem 0;
  }
  .cl-preview :global(code) {
    background: var(--btn-plain-bg-hover);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .cl-preview :global(pre) {
    background: var(--btn-plain-bg-hover);
    padding: 0.5rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .cl-preview :global(ul),
  .cl-preview :global(ol) {
    padding-left: 1.2em;
    margin: 0.25rem 0;
  }
  .cl-preview :global(table) {
    border-collapse: collapse;
    font-size: 0.85em;
  }
  .cl-preview :global(th),
  .cl-preview :global(td) {
    border: 1px solid var(--line-divider);
    padding: 4px 8px;
  }
  .cl-preview :global(blockquote) {
    border-left: 3px solid var(--primary);
    padding-left: 0.6rem;
    margin: 0.4rem 0;
    color: var(--content-meta);
  }

  .cl-btn {
    padding: 0.45rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: inherit;
  }
  .cl-btn-primary {
    background: var(--primary);
    color: #fff;
  }
  .cl-btn-primary:hover {
    opacity: 0.9;
  }
  .cl-btn-ghost {
    background: var(--btn-plain-bg-hover);
    color: var(--deep-text);
  }
  .cl-btn-ghost:hover {
    background: var(--btn-regular-bg);
  }

  @media (max-width: 640px) {
    .cl-form-grid {
      grid-template-columns: 1fr;
    }
    .cl-split {
      grid-template-columns: 1fr;
    }
    .cl-preview {
      border-left: none;
      border-top: 1px solid var(--line-divider);
    }
  }
</style>
