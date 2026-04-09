"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChatLayoutProps = {
  header?: ReactNode;
  children: ReactNode;
  input: ReactNode;
  className?: string;
  messagesClassName?: string;
  inputClassName?: string;
  viewportMode?: "full";
};

export function ChatLayout({
  header,
  children,
  input,
  className,
  messagesClassName,
  inputClassName,
  viewportMode,
}: ChatLayoutProps) {
  return (
    <div
      data-chat-viewport={viewportMode === "full" ? "full" : undefined}
      className={cn("infra-chat-layout-root", className)}
    >
      {header}
      <div className={cn("infra-chat-layout-messages", messagesClassName)}>{children}</div>
      <div className={cn("infra-chat-layout-input", inputClassName)}>{input}</div>
    </div>
  );
}
