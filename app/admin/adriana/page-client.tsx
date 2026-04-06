"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileCheck2, FileWarning, FolderUp, LoaderCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/_components/admin-page-header";

type ParsedXmlMeta = {
  fornecedor: string;
  numero: string;
};

type ProcessedFile = {
  id: string;
  originalName: string;
  newName: string;
  downloadUrl: string;
};

type MissingMatch = {
  pdfName: string;
  reason: string;
};

type ProcessSummary = {
  totalPdf: number;
  totalXml: number;
  processed: ProcessedFile[];
  missing: MissingMatch[];
};

const STEPS = [
  { id: 1, label: "Enviar arquivos" },
  { id: 2, label: "Processar" },
  { id: 3, label: "Baixar e limpar" },
] as const;

function normalizeBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").trim().toLowerCase();
}

function sanitizeSupplierName(name: string) {
  const cleaned = name.replace(/[^\p{L}\p{N} ]+/gu, "").trim();
  const [firstWord = "SEM_NOME"] = cleaned.split(/\s+/).filter(Boolean);
  return firstWord.toUpperCase();
}

function sanitizeInvoiceNumber(value: string) {
  return value.replace(/\D+/g, "");
}

function getFirstElementByLocalName(parent: Document | Element, localName: string) {
  return parent.getElementsByTagNameNS("*", localName)[0] ?? null;
}

function getFirstTextByLocalName(parent: Document | Element, localName: string) {
  return getFirstElementByLocalName(parent, localName)?.textContent?.trim() ?? "";
}

function parseXmlMetadata(xmlContent: string): ParsedXmlMeta | null {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xmlContent, "application/xml");

  if (documentXml.getElementsByTagName("parsererror").length) {
    return null;
  }

  const nfe =
    getFirstElementByLocalName(documentXml, "NFe")
    ?? (documentXml.documentElement.localName === "NFe" ? documentXml.documentElement : null);

  if (!nfe) {
    return null;
  }

  const infNfe = getFirstElementByLocalName(nfe, "infNFe");
  if (!infNfe) {
    return null;
  }

  const emit = getFirstElementByLocalName(infNfe, "emit");
  const ide = getFirstElementByLocalName(infNfe, "ide");

  if (!emit || !ide) {
    return null;
  }

  const fornecedor = sanitizeSupplierName(getFirstTextByLocalName(emit, "xNome"));
  const numero = sanitizeInvoiceNumber(getFirstTextByLocalName(ide, "nNF"));

  if (!fornecedor || !numero) {
    return null;
  }

  return { fornecedor, numero };
}

function resolveUniqueFileName(name: string, usedNames: Map<string, number>) {
  const key = name.toLowerCase();
  const current = usedNames.get(key) ?? 0;

  if (current === 0) {
    usedNames.set(key, 1);
    return name;
  }

  const dotIndex = name.lastIndexOf(".");
  const baseName = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex >= 0 ? name.slice(dotIndex) : "";
  const uniqueName = `${baseName}_${current + 1}${extension}`;
  usedNames.set(key, current + 1);
  return uniqueName;
}

