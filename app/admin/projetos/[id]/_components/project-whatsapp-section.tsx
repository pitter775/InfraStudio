"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Headset, LoaderCircle, Pencil, Plus, Power, QrCode, Trash2, Unplug, Waypoints } from "lucide-react";
import { formatBrazilWhatsAppPhone, formatBrazilWhatsAppPhoneInput } from "@/lib/whatsapp-phone";

type AgenteSummary = {
  id: string;
  nome: string;
};

type WhatsAppChannelSession = {
  connectionStatus?: "offline" | "aguardando_qr" | "connecting" | "online";
  qrCodeUrl?: string | null;
  qrCodeDataUrl?: string | null;
  qrCodeText?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastSyncAt?: string | null;
  worker?: string | null;
  notes?: string | null;
};

type WhatsAppChannel = {
  id: string;
  projetoId: string | null;
  agenteId: string | null;
  numero: string;
  status: "ativo" | "inativo";
  sessionData: WhatsAppChannelSession | null;
  createdAt: string;
  updatedAt: string;
};

type WhatsAppHandoffContact = {
  id: string;
  projetoId: string;
  canalWhatsappId: string | null;
  usuarioId: string | null;
  nome: string;
  numero: string;
  papel: string | null;
  observacoes: string | null;
  ativo: boolean;
  receberAlertas: boolean;
  createdAt: string;
  updatedAt: string;
};

type WhatsAppHandoffContactFormState = {
  nome: string;
  numero: string;
  papel: string;
  observacoes: string;
};

type ProjectWhatsAppSectionProps = {
  demoMode: boolean;
  whatsappServiceEnabled: boolean;
  whatsappServiceHealthMessage: string | null;
  whatsappServiceHealthTone: "online" | "offline" | "checking";
  primaryChannel: WhatsAppChannel | null;
  totalChannels: number;
  agentes: AgenteSummary[];
  agenteAtivo: AgenteSummary | null;
  serviceStatusByChannel: Record<string, string>;
  serviceQrByChannel: Record<string, string | null>;
  connectingChannelId: string | null;
  disconnectingChannelId: string | null;
  deletingChannelId: string | null;
  handoffContacts: WhatsAppHandoffContact[];
  handoffContactForm: WhatsAppHandoffContactFormState;
  loadingHandoffContacts: boolean;
  savingHandoffContact: boolean;
  testingHandoffAlert: boolean;
  updatingHandoffContactId: string | null;
  handoffFeedback: string | null;
  handoffFeedbackTone: "success" | "error";
  actionButtonClass: string;
  onOpenNewChannel: () => void;
  onConnectChannel: (channel: WhatsAppChannel, options?: { refreshQr?: boolean }) => void;
  onDisconnectChannel: (channel: WhatsAppChannel) => void;
  onEditChannel: (channel: WhatsAppChannel) => void;
  onDeleteChannel: (channel: WhatsAppChannel) => void;
  onHandoffFormChange: (field: keyof WhatsAppHandoffContactFormState, value: string) => void;
  onCreateHandoffContact: () => void;
  onTestHandoffAlert: () => void;
  onUpdateHandoffContact: (
    contact: WhatsAppHandoffContact,
    patch: Partial<Pick<WhatsAppHandoffContact, "ativo" | "receberAlertas">>,
  ) => void;
  onDeleteHandoffContact: (contact: WhatsAppHandoffContact) => void;
};

function formatWhatsAppPhone(value: string) {
  return formatBrazilWhatsAppPhone(value);
}

function getChannelStatusTone(status: string) {
  if (status === "conectado" || status === "online") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (status === "connecting") {
    return "bg-cyan-500/15 text-cyan-200";
  }

  if (status === "aguardando_qr") {
    return "bg-amber-500/15 text-amber-200";
  }

  return "bg-slate-800 text-slate-400";
}

