import { Auth0Client } from "@auth0/nextjs-auth0/server"
import { NextResponse } from "next/server"
import { getAllowedAppBaseUrls } from "@/lib/auth/app-base-url"

const appBaseUrl = getAllowedAppBaseUrls() ?? process.env.APP_BASE_URL ?? "https://kawaii0214.vercel.app"

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl,
  authorizationParameters: {
    scope: "openid profile email",
  },
  signInReturnToPath: "/",
  logoutStrategy: "v2",
  onCallback: async (error, ctx) => {
    const base = typeof appBaseUrl === "string" ? appBaseUrl : appBaseUrl[0]
    if (error) {
      console.error("[auth0/callback] error:", error.message)
      const url = new URL("/", base)
      url.searchParams.set("auth_error", error.message)
      return NextResponse.redirect(url.toString())
    }
    const returnTo = ctx.returnTo ?? "/"
    const redirectUrl = returnTo.startsWith("http") ? returnTo : new URL(returnTo, base).toString()
    return NextResponse.redirect(redirectUrl)
  },
})
