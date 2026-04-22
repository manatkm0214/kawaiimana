"use client"

import Link from "next/link"
import { useState } from "react"
import { FaEnvelope, FaGoogle, FaLine } from "react-icons/fa"
import { useLang } from "@/lib/hooks/useLang"

interface AuthViewProps {
  onAuth: (mode?: "login" | "register", email?: string, password?: string) => void | Promise<void>
  onBack: () => void
  initialMessage?: { type: "success" | "error"; text: string } | null
  initialEmail?: string
  otpEmail?: string
  onGuestLogin?: () => void
}

function CuteGirlHero() {
  return (
    <svg width="250" height="300" viewBox="0 0 250 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id="girl-skin" cx="45%" cy="32%" r="60%">
          <stop offset="0%" stopColor="#FFF2E8" />
          <stop offset="100%" stopColor="#F7C8A7" />
        </radialGradient>
        <linearGradient id="girl-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B3CC4" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <linearGradient id="girl-dress" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF7FB" />
          <stop offset="45%" stopColor="#FCE7F3" />
          <stop offset="100%" stopColor="#DBEAFE" />
        </linearGradient>
        <linearGradient id="girl-ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <radialGradient id="girl-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDF2F8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FDF2F8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="girl-eye" cx="35%" cy="25%" r="65%">
          <stop offset="0%" stopColor="#F5D0FE" />
          <stop offset="50%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#6D28D9" />
        </radialGradient>
      </defs>

      <ellipse cx="126" cy="165" rx="86" ry="106" fill="url(#girl-glow)" />

      <path d="M63 112 C40 153 35 215 47 270 C62 278 74 267 72 245 C67 211 74 154 90 114Z" fill="url(#girl-hair)" />
      <path d="M187 112 C210 153 215 215 203 270 C188 278 176 267 178 245 C183 211 176 154 160 114Z" fill="url(#girl-hair)" />
      <path d="M62 148 C41 176 38 216 54 245 C69 252 76 241 75 224 C69 201 72 175 88 151Z" fill="url(#girl-hair)" opacity="0.92" />
      <path d="M188 148 C209 176 212 216 196 245 C181 252 174 241 175 224 C181 201 178 175 162 151Z" fill="url(#girl-hair)" opacity="0.92" />

      <ellipse cx="125" cy="96" rx="52" ry="56" fill="url(#girl-skin)" />
      <path d="M72 90 C77 41 117 26 177 78 C160 48 132 37 101 45Z" fill="url(#girl-hair)" />
      <path d="M78 87 C85 62 101 49 120 47 C111 63 109 79 112 95Z" fill="url(#girl-hair)" />
      <path d="M173 84 C166 60 152 48 133 46 C142 62 144 78 141 93Z" fill="url(#girl-hair)" />
      <path d="M91 53 C105 45 122 42 139 46" stroke="#E9D5FF" strokeWidth="6" strokeLinecap="round" />

      <path d="M88 43 L105 61 L123 43 L112 34 L106 41 L100 34Z" fill="url(#girl-ribbon)" />
      <path d="M127 43 L145 61 L162 43 L150 34 L144 41 L138 34Z" fill="url(#girl-ribbon)" />
      <circle cx="124" cy="53" r="7" fill="#FBBF24" />

      <ellipse cx="106" cy="94" rx="12" ry="13" fill="#2E1065" />
      <ellipse cx="144" cy="94" rx="12" ry="13" fill="#2E1065" />
      <ellipse cx="106" cy="93" rx="9" ry="10" fill="url(#girl-eye)" />
      <ellipse cx="144" cy="93" rx="9" ry="10" fill="url(#girl-eye)" />
      <circle cx="109" cy="88" r="3.5" fill="white" />
      <circle cx="147" cy="88" r="3.5" fill="white" />
      <circle cx="102" cy="98" r="2" fill="white" opacity="0.75" />
      <circle cx="140" cy="98" r="2" fill="white" opacity="0.75" />
      <path d="M94 79 Q104 73 116 78" stroke="#5B3CC4" strokeWidth="3" strokeLinecap="round" />
      <path d="M134 78 Q146 73 156 80" stroke="#5B3CC4" strokeWidth="3" strokeLinecap="round" />

      <ellipse cx="88" cy="108" rx="13" ry="7" fill="#FDA4AF" opacity="0.45" />
      <ellipse cx="160" cy="108" rx="13" ry="7" fill="#FDA4AF" opacity="0.45" />
      <ellipse cx="125" cy="110" rx="5" ry="3.5" fill="#FB7185" opacity="0.75" />
      <path d="M113 124 Q125 137 137 124" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" fill="none" />

      <path d="M82 154 Q95 137 125 136 Q156 137 169 154 L181 232 Q125 248 69 232Z" fill="url(#girl-dress)" />
      <path d="M83 154 Q96 147 125 148 Q155 147 168 154" stroke="#F9A8D4" strokeWidth="2.5" fill="none" />
      <path d="M104 156 L116 145 L126 158 L137 145 L149 156 L126 173Z" fill="url(#girl-ribbon)" />
      <circle cx="126" cy="158" r="5.5" fill="#FDE68A" />
      <path d="M71 163 C54 176 48 200 53 221" stroke="#FDF2F8" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M179 163 C196 176 202 200 197 221" stroke="#FDF2F8" strokeWidth="13" strokeLinecap="round" fill="none" />

      <path d="M75 234 Q95 225 125 226 Q156 225 176 234 Q167 269 125 273 Q84 269 75 234Z" fill="#FCE7F3" />
      <path d="M90 238 Q106 245 125 244 Q145 245 161 238" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      <rect x="108" y="230" width="14" height="42" rx="7" fill="url(#girl-skin)" />
      <rect x="130" y="230" width="14" height="42" rx="7" fill="url(#girl-skin)" />
      <path d="M100 268 Q111 279 125 277 Q138 279 149 268" stroke="#F472B6" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function PlushBuddy() {
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id="plush-body" cx="45%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#FFF8F1" />
          <stop offset="100%" stopColor="#F7D3BD" />
        </radialGradient>
        <radialGradient id="plush-belly" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FDF2F8" />
        </radialGradient>
      </defs>

      <ellipse cx="66" cy="119" rx="28" ry="7" fill="rgba(244,114,182,0.16)" />
      <ellipse cx="41" cy="34" rx="16" ry="18" fill="#F9A8D4" />
      <ellipse cx="91" cy="34" rx="16" ry="18" fill="#F9A8D4" />
      <ellipse cx="41" cy="36" rx="9" ry="10" fill="#FCE7F3" />
      <ellipse cx="91" cy="36" rx="9" ry="10" fill="#FCE7F3" />

      <ellipse cx="66" cy="78" rx="34" ry="31" fill="url(#plush-body)" />
      <ellipse cx="66" cy="82" rx="21" ry="18" fill="url(#plush-belly)" />
      <circle cx="66" cy="51" r="34" fill="url(#plush-body)" />

      <ellipse cx="53" cy="50" rx="7" ry="8.5" fill="#1F2937" />
      <ellipse cx="79" cy="50" rx="7" ry="8.5" fill="#1F2937" />
      <circle cx="56" cy="47" r="2.4" fill="white" />
      <circle cx="82" cy="47" r="2.4" fill="white" />

      <ellipse cx="45" cy="60" rx="9" ry="5" fill="#FDA4AF" opacity="0.45" />
      <ellipse cx="87" cy="60" rx="9" ry="5" fill="#FDA4AF" opacity="0.45" />
      <ellipse cx="66" cy="57" rx="4" ry="3" fill="#FB7185" opacity="0.8" />
      <path d="M58 67 Q66 75 74 67" stroke="#EC4899" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      <path d="M54 20 L66 31 L78 20 L72 13 L66 18 L60 13Z" fill="#EC4899" />
      <circle cx="66" cy="26" r="4.5" fill="#FDE68A" />
    </svg>
  )
}

export default function AuthView({ onAuth, onBack, initialMessage, initialEmail, otpEmail, onGuestLogin }: AuthViewProps) {
  const lang = useLang()
  const t = (ja: string, en: string) => (lang === "en" ? en : ja)
  const [email, setEmail] = useState(initialEmail || otpEmail || "")

  function startLogin(mode: "login" | "register", connection?: "google-oauth2" | "line") {
    if (connection === "line") {
      window.location.href = "/api/auth/line/start"
      return
    }
    if (connection) {
      window.location.href = `/auth/login?connection=${encodeURIComponent(connection)}`
      return
    }
    if (mode === "register") {
      window.location.href = "/auth/login?screen_hint=signup"
      return
    }
    void Promise.resolve(onAuth(mode, email))
  }

  return (
    <div
      className="relative min-h-[82vh] overflow-hidden rounded-[36px] px-6 py-8 md:px-8"
      style={{
        background:
          "radial-gradient(circle at 16% 8%, rgba(255,255,255,0.95) 0%, rgba(254,205,211,0.54) 24%, rgba(243,232,255,0.7) 56%, rgba(219,234,254,0.82) 100%)",
        border: "1.5px solid rgba(244,114,182,0.22)",
        boxShadow: "0 30px 90px rgba(236,72,153,0.1), 0 0 0 4px rgba(255,255,255,0.12)",
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-5 rounded-[28px] border border-white/45" />
        <div className="absolute inset-9 rounded-3xl border border-rose-200/40" />
        <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-10 top-6 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-4 left-[12%] h-28 w-28 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute bottom-8 right-[14%] h-24 w-24 rounded-full bg-fuchsia-200/30 blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.96fr_1.04fr] lg:items-center">
        <div className="space-y-5">
          <p
            className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.28em]"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(253,242,248,0.9))",
              border: "1px solid rgba(244,114,182,0.28)",
              color: "#BE185D",
            }}
          >
            {t("ログイン・会員登録", "Login / Sign up")}
          </p>

          <div>
            <h2
              className="text-3xl font-black tracking-tight md:text-4xl"
              style={{ color: "#831843", textShadow: "0 2px 12px rgba(236,72,153,0.12)" }}
            >
              {t("かわいく続ける", "A cute start")}
            </h2>
            <p className="mt-2 text-sm font-semibold tracking-[0.16em] uppercase" style={{ color: "#DB2777", opacity: 0.82 }}>
              {t("やさしいログインルーム", "Soft login room")}
            </p>
            <p className="mt-3 text-sm leading-7" style={{ color: "#6B21A8" }}>
              {t(
                "ログイン、会員登録、Google、LINE は次の認証画面で続けられます。トップと同じかわいい雰囲気のまま進めるようにしました。",
                "Login, sign-up, Google, and LINE continue on the next authentication screen with the same cute mood as the home screen.",
              )}
            </p>
          </div>

          <div
            className="rounded-3xl px-5 py-5"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(253,242,248,0.92))",
              border: "1.5px solid rgba(244,114,182,0.18)",
              boxShadow: "0 10px 28px -14px rgba(236,72,153,0.16), inset 0 1px 0 rgba(255,255,255,0.92)",
            }}
          >
            {initialMessage && (
              <div
                className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
                  initialMessage.type === "success"
                    ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border border-rose-300 bg-rose-50 text-rose-800"
                }`}
              >
                {initialMessage.text}
              </div>
            )}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "#BE185D" }}>
                <FaEnvelope />
                {t("メールアドレス", "Email")}
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition"
                style={{
                  border: "1.5px solid rgba(244,114,182,0.24)",
                  background: "rgba(255,255,255,0.82)",
                  color: "#1C1917",
                }}
              />
            </label>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => startLogin("login")}
              className="rounded-full px-5 py-4 text-sm font-bold tracking-wide text-white transition hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #EC4899, #FB7185 52%, #60A5FA 100%)",
                boxShadow: "0 14px 34px -10px rgba(236,72,153,0.36)",
              }}
            >
              {t("ログインへ進む", "Continue to login")}
            </button>

            <button
              type="button"
              onClick={() => startLogin("register")}
              className="rounded-full px-5 py-4 text-sm font-bold text-white transition hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #F472B6, #C084FC 52%, #7DD3FC 100%)",
                boxShadow: "0 14px 30px -12px rgba(192,132,252,0.35)",
              }}
            >
              {t("会員登録へ進む", "Create account")}
            </button>

            <button
              type="button"
              onClick={() => startLogin("login", "google-oauth2")}
              className="rounded-full px-5 py-4 text-sm font-semibold transition hover:brightness-95"
              style={{
                background: "linear-gradient(135deg, #FFFFFF, #F8FAFC)",
                color: "#1C1917",
                border: "1.5px solid rgba(244,114,182,0.18)",
                boxShadow: "0 8px 20px -12px rgba(15,23,42,0.18)",
              }}
            >
              <span className="inline-flex items-center gap-2">
                <FaGoogle />
                {t("Googleで続ける", "Continue with Google")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => startLogin("login", "line")}
              className="rounded-full px-5 py-4 text-sm font-semibold text-white transition hover:brightness-105"
              style={{
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                boxShadow: "0 10px 24px -10px rgba(22,163,74,0.38)",
              }}
            >
              <span className="inline-flex items-center gap-2">
                <FaLine />
                {t("LINEで続ける", "Continue with LINE")}
              </span>
            </button>

            {onGuestLogin && (
              <button
                type="button"
                onClick={onGuestLogin}
                className="rounded-full px-5 py-4 text-sm font-semibold transition hover:brightness-95"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(254,240,245,0.94))",
                  border: "1.5px solid rgba(244,114,182,0.22)",
                  color: "#9D174D",
                }}
              >
                {t("ゲストで試す", "Try as guest")}
              </button>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { href: "/privacy", label: t("プライバシー", "Privacy") },
              { href: "/terms", label: t("利用規約", "Terms") },
              { href: "/auth/reset-password", label: t("パスワード再設定", "Reset") },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-3 py-2.5 text-center text-xs font-semibold transition hover:brightness-95"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(253,242,248,0.86))",
                  border: "1px solid rgba(244,114,182,0.18)",
                  color: "#BE185D",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-full py-3 text-sm font-semibold transition hover:brightness-95"
            style={{
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(244,114,182,0.18)",
              color: "#831843",
            }}
          >
            {t("トップへ戻る", "Back to home")}
          </button>
        </div>

        <div className="hidden lg:flex flex-col items-center justify-center gap-5">
          <p className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: "#DB2777" }}>
            {t("かわいいログインルーム", "Cute Login Room")}
          </p>

          <div
            className="relative w-full max-w-md overflow-hidden rounded-[34px] px-6 py-7"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.94), rgba(253,242,248,0.9) 54%, rgba(239,246,255,0.9) 100%)",
              border: "1.5px solid rgba(244,114,182,0.18)",
              boxShadow: "0 24px 60px -28px rgba(236,72,153,0.24)",
            }}
          >
            <div className="absolute left-[-2rem] top-10 h-28 w-28 rounded-full bg-pink-200/35 blur-3xl" />
            <div className="absolute right-[-1rem] bottom-10 h-24 w-24 rounded-full bg-sky-200/30 blur-2xl" />
            <div className="relative z-10 flex items-end justify-center gap-3">
              <div className="relative">
                <CuteGirlHero />
              </div>
              <div className="mb-3 flex flex-col items-center gap-2">
                <div
                  className="rounded-[24px] px-4 py-3 text-center text-xs leading-6"
                  style={{
                    background: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(244,114,182,0.18)",
                    color: "#9D174D",
                  }}
                >
                  {t("やさしい色で、気分よくログイン", "A soft and cheerful start")}
                </div>
                <PlushBuddy />
              </div>
            </div>
          </div>

          <div
            className="max-w-sm rounded-3xl px-5 py-4 text-center text-sm"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(254,240,245,0.9))",
              border: "1.5px solid rgba(244,114,182,0.16)",
              boxShadow: "0 10px 24px -16px rgba(236,72,153,0.18)",
            }}
          >
            <p className="font-bold" style={{ color: "#9D174D" }}>
              {t("かわいい気分のまま、家計ボードへ", "Head into your budget board in a cute mood")}
            </p>
            <p className="mt-1 text-xs leading-6" style={{ color: "#7E22CE" }}>
              {t("トップ画面とつながるトーンで、ログイン前の印象もやさしく整えました。", "The login view now matches the softer tone of the home screen.")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 lg:hidden">
        <div
          className="flex items-end justify-center gap-3 rounded-[28px] px-4 py-5"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(253,242,248,0.88) 60%, rgba(239,246,255,0.86) 100%)",
            border: "1px solid rgba(244,114,182,0.18)",
          }}
        >
          <div className="scale-[0.82] origin-bottom">
            <CuteGirlHero />
          </div>
          <div className="mb-2 scale-[0.9] origin-bottom">
            <PlushBuddy />
          </div>
        </div>
      </div>
    </div>
  )
}