function getChannelStatusLabel(status: string | null | undefined) {
  if (status === "online" || status === "conectado") {
    return "conectado";
  }

  if (status === "connecting") {
    return "connecting";
  }

  if (status === "aguardando_qr") {
    return "aguardando_qr";
  }

  return "desconectado";
}

function getWhatsAppChannelUserNote(note: string | null | undefined) {
  const value = String(note || "").trim();
  if (!value) {
    return "";
  }

  const normalized = value.toLowerCase();

  if (
    normalized.includes("failed to launch the browser process") ||
    normalized.includes("puppeteer") ||
    normalized.includes("chrome") ||
    normalized.includes("chromium") ||
    normalized.includes("libglib")
  ) {
    return "O servidor do WhatsApp nao conseguiu iniciar o navegador interno. Nossa equipe ja consegue ver o erro tecnico nos logs.";
  }

  if (normalized.includes("pareamento aceito pelo whatsapp")) {
    return "Pareamento aceito. Finalizando a conexao do canal.";
  }

  if (normalized.includes("qr code gerado e aguardando leitura")) {
    return "QR Code gerado. Escaneie com o WhatsApp deste numero.";
  }

  if (normalized.includes("estado atual do cliente:")) {
    return "O canal esta processando a conexao com o WhatsApp.";
  }

  if (normalized.includes("canal conectado e pronto para receber mensagens")) {
    return "Canal conectado com sucesso e pronto para receber mensagens.";
  }

  if (normalized.includes("acione o worker externo para gerar o qr")) {
    return 'Clique em "Gerar QR Code" para iniciar a conexao deste numero.';
  }

  if (normalized.includes('clique em "gerar qr code" para iniciar a conexao')) {
    return 'Clique em "Gerar QR Code" para iniciar a conexao deste numero.';
  }

  if (normalized.includes("falha de autenticacao")) {
    return "A autenticacao do WhatsApp falhou. Tente conectar novamente.";
  }

  if (normalized.includes("cliente desconectado")) {
    return "O canal foi desconectado. Tente conectar novamente.";
  }

  if (normalized.includes("mensagem recebida de")) {
    return "Mensagem recebida. O atendimento automatico foi acionado.";
  }

  if (normalized.includes("resposta enviada com sucesso para")) {
    return "Resposta enviada com sucesso para o cliente.";
  }

  if (normalized.includes("falha ao processar a mensagem")) {
    return "O servidor recebeu a mensagem, mas encontrou uma falha ao processa-la. Veja os logs para o detalhe tecnico.";
  }

  return value;
}

function BusyIcon() {
  return <LoaderCircle size={15} className="animate-spin" />;
}

