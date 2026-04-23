import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, readJsonBody } from "@/lib/server/security"
import { sendEmailViaResend } from "@/lib/server/resend"

// Supabase send-email Auth Hook handler
// Configure in Supabase Dashboard → Authentication → Hooks → Send Email
// Set Hook URL to: https://<your-domain>/api/auth/send-email
// Set Hook Secret and copy it to SUPABASE_HOOK_SECRET env var

type EmailData = {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: "signup" | "recovery" | "invite" | "magic_link" | "email_change" | "email_otp"
  site_url: string
  token_new: string
  token_hash_new: string
}

type HookPayload = {
  user: {
    id: string
    email: string
  }
  email_data: EmailData
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  return atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4))
}

async function verifySupabaseHookJWT(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const [headerB64, payloadB64, signatureB64] = parts
    const header = JSON.parse(decodeBase64Url(headerB64)) as { alg?: string }
    const payload = JSON.parse(decodeBase64Url(payloadB64)) as {
      exp?: number
      nbf?: number
    }

    if (header.alg !== "HS256") return false
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === "number" && payload.exp < now) return false
    if (typeof payload.nbf === "number" && payload.nbf > now + 60) return false

    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"])

    const data = encoder.encode(`${headerB64}.${payloadB64}`)
    const sigBytes = Uint8Array.from(decodeBase64Url(signatureB64), (c) =>
      c.charCodeAt(0),
    )

    return await crypto.subtle.verify("HMAC", key, sigBytes, data)
  } catch {
    return false
  }
}

function buildConfirmationEmail(email: string, link: string): { subject: string; html: string } {
  const subject = "【家計マスター】メールアドレスを確認してください"
  const safeLink = escapeHtml(link)
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Hiragino Sans','Meiryo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
          <p style="margin:0;font-size:28px">💰</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:bold">家計マスター</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b">メールアドレスの確認</h2>
          <p style="margin:0 0 24px;color:#475569;line-height:1.7">
            ご登録ありがとうございます！<br>
            下のボタンをクリックしてメールアドレスを確認し、登録を完了してください。
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center">
              <a href="${safeLink}" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">メールアドレスを確認する</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">ボタンが使えない場合は以下のURLをブラウザに貼り付けてください：</p>
          <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#6366f1">${safeLink}</p>
          <p style="margin:0;color:#94a3b8;font-size:12px">このメールに心当たりがない場合は無視してください。</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">© 2024 家計マスター</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, html }
}

function buildOtpEmail(email: string, token: string): { subject: string; html: string } {
  const subject = "【家計マスター】ログイン用PINコード"
  const safeToken = escapeHtml(token)
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Hiragino Sans','Meiryo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
          <p style="margin:0;font-size:28px">🔐</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:bold">家計マスター</h1>
        </td></tr>
        <tr><td style="padding:32px;text-align:center">
          <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">ログイン用PINコード</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:15px">以下の6桁PINをアプリに入力してください</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin:0 auto 24px;display:inline-block;min-width:200px">
            <p style="margin:0;font-size:42px;font-weight:bold;letter-spacing:10px;color:#6366f1;font-family:monospace">${safeToken}</p>
          </div>
          <p style="margin:0 0 8px;color:#ef4444;font-size:13px;font-weight:bold">⏱ このコードは10分で失効します</p>
          <p style="margin:0;color:#94a3b8;font-size:12px">このメールに心当たりがない場合は無視してください。</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">© 2024 家計マスター</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, html }
}

function buildMagicLinkEmail(link: string): { subject: string; html: string } {
  const subject = "【家計マスター】ログイン用メールリンク"
  const safeLink = escapeHtml(link)
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Hiragino Sans','Meiryo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
          <p style="margin:0;font-size:28px">🔗</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:bold">家計マスター</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b">ログイン用リンク</h2>
          <p style="margin:0 0 24px;color:#475569;line-height:1.7">
            下のボタンをタップするとログインできます。<br>
            このリンクは時間経過で無効になります。
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center">
              <a href="${safeLink}" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">ログインする</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">ボタンが使えない場合は以下のURLをブラウザに貼り付けてください：</p>
          <p style="margin:0 0 24px;word-break:break-all;font-size:12px;color:#6366f1">${safeLink}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, html }
}

function getAppOrigin(siteUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const rawUrl = configured || siteUrl || ""
  try {
    const url = new URL(rawUrl)
    return url.origin
  } catch {
    return ""
  }
}

