import { NextResponse } from "next/server"
import { loadCurrentUserAppData } from "@/lib/server/app-data"

export async function GET() {
  try {
    const data = await loadCurrentUserAppData()
    if (!data) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    return NextResponse.json({
      authenticated: true,
      ...data,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[home-data] load failed:", message)
    return NextResponse.json(
      {
        authenticated: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
