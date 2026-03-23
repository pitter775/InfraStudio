import "server-only";

type PurgeWhatsAppServiceInput = {
  channelId?: string | null;
  channelIds?: string[] | null;
  projetoId?: string | null;
  agenteId?: string | null;
};

function getWhatsAppServiceUrl() {
  return (
    process.env.WHATSAPP_SERVICE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim() ||
    ""
  );
}

export async function purgeWhatsAppServiceSessions(input: PurgeWhatsAppServiceInput) {
  const baseUrl = getWhatsAppServiceUrl();
  if (!baseUrl) {
    return {
      ok: false,
      error: "WHATSAPP_SERVICE_URL ou NEXT_PUBLIC_WHATSAPP_SERVICE_URL nao definido para limpar persistencias do whatsapp-service.",
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/purge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channelId: input.channelId ?? null,
      channelIds: input.channelIds ?? null,
      projetoId: input.projetoId ?? null,
      agenteId: input.agenteId ?? null,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    purged?: string[];
  };

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error ?? "Nao foi possivel limpar persistencias do whatsapp-service.",
    };
  }

  return {
    ok: true,
    purged: Array.isArray(payload.purged) ? payload.purged : [],
  };
}
