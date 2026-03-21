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

  function createButtonIcon(type) {
    if (type === "close") {
      return "X";
    }

    if (type === "reset") {
      return "R";
    }

    if (type === "send") {
      return ">";
    }

    return "Chat";
  }

  function applyUi(instance) {
    var refs = instance.refs;
    var ui = instance.state.ui;
    var light = ui.theme === "light";
    refs.root.style.setProperty("--chat-accent", ui.accent);
    refs.root.style.setProperty("--chat-bg", light ? (ui.transparent ? "rgba(255,255,255,.92)" : "#ffffff") : (ui.transparent ? "rgba(9,16,34,.96)" : "#08101f"));
    refs.root.style.setProperty("--chat-text", light ? "#0f172a" : "#e2e8f0");
    refs.root.style.setProperty("--chat-muted", light ? "#475569" : "#94a3b8");
    refs.root.style.setProperty("--chat-surface", light ? "rgba(241,245,249,.9)" : "rgba(15,23,42,.72)");
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

      refs.stack.appendChild(bubble);
    });

    if (instance.state.loading) {
      var typing = document.createElement("div");
      typing.className = "chat-bubble ai";
      typing.textContent = "Atendente esta digitando...";
      refs.stack.appendChild(typing);
    }

    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  function updateVisibility(instance) {
    instance.refs.host.style.display = instance.state.hidden ? "none" : "";
    instance.refs.panel.hidden = !instance.state.open;
    instance.refs.launcher.textContent = createButtonIcon(instance.state.open ? "close" : "chat");
  }

  function setLoading(instance, loading) {
    instance.state.loading = loading;
    instance.refs.input.readOnly = loading;
    instance.refs.send.disabled = loading;
    instance.refs.input.placeholder = loading ? "Atendente esta digitando..." : "Digite sua mensagem...";
    renderMessages(instance);
  }

  function mountDom(instance) {
    var host = document.createElement("div");
    var root = document.createElement("div");
    var panel = document.createElement("div");
    var header = document.createElement("div");
    var title = document.createElement("div");
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
    title.className = "chat-title";
    actions.className = "chat-actions";
    reset.type = "button";
    reset.className = "chat-action";
    reset.textContent = createButtonIcon("reset");
    close.type = "button";
    close.className = "chat-action";
    close.textContent = createButtonIcon("close");
    messages.className = "chat-messages";
    stack.className = "chat-stack";
    form.className = "chat-form";
    input.className = "chat-input";
    input.rows = 1;
    input.placeholder = "Digite sua mensagem...";
    send.type = "submit";
    send.className = "chat-send";
    send.textContent = createButtonIcon("send");
    launcher.type = "button";
    launcher.className = "chat-launcher";
    launcher.textContent = createButtonIcon("chat");

    var style = document.createElement("style");
    style.textContent = ".chat-root{position:fixed;right:24px;bottom:24px;z-index:2147483000;font-family:Inter,Arial,sans-serif;--chat-accent:#2563eb;--chat-bg:rgba(9,16,34,.96);--chat-text:#e2e8f0;--chat-muted:#94a3b8;--chat-surface:rgba(15,23,42,.72)}.chat-panel{width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 100px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:26px;background:var(--chat-bg);color:var(--chat-text);box-shadow:0 24px 70px rgba(2,6,23,.45);backdrop-filter:blur(14px);margin-bottom:16px}.chat-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)}.chat-title{font-size:16px;font-weight:700}.chat-actions{display:flex;gap:8px}.chat-action,.chat-send,.chat-launcher{border:0;border-radius:999px;cursor:pointer}.chat-action{width:34px;height:34px;background:rgba(255,255,255,.06);color:var(--chat-text)}.chat-messages{flex:1;overflow:auto;padding:16px;background:rgba(2,6,23,.14)}.chat-stack{display:flex;flex-direction:column;gap:12px}.chat-bubble{max-width:88%;border-radius:18px;padding:12px 14px;font-size:14px;line-height:1.6}.chat-bubble.ai{background:var(--chat-surface);color:var(--chat-text);border-bottom-left-radius:6px}.chat-bubble.user{margin-left:auto;background:var(--chat-accent);color:#fff;border-bottom-right-radius:6px}.chat-rich p,.chat-rich ul,.chat-rich ol{margin:0}.chat-rich p+p,.chat-rich p+ul,.chat-rich p+ol,.chat-rich ul+p,.chat-rich ol+p{margin-top:10px}.chat-rich ul,.chat-rich ol{padding-left:20px}.chat-form{display:flex;gap:10px;padding:16px;border-top:1px solid rgba(255,255,255,.08)}.chat-input{flex:1;min-height:46px;max-height:120px;resize:vertical;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(2,6,23,.34);color:var(--chat-text);padding:11px 14px;font:inherit}.chat-send{width:46px;height:46px;background:var(--chat-accent);color:#fff}.chat-launcher{display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;background:var(--chat-accent);color:#fff;box-shadow:0 20px 40px rgba(2,6,23,.45)}.chat-cta{display:inline-flex;margin-top:10px;border-radius:999px;background:rgba(37,99,235,.18);color:#fff;padding:7px 11px;font-size:11px;font-weight:700;text-decoration:none}@media (max-width:640px){.chat-root{right:12px;left:12px;bottom:12px}.chat-panel{width:100%;height:min(70vh,560px)}}";

    actions.appendChild(reset);
    actions.appendChild(close);
    header.appendChild(title);
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

    addListener(instance, launcher, "click", function () {
      instance.state.hidden = false;
      instance.state.open = !instance.state.open;
      updateVisibility(instance);
    });

    addListener(instance, close, "click", function () {
      instance.state.open = false;
      updateVisibility(instance);
    });

    addListener(instance, reset, "click", function () {
      instance.state.chatId = null;
      instance.state.messages = [];
      renderMessages(instance);
      input.focus();
    });

    addListener(instance, form, "submit", function (event) {
      event.preventDefault();
      void sendMessage(instance, input.value);
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
