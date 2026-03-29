import { NextResponse } from "next/server";

type MercadoLivreWebhookPayload = Record<string, unknown> | null;

function logWebhook(method: string, payload: MercadoLivreWebhookPayload) {
  console.info("[mercado-livre-webhook] notification received", {
    method,
    payload,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("challenge")?.trim() || null;

  logWebhook("GET", Object.fromEntries(url.searchParams.entries()));

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: Request) {
  let payload: MercadoLivreWebhookPayload = null;

  try {
    payload = (await request.json()) as MercadoLivreWebhookPayload;
  } catch {
    payload = null;
  }

  logWebhook("POST", payload);
  return NextResponse.json({ ok: true }, { status: 200 });
}
