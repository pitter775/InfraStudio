"use client";

import { useEffect, useId } from "react";

export function ExternalChatEmbed({
  projeto,
  agente,
  open,
}: {
  projeto: string;
  agente: string;
  open?: boolean;
}) {
  const mountTargetId = useId().replace(/:/g, "");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const infraChatWindow = window as Window & {
      InfraChat?: {
        mount: (config: Record<string, unknown>) => boolean;
        destroy: () => boolean;
      };
    };

    const scriptId = `infrastudio-embed-script-${projeto}-${agente}`;
    const mountWidget = () => {
      infraChatWindow.InfraChat?.mount({
        projeto,
        agente,
        apiBase: window.location.origin,
        strictHostControl: true,
        open,
        embedded: true,
        hideLauncher: true,
        target: `#${mountTargetId}`,
        context: {
          route: {
            path: window.location.pathname,
          },
        },
        policy: {
          allowed: true,
          allowedRoutes: [window.location.pathname],
        },
      });
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    if (!existingScript) {
      script.id = scriptId;
      script.src = `${window.location.origin}/chat.js`;
      script.async = true;
      script.setAttribute("data-projeto", projeto);
      script.setAttribute("data-agente", agente);
      script.addEventListener("load", mountWidget, { once: true });
      document.body.appendChild(script);
    } else if (infraChatWindow.InfraChat) {
      mountWidget();
    }

    return () => {
      infraChatWindow.InfraChat?.destroy();
      script.remove();
    };
  }, [agente, mountTargetId, open, projeto]);

  return <div id={mountTargetId} className="h-full min-h-0 w-full" />;
}
