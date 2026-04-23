type SendEmailParams = {
  apiKey: string
  from: string
  to: string | string[]
  subject: string
  html: string
  replyTo?: string | string[]
}

type ResendApiResponse = {
  id?: string
  message?: string
  error?: {
    message?: string
  }
}

type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; status?: number }

export async function sendEmailViaResend({
  apiKey,
  from,
  to,
  subject,
  html,
  replyTo,
}: SendEmailParams): Promise<SendEmailResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    const data = (await response.json().catch(() => null)) as ResendApiResponse | null

    if (!response.ok) {
      return {
        ok: false,
        error: data?.message || data?.error?.message || `Resend API returned ${response.status}`,
        status: response.status,
      }
    }

    if (data?.error?.message) {
      return { ok: false, error: data.error.message, status: response.status }
    }

    return { ok: true, id: data?.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to reach Resend API",
    }
  }
}
