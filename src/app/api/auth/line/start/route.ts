import { createHmac, randomBytes } from "crypto"
import { NextResponse } from "next/server"

type SignedStatePayload = {
  nonce: string
  ts: number
}

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ""
}

function getBaseUrl(request?: Request): string {
  const siteUrl = readEnv("NEXT_PUBLIC_SITE_URL", "next_public_site_url")
  if (siteUrl) return siteUrl.replace(/\/$/, "")
  if (request) {
    const origin = new URL(request.url).origin
    if (origin) return origin.replace(/\/$/, "")
  }
  return "http://localhost:3000"
}

function getLineStateSecret(clientSecret: string) {
  return readEnv("LINE_STATE_SECRET", "line_state_secret") || clientSecret
}

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url")
}

function createSignedState(payload: SignedStatePayload, secret: string) {
  const body = encodeBase64Url(JSON.stringify(payload))
  const signature = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${signature}`
}

export async function GET(request: Request) {
  const clientId = readEnv("LINE_CHANNEL_ID", "line_channel_id")
  const clientSecret = readEnv("LINE_CHANNEL_SECRET", "line_channel_secret")

  if (!clientId) {
    return NextResponse.json({ error: "LINE_CHANNEL_ID が設定されていません。" }, { status: 500 })
  }

  if (!clientSecret) {
    return NextResponse.json({ error: "LINE_CHANNEL_SECRET が設定されていません。" }, { status: 500 })
  }

  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/line/callback`
  const nonce = randomBytes(16).toString("hex")
  const state = createSignedState(
    { nonce, ts: Date.now() },
    getLineStateSecret(clientSecret),
  )

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile email",
    nonce,
    prompt: "consent",
  })

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
