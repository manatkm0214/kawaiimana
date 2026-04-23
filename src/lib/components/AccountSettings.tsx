"use client"

import { useState } from "react"
import { useLang } from "@/lib/hooks/useLang"
import type { Profile } from "@/lib/utils"

const GUEST_DISPLAY_NAME_KEY = "kakeibo-guest-display-name"

interface Props {
  user: {
    id: string
    email?: string | null
  }
  profile: Profile | null
  isAnonymous?: boolean
  onClose: () => void
  onProfileUpdated: (nextProfile: Profile) => void
}

export default function AccountSettings({ profile, isAnonymous, onClose, onProfileUpdated }: Props) {
  const lang = useLang()
  const t = (ja: string, en: string) => (lang === "en" ? en : ja)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSaveProfile() {
    setMessage(null)
    setSavingProfile(true)
    const trimmed = displayName.trim() || null

    try {
      if (isAnonymous) {
        if (trimmed && typeof window !== "undefined") {
          window.localStorage.setItem(GUEST_DISPLAY_NAME_KEY, trimmed)
        }
        const next: Profile = {
          id: profile?.id ?? "guest-profile",
          display_name: trimmed,
          currency: profile?.currency ?? "JPY",
          created_at: profile?.created_at ?? new Date().toISOString(),
          allocation_take_home: profile?.allocation_take_home ?? null,
          allocation_target_fixed_rate: profile?.allocation_target_fixed_rate ?? null,
          allocation_target_variable_rate: profile?.allocation_target_variable_rate ?? null,
          allocation_target_savings_rate: profile?.allocation_target_savings_rate ?? null,
        }
        onProfileUpdated(next)
        onClose()
        return
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: trimmed,
          currency: profile?.currency ?? "JPY",
          allocation_take_home: profile?.allocation_take_home ?? null,
          allocation_target_fixed_rate: profile?.allocation_target_fixed_rate ?? null,
          allocation_target_variable_rate: profile?.allocation_target_variable_rate ?? null,
          allocation_target_savings_rate: profile?.allocation_target_savings_rate ?? null,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.profile) {
        setMessage({ type: "error", text: result.error ?? t("保存に失敗しました。", "Could not save your profile.") })
        return
      }
      onProfileUpdated(result.profile)
      onClose()
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-[28px] p-6 space-y-5 shadow-2xl"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.97), rgba(253,242,248,0.94) 60%, rgba(239,246,255,0.94) 100%)",
          border: "1.5px solid rgba(244,114,182,0.22)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{t("アカウント", "Account")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            {t("閉じる", "Close")}
          </button>
        </div>

        {message && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 border border-emerald-300 text-emerald-800" : "bg-rose-50 border border-rose-300 text-rose-800"}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            {t("表示名", "Display name")}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("例: まな", "e.g. Mana")}
            className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="w-full rounded-full py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #EC4899, #FB7185 52%, #60A5FA 100%)" }}
        >
          {savingProfile ? t("保存中...", "Saving...") : t("保存する", "Save")}
        </button>
      </div>
    </div>
  )
}
