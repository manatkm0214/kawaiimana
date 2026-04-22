import type { NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"

export async function middleware(request: NextRequest) {
  const response = await auth0.middleware(request)

  // LINEセッションCookieをログアウト時に削除
  if (request.nextUrl.pathname === "/auth/logout") {
    response.cookies.delete("line_session")
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
