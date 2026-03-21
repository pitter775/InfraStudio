(function () {
  var existing = window.InfraChat;
  var queue = existing && Array.isArray(existing.__queue) ? existing.__queue : [];
  var runtime = {
    instance: null,
    logs: [],
    blockedReason: null,
    strictHostControl: true,
  };

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (isRecord(value)) {
      var output = {};
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          output[key] = clone(value[key]);
        }
      }
      return output;
    }

    return value;
  }

  function mergeDeep(base, patch) {
    var output = isRecord(base) ? clone(base) : {};
    if (!isRecord(patch)) {
      return output;
    }

    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }

      if (isRecord(output[key]) && isRecord(patch[key])) {
        output[key] = mergeDeep(output[key], patch[key]);
      } else {
        output[key] = clone(patch[key]);
      }
    }

    return output;
  }

  function getValueByPath(source, path) {
    return String(path || "").split(".").reduce(function (current, segment) {
      if (!isRecord(current)) {
        return null;
      }

      return Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : null;
    }, source);
  }

  function readScriptDefaults() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.querySelectorAll("script[src]");
      for (var index = scripts.length - 1; index >= 0; index -= 1) {
        var candidate = scripts[index];
        var src = candidate.getAttribute("src") || "";
        if (src.indexOf("/chat.js") !== -1) {
          script = candidate;
          break;
        }
      }
    }

    if (!script) {
      return {};
    }

    return {
      projeto: (script.getAttribute("data-projeto") || "").trim() || null,
      agente: (script.getAttribute("data-agente") || "").trim() || null,
      apiBase: (script.getAttribute("data-api-base") || new URL(script.src, window.location.href).origin).trim(),
    };
  }

  var defaults = readScriptDefaults();

  function emitLifecycle(eventName, payload) {
    var entry = {
      event: eventName,
      timestamp: new Date().toISOString(),
      payload: payload ? clone(payload) : {},
    };

    runtime.logs.push(entry);
    if (runtime.logs.length > 40) {
      runtime.logs.shift();
    }

    try {
      console.info("[InfraStudio Chat]", eventName, entry.payload);
    } catch (error) {
      console.log("[InfraStudio Chat]", eventName);
    }
  }

  function getCurrentRoute(config, context) {
    return getValueByPath(context, "route.path")
      || getValueByPath(context, "rota.path")
      || getValueByPath(context, "pagina.path")
      || config.currentRoute
      || window.location.pathname
      || "/";
  }

  function evaluatePolicy(config, context) {
    var policy = mergeDeep(config.policy || {}, context && isRecord(context.policy) ? context.policy : {});
    var display = isRecord(policy.display) ? policy.display : {};
    var route = getCurrentRoute(config, context);
    var allowedRoutes = Array.isArray(policy.allowedRoutes)
      ? policy.allowedRoutes
      : Array.isArray(display.allowedRoutes)
        ? display.allowedRoutes
        : [];

    if (policy.allowed === false || display.enabled === false || display.visible === false) {
      return { allowed: false, reason: "blocked_by_policy", route: route };
    }

    if (allowedRoutes.length) {
      var matches = allowedRoutes.some(function (pattern) {
        if (pattern === "*") {
          return true;
        }

        if (typeof pattern === "string" && pattern.slice(-1) === "*") {
          return route.indexOf(pattern.slice(0, -1)) === 0;
        }

        return route === pattern;
      });

      if (!matches) {
        return { allowed: false, reason: "blocked_by_route", route: route };
      }
    }

    return { allowed: true, reason: null, route: route };
  }

  function formatRichText(value) {
    var escaped = String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    return escaped
      .trim()
      .split(/\n\s*\n/)
      .map(function (block) {
        var lines = block.split("\n").filter(Boolean);
        if (!lines.length) {
          return "";
        }

        if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) {
          return "<ul>" + lines.map(function (line) { return "<li>" + line.replace(/^[-*]\s+/, "") + "</li>"; }).join("") + "</ul>";
        }

        if (lines.every(function (line) { return /^\d+\.\s+/.test(line); })) {
          return "<ol>" + lines.map(function (line) { return "<li>" + line.replace(/^\d+\.\s+/, "") + "</li>"; }).join("") + "</ol>";
        }

        return "<p>" + lines.join("<br>") + "</p>";
      })
      .join("");
  }

  function createWhatsAppMessage(cta) {
    if (!cta || !cta.url) {
      return null;
    }

    return {
      id: "ai-cta-" + Date.now(),
      text: "Se preferir, eu te levo para o WhatsApp agora:",
      isAi: true,
      cta: cta,
    };
  }

  function createInstance(config) {
    return {
      config: config,
      state: {
        chatId: null,
        messages: [],
        context: clone(config.context || {}),
        open: Boolean(config.open),
        hidden: Boolean(config.hidden),
        loading: false,
        ui: mergeDeep(
          {
            title: "Chat",
            theme: "dark",
            accent: "#2563eb",
            transparent: true,
          },
          config.ui || {},
        ),
      },
      refs: {},
      disposers: [],
      controllers: [],
      observers: [],
      timers: [],
    };
  }

  function addListener(instance, target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    instance.disposers.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function addAbortController(instance, controller) {
    instance.controllers.push(controller);
    instance.disposers.push(function () {
      controller.abort();
    });
  }

  function createChatBubbleIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 18.5H5.5A2.5 2.5 0 0 1 3 16V7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V16a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function createCloseIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span>';
  }

  function createResetIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8V4m0 0h4M6 4l3.1 3.1A8 8 0 1 1 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function createPlaneIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20.2 4.8 3.9 11.2c-.7.3-.7 1.3.1 1.5l5.9 1.9 1.9 5.9c.2.8 1.2.8 1.5.1l6.4-16.3c.3-.8-.5-1.6-1.5-1.3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m9.8 14.2 4.5-4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function getAssetExtension(asset) {
    var fileName = String((asset && (asset.arquivoNome || asset.nome)) || "");
    var match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function getAssetPreviewKind(asset) {
    var mimeType = String((asset && asset.mimeType) || "").toLowerCase();
    var extension = getAssetExtension(asset);

    if (asset && asset.categoria === "image") {
      return "image";
    }

    if (mimeType.indexOf("video/") === 0 || ["mp4", "webm", "mov"].indexOf(extension) !== -1) {
      return "video";
    }

    if (
      mimeType === "application/pdf" ||
      ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].indexOf(extension) !== -1
    ) {
      return "preview";
    }

    return "file";
  }

  function getAssetPreviewLabel(asset) {
    var mimeType = String((asset && asset.mimeType) || "").toLowerCase();
    var extension = getAssetExtension(asset).toUpperCase();

    if (mimeType === "application/pdf" || extension === "PDF") {
      return "PDF";
    }

    if (extension) {
      return extension;
    }

    return "ARQ";
  }

  function createAssetPreviewBadge(asset) {
    var preview = document.createElement("div");
    preview.className = "chat-asset-preview";

    var badge = document.createElement("div");
    badge.className = "chat-asset-preview-badge";
    badge.textContent = getAssetPreviewLabel(asset);
    preview.appendChild(badge);

    return preview;
  }

  function createAssetAction(asset, download) {
    var action = document.createElement("a");
    action.className = "chat-asset-action" + (download ? "" : " primary");
    action.href = asset.publicUrl;
    action.target = "_blank";
    action.rel = "noreferrer noopener";

    if (download) {
      action.setAttribute("download", asset.arquivoNome || asset.nome || "arquivo");
      action.textContent = "Baixar";
    } else {
      action.textContent = "Abrir";
    }

    return action;
  }

  function getAssetOpenLabel(asset, previewKind) {
    if (previewKind === "image") {
      return "Abrir imagem";
    }

    if (previewKind === "video") {
      return "Abrir video";
    }

    var label = getAssetPreviewLabel(asset);
    return label === "ARQ" ? "Abrir arquivo" : "Abrir " + label;
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

      var previewKind = getAssetPreviewKind(asset);
      var card = document.createElement("div");
      card.className = "chat-asset " + previewKind;

      if (previewKind === "image") {
        var image = document.createElement("img");
        image.src = asset.publicUrl;
        image.alt = asset.nome || asset.arquivoNome || "Imagem do agente";
        card.appendChild(image);
      } else if (previewKind === "video") {
        var video = document.createElement("video");
        video.src = asset.publicUrl;
        video.muted = true;
        video.preload = "metadata";
        video.playsInline = true;
        card.appendChild(video);
      } else if (previewKind === "preview") {
        card.appendChild(createAssetPreviewBadge(asset));
      }

      var body = document.createElement("div");
      body.className = "chat-asset-body";

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
      openLabel.textContent = getAssetOpenLabel(asset, previewKind);
      meta.appendChild(openLabel);

      body.appendChild(meta);

      var actions = document.createElement("div");
      actions.className = "chat-asset-actions";
      actions.appendChild(createAssetAction(asset, false));
      actions.appendChild(createAssetAction(asset, true));
      body.appendChild(actions);

      card.appendChild(body);
      wrap.appendChild(card);
    });

    return wrap;
  }

  function applyUi(instance) {
    var refs = instance.refs;
    var ui = instance.state.ui;
    var light = ui.theme === "light";
    refs.root.style.setProperty("--chat-accent", ui.accent);
    refs.root.style.setProperty("--chat-bg", light ? (ui.transparent ? "rgba(255,255,255,.88)" : "#ffffff") : (ui.transparent ? "rgba(9,16,34,.96)" : "#08101f"));
    refs.root.style.setProperty("--chat-text", light ? "#0f172a" : "#e2e8f0");
    refs.root.style.setProperty("--chat-muted", light ? "#64748b" : "#94a3b8");
    refs.root.style.setProperty("--chat-surface", light ? "rgba(248,250,252,.86)" : "rgba(2,6,23,.18)");
    refs.root.style.setProperty("--chat-bubble-ai", light ? "#f8fafc" : "rgba(30,41,59,.92)");
    refs.root.style.setProperty("--chat-input-bg", light ? "rgba(255,255,255,.92)" : "rgba(2,6,23,.45)");
    refs.root.style.setProperty("--chat-input-text", light ? "#0f172a" : "#ffffff");
    refs.root.style.setProperty("--chat-header-border", light ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)");
    refs.root.style.setProperty("--chat-subtle-bg", light ? "rgba(148,163,184,.08)" : "rgba(255,255,255,.04)");
    refs.root.style.setProperty("--chat-shadow", light ? "rgba(15,23,42,.18)" : "rgba(2,6,23,.45)");
    refs.title.textContent = ui.title;
  }

  function renderMessages(instance) {
    var refs = instance.refs;
    refs.stack.innerHTML = "";

    var messages = instance.state.messages.length
      ? instance.state.messages
      : [{ id: "welcome", text: "Oi! Como posso te ajudar agora?", isAi: true }];

    messages.forEach(function (message) {
      var bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
      bubble.innerHTML = '<div class="chat-rich">' + formatRichText(message.text) + "</div>";

      if (message.isAi && message.cta && message.cta.url) {
        var cta = document.createElement("a");
        cta.className = "chat-cta";
        cta.href = message.cta.url;
        cta.target = "_blank";
        cta.rel = "noreferrer noopener";
        cta.textContent = message.cta.label || "Continuar no WhatsApp";
        bubble.appendChild(cta);
      }

      if (message.isAi && Array.isArray(message.assets) && message.assets.length) {
        var assetGallery = createAssetGallery(message.assets);
        if (assetGallery) {
          bubble.appendChild(assetGallery);
        }
      }

      refs.stack.appendChild(bubble);
    });

    if (instance.state.loading) {
      var typing = document.createElement("div");
      typing.className = "chat-typing";
      typing.innerHTML = '<span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      refs.stack.appendChild(typing);
    }

    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  function updateVisibility(instance) {
    instance.refs.host.style.display = instance.state.hidden ? "none" : "";
    instance.refs.root.classList.toggle("open", instance.state.open);
    instance.refs.panel.classList.toggle("open", instance.state.open);
    instance.refs.panel.hidden = !instance.state.open;
    instance.refs.launcher.classList.toggle("is-open", instance.state.open);
    instance.refs.launcher.setAttribute("aria-label", instance.state.open ? "Fechar chat" : "Abrir chat");
    instance.refs.launcher.innerHTML = instance.state.open ? createCloseIcon() : createChatBubbleIcon();
  }

  function setLoading(instance, loading) {
    instance.state.loading = loading;
    instance.refs.input.readOnly = loading;
    instance.refs.send.disabled = loading;
    instance.refs.input.classList.toggle("is-waiting", loading);
    instance.refs.input.placeholder = loading ? "Atendente esta digitando..." : "Digite sua mensagem...";
    instance.refs.send.innerHTML = loading ? '<span class="chat-icon" aria-hidden="true">...</span>' : createPlaneIcon();
    renderMessages(instance);
  }

  function autoResizeInput(instance) {
    var input = instance.refs.input;
    input.style.height = "46px";
    var lineHeight = parseFloat(window.getComputedStyle(input).lineHeight) || 22;
    var maxHeight = Math.round(lineHeight * 3 + 24);
    var nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = nextHeight + "px";
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function mountDom(instance) {
    var host = document.createElement("div");
    var root = document.createElement("div");
    var panel = document.createElement("div");
    var header = document.createElement("div");
    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    var subtitle = document.createElement("div");
    var actions = document.createElement("div");
    var reset = document.createElement("button");
    var close = document.createElement("button");
    var messages = document.createElement("div");
    var stack = document.createElement("div");
    var form = document.createElement("form");
    var input = document.createElement("textarea");
    var send = document.createElement("button");
    var launcher = document.createElement("button");

    host.id = "infrastudio-chat-root";
    root.className = "chat-root";
    panel.className = "chat-panel";
    header.className = "chat-header";
    titleWrap.className = "chat-title-wrap";
    title.className = "chat-title";
    subtitle.className = "chat-subtitle";
    subtitle.textContent = "Assistente virtual";
    actions.className = "chat-actions";
    reset.type = "button";
    reset.className = "chat-action";
    reset.setAttribute("aria-label", "Novo atendimento");
    reset.setAttribute("title", "Novo atendimento");
    reset.innerHTML = createResetIcon();
    close.type = "button";
    close.className = "chat-action";
    close.setAttribute("aria-label", "Fechar chat");
    close.innerHTML = createCloseIcon();
    messages.className = "chat-messages";
    stack.className = "chat-stack";
    form.className = "chat-form";
    input.className = "chat-input";
    input.rows = 1;
    input.placeholder = "Digite sua mensagem...";
    send.type = "submit";
    send.className = "chat-send";
    send.setAttribute("aria-label", "Enviar mensagem");
    send.innerHTML = createPlaneIcon();
    launcher.type = "button";
    launcher.className = "chat-launcher";
    launcher.setAttribute("aria-label", "Abrir chat");
    launcher.innerHTML = createChatBubbleIcon();

    var style = document.createElement("style");
    style.textContent = ".chat-root{position:fixed;right:24px;bottom:24px;z-index:2147483000;font-family:Inter,Arial,sans-serif;--chat-accent:#2563eb;--chat-bg:rgba(9,16,34,.96);--chat-text:#e2e8f0;--chat-muted:#94a3b8;--chat-surface:rgba(2,6,23,.18);--chat-bubble-ai:rgba(30,41,59,.92);--chat-input-bg:rgba(2,6,23,.45);--chat-input-text:#ffffff;--chat-header-border:rgba(255,255,255,.08);--chat-subtle-bg:rgba(255,255,255,.04);--chat-shadow:rgba(2,6,23,.45)}.chat-icon{display:inline-flex;align-items:center;justify-content:center}.chat-icon svg{width:100%;height:100%;display:block}@keyframes chatBubbleIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes chatDotsPulse{0%,80%,100%{opacity:.28;transform:translateY(0)}40%{opacity:1;transform:translateY(-1px)}}@keyframes chatLauncherSwap{0%{opacity:0;transform:scale(.72) rotate(-18deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}.chat-root.open .chat-launcher{opacity:0;pointer-events:none;transform:translateY(8px) scale(.94)}.chat-panel{width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 100px));display:none;flex-direction:column;overflow:hidden;border-radius:26px;border:1px solid var(--chat-header-border);background:var(--chat-bg);color:var(--chat-text);box-shadow:0 24px 70px var(--chat-shadow);backdrop-filter:blur(14px);margin-bottom:16px;animation:chatBubbleIn .22s ease both}.chat-panel.open{display:flex}.chat-header{position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 94%,transparent);backdrop-filter:blur(16px)}.chat-title{font-size:16px;font-weight:700;color:var(--chat-text)}.chat-subtitle{margin-top:4px;font-size:11px;color:var(--chat-muted);text-transform:uppercase;letter-spacing:.08em}.chat-actions{display:flex;gap:8px}.chat-action,.chat-send,.chat-launcher{border:0;cursor:pointer}.chat-action{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--chat-header-border);border-radius:12px;background:var(--chat-subtle-bg);color:var(--chat-muted)}.chat-action .chat-icon{width:16px;height:16px}.chat-messages{min-height:0;flex:1;overflow-y:auto;padding:16px;background:var(--chat-surface)}.chat-stack{display:flex;flex-direction:column;gap:12px}.chat-bubble{max-width:88%;border-radius:18px;border:1px solid var(--chat-header-border);padding:12px 14px;font-size:14px;line-height:1.6;animation:chatBubbleIn .22s ease both}.chat-bubble.ai{padding:0;background:transparent;color:var(--chat-text);border-color:transparent;border-bottom-left-radius:6px}.chat-bubble.user{margin-left:auto;background:color-mix(in srgb,var(--chat-accent) 78%,white 22%);color:#fff;border-color:color-mix(in srgb,var(--chat-accent) 68%,white 32%);border-bottom-right-radius:6px;box-shadow:0 10px 24px color-mix(in srgb,var(--chat-accent) 22%,transparent);backdrop-filter:blur(8px)}.chat-bubble.ai .chat-rich{background:var(--chat-bubble-ai);border:1px solid var(--chat-header-border);border-radius:18px;border-bottom-left-radius:6px;padding:12px 14px}.chat-rich{white-space:normal}.chat-rich p,.chat-rich ul,.chat-rich ol{margin:0}.chat-rich p+p,.chat-rich p+ul,.chat-rich p+ol,.chat-rich ul+p,.chat-rich ol+p,.chat-rich ul+ul,.chat-rich ol+ol{margin-top:10px}.chat-rich ul,.chat-rich ol{padding-left:20px}.chat-rich li+li{margin-top:6px}.chat-cta{margin-top:10px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid color-mix(in srgb,var(--chat-accent) 30%,transparent);background:color-mix(in srgb,var(--chat-accent) 14%,transparent);color:#fff;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;transition:transform .18s ease,background-color .18s ease,border-color .18s ease}.chat-cta:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--chat-accent) 20%,transparent)}.chat-assets{margin-top:10px;display:grid;gap:10px}.chat-asset{display:block;overflow:hidden;border-radius:16px;border:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 88%,transparent);color:inherit;text-decoration:none}.chat-asset.image,.chat-asset.video,.chat-asset.preview{padding:0}.chat-asset.image img,.chat-asset.video video{display:block;width:100%;max-height:210px;object-fit:cover;background:rgba(15,23,42,.35)}.chat-asset-preview{display:flex;align-items:center;justify-content:center;min-height:138px;padding:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--chat-accent) 22%,#0f172a 78%),rgba(15,23,42,.94))}.chat-asset-preview-badge{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.chat-asset.file{padding:12px}.chat-asset-meta{display:flex;align-items:center;justify-content:space-between;gap:12px}.chat-asset-body{padding:12px}.chat-asset-actions{margin-top:10px;display:flex;gap:8px}.chat-asset-action{display:inline-flex;align-items:center;justify-content:center;min-width:78px;padding:8px 12px;border-radius:999px;border:1px solid var(--chat-header-border);background:rgba(255,255,255,.05);color:inherit;font-size:11px;font-weight:700;text-decoration:none;transition:transform .18s ease,background-color .18s ease}.chat-asset-action:hover{transform:translateY(-1px);background:rgba(255,255,255,.09)}.chat-asset-action.primary{border-color:color-mix(in srgb,var(--chat-accent) 40%,transparent);background:color-mix(in srgb,var(--chat-accent) 18%,transparent);color:#fff}.chat-asset-title{font-size:12px;font-weight:700;color:inherit}.chat-asset-subtitle{margin-top:4px;font-size:11px;color:var(--chat-muted)}.chat-asset-open{font-size:11px;font-weight:700;color:var(--chat-accent);white-space:nowrap}.chat-typing{display:inline-flex;width:fit-content;max-width:88%;align-items:center;gap:10px;border-radius:18px;border:1px solid var(--chat-header-border);background:var(--chat-bubble-ai);color:var(--chat-muted);padding:12px 14px;animation:chatBubbleIn .22s ease both}.chat-typing-dots{display:inline-flex;gap:4px}.chat-typing-dots span{width:7px;height:7px;border-radius:999px;background:currentColor;animation:chatDotsPulse 1.2s infinite ease-in-out}.chat-typing-dots span:nth-child(2){animation-delay:.16s}.chat-typing-dots span:nth-child(3){animation-delay:.32s}.chat-form{flex-shrink:0;display:flex;align-items:flex-end;gap:10px;padding:16px;border-top:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 96%,transparent)}.chat-input{flex:1;box-sizing:border-box;height:46px;min-height:46px;max-height:110px;resize:none;overflow-y:hidden;border-radius:16px;border:1px solid rgba(148,163,184,.18);outline:none;background:var(--chat-input-bg);color:var(--chat-input-text);padding:11px 14px;font:inherit;font-size:14px;line-height:20px;scrollbar-width:thin;scrollbar-color:rgba(59,130,246,.55) rgba(255,255,255,.05);transition:border-color .18s ease,background-color .18s ease}.chat-input::placeholder{font-size:13px;color:var(--chat-muted)}.chat-input:focus{border-color:rgba(148,163,184,.28);box-shadow:none;background:var(--chat-input-bg)}.chat-input.is-waiting::placeholder{font-style:italic;color:var(--chat-muted)}.chat-send{width:46px;height:46px;flex:0 0 46px;display:inline-flex;align-items:center;justify-content:center;border-radius:16px;background:var(--chat-accent);color:#fff;padding:0}.chat-send .chat-icon{width:18px;height:18px}.chat-send[disabled]{opacity:.6;cursor:wait}.chat-launcher{display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:999px;background:var(--chat-accent);color:#fff;box-shadow:0 20px 40px var(--chat-shadow);transition:transform .2s ease,background-color .2s ease,box-shadow .2s ease,opacity .18s ease}.chat-launcher:hover{transform:translateY(-1px) scale(1.02)}.chat-launcher .chat-icon{width:24px;height:24px;animation:chatLauncherSwap .22s ease both}@media (max-width:640px){.chat-root{right:12px;left:12px;bottom:12px;display:flex;flex-direction:column;align-items:flex-end}.chat-panel{width:100%;height:min(70vh,560px);margin-bottom:12px;border-radius:24px}.chat-header{padding:14px 14px 12px}.chat-form{padding:12px}.chat-input{border-radius:18px}}";

    actions.appendChild(reset);
    actions.appendChild(close);
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(actions);
    messages.appendChild(stack);
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    root.appendChild(style);
    root.appendChild(panel);
    root.appendChild(launcher);
    host.appendChild(root);
    document.body.appendChild(host);

    instance.refs = {
      host: host,
      root: root,
      panel: panel,
      title: title,
      subtitle: subtitle,
      reset: reset,
      close: close,
      messages: messages,
      stack: stack,
      form: form,
      input: input,
      send: send,
      launcher: launcher,
    };

    applyUi(instance);
    renderMessages(instance);
    updateVisibility(instance);
    autoResizeInput(instance);

    addListener(instance, launcher, "click", function () {
      instance.state.hidden = false;
      instance.state.open = !instance.state.open;
      updateVisibility(instance);
      if (instance.state.open) {
        autoResizeInput(instance);
        input.focus();
      }
    });

    addListener(instance, close, "click", function () {
      instance.state.open = false;
      updateVisibility(instance);
    });

    addListener(instance, reset, "click", function () {
      instance.state.chatId = null;
      instance.state.messages = [];
      renderMessages(instance);
      input.value = "";
      autoResizeInput(instance);
      input.focus();
    });

    addListener(instance, form, "submit", function (event) {
      event.preventDefault();
      void sendMessage(instance, input.value);
    });

    addListener(instance, input, "input", function () {
      autoResizeInput(instance);
    });
  }

  async function loadRemoteConfig(instance) {
    if (!instance.config.projeto || !instance.config.agente || !instance.config.apiBase) {
      return;
    }

    var controller = new AbortController();
    addAbortController(instance, controller);

    try {
      var params = new URLSearchParams({
        projeto: instance.config.projeto,
        agente: instance.config.agente,
      });
      var response = await fetch(instance.config.apiBase + "/api/chat/config?" + params.toString(), {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        return;
      }

      var payload = await response.json();
      instance.state.ui = mergeDeep(instance.state.ui, payload.ui || {});
      applyUi(instance);
    } catch (error) {
      if (!error || error.name !== "AbortError") {
        console.warn("[InfraStudio Chat] failed to load remote config.", error);
      }
    }
  }

  async function sendMessage(instance, text) {
    var trimmed = String(text || "").trim();
    if (!trimmed || instance.state.loading || !instance.config.apiBase) {
      return;
    }

    instance.state.messages.push({ id: "user-" + Date.now(), text: trimmed, isAi: false });
    instance.refs.input.value = "";
    renderMessages(instance);
    setLoading(instance, true);

    var controller = new AbortController();
    addAbortController(instance, controller);

    try {
      var response = await fetch(instance.config.apiBase + "/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: instance.state.chatId,
          message: trimmed,
          projeto: instance.config.projeto,
          agente: instance.config.agente,
          context: mergeDeep(instance.state.context, {
            channel: mergeDeep({ kind: "external_widget" }, instance.state.context.channel || {}),
            ui: mergeDeep({ structured_response: true }, instance.state.context.ui || {}),
          }),
        }),
        signal: controller.signal,
      });

      var payload = await response.json();
      if (payload.chatId) {
        instance.state.chatId = payload.chatId;
      }

      instance.state.messages.push({
        id: "ai-" + Date.now(),
        text: payload.reply || payload.error || "Nao consegui responder agora.",
        isAi: true,
        cta: null,
        assets: Array.isArray(payload.assets) ? payload.assets : [],
      });

      if (payload.whatsapp && payload.whatsapp.url) {
        var whatsappMessage = createWhatsAppMessage(payload.whatsapp);
        if (whatsappMessage) {
          instance.state.messages.push(whatsappMessage);
        }
      }
    } catch (error) {
      if (!error || error.name !== "AbortError") {
        instance.state.messages.push({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
          assets: [],
        });
      }
    } finally {
      setLoading(instance, false);
      renderMessages(instance);
    }
  }

  function resetRuntime() {
    runtime.instance = null;
    runtime.blockedReason = null;
  }

  function normalizeConfig(input) {
    var config = isRecord(input) ? input : {};
    return {
      projeto: typeof config.projeto === "string" && config.projeto.trim() ? config.projeto.trim() : defaults.projeto,
      agente: typeof config.agente === "string" && config.agente.trim() ? config.agente.trim() : defaults.agente,
      apiBase: typeof config.apiBase === "string" && config.apiBase.trim() ? config.apiBase.trim() : defaults.apiBase,
      context: isRecord(config.context) ? clone(config.context) : {},
      ui: isRecord(config.ui) ? clone(config.ui) : {},
      policy: isRecord(config.policy) ? clone(config.policy) : {},
      open: Boolean(config.open),
      hidden: Boolean(config.hidden),
      currentRoute: typeof config.currentRoute === "string" ? config.currentRoute : null,
      strictHostControl: config.strictHostControl !== false,
    };
  }

  function destroy(reason, detail) {
    var instance = runtime.instance;
    if (!instance) {
      emitLifecycle("destroyed", mergeDeep({ reason: reason || "no_instance" }, detail || {}));
      return true;
    }

    instance.timers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });

    instance.disposers.slice().reverse().forEach(function (dispose) {
      try {
        dispose();
      } catch (error) {
        console.warn("[InfraStudio Chat] cleanup failed.", error);
      }
    });

    instance.observers.forEach(function (observer) {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn("[InfraStudio Chat] observer cleanup failed.", error);
      }
    });

    if (instance.refs.host && instance.refs.host.parentNode) {
      instance.refs.host.parentNode.removeChild(instance.refs.host);
    }

    resetRuntime();
    emitLifecycle("destroyed", mergeDeep({ reason: reason || "host_destroy" }, detail || {}));
    return true;
  }

  function mount(configInput) {
    var config = normalizeConfig(configInput);
    if (!config.projeto || !config.agente) {
      console.warn("[InfraStudio Chat] projeto and agente are required.");
      return false;
    }

    var policy = evaluatePolicy(config, config.context);
    if (!policy.allowed) {
      destroy(policy.reason, { route: policy.route });
      runtime.blockedReason = policy.reason;
      emitLifecycle(policy.reason, {
        route: policy.route,
        projeto: config.projeto,
        agente: config.agente,
      });
      return false;
    }

    if (runtime.instance) {
      destroy("remount");
    }

    runtime.strictHostControl = config.strictHostControl;
    runtime.blockedReason = null;
    runtime.instance = createInstance(config);
    mountDom(runtime.instance);
    void loadRemoteConfig(runtime.instance);

    emitLifecycle("mounted", {
      projeto: config.projeto,
      agente: config.agente,
      route: policy.route,
      strictHostControl: config.strictHostControl,
    });
    return true;
  }

  function updateContext(nextContext) {
    if (!runtime.instance || !isRecord(nextContext)) {
      return false;
    }

    var instance = runtime.instance;
    var mergedContext = mergeDeep(instance.state.context, nextContext);
    var nextConfig = mergeDeep(instance.config, {
      context: mergedContext,
      policy: isRecord(nextContext.policy) ? nextContext.policy : instance.config.policy,
      currentRoute: typeof nextContext.currentRoute === "string" ? nextContext.currentRoute : instance.config.currentRoute,
    });

    var policy = evaluatePolicy(nextConfig, mergedContext);
    if (!policy.allowed) {
      destroy(policy.reason, { route: policy.route });
      runtime.blockedReason = policy.reason;
      emitLifecycle(policy.reason, {
        route: policy.route,
        projeto: nextConfig.projeto,
        agente: nextConfig.agente,
      });
      return false;
    }

    instance.config = nextConfig;
    instance.state.context = mergedContext;

    if (typeof nextContext.hidden === "boolean") {
      instance.state.hidden = nextContext.hidden;
    }

    if (typeof nextContext.open === "boolean") {
      instance.state.open = nextContext.open;
    }

    if (isRecord(nextContext.ui)) {
      instance.state.ui = mergeDeep(instance.state.ui, nextContext.ui);
      applyUi(instance);
    }

    updateVisibility(instance);
    emitLifecycle("context_updated", {
      route: policy.route,
      projeto: nextConfig.projeto,
      agente: nextConfig.agente,
    });
    return true;
  }

  function hide() {
    if (!runtime.instance) {
      return false;
    }

    runtime.instance.state.open = false;
    runtime.instance.state.hidden = true;
    updateVisibility(runtime.instance);
    emitLifecycle("hidden", {
      projeto: runtime.instance.config.projeto,
      agente: runtime.instance.config.agente,
    });
    return true;
  }

  function getState() {
    var instance = runtime.instance;
    return {
      mounted: Boolean(instance),
      hidden: instance ? instance.state.hidden : true,
      open: instance ? instance.state.open : false,
      loading: instance ? instance.state.loading : false,
      chatId: instance ? instance.state.chatId : null,
      strictHostControl: runtime.strictHostControl,
      blockedReason: runtime.blockedReason,
      context: instance ? clone(instance.state.context) : {},
      config: instance ? clone(instance.config) : null,
      logs: runtime.logs.slice(),
    };
  }

  function enqueue(type, payload) {
    queue.push({ type: type, payload: payload });
  }

  function flushQueue() {
    while (queue.length) {
      var command = queue.shift();
      if (!command) {
        continue;
      }

      if (command.type === "mount") {
        mount(command.payload);
      } else if (command.type === "updateContext" || command.type === "setContext") {
        updateContext(command.payload);
      } else if (command.type === "hide") {
        hide();
      } else if (command.type === "destroy") {
        destroy("queued_destroy");
      }
    }
  }

  window.InfraChat = {
    __queue: queue,
    mount: function (config) {
      return mount(config);
    },
    updateContext: function (context) {
      if (!runtime.instance) {
        enqueue("updateContext", context);
        return false;
      }
      return updateContext(context);
    },
    hide: function () {
      if (!runtime.instance) {
        enqueue("hide");
        return false;
      }
      return hide();
    },
    destroy: function () {
      queue.length = 0;
      return destroy("host_destroy");
    },
    isMounted: function () {
      return Boolean(runtime.instance);
    },
    getState: function () {
      return getState();
    },
    setContext: function (context) {
      if (!runtime.instance) {
        enqueue("setContext", context);
        return false;
      }
      return updateContext(context);
    },
  };

  flushQueue();
})();
