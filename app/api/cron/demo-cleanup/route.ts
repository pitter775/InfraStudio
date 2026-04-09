import { NextResponse } from "next/server";
import { cleanupExpiredDemoProjetos } from "@/lib/projetos";

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || "";
  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization")?.trim() || "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() || "";
  const bearerSecret = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";

  return headerSecret === cronSecret || bearerSecret === cronSecret;
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }

  const result = await cleanupExpiredDemoProjetos();

  return NextResponse.json(
    {
      ok: true,
      totalRemovido: result.totalRemovido,
      projetosProcessados: result.projetosProcessados,
      falhas: result.falhas,
    },
    { status: 200 },
  );
}
