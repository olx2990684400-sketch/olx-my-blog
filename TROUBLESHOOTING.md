# 说说提交功能故障排查指南

## 📋 问题现象
- POST `/api/github` 返回 404 错误
- 提交说说时显示"提交失败"

##  诊断步骤

### 第一步：检查环境变量配置

访问以下 URL 检查 Vercel 环境变量是否正确配置：

**线上环境：**
```
https://text.fqzlr.com/api/diagnose-env.json
```

**本地开发环境：**
```
http://localhost:4321/api/diagnose-env.json
```

#### ✅ 期望结果：
```json
{
  "message": "Environment Variables Diagnostic",
  "timestamp": "...",
  "variables": {
    "GH_APP_ID": "4173368",
    "GH_PRIVATE_KEY": "✓ Set (length: XXXX)",
    "GH_USER": "fqzlr",
    "GH_REPO": "my-blog",
    "NODE_ENV": "production",
    "VERCEL": "1"
  },
  "allSet": true
}
```

#### ❌ 如果 `allSet: false` 或某些变量显示 `(not set)`：

**解决方案：**

1. **登录 Vercel Dashboard**
   - 访问 https://vercel.com/dashboard
   - 选择你的项目 `my-blog`

2. **进入 Settings → Environment Variables**

3. **添加以下环境变量**（Production、Preview、Development 三个环境都需要）：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `GH_APP_ID` | `4173368` | 你的 GitHub App ID |
   | `GH_PRIVATE_KEY` | `"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"` | 完整的 PEM 私钥，换行用 `\n` 表示 |
   | `GH_USER` | `fqzlr` | GitHub 用户名 |
   | `GH_REPO` | `my-blog` | 仓库名称 |

4. **重要提示：**
   - `GH_PRIVATE_KEY` 必须包含完整的 BEGIN 和 END 标记
   - 换行符使用 `\n` 转义，不要实际换行
   - 示例格式：
     ```
     "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
     ```

5. **重新部署**
   - 添加环境变量后，Vercel 会自动触发重新部署
   - 等待部署完成后再次测试

---

### 第二步：检查 GitHub App 配置

#### 1. 验证 App ID
访问：https://github.com/settings/apps/your-app-name

确认 App ID 是 `4173368`

#### 2. 检查权限设置
在 GitHub App 设置页面，确保有以下权限：

**Repository permissions:**
- ✅ Contents: **Read & write**（读写仓库内容）
- ✅ Metadata: Read-only（默认）

**Organization permissions:**
- （如果适用）根据需要配置

#### 3. 检查安装状态
访问：https://github.com/settings/installations

确认：
- ✅ App 已安装
- ✅ 安装到了 `fqzlr/my-blog` 仓库
- ✅ 如果是组织仓库，确保有正确的访问权限

---

### 第三步：浏览器端测试

#### 方法 A：使用浏览器导入密钥（推荐用于快速测试）

1. 访问 `https://text.fqzlr.com/moments/`
2. 点击"编辑说说"按钮
3. 点击"导入密钥"按钮
4. 上传你的 `.pem` 私钥文件
5. 输入 App ID: `4173368`
6. 点击"验证"
7. 尝试添加一条说说并提交

#### 方法 B：依赖服务端环境变量

确保第一步的环境变量配置正确后：

1. 访问 `https://text.fqzlr.com/moments/`
2. 点击"编辑说说"按钮
3. **不需要导入密钥**（应该自动使用服务端配置）
4. 添加一条说说并点击"提交"

---

### 第四步：查看调试信息

#### 1. 浏览器控制台

打开开发者工具（F12），查看 Console 标签：

**期望看到的日志：**
```
[RepoDrafts] submitDrafts called
[RepoDrafts] Found drafts: 1
[RepoDrafts] Using draft data: { pathToUse: "public/moments.json", isEdit: false, hasSha: false }
[RepoDrafts] doSubmit called: { path: "public/moments.json", isEdit: false, hasSha: false, contentLength: XXX }
[RepoDrafts] Creating new file...
```

**如果出现错误：**
- 记录完整的错误消息
- 截图保存

#### 2. Network 标签

在开发者工具的 Network 标签中：

1. 过滤 `github`
2. 找到 `POST /api/github` 请求
3. 检查：
   - **Status Code**: 应该是 200 或 201
   - **Response**: 应该包含成功的响应数据
   - 如果是 404 或 401，查看 Response Body 中的错误信息

#### 3. API 诊断端点

访问 `https://text.fqzlr.com/api/test-github.json`

**期望结果：**
```json
{
  "success": true,
  "message": "GitHub API 连接成功，但文件不存在（首次提交时会创建）",
  "fileExists": false,
  "config": {
    "owner": "fqzlr",
    "repo": "my-blog",
    "branch": "main",
    "hasAppId": true
  }
}
```

注意：`hasAppId` 应该是 `true`

---

##  常见错误及解决方案

### 错误 1: POST /api/github 返回 404

**原因：** GitHub API 返回的 404，通常是因为认证失败

**解决方案：**
1. 检查环境变量是否正确配置（第一步）
2. 检查 GitHub App 是否已安装到仓库（第二步第 3 点）
3. 如果使用浏览器导入密钥，确认 App ID 和私钥匹配

### 错误 2: POST /api/github 返回 401 Unauthorized

**原因：** 认证 token 无效或过期

**解决方案：**
1. 检查 `GH_PRIVATE_KEY` 格式是否正确
2. 确认私钥没有多余的空格或换行
3. 重新生成私钥并更新环境变量

### 错误 3: POST /api/github 返回 403 Forbidden

**原因：** GitHub App 权限不足

**解决方案：**
1. 检查 App 的 Repository permissions > Contents 是否为 "Read & write"
2. 确认 App 已正确安装到目标仓库

### 错误 4: 控制台没有 [RepoDrafts] 日志

**原因：** 代码可能没有正确加载或有 JavaScript 错误

**解决方案：**
1. 检查 Console 标签是否有其他 JavaScript 错误
2. 清除浏览器缓存并刷新页面
3. 检查 Network 标签中 JS 文件是否都成功加载（状态码 200）

### 错误 5: GET /api/github 返回 hasAppId: false

**原因：** 环境变量未正确读取

**解决方案：**
1. 访问 `/api/diagnose-env.json` 确认环境变量状态
2. 在 Vercel Dashboard 中确认环境变量已保存
3. 触发手动重新部署

---

## 📞 需要帮助？

如果以上步骤都无法解决问题，请提供以下信息：

1. **`/api/diagnose-env.json` 的完整响应**
2. **浏览器控制台的完整错误日志**（截图或文字）
3. **Network 标签中 `/api/github` 请求的详细信息**：
   - Request Headers
   - Request Payload
   - Response Status Code
   - Response Body
4. **GitHub App 的配置截图**（隐藏敏感信息）

---

## ✅ 验证成功标准

当一切正常工作时，你应该能够：

1. ✅ 访问 `/api/diagnose-env.json` 看到 `allSet: true`
2. ✅ 访问 `/api/test-github.json` 看到 `hasAppId: true`
3. ✅ 在 Moments 页面添加说说并成功提交
4. ✅ 在 GitHub 仓库中看到新创建的 `public/moments.json` 文件
5. ✅ 刷新页面后能看到刚才提交的说说内容

---

**最后更新：** 2026-06-30
