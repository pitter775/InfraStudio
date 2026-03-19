(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  ready(function () {
    var script = document.currentScript;
    if (!script) {
      return;
    }

    var widgetSlug = script.getAttribute("data-widget");
    if (!widgetSlug) {
      console.warn("[InfraStudio Chat] data-widget is required.");
      return;
    }

    var widgetTitle = script.getAttribute("data-title") || "Chat";
    var apiBase = script.getAttribute("data-api-base") || new URL(script.src).origin;
    var theme = script.getAttribute("data-theme") === "light" ? "light" : "dark";
    var accent = script.getAttribute("data-accent") || "#2563eb";
    var transparent = script.getAttribute("data-transparent") !== "false";
    var storageKey = "infrastudio-chat-widget:" + widgetSlug;
    var chatId = null;
    var messages = [];
    var open = false;
    var loading = false;

    try {
      var stored = window.localStorage.getItem(storageKey);
      if (stored) {
        var parsed = JSON.parse(stored);
        chatId = typeof parsed.chatId === "string" ? parsed.chatId : null;
        messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      }
    } catch (error) {
      console.warn("[InfraStudio Chat] failed to restore conversation.", error);
    }

    var host = document.createElement("div");
    host.id = "infrastudio-chat-widget-root-" + widgetSlug;
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    var panelBackground = theme === "light"
      ? (transparent ? "rgba(255,255,255,0.88)" : "#ffffff")
      : (transparent ? "rgba(9, 16, 34, 0.96)" : "#08101f");
    var panelText = theme === "light" ? "#0f172a" : "#e2e8f0";
    var headerBorder = theme === "light" ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)";
    var subtleBg = theme === "light" ? "rgba(148,163,184,.08)" : "rgba(255,255,255,.04)";
    var surfaceBg = theme === "light" ? "rgba(248,250,252,.86)" : "rgba(2,6,23,.18)";
    var aiBubbleBg = theme === "light" ? "#f8fafc" : "rgba(30,41,59,.92)";
    var aiBubbleText = theme === "light" ? "#0f172a" : "#e2e8f0";
    var inputBg = theme === "light" ? "rgba(255,255,255,.92)" : "rgba(2,6,23,.45)";
    var inputText = theme === "light" ? "#0f172a" : "#ffffff";
    var shadowColor = theme === "light" ? "rgba(15,23,42,.18)" : "rgba(2,6,23,.45)";

    style.textContent = [
      ":host { all: initial; }",
      ".chat-wrap { position: fixed; right: 24px; bottom: 24px; z-index: 2147483000; font-family: Inter, Arial, sans-serif; }",
      ".chat-button { width: 60px; height: 60px; border: 0; border-radius: 999px; background: " + accent + "; color: white; font-size: 24px; cursor: pointer; box-shadow: 0 20px 40px " + shadowColor + "; }",
      ".chat-panel { width: min(380px, calc(100vw - 32px)); height: min(620px, calc(100vh - 110px)); display: none; flex-direction: column; overflow: hidden; border-radius: 26px; border: 1px solid " + headerBorder + "; background: " + panelBackground + "; color: " + panelText + "; box-shadow: 0 24px 70px " + shadowColor + "; backdrop-filter: blur(14px); margin-bottom: 16px; }",
      ".chat-panel.open { display: flex; }",
      ".chat-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid " + headerBorder + "; }",
      ".chat-title { font-size: 16px; font-weight: 700; color: " + panelText + "; }",
      ".chat-subtitle { margin-top: 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .08em; }",
      ".chat-reset, .chat-close { border: 1px solid " + headerBorder + "; background: " + subtleBg + "; color: #94a3b8; border-radius: 12px; cursor: pointer; }",
      ".chat-reset { padding: 8px 10px; font-size: 11px; font-weight: 600; }",
      ".chat-close { width: 36px; height: 36px; font-size: 16px; }",
      ".chat-messages { flex: 1; overflow-y: auto; padding: 16px; background: " + surfaceBg + "; }",
      ".chat-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".chat-bubble { max-width: 88%; border-radius: 18px; border: 1px solid " + headerBorder + "; padding: 12px 14px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }",
      ".chat-bubble.ai { background: " + aiBubbleBg + "; color: " + aiBubbleText + "; border-bottom-left-radius: 6px; }",
      ".chat-bubble.user { margin-left: auto; background: " + accent + "; color: white; border-color: " + accent + "; border-bottom-right-radius: 6px; }",
      ".chat-form { display: flex; gap: 10px; padding: 16px; border-top: 1px solid " + headerBorder + "; }",
      ".chat-input { flex: 1; min-height: 48px; max-height: 120px; resize: vertical; border-radius: 16px; border: 1px solid " + headerBorder + "; background: " + inputBg + "; color: " + inputText + "; padding: 12px 14px; font: inherit; }",
      ".chat-send { border: 0; border-radius: 16px; background: " + accent + "; color: white; min-width: 64px; padding: 0 16px; font-weight: 700; cursor: pointer; }",
      ".chat-send[disabled] { opacity: .6; cursor: wait; }",
      "@media (max-width: 640px) { .chat-wrap { right: 12px; bottom: 12px; } .chat-panel { width: calc(100vw - 24px); height: calc(100vh - 100px); } }",
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
    title.textContent = widgetTitle;
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

    var closeButton = document.createElement("button");
    closeButton.className = "chat-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
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
    form.appendChild(input);

    var sendButton = document.createElement("button");
    sendButton.className = "chat-send";
    sendButton.type = "submit";
    sendButton.textContent = "Enviar";
    form.appendChild(sendButton);

    var triggerButton = document.createElement("button");
    triggerButton.className = "chat-button";
    triggerButton.type = "button";
    triggerButton.textContent = "💬";
    wrap.appendChild(triggerButton);

    function persist() {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            chatId: chatId,
            messages: messages,
          }),
        );
      } catch (error) {
        console.warn("[InfraStudio Chat] failed to persist conversation.", error);
      }
    }

    function scrollToBottom() {
      messagesWrap.scrollTop = messagesWrap.scrollHeight;
    }

    function renderMessages() {
      stack.innerHTML = "";

      if (!messages.length) {
        var welcome = document.createElement("div");
        welcome.className = "chat-bubble ai";
        welcome.textContent = "Oi! Como posso te ajudar agora?";
        stack.appendChild(welcome);
      } else {
        messages.forEach(function (message) {
          var bubble = document.createElement("div");
          bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
          bubble.textContent = message.text;
          stack.appendChild(bubble);
        });
      }

      scrollToBottom();
    }

    function setOpen(nextOpen) {
      open = nextOpen;
      if (open) {
        panel.classList.add("open");
        input.focus();
      } else {
        panel.classList.remove("open");
      }
    }

    function setLoading(nextLoading) {
      loading = nextLoading;
      sendButton.disabled = nextLoading;
      sendButton.textContent = nextLoading ? "..." : "Enviar";
    }

    async function sendMessage(text) {
      var trimmed = String(text || "").trim();
      if (!trimmed || loading) {
        return;
      }

      messages.push({ id: "user-" + Date.now(), text: trimmed, isAi: false });
      persist();
      renderMessages();
      input.value = "";
      setLoading(true);

      try {
        var response = await fetch(apiBase + "/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: chatId,
            message: trimmed,
            widgetSlug: widgetSlug,
          }),
        });

        var payload = await response.json();
        if (payload.chatId) {
          chatId = payload.chatId;
        }

        messages.push({
          id: "ai-" + Date.now(),
          text: payload.reply || payload.error || "Nao consegui responder agora.",
          isAi: true,
        });
      } catch (error) {
        messages.push({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
        });
      } finally {
        persist();
        renderMessages();
        setLoading(false);
      }
    }

    triggerButton.addEventListener("click", function () {
      setOpen(!open);
    });

    window.addEventListener("infrastudio-chat:open", function (event) {
      var requestedWidget = event && event.detail ? event.detail.widgetSlug : null;
      if (requestedWidget && requestedWidget !== widgetSlug) {
        return;
      }

      setOpen(true);
    });

    closeButton.addEventListener("click", function () {
      setOpen(false);
    });

    resetButton.addEventListener("click", function () {
      chatId = null;
      messages = [];
      persist();
      renderMessages();
      input.focus();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      void sendMessage(input.value);
    });

    renderMessages();
  });
})();
