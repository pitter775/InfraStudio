import "server-only";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type RuntimeErrorLogInput = {
  source: string;
  message: string;
  projetoId?: string | null;
  agenteId?: string | null;
  payload?: Record<string, unknown> | null;
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
