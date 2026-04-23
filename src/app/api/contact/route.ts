import { NextRequest, NextResponse } from "next/server"
import { boundedText, escapeHtml, isValidEmail, rateLimit, readJsonBody, requireSameOrigin } from "@/lib/server/security"
import { sendEmailViaResend } from "@/lib/server/resend"

type ContactPayload = {
  name?: string
  email?: string
  subject?: string
  message?: string
  lang?: string
}

function buildAdminEmail(payload: Required<Omit<ContactPayload, "lang">> & { lang: string }) {
  const isEn = payload.lang === "en"
  const escapedName = escapeHtml(payload.name)
  const escapedEmail = escapeHtml(payload.email)
  const escapedSubject = escapeHtml(payload.subject)
  const escapedMessage = escapeHtml(payload.message).replace(/\n/g, "<br />")
  const title = isEn ? "かわいい家計簿 — New Inquiry" : "かわいい家計簿 お問い合わせ"
  const labels = isEn
    ? { name: "Name", email: "Email", subject: "Subject", message: "Message" }
    : { name: "お名前", email: "メールアドレス", subject: "件名", message: "内容" }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a;">
      <h2 style="margin-bottom: 16px;">${title}</h2>
      <p><strong>${labels.name}:</strong> ${escapedName}</p>
      <p><strong>${labels.email}:</strong> ${escapedEmail}</p>
      <p><strong>${labels.subject}:</strong> ${escapedSubject}</p>
      <div style="margin-top: 20px;">
        <strong>${labels.message}:</strong>
        <div style="margin-top: 8px; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
          ${escapedMessage}
        </div>
      </div>
    </div>
  `
}

function buildReplyEmail(payload: Required<Omit<ContactPayload, "lang">> & { lang: string }) {
  const isEn = payload.lang === "en"
  const escapedName = escapeHtml(payload.name)
  const escapedSubject = escapeHtml(payload.subject)
  const escapedMessage = escapeHtml(payload.message).replace(/\n/g, "<br />")

  if (isEn) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
        <p>Hi ${escapedName},</p>
        <p>Thank you for contacting us. We have received your message and will get back to you after reviewing it.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 13px;"><strong>Subject:</strong> ${escapedSubject}</p>
        <p style="color: #64748b; font-size: 13px;"><strong>Message:</strong><br />${escapedMessage}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">かわいい家計簿</p>
      </div>
    `
  }

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.8; color: #0f172a;">
      <p>${escapedName} 様</p>
      <p>お問い合わせいただきありがとうございます。内容を確認の上、ご連絡いたします。</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #64748b; font-size: 13px;"><strong>件名:</strong> ${escapedSubject}</p>
      <p style="color: #64748b; font-size: 13px;"><strong>内容:</strong><br />${escapedMessage}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">かわいい家計簿</p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  try {
    const originError = requireSameOrigin(req)
    if (originError) return originError

    const rateLimitError = rateLimit(req, "contact", 5, 10 * 60 * 1000)
    if (rateLimitError) return rateLimitError

    const parsed = await readJsonBody<ContactPayload>(req, 20_000)
    if (parsed.response) return parsed.response

    const body = parsed.data
    const name = boundedText(body.name, 80)
    const email = boundedText(body.email, 254)
    const subject = boundedText(body.subject, 120)
    const message = boundedText(body.message, 5_000)
    const lang = body.lang === "en" ? "en" : "ja"

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "必須項目を入力してください。" }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "メールアドレスの形式を確認してください。" }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim()
    const toEmail = process.env.CONTACT_TO_EMAIL?.trim()
    const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim()

    if (!resendApiKey || !toEmail || !fromEmail) {
      return NextResponse.json({ error: "お問い合わせ送信の設定が未完了です。" }, { status: 500 })
    }

    const adminSubject = lang === "en" ? `[Inquiry] ${subject}` : `【お問い合わせ】${subject}`
    const replySubject = lang === "en" ? `Re: ${subject}` : `【受付完了】${subject}`

    const adminResult = await sendEmailViaResend({
      apiKey: resendApiKey,
      from: fromEmail,
      to: toEmail,
      subject: adminSubject,
      html: buildAdminEmail({ name, email, subject, message, lang }),
      replyTo: email,
    })

    if (!adminResult.ok) {
      console.error("[contact] Failed to send admin email:", adminResult.error)
      return NextResponse.json({ error: "お問い合わせの送信に失敗しました。" }, { status: 500 })
    }

    // 自動返信は失敗してもエラーにしない（送信元ドメインの制限がある場合があるため）
    const replyResult = await sendEmailViaResend({
      apiKey: resendApiKey,
      from: fromEmail,
      to: email,
      subject: replySubject,
      html: buildReplyEmail({ name, email, subject, message, lang }),
    })

    if (!replyResult.ok) {
      console.warn("[contact] Failed to send reply email:", replyResult.error)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "お問い合わせの送信に失敗しました。" }, { status: 500 })
  }
}
