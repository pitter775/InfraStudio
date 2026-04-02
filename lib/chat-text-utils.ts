import type { ConversationContext } from "@/lib/chat-context";

export function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isWhatsAppChannel(context?: ConversationContext) {
  return (context?.channel?.kind ?? "").trim().toLowerCase() === "whatsapp";
}

export function singularizeToken(token: string) {
  if (token.endsWith("oes")) {
    return `${token.slice(0, -3)}ao`;
  }

  if (token.endsWith("ais")) {
    return `${token.slice(0, -3)}al`;
  }

  if (token.endsWith("eis")) {
    return `${token.slice(0, -3)}el`;
  }

  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

export function buildSearchTokens(message: string) {
  const stopwords = new Set([
    "qual",
    "quais",
    "qualis",
    "como",
    "sobre",
    "do",
    "da",
    "dos",
    "das",
    "de",
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "me",
    "no",
    "na",
    "projeto",
    "imovel",
    "esse",
    "essa",
    "este",
    "esta",
  ]);

  const tokens = normalizeText(message)
    .split(/\W+/)
    .filter((token) => token.length >= 3 && !stopwords.has(token));

  return [
    ...new Set(
      tokens
        .flatMap((token) => [token, singularizeToken(token)])
        .filter(Boolean),
    ),
  ];
}

export function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 0; i < left.length; i += 1) {
    current[0] = i + 1;

    for (let j = 0; j < right.length; j += 1) {
      const insertion = current[j] + 1;
      const deletion = previous[j + 1] + 1;
      const substitution = previous[j] + (left[i] === right[j] ? 0 : 1);
      current[j + 1] = Math.min(insertion, deletion, substitution);
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}
