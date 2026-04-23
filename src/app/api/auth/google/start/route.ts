import { createHmac, randomBytes } from "crypto"
import { NextResponse } from "next/server"

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const val = process.env[key]?.trim()
    if (val) return val
  }
  return ""
}

function signState(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export async function GET(request: Request) {
  const clientId = readEnv("GOOGLE_CLIENT_ID")
  const secret = readEnv("AUTH0_SECRET", "GOOGLE_CLIENT_SECRET")

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID が設定されていません" }, { status: 500 })
  }

  const baseUrl = new URL(request.url).origin
  const redirectUri = `${baseUrl}/api/auth/google/callback`
  const nonce = randomBytes(16).toString("hex")
  const state = signState({ nonce, ts: Date.now() }, secret)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email",
    state,
    nonce,
    prompt: "select_account",
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