export function ProjectWhatsAppSection({
  demoMode,
  whatsappServiceEnabled,
  whatsappServiceHealthMessage,
  whatsappServiceHealthTone,
  primaryChannel,
  totalChannels,
  agentes,
  agenteAtivo,
  serviceStatusByChannel,
  serviceQrByChannel,
  connectingChannelId,
  disconnectingChannelId,
  deletingChannelId,
  handoffContacts,
  handoffContactForm,
  loadingHandoffContacts,
  savingHandoffContact,
  testingHandoffAlert,
  updatingHandoffContactId,
  handoffFeedback,
  handoffFeedbackTone,
  actionButtonClass,
  onOpenNewChannel,
  onConnectChannel,
  onDisconnectChannel,
  onEditChannel,
  onDeleteChannel,
  onHandoffFormChange,
  onCreateHandoffContact,
  onTestHandoffAlert,
  onUpdateHandoffContact,
  onDeleteHandoffContact,
}: ProjectWhatsAppSectionProps) {
  const activeHandoffContacts = handoffContacts.filter((contact) => contact.ativo && contact.receberAlertas);
  const [mobileWhatsAppTab, setMobileWhatsAppTab] = useState<"channel" | "handoff">("channel");
  const whatsAppServiceHealthClass =
    whatsappServiceHealthTone === "online"
      ? "text-emerald-300"
      : whatsappServiceHealthTone === "offline"
        ? "text-rose-300"
        : "text-amber-200";

  return (
    <div className="space-y-4">
      <section>
        <div className="px-1 py-1">
          <h3 className="inline-flex items-center gap-2 text-xl font-bold text-white"><Waypoints size={18} className="text-cyan-100" />WhatsApp do projeto</h3>
          <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">Conecte, acompanhe e ajuste o numero principal que atende seus clientes.</p>
          {whatsappServiceHealthMessage ? (
            <p className={`mt-2 text-sm font-semibold ${whatsAppServiceHealthClass}`}>{whatsappServiceHealthMessage}</p>
          ) : null}
          {!whatsappServiceEnabled ? (
            <p className="mt-3 text-xs text-amber-200/90">A conexao do WhatsApp ainda nao esta disponivel neste ambiente.</p>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto px-1 lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: "channel" as const, label: "Conexao", icon: QrCode },
            { id: "handoff" as const, label: "Atendimento humano", icon: Headset },
          ].map((tab) => {
            const TabIcon = tab.icon;

            return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileWhatsAppTab(tab.id)}
              className={`shrink-0 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold transition-all ${
                mobileWhatsAppTab === tab.id
                  ? "border-cyan-300/35 bg-cyan-400/16 text-cyan-50 shadow-[0_10px_24px_rgba(34,211,238,0.18)]"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.07]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <TabIcon size={14} className={mobileWhatsAppTab === tab.id ? "text-cyan-100" : "text-slate-400"} />
                {tab.label}
              </span>
            </button>
          )})}
        </div>
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.35fr),minmax(340px,0.92fr)] xl:items-start">
          <div className={mobileWhatsAppTab === "channel" ? "" : "hidden lg:block"}>
          {primaryChannel ? (() => {
            const channel = primaryChannel;
            const agente = channel.agenteId ? agentes.find((item) => item.id === channel.agenteId) ?? null : agenteAtivo;
            const runtimeStatus = serviceStatusByChannel[channel.id] ?? getChannelStatusLabel(channel.sessionData?.connectionStatus);
            const qrImage = serviceQrByChannel[channel.id] ?? channel.sessionData?.qrCodeDataUrl ?? channel.sessionData?.qrCodeUrl ?? null;
            const isConnected = runtimeStatus === "conectado" || runtimeStatus === "online";
            const isConnecting = runtimeStatus === "connecting";
            const isWaitingQr = runtimeStatus === "aguardando_qr" && Boolean(qrImage);
            const runtimeNote = channel.sessionData?.notes ?? null;
            const shouldShowRuntimeNote = runtimeStatus !== "desconectado" && Boolean(runtimeNote);

            return (
              <div className="grid gap-6 xl:col-start-1">
                <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),rgba(8,47,73,0.14)_35%,rgba(2,6,23,0.9)_75%)] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Canal principal</p>
                      <h4 className="mt-3 text-3xl font-bold text-white">{formatWhatsAppPhone(channel.numero)}</h4>
                      <p className="mt-2 text-sm text-slate-300">Agente: {agente?.nome ?? "agente ativo do projeto"}</p>
                      <p className="mt-2 max-w-xl text-xs text-slate-400">
                        Recomendado: use um numero so para a IA e deixe seu WhatsApp pessoal para o atendimento humano.
                      </p>
                    </div>
                    <div className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${getChannelStatusTone(runtimeStatus)}`}>
                      {isConnected ? "conectado" : isConnecting ? "reconectando" : runtimeStatus}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Estado</p>
                      <p className="mt-3 text-lg font-bold text-white">
                        {isConnected
                          ? "WhatsApp conectado"
                          : isWaitingQr
                            ? "Escaneie o QR"
                            : isConnecting
                              ? "Reconectando WhatsApp"
                              : "Aguardando conexao"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Ultima sincronizacao</p>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {channel.sessionData?.lastSyncAt ? new Date(channel.sessionData.lastSyncAt).toLocaleString("pt-BR") : "nao sincronizada"}
                      </p>
                    </div>
                  </div>

                  {shouldShowRuntimeNote ? (
                    <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {getWhatsAppChannelUserNote(runtimeNote)}
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-white/10 pt-4">
                    <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => onConnectChannel(channel, { refreshQr: true })}
                          disabled={connectingChannelId === channel.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition-all hover:border-cyan-300/30 hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {connectingChannelId === channel.id ? <BusyIcon /> : <Activity size={15} />}
                          Gerar QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => onDisconnectChannel(channel)}
                          disabled={disconnectingChannelId === channel.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {disconnectingChannelId === channel.id ? <BusyIcon /> : <Unplug size={15} />}
                          Desconectar
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditChannel(channel)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14"
                        >
                          <Pencil size={15} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteChannel(channel)}
                          disabled={deletingChannelId === channel.id}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingChannelId === channel.id ? <BusyIcon /> : <Trash2 size={15} />}
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })() : (
            <div>
              <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),rgba(6,78,59,0.08)_35%,rgba(2,6,23,0.88)_75%)] px-6 py-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Primeiro passo</p>
                <h4 className="mt-3 max-w-3xl text-3xl font-bold text-white">
                  {demoMode ? "WhatsApp oculto no modo demonstracao" : "Crie o numero que vai atender no WhatsApp"}
                </h4>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {demoMode
                    ? "Para evitar vazamento entre sessoes anonimas, o demo nao exibe nem reaproveita numeros ja cadastrados no projeto."
                    : "Assim que o canal for criado, esta area passa a mostrar o QR bem grande para escanear ou o estado de conexao."}
                </p>
                {!demoMode ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={onOpenNewChannel}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-50 transition-all hover:border-emerald-300/40 hover:bg-emerald-500/25"
                    >
                      <Plus size={16} />
                      Conectar ao WhatsApp
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          </div>

          {primaryChannel ? (
            <div className={`${mobileWhatsAppTab === "handoff" ? "" : "hidden lg:block"} rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:sticky xl:top-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Atendimento humano</p>
                {totalChannels > 1 ? (
                  <p className="text-xs text-amber-100/80">Existem {totalChannels} canais cadastrados. A interface esta priorizando o primeiro.</p>
                ) : null}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h5 className="text-base font-bold text-white">Quem recebe o aviso no WhatsApp</h5>
                    <p className="mt-2 max-w-xl text-sm text-slate-400">
                      Quando o cliente pedir para falar com uma pessoa, o sistema avisa estes numeros e abre um link direto para a conversa no painel.
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                    {activeHandoffContacts.length} ativos
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Nome do atendente</p>
                    <input
                      value={handoffContactForm.nome}
                      onChange={(event) => onHandoffFormChange("nome", event.target.value)}
                      placeholder="Ex.: Pitter"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/30"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Numero do WhatsApp</p>
                      <input
                        value={handoffContactForm.numero}
                        onChange={(event) => onHandoffFormChange("numero", formatBrazilWhatsAppPhoneInput(event.target.value))}
                        placeholder="11 99999-9999"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={14}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/30"
                      />
                    </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Papel</p>
                    <input
                      value={handoffContactForm.papel}
                      onChange={(event) => onHandoffFormChange("papel", event.target.value)}
                      placeholder="Ex.: vendas, suporte, plantao"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/30"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Observacoes</p>
                    <input
                      value={handoffContactForm.observacoes}
                      onChange={(event) => onHandoffFormChange("observacoes", event.target.value)}
                      placeholder="Ex.: horario comercial ou plantao"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/30"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onCreateHandoffContact}
                    disabled={savingHandoffContact}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-50 transition-all hover:border-emerald-300/30 hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingHandoffContact ? <BusyIcon /> : <Plus size={16} />}
                    Adicionar numero de aviso
                  </button>
                  <button
                    type="button"
                    onClick={onTestHandoffAlert}
                    disabled={testingHandoffAlert || !activeHandoffContacts.length}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition-all hover:border-cyan-300/30 hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testingHandoffAlert ? <BusyIcon /> : <Activity size={16} />}
                    Testar alerta
                  </button>
                  <p className="self-center text-xs text-slate-500">
                    O aviso vai no mesmo canal oficial conectado acima.
                  </p>
                </div>

                {handoffFeedback ? (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                      handoffFeedbackTone === "error"
                        ? "border border-rose-400/20 bg-rose-500/10 text-rose-100"
                        : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {handoffFeedback}
                  </div>
                ) : null}

                <div className="mt-5">
                  {loadingHandoffContacts && !handoffContacts.length ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
                      Carregando os numeros configurados...
                    </div>
                  ) : handoffContacts.length ? (
                    <div className="space-y-3">
                      {handoffContacts.map((contact) => {
                        const isBusy = updatingHandoffContactId === contact.id;
                        const alertsEnabled = contact.ativo && contact.receberAlertas;

                        return (
                          <div key={contact.id} className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-white">{contact.nome}</p>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${alertsEnabled ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}`}>
                                    {alertsEnabled ? "recebendo alertas" : "pausado"}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-xs text-cyan-100">{formatWhatsAppPhone(contact.numero)}</p>
                                <p className="mt-2 text-xs text-slate-400">
                                  {contact.papel ? `${contact.papel}` : "Sem papel definido"}
                                  {contact.observacoes ? ` • ${contact.observacoes}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateHandoffContact(contact, {
                                      receberAlertas: !(contact.ativo && contact.receberAlertas),
                                      ativo: contact.ativo || !contact.receberAlertas ? true : contact.ativo,
                                    })
                                  }
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-50 transition-all hover:border-cyan-300/30 hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isBusy ? <BusyIcon /> : <Power size={14} />}
                                  {alertsEnabled ? "Pausar alerta" : "Ativar alerta"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateHandoffContact(contact, {
                                      ativo: !contact.ativo,
                                      receberAlertas: !contact.ativo ? contact.receberAlertas : false,
                                    })
                                  }
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50 transition-all hover:border-amber-300/30 hover:bg-amber-500/14 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isBusy ? <BusyIcon /> : <Activity size={14} />}
                                  {contact.ativo ? "Desativar contato" : "Reativar contato"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteHandoffContact(contact)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-50 transition-all hover:border-rose-300/30 hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isBusy ? <BusyIcon /> : <Trash2 size={14} />}
                                  Remover
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
                      Nenhum numero de aviso configurado ainda. Cadastre pelo menos um contato para ser avisado quando o cliente pedir atendimento humano.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <aside className="hidden rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4 lg:block xl:col-start-2 xl:sticky xl:top-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Tutorial rapido</p>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                  whatsappServiceHealthTone === "online"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : whatsappServiceHealthTone === "offline"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-amber-500/15 text-amber-200"
                }`}>
                  {whatsappServiceHealthTone === "online" ? "worker online" : whatsappServiceHealthTone === "offline" ? "worker offline" : "verificando"}
                </span>
              </div>

              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Passo 1</p>
                  <p className="mt-2 font-semibold text-white">Cadastre o numero</p>
                  <p className="mt-2 leading-6 text-slate-400">
                    Crie o canal com o numero que vai atender e, se quiser, ja vincule ao agente principal do projeto.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Passo 2</p>
                  <p className="mt-2 font-semibold text-white">Gere o QR Code</p>
                  <p className="mt-2 leading-6 text-slate-400">
                    Depois de salvar, o painel passa a mostrar o QR para escanear no WhatsApp do aparelho correto.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Passo 3</p>
                  <p className="mt-2 font-semibold text-white">Valide a conexao</p>
                  <p className="mt-2 leading-6 text-slate-400">
                    Com o canal online, a area lateral libera os contatos de handoff e os testes de alerta para atendimento humano.
                  </p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
