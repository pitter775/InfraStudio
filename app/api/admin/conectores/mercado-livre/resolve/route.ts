import { NextResponse } from "next/server";
import { canAccessAdmin, canManageProject } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

type ResolveBody = {
  projetoId?: string;
  url?: string;
};

function isMercadoLivreHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized.includes("mercadolivre.") ||
    normalized.includes("mercadolibre.") ||
    normalized.includes("articulo.mercadolibre.") ||
    normalized.includes("produto.mercadolivre.")
  );
}

function extractSellerId(html: string) {
  const patterns = [
    /"seller_id"\s*:\s*"?(?<value>\d{3,})"?/i,
    /"sellerId"\s*:\s*"?(?<value>\d{3,})"?/i,
    /"seller"\s*:\s*\{[\s\S]{0,300}?"id"\s*:\s*"?(?<value>\d{3,})"?/i,
    /"user_id"\s*:\s*"?(?<value>\d{3,})"?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.groups?.value?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function extractNickname(html: string) {
  const patterns = [
    /"seller_permalink"\s*:\s*"(?<value>[^"]+)"/i,
    /"nickname"\s*:\s*"(?<value>[^"]+)"/i,
    /"sellerName"\s*:\s*"(?<value>[^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.groups?.value?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function hasMercadoLivreProductIdentifier(targetUrl: URL) {
  const hashParams = new URLSearchParams(targetUrl.hash.replace(/^#/, ""));
  return /MLB\d+/i.test(targetUrl.pathname) || /MLB\d+/i.test(hashParams.get("wid") || "");
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ResolveBody;
  const projetoId = body.projetoId?.trim() || null;
  const rawUrl = body.url?.trim() || "";

  if (!projetoId || !canManageProject(user, projetoId)) {
    return NextResponse.json({ error: "Projeto invalido para identificar a loja." }, { status: 403 });
  }

  if (!rawUrl) {
    return NextResponse.json({ error: "Informe a URL de um produto do Mercado Livre." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "A URL informada e invalida." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol) || !isMercadoLivreHostname(targetUrl.hostname)) {
    return NextResponse.json({ error: "Use uma URL valida de produto do Mercado Livre." }, { status: 400 });
  }

  const hasProductIdentifier = hasMercadoLivreProductIdentifier(targetUrl);

  let html = "";
  try {
    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: hasProductIdentifier
            ? "Nao foi possivel abrir o produto informado no Mercado Livre."
            : "Use o link completo de um anuncio do Mercado Livre, de preferencia o que tenha o identificador do produto no final.",
        },
        { status: 502 },
      );
    }

    html = await response.text();
  } catch {
    return NextResponse.json({ error: "Falha ao consultar o produto informado no Mercado Livre." }, { status: 502 });
  }

  const sellerId = extractSellerId(html);
  if (!sellerId) {
    return NextResponse.json({ error: "Nao encontrei o seller da loja nesse produto. Tente outro anuncio da mesma loja." }, { status: 422 });
  }

  return NextResponse.json(
    {
      ok: true,
      sellerId,
      nickname: extractNickname(html),
      productUrl: targetUrl.toString(),
    },
    { status: 200 },
  );
}
