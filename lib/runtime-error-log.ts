import "server-only";

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type RuntimeErrorLogInput = {
  source: string;
  message: string;
  projetoId?: string | null;
  agenteId?: string | null;
  payload?: Record<string, unknown> | null;
};

export type RuntimeErrorLogEntry = {
  id: string;
  createdAt: string;
  source: string;
  message: string;
  projetoId: string | null;
  agenteId: string | null;
  payload: Record<string, unknown> | null;
};

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "runtime-errors.log");

export async function appendRuntimeErrorLog(input: RuntimeErrorLogInput) {
  try {
    await mkdir(LOG_DIR, { recursive: true });

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      source: input.source,
      message: input.message,
      projetoId: input.projetoId ?? null,
      agenteId: input.agenteId ?? null,
      payload: input.payload ?? null,
    });

    await appendFile(LOG_FILE, `${line}\n`, "utf8");
  } catch (error) {
    console.error("[runtime-error-log] failed to append log", error);
  }
}

export async function listRecentRuntimeErrorLogs(limit = 120): Promise<RuntimeErrorLogEntry[]> {
  try {
    const content = await readFile(LOG_FILE, "utf8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit)
      .reverse();

    return lines.flatMap((line, index) => {
      try {
        const parsed = JSON.parse(line) as {
          timestamp?: string;
          source?: string;
          message?: string;
          projetoId?: string | null;
          agenteId?: string | null;
          payload?: Record<string, unknown> | null;
        };

        return [
          {
            id: `${parsed.timestamp ?? "runtime"}-${index}`,
            createdAt: parsed.timestamp ?? new Date().toISOString(),
            source: parsed.source?.trim() || "runtime",
            message: parsed.message?.trim() || "Erro de runtime",
            projetoId: parsed.projetoId ?? null,
            agenteId: parsed.agenteId ?? null,
            payload: parsed.payload ?? null,
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function clearRuntimeErrorLogs() {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await writeFile(LOG_FILE, "", "utf8");
    return true;
  } catch (error) {
    console.error("[runtime-error-log] failed to clear logs", error);
    return false;
  }
}
