"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { AnimatePresence, motion } from "motion/react";
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
  zipName: string;
  zipUrl: string;
};

const STEPS = [
  { id: 1, label: "Enviar arquivos" },
  { id: 2, label: "Processar" },
  { id: 3, label: "Baixar e limpar" },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

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
  const [dragActive, setDragActive] = useState(false);

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
      if (summary?.zipUrl) {
        URL.revokeObjectURL(summary.zipUrl);
      }

      summary?.processed.forEach((file) => {
        URL.revokeObjectURL(file.downloadUrl);
      });
    };
  }, [summary]);

  const applySelectedFiles = (files: File[]) => {
    setSelectedFiles(files);
    setSummary(null);
    setFeedback(null);
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    applySelectedFiles(Array.from(event.target.files ?? []));
  };

  const resetProcess = () => {
    if (summary?.zipUrl) {
      URL.revokeObjectURL(summary.zipUrl);
    }

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

  const handleDownloadZip = () => {
    if (!summary?.zipUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = summary.zipUrl;
    link.download = summary.zipName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    applySelectedFiles(Array.from(event.dataTransfer.files ?? []));
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

      const zip = new JSZip();
      processed.forEach((file) => {
        const pdfBlob = fetch(file.downloadUrl).then((response) => response.blob());
        zip.file(file.newName, pdfBlob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const zipName = `adriana-renomeados-${new Date().toISOString().slice(0, 10)}.zip`;

      setSummary({
        totalPdf: pdfFiles.length,
        totalXml: xmlFiles.length,
        processed,
        missing,
        zipName,
        zipUrl,
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

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-3 lg:grid-cols-3"
      >
        {STEPS.map((step) => {
          const active = currentStep === step.id;
          const completed = currentStep > step.id;

          return (
            <motion.div
              key={step.id}
              variants={fadeUp}
              whileHover={{ y: -6, scale: 1.01 }}
              transition={{ duration: 0.24 }}
              className={`rounded-3xl border px-5 py-4 ${
                active
                  ? "border-fuchsia-200/70 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.34),rgba(217,70,239,0.18)_42%,rgba(15,23,42,0.94)_100%)] text-white shadow-[0_0_0_1px_rgba(244,114,182,0.22),0_0_52px_rgba(217,70,239,0.28),inset_0_0_32px_rgba(244,114,182,0.12)]"
                  : completed
                    ? "border-emerald-300/25 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),rgba(16,185,129,0.08)_40%,rgba(15,23,42,0.88)_100%)] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.10)]"
                    : "border-white/10 bg-white/5 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Passo {step.id}</p>
                  <p className="mt-2 text-base font-semibold">{step.label}</p>
                </div>
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                    active
                      ? "border-fuchsia-100/70 bg-fuchsia-300/25 text-white shadow-[0_0_24px_rgba(217,70,239,0.30)]"
                      : completed
                        ? "border-emerald-300/30 bg-emerald-400/15"
                        : "border-white/10 bg-white/5"
                  }`}
                  animate={active ? { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] } : undefined}
                  transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                >
                  <span className="text-sm font-bold">{step.id}</span>
                </motion.div>
              </div>
              {active ? (
                <motion.div
                  className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-fuchsia-200 via-white to-fuchsia-300"
                  animate={{ opacity: [0.6, 1, 0.6], scaleX: [0.96, 1, 0.96] }}
                  transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
              ) : null}
            </motion.div>
          );
        })}
      </motion.section>

      <AnimatePresence mode="wait">
        {feedback ? (
        <motion.section
          key={feedback.message}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.28 }}
          className={`rounded-3xl px-4 py-3 text-sm ${
            feedback.tone === "error"
              ? "border border-rose-300/15 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(15,23,42,0.78))] text-rose-100 shadow-[0_0_36px_rgba(244,63,94,0.10)]"
              : "border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.20),rgba(15,23,42,0.82))] text-emerald-100 shadow-[0_0_36px_rgba(16,185,129,0.12)]"
          }`}
        >
          {feedback.message}
        </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]"
      >
        <motion.div
          variants={fadeUp}
          whileHover={{ y: -4 }}
          className="group relative overflow-hidden rounded-[34px] border border-fuchsia-300/15 bg-[linear-gradient(160deg,rgba(34,8,49,0.94),rgba(10,14,29,0.96))] p-6 shadow-[0_24px_80px_rgba(168,85,247,0.10)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)] opacity-90" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">Arquivos</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Lote de entrada</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Selecione os XMLs e PDFs juntos. O sistema cruza pelo mesmo nome-base e gera o PDF renomeado.
              </p>
            </div>
            <motion.div className="mt-1 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-3 text-fuchsia-200">
              <FolderUp size={22} />
            </motion.div>
          </div>

          <motion.label
            whileHover={{ scale: 1.01, y: -3 }}
            whileTap={{ scale: 0.995 }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              const nextTarget = event.relatedTarget;
              if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
                setDragActive(false);
              }
            }}
            onDrop={handleDrop}
            className={`relative mt-6 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[30px] border border-dashed px-6 py-12 text-center transition ${
              dragActive
                ? "border-fuchsia-200/60 bg-fuchsia-500/12"
                : "border-fuchsia-300/25 bg-slate-950/30 hover:border-fuchsia-300/40 hover:bg-slate-950/40"
            }`}
          >
            <motion.div
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/80 to-transparent"
              animate={{ opacity: [0.35, 1, 0.35], x: ["-8%", "8%", "-8%"] }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xml,.XML,.pdf,.PDF"
              className="hidden"
              onChange={handleFilesChange}
            />
            <motion.div
              className="mb-4 rounded-[22px] border border-fuchsia-300/20 bg-fuchsia-400/10 p-4"
              animate={{ boxShadow: ["0 0 0 rgba(217,70,239,0)", "0 0 30px rgba(217,70,239,0.22)", "0 0 0 rgba(217,70,239,0)"] }}
              transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <FolderUp size={26} className="text-fuchsia-100" />
            </motion.div>
            <p className="text-base font-semibold text-white">
              {dragActive ? "Solte os arquivos aqui" : "Arraste e solte XMLs e PDFs aqui"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Ou clique para selecionar. Arquivos locais, sem mexer em banco ou no worker.
            </p>
          </motion.label>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <motion.div
              whileHover={{ y: -4 }}
              className="rounded-[26px] border border-white/10 bg-slate-950/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">XMLs</p>
              <motion.p
                key={xmlCount}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-2 text-3xl font-semibold text-white"
              >
                {xmlCount}
              </motion.p>
            </motion.div>
            <motion.div
              whileHover={{ y: -4 }}
              className="rounded-[26px] border border-white/10 bg-slate-950/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">PDFs</p>
              <motion.p
                key={pdfCount}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-2 text-3xl font-semibold text-white"
              >
                {pdfCount}
              </motion.p>
            </motion.div>
          </div>

        </motion.div>

        <div className="space-y-6">
          <motion.section
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-[34px] border border-cyan-300/12 bg-[linear-gradient(160deg,rgba(6,18,34,0.96),rgba(9,14,31,0.96))] p-6 shadow-[0_24px_80px_rgba(14,165,233,0.10)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_34%)]" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Acao</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Processamento</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Replica o fluxo do PHP: valida o XML, encontra o PDF correspondente e gera o nome final.
                </p>
              </div>
              <motion.div className="mt-1 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200">
                <FileCheck2 size={22} />
              </motion.div>
            </div>

            <motion.button
              type="button"
              onClick={() => void handleProcess()}
              disabled={processing || !selectedFiles.length || !pdfCount || !xmlCount}
              whileHover={processing ? undefined : { scale: 1.01, y: -2 }}
              whileTap={processing ? undefined : { scale: 0.99 }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-[linear-gradient(135deg,#ec4899,#d946ef_48%,#8b5cf6)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(217,70,239,0.30)] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {processing ? "Processando..." : "Processar lote"}
            </motion.button>

            <AnimatePresence>
              {summary?.processed.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4"
                >
                  <motion.button
                    type="button"
                    onClick={handleDownloadZip}
                    animate={{
                      scale: [1, 1.015, 1],
                      boxShadow: [
                        "0 0 0 0 rgba(16,185,129,0.18)",
                        "0 0 0 8px rgba(16,185,129,0.04)",
                        "0 0 0 0 rgba(16,185,129,0.18)",
                      ],
                    }}
                    transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    whileHover={{ scale: 1.015, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[24px] border border-emerald-300/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(5,150,105,0.20),rgba(4,120,87,0.24))] px-5 py-4 text-sm font-semibold text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.18),0_0_34px_rgba(16,185,129,0.18)] transition"
                  >
                    <Download size={18} />
                    Baixar ZIP dos PDFs renomeados
                  </motion.button>

                  <motion.p
                    className="mt-3 text-center text-sm font-medium text-emerald-200"
                    animate={{ opacity: [0.55, 1, 0.55], y: [0, -2, 0] }}
                    transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  >
                    ZIP pronto para impressionar. Baixa aqui.
                  </motion.p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>

          <motion.section
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-[34px] border border-amber-300/12 bg-[linear-gradient(160deg,rgba(28,19,8,0.95),rgba(11,14,27,0.96))] p-6 shadow-[0_24px_80px_rgba(245,158,11,0.08)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_34%)]" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Resultado</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Resumo</h2>
              </div>
              <motion.div className="mt-1 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200">
                <FileWarning size={22} />
              </motion.div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <motion.div whileHover={{ scale: 1.02 }} className="rounded-[26px] border border-white/10 bg-slate-950/40 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Processados</p>
                <motion.p
                  key={summary?.processed.length ?? 0}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mt-2 text-3xl font-semibold text-white"
                >
                  {summary?.processed.length ?? 0}
                </motion.p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} className="rounded-[26px] border border-white/10 bg-slate-950/40 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Sem correspondencia</p>
                <motion.p
                  key={summary?.missing.length ?? 0}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mt-2 text-3xl font-semibold text-white"
                >
                  {summary?.missing.length ?? 0}
                </motion.p>
              </motion.div>
            </div>

            <motion.button
              type="button"
              onClick={resetProcess}
              disabled={!selectedFiles.length && !summary}
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/7 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={18} />
              Limpar processo
            </motion.button>
          </motion.section>
        </div>
      </motion.section>

      <AnimatePresence>
      {summary ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.32 }}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
        >
          <motion.div
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-[34px] border border-emerald-300/15 bg-[linear-gradient(160deg,rgba(5,26,20,0.95),rgba(9,14,28,0.96))] p-6 shadow-[0_24px_80px_rgba(16,185,129,0.10)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_34%)]" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">PDFs prontos</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Arquivos renomeados</h2>
              </div>
              <motion.div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-emerald-200">
                <RotateCcw size={22} />
              </motion.div>
            </div>

            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-3">
              {summary.processed.length ? (
                summary.processed.map((file) => (
                  <motion.div
                    key={file.id}
                    variants={fadeUp}
                    whileHover={{ x: 4 }}
                    className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{file.newName}</p>
                      <p className="mt-1 truncate text-sm text-slate-400">Origem: {file.originalName}</p>
                    </div>
                    <span className="inline-flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                      Incluido no ZIP
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-sm text-slate-400">
                  Nenhum PDF foi gerado neste lote.
                </div>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-[34px] border border-rose-300/12 bg-[linear-gradient(160deg,rgba(39,10,20,0.96),rgba(11,14,28,0.96))] p-6 shadow-[0_24px_80px_rgba(244,63,94,0.08)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(244,63,94,0.08),transparent_34%)]" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-200">Sem match</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Pendencias</h2>
            <motion.div variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-3">
              {summary.missing.length ? (
                summary.missing.map((item) => (
                  <motion.div
                    key={`${item.pdfName}-${item.reason}`}
                    variants={fadeUp}
                    whileHover={{ x: 4 }}
                    className="rounded-3xl border border-rose-300/10 bg-rose-500/10 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-rose-100">{item.pdfName}</p>
                    <p className="mt-2 text-sm text-rose-200/80">{item.reason}</p>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-3xl border border-emerald-300/10 bg-emerald-500/10 px-4 py-6 text-sm text-emerald-100">
                  Todos os PDFs encontrados tiveram correspondencia valida.
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.section>
      ) : null}
      </AnimatePresence>
    </main>
  );
}
