import { createHmac } from "crypto"
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
    return sig === expected
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin
  const homeUrl = new URL("/", baseUrl)

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")

  if (error || !code) {
    homeUrl.searchParams.set("auth_error", error ?? "LINEログインがキャンセルされました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const clientId = readEnv("LINE_CHANNEL_ID")
  const clientSecret = readEnv("LINE_CHANNEL_SECRET")

  if (!clientId || !clientSecret) {
    homeUrl.searchParams.set("auth_error", "LINE設定が不正です")
    return NextResponse.redirect(homeUrl.toString())
  }

  if (state && !verifyState(state, clientSecret)) {
    homeUrl.searchParams.set("auth_error", "不正なリクエストです")
    return NextResponse.redirect(homeUrl.toString())
  }

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
    homeUrl.searchParams.set("auth_error", "LINEトークン取得に失敗しました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

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

  const email = `line_${lineUserId}@line.placeholder`
  const supabaseAdmin = getSupabaseAdmin()

  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = listData?.users?.find((u) => u.email === email)

  if (!existingUser) {
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName, line_id: lineUserId },
    })
    if (createError) {
      homeUrl.searchParams.set("auth_error", "ユーザー作成に失敗しました")
      return NextResponse.redirect(homeUrl.toString())
    }
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/` },
  })

  if (linkError ?? !linkData?.properties?.hashed_token) {
    homeUrl.searchParams.set("auth_error", "ログインリンクの生成に失敗しました")
    return NextResponse.redirect(homeUrl.toString())
  }

  const confirmUrl = new URL("/auth/confirm", baseUrl)
  confirmUrl.searchParams.set("token_hash", linkData.properties.hashed_token)
  confirmUrl.searchParams.set("type", "magiclink")
  confirmUrl.searchParams.set("next", "/")
  return NextResponse.redirect(confirmUrl.toString())
}
