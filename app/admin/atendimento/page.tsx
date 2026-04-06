"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, ChevronDown, ChevronUp, Clock3, ExternalLink, LoaderCircle, MessageCircleMore, MoreHorizontal, Paperclip, PhoneCall, SendHorizonal, SmilePlus, Sparkles, SplitSquareVertical, Trash2, X } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";
import { canAccessWorkspace } from "@/lib/access";
import { getCurrentProjectUser } from "@/lib/auth";
import type { AppUser } from "@/lib/app-user";

const ACTIVE_PROJECT_STORAGE_KEY = "projeto_ativo";

type Projeto = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
};

type ChatRecord = {
  id: string;
  conversationKey?: string | null;
  titulo: string;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoAvatarUrl?: string | null;
  updatedAt: string;
  canal: string;
  identificadorExterno: string | null;
  ultimaMensagem: string | null;
  totalMensagens: number;
  contexto?: {
    lead?: {
      nome?: string | null;
      telefone?: string | null;
    } | null;
    whatsapp?: {
      contactName?: string | null;
      remotePhone?: string | null;
      profilePicUrl?: string | null;
      rawContact?: {
        profilePicUrl?: string | null;
      } | null;
    } | null;
  } | null;
  handoff?: {
    status?: "bot" | "pending_human" | "human";
    claimedByUsuarioId?: string | null;
    claimedAt?: string | null;
  } | null;
};

type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  conteudo: string;
  createdAt: string;
  metadata?: {
    sentByHuman?: boolean;
    senderName?: string;
    assets?: Array<{
      id?: string;
      nome?: string;
      descricao?: string;
      arquivoNome?: string;
      mimeType?: string;
      categoria?: "image" | "file";
      publicUrl?: string | null;
      targetUrl?: string | null;
    }>;
    attachments?: Array<{
      name?: string;
      type?: string;
      size?: number;
      publicUrl?: string | null;
      storagePath?: string | null;
      category?: "image" | "video" | "file" | null;
    }>;
  } | null;
};

type PendingAttachment = {
  file: File;
  name: string;
  type: string;
  size: number;
};

type IndicativoSummary = {
  code: string;
  label: string;
  total: number;
};

type ChatChannelFilter = "all" | "site" | "whatsapp";

const compactButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all sm:text-sm";

const dddLabels: Record<string, string> = {
  "11": "Sao Paulo capital",
  "21": "Rio de Janeiro",
  "27": "Espirito Santo",
  "31": "Belo Horizonte",
  "41": "Curitiba",
  "47": "Santa Catarina",
  "48": "Florianopolis",
  "51": "Porto Alegre",
  "61": "Brasilia",
  "62": "Goias",
  "71": "Salvador",
  "81": "Recife",
  "85": "Fortaleza",
};

const quickEmojis = ["😀", "👍", "🙏", "🎯", "📎", "🚀"];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChatChannelLabel(canal: string) {
  return canal === "whatsapp" ? "WhatsApp" : "Site";
}

function getChatChannelTone(canal: string) {
  return canal === "whatsapp"
    ? "bg-emerald-500/10 text-emerald-200"
    : "bg-cyan-500/10 text-cyan-100";
}

function getChatTitle(chat: ChatRecord) {
  const explicitContactName = chat.contatoNome?.trim();
  if (explicitContactName) {
    return explicitContactName;
  }

  const contextName = chat.contexto?.lead?.nome?.trim() || chat.contexto?.whatsapp?.contactName?.trim();
  if (contextName) {
    return contextName;
  }

  const title = chat.titulo?.trim();
  if (title && title !== "Nova conversa") {
    return title;
  }

  const formattedPhone = getChatPhone(chat);
  if (formattedPhone) {
    return formattedPhone;
  }

  return (
    chat.identificadorExterno?.trim() ||
    "Conversa sem identificacao"
  );
}

function formatDisplayPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  let normalized = digits;
  let countryCode = "55";

  if (digits.startsWith("55") && digits.length >= 12) {
    normalized = digits.slice(2);
  } else if (digits.length > 11) {
    const maybeCountry = digits.slice(0, digits.length - 11);
    const maybeLocal = digits.slice(-11);
    if (maybeLocal.length === 11 || maybeLocal.length === 10) {
      countryCode = maybeCountry || "55";
      normalized = maybeLocal;
    }
  }

  if (normalized.length === 11) {
    return `+${countryCode} ${normalized.slice(0, 2)} ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
  }

  if (normalized.length === 10) {
    return `+${countryCode} ${normalized.slice(0, 2)} ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }

  return digits.startsWith(countryCode) ? `+${digits}` : `+${countryCode} ${normalized}`;
}

function getChatPhone(chat: ChatRecord) {
  return (
    formatDisplayPhone(chat.contatoTelefone) ||
    formatDisplayPhone(chat.contexto?.lead?.telefone) ||
    formatDisplayPhone(chat.contexto?.whatsapp?.remotePhone) ||
    formatDisplayPhone(chat.identificadorExterno) ||
    null
  );
}

function getChatAvatarUrl(chat: ChatRecord) {
  const value =
    chat.contatoAvatarUrl ||
    chat.contexto?.whatsapp?.profilePicUrl ||
    chat.contexto?.whatsapp?.rawContact?.profilePicUrl;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return null;
  }

  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function getChatSubtitle(chat: ChatRecord) {
  const title = getChatTitle(chat);
  const phone = getChatPhone(chat);

  if (phone && phone !== title) {
    return phone;
  }

  if (chat.identificadorExterno?.trim() && chat.identificadorExterno.trim() !== title) {
    return chat.identificadorExterno.trim();
  }

  return null;
}

