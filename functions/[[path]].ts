// Cloudflare Pages Function - AI API Gateway (D1 版)
// 安全加固: CORS 限制 + PBKDF2 密码哈希 + 登录限速

const EXAMPLE_MAIL_FROM = "noreply@your-domain.example";
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EMAIL_ONLY_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const MAIL_FROM_PATTERN = /^.+<\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\s*>$/;

// ===== 配置 =====
function getConfig(env: Env) {
  const brandName = env.BRAND_NAME || "AI Gateway";
  return {
    BRAND_NAME: brandName,
    MAIL_FROM: env.MAIL_FROM || "",
    REAL_API_BASE: env.REAL_API_BASE,
    REAL_API_KEY: env.REAL_API_KEY,
    ADMIN_PASSWORD: env.ADMIN_PASSWORD,
    JWT_SECRET: env.JWT_SECRET,
    INVITE_CODES: (env.INVITE_CODES || "").split(",").map(s => s.trim()).filter(Boolean),
    EPAY_PID: env.EPAY_PID || "",
    EPAY_KEY: env.EPAY_KEY || "",
    EPAY_URL: env.EPAY_URL || "",
  };
}

// ===== CORS =====
function getCorsHeaders(request: Request, path: string): Record<string, string> {
  if (path.startsWith("/v1/")) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
  }
  const origin = request.headers.get("Origin") || "";
  const host = new URL(request.url).origin;
  const isAllowed = origin === host || origin === host.replace("http://", "https://");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : host,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResp(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== Token 估算 =====
function estimatePromptTokens(bodyText: string): number {
  try {
    const parsed = JSON.parse(bodyText);
    let chars = 0;
    if (parsed.messages && Array.isArray(parsed.messages)) {
      for (const msg of parsed.messages) {
        if (typeof msg.content === "string") chars += msg.content.length;
        else if (Array.isArray(msg.content)) {
          for (const p of msg.content) if (p.type === "text" && typeof p.text === "string") chars += p.text.length;
        }
        chars += 10;
      }
    }
    return Math.max(1, Math.ceil(chars / 2.5));
  } catch { return Math.ceil(bodyText.length / 4); }
}

// ===== PBKDF2 密码哈希 =====
async function hashPBKDF2(password: string, existingSalt?: Uint8Array): Promise<string> {
  const salt = existingSalt || crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const h = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:100000:${h(salt)}:${h(new Uint8Array(derived))}`;
}

async function verifyPassword(password: string, stored: string, jwtSecret: string): Promise<boolean> {
  if (stored.startsWith("pbkdf2:")) {
    const [, , saltHex] = stored.split(":");
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    return (await hashPBKDF2(password, salt)) === stored;
  }
  // 旧格式 SHA-256
  const data = new TextEncoder().encode(password + jwtSecret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("") === stored;
}

// ===== JWT =====
async function signJWT(payload: Record<string, any>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  payload.iat = Math.floor(Date.now() / 1000);
  payload.exp = payload.iat + 86400 * 7;
  const body = btoa(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [h, b, s] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(s), c => c.charCodeAt(0)), new TextEncoder().encode(`${h}.${b}`))) return null;
    const payload = JSON.parse(atob(b));
    return payload.exp < Math.floor(Date.now() / 1000) ? null : payload;
  } catch { return null; }
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "sk-" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===== 登录限速 (5次/15分钟/IP) =====
async function isLoginBlocked(db: D1Database, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await db.prepare("SELECT COUNT(*) as c FROM login_attempts WHERE ip = ? AND attempted_at >= ? AND success = 0").bind(ip, windowStart).first() as any;
  return (row?.c || 0) >= 5;
}

async function recordLogin(db: D1Database, ip: string, success: boolean) {
  await db.prepare("INSERT INTO login_attempts (ip, success, attempted_at) VALUES (?, ?, ?)").bind(ip, success ? 1 : 0, new Date().toISOString()).run();
}

// ===== 发送验证码邮件 (Resend) =====
async function sendVerificationEmail(
  resendKey: string,
  to: string,
  code: string,
  brandName: string,
  mailFrom: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY not set" };
  const trimmedMailFrom = mailFrom.trim();
  const normalizedMailFrom = trimmedMailFrom.toLowerCase();
  const emailMatch = trimmedMailFrom.match(EMAIL_PATTERN);
  const emailAddress = (emailMatch?.[0] || "").toLowerCase();
  const isPlaceholderMailFrom = emailAddress === EXAMPLE_MAIL_FROM;
  const isValidMailFrom = EMAIL_ONLY_PATTERN.test(trimmedMailFrom) || MAIL_FROM_PATTERN.test(trimmedMailFrom);
  if (!trimmedMailFrom) return { ok: false, error: "MAIL_FROM not configured" };
  if (!isValidMailFrom || !emailAddress) return { ok: false, error: "MAIL_FROM has invalid email format" };
  if (isPlaceholderMailFrom) {
    return { ok: false, error: "MAIL_FROM contains placeholder domain" };
  }
  const emailBody = {
    from: mailFrom,
    to: [to],
    subject: `【${brandName}】验证码：${code}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px"><div style="text-align:center;margin-bottom:32px"><h1 style="font-size:24px;font-weight:700;color:#000">${brandName}</h1></div><div style="background:#f9f9f9;border-radius:12px;padding:32px;text-align:center"><p style="color:#666;font-size:14px;margin:0 0 16px">你的验证码是</p><div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#000;margin:16px 0">${code}</div><p style="color:#999;font-size:12px;margin:16px 0 0">验证码 5 分钟内有效，请勿泄露给他人</p></div><p style="color:#ccc;font-size:11px;text-align:center;margin-top:24px">如果你没有请求此验证码，请忽略此邮件。</p></div>`,
  };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailBody),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: errText };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch error" };
  }
}

