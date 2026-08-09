// Uses Resend (https://resend.com) — free tier, simple REST API, no SMTP
// setup headache. Get a free API key from https://resend.com/api-keys and
// set RESEND_API_KEY in .env. Sending is skipped (logged, not thrown) if
// the key is missing, so registration itself never fails just because
// email isn't configured yet.

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Atomic Pathshala <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send. Set it in .env to enable emails.");
    return { sent: false, error: "Email not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[email] Resend API error:", res.status, text);
      return { sent: false, error: `Resend API error (${res.status})` };
    }
    return { sent: true };
  } catch (err: any) {
    console.error("[email] Failed to send:", err.message);
    return { sent: false, error: err.message };
  }
}

export function buildWelcomeEmailHtml(opts: { name: string; studentId: string; email: string }): string {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1e293b;">
    <h2 style="color: #9D4400;">Welcome to Atomic Pathshala, ${opts.name}! 🎉</h2>
    <p>Your account has been created successfully. Here are your login details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 10px; background: #FFF3E8; border-radius: 8px 0 0 8px; font-weight: 600; color: #9D4400;">Student ID</td>
        <td style="padding: 10px; background: #FFF3E8; border-radius: 0 8px 8px 0; font-family: monospace; font-size: 16px;">${opts.studentId}</td>
      </tr>
    </table>
    <p>You can log in anytime using your registered email <strong>${opts.email}</strong> and the password you created during registration.</p>
    <p style="color: #64748b; font-size: 13px;">Keep your Student ID safe — you'll need it for test-hall login during exams.</p>
    <p style="margin-top: 24px;">Good luck with your NEET preparation!<br/>— Team Atomic Pathshala</p>
  </div>`;
}