function getAvatarFallbackLabel(chat: ChatRecord) {
  const title = getChatTitle(chat);
  const normalized = title.trim();
  if (!normalized) {
    return "?";
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function isChatUnderHumanHandoff(chat: ChatRecord | null | undefined) {
  return chat?.handoff?.status === "human" || chat?.handoff?.status === "pending_human";
}

function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFirstName(name: string | null | undefined) {
  const normalized = name?.trim();
  if (!normalized) {
    return "Equipe";
  }

  return normalized.split(/\s+/)[0] || "Equipe";
}

function formatFileSize(value: number | null | undefined) {
  const size = Number(value ?? 0);
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

function getMojibakeScore(value: string) {
  return (value.match(/Ã.|Â.|ðŸ|â€¢|â€“|â€”|â€œ|â€|�/g) ?? []).length;
}

function repairCommonMojibakeArtifacts(value: string) {
  return value
    .replace(/Ã¢â‚¬Â¢/g, "- ")
    .replace(/â€¢/g, "- ")
    .replace(/Ã¢â‚¬â€œ|â€“/g, "-")
    .replace(/Ã¢â‚¬â€|â€”/g, "-")
    .replace(/Ã¢â‚¬Å“|â€œ|â€/g, '"')
    .replace(/Ã¢â‚¬â„¢|â€™/g, "'")
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã§/g, "c")
    .replace(/Ã£/g, "a")
    .replace(/Ãµ/g, "o")
    .replace(/Â/g, "")
    .replace(/�/g, "");
}

function decodeLikelyMojibake(value: string) {
  if (!value || typeof TextDecoder === "undefined") {
    return repairCommonMojibakeArtifacts(value);
  }

  if (!/(?:Ã.|Â.|ðŸ|â€¢|â€“|â€”|â€œ|â€|�)/.test(value)) {
    return repairCommonMojibakeArtifacts(value);
  }

  try {
    let best = value;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bytes = Uint8Array.from(Array.from(best).map((char) => char.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8").decode(bytes);

      if (getMojibakeScore(decoded) > getMojibakeScore(best)) {
        break;
      }

      best = decoded;
    }

    return repairCommonMojibakeArtifacts(best);
  } catch {
    return repairCommonMojibakeArtifacts(value);
  }
}

function normalizeChatMessageText(value: string | null | undefined) {
  const decoded = decodeLikelyMojibake(String(value ?? ""));

  return decoded
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getChatPreviewText(value: string | null | undefined) {
  const normalized = normalizeChatMessageText(value);
  if (!normalized) {
    return "Sem mensagens ainda.";
  }

  return normalized
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderFormattedInlineText(value: string) {
  const parts = value.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`inline-${index}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <strong key={`inline-${index}`} className="font-semibold text-white">
          {part.slice(1, -1)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={`inline-${index}`} className="rounded bg-black/20 px-1 py-0.5 font-mono text-[0.95em] text-cyan-100">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={`inline-${index}`}>{part}</span>;
  });
}

function ChatMessageBody({ content }: { content: string }) {
  const normalized = normalizeChatMessageText(content);

  if (!normalized) {
    return null;
  }

  const lines = normalized.split("\n");

  return (
    <div className="mt-1.5 space-y-1.5 text-xs leading-5 sm:text-[13px]">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          return <div key={`line-${index}`} className="h-2" />;
        }

        const isBullet = /^([-*]|\d+\.)\s+/.test(trimmedLine);

        return (
          <p
            key={`line-${index}`}
            className={isBullet ? "pl-3 -indent-3 break-words" : "break-words"}
          >
            {renderFormattedInlineText(line)}
          </p>
        );
      })}
    </div>
  );
}

function resizeReplyTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea || typeof window === "undefined") {
    return;
  }

  textarea.style.height = "0px";
  const computed = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computed.lineHeight || "20") || 20;
  const paddingTop = Number.parseFloat(computed.paddingTop || "0") || 0;
  const paddingBottom = Number.parseFloat(computed.paddingBottom || "0") || 0;
  const borderTop = Number.parseFloat(computed.borderTopWidth || "0") || 0;
  const borderBottom = Number.parseFloat(computed.borderBottomWidth || "0") || 0;
  const minHeight = Math.ceil(lineHeight + paddingTop + paddingBottom + borderTop + borderBottom);
  const maxHeight = Math.ceil(lineHeight * 5 + paddingTop + paddingBottom + borderTop + borderBottom);
  const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function getAttachmentCategory(type: string | null | undefined, category?: string | null) {
  if (category === "image" || category === "video" || category === "file") {
    return category;
  }

  const normalized = String(type || "").toLowerCase();
  if (normalized.startsWith("image/")) {
    return "image";
  }

  if (normalized.startsWith("video/")) {
    return "video";
  }

  return "file";
}

function truncateFileName(name: string | null | undefined, maxLength = 34) {
  const normalized = String(name || "").trim();
  if (!normalized) {
    return "arquivo";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const extensionIndex = normalized.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < normalized.length - 1;
  const extension = hasExtension ? normalized.slice(extensionIndex) : "";
  const baseName = hasExtension ? normalized.slice(0, extensionIndex) : normalized;
  const safeMaxLength = Math.max(maxLength, extension.length + 6);
  const visibleBase = Math.max(8, safeMaxLength - extension.length - 3);

  return `${baseName.slice(0, visibleBase)}...${extension}`;
}

function getChatMediaItems(messages: ChatMessageRecord[]) {
  return messages.flatMap((message) =>
    (message.metadata?.attachments ?? []).map((attachment, index) => ({
      key: `${message.id}:${index}`,
      attachment,
      message,
      category: getAttachmentCategory(attachment.type, attachment.category),
    })),
  );
}

function AttachmentPreview({
  attachment,
}: {
  attachment: NonNullable<NonNullable<ChatMessageRecord["metadata"]>["attachments"]>[number];
}) {
  const category = getAttachmentCategory(attachment.type, attachment.category);
  const url = attachment.publicUrl?.trim() || "";

  if (category === "image" && url) {
    return <img src={url} alt={attachment.name || "Imagem"} className="h-28 w-full rounded-xl object-cover" />;
  }

  if (category === "video" && url) {
    return <video src={url} controls className="h-28 w-full rounded-xl bg-slate-950/60 object-cover" />;
  }

  return (
    <div className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-3 text-center text-xs font-semibold text-slate-300">
      {category === "file" ? "Arquivo" : "Midia"}
    </div>
  );
}

function extractIndicativo(rawValue: string | null | undefined) {
  const digits = (rawValue ?? "").replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  const normalized = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (normalized.length < 10) {
    return null;
  }

  const ddd = normalized.slice(0, 2);
  return {
    code: ddd,
    label: dddLabels[ddd] ?? `DDD ${ddd}`,
  };
}

function CenterLoader() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="flex items-center gap-3 text-slate-300">
        <LoaderCircle size={18} className="animate-spin" />
        <span className="text-sm">Carregando atendimento...</span>
      </div>
    </div>
  );
}

function ChatMediaModal({
  open,
  chatTitle,
  items,
  onClose,
}: {
  open: boolean;
  chatTitle: string;
  items: ReturnType<typeof getChatMediaItems>;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-brand-dark shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Midias e anexos</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{chatTitle}</h2>
            <p className="mt-1 text-sm text-slate-400">Tudo que foi anexado nesta conversa fica reunido aqui.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <AttachmentPreview attachment={item.attachment} />
                  <div className="mt-3 space-y-1">
                    <p className="truncate text-sm font-semibold text-white">{item.attachment.name || "Arquivo"}</p>
                    <p className="text-xs text-slate-400">
                      {item.category === "image" ? "Imagem" : item.category === "video" ? "Video" : "Arquivo"} • {formatFileSize(item.attachment.size)}
                    </p>
                    <p className="text-xs text-slate-500">{formatFullDateTime(item.message.createdAt)}</p>
                  </div>
                  {item.attachment.publicUrl ? (
                    <a
                      href={item.attachment.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
                    >
                      <ExternalLink size={14} />
                      Abrir anexo
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-8 text-center text-slate-400">
              Nenhuma midia ou anexo registrado neste contato ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAtendimentoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedHandoffContactId = searchParams.get("handoffContactId")?.trim() || null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationViewportRef = useRef<HTMLDivElement | null>(null);
  const conversationBottomRef = useRef<HTMLDivElement | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [chatChannelFilter, setChatChannelFilter] = useState<ChatChannelFilter>("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedConversationKey, setSelectedConversationKey] = useState<string | null>(null);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, ChatMessageRecord[]>>({});
  const [replyText, setReplyText] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<PendingAttachment[]>([]);
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const availableProjects = useMemo(() => {
    if (projects.length) {
      return projects;
    }

    return (currentUser?.memberships ?? [])
      .filter((membership) => Boolean(membership.projetoId))
      .map((membership) => ({
        id: membership.projetoId ?? "",
        nome: membership.projetoNome?.trim() || "Projeto sem nome",
        descricao: "",
        status: "ativo",
      }))
      .filter((project) => project.id);
  }, [currentUser?.memberships, projects]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  useEffect(() => {
    if (!selectedChat?.conversationKey) {
      return;
    }

    setSelectedConversationKey(selectedChat.conversationKey);
  }, [selectedChat?.conversationKey]);
  const currentUserFirstName = useMemo(() => getFirstName(currentUser?.name), [currentUser?.name]);
  const resolvedProjectName = useMemo(() => {
    if (!activeProjectId && availableProjects.length === 1) {
      return availableProjects[0].nome;
    }

    const fromLoadedProjects = availableProjects.find((project) => project.id === activeProjectId)?.nome?.trim();
    if (fromLoadedProjects) {
      return fromLoadedProjects;
    }

    const fromMemberships = currentUser?.memberships?.find((membership) => membership.projetoId === activeProjectId)?.projetoNome?.trim();
    if (fromMemberships) {
      return fromMemberships;
    }

    return projectName.trim() || "Projeto selecionado";
  }, [activeProjectId, availableProjects, currentUser?.memberships, projectName]);

  const selectedMessages = selectedChatId ? (messagesByChatId[selectedChatId] ?? []) : [];
  const selectedMediaItems = useMemo(() => getChatMediaItems(selectedMessages), [selectedMessages]);
  const filteredChats = useMemo(() => {
    if (chatChannelFilter === "all") {
      return chats;
    }

    if (chatChannelFilter === "whatsapp") {
      return chats.filter((chat) => chat.canal === "whatsapp");
    }

    return chats.filter((chat) => chat.canal !== "whatsapp");
  }, [chatChannelFilter, chats]);
  const chatChannelTabs = useMemo(
    () => [
      { id: "all" as const, label: "Todos", total: chats.length, icon: SplitSquareVertical },
      { id: "whatsapp" as const, label: "WhatsApp", total: chats.filter((chat) => chat.canal === "whatsapp").length, icon: MessageCircleMore },
      { id: "site" as const, label: "Site", total: chats.filter((chat) => chat.canal !== "whatsapp").length, icon: BriefcaseBusiness },
    ],
    [chats],
  );
  const dashboard = useMemo(() => {
    const whatsappChats = chats.filter((chat) => chat.canal === "whatsapp");
    const siteChats = chats.filter((chat) => chat.canal !== "whatsapp");
    const latestChat = chats[0] ?? null;
    const activeToday = chats.filter((chat) => {
      const updatedDate = new Date(chat.updatedAt);
      const now = new Date();
      return updatedDate.toDateString() === now.toDateString();
    }).length;

    const indicativoMap = new Map<string, IndicativoSummary>();
    whatsappChats.forEach((chat) => {
      const indicativo = extractIndicativo(chat.identificadorExterno);
      if (!indicativo) {
        return;
      }

      const current = indicativoMap.get(indicativo.code);
      indicativoMap.set(indicativo.code, {
        code: indicativo.code,
        label: indicativo.label,
        total: (current?.total ?? 0) + 1,
      });
    });

    const topIndicativos = [...indicativoMap.values()]
      .sort((left, right) => right.total - left.total)
      .slice(0, 3);

    const practicalSummary = latestChat
      ? `${getChatChannelLabel(latestChat.canal)} puxando o ritmo mais recente com atualizacao em ${formatDateTime(latestChat.updatedAt)}.`
      : "Ainda nao existem conversas suficientes para gerar leitura do atendimento.";

    return {
      totalChats: chats.length,
      whatsappChats: whatsappChats.length,
      siteChats: siteChats.length,
      activeToday,
      latestChat,
      topIndicativos,
      practicalSummary,
    };
  }, [chats]);

  useEffect(() => {
    if (!authResolved || !activeProjectId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("projeto", activeProjectId);

    if (selectedChatId) {
      nextParams.set("chat", selectedChatId);
    } else {
      nextParams.delete("chat");
      nextParams.delete("handoff");
    }

    const currentProjeto = searchParams.get("projeto")?.trim() || null;
    const currentChat = searchParams.get("chat")?.trim() || null;
    const nextProjeto = nextParams.get("projeto")?.trim() || null;
    const nextChat = nextParams.get("chat")?.trim() || null;

    if (currentProjeto === nextProjeto && currentChat === nextChat) {
      return;
    }

    router.replace(`/admin/atendimento?${nextParams.toString()}`, { scroll: false });
  }, [activeProjectId, authResolved, router, searchParams, selectedChatId]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch("/api/admin/projetos", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; projetos?: Projeto[] };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel carregar os projetos.");
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      setProjects(payload.projetos ?? []);
      setLoadingProjects(false);
    } catch {
      setFeedback("Nao foi possivel carregar os projetos.");
      setProjects([]);
      setLoadingProjects(false);
    }
  };

  const loadChats = async (projetoId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingChats(true);
      setFeedback(null);
    }

    try {
      const response = await fetch(`/api/admin/chats?projetoId=${encodeURIComponent(projetoId)}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; chats?: ChatRecord[] };

      if (!response.ok) {
        if (response.status === 403 && typeof window !== "undefined") {
          window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
          setActiveProjectId(null);
          await loadProjects();
        }

        setFeedback(payload.error ?? "Nao foi possivel carregar as conversas.");
        setChats([]);
        setSelectedChatId(null);
        if (!options?.silent) {
          setLoadingChats(false);
        }
        return;
      }

        const nextChats = payload.chats ?? [];
        setChats(nextChats);
        setSelectedChatId((current) => {
          if (current && nextChats.some((chat) => chat.id === current)) {
            return current;
          }

          if (selectedConversationKey) {
            const matchingConversation = nextChats.find((chat) => chat.conversationKey === selectedConversationKey);
            if (matchingConversation) {
              return matchingConversation.id;
            }
          }

          return nextChats[0]?.id ?? null;
        });
      if (!options?.silent) {
        setLoadingChats(false);
      }
    } catch {
      setFeedback("Nao foi possivel carregar as conversas.");
      setChats([]);
      setSelectedChatId(null);
      if (!options?.silent) {
        setLoadingChats(false);
      }
    }
  };

  const loadConversation = async (chatId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingConversation(true);
      setFeedback(null);
    }

    try {
      const response = await fetch(`/api/admin/chats/${chatId}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        error?: string;
        messages?: ChatMessageRecord[];
        handoff?: ChatRecord["handoff"];
      };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel carregar a conversa.");
        if (!options?.silent) {
          setLoadingConversation(false);
        }
        return;
      }

      setMessagesByChatId((current) => ({
        ...current,
        [chatId]: (payload.messages ?? []).filter((message) => message.role !== "system"),
      }));
      if (payload.handoff) {
        setChats((current) =>
          current.map((chat) => (chat.id === chatId ? { ...chat, handoff: payload.handoff ?? null } : chat)),
        );
      }
      if (!options?.silent) {
        setLoadingConversation(false);
      }
    } catch {
      setFeedback("Nao foi possivel carregar a conversa.");
      if (!options?.silent) {
        setLoadingConversation(false);
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentProjectUser();
      setCurrentUser(user);
      setAuthResolved(true);

      if (!canAccessWorkspace(user)) {
        return;
      }

      const storedProjectId = typeof window === "undefined"
        ? null
        : window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim() || null;

      if (storedProjectId) {
        setActiveProjectId(storedProjectId);
      }

      await loadProjects();
    };

    void load();
  }, []);

  useEffect(() => {
    if (!authResolved || currentUser) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `/?returnTo=${encodeURIComponent(returnTo)}`;
  }, [authResolved, currentUser]);

  useEffect(() => {
    const requestedProjectId = searchParams.get("projeto")?.trim() || null;
    if (!requestedProjectId || activeProjectId === requestedProjectId) {
      return;
    }

    const projectFromList = availableProjects.find((project) => project.id === requestedProjectId);
    if (projectFromList) {
      void handleProjectSelect(projectFromList);
      return;
    }

    setActiveProjectId(requestedProjectId);
  }, [activeProjectId, availableProjects, searchParams]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const matchedProject = availableProjects.find((project) => project.id === activeProjectId);
    if (matchedProject) {
      setProjectName(matchedProject.nome);
    } else {
      const membershipProject = currentUser?.memberships?.find((membership) => membership.projetoId === activeProjectId)?.projetoNome?.trim();
      if (membershipProject) {
        setProjectName(membershipProject);
      }
    }

    void loadChats(activeProjectId);
  }, [activeProjectId, availableProjects, currentUser?.memberships]);

  useEffect(() => {
    if (!availableProjects.length) {
      return;
    }

    if (activeProjectId && availableProjects.some((project) => project.id === activeProjectId)) {
      return;
    }

    if (availableProjects.length === 1) {
      void handleProjectSelect(availableProjects[0]);
    }
  }, [activeProjectId, availableProjects]);

  useEffect(() => {
    if (!selectedChatId || messagesByChatId[selectedChatId]) {
      return;
    }

    void loadConversation(selectedChatId);
  }, [messagesByChatId, selectedChatId]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void loadChats(activeProjectId, { silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void loadConversation(selectedChatId, { silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    const viewport = conversationViewportRef.current;
    const bottom = conversationBottomRef.current;
    if (!viewport || !bottom) {
      return;
    }

    requestAnimationFrame(() => {
      bottom.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [selectedChatId, selectedMessages.length, loadingConversation]);

  useEffect(() => {
    resizeReplyTextarea(replyTextareaRef.current);
  }, [replyText]);

  useEffect(() => {
    const requestedChatId = searchParams.get("chat")?.trim() || null;
    if (!requestedChatId || !chats.some((chat) => chat.id === requestedChatId)) {
      return;
    }

    setSelectedChatId(requestedChatId);
    const requestedChat = chats.find((chat) => chat.id === requestedChatId) ?? null;
    if (requestedChat?.conversationKey) {
      setSelectedConversationKey(requestedChat.conversationKey);
    }

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setMobileConversationOpen(true);
    }
  }, [chats, searchParams]);

  useEffect(() => {
    if (!filteredChats.length) {
      return;
    }

    if (selectedChatId && filteredChats.some((chat) => chat.id === selectedChatId)) {
      return;
    }

    setSelectedChatId(filteredChats[0]?.id ?? null);
  }, [filteredChats, selectedChatId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncDesktopState = (event?: MediaQueryListEvent) => {
      const matchesDesktop = event?.matches ?? mediaQuery.matches;
      if (matchesDesktop) {
        setMobileConversationOpen(false);
      }
    };

    syncDesktopState();
    mediaQuery.addEventListener("change", syncDesktopState);
    return () => mediaQuery.removeEventListener("change", syncDesktopState);
  }, []);

  const handleProjectSelect = async (project: Projeto) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, project.id);
    }

    setProjectName(project.nome);
    setActiveProjectId(project.id);
    setFeedback(null);
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    const chat = chats.find((item) => item.id === chatId) ?? null;
    if (chat?.conversationKey) {
      setSelectedConversationKey(chat.conversationKey);
    }
    setMobileHeaderMenuOpen(false);

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setMobileConversationOpen(true);
    }
  };

  const handleHandoffAction = async (action: "claim" | "release") => {
    if (!selectedChatId) {
      return;
    }

    setMobileHeaderMenuOpen(false);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/chats/${selectedChatId}/handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          motivo: action === "claim" ? "Atendimento assumido pela inbox." : "Atendimento liberado para a IA pela inbox.",
          metadata:
            action === "claim" && linkedHandoffContactId
              ? { handoffContactId: linkedHandoffContactId }
              : undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string; handoff?: ChatRecord["handoff"] };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel atualizar o handoff.");
        return;
      }

      setChats((current) =>
        current.map((chat) => (chat.id === selectedChatId ? { ...chat, handoff: payload.handoff ?? null } : chat)),
      );
    } catch {
      setFeedback("Nao foi possivel atualizar o handoff.");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChatId || (!replyText.trim() && !selectedAttachments.length)) {
      return;
    }

    setSendingMessage(true);
    setFeedback(null);

    try {
      let uploadedAttachments: Array<{
        name?: string;
        type?: string;
        size?: number;
        publicUrl?: string | null;
        storagePath?: string | null;
        category?: "image" | "video" | "file" | null;
      }> = [];

      if (selectedAttachments.length) {
        const formData = new FormData();
        selectedAttachments.forEach((attachment) => {
          formData.append("files", attachment.file);
        });

        const uploadResponse = await fetch(`/api/admin/chats/${selectedChatId}/attachments`, {
          method: "POST",
          body: formData,
        });

        const uploadPayload = (await uploadResponse.json()) as {
          error?: string;
          attachments?: typeof uploadedAttachments;
        };

        if (!uploadResponse.ok) {
          setFeedback(uploadPayload.error ?? "Nao foi possivel enviar os anexos.");
          setSendingMessage(false);
          return;
        }

        uploadedAttachments = Array.isArray(uploadPayload.attachments) ? uploadPayload.attachments : [];
      }

      const response = await fetch(`/api/admin/chats/${selectedChatId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conteudo: replyText,
          attachments: uploadedAttachments,
          sentByHuman: true,
          senderName: currentUserFirstName,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: ChatMessageRecord };

      if (!response.ok || !payload.message) {
        setFeedback(payload.error ?? "Nao foi possivel enviar a mensagem.");
        setSendingMessage(false);
        return;
      }

      const sentMessage = payload.message;
      setMessagesByChatId((current) => ({
        ...current,
        [selectedChatId]: [...(current[selectedChatId] ?? []), sentMessage],
      }));
      setChats((current) =>
        [...current]
          .map((chat) =>
            chat.id === selectedChatId
              ? {
                  ...chat,
                  handoff: {
                    status: "human" as const,
                    claimedByUsuarioId: currentUser?.id ?? null,
                    claimedAt: sentMessage.createdAt,
                  },
                  ultimaMensagem: replyText.trim() || (uploadedAttachments.length ? "Anexo enviado." : sentMessage.conteudo),
                  updatedAt: sentMessage.createdAt,
                  totalMensagens: (chat.totalMensagens ?? 0) + 1,
                }
              : chat,
          )
          .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
      );
      setReplyText("");
      resizeReplyTextarea(replyTextareaRef.current);
      setSelectedAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSendingMessage(false);
    } catch {
      setFeedback("Nao foi possivel enviar a mensagem.");
      setSendingMessage(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChatId || !activeProjectId || deletingChat) {
      return;
    }

    setMobileHeaderMenuOpen(false);
    const chatName = selectedChat ? getChatTitle(selectedChat) : "esta conversa";
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Remover todo o historico de ${chatName}? Essa limpeza apaga mensagens, handoff e anexos desta conversa no banco, mas mantem os dados de uso de tokens.`);
      if (!confirmed) {
        return;
      }
    }

    setDeletingChat(true);
    setFeedback(null);

    try {
      const deletedChatId = selectedChatId;
      const response = await fetch(`/api/admin/chats/${deletedChatId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok) {
        setFeedback(payload.error ?? "Nao foi possivel remover a conversa.");
        setDeletingChat(false);
        return;
      }

      setMessagesByChatId((current) => {
        const next = { ...current };
        delete next[deletedChatId];
        return next;
      });
      setSelectedAttachments([]);
      setReplyText("");
      setMediaModalOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadChats(activeProjectId);
      setFeedback("Conversa removida com sucesso.");
      setDeletingChat(false);
    } catch {
      setFeedback("Nao foi possivel remover a conversa.");
      setDeletingChat(false);
    }
  };

  if (!authResolved) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
          <CenterLoader />
        </section>
      </main>
    );
  }

  if (!currentUser || !canAccessWorkspace(currentUser)) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8 text-slate-200">
          <h1 className="text-2xl font-bold text-white">Acesso ao atendimento indisponivel</h1>
          <p className="mt-3 text-sm text-slate-300">Entre com um usuario valido para abrir a inbox unificada.</p>
        </section>
      </main>
    );
  }

  if (!activeProjectId && availableProjects.length !== 1) {
    return (
      <main className="space-y-5">
        <AdminPageHeader
          eyebrow="Atendimento"
          eyebrowIcon={<MessageCircleMore size={14} />}
          title="Selecione um projeto para abrir as conversas"
          description="A inbox unificada usa o projeto ativo para juntar chat do site e WhatsApp no mesmo lugar."
        />

        {feedback ? <section className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</section> : null}

        <section className="rounded-[24px] border border-white/8 bg-white/[0.02] p-5 shadow-[0_18px_38px_rgba(2,8,23,0.22)]">
          {loadingProjects ? <CenterLoader /> : null}

          {!loadingProjects && !projects.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
              Nenhum projeto disponivel para selecionar.
            </div>
          ) : null}

          {!loadingProjects && availableProjects.length ? (
            <div className="grid gap-3">
              {availableProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void handleProjectSelect(project)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all hover:border-cyan-400/30 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{project.nome}</p>
                      <p className="mt-1 text-sm text-slate-400">{project.descricao || "Sem descricao."}</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                      {project.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <>
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-y-contain xl:overflow-hidden">
      <div className={mobileConversationOpen ? "hidden xl:block" : ""}>
        <AdminPageHeader
          eyebrow="Atendimento"
          eyebrowIcon={<MessageCircleMore size={14} />}
          title="Conversas"
          actions={(
            availableProjects.length <= 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
                  }
                  setActiveProjectId(null);
                  setChats([]);
                  setSelectedChatId(null);
                  setMessagesByChatId({});
                  void loadProjects();
                }}
                className={`${compactButtonClass} border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10`}
              >
                <BriefcaseBusiness size={15} />
                Trocar projeto
              </button>
            ) : null
          )}
        >
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 sm:text-sm">
              <span>Projeto ativo:</span>
              {availableProjects.length > 1 ? (
                <label className="relative inline-flex min-w-[220px] items-center">
                  <select
                    value={activeProjectId ?? ""}
                    onChange={(event) => {
                      const nextProject = availableProjects.find((project) => project.id === event.target.value);
                      if (nextProject) {
                        void handleProjectSelect(nextProject);
                      }
                    }}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-9 text-xs font-semibold text-white outline-none transition-colors hover:border-white/20 focus:border-cyan-400/30 sm:text-sm"
                  >
                    <option value="" disabled>
                      Selecionar projeto
                    </option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id} className="bg-slate-950 text-white">
                        {project.nome}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400" />
                </label>
              ) : (
                <span className="font-semibold text-white">{resolvedProjectName}</span>
              )}
          </div>
        </AdminPageHeader>
      </div>

      {feedback ? <section className={`rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 ${mobileConversationOpen ? "hidden xl:block" : ""}`}>{feedback}</section> : null}

      <section className={`rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2 shadow-[0_16px_34px_rgba(2,8,23,0.18)] ${mobileConversationOpen ? "hidden xl:block" : ""}`}>
        <button
          type="button"
          onClick={() => setSummaryExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-cyan-200">
              <Sparkles size={14} />
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white">Resumo do atendimento</p>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {dashboard.practicalSummary} {dashboard.topIndicativos[0] ? `DDD em destaque: ${dashboard.topIndicativos[0].code}.` : "Sem indicativos em destaque."}
            </p>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
            {summaryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {summaryExpanded ? (
          <div className="mt-3 grid gap-3 border-t border-white/8 pt-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.9fr)]">
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Inbox total",
                  value: dashboard.totalChats,
                  detail: `${dashboard.activeToday} com atividade hoje`,
                  icon: MessageCircleMore,
                  tone: "text-cyan-200",
                },
                {
                  label: "WhatsApp",
                  value: dashboard.whatsappChats,
                  detail: `${dashboard.siteChats} no site`,
                  icon: PhoneCall,
                  tone: "text-emerald-200",
                },
                {
                  label: "Ritmo atual",
                  value: dashboard.latestChat ? formatDateTime(dashboard.latestChat.updatedAt) : "--",
                  detail: dashboard.latestChat ? getChatChannelLabel(dashboard.latestChat.canal) : "Sem atividade recente",
                  icon: Clock3,
                  tone: "text-amber-200",
                },
                {
                  label: "Indicativos",
                  value: dashboard.topIndicativos[0]?.code ?? "--",
                  detail: dashboard.topIndicativos[0] ? `${dashboard.topIndicativos[0].label} lidera` : "Sem telefone identificado",
                  icon: SplitSquareVertical,
                  tone: "text-violet-200",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-white/8 bg-slate-950/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                        <p className="mt-1.5 text-lg font-black text-white sm:text-xl">{item.value}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{item.detail}</p>
                      </div>
                      <Icon size={16} className={item.tone} />
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3">
              <div className="rounded-xl border border-white/8 bg-slate-950/30 p-3">
                <p className="text-xs font-bold text-white">Resumo pratico</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">{dashboard.practicalSummary}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {dashboard.whatsappChats > dashboard.siteChats
                    ? "O WhatsApp esta puxando mais volume que o site neste projeto."
                    : dashboard.siteChats > dashboard.whatsappChats
                      ? "O site esta com mais conversas que o WhatsApp neste momento."
                      : "Os canais estao equilibrados neste momento."}
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-slate-950/30 p-3">
                <div className="flex items-center gap-2 text-violet-200">
                  <PhoneCall size={14} />
                  <p className="text-xs font-bold text-white">Indicativos detectados</p>
                </div>
                {dashboard.topIndicativos.length ? (
                  <div className="mt-2 space-y-2">
                    {dashboard.topIndicativos.map((indicativo) => (
                      <div key={indicativo.code} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2">
                        <div>
                          <p className="text-xs font-semibold text-white">DDD {indicativo.code}</p>
                          <p className="text-[11px] text-slate-400">{indicativo.label}</p>
                        </div>
                        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-200">
                          {indicativo.total} conversa{indicativo.total > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Ainda nao foi possivel identificar telefones suficientes nas conversas de WhatsApp.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <section className={`grid min-h-0 flex-1 items-stretch gap-3 overflow-visible pb-4 xl:overflow-hidden xl:pb-0 xl:grid-cols-[280px_minmax(0,1fr)] ${mobileConversationOpen ? "xl:grid-cols-[280px_minmax(0,1fr)]" : ""}`}>
        <div className={`flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.02] shadow-[0_18px_38px_rgba(2,8,23,0.22)] ${mobileConversationOpen ? "hidden xl:flex" : ""}`}>
          <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
            <p className="text-sm font-bold text-white">Conversas do projeto</p>
            <p className="mt-1 text-[11px] text-slate-400">Site e WhatsApp no mesmo feed.</p>
            <div className="mt-3 flex items-center gap-2">
              {chatChannelTabs.map((tab) => {
                const active = chatChannelFilter === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChatChannelFilter(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <TabIcon size={12} />
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-cyan-400/15 text-cyan-50" : "bg-white/5 text-slate-400"}`}>
                      {tab.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2.5 pb-24 xl:pb-2.5">
            {loadingChats ? <CenterLoader /> : null}

            {!loadingChats && !filteredChats.length ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                Nenhuma conversa encontrada para este filtro.
              </div>
            ) : null}

            {!loadingChats ? (
              <div className="space-y-2">
                {filteredChats.map((chat) => {
                  const active = selectedChatId === chat.id;
                  const chatAvatarUrl = getChatAvatarUrl(chat);
                  const chatSubtitle = getChatSubtitle(chat);
                  const chatTitle = getChatTitle(chat);

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => handleSelectChat(chat.id)}
                      className={`block w-full rounded-xl border px-2.5 py-2.5 text-left transition-all ${
                        active
                          ? "border-cyan-400/30 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                          active
                            ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100"
                            : "border-white/10 bg-slate-900/70 text-slate-300"
                        }`}>
                          {chatAvatarUrl ? (
                            <img src={chatAvatarUrl} alt={chatTitle} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                              {getAvatarFallbackLabel(chat)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold leading-4 text-white">{chatTitle}</p>
                              {chatSubtitle ? <p className="mt-0.5 truncate text-[10px] leading-4 text-slate-400">{chatSubtitle}</p> : null}
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] ${getChatChannelTone(chat.canal)}`}>
                                  {getChatChannelLabel(chat.canal)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                                  {chat.totalMensagens} msg
                                </span>
                              </div>
                            </div>
                            <p className={`shrink-0 text-[10px] ${active ? "text-cyan-100" : "text-slate-500"}`}>
                              {formatChatTime(chat.updatedAt)}
                            </p>
                          </div>
                          <p className="mt-1 truncate text-[10px] leading-4 text-slate-400">{getChatPreviewText(chat.ultimaMensagem)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

          <div
            className={`grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-white/8 bg-white/[0.02] shadow-[0_18px_38px_rgba(2,8,23,0.22)] ${
              mobileConversationOpen
                ? "fixed inset-x-0 bottom-0 top-[73px] z-40 rounded-none bg-[#07111f] xl:relative xl:inset-auto xl:z-auto xl:rounded-[22px] xl:bg-white/[0.02]"
                : "hidden rounded-[22px] xl:grid"
            }`}
          >
          {selectedChat ? (
            <>
              <div className="shrink-0 border-b border-white/10 px-3 py-2.5 sm:px-4">
                <div className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setMobileConversationOpen(false)}
                        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white xl:hidden"
                        aria-label="Voltar para conversas"
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200">
                        {getChatAvatarUrl(selectedChat) ? (
                          <img
                            src={getChatAvatarUrl(selectedChat) || ""}
                            alt={getChatTitle(selectedChat)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          getAvatarFallbackLabel(selectedChat)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 break-words text-sm font-bold text-white sm:text-base">{getChatTitle(selectedChat)}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${getChatChannelTone(selectedChat.canal)}`}>
                            {getChatChannelLabel(selectedChat.canal)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-[11px] text-slate-400 sm:text-xs">
                          {getChatPhone(selectedChat) ? `${getChatPhone(selectedChat)} • ` : ""}Ultima atividade em {formatFullDateTime(selectedChat.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isChatUnderHumanHandoff(selectedChat) ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>
                      {isChatUnderHumanHandoff(selectedChat) ? "Voce esta atendendo" : "IA atendendo"}
                    </span>
                    <div className="relative xl:hidden">
                      <button
                        type="button"
                        onClick={() => setMobileHeaderMenuOpen((current) => !current)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:border-white/20 hover:bg-white/10"
                        aria-label="Mais acoes"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {mobileHeaderMenuOpen ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setMobileHeaderMenuOpen(false)}
                            className="fixed inset-0 z-40 bg-slate-950/30 xl:hidden"
                            aria-label="Fechar menu de acoes"
                          />
                          <div className="fixed inset-x-4 top-[138px] z-50 rounded-2xl border border-white/10 bg-[#091321] p-2 shadow-2xl xl:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setMobileHeaderMenuOpen(false);
                                setMediaModalOpen(true);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition-colors hover:bg-white/5"
                            >
                              <Paperclip size={14} />
                              Midias
                            </button>
                            {!isChatUnderHumanHandoff(selectedChat) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setMobileHeaderMenuOpen(false);
                                  void handleHandoffAction("claim");
                                }}
                                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition-colors hover:bg-emerald-500/10"
                              >
                                Assumir atendimento
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setMobileHeaderMenuOpen(false);
                                  void handleHandoffAction("release");
                                }}
                                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-amber-50 transition-colors hover:bg-amber-500/10"
                              >
                                Liberar para IA
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDeleteChat()}
                              disabled={deletingChat}
                              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition-colors hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingChat ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Limpar conversa
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="hidden flex-wrap items-center gap-2 xl:flex">
                      <button
                        type="button"
                        onClick={() => void handleDeleteChat()}
                        disabled={deletingChat}
                        className={`${compactButtonClass} border-rose-500/20 bg-rose-500/10 text-rose-100 hover:border-rose-400/30 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60`}
                        title="Remover conversa"
                      >
                        {deletingChat ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Limpar conversa
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaModalOpen(true)}
                        className={`${compactButtonClass} border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10`}
                      >
                        <Paperclip size={14} />
                        Midias
                      </button>
                      {!isChatUnderHumanHandoff(selectedChat) ? (
                        <button
                          type="button"
                          onClick={() => void handleHandoffAction("claim")}
                          className={`${compactButtonClass} border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/30 hover:bg-emerald-500/15`}
                        >
                          Assumir atendimento
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleHandoffAction("release")}
                          className={`${compactButtonClass} border-amber-400/20 bg-amber-500/10 text-amber-50 hover:border-amber-300/30 hover:bg-amber-500/15`}
                        >
                          Liberar para IA
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div ref={conversationViewportRef} className="min-h-0 overflow-y-auto px-3 py-3 sm:px-4">
                {loadingConversation ? <CenterLoader /> : null}

                {!loadingConversation && !selectedMessages.length ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : null}

                {!loadingConversation ? (
                  <div className="space-y-2.5 pb-28">
                    {selectedMessages.map((message) => {
                      const fromUser = message.role === "user";
                      const sentByHuman = message.metadata?.sentByHuman === true;
                      const senderName = message.metadata?.senderName?.trim() || currentUserFirstName;

                      return (
                        <div key={message.id} className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[92%] rounded-2xl px-3 py-2.5 shadow-[0_12px_24px_rgba(2,8,23,0.16)] sm:max-w-[84%] ${
                              fromUser
                                ? "border border-white/10 bg-white/5 text-slate-100"
                                : sentByHuman
                                  ? "border border-amber-400/20 bg-amber-500/10 text-amber-50"
                                  : "border border-cyan-400/20 bg-cyan-500/10 text-cyan-50"
                            }`}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              {fromUser ? "USER" : sentByHuman ? senderName : "ASSISTANT"}
                            </p>
                            <ChatMessageBody content={message.conteudo} />
                            {message.metadata?.attachments?.length ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {message.metadata.attachments.map((attachment, index) => {
                                  const attachmentCategory = getAttachmentCategory(attachment.type, attachment.category);
                                  const truncatedName = truncateFileName(attachment.name, 28);

                                  return (
                                    <a
                                      key={`${message.id}-attachment-${index}`}
                                      href={attachment.publicUrl || undefined}
                                      target={attachment.publicUrl ? "_blank" : undefined}
                                      rel={attachment.publicUrl ? "noreferrer" : undefined}
                                      className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-[11px] text-slate-200 transition-colors hover:bg-white/10"
                                    >
                                      {attachmentCategory === "image" && attachment.publicUrl ? (
                                        <img
                                          src={attachment.publicUrl}
                                          alt={attachment.name || "Imagem"}
                                          className="aspect-[4/3] w-full bg-slate-950/40 object-cover"
                                        />
                                      ) : null}
                                      <div className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          {attachmentCategory === "image" ? <ExternalLink size={12} /> : <Paperclip size={12} />}
                                          <span className="truncate font-semibold" title={attachment.name || "arquivo"}>
                                            {truncatedName}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-slate-400">
                                          {attachmentCategory} - {formatFileSize(attachment.size)}
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}
                            {message.metadata?.assets?.length ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 xl:max-w-[980px]">
                                {message.metadata.assets.map((asset, index) => (
                                  <a
                                    key={`${message.id}-asset-${index}`}
                                    href={asset.targetUrl || asset.publicUrl || undefined}
                                    target={asset.targetUrl || asset.publicUrl ? "_blank" : undefined}
                                    rel={asset.targetUrl || asset.publicUrl ? "noreferrer" : undefined}
                                    className="max-w-[310px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-200 transition-colors hover:bg-white/10"
                                  >
                                    {asset.categoria === "image" && asset.publicUrl ? (
                                      <img src={asset.publicUrl} alt={asset.nome || "Imagem"} className="mb-2 aspect-[4/3] w-full rounded-lg object-cover" />
                                    ) : null}
                                    <div className="flex items-center gap-2">
                                      <ExternalLink size={12} />
                                      <span className="truncate font-semibold">{asset.nome || asset.arquivoNome || "item"}</span>
                                    </div>
                                    {asset.descricao ? <div className="mt-1 text-[10px] text-slate-400">{asset.descricao}</div> : null}
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            <p className="mt-2 text-[11px] text-slate-400">{formatDateTime(message.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={conversationBottomRef} />
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[#07111f]/96 px-3 py-2.5 backdrop-blur-xl sm:px-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const nextFiles = Array.from(event.target.files ?? []).slice(0, 5).map((file) => ({
                      file,
                      name: file.name,
                      type: file.type,
                      size: file.size,
                    }));
                    setSelectedAttachments(nextFiles);
                  }}
                />

                {selectedAttachments.length ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedAttachments.map((attachment, index) => (
                      <span
                        key={`${attachment.name}-${index}`}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        {attachment.type.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(attachment.file)}
                            alt={attachment.name}
                            className="h-7 w-7 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <Paperclip size={12} />
                        )}
                        <span className="truncate" title={attachment.name}>
                          {truncateFileName(attachment.name, 30)}
                        </span>
                        <span className="text-slate-500">{formatFileSize(attachment.size)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))
                          }
                          className="text-slate-400 transition-colors hover:text-white"
                          aria-label="Remover anexo"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                {emojiTrayOpen ? (
                  <div className="mb-2 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setReplyText((current) => `${current}${current ? " " : ""}${emoji}`);
                          setEmojiTrayOpen(false);
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-lg transition-colors hover:bg-white/10"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Selecionar anexo"
                    >
                      <Paperclip size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmojiTrayOpen((current) => !current)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Abrir emojis"
                    >
                      <SmilePlus size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleHandoffAction(selectedChat && isChatUnderHumanHandoff(selectedChat) ? "release" : "claim")}
                      disabled={!selectedChat}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                        selectedChat && !isChatUnderHumanHandoff(selectedChat)
                          ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/18"
                          : "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/16"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title={
                        selectedChat && !isChatUnderHumanHandoff(selectedChat)
                          ? "Assumir atendimento agora"
                          : "Liberar para IA"
                      }
                      aria-label={
                        selectedChat && !isChatUnderHumanHandoff(selectedChat)
                          ? "Assumir atendimento agora"
                          : "Liberar para IA"
                      }
                    >
                      <Sparkles size={16} />
                    </button>
                  </div>
                  <textarea
                    ref={replyTextareaRef}
                    value={replyText}
                    onChange={(event) => {
                      setReplyText(event.target.value);
                      resizeReplyTextarea(event.target);
                    }}
                    placeholder="Digite sua resposta manual..."
                    rows={1}
                    className="h-[42px] min-h-[42px] flex-1 resize-none overflow-y-hidden rounded-2xl border border-white/10 bg-slate-950/50 px-3.5 py-2.5 text-xs leading-5 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400/30 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={sendingMessage || (!replyText.trim() && !selectedAttachments.length)}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-2.5 text-xs font-semibold text-sky-50 transition-all hover:border-sky-300/30 hover:bg-sky-400/14 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                  >
                    {sendingMessage ? <LoaderCircle size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center px-6 text-center text-slate-400 xl:flex">
              <div>
                <p className="text-xl font-bold text-white">Selecione uma conversa</p>
                <p className="mt-3 text-sm">Escolha um chat na coluna da esquerda para abrir o historico completo.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
    <ChatMediaModal
      open={mediaModalOpen}
      chatTitle={selectedChat ? getChatTitle(selectedChat) : "Conversa"}
      items={selectedMediaItems}
      onClose={() => setMediaModalOpen(false)}
    />
    </>
  );
}