export default function AdrianaPageClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [summary, setSummary] = useState<ProcessSummary | null>(null);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const xmlCount = useMemo(
    () => selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".xml")).length,
    [selectedFiles],
  );
  const pdfCount = useMemo(
    () => selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf")).length,
    [selectedFiles],
  );

  const currentStep = summary ? 3 : processing ? 2 : selectedFiles.length ? 2 : 1;

  useEffect(() => {
    return () => {
      summary?.processed.forEach((file) => {
        URL.revokeObjectURL(file.downloadUrl);
      });
    };
  }, [summary]);

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);
    setSummary(null);
    setFeedback(null);
  };

  const resetProcess = () => {
    summary?.processed.forEach((file) => {
      URL.revokeObjectURL(file.downloadUrl);
    });

    setSelectedFiles([]);
    setSummary(null);
    setFeedback(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDownload = (file: ProcessedFile) => {
    const link = document.createElement("a");
    link.href = file.downloadUrl;
    link.download = file.newName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleProcess = async () => {
    if (!selectedFiles.length) {
      setFeedback({ tone: "error", message: "Selecione os XMLs e PDFs antes de processar." });
      return;
    }

    setProcessing(true);
    setFeedback(null);

    try {
      const xmlFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".xml"));
      const pdfFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf"));

      const xmlMap = new Map<string, File>();
      xmlFiles.forEach((file) => {
        xmlMap.set(normalizeBaseName(file.name), file);
      });

      const usedNames = new Map<string, number>();
      const processed: ProcessedFile[] = [];
      const missing: MissingMatch[] = [];

      for (const pdfFile of pdfFiles) {
        const xmlFile = xmlMap.get(normalizeBaseName(pdfFile.name));

        if (!xmlFile) {
          missing.push({ pdfName: pdfFile.name, reason: "XML correspondente nao encontrado." });
          continue;
        }

        const xmlContent = await xmlFile.text();
        const metadata = parseXmlMetadata(xmlContent);

        if (!metadata) {
          missing.push({ pdfName: pdfFile.name, reason: "Nao foi possivel ler fornecedor e numero no XML." });
          continue;
        }

        const pdfBuffer = await pdfFile.arrayBuffer();
        const baseName = `${metadata.fornecedor}_${metadata.numero}.pdf`;
        const newName = resolveUniqueFileName(baseName, usedNames);
        const blob = new Blob([pdfBuffer], { type: "application/pdf" });

        processed.push({
          id: `${normalizeBaseName(pdfFile.name)}-${processed.length}`,
          originalName: pdfFile.name,
          newName,
          downloadUrl: URL.createObjectURL(blob),
        });
      }

      setSummary({
        totalPdf: pdfFiles.length,
        totalXml: xmlFiles.length,
        processed,
        missing,
      });
      setFeedback({
        tone: "success",
        message: `Processo concluido com ${processed.length} PDF(s) pronto(s) e ${missing.length} sem correspondencia.`,
      });
    } catch (error) {
      console.error("[adriana] failed to process files", error);
      setFeedback({ tone: "error", message: "Nao foi possivel concluir o processamento agora." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="space-y-8">
      <AdminPageHeader
        eyebrow="Modulo Adriana"
        eyebrowIcon={<Sparkles size={14} />}
        title="Renomeador de PDFs"
        description="Envie XMLs e PDFs no mesmo lote, processe em etapas e limpe tudo ao finalizar."
      />

      <section className="grid gap-3 lg:grid-cols-3">
        {STEPS.map((step) => {
          const active = currentStep === step.id;
          const completed = currentStep > step.id;

          return (
            <div
              key={step.id}
              className={`rounded-3xl border px-5 py-4 ${
                active
                  ? "border-fuchsia-300/35 bg-fuchsia-500/10 text-white"
                  : completed
                    ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Passo {step.id}</p>
              <p className="mt-2 text-base font-semibold">{step.label}</p>
            </div>
          );
        })}
      </section>

      {feedback ? (
        <section
          className={`rounded-3xl px-4 py-3 text-sm ${
            feedback.tone === "error" ? "bg-rose-500/10 text-rose-100" : "bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">Arquivos</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Lote de entrada</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Selecione os XMLs e PDFs juntos. O sistema cruza pelo mesmo nome-base e gera o PDF renomeado.
              </p>
            </div>
            <FolderUp className="mt-1 text-fuchsia-200" size={22} />
          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-fuchsia-300/20 bg-slate-950/30 px-6 py-12 text-center transition hover:border-fuchsia-300/35 hover:bg-slate-950/40">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xml,.XML,.pdf,.PDF"
              className="hidden"
              onChange={handleFilesChange}
            />
            <p className="text-base font-semibold text-white">Selecionar XMLs e PDFs</p>
            <p className="mt-2 text-sm text-slate-400">Arquivos locais, sem mexer em banco ou no worker.</p>
          </label>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">XMLs</p>
              <p className="mt-2 text-3xl font-semibold text-white">{xmlCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">PDFs</p>
              <p className="mt-2 text-3xl font-semibold text-white">{pdfCount}</p>
            </div>
          </div>

          {selectedFiles.length ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">Arquivos selecionados</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {selectedFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm"
                  >
                    <span className="truncate text-slate-200">{file.name}</span>
                    <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {file.name.split(".").pop()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Acao</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Processamento</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Replica o fluxo do PHP: valida o XML, encontra o PDF correspondente e gera o nome final.
                </p>
              </div>
              <FileCheck2 className="mt-1 text-cyan-200" size={22} />
            </div>

            <button
              type="button"
              onClick={() => void handleProcess()}
              disabled={processing || !selectedFiles.length || !pdfCount || !xmlCount}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-fuchsia-500 px-5 py-4 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {processing ? "Processando..." : "Processar lote"}
            </button>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Resultado</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Resumo</h2>
              </div>
              <FileWarning className="mt-1 text-amber-200" size={22} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Processados</p>
                <p className="mt-2 text-3xl font-semibold text-white">{summary?.processed.length ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Sem correspondencia</p>
                <p className="mt-2 text-3xl font-semibold text-white">{summary?.missing.length ?? 0}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetProcess}
              disabled={!selectedFiles.length && !summary}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={18} />
              Limpar processo
            </button>
          </section>
        </div>
      </section>

      {summary ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">PDFs prontos</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Arquivos renomeados</h2>
              </div>
              <RotateCcw className="text-emerald-200" size={22} />
            </div>

            <div className="mt-6 space-y-3">
              {summary.processed.length ? (
                summary.processed.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{file.newName}</p>
                      <p className="mt-1 truncate text-sm text-slate-400">Origem: {file.originalName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                    >
                      <Download size={16} />
                      Baixar PDF
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-400">
                  Nenhum PDF foi gerado neste lote.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-200">Sem match</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Pendencias</h2>
            <div className="mt-6 space-y-3">
              {summary.missing.length ? (
                summary.missing.map((item) => (
                  <div key={`${item.pdfName}-${item.reason}`} className="rounded-3xl border border-rose-300/10 bg-rose-500/10 px-4 py-4">
                    <p className="text-sm font-semibold text-rose-100">{item.pdfName}</p>
                    <p className="mt-2 text-sm text-rose-200/80">{item.reason}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-emerald-300/10 bg-emerald-500/10 px-4 py-6 text-sm text-emerald-100">
                  Todos os PDFs encontrados tiveram correspondencia valida.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
