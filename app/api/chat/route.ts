import { NextResponse } from "next/server";
import { processIncomingChatMessage, type ChatRequestBody } from "@/lib/chat-service";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const corsHeaders = buildCorsHeaders(request.headers.get("origin"));

  try {
    const body = (await request.json()) as ChatRequestBody;
    const result = await processIncomingChatMessage({
      ...body,
      canal: body.canal,
      source: body.source ?? "site_widget",
    });

    return NextResponse.json(
      {
        chatId: result.chatId,
        reply: result.reply,
        followUpReply: result.followUpReply ?? "",
        messageSequence: Array.isArray(result.messageSequence) ? result.messageSequence : [],
        assets: result.assets,
        whatsapp: result.whatsapp,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("[chat] failed to answer message", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nao foi possivel responder agora.",
      },
      { status: error instanceof Error && error.message === "DEMO_EXPIRED" ? 410 : 500, headers: corsHeaders },
    );
  }
}
