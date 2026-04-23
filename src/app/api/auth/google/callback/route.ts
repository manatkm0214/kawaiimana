import { createHmac, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const val = process.env[key]?.trim()
    if (val) return val
  }
  return ""
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10分

function verifyState(state: string, secret: string): boolean {
  try {
    const dotIndex = state.lastIndexOf(".")
    if (dotIndex === -1) return false
    const body = state.slice(0, dotIndex)
    const sig = state.slice(dotIndex + 1)
    const expected = createHmac("sha256", secret).update(body).digest("base64url")
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { ts?: number }
    if (!payload.ts || Date.now() - payload.ts > STATE_MAX_AGE_MS) return false
    return true
  } catch {
    return false
  }
}

function signSessionCookie(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(data).digest("base64url")
  return `${data}.${sig}`
}

async function findOrCreateSupabaseUser(email: string, displayName: string): Promise<{ id: string | null; error: string | null }> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { display_name: displayName } },
  })
  if (error) return { id: null, error: `generateLink失敗: ${error.message}` }
  const userId = data?.user?.id
  if (!userId) return { id: null, error: "userIDが取得できませんでした" }
  return { id: userId, error: null }
}

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin
  const homeUrl = new URL("/", baseUrl)

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const oauthError = request.nextUrl.searchParams.get("error")

  if (oauthError || !code) {
    homeUrl.searchParams.set("auth_error", oauthError ?? "Googleログインがキャンセルされました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const clientId = readEnv("GOOGLE_CLIENT_ID")
  const clientSecret = readEnv("GOOGLE_CLIENT_SECRET")
  const sessionSecret = readEnv("AUTH0_SECRET") || clientSecret

  if (!clientId || !clientSecret) {
    homeUrl.searchParams.set("auth_error", "Google設定が不正です（環境変数未設定）")
    return NextResponse.redirect(homeUrl.toString())
  }

  if (state && !verifyState(state, sessionSecret)) {
    homeUrl.searchParams.set("auth_error", "不正なリクエストです（stateエラー）")
    return NextResponse.redirect(homeUrl.toString())
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error("[google-callback] token error:", body)
    homeUrl.searchParams.set("auth_error", "Googleログインに失敗しました。しばらくしてから再度お試しください。")
    return NextResponse.redirect(homeUrl.toString())
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!profileRes.ok) {
    homeUrl.searchParams.set("auth_error", "Googleプロフィール取得に失敗しました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const profile = await profileRes.json() as { id: string; email: string; name?: string; picture?: string }
  const email = profile.email.trim().toLowerCase()
  const displayName = profile.name ?? ""
  const picture = profile.picture ?? null
  const googleUserId = profile.id

  const { id: supabaseUserId, error: userError } = await findOrCreateSupabaseUser(email, displayName)
  if (!supabaseUserId) {
    console.error("[google-callback] supabase error:", userError)
    homeUrl.searchParams.set("auth_error", "アカウントの作成に失敗しました。しばらくしてから再度お試しください。")
    return NextResponse.redirect(homeUrl.toString())
  }

  const payload = {
    supabaseUserId,
    email,
    name: displayName || null,
    picture,
    auth0Sub: `google|${googleUserId}`,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  }

  const cookieValue = signSessionCookie(payload, sessionSecret)
  const response = NextResponse.redirect(homeUrl.toString())
  response.cookies.set("google_session", cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
