import { NextRequest, NextResponse } from "next/server"
import { auth0 } from "@/lib/auth0"
import { getRequestAppBaseUrl } from "@/lib/auth/app-base-url"

export async function GET(request: NextRequest) {
  const base = getRequestAppBaseUrl(request)
  const homeUrl = new URL("/", base).toString()

  const deleteSocialCookies = (res: NextResponse) => {
    res.cookies.delete("line_session")
    res.cookies.delete("google_session")
    return res
  }

  try {
    const session = await auth0.getSession()
    if (session?.user) {
      // Auth0セッションあり → Auth0のログアウトフローへ（middlewareがsocialクッキーも削除）
      return NextResponse.redirect(new URL("/auth/logout", base).toString())
    }
  } catch {
    // Auth0セッション取得失敗はソーシャルユーザーとして扱う
  }

  // ソーシャルのみ → cookieを削除してホームへ
  return deleteSocialCookies(NextResponse.redirect(homeUrl))
}
