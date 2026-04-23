import { NextResponse } from "next/server"
import { getAppSessionUser, getAppSessionUserFromRequest } from "@/lib/auth/auth0-app-user"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { boundedText, readJsonBody } from "@/lib/server/security"

interface ProfilePayload {
  display_name?: string | null
  currency?: string | null
  allocation_take_home?: number | null
  allocation_target_fixed_rate?: number | null
  allocation_target_variable_rate?: number | null
  allocation_target_savings_rate?: number | null
}

function normalizeRate(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : Number.NaN
}

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  let user = null
  try {
    user = await getAppSessionUser()
  } catch {
    // Auth0 session not available, try request cookies directly
  }
  if (!user) {
    user = await getAppSessionUserFromRequest(request)
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized: no session" }, { status: 401 })
  }

  const parsed = await readJsonBody<ProfilePayload>(request, 8_000)
  if (parsed.response) return parsed.response

  const body = parsed.data
  const fixedRate = normalizeRate(body.allocation_target_fixed_rate)
  const variableRate = normalizeRate(body.allocation_target_variable_rate)
  const savingsRate = normalizeRate(body.allocation_target_savings_rate)
  const rates = [fixedRate, variableRate, savingsRate].filter((value): value is number => value !== null)

  if (rates.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return NextResponse.json({ error: "Invalid allocation rate" }, { status: 400 })
  }

  const takeHome = typeof body.allocation_take_home === "number" ? body.allocation_take_home : null
  if (takeHome !== null && (!Number.isFinite(takeHome) || takeHome < 0 || takeHome > 1_000_000_000)) {
    return NextResponse.json({ error: "Invalid take-home amount" }, { status: 400 })
  }

  const payload = {
    id: user.supabaseUserId,
    display_name: boundedText(body.display_name ?? user.name, 80),
    currency: boundedText(body.currency, 8) || "JPY",
    allocation_take_home: takeHome,
    allocation_target_fixed_rate: fixedRate,
    allocation_target_variable_rate: variableRate,
    allocation_target_savings_rate: savingsRate,
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload as never, { onConflict: "id" })
    .select()
    .single()

  if (error || !data) {
    console.error("[profile] upsert failed:", error)
    return NextResponse.json({ error: error?.message ?? "Could not save profile" }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
