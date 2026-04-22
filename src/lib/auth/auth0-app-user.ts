import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { auth0 } from "@/lib/auth0"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export interface AppSessionUser {
  auth0Sub: string
  email: string
  name: string | null
  picture: string | null
  supabaseUserId: string
}

let warnedMissingAuth0ProfileColumns = false

function warnMissingAuth0ProfileColumns(context: string) {
  if (warnedMissingAuth0ProfileColumns) return
  warnedMissingAuth0ProfileColumns = true
  console.warn(
    `[auth0-profile-binding] ${context}; apply supabase_auth0_profile_binding_migration.sql to enable stable Auth0 subject binding.`
  )
}

async function findSupabaseAuthUserByEmail(email: string) {
  const supabaseAdmin = getSupabaseAdmin()
  let page = 1

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) {
      throw new Error(`Could not look up Supabase auth user: ${error.message}`)
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email)
    if (match) {
      return {
        id: match.id,
        email: match.email ?? email,
      }
    }

    if (data.users.length < 100) {
      break
    }

    page += 1
  }

  return null
}

async function ensureSupabaseAuthUser(email: string, name: string | null) {
  const supabaseAdmin = getSupabaseAdmin()
  const existing = await findSupabaseAuthUserByEmail(email)
  if (existing?.id) {
    return existing.id
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  })

  if (error || !data.user) {
    throw new Error(`Could not create Supabase auth user: ${error?.message ?? "Unknown error"}`)
  }

  return data.user.id
}

function isMissingAuth0ProfileColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return message.includes("column") && (message.includes("auth0_sub") || message.includes("email"))
}

function readDisplayName(profile: { display_name?: string | null } | null) {
  const displayName = typeof profile?.display_name === "string" ? profile.display_name.trim() : ""
  return displayName || null
}

async function findProfileIdByAuth0Sub(auth0Sub: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("auth0_sub", auth0Sub)
    .maybeSingle()

  if (error) {
    if (isMissingAuth0ProfileColumnError(error)) {
      warnMissingAuth0ProfileColumns("profiles.auth0_sub/email columns are missing")
      return null
    }
    throw new Error(`Could not look up profile binding: ${error.message}`)
  }

  return (data as { id?: string } | null)?.id ?? null
}

async function ensureProfile(userId: string, name: string | null, email: string, auth0Sub: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()

  if (existingProfileError) {
    throw new Error(`Could not look up profile: ${existingProfileError.message}`)
  }

  const displayName = readDisplayName(existingProfile as { display_name?: string | null } | null) ?? name
  const profilePayload = {
    id: userId,
    display_name: displayName,
    email,
    auth0_sub: auth0Sub,
  }

  const { error } = await supabaseAdmin.from("profiles").upsert(
    profilePayload as never,
    { onConflict: "id" }
  )

  if (isMissingAuth0ProfileColumnError(error)) {
    warnMissingAuth0ProfileColumns("profile upsert fell back to legacy columns")
    const fallback = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
      } as never,
      { onConflict: "id" }
    )

    if (fallback.error) {
      throw new Error(`Could not prepare profile: ${fallback.error.message}`)
    }
    return
  }

  if (error) {
    throw new Error(`Could not prepare profile: ${error.message}`)
  }
}

interface LineSessionPayload {
  supabaseUserId: string
  email: string
  name: string | null
  picture: string | null
  auth0Sub: string
  exp: number
}

function verifyLineSessionCookie(cookieValue: string, secret: string): LineSessionPayload | null {
  try {
    const dotIndex = cookieValue.lastIndexOf(".")
    if (dotIndex === -1) return null
    const data = cookieValue.slice(0, dotIndex)
    const sig = cookieValue.slice(dotIndex + 1)
    const expected = createHmac("sha256", secret).update(data).digest("base64url")
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as LineSessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function getAppSessionUserFromLineCookie(): Promise<AppSessionUser | null> {
  try {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get("line_session")?.value
    if (!cookieValue) return null

    const secret = process.env.AUTH0_SECRET?.trim() || process.env.LINE_CHANNEL_SECRET?.trim() || ""
    if (!secret) return null

    const payload = verifyLineSessionCookie(cookieValue, secret)
    if (!payload) return null

    await ensureProfile(payload.supabaseUserId, payload.name, payload.email, payload.auth0Sub)

    return {
      auth0Sub: payload.auth0Sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      supabaseUserId: payload.supabaseUserId,
    }
  } catch {
    return null
  }
}

export async function getAppSessionUser(): Promise<AppSessionUser | null> {
  const session = await auth0.getSession()
  if (!session?.user) {
    return getAppSessionUserFromLineCookie()
  }

  const rawEmail = typeof session.user.email === "string" ? session.user.email.trim().toLowerCase() : ""
  const auth0Sub = typeof session.user.sub === "string" ? session.user.sub : ""

  if (!auth0Sub) {
    throw new Error("Auth0 session is missing a subject")
  }

  // LINEはemail_verifiedをtrueにしない & メールを提供しない場合がある
  // sub (LINE UID等) をフォールバックメールとして使用
  const isLineProvider = auth0Sub.startsWith("line|")
  const email = rawEmail || (isLineProvider ? `${auth0Sub.replace(/[^a-zA-Z0-9]/g, "_")}@line.placeholder` : "")

  if (!email) {
    throw new Error("Auth0 session is missing an email address")
  }

  // LINE・ソーシャルログインはemail_verifiedがfalseでも許可
  const emailVerified = session.user.email_verified === true || isLineProvider || !rawEmail
  if (!emailVerified) {
    throw new Error("Auth0 session email is not verified")
  }

  const name = typeof session.user.name === "string" && session.user.name.trim() ? session.user.name.trim() : null
  const picture = typeof session.user.picture === "string" && session.user.picture.trim() ? session.user.picture : null

  const linkedProfileId = await findProfileIdByAuth0Sub(auth0Sub)
  const supabaseUserId = linkedProfileId ?? await ensureSupabaseAuthUser(email, name)
  await ensureProfile(supabaseUserId, name, email, auth0Sub)

  return {
    auth0Sub,
    email,
    name,
    picture,
    supabaseUserId,
  }
}
