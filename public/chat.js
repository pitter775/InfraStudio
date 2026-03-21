(function () {
  var existing = window.InfraChat;
  var queue = existing && Array.isArray(existing.__queue) ? existing.__queue : [];

  function enqueueContext(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return;
    }

    queue.push(payload);
  }

  if (!existing || typeof existing.setContext !== "function") {
    window.InfraChat = {
      __queue: queue,
      setContext: enqueueContext,
    };
  } else {
    window.InfraChat.__queue = queue;
  }

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function detectScript() {
    if (document.currentScript) {
      return document.currentScript;
    }

    var scripts = document.querySelectorAll("script[src]");
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var script = scripts[index];
      var src = script.getAttribute("src") || "";
      if (src.indexOf("/chat.js") !== -1 && script.getAttribute("data-projeto")) {
        return script;
      }
    }

    return null;
  }

  var sourceScript = detectScript();

  whenReady(function () {
    if (!sourceScript) {
      console.warn("[InfraStudio Chat] script tag not found.");
      return;
    }

    var projeto = (sourceScript.getAttribute("data-projeto") || "").trim();
    var agente = (sourceScript.getAttribute("data-agente") || "").trim();

    if (!projeto || !agente) {
      console.warn("[InfraStudio Chat] data-projeto and data-agente are required.");
      return;
    }

    var instanceKey = projeto + "::" + agente;
    var dockEnabled = projeto.toLowerCase() === "infrastudio";
    if (sourceScript.__infraChatInitialized) {
      return;
    }
    sourceScript.__infraChatInitialized = true;

    var apiBase = sourceScript.getAttribute("data-api-base") || new URL(sourceScript.src, window.location.href).origin;
    var storageKey = null;
    var dockWidth = 420;
    var originalBodyStyles = {
      marginLeft: document.body.style.marginLeft,
      marginRight: document.body.style.marginRight,
      width: document.body.style.width,
      minHeight: document.body.style.minHeight,
      transition: document.body.style.transition,
      overflowX: document.body.style.overflowX,
    };
    var state = {
      chatId: null,
      messages: [],
      context: {},
      open: false,
      docked: false,
      maximized: false,
      dragPosition: null,
      loading: false,
      ui: {
        title: "Chat",
        theme: "dark",
        accent: "#64748b",
        transparent: true,
      },
    };

    var host = document.createElement("div");
    host.id = "infrastudio-chat-root-" + instanceKey.replace(/[^a-zA-Z0-9_-]/g, "-");
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = [
      ":host { all: initial; }",
      ".chat-icon { display: inline-flex; align-items: center; justify-content: center; }",
      ".chat-icon svg { width: 100%; height: 100%; display: block; }",
      "@keyframes chatBubbleIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }",
      "@keyframes chatDotsPulse { 0%, 80%, 100% { opacity: .28; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-1px); } }",
      "@keyframes chatLauncherSwap { 0% { opacity: 0; transform: scale(.72) rotate(-18deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }",
      ".chat-wrap {",
      "  position: fixed;",
      "  right: 24px;",
      "  bottom: 24px;",
      "  z-index: 2147483000;",
      "  pointer-events: none;",
      "  font-family: Inter, Arial, sans-serif;",
      "  --accent: #64748b;",
      "  --panel-bg: rgba(9,16,34,0.96);",
      "  --panel-text: #e2e8f0;",
      "  --header-border: rgba(255,255,255,0.08);",
      "  --subtle-bg: rgba(255,255,255,0.04);",
      "  --surface-bg: rgba(2,6,23,0.18);",
      "  --ai-bg: rgba(30,41,59,0.92);",
      "  --ai-text: #e2e8f0;",
      "  --input-bg: rgba(2,6,23,0.45);",
      "  --input-text: #ffffff;",
      "  --shadow-color: rgba(2,6,23,0.45);",
      "  --dock-width: 420px;",
      "  --viewport-height: 100dvh;",
      "  --safe-top: env(safe-area-inset-top, 0px);",
      "  --safe-bottom: env(safe-area-inset-bottom, 0px);",
      "}",
      ".chat-wrap.docked { right: 0; left: auto; bottom: 0; top: 0; }",
      ".chat-wrap.custom-position { right: auto; bottom: auto; }",
      ".chat-button { width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; pointer-events: auto; border: 0; border-radius: 999px; background: var(--accent); color: white; cursor: pointer; box-shadow: 0 20px 40px var(--shadow-color); transition: transform .2s ease, background-color .2s ease, box-shadow .2s ease, opacity .18s ease; }",
      ".chat-button:hover { transform: translateY(-1px) scale(1.02); }",
      ".chat-button .chat-icon { width: 24px; height: 24px; animation: chatLauncherSwap .22s ease both; }",
      ".chat-button.is-open { background: color-mix(in srgb, var(--accent) 88%, #0f172a 12%); }",
      ".chat-wrap.open .chat-button { opacity: 0; pointer-events: none; transform: translateY(8px) scale(.94); }",
      ".chat-panel { width: min(380px, calc(100vw - 32px)); height: min(620px, calc(100dvh - 110px)); display: none; pointer-events: auto; flex-direction: column; overflow: hidden; border-radius: 26px; border: 1px solid var(--header-border); background: var(--panel-bg); color: var(--panel-text); box-shadow: 0 24px 70px var(--shadow-color); backdrop-filter: blur(14px); margin-bottom: 16px; transform-origin: bottom right; animation: chatBubbleIn .22s ease both; }",
      ".chat-panel.open { display: flex; }",
      ".chat-wrap.docked .chat-panel { width: var(--dock-width); height: 100dvh; margin-bottom: 0; border-radius: 28px 0 0 28px; border-right: 0; box-shadow: -18px 0 42px var(--shadow-color); }",
      ".chat-wrap.docked .chat-button { position: fixed; right: 20px; bottom: 20px; opacity: 0; pointer-events: none; transform: scale(.9); }",
      ".chat-wrap.open:not(.docked) .chat-header { cursor: grab; }",
      ".chat-wrap.open:not(.docked) .chat-header.is-dragging { cursor: grabbing; }",
      ".chat-header { position: sticky; top: 0; z-index: 2; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--header-border); background: color-mix(in srgb, var(--panel-bg) 94%, transparent); backdrop-filter: blur(16px); user-select: none; }",
      ".chat-title { font-size: 16px; font-weight: 700; color: var(--panel-text); }",
      ".chat-subtitle { margin-top: 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }",
      ".chat-reset, .chat-close, .chat-dock, .chat-maximize, .chat-reset-pos { border: 1px solid var(--header-border); background: var(--subtle-bg); color: #94a3b8; border-radius: 12px; cursor: pointer; }",
      ".chat-reset { padding: 8px 10px; font-size: 11px; font-weight: 600; }",
      ".chat-close { width: 36px; height: 36px; font-size: 16px; }",
      ".chat-dock, .chat-maximize, .chat-reset-pos { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; }",
      ".chat-dock[hidden], .chat-maximize[hidden], .chat-reset-pos[hidden] { display: none; }",
      ".chat-dock .chat-icon, .chat-maximize .chat-icon, .chat-reset-pos .chat-icon { width: 16px; height: 16px; }",
      ".chat-messages { min-height: 0; flex: 1; overflow-y: auto; padding: 16px; background: var(--surface-bg); }",
      ".chat-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".chat-bubble { max-width: 88%; border-radius: 18px; border: 1px solid var(--header-border); padding: 12px 14px; font-size: 14px; line-height: 1.6; animation: chatBubbleIn .22s ease both; }",
      ".chat-bubble.ai { padding: 0; background: transparent; color: var(--ai-text); border-color: transparent; border-bottom-left-radius: 6px; }",
      ".chat-bubble.user { margin-left: auto; background: var(--accent); color: white; border-color: var(--accent); border-bottom-right-radius: 6px; }",
      ".chat-rich { white-space: normal; }",
      ".chat-rich p { margin: 0; }",
      ".chat-rich p + p, .chat-rich p + ul, .chat-rich p + ol, .chat-rich ul + p, .chat-rich ol + p, .chat-rich ul + ul, .chat-rich ol + ol { margin-top: 10px; }",
      ".chat-rich ul, .chat-rich ol { margin: 0; padding-left: 20px; }",
      ".chat-rich li + li { margin-top: 6px; }",
      ".chat-rich strong { font-weight: 700; color: inherit; }",
      ".chat-bubble.ai .chat-rich strong { color: var(--ai-text); }",
      ".chat-bubble.user .chat-rich strong { color: white; }",
      ".chat-cta { margin-top: 8px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); background: color-mix(in srgb, var(--accent) 14%, transparent); color: white; padding: 7px 11px; font-size: 11px; font-weight: 700; text-decoration: none; transition: transform .18s ease, background-color .18s ease, border-color .18s ease; }",
      ".chat-cta:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--accent) 20%, transparent); }",
      ".chat-assets { margin-top: 10px; display: grid; gap: 10px; }",
      ".chat-asset { display: block; overflow: hidden; border-radius: 16px; border: 1px solid var(--header-border); background: color-mix(in srgb, var(--panel-bg) 88%, transparent); color: inherit; text-decoration: none; }",
      ".chat-asset.image { padding: 0; }",
      ".chat-asset.image img { display: block; width: 100%; max-height: 210px; object-fit: cover; background: rgba(15,23,42,.35); }",
      ".chat-asset.file { padding: 12px; }",
      ".chat-asset-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
      ".chat-asset-title { font-size: 12px; font-weight: 700; color: inherit; }",
      ".chat-asset-subtitle { margin-top: 4px; font-size: 11px; color: #94a3b8; }",
      ".chat-asset-open { font-size: 11px; font-weight: 700; color: var(--accent); white-space: nowrap; }",
      ".chat-typing { display: inline-flex; width: fit-content; max-width: 88%; align-items: center; gap: 10px; border-radius: 18px; border: 1px solid var(--header-border); background: var(--ai-bg); color: #94a3b8; padding: 12px 14px; animation: chatBubbleIn .22s ease both; }",
      ".chat-typing-dots { display: inline-flex; gap: 4px; }",
      ".chat-typing-dots span { width: 7px; height: 7px; border-radius: 999px; background: currentColor; animation: chatDotsPulse 1.2s infinite ease-in-out; }",
      ".chat-typing-dots span:nth-child(2) { animation-delay: .16s; }",
      ".chat-typing-dots span:nth-child(3) { animation-delay: .32s; }",
      ".chat-form { flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px; padding: 16px; border-top: 1px solid var(--header-border); background: color-mix(in srgb, var(--panel-bg) 96%, transparent); }",
      ".chat-input { flex: 1; box-sizing: border-box; height: 46px; min-height: 46px; max-height: 110px; resize: none; overflow-y: hidden; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--header-border) 72%, transparent); outline: none; background: var(--input-bg); color: var(--input-text); padding: 11px 14px; font-family: inherit; font-size: 14px; line-height: 20px; scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.18) transparent; transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease; }",
      ".chat-input::placeholder { font-size: 13px; color: #94a3b8; }",
      ".chat-input:focus { border-color: color-mix(in srgb, var(--accent) 72%, white 28%); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); background: var(--input-bg); }",
      ".chat-input.is-waiting::placeholder { font-style: italic; color: #94a3b8; }",
      ".chat-input::-webkit-scrollbar { width: 4px; }",
      ".chat-input::-webkit-scrollbar-track { background: transparent; }",
      ".chat-input::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.18); border-radius: 999px; }",
      ".chat-input::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.28); }",
      ".chat-send { width: 46px; height: 46px; flex: 0 0 46px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 16px; background: var(--accent); color: white; padding: 0; cursor: pointer; }",
      ".chat-send .chat-icon { width: 18px; height: 18px; }",
      ".chat-send[disabled] { opacity: 0.6; cursor: wait; }",
      ".chat-wrap.maximized:not(.docked) .chat-panel { width: min(440px, calc(100vw - 32px)); height: min(82vh, calc(var(--viewport-height) - 72px)); }",
      "@media (max-width: 960px) { .chat-wrap.docked .chat-panel { width: 100vw; border-radius: 0; } .chat-maximize, .chat-reset-pos { display: none !important; } }",
      "@media (max-width: 640px) { .chat-wrap { right: 12px; left: 12px; top: auto; bottom: calc(var(--safe-bottom) + 12px); display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; } .chat-wrap.open { top: calc(var(--safe-top) + 12px); } .chat-panel { width: 100%; max-width: 100%; height: auto; max-height: calc(var(--viewport-height) - var(--safe-top) - var(--safe-bottom) - 24px); margin-bottom: 0; border-radius: 24px; } .chat-header { padding: 14px 14px 12px; } .chat-form { padding: 12px; } .chat-input { border-radius: 18px; } .chat-wrap.docked .chat-button { right: 12px; bottom: 12px; opacity: 0; pointer-events: none; transform: scale(.9); } }",
    ].join("");
    shadow.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "chat-wrap";
    shadow.appendChild(wrap);

    var panel = document.createElement("div");
    panel.className = "chat-panel";
    wrap.appendChild(panel);

    var header = document.createElement("div");
    header.className = "chat-header";
    panel.appendChild(header);

    var titleWrap = document.createElement("div");
    header.appendChild(titleWrap);

    var title = document.createElement("div");
    title.className = "chat-title";
    title.textContent = state.ui.title;
    titleWrap.appendChild(title);

    var subtitle = document.createElement("div");
    subtitle.className = "chat-subtitle";
    subtitle.textContent = "Assistente virtual";
    titleWrap.appendChild(subtitle);

    var headerActions = document.createElement("div");
    headerActions.style.display = "flex";
    headerActions.style.gap = "8px";
    header.appendChild(headerActions);

    var resetButton = document.createElement("button");
    resetButton.className = "chat-reset";
    resetButton.type = "button";
    resetButton.textContent = "Novo atendimento";
    headerActions.appendChild(resetButton);

    var dockButton = document.createElement("button");
    dockButton.className = "chat-dock";
    dockButton.type = "button";
    dockButton.setAttribute("aria-label", "Alternar modo expandido");
    dockButton.innerHTML = createDockIcon();
    dockButton.hidden = !dockEnabled;
    headerActions.appendChild(dockButton);

    var maximizeButton = document.createElement("button");
    maximizeButton.className = "chat-maximize";
    maximizeButton.type = "button";
    maximizeButton.setAttribute("aria-label", "Maximizar altura do chat");
    maximizeButton.innerHTML = createMaximizeIcon();
    maximizeButton.hidden = window.innerWidth < 961;
    headerActions.appendChild(maximizeButton);

    var resetPositionButton = document.createElement("button");
    resetPositionButton.className = "chat-reset-pos";
    resetPositionButton.type = "button";
    resetPositionButton.setAttribute("aria-label", "Voltar chat para o lugar original");
    resetPositionButton.innerHTML = createResetPositionIcon();
    resetPositionButton.hidden = true;
    headerActions.appendChild(resetPositionButton);

    var closeButton = document.createElement("button");
    closeButton.className = "chat-close";
    closeButton.type = "button";
    closeButton.textContent = "x";
    headerActions.appendChild(closeButton);

    var messagesWrap = document.createElement("div");
    messagesWrap.className = "chat-messages";
    panel.appendChild(messagesWrap);

    var stack = document.createElement("div");
    stack.className = "chat-stack";
    messagesWrap.appendChild(stack);

    var form = document.createElement("form");
    form.className = "chat-form";
    panel.appendChild(form);

    var input = document.createElement("textarea");
    input.className = "chat-input";
    input.placeholder = "Digite sua mensagem...";
    input.rows = 1;
    form.appendChild(input);

    var sendButton = document.createElement("button");
    sendButton.className = "chat-send";
    sendButton.type = "submit";
    sendButton.innerHTML = createPlaneIcon();
    form.appendChild(sendButton);

    var triggerButton = document.createElement("button");
    triggerButton.className = "chat-button";
    triggerButton.type = "button";
    triggerButton.setAttribute("aria-label", "Abrir chat");
    triggerButton.innerHTML = createChatBubbleIcon();
    wrap.appendChild(triggerButton);

    function createChatBubbleIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 18.5H5.5A2.5 2.5 0 0 1 3 16V7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V16a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createPlaneIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20.2 4.8 3.9 11.2c-.7.3-.7 1.3.1 1.5l5.9 1.9 1.9 5.9c.2.8 1.2.8 1.5.1l6.4-16.3c.3-.8-.5-1.6-1.5-1.3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.8 14.2 4.5-4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createCloseIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span>';
    }

    function createDockIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 5v14" stroke="currentColor" stroke-width="1.8"/></svg></span>';
    }

    function createMaximizeIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 4H4v4M16 4h4v4M8 20H4v-4M20 16v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createResetPositionIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 7H5v3M5.5 10A7 7 0 1 0 8 6.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatInline(value) {
      return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    }

    function formatRichText(value) {
      var blocks = String(value || "").trim().split(/\n\s*\n/);
      return blocks
        .map(function (block) {
          var lines = block.split("\n").filter(Boolean);
          if (!lines.length) {
            return "";
          }

          if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) {
            return "<ul>" + lines.map(function (line) { return "<li>" + formatInline(line.replace(/^[-*]\s+/, "")) + "</li>"; }).join("") + "</ul>";
          }

          if (lines.every(function (line) { return /^\d+\.\s+/.test(line); })) {
            return "<ol>" + lines.map(function (line) { return "<li>" + formatInline(line.replace(/^\d+\.\s+/, "")) + "</li>"; }).join("") + "</ol>";
          }

          return "<p>" + lines.map(formatInline).join("<br>") + "</p>";
        })
        .join("");
    }

    function createWhatsAppButton(cta) {
      if (!cta || !cta.url) {
        return null;
      }

      var link = document.createElement("a");
      link.className = "chat-cta";
      link.href = cta.url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = cta.label || "Continuar no WhatsApp";
      return link;
    }

    function createAssetGallery(assets) {
      if (!Array.isArray(assets) || !assets.length) {
        return null;
      }

      var wrap = document.createElement("div");
      wrap.className = "chat-assets";

      assets.slice(0, 2).forEach(function (asset) {
        if (!asset || !asset.publicUrl) {
          return;
        }

        var link = document.createElement("a");
        link.className = "chat-asset " + (asset.categoria === "image" ? "image" : "file");
        link.href = asset.publicUrl;
        link.target = "_blank";
        link.rel = "noreferrer noopener";

        if (asset.categoria === "image") {
          var image = document.createElement("img");
          image.src = asset.publicUrl;
          image.alt = asset.nome || asset.arquivoNome || "Imagem do agente";
          link.appendChild(image);
        }

        var meta = document.createElement("div");
        meta.className = "chat-asset-meta";

        var textWrap = document.createElement("div");
        var title = document.createElement("div");
        title.className = "chat-asset-title";
        title.textContent = asset.nome || asset.arquivoNome || "Arquivo";
        textWrap.appendChild(title);

        if (asset.descricao || asset.arquivoNome) {
          var subtitle = document.createElement("div");
          subtitle.className = "chat-asset-subtitle";
          subtitle.textContent = asset.descricao || asset.arquivoNome;
          textWrap.appendChild(subtitle);
        }

        meta.appendChild(textWrap);

        var openLabel = document.createElement("div");
        openLabel.className = "chat-asset-open";
        openLabel.textContent = asset.categoria === "image" ? "Abrir imagem" : "Abrir arquivo";
        meta.appendChild(openLabel);

        link.appendChild(meta);
        wrap.appendChild(link);
      });

      return wrap;
    }

    function createWhatsAppMessage(cta) {
      if (!cta || !cta.url) {
        return null;
      }

      return {
        id: "ai-cta-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        text: "Se preferir, eu te levo para o WhatsApp agora:",
        isAi: true,
        cta: cta,
      };
    }

    function persist() {
      if (!storageKey) {
        return;
      }

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            chatId: state.chatId,
            messages: state.messages,
            context: state.context,
            docked: state.docked,
            maximized: state.maximized,
            dragPosition: state.dragPosition,
          }),
        );
      } catch (error) {
        console.warn("[InfraStudio Chat] failed to persist conversation.", error);
      }
    }

    function getValueByPath(source, path) {
      return path.split(".").reduce(function (current, segment) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
          return null;
        }

        return Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : null;
      }, source);
    }

    function sanitizeStorageToken(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
    }

    function getIdentityToken(context) {
      var identityCandidates = [
        "usuario.id",
        "usuario.email",
        "user.id",
        "user.email",
        "lead.telefone",
        "lead.email",
      ];

      for (var index = 0; index < identityCandidates.length; index += 1) {
        var candidate = getValueByPath(context, identityCandidates[index]);
        var sanitized = sanitizeStorageToken(candidate);
        if (sanitized) {
          return sanitized;
        }
      }

      return "";
    }

    function getScopeToken(context) {
      var scopeCandidates = [
        "imovel.id",
        "imovel.slug",
        "imovel.codigo",
        "imovel.matricula",
        "produto.id",
        "produto.slug",
        "produto.sku",
        "item.id",
        "item.slug",
        "veiculo.id",
        "veiculo.placa",
        "pagina.id",
        "pagina.slug",
      ];

      for (var index = 0; index < scopeCandidates.length; index += 1) {
        var candidate = getValueByPath(context, scopeCandidates[index]);
        var sanitized = sanitizeStorageToken(candidate);
        if (sanitized) {
          return sanitized;
        }
      }

      var pathToken = sanitizeStorageToken(window.location.pathname || "");
      return pathToken || "page";
    }

    function buildScopedStorageKey(context) {
      var identityToken = getIdentityToken(context);
      if (!identityToken) {
        return null;
      }

      return "infrastudio-chat:" + instanceKey + ":" + identityToken + ":" + getScopeToken(context);
    }

    function restorePersistedState(nextStorageKey) {
      if (!nextStorageKey) {
        state.chatId = null;
        state.messages = [];
        state.docked = false;
        return;
      }

      try {
        var stored = window.localStorage.getItem(nextStorageKey);
        if (!stored) {
          state.chatId = null;
          state.messages = [];
          state.docked = false;
          return;
        }

        var parsed = JSON.parse(stored);
        state.chatId = typeof parsed.chatId === "string" ? parsed.chatId : null;
        state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
        state.docked = Boolean(parsed.docked);
        state.maximized = Boolean(parsed.maximized) && !state.docked;
        state.dragPosition = parsed.dragPosition && typeof parsed.dragPosition === "object"
          ? {
              x: Number(parsed.dragPosition.x) || 0,
              y: Number(parsed.dragPosition.y) || 0,
            }
          : null;
      } catch (error) {
        console.warn("[InfraStudio Chat] failed to restore scoped conversation.", error);
        state.chatId = null;
        state.messages = [];
        state.docked = false;
        state.maximized = false;
        state.dragPosition = null;
      }
    }

    function refreshStorageScope() {
      var nextStorageKey = buildScopedStorageKey(state.context);
      if (nextStorageKey === storageKey) {
        return;
      }

      storageKey = nextStorageKey;
      restorePersistedState(storageKey);
      renderMessages();
      updateLauncherVisual();
      applyDockLayout();
      autoResizeInput();
    }

    function scrollToBottom() {
      messagesWrap.scrollTop = messagesWrap.scrollHeight;
    }

    function autoResizeInput() {
      input.style.height = "46px";
      var lineHeight = parseFloat(window.getComputedStyle(input).lineHeight) || 22;
      var maxHeight = Math.round(lineHeight * 3 + 24);
      var nextHeight = Math.min(input.scrollHeight, maxHeight);
      input.style.height = nextHeight + "px";
      input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
    }

    function updateLauncherVisual() {
      triggerButton.classList.toggle("is-open", state.open);
      triggerButton.setAttribute("aria-label", state.open ? "Fechar chat" : "Abrir chat");
      triggerButton.innerHTML = state.open ? createCloseIcon() : createChatBubbleIcon();
    }

    function isDesktopFloatingMode() {
      return window.innerWidth >= 961 && !state.docked;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function clearCustomPosition() {
      state.dragPosition = null;
      wrap.style.left = "";
      wrap.style.top = "";
      wrap.style.right = "";
      wrap.style.bottom = "";
    }

    function applyFloatingPosition() {
      var canFloat = isDesktopFloatingMode() && state.dragPosition && !state.docked;
      wrap.classList.toggle("custom-position", Boolean(canFloat));
      resetPositionButton.hidden = !canFloat;

      if (!canFloat) {
        wrap.style.left = "";
        wrap.style.top = "";
        wrap.style.right = "";
        wrap.style.bottom = "";
        return;
      }

      var panelWidth = panel.offsetWidth || (state.maximized ? 440 : 380);
      var panelHeight = panel.offsetHeight || (state.maximized ? 720 : 620);
      var maxX = Math.max(window.innerWidth - panelWidth - 12, 12);
      var maxY = Math.max(window.innerHeight - panelHeight - 12, 12);
      var nextX = clamp(state.dragPosition.x, 12, maxX);
      var nextY = clamp(state.dragPosition.y, 12, maxY);

      state.dragPosition = { x: nextX, y: nextY };
      wrap.style.left = nextX + "px";
      wrap.style.top = nextY + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    }

    function applyDockLayout() {
      if (!dockEnabled) {
        state.docked = false;
      }

      wrap.classList.toggle("docked", state.docked);
      wrap.classList.toggle("maximized", Boolean(state.maximized && !state.docked));
      maximizeButton.hidden = !isDesktopFloatingMode();

      if (!state.docked) {
        document.body.style.marginLeft = originalBodyStyles.marginLeft;
        document.body.style.marginRight = originalBodyStyles.marginRight;
        document.body.style.width = originalBodyStyles.width;
        document.body.style.minHeight = originalBodyStyles.minHeight;
        document.body.style.transition = originalBodyStyles.transition;
        document.body.style.overflowX = originalBodyStyles.overflowX;
        applyFloatingPosition();
        return;
      }

      clearCustomPosition();
      resetPositionButton.hidden = true;

      if (window.innerWidth < 960) {
        document.body.style.overflowX = "hidden";
        return;
      }

      document.body.style.transition = "margin-left .28s ease, margin-right .28s ease, width .28s ease";
      document.body.style.marginLeft = originalBodyStyles.marginLeft;
      document.body.style.marginRight = dockWidth + "px";
      document.body.style.width = "calc(100% - " + dockWidth + "px)";
      document.body.style.minHeight = "100vh";
      document.body.style.overflowX = "hidden";
    }

    function syncViewportMetrics() {
      var viewport = window.visualViewport;
      var viewportHeight = viewport && viewport.height ? viewport.height : window.innerHeight;
      wrap.style.setProperty("--viewport-height", Math.round(viewportHeight) + "px");
    }

    function renderMessages() {
      stack.innerHTML = "";

      if (!state.messages.length) {
        var welcome = document.createElement("div");
        welcome.className = "chat-bubble ai";
        welcome.textContent = "Oi! Como posso te ajudar agora?";
        stack.appendChild(welcome);
      } else {
        state.messages.forEach(function (message) {
          var bubble = document.createElement("div");
          bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
          bubble.innerHTML = '<div class="chat-rich">' + formatRichText(message.text) + "</div>";
          if (message.isAi && message.cta && message.cta.url) {
            var cta = createWhatsAppButton(message.cta);
            if (cta) {
              bubble.appendChild(cta);
            }
          }
          if (message.isAi && Array.isArray(message.assets) && message.assets.length) {
            var assetGallery = createAssetGallery(message.assets);
            if (assetGallery) {
              bubble.appendChild(assetGallery);
            }
          }
          stack.appendChild(bubble);
        });
      }

      if (state.loading) {
        var typing = document.createElement("div");
        typing.className = "chat-typing";
        typing.innerHTML = '<span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
        stack.appendChild(typing);
      }

      scrollToBottom();
    }

    function setOpen(nextOpen) {
      state.open = nextOpen;
      wrap.classList.toggle("open", state.open);
      if (state.open) {
        panel.classList.add("open");
        updateLauncherVisual();
        applyDockLayout();
        applyFloatingPosition();
        autoResizeInput();
        input.focus();
      } else {
        panel.classList.remove("open");
        state.docked = false;
        updateLauncherVisual();
        applyDockLayout();
      }
      persist();
    }

    function setLoading(nextLoading) {
      state.loading = nextLoading;
      input.readOnly = nextLoading;
      input.classList.toggle("is-waiting", nextLoading);
      input.placeholder = nextLoading ? "Atendente esta digitando..." : "Digite sua mensagem...";
      sendButton.disabled = nextLoading;
      sendButton.innerHTML = nextLoading ? '<span class="chat-icon" aria-hidden="true">...</span>' : createPlaneIcon();
      renderMessages();
    }

    function setContext(nextContext) {
      if (!nextContext || typeof nextContext !== "object" || Array.isArray(nextContext)) {
        return;
      }

      for (var key in nextContext) {
        if (Object.prototype.hasOwnProperty.call(nextContext, key)) {
          state.context[key] = nextContext[key];
        }
      }

      refreshStorageScope();
      persist();
    }

    function applyUiConfig(ui) {
      if (!ui || typeof ui !== "object") {
        return;
      }

      if (typeof ui.title === "string" && ui.title.trim()) {
        state.ui.title = ui.title.trim();
      }

      if (ui.theme === "light" || ui.theme === "dark") {
        state.ui.theme = ui.theme;
      }

      if (typeof ui.accent === "string" && ui.accent.trim()) {
        state.ui.accent = ui.accent.trim();
      }

      if (typeof ui.transparent === "boolean") {
        state.ui.transparent = ui.transparent;
      }

      var light = state.ui.theme === "light";
      wrap.style.setProperty("--accent", state.ui.accent);
      wrap.style.setProperty("--panel-bg", light ? (state.ui.transparent ? "rgba(255,255,255,0.88)" : "#ffffff") : (state.ui.transparent ? "rgba(9,16,34,0.96)" : "#08101f"));
      wrap.style.setProperty("--panel-text", light ? "#0f172a" : "#e2e8f0");
      wrap.style.setProperty("--header-border", light ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)");
      wrap.style.setProperty("--subtle-bg", light ? "rgba(148,163,184,0.08)" : "rgba(255,255,255,0.04)");
      wrap.style.setProperty("--surface-bg", light ? "rgba(248,250,252,0.86)" : "rgba(2,6,23,0.18)");
      wrap.style.setProperty("--ai-bg", light ? "#f8fafc" : "rgba(30,41,59,0.92)");
      wrap.style.setProperty("--ai-text", light ? "#0f172a" : "#e2e8f0");
      wrap.style.setProperty("--input-bg", light ? "rgba(255,255,255,0.92)" : "rgba(2,6,23,0.45)");
      wrap.style.setProperty("--input-text", light ? "#0f172a" : "#ffffff");
      wrap.style.setProperty("--shadow-color", light ? "rgba(15,23,42,0.18)" : "rgba(2,6,23,0.45)");
      title.textContent = state.ui.title;
    }

    async function loadRemoteConfig() {
      try {
        var params = new URLSearchParams({
          projeto: projeto,
          agente: agente,
        });
        var response = await fetch(apiBase + "/api/chat/config?" + params.toString(), {
          method: "GET",
        });

        if (!response.ok) {
          return;
        }

        var payload = await response.json();
        applyUiConfig(payload.ui || null);
      } catch (error) {
        console.warn("[InfraStudio Chat] failed to load remote config.", error);
      }
    }

    async function sendMessage(text) {
      var trimmed = String(text || "").trim();
      if (!trimmed || state.loading) {
        return;
      }

      state.messages.push({ id: "user-" + Date.now(), text: trimmed, isAi: false });
      persist();
      renderMessages();
      input.value = "";
      autoResizeInput();
      setLoading(true);

      try {
        var mergedContext = {
          channel: {
            kind: "external_widget",
          },
          ui: {
            structured_response: true,
          },
        };

        for (var contextKey in state.context) {
          if (Object.prototype.hasOwnProperty.call(state.context, contextKey)) {
            mergedContext[contextKey] = state.context[contextKey];
          }
        }

        if (state.context && typeof state.context.channel === "object" && !Array.isArray(state.context.channel)) {
          mergedContext.channel = {
            kind: "external_widget",
          };

          for (var channelKey in state.context.channel) {
            if (Object.prototype.hasOwnProperty.call(state.context.channel, channelKey)) {
              mergedContext.channel[channelKey] = state.context.channel[channelKey];
            }
          }
        }

        if (state.context && typeof state.context.ui === "object" && !Array.isArray(state.context.ui)) {
          mergedContext.ui = {
            structured_response: true,
          };

          for (var uiKey in state.context.ui) {
            if (Object.prototype.hasOwnProperty.call(state.context.ui, uiKey)) {
              mergedContext.ui[uiKey] = state.context.ui[uiKey];
            }
          }
        }

        var response = await fetch(apiBase + "/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: state.chatId,
            message: trimmed,
            projeto: projeto,
            agente: agente,
            context: mergedContext,
          }),
        });

        var payload = await response.json();
        if (payload.chatId) {
          state.chatId = payload.chatId;
        }

        state.messages.push({
          id: "ai-" + Date.now(),
          text: payload.reply || payload.error || "Nao consegui responder agora.",
          isAi: true,
          cta: null,
          assets: Array.isArray(payload.assets) ? payload.assets : [],
        });
        if (payload.whatsapp && payload.whatsapp.url) {
          var whatsappMessage = createWhatsAppMessage(payload.whatsapp);
          if (whatsappMessage) {
            state.messages.push(whatsappMessage);
          }
        }
      } catch (error) {
        state.messages.push({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
          cta: null,
        });
      } finally {
        persist();
        renderMessages();
        setLoading(false);
      }
    }

    triggerButton.addEventListener("click", function () {
      setOpen(!state.open);
    });

    closeButton.addEventListener("click", function () {
      setOpen(false);
    });

    resetButton.addEventListener("click", function () {
      state.chatId = null;
      state.messages = [];
      persist();
      renderMessages();
      input.focus();
    });

    dockButton.addEventListener("click", function () {
      state.docked = !state.docked;
      if (state.docked) {
        state.maximized = false;
      }
      persist();
      applyDockLayout();
      if (!state.open) {
        setOpen(true);
        return;
      }
      autoResizeInput();
    });

    maximizeButton.addEventListener("click", function () {
      state.maximized = !state.maximized;
      persist();
      applyDockLayout();
      autoResizeInput();
      scrollToBottom();
    });

    resetPositionButton.addEventListener("click", function () {
      clearCustomPosition();
      persist();
      applyDockLayout();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      void sendMessage(input.value);
    });

    input.addEventListener("input", autoResizeInput);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage(input.value);
      }
    });
    window.addEventListener("resize", function () {
      syncViewportMetrics();
      applyDockLayout();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncViewportMetrics);
      window.visualViewport.addEventListener("scroll", syncViewportMetrics);
    }

    window.addEventListener("infrastudio-chat:open", function (event) {
      var detail = event && event.detail ? event.detail : {};
      var requestedProject = detail.projeto || null;
      var requestedAgent = detail.agente || null;

      if (requestedProject && requestedProject !== projeto) {
        return;
      }

      if (requestedAgent && requestedAgent !== agente) {
        return;
      }

      setOpen(true);
    });

    header.addEventListener("pointerdown", function (event) {
      if (!state.open || state.docked || window.innerWidth < 961) {
        return;
      }

      var target = event.target;
      if (target && typeof target.closest === "function" && target.closest("button, a, input, textarea")) {
        return;
      }

      var rect = wrap.getBoundingClientRect();
      var dragOffsetX = event.clientX - rect.left;
      var dragOffsetY = event.clientY - rect.top;
      header.classList.add("is-dragging");

      if (!state.dragPosition) {
        state.dragPosition = { x: rect.left, y: rect.top };
      }

      function handlePointerMove(moveEvent) {
        var panelWidth = panel.offsetWidth || (state.maximized ? 440 : 380);
        var panelHeight = panel.offsetHeight || (state.maximized ? 720 : 620);
        var nextX = clamp(moveEvent.clientX - dragOffsetX, 12, Math.max(window.innerWidth - panelWidth - 12, 12));
        var nextY = clamp(moveEvent.clientY - dragOffsetY, 12, Math.max(window.innerHeight - panelHeight - 12, 12));
        state.dragPosition = { x: nextX, y: nextY };
        applyFloatingPosition();
      }

      function handlePointerUp() {
        header.classList.remove("is-dragging");
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        persist();
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    });

    applyUiConfig(state.ui);
    updateLauncherVisual();
    syncViewportMetrics();
    applyDockLayout();
    autoResizeInput();
    while (queue.length) {
      setContext(queue.shift());
    }

    window.InfraChat = {
      __queue: queue,
      setContext: setContext,
    };

    renderMessages();
    void loadRemoteConfig();
  });
})();