function buildPasswordResetEmail(link: string): { subject: string; html: string } {
  const subject = "【家計マスター】パスワード再設定"
  const safeLink = escapeHtml(link)
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Hiragino Sans','Meiryo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
          <p style="margin:0;font-size:28px">🔑</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:bold">家計マスター</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:18px;color:#1e293b">パスワード再設定</h2>
          <p style="margin:0 0 24px;color:#475569;line-height:1.7">
            パスワード再設定のリクエストを受け付けました。<br>
            下のボタンをクリックして新しいパスワードを設定してください。
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
            <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center">
              <a href="${safeLink}" style="display:block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">パスワードを再設定する</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px">このリンクは1時間で失効します。</p>
          <p style="margin:0;color:#94a3b8;font-size:12px">このメールに心当たりがない場合は無視してください。</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">© 2024 家計マスター</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, html }
}

export async function POST(req: NextRequest) {
  const hookSecret = process.env.SUPABASE_HOOK_SECRET?.trim()
  const skipHookVerification = process.env.SUPABASE_HOOK_SKIP_VERIFY === "true"
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.EMAIL_FROM?.trim()

  if (!resendApiKey) {
    console.error("[send-email hook] RESEND_API_KEY not set")
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
  }

  if (!fromEmail) {
    console.error("[send-email hook] EMAIL_FROM not set")
    return NextResponse.json({ error: "Sender is not configured" }, { status: 500 })
  }

  if (!hookSecret) {
    console.error("[send-email hook] SUPABASE_HOOK_SECRET not set")
    return NextResponse.json({ error: "Hook signature is not configured" }, { status: 500 })
  }

  if (skipHookVerification && process.env.NODE_ENV === "production") {
    console.error("[send-email hook] Refusing SUPABASE_HOOK_SKIP_VERIFY=true in production")
    return NextResponse.json({ error: "Hook signature verification is required" }, { status: 500 })
  }

  if (!skipHookVerification) {
    const authHeader = req.headers.get("authorization") ?? ""
    const signatureHeader = req.headers.get("x-supabase-signature") ?? ""
    const token = authHeader.replace(/^Bearer\s+/i, "") || signatureHeader
    if (!token) {
      console.warn("[send-email hook] Missing hook signature header")
      return NextResponse.json({ error: "Missing hook signature" }, { status: 401 })
    }

    const valid = await verifySupabaseHookJWT(token, hookSecret)
    if (!valid) {
      console.error("[send-email hook] Invalid hook signature")
      return NextResponse.json({ error: "Invalid hook signature" }, { status: 401 })
    }
  } else if (hookSecret && skipHookVerification) {
    console.warn("[send-email hook] Signature verification skipped by SUPABASE_HOOK_SKIP_VERIFY=true")
  }

  const parsed = await readJsonBody<HookPayload>(req, 32_000)
  if (parsed.response) return parsed.response
  const payload = parsed.data

  const userEmail = payload?.user?.email
  const emailData = payload?.email_data

  if (!userEmail || !emailData) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { token, token_hash, redirect_to, email_action_type, site_url } = emailData
  const appOrigin = getAppOrigin(site_url)

  if (!appOrigin) {
    return NextResponse.json({ error: "Invalid app origin" }, { status: 400 })
  }

  let subject: string
  let html: string

  if (email_action_type === "signup" || email_action_type === "invite" || email_action_type === "email_change") {
    // Build confirmation link from token_hash
    const confirmUrl = new URL("/auth/confirm", appOrigin)
    confirmUrl.searchParams.set("token_hash", token_hash)
    confirmUrl.searchParams.set("type", email_action_type)
    confirmUrl.searchParams.set("next", redirect_to)
    ;({ subject, html } = buildConfirmationEmail(userEmail, confirmUrl.toString()))
  } else if (email_action_type === "recovery") {
    const recoveryUrl = new URL("/auth/confirm", appOrigin)
    recoveryUrl.searchParams.set("token_hash", token_hash)
    recoveryUrl.searchParams.set("type", "recovery")
    recoveryUrl.searchParams.set("next", redirect_to)
    ;({ subject, html } = buildPasswordResetEmail(recoveryUrl.toString()))
  } else if (email_action_type === "magic_link") {
    const magicLinkUrl = new URL("/auth/confirm", appOrigin)
    magicLinkUrl.searchParams.set("token_hash", token_hash)
    magicLinkUrl.searchParams.set("type", "magiclink")
    magicLinkUrl.searchParams.set("next", redirect_to)
    ;({ subject, html } = buildMagicLinkEmail(magicLinkUrl.toString()))
  } else {
    // email_otp — send PIN token directly
    ;({ subject, html } = buildOtpEmail(userEmail, token))
  }

  const result = await sendEmailViaResend({
    apiKey: resendApiKey,
    from: fromEmail,
    to: userEmail,
    subject,
    html,
  })

  if (!result.ok) {
    console.error("[send-email hook] Resend error:", result.error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }

  console.log(`[send-email hook] Email sent: action=${email_action_type}, to=${userEmail}`)

  return NextResponse.json({})
}
