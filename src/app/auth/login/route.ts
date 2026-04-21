import { NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"

const ALLOWED_CONNECTIONS = new Set([
  "google-oauth2",
  "line",
  "Username-Password-Authentication",
])

export async function GET(request: NextRequest) {
  const requestedConnection = request.nextUrl.searchParams.get("connection")?.trim()
  const requestedScreenHint = request.nextUrl.searchParams.get("screen_hint")?.trim()
  const connection = requestedConnection && ALLOWED_CONNECTIONS.has(requestedConnection) ? requestedConnection : undefined
  const screenHint = requestedScreenHint === "signup" || requestedScreenHint === "login" ? requestedScreenHint : undefined

  return auth0.startInteractiveLogin({
    authorizationParameters: {
      ...(connection ? { connection } : {}),
      ...(screenHint ? { screen_hint: screenHint } : {}),
    },
    returnTo: "/",
  })
}
