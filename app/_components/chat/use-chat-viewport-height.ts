"use client";

import { useEffect } from "react";

export function useChatViewportHeight(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const updateHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${Math.round(vh)}px`);
    };

    updateHeight();

    window.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("scroll", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("scroll", updateHeight);
    };
  }, [enabled]);
}
