# Moments API 测试指南

## 📋 前提条件

### 1. Vercel 环境变量配置（必须）

确保在 Vercel 项目设置中配置了以下环境变量：

```
GH_APP_ID=你的GitHub_App_ID
GH_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
GH_USER=fqzlr
GH_REPO=my-blog
```

**重要提示：**
- `GH_PRIVATE_KEY` 必须是完整的 PEM 格式，包括 BEGIN 和 END 标记
- 换行符用 `\n` 表示（不要使用实际的换行）
- 所有变量名必须完全匹配（区分大小写）

### 2. GitHub App 权限检查

确保你的 GitHub App 具有以下权限：
- ✅ **Repository permissions > Contents**: Read & write（读写仓库内容）
- ✅ 已安装到你的 `fqzlr/my-blog` 仓库

检查方式：
1. 访问 https://github.com/settings/apps
2. 选择你的 GitHub App
3. 查看 "Permissions" 标签页
4. 确认 Contents 权限为 "Read & write"

## 🧪 测试步骤

### 方法一：通过 API 端点测试（推荐）

1. **启动开发服务器或等待 Vercel 部署完成**
   ```bash
   npm run dev
   ```

2. **访问测试端点**
   - 本地：http://localhost:4321/api/test-github.json
   - 线上：https://your-domain.com/api/test-github.json

3. **检查结果**
   
   ✅ **成功示例：**
   ```json
   {
     "success": true,
     "message": "GitHub API 连接成功！",
     "fileExists": false,
     "config": {
       "owner": "fqzlr",
       "repo": "my-blog",
       "branch": "main",
       "hasAppId": true
     }
   }
   ```
   
   ❌ **失败示例：**
   ```json
   {
     "success": false,
     "error": "获取 Installation Token 失败 (401): ...",
     "config": { ... }
   }
   ```

### 方法二：直接在页面测试

1. **访问动态页面**
   - 本地：http://localhost:4321/life/moments
   - 线上：https://your-domain.com/life/moments

2. **点击"编辑模式"按钮**

3. **导入认证信息**（如果服务端未配置）
   - 点击"导入 .pem 文件"
   - 选择你的 GitHub App 私钥文件
   - 输入 App ID

4. **尝试添加一条说说**
   - 点击"+ 添加"按钮
   - 填写内容（例如："测试提交功能"）
   - 点击"保存草稿"

5. **提交到 GitHub**
   - 点击"提交"按钮
   - 观察是否有错误提示

6. **验证结果**
   - 刷新页面，看看新添加的说说是否显示
   - 检查 GitHub 仓库中的 `public/moments.json` 文件是否更新

## 🔍 常见问题排查

### 问题 1：显示"未认证"或"Authentication failed"

**可能原因：**
- Vercel 环境变量未正确配置
- PEM 私钥格式不正确
- GitHub App 未安装到仓库

**解决方案：**
1. 检查 Vercel 环境变量是否已保存并重新部署
2. 确认 `GH_PRIVATE_KEY` 包含完整的 BEGIN/END 标记
3. 访问 https://github.com/settings/installations 确认 App 已安装

### 问题 2：提交成功但文件未更新

**可能原因：**
- 分支名称不匹配（默认是 `main`）
- 文件路径不正确

**解决方案：**
1. 确认你的默认分支是 `main`（不是 `master`）
2. 检查 `src/config/editConfig.ts` 中的 `repoConfig.branch` 配置

### 问题 3：找不到 Installation

**可能原因：**
- GitHub App 未正确安装
- 用户/仓库名称不匹配

**解决方案：**
1. 访问 https://github.com/settings/installations
2. 确认 App 已安装到 `fqzlr/my-blog`
3. 检查 `GH_USER` 和 `GH_REPO` 环境变量是否正确

### 问题 4：CORS 错误

**可能原因：**
- `/api/github` 代理端点未正常工作

**解决方案：**
1. 确认 `api/github.js` 文件存在且已部署
2. 检查 Vercel 函数日志是否有错误

## 📊 调试技巧

### 查看浏览器控制台

打开浏览器开发者工具（F12），查看：
1. **Console** 标签：查看 JavaScript 错误
2. **Network** 标签：查看 API 请求详情
   - 过滤 "github" 查看代理请求
   - 检查请求状态码（200 = 成功，401 = 认证失败，403 = 权限不足）

### 查看 Vercel 函数日志

1. 登录 Vercel Dashboard
2. 进入你的项目
3. 点击 "Functions" 标签
4. 选择 `/api/github` 函数
5. 查看最近的执行日志

## ✨ 预期行为

成功配置后，你应该能够：
1. ✅ 无需手动导入密钥即可进入编辑模式
2. ✅ 添加、编辑、删除说说内容
3. ✅ 点击"提交"后数据自动同步到 GitHub 仓库
4. ✅ 刷新页面后看到最新的内容
5. ✅ 在 GitHub 仓库中看到更新的 `public/moments.json` 文件

## 🚀 下一步

如果测试成功，你可以：
1. 删除测试文件 `src/pages/api/test-github.json.ts`（可选）
2. 为其他模块（友链、收藏等）应用相同的改造
3. 优化用户体验（添加加载状态、错误提示等）

##  需要帮助？

如果遇到问题，请提供：
1. 浏览器控制台的错误信息（截图或文字）
2. Vercel 函数日志（如果有）
3. `/api/test-github.json` 的返回结果

---

**最后更新：** 2026-06-30
