import { NextResponse } from "next/server";
import { canAccessProject } from "@/lib/access";
import { verifyHandoffAccessToken } from "@/lib/handoff-link";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const origin = new URL(request.url).origin;

  let payload: Awaited<ReturnType<typeof verifyHandoffAccessToken>>;
  try {
    payload = await verifyHandoffAccessToken(token);
  } catch {
    return NextResponse.redirect(new URL("/?handoff_error=invalid_link", origin));
  }

  const destination = new URL("/admin/atendimento", origin);
  destination.searchParams.set("projeto", payload.projetoId);
  destination.searchParams.set("chat", payload.chatId);
  destination.searchParams.set("handoff", "1");

  const user = await getSessionUser();
  if (!user) {
    const loginUrl = new URL("/", origin);
    loginUrl.searchParams.set("returnTo", `/handoff/${encodeURIComponent(token)}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessProject(user, payload.projetoId)) {
    const fallbackUrl = new URL("/admin/projetos", origin);
    fallbackUrl.searchParams.set("handoff_error", "access_denied");
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.redirect(destination);
}
