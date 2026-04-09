export const DEMO_STATE_STORAGE_KEY = "demoState";
export const DEMO_PROJECT_SNAPSHOT_STORAGE_KEY = "demoProjectSnapshot";
export const PENDING_DEMO_CONVERSION_STORAGE_KEY = "pendingDemoConversion";

export type DemoSnapshotApiCampo = {
  nome: string;
  tipo: "string" | "number" | "boolean";
  descricao: string;
};

export type DemoSnapshotApiParametro = {
  nome: string;
  tipo: "string" | "number" | "boolean";
  obrigatorio: boolean;
};

export type DemoSnapshotApi = {
  id: string;
  nome: string;
  url: string;
  metodo: "GET";
  descricao: string;
  ativo: boolean;
  campos: DemoSnapshotApiCampo[];
  parametros: DemoSnapshotApiParametro[];
};

export type DemoSnapshotAgent = {
  id: string;
  nome: string;
  descricao: string;
  promptBase: string;
  ativo: boolean;
  apiIds: string[];
};

export type DemoSnapshotProject = {
  nome: string;
  slug: string | null;
  tipo: string | null;
  descricao: string;
  status: string;
  modeloId: string | null;
};

export type DemoProjectSnapshot = {
  projeto: DemoSnapshotProject;
  agentes: DemoSnapshotAgent[];
  apis: DemoSnapshotApi[];
};

export type PendingDemoConversion = {
  demoUserId: string;
  demoEmail: string;
  snapshot: DemoProjectSnapshot;
};

function normalizeDemoProjectSnapshot(snapshot: DemoProjectSnapshot | null | undefined): DemoProjectSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    projeto: {
      nome: snapshot.projeto?.nome ?? "",
      slug: snapshot.projeto?.slug ?? null,
      tipo: snapshot.projeto?.tipo ?? null,
      descricao: snapshot.projeto?.descricao ?? "",
      status: snapshot.projeto?.status ?? "ativo",
      modeloId: snapshot.projeto?.modeloId ?? null,
    },
    agentes: Array.isArray(snapshot.agentes) ? snapshot.agentes : [],
    apis: Array.isArray(snapshot.apis) ? snapshot.apis : [],
  };
}

function parseStoredValue<T>(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readDemoProjectSnapshot() {
  if (!canUseStorage()) {
    return null;
  }

  return normalizeDemoProjectSnapshot(
    parseStoredValue<DemoProjectSnapshot>(window.localStorage.getItem(DEMO_PROJECT_SNAPSHOT_STORAGE_KEY))
    ?? parseStoredValue<DemoProjectSnapshot>(window.localStorage.getItem(DEMO_STATE_STORAGE_KEY)),
  );
}

export function writeDemoProjectSnapshot(snapshot: DemoProjectSnapshot) {
  if (!canUseStorage()) {
    return;
  }

  const normalized = normalizeDemoProjectSnapshot(snapshot);
  if (!normalized) {
    return;
  }

  window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(normalized));
  window.localStorage.setItem(DEMO_PROJECT_SNAPSHOT_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearDemoProjectSnapshot() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(DEMO_STATE_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_PROJECT_SNAPSHOT_STORAGE_KEY);
}

export function saveDemoState(snapshot: DemoProjectSnapshot | null | undefined) {
  if (!snapshot) {
    return;
  }

  writeDemoProjectSnapshot(snapshot);
}

export function saveCurrentDemoState() {
  const snapshot = readDemoProjectSnapshot();
  if (!snapshot) {
    return null;
  }

  writeDemoProjectSnapshot(snapshot);
  return snapshot;
}

export function readPendingDemoConversion() {
  if (!canUseStorage()) {
    return null;
  }

  return parseStoredValue<PendingDemoConversion>(window.localStorage.getItem(PENDING_DEMO_CONVERSION_STORAGE_KEY));
}

export function writePendingDemoConversion(payload: PendingDemoConversion) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PENDING_DEMO_CONVERSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPendingDemoConversion() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PENDING_DEMO_CONVERSION_STORAGE_KEY);
}

export function clearDemoNavigationState() {
  if (!canUseStorage()) {
    return;
  }

  clearDemoProjectSnapshot();
  clearPendingDemoConversion();
  window.localStorage.removeItem("demoUser");
}
