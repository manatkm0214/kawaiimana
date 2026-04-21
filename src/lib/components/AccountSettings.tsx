"use client"

import { useState } from "react"
import { useLang } from "@/lib/hooks/useLang"
import type { Profile } from "@/lib/utils"

interface Props {
  user: {
    id: string
    email?: string | null
  }
  profile: Profile | null
  onClose: () => void
  onProfileUpdated: (nextProfile: Profile) => void
}

export default function AccountSettings({ user, profile, onClose, onProfileUpdated }: Props) {
  const lang = useLang()
  const t = (ja: string, en: string) => (lang === "en" ? en : ja)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [savingProfile, setSavingProfile] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSaveProfile() {
    setMessage(null)
    setSavingProfile(true)

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          currency: profile?.currency ?? "JPY",
          allocation_take_home: profile?.allocation_take_home ?? null,
          allocation_target_fixed_rate: profile?.allocation_target_fixed_rate ?? null,
          allocation_target_variable_rate: profile?.allocation_target_variable_rate ?? null,
          allocation_target_savings_rate: profile?.allocation_target_savings_rate ?? null,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result.profile) {
        setMessage({ type: "error", text: t("プロフィール保存に失敗しました。", "Could not save your profile.") })
        return
      }

      onProfileUpdated(result.profile)
      setMessage({ type: "success", text: t("アカウント情報を更新しました。", "Account details updated.") })
    } finally {
      setSavingProfile(false)
    }
  }

  function handlePasswordHelp() {
    setMessage({
      type: "error",
      text: t(
        "パスワード変更はいまはログイン画面側の再設定を使ってください。",
        "For now, please use password reset from the login screen."
      ),
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-600 rounded-2xl p-6 space-y-4 shadow-2xl shadow-slate-950/50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-50">{t("アカウント設定", "Account Settings")}</h2>
          <button type="button" onClick={onClose} className="text-xs text-slate-200 hover:text-white underline underline-offset-2">
            {t("閉じる", "Close")}
          </button>
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${message.type === "success" ? "bg-emerald-950 border border-emerald-500/60 text-emerald-100" : "bg-red-950 border border-red-500/60 text-red-100"}`}>
            {message.text}
          </div>
        )}

        <div className="rounded-xl border border-slate-600 bg-slate-800 p-3 space-y-2">
          <p className="text-xs text-slate-300">{t("メール", "Email")}</p>
          <p className="text-sm text-slate-50 break-all">{user.email ?? t("未設定", "Unset")}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-200">{t("表示名", "Display Name")}</label>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("表示名", "Display Name")}
            className="w-full bg-slate-950 border border-slate-500 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
          />
        </div>

        <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium disabled:opacity-50">
          {savingProfile ? t("保存中...", "Saving...") : t("アカウント情報を保存", "Save Account Info")}
        </button>

        <div className="border-t border-slate-600 pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-200">{t("パスワード", "Password")}</p>
          <button type="button" onClick={handlePasswordHelp} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold">
            {t("再設定の案内を見る", "Show reset guidance")}
          </button>
        </div>
      </div>
    </div>
  )
}
