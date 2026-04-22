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

function verifyState(state: string, secret: string): boolean {
  try {
    const dotIndex = state.lastIndexOf(".")
    if (dotIndex === -1) return false
    const body = state.slice(0, dotIndex)
    const sig = state.slice(dotIndex + 1)
    const expected = createHmac("sha256", secret).update(body).digest("base64url")
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

function signSessionCookie(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(data).digest("base64url")
  return `${data}.${sig}`
}

async function findOrCreateSupabaseUser(email: string, displayName: string, lineUserId: string): Promise<{ id: string | null; error: string | null }> {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName, line_id: lineUserId },
  })

  if (!createError && createData?.user) {
    return { id: createData.user.id, error: null }
  }

  const isAlreadyExists = createError?.message?.toLowerCase().includes("already")
  if (createError && !isAlreadyExists) {
    return { id: null, error: `createUser失敗: ${createError.message}` }
  }

  // Already exists — find by email
  let page = 1
  while (page <= 5) {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (listError) return { id: null, error: `listUsers失敗: ${listError.message}` }
    const found = listData?.users?.find((u) => u.email === email)
    if (found) return { id: found.id, error: null }
    if ((listData?.users?.length ?? 0) < 1000) break
    page++
  }

  return { id: null, error: "ユーザーが見つかりませんでした" }
}

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin
  const homeUrl = new URL("/", baseUrl)

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const oauthError = request.nextUrl.searchParams.get("error")

  if (oauthError || !code) {
    homeUrl.searchParams.set("auth_error", oauthError ?? "LINEログインがキャンセルされました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const clientId = readEnv("LINE_CHANNEL_ID")
  const clientSecret = readEnv("LINE_CHANNEL_SECRET")
  const sessionSecret = readEnv("AUTH0_SECRET") || clientSecret

  if (!clientId || !clientSecret) {
    homeUrl.searchParams.set("auth_error", "LINE設定が不正です（環境変数未設定）")
    return NextResponse.redirect(homeUrl.toString())
  }

  if (state && !verifyState(state, clientSecret)) {
    homeUrl.searchParams.set("auth_error", "不正なリクエストです（stateエラー）")
    return NextResponse.redirect(homeUrl.toString())
  }

  // Exchange code for LINE token
  const redirectUri = `${baseUrl}/api/auth/line/callback`
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
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
    homeUrl.searchParams.set("auth_error", `LINEトークン取得失敗: ${body.slice(0, 100)}`)
    return NextResponse.redirect(homeUrl.toString())
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  // Get LINE profile
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!profileRes.ok) {
    homeUrl.searchParams.set("auth_error", "LINEプロフィール取得に失敗しました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const lineProfile = await profileRes.json() as { userId: string; displayName: string; pictureUrl?: string }
  const lineUserId = lineProfile.userId
  const displayName = lineProfile.displayName ?? ""
  const picture = lineProfile.pictureUrl ?? null

  const safeLineId = lineUserId.replace(/[^a-zA-Z0-9]/g, "")
  const email = `line_${safeLineId}@line.placeholder`

  const { id: supabaseUserId, error: userError } = await findOrCreateSupabaseUser(email, displayName, lineUserId)
  if (!supabaseUserId) {
    homeUrl.searchParams.set("auth_error", `Supabaseエラー: ${userError ?? "不明"}`)
    return NextResponse.redirect(homeUrl.toString())
  }

  // Create signed session cookie
  const payload = {
    supabaseUserId,
    email,
    name: displayName || null,
    picture,
    auth0Sub: `line|${lineUserId}`,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  }

  const cookieValue = signSessionCookie(payload, sessionSecret)

  const response = NextResponse.redirect(homeUrl.toString())
  response.cookies.set("line_session", cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
