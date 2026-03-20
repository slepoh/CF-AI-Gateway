<div align="center">

# ⚡ AI Gateway

### 零成本、可自部署的 AI API 中转服务

[![Deploy to Cloudflare](https://img.shields.io/badge/deploy-Cloudflare%20Pages-orange?logo=cloudflare)](https://developers.cloudflare.com/pages/)
[![API](https://img.shields.io/badge/API-OpenAI%20Compatible-green?logo=openai)](https://platform.openai.com/docs/api-reference)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**纯 Cloudflare 方案，无需服务器，免费额度内即可运行**

[English](./README_EN.md) | 中文

</div>

---

## ✨ 为什么选择 AI Gateway？

市面上的 AI API 中转方案（new-api、one-api）大多需要 VPS + Docker + 数据库，部署复杂且有成本。

**AI Gateway 不同：**

- 🆓 **完全免费** — 基于 Cloudflare 免费套餐（Pages + D1），零服务器成本
- ⚡ **全球加速** — Cloudflare 300+ 边缘节点，国内直连无需梯子
- 🔧 **部署极简** — Fork → 绑定 Cloudflare → 设置环境变量 → 完成
- 📦 **单文件后端** — 整个后端就一个 TypeScript 文件，易于理解和修改

## 🎯 功能特性

- 🚀 **OpenAI 兼容 API** — 支持所有 OpenAI 格式的客户端（ChatBox、NextChat、LobeChat、RikkaHub 等）
- 🧩 **灵活套餐** — 免费/付费多套餐，配额管理，购买叠加不过期
- 📊 **用量统计** — 实时查看 Token 消耗、请求次数、调用详情
- 🔑 **多密钥管理** — 创建多个 API Key，独立限额和统计
- 🔒 **安全加固** — PBKDF2 密码哈希、RPM 限速、CORS 限制、JWT 鉴权
- 💬 **流式输出** — 完整支持 SSE 流式响应，实时打字效果
- 💰 **支付集成** — 支持易支付（ePay），开箱即用
- 📧 **邮箱验证** — 通过 Resend 发送验证码邮件（可选）
- 🎟️ **邀请码** — 支持邀请码注册，可控增长

## 🎯 支持的模型

任何兼容 OpenAI API 格式的上游服务均可接入：

| 厂商 | 模型示例 |
|------|----------|
| OpenAI | GPT-4o、GPT-4、GPT-3.5-Turbo、o1 |
| Anthropic | Claude 4 Opus、Claude 3.5 Sonnet |
| Google | Gemini 2.5 Pro、Gemini 2.0 Flash |
| DeepSeek | DeepSeek-V3、DeepSeek-R1 |
| 其他 | 任何 OpenAI 兼容 API |

## 🚀 一键部署

### 前置条件

- 一个 [Cloudflare](https://cloudflare.com) 账号（免费注册）
- Node.js 18+

### 步骤

#### 1. Fork 本仓库

点击右上角 **Fork** 按钮

#### 2. 创建 D1 数据库

```bash
npx wrangler d1 create ai-gateway
```

记下输出的 `database_id`。

#### 3. 在 Cloudflare Pages 创建项目

- 进入 [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → Create a project
- 连接你 Fork 的 GitHub 仓库
- 构建设置：
  - **Build command**: `npm run build`
  - **Output directory**: `dist`
  - **Node.js version**: `18`

#### 4. 绑定 D1 数据库

在 Pages 项目 → Settings → Functions → D1 database bindings：
- Variable name: `DB`
- D1 database: 选择刚创建的数据库

#### 5. 设置环境变量

在 Pages 项目 → Settings → Environment variables 中添加：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `REAL_API_BASE` | ✅ | 上游 API 地址（如 `https://api.openai.com`） |
| `REAL_API_KEY` | ✅ | 上游 API Key |
| `ADMIN_PASSWORD` | ✅ | 管理员密码 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（随机字符串） |
| `BRAND_NAME` | ❌ | 站点名称（默认 "AI Gateway"） |
| `INVITE_CODES` | ❌ | 邀请码，逗号分隔（留空则开放注册） |
| `RESEND_API_KEY` | ❌ | Resend API Key（启用邮箱验证） |
| `MAIL_FROM` | ❌ | 发件人地址（如 `AI Gateway <noreply@your-domain.com>`） |
| `EPAY_PID` | ❌ | 易支付商户 ID |
| `EPAY_KEY` | ❌ | 易支付商户密钥 |
| `EPAY_URL` | ❌ | 易支付接口地址 |

#### 6. 重新部署

保存环境变量后，触发一次新的部署即可。

数据库表会在首次请求时自动创建，无需手动建表。

## 📖 使用方法

### API 调用

```bash
curl https://your-domain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 在客户端中使用

在任何兼容 OpenAI API 的客户端中：

- **API Base URL**: `https://your-domain.com/v1`
- **API Key**: 在控制台创建的密钥

## 📱 推荐客户端

| 客户端 | 平台 | 说明 |
|--------|------|------|
| [ChatBox](https://chatboxai.app) | 全平台 | 简洁优雅的桌面客户端 |
| [NextChat](https://github.com/ChatGPTNextWeb/NextWeb) | Web/桌面 | 一键部署的 ChatGPT 网页版 |
| [LobeChat](https://github.com/lobehub/lobe-chat) | Web | 现代化的 AI 聊天框架 |
| [RikkaHub](https://github.com/nichem/RikkaHub) | Android | 功能强大的 LLM 客户端 |
| [OpenCat](https://apps.apple.com/app/opencat/id6445999201) | iOS/macOS | 原生 Apple 平台客户端 |

## 🏗️ 技术架构

```
用户请求 → Cloudflare CDN (300+ 节点) → Pages Functions → 上游 AI API
                                              ↓
                                         D1 数据库
                                    (用户/密钥/用量/订单)
```

- **前端**：React + TypeScript + Vite + Tailwind CSS
- **后端**：Cloudflare Pages Functions（单文件 Edge Runtime）
- **数据库**：Cloudflare D1（SQLite，免费 5GB）
- **部署**：Cloudflare Pages（自动 CI/CD）

## 🔒 安全特性

- PBKDF2 密码哈希（非明文存储）
- JWT 令牌鉴权
- CORS 源检查（API 端点放通，管理端点限制同源）
- RPM 限速（每分钟请求限制）
- 每日/总额度限制
- API Key 独立隔离

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的修改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开一个 Pull Request

## ⭐ Star History

如果这个项目对你有帮助，请给一个 ⭐ 支持！

## 📄 License

[MIT](LICENSE) © 2026