function generateCode(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return String((bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 900000 + 100000);
}

// ===== 易支付签名 =====
async function md5(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("MD5", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function epaySignAsync(params: Record<string, string>, key: string): Promise<string> {
  const sorted = Object.keys(params).filter(k => k !== "sign" && k !== "sign_type" && params[k] !== "").sort();
  const str = sorted.map(k => `${k}=${params[k]}`).join("&") + key;
  return await md5(str);
}

// ===== Types =====
interface Env { DB: D1Database; BRAND_NAME: string; MAIL_FROM: string; REAL_API_BASE: string; REAL_API_KEY: string; ADMIN_PASSWORD: string; JWT_SECRET: string; INVITE_CODES: string; RESEND_API_KEY: string; EPAY_PID: string; EPAY_KEY: string; EPAY_URL: string; }

// ===== Handler =====
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.DB;
  const cfg = getConfig(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const cors = getCorsHeaders(request, path);
  const j = (data: unknown, status = 200) => jsonResp(data, status, cors);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (method === "OPTIONS") return new Response(null, { headers: cors });
  if (!path.startsWith("/api/") && !path.startsWith("/v1/") && path !== "/v1") return context.next();
  if ((path === "/v1" || path.startsWith("/v1/")) && (!cfg.REAL_API_BASE || !cfg.REAL_API_KEY)) {
    return j({ error: { message: "Upstream API not configured. Set REAL_API_BASE and REAL_API_KEY.", code: "upstream_not_configured" } }, 500);
  }



  // ===== AUTH =====
  if (path === "/api/auth/admin-login" && method === "POST") {
    if (await isLoginBlocked(db, ip)) return j({ error: "登录尝试过多，请 15 分钟后再试" }, 429);
    const { password } = (await request.json()) as any;
    if (password !== cfg.ADMIN_PASSWORD) {
      context.waitUntil(recordLogin(db, ip, false));
      return j({ error: "密码错误" }, 401);
    }
    context.waitUntil(recordLogin(db, ip, true));
    return j({ token: await signJWT({ userId: "admin", email: "admin", role: "admin" }, cfg.JWT_SECRET), user: { id: "admin", email: "admin", name: "管理员", role: "admin" } });
  }

  if (path === "/api/auth/login" && method === "POST") {
    if (await isLoginBlocked(db, ip)) return j({ error: "登录尝试过多，请 15 分钟后再试" }, 429);
    const { email: rawEmail, password } = (await request.json()) as any;
    const email = (rawEmail || "").toLowerCase().trim();
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first() as any;
    if (!user || !(await verifyPassword(password, user.password_hash, cfg.JWT_SECRET))) {
      context.waitUntil(recordLogin(db, ip, false));
      return j({ error: "邮箱或密码错误" }, 401);
    }
    context.waitUntil(recordLogin(db, ip, true));
    // 自动迁移旧密码到 PBKDF2
    if (!user.password_hash.startsWith("pbkdf2:")) {
      context.waitUntil(hashPBKDF2(password).then(h => db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(h, user.id).run()));
    }
    return j({ token: await signJWT({ userId: user.id, email: user.email, role: user.role }, cfg.JWT_SECRET), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }

  if (path === "/api/auth/register" && method === "POST") {
    if (await isLoginBlocked(db, ip)) return j({ error: "注册尝试过多，请 15 分钟后再试" }, 429);
    const { email, password, name, invite_code, code } = (await request.json()) as any;
    if (!email || !password) return j({ error: "邮箱和密码必填" }, 400);
    if (password.length < 6) return j({ error: "密码至少 6 位" }, 400);
    if (!code) return j({ error: "请输入验证码" }, 400);

    // 验证邮箱验证码（限制错误次数：同一邮箱 5 次错误后锁定）
    const emailNorm = email.toLowerCase().trim();
    const now = new Date().toISOString();
    const recentFails = await db.prepare(
      "SELECT COUNT(*) as c FROM email_codes WHERE email = ? AND purpose = 'register' AND used = -1 AND created_at > ?"
    ).bind(emailNorm, new Date(Date.now() - 15 * 60 * 1000).toISOString()).first() as any;
    if ((recentFails?.c || 0) >= 5) return j({ error: "验证码错误次数过多，请 15 分钟后重试" }, 429);

    const codeRow = await db.prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'register' AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).bind(emailNorm, now).first() as any;
    if (!codeRow || codeRow.code !== code) {
      // 记录失败尝试（无论是否有验证码记录）
      context.waitUntil(db.prepare("INSERT INTO email_codes (email, code, purpose, created_at, expires_at, used) VALUES (?, ?, 'register', ?, ?, -1)").bind(emailNorm, '', now, now).run());
      return j({ error: "验证码错误或已过期" }, 400);
    }

    if (await db.prepare("SELECT id FROM users WHERE email = ?").bind(emailNorm).first()) return j({ error: "邮箱已注册" }, 400);
    if (invite_code && !cfg.INVITE_CODES.includes(invite_code)) return j({ error: "邀请码无效" }, 400);

    // 标记验证码已使用
    await db.prepare("UPDATE email_codes SET used = 1 WHERE id = ?").bind(codeRow.id).run();

    const userId = crypto.randomUUID();
    const passwordHash = await hashPBKDF2(password);
    await db.prepare("INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)").bind(userId, emailNorm, name || emailNorm.split("@")[0], passwordHash, now).run();

    const apiKey = generateApiKey();
    await db.prepare("INSERT INTO api_keys (key, user_id, name, rpm, total_used, total_limit, plan_id, enabled, created_at) VALUES (?, ?, '默认密钥', 3, 0, 100, 'free', 1, ?)").bind(apiKey, userId, now).run();
    context.waitUntil(recordLogin(db, ip, true));
    return j({ token: await signJWT({ userId, email: emailNorm, role: "user" }, cfg.JWT_SECRET), user: { id: userId, email: emailNorm, name: name || emailNorm.split("@")[0], role: "user" }, api_key: apiKey });
  }

  // 发送验证码
  if (path === "/api/auth/send-code" && method === "POST") {
    if (await isLoginBlocked(db, ip)) return j({ error: "请求过多，请 15 分钟后再试" }, 429);
    const { email, purpose } = (await request.json()) as any;
    if (!email) return j({ error: "邮箱必填" }, 400);
    const emailLower = email.toLowerCase().trim();
    const purposeVal = purpose || "register";

    // 60 秒内不能重复发送
    const recentCode = await db.prepare(
      "SELECT created_at FROM email_codes WHERE email = ? AND purpose = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1"
    ).bind(emailLower, purposeVal, new Date(Date.now() - 60000).toISOString()).first();
    if (recentCode) return j({ error: "验证码已发送，请 60 秒后重试" }, 429);

    // 注册时检查邮箱是否已存在
    if (purposeVal === "register") {
      if (await db.prepare("SELECT id FROM users WHERE email = ?").bind(emailLower).first()) return j({ error: "邮箱已注册" }, 400);
    }

    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    const sendResult = await sendVerificationEmail(env.RESEND_API_KEY || "", emailLower, code, cfg.BRAND_NAME, cfg.MAIL_FROM);
    if (!sendResult.ok) return j({ error: "邮件发送失败，请稍后重试" }, 500);

    await db.prepare("INSERT INTO email_codes (email, code, purpose, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(emailLower, code, purposeVal, now.toISOString(), expiresAt).run();

    return j({ success: true, message: "验证码已发送" });
  }

  // JWT 验证
  let currentUser: any = null;
  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ") && path.startsWith("/api/")) {
    currentUser = await verifyJWT(authHeader.slice(7), cfg.JWT_SECRET);
  }

  if (path === "/api/me" && method === "GET") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    if (currentUser.role === "admin") return j({ id: "admin", email: "admin", name: "管理员", role: "admin" });
    const user = await db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").bind(currentUser.userId).first();
    return user ? j(user) : j({ error: "Not found" }, 404);
  }

  // ===== TOKENS =====
  if (path === "/api/tokens" && method === "GET") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const filterUserId = url.searchParams.get("user_id");
    let keys;
    if (currentUser.role === "admin") {
      keys = filterUserId
        ? await db.prepare("SELECT * FROM api_keys WHERE user_id = ?").bind(filterUserId).all()
        : await db.prepare("SELECT * FROM api_keys").all();
    } else {
      keys = await db.prepare("SELECT * FROM api_keys WHERE user_id = ?").bind(currentUser.userId).all();
    }
    return j({ tokens: keys.results });
  }

  if (path === "/api/tokens" && method === "POST") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const body = (await request.json()) as any;
    const userId = currentUser.role === "admin" ? (body.user_id || currentUser.userId) : currentUser.userId;

    // 普通用户限制最多 5 个密钥
    if (currentUser.role !== "admin") {
      const keyCount = await db.prepare("SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?").bind(userId).first() as any;
      if ((keyCount?.c || 0) >= 5) return j({ error: "密钥数量已达上限（5 个）" }, 400);
    }

    const apiKey = generateApiKey();
    const now = new Date().toISOString();
    // 管理员可自定义配额，普通用户强制试用版
    const rpm = currentUser.role === "admin" ? (body.rpm || 3) : 3;
    const totalLimit = currentUser.role === "admin" ? (body.total_limit || 100) : 100;
    await db.prepare("INSERT INTO api_keys (key, user_id, name, rpm, total_used, total_limit, plan_id, enabled, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?)")
      .bind(apiKey, userId, String(body.name || "新密钥").slice(0, 50), rpm, totalLimit, "free", now).run();
    return j({ token: await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(apiKey).first() });
  }

  if (path.startsWith("/api/tokens/reset/sk-") && method === "POST") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const oldKey = decodeURIComponent(path.replace("/api/tokens/reset/", ""));
    const existing = await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(oldKey).first() as any;
    if (!existing) return j({ error: "密钥不存在" }, 404);
    if (currentUser.role !== "admin" && existing.user_id !== currentUser.userId) return j({ error: "无权限" }, 403);
    const newKey = generateApiKey();
    await db.prepare("UPDATE api_keys SET key = ?, created_at = ? WHERE key = ?").bind(newKey, new Date().toISOString(), oldKey).run();
    return j({ token: await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(newKey).first() });
  }

  if (path.startsWith("/api/tokens/sk-") && method === "PUT") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const apiKey = decodeURIComponent(path.replace("/api/tokens/", ""));
    const existing = await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(apiKey).first() as any;
    if (!existing) return j({ error: "密钥不存在" }, 404);
    if (currentUser.role !== "admin" && existing.user_id !== currentUser.userId) return j({ error: "无权限" }, 403);
    const body = (await request.json()) as any;
    const sets: string[] = []; const vals: any[] = [];
    if (body.name !== undefined) { sets.push("name = ?"); vals.push(String(body.name).slice(0, 50)); }
    if (body.rpm !== undefined && currentUser.role === "admin") { sets.push("rpm = ?"); vals.push(body.rpm); }
    if (body.total_limit !== undefined && currentUser.role === "admin") { sets.push("total_limit = ?"); vals.push(body.total_limit); }
    if (body.plan_id !== undefined && currentUser.role === "admin") { sets.push("plan_id = ?"); vals.push(body.plan_id); }
    if (body.enabled !== undefined && currentUser.role === "admin") { sets.push("enabled = ?"); vals.push(body.enabled ? 1 : 0); }
    if (sets.length > 0) { vals.push(apiKey); await db.prepare(`UPDATE api_keys SET ${sets.join(", ")} WHERE key = ?`).bind(...vals).run(); }
    return j({ token: await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(apiKey).first() });
  }

  if (path.startsWith("/api/tokens/sk-") && method === "DELETE") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const apiKey = decodeURIComponent(path.replace("/api/tokens/", ""));
    const existing = await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(apiKey).first() as any;
    if (!existing) return j({ error: "密钥不存在" }, 404);
    if (currentUser.role !== "admin" && existing.user_id !== currentUser.userId) return j({ error: "无权限" }, 403);
    await db.prepare("DELETE FROM api_keys WHERE key = ?").bind(apiKey).run();
    return j({ success: true });
  }

  // ===== STATS =====
  if (path === "/api/stats" && method === "GET") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00`;
    const minuteAgo = new Date(Date.now() - 60000).toISOString();
    const keys = currentUser.role === "admin"
      ? await db.prepare("SELECT * FROM api_keys").all()
      : await db.prepare("SELECT * FROM api_keys WHERE user_id = ?").bind(currentUser.userId).all();

    const stats = await Promise.all(keys.results.map(async (k: any) => {
      const sfx = k.key.slice(-8);
      const [dr, tr, dt, at] = await Promise.all([
        db.prepare("SELECT COUNT(*) as c FROM usage_log WHERE key_suffix = ? AND created_at >= ?").bind(sfx, todayStart).first(),
        db.prepare("SELECT COUNT(*) as c FROM usage_log WHERE key_suffix = ?").bind(sfx).first(),
        db.prepare("SELECT COALESCE(SUM(prompt_tokens),0) as p, COALESCE(SUM(completion_tokens),0) as comp, COALESCE(SUM(total_tokens),0) as t FROM usage_log WHERE key_suffix = ? AND created_at >= ?").bind(sfx, todayStart).first(),
        db.prepare("SELECT COALESCE(SUM(prompt_tokens),0) as p, COALESCE(SUM(completion_tokens),0) as comp, COALESCE(SUM(total_tokens),0) as t FROM usage_log WHERE key_suffix = ?").bind(sfx).first(),
      ]);
      return {
        key: k.key, name: k.name, user_id: k.user_id, enabled: !!k.enabled,
        rpm: k.rpm, total_limit: k.total_limit,
        total_used: (tr as any)?.c || 0,
        tokens: {
          today: { prompt: (dt as any)?.p || 0, completion: (dt as any)?.comp || 0, total: (dt as any)?.t || 0 },
          all: { prompt: (at as any)?.p || 0, completion: (at as any)?.comp || 0, total: (at as any)?.t || 0 },
        },
      };
    }));

    const allSfx = keys.results.map((k: any) => k.key.slice(-8));
    let model_usage: any[] = [];
    if (allSfx.length > 0) {
      const ph = allSfx.map(() => "?").join(",");
      const ms = await db.prepare(`SELECT model, SUM(CASE WHEN created_at >= ? THEN total_tokens ELSE 0 END) as today_tokens, SUM(total_tokens) as all_tokens, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today_requests, COUNT(*) as all_requests FROM usage_log WHERE key_suffix IN (${ph}) GROUP BY model ORDER BY all_tokens DESC`).bind(todayStart, todayStart, ...allSfx).all();
      model_usage = ms.results;
    }
    return j({ stats, model_usage, date: today });
  }

  // ===== USERS =====
  if (path === "/api/users" && method === "GET") {
    if (!currentUser || currentUser.role !== "admin") return j({ error: "无权限" }, 403);
    const users = await db.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC").all();
    // 附加每个用户的密钥数和订单数
    const enriched = await Promise.all(users.results.map(async (u: any) => {
      const [keyCount, orderCount, activeOrder] = await Promise.all([
        db.prepare("SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?").bind(u.id).first(),
        db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'paid'").bind(u.id).first(),
        db.prepare("SELECT plan_id, expires_at FROM orders WHERE user_id = ? AND status = 'paid' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1").bind(u.id, new Date().toISOString()).first(),
      ]);
      return { ...u, key_count: (keyCount as any)?.c || 0, order_count: (orderCount as any)?.c || 0, active_plan: (activeOrder as any)?.plan_id || null, plan_expires: (activeOrder as any)?.expires_at || null };
    }));
    return j({ users: enriched });
  }

  // 删除用户
  if (path.startsWith("/api/users/") && method === "DELETE") {
    if (!currentUser || currentUser.role !== "admin") return j({ error: "无权限" }, 403);
    const userId = decodeURIComponent(path.replace("/api/users/", ""));
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
    if (!user) return j({ error: "用户不存在" }, 404);
    // 删除用户的密钥、订单、用户记录
    await db.prepare("DELETE FROM api_keys WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM orders WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    return j({ success: true });
  }

  // 查看用户订单
  if (path === "/api/admin/orders" && method === "GET") {
    if (!currentUser || currentUser.role !== "admin") return j({ error: "无权限" }, 403);
    const userId = url.searchParams.get("user_id");
    const orders = userId
      ? await db.prepare("SELECT o.*, p.name as plan_name FROM orders o LEFT JOIN plans p ON o.plan_id = p.id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50").bind(userId).all()
      : await db.prepare("SELECT o.*, p.name as plan_name, u.email as user_email FROM orders o LEFT JOIN plans p ON o.plan_id = p.id LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 100").all();
    return j({ orders: orders.results });
  }

  // 平台统计概览
  if (path === "/api/admin/overview" && method === "GET") {
    if (!currentUser || currentUser.role !== "admin") return j({ error: "无权限" }, 403);
    // 顺便清理过期数据（>24h 的登录记录和已用/过期验证码）
    const cleanupTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    context.waitUntil(Promise.all([
      db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").bind(cleanupTime).run(),
      db.prepare("DELETE FROM email_codes WHERE (used != 0 OR expires_at < ?) AND created_at < ?").bind(new Date().toISOString(), cleanupTime).run(),
    ]));
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00`;
    const [userCount, keyCount, orderCount, todayRevenue, totalRevenue, todayRequests] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM users").first(),
      db.prepare("SELECT COUNT(*) as c FROM api_keys").first(),
      db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'paid'").first(),
      db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status = 'paid' AND paid_at >= ?").bind(todayStart).first(),
      db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE status = 'paid'").first(),
      db.prepare("SELECT COUNT(*) as c FROM usage_log WHERE created_at >= ?").bind(todayStart).first(),
    ]);
    return j({
      users: (userCount as any)?.c || 0,
      keys: (keyCount as any)?.c || 0,
      paid_orders: (orderCount as any)?.c || 0,
      today_revenue: (todayRevenue as any)?.s || 0,
      total_revenue: (totalRevenue as any)?.s || 0,
      today_requests: (todayRequests as any)?.c || 0,
    });
  }

  // ===== PLANS =====
  if (path === "/api/plans" && method === "GET") {
    const plans = await db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order").all();
    return j({ plans: plans.results });
  }

  // ===== ORDERS / PAYMENT =====
  if (path === "/api/orders" && method === "GET") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const userId = currentUser.role === "admin" ? (url.searchParams.get("user_id") || undefined) : currentUser.userId;
    const orders = userId
      ? await db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all()
      : await db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all();
    return j({ orders: orders.results });
  }

  // 创建支付订单
  if (path === "/api/pay/create" && method === "POST") {
    if (!currentUser) return j({ error: "未登录" }, 401);
    const { plan_id, key_id } = (await request.json()) as any;
    if (!plan_id) return j({ error: "请选择套餐" }, 400);

    const plan = await db.prepare("SELECT * FROM plans WHERE id = ? AND active = 1").bind(plan_id).first() as any;
    if (!plan) return j({ error: "套餐不存在" }, 404);
    if (plan.price <= 0) return j({ error: "免费套餐无需购买" }, 400);
    if (!cfg.EPAY_URL || !cfg.EPAY_PID || !cfg.EPAY_KEY) {
      return j({ error: "Payment configuration not set. Set EPAY_URL, EPAY_PID, and EPAY_KEY." }, 500);
    }

    // 验证密钥归属
    if (key_id) {
      const keyData = await db.prepare("SELECT * FROM api_keys WHERE key = ? AND user_id = ?").bind(key_id, currentUser.userId).first();
      if (!keyData && currentUser.role !== "admin") return j({ error: "密钥不存在" }, 404);
    }

    const orderId = crypto.randomUUID();
    const outTradeNo = `WX${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await db.prepare("INSERT INTO orders (id, user_id, plan_id, out_trade_no, amount, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
      .bind(orderId, currentUser.userId, plan_id, outTradeNo, plan.price, now).run();

    // 如果有指定 key_id，存到 param 中
    const paramStr = key_id || "";

    // 构建易支付参数
    const payParams: Record<string, string> = {
      pid: cfg.EPAY_PID,
      type: "",
      out_trade_no: outTradeNo,
      notify_url: `${url.origin}/api/pay/notify`,
      return_url: `${url.origin}/tokens`,
      name: `${cfg.BRAND_NAME} - ${plan.name}`,
      money: plan.price.toFixed(2),
      param: paramStr,
    };
    const sign = await epaySignAsync(payParams, cfg.EPAY_KEY);
    payParams.sign = sign;
    payParams.sign_type = "MD5";

    // 拼接跳转 URL
    const payUrl = `${cfg.EPAY_URL}/submit.php?` + Object.entries(payParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

    return j({ order_id: orderId, out_trade_no: outTradeNo, pay_url: payUrl });
  }

  // 易支付异步通知
  if (path === "/api/pay/notify" && method === "GET") {
    if (!cfg.EPAY_KEY) return new Response("payment config missing", { status: 500 });
    const params: Record<string, string> = {};
    for (const [k, v] of url.searchParams.entries()) params[k] = v;

    // 验签
    const receivedSign = params.sign || "";
    const expectedSign = await epaySignAsync(params, cfg.EPAY_KEY);
    if (receivedSign !== expectedSign) return new Response("sign error", { status: 400 });

    if (params.trade_status !== "TRADE_SUCCESS") return new Response("success");

    const outTradeNo = params.out_trade_no;
    const order = await db.prepare("SELECT * FROM orders WHERE out_trade_no = ?").bind(outTradeNo).first() as any;
    if (!order) return new Response("order not found");
    if (order.status === "paid") return new Response("success"); // 已处理

    const plan = await db.prepare("SELECT * FROM plans WHERE id = ?").bind(order.plan_id).first() as any;
    if (!plan) return new Response("plan not found");

    // 验证金额匹配（防止篡改）
    const paidAmount = parseFloat(params.money || "0");
    if (Math.abs(paidAmount - order.amount) > 0.01) return new Response("amount mismatch", { status: 400 });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
    const keyId = params.param || ""; // 指定的密钥

    // 更新订单状态
    await db.prepare("UPDATE orders SET status = 'paid', trade_no = ?, pay_type = ?, paid_at = ?, expires_at = ? WHERE id = ?")
      .bind(params.trade_no || "", params.type || "", now.toISOString(), expiresAt, order.id).run();

    // 升级密钥
    if (keyId) {
      // 升级指定密钥：叠加总限额
      await db.prepare("UPDATE api_keys SET plan_id = ?, rpm = ?, total_limit = total_limit + ? WHERE key = ? AND user_id = ?")
        .bind(plan.id, plan.rpm, plan.total_limit, keyId, order.user_id).run();
    } else {
      // 升级用户的第一个密钥
      const firstKey = await db.prepare("SELECT key FROM api_keys WHERE user_id = ? ORDER BY created_at LIMIT 1").bind(order.user_id).first() as any;
      if (firstKey) {
        await db.prepare("UPDATE api_keys SET plan_id = ?, rpm = ?, total_limit = total_limit + ? WHERE key = ?")
          .bind(plan.id, plan.rpm, plan.total_limit, firstKey.key).run();
      }
    }

    return new Response("success");
  }

  // 易支付页面跳转回调
  if (path === "/api/pay/return" && method === "GET") {
    // 跳转到前端
    return Response.redirect(`${url.origin}/tokens`, 302);
  }

  // ===== API PROXY /v1/* =====
  if (path === "/v1/models" && method === "GET") {
    const resp = await fetch(`${cfg.REAL_API_BASE}/v1/models`, { headers: { Authorization: `Bearer ${cfg.REAL_API_KEY}` } });
    return new Response(await resp.text(), { status: resp.status, headers: { ...cors, "Content-Type": "application/json" } });
  }

  if (path.startsWith("/v1/")) {
    const subKey = (request.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!subKey) return j({ error: { message: "Missing API key", code: "invalid_api_key" } }, 401);

    const tokenData = await db.prepare("SELECT * FROM api_keys WHERE key = ?").bind(subKey).first() as any;
    if (!tokenData) return j({ error: { message: "Invalid API key", code: "invalid_api_key" } }, 401);
    if (!tokenData.enabled) return j({ error: { message: "API key disabled", code: "api_key_disabled" } }, 403);

    // 总量检查
    if (tokenData.total_limit > 0 && (tokenData.total_used || 0) >= tokenData.total_limit) {
      return j({ error: { message: "Total quota exhausted. Please upgrade your plan.", code: "rate_limit_exceeded" } }, 429);
    }

    const suffix = subKey.slice(-8);
    const minuteAgo = new Date(Date.now() - 60000).toISOString();

    const rpmRow = await db.prepare("SELECT COUNT(*) as c FROM usage_log WHERE key_suffix = ? AND created_at >= ?").bind(suffix, minuteAgo).first() as any;
    if ((rpmRow?.c || 0) >= tokenData.rpm) return j({ error: { message: `Rate limit: ${tokenData.rpm} RPM`, code: "rate_limit_exceeded" } }, 429);



    let bodyText: string | null = null;
    let model = "unknown";
    if (method === "POST") { try { bodyText = await request.text(); model = JSON.parse(bodyText).model || "unknown"; } catch {} }

    const newHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      if (!["host", "cf-connecting-ip", "cf-ray", "cf-ipcountry", "cf-visitor"].includes(k.toLowerCase())) newHeaders.set(k, v);
    }
    newHeaders.set("Authorization", `Bearer ${cfg.REAL_API_KEY}`);

    const resp = await fetch(`${cfg.REAL_API_BASE}${path}${url.search}`, {
      method, headers: newHeaders,
      body: bodyText || (method !== "GET" && method !== "HEAD" ? request.body : undefined),
    });
    const respHeaders = new Headers(resp.headers);
    respHeaders.set("Access-Control-Allow-Origin", "*");

    const isStream = (resp.headers.get("content-type") || "").includes("text/event-stream");

    if (isStream && resp.body) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = resp.body.getReader();
      const pb = bodyText || ""; const rm = model;

      context.waitUntil((async () => {
        const dec = new TextDecoder();
        let compChars = 0, sseBuffer = "", realUsage: any = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
            sseBuffer += dec.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const p = JSON.parse(payload);
                if (p.usage) realUsage = p.usage;
                const d = p.choices?.[0]?.delta;
                if (d?.content) compChars += d.content.length;
                if (d?.reasoning_content) compChars += d.reasoning_content.length;
              } catch {}
            }
          }
          if (sseBuffer.startsWith("data: ")) {
            const p = sseBuffer.slice(6).trim();
            if (p !== "[DONE]") { try { const x = JSON.parse(p); if (x.usage) realUsage = x.usage; } catch {} }
          }
        } catch {} finally { try { await writer.close(); } catch {} }

        let pt = 0, ct = 0, tt = 0;
        if (realUsage?.total_tokens > 0) { pt = realUsage.prompt_tokens || 0; ct = realUsage.completion_tokens || 0; tt = realUsage.total_tokens; }
        else if (compChars > 0) { pt = estimatePromptTokens(pb); ct = Math.max(1, Math.ceil(compChars / 2.5)); tt = pt + ct; }
        await db.prepare("INSERT INTO usage_log (key_suffix, model, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(suffix, rm, pt, ct, tt, new Date().toISOString()).run();
        // 增加总用量
        await db.prepare("UPDATE api_keys SET total_used = total_used + 1 WHERE key = ?").bind(subKey).run();
      })());

      return new Response(readable, { status: resp.status, headers: respHeaders });
    } else {
      const bodyResp = await resp.text();
      let pt = 0, ct = 0, tt = 0;
      try {
        const p = JSON.parse(bodyResp);
        if (p.usage?.total_tokens > 0) { pt = p.usage.prompt_tokens || 0; ct = p.usage.completion_tokens || 0; tt = p.usage.total_tokens; }
        else if (p.choices?.[0]?.message?.content) { pt = estimatePromptTokens(bodyText || ""); ct = Math.max(1, Math.ceil(p.choices[0].message.content.length / 2.5)); tt = pt + ct; }
      } catch {}
      context.waitUntil(Promise.all([
        db.prepare("INSERT INTO usage_log (key_suffix, model, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(suffix, model, pt, ct, tt, new Date().toISOString()).run(),
        db.prepare("UPDATE api_keys SET total_used = total_used + 1 WHERE key = ?").bind(subKey).run(),
      ]));
      return new Response(bodyResp, { status: resp.status, headers: respHeaders });
    }
  }

  return context.next();
};
