const http = require("http");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = Number(process.env.PORT || 3010);
const BACKEND_URL = String(process.env.WHATSAPP_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
const BRIDGE_SECRET = String(process.env.WHATSAPP_BRIDGE_SECRET || "").trim();
const DATA_DIR = path.join(__dirname, "storage");
const AUTH_DIR = path.join(DATA_DIR, "auth");
const CHANNELS_FILE = path.join(DATA_DIR, "channels.json");

fs.mkdirSync(AUTH_DIR, { recursive: true });

const sessions = new Map();

function getAuthSessionDir(channelId) {
  return path.join(AUTH_DIR, `session-${channelId}`);
}

function loadStoredChannels() {
  try {
    if (!fs.existsSync(CHANNELS_FILE)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(CHANNELS_FILE, "utf8"));
  } catch (error) {
    console.error("[whatsapp-service] failed to load stored channels", error);
    return {};
  }
}

function saveStoredChannels(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(store, null, 2));
}

function upsertStoredChannel(config) {
  const store = loadStoredChannels();
  store[config.channelId] = {
    ...(store[config.channelId] || {}),
    ...config,
  };
  saveStoredChannels(store);
}

function getStoredChannel(channelId) {
  const store = loadStoredChannels();
  return store[channelId] || null;
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function normalizeStatus(state) {
  if (!state) {
    return "desconectado";
  }

  if (state.status === "online" || state.status === "conectado") {
    return "conectado";
  }

  if (state.status === "aguardando_qr") {
    return "aguardando_qr";
  }

  return "desconectado";
}

function getSessionSnapshot(state) {
  return {
    channelId: state.channelId,
    status: normalizeStatus(state),
    qrCodeDataUrl: state.qrCodeDataUrl || null,
    qrCodeText: state.qrCodeText || null,
    numero: state.numero || null,
    projetoId: state.projetoId || null,
    agenteId: state.agenteId || null,
    lastError: state.lastError || null,
  };
}

async function syncBackendSession(state, patch) {
  if (!BRIDGE_SECRET || !state.channelId) {
    return;
  }

  try {
    await fetch(`${BACKEND_URL}/api/whatsapp/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-whatsapp-bridge-secret": BRIDGE_SECRET,
      },
      body: JSON.stringify({
        channelId: state.channelId,
        ...patch,
      }),
    });
  } catch (error) {
    console.error("[whatsapp-service] failed to sync backend session", error);
  }
}

async function forwardMessageToBackend(state, msg) {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: msg.body,
      mensagem: msg.body,
      projeto: state.projetoId,
      agente: state.agenteId || undefined,
      canal: "whatsapp",
      identificadorExterno: msg.from,
      identificador: msg.from,
      context: {
        whatsapp: {
          channelId: state.channelId,
          numeroCanal: state.numero || null,
          remetente: msg.from,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Backend do chat retornou erro.");
  }

  return payload;
}

async function initializeClient(state) {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: state.channelId,
      dataPath: AUTH_DIR,
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  state.client = client;
  state.status = "desconectado";
  state.lastError = null;
  state.manualDisconnect = false;

  client.on("qr", async (qr) => {
    state.status = "aguardando_qr";
    state.qrCodeText = qr;
    state.qrCodeDataUrl = await QRCode.toDataURL(qr);
    await syncBackendSession(state, {
      connectionStatus: "aguardando_qr",
      qrCodeDataUrl: state.qrCodeDataUrl,
      qrCodeText: qr,
    });
  });

  client.on("authenticated", async () => {
    state.status = "conectado";
    await syncBackendSession(state, {
      connectionStatus: "connecting",
    });
  });

  client.on("ready", async () => {
    state.status = "conectado";
    state.qrCodeText = null;
    state.qrCodeDataUrl = null;
    await syncBackendSession(state, {
      connectionStatus: "online",
      qrCodeDataUrl: null,
      qrCodeText: null,
    });
  });

  client.on("auth_failure", async (message) => {
    state.status = "desconectado";
    state.lastError = String(message || "Falha de autenticacao.");
    await syncBackendSession(state, {
      connectionStatus: "offline",
      notes: state.lastError,
    });
  });

  client.on("disconnected", async (reason) => {
    state.status = "desconectado";
    state.lastError = reason ? String(reason) : null;
    await syncBackendSession(state, {
      connectionStatus: "offline",
      notes: state.lastError || "Cliente desconectado.",
    });

    if (!state.manualDisconnect) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => {
        startSession({
          channelId: state.channelId,
          projetoId: state.projetoId,
          agenteId: state.agenteId,
          numero: state.numero,
          active: true,
        }).catch((error) => {
          console.error("[whatsapp-service] failed to reconnect session", error);
        });
      }, 5000);
    }
  });

  client.on("message", async (msg) => {
    try {
      if (msg.fromMe) return;
      if (msg.from.includes("@g.us")) return;
      if (msg.hasMedia) return;
      if (!String(msg.body || "").trim()) return;

      await syncBackendSession(state, {
        connectionStatus: "online",
      });

      const payload = await forwardMessageToBackend(state, msg);
      const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";

      if (!reply) {
        return;
      }

      await client.sendMessage(msg.from, reply);
      await syncBackendSession(state, {
        connectionStatus: "online",
      });
    } catch (error) {
      console.error("[whatsapp-service] failed to process incoming message", error);
      state.lastError = error instanceof Error ? error.message : "Falha ao responder mensagem.";
    }
  });

  await client.initialize();
}

async function startSession(config) {
  if (!config.channelId) {
    throw new Error("channelId obrigatorio.");
  }

  const existing = sessions.get(config.channelId);
  if (existing && existing.client) {
    existing.projetoId = config.projetoId || existing.projetoId || null;
    existing.agenteId = config.agenteId || existing.agenteId || null;
    existing.numero = config.numero || existing.numero || null;
    upsertStoredChannel({
      channelId: config.channelId,
      projetoId: existing.projetoId,
      agenteId: existing.agenteId,
      numero: existing.numero,
      active: true,
    });
    return getSessionSnapshot(existing);
  }

  const state = existing || {
    channelId: config.channelId,
    projetoId: config.projetoId || null,
    agenteId: config.agenteId || null,
    numero: config.numero || null,
    status: "desconectado",
    qrCodeText: null,
    qrCodeDataUrl: null,
    lastError: null,
    manualDisconnect: false,
    reconnectTimer: null,
    client: null,
  };

  state.projetoId = config.projetoId || state.projetoId || null;
  state.agenteId = config.agenteId || state.agenteId || null;
  state.numero = config.numero || state.numero || null;
  sessions.set(config.channelId, state);

  upsertStoredChannel({
    channelId: config.channelId,
    projetoId: state.projetoId,
    agenteId: state.agenteId,
    numero: state.numero,
    active: config.active !== false,
  });

  if (!state.client) {
    await initializeClient(state);
  }

  return getSessionSnapshot(state);
}

async function stopSession(channelId) {
  const state = sessions.get(channelId);
  const stored = getStoredChannel(channelId);

  if (stored) {
    upsertStoredChannel({
      ...stored,
      active: false,
    });
  }

  if (!state) {
    return { channelId, status: "desconectado" };
  }

  state.manualDisconnect = true;
  clearTimeout(state.reconnectTimer);

  if (state.client) {
    try {
      if (typeof state.client.logout === "function") {
        await state.client.logout();
      }
    } catch (error) {
      console.error("[whatsapp-service] failed to logout client", error);
    }

    try {
      await state.client.destroy();
    } catch (error) {
      console.error("[whatsapp-service] failed to destroy client", error);
    }
  }

  state.client = null;
  state.status = "desconectado";
  state.qrCodeText = null;
  state.qrCodeDataUrl = null;

  await syncBackendSession(state, {
    connectionStatus: "offline",
    qrCodeDataUrl: null,
    qrCodeText: null,
  });

  try {
    fs.rmSync(getAuthSessionDir(channelId), { recursive: true, force: true });
  } catch (error) {
    console.error("[whatsapp-service] failed to purge auth session", error);
  }

  sessions.delete(channelId);

  return getSessionSnapshot(state);
}

async function bootstrapStoredSessions() {
  const stored = loadStoredChannels();
  const activeEntries = Object.values(stored).filter((item) => item && item.active);

  for (const config of activeEntries) {
    try {
      await startSession(config);
    } catch (error) {
      console.error("[whatsapp-service] failed to bootstrap session", error);
    }
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && requestUrl.pathname === "/status") {
      const channelId = requestUrl.searchParams.get("channelId");
      if (!channelId) {
        json(res, 400, { error: "channelId obrigatorio." });
        return;
      }

      const state = sessions.get(channelId);
      json(res, 200, getSessionSnapshot(state || { channelId, status: "desconectado" }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/qr") {
      const channelId = requestUrl.searchParams.get("channelId");
      if (!channelId) {
        json(res, 400, { error: "channelId obrigatorio." });
        return;
      }

      const state = sessions.get(channelId);
      if (!state) {
        json(res, 404, { error: "Sessao nao encontrada." });
        return;
      }

      json(res, 200, {
        channelId,
        status: normalizeStatus(state),
        qrCodeDataUrl: state.qrCodeDataUrl || null,
        qrCodeText: state.qrCodeText || null,
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/connect") {
      const body = await readRequestBody(req);
      const snapshot = await startSession({
        channelId: body.channelId,
        projetoId: body.projetoId || null,
        agenteId: body.agenteId || null,
        numero: body.numero || null,
        active: true,
      });
      json(res, 200, snapshot);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/disconnect") {
      const body = await readRequestBody(req);
      if (!body.channelId) {
        json(res, 400, { error: "channelId obrigatorio." });
        return;
      }

      const snapshot = await stopSession(body.channelId);
      json(res, 200, snapshot);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      json(res, 200, { ok: true, backendUrl: BACKEND_URL, sessions: sessions.size });
      return;
    }

    json(res, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    console.error("[whatsapp-service] request failed", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Falha interna no whatsapp-service." });
  }
});

server.listen(PORT, () => {
  console.log(`[whatsapp-service] listening on http://localhost:${PORT}`);

  // Keep the HTTP API available while stored sessions reconnect in the background.
  bootstrapStoredSessions().catch((error) => {
    console.error("[whatsapp-service] failed to bootstrap", error);
  });
});
