import { NextResponse } from "next/server";
import { canAccessAdmin, canAccessProject, canAccessGlobalAdmin } from "@/lib/access";
import { getChatAttachmentsMetadata, uploadChatAttachments } from "@/lib/chat-attachments";
import { getChatById } from "@/lib/chats";
import { getSessionUser } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();

  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const chat = await getChatById(id);

  if (!chat) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  if (!canAccessGlobalAdmin(user) && !canAccessProject(user, chat.projetoId)) {
    return NextResponse.json({ error: "Acesso negado para esta conversa." }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 5);

  if (!files.length) {
    return NextResponse.json({ error: "Selecione pelo menos um arquivo." }, { status: 400 });
  }

  const oversized = files.find((file) => file.size > 20 * 1024 * 1024);
  if (oversized) {
    return NextResponse.json({ error: `O arquivo ${oversized.name} excede o limite de 20 MB.` }, { status: 400 });
  }

  try {
    const uploaded = await uploadChatAttachments({
      projetoId: chat.projetoId,
      chatId: chat.id,
      files,
    });

    return NextResponse.json({ attachments: getChatAttachmentsMetadata(uploaded) }, { status: 201 });
  } catch (error) {
    console.error("[admin-chat-attachments] failed to upload attachments", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel enviar os anexos." },
      { status: 500 },
    );
  }
}
