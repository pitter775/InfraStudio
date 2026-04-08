import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "contato@infrastudio.pro";
const DEFAULT_REPLY_TO = "pitter775@gmail.com";

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY nao configurada.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      reply_to: DEFAULT_REPLY_TO,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar email via Resend: ${response.status} ${errorBody}`.trim());
  }
}
