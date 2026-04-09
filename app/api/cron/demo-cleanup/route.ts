import { NextResponse } from "next/server";
import { cleanupExpiredDemoProjects } from "@/lib/demo-project-service";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return false;
  }

  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const result = await cleanupExpiredDemoProjects();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
