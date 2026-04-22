import { NextRequest, NextResponse } from "next/server"
import { getRequestAppBaseUrl } from "@/lib/auth/app-base-url"

export async function GET(request: NextRequest) {
  const base = getRequestAppBaseUrl(request)
  const response = NextResponse.redirect(new URL("/", base).toString())
  response.cookies.delete("line_session")
  return response
}
