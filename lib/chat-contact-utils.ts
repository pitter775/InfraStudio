import "server-only";

export function extractPhone(message: string) {
  const digits = message.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export function extractName(message: string, normalizeText: (value: string) => string) {
  const match = message.match(/(?:meu nome(?: e| eh)?|sou o|sou a)\s+([a-zà-ú ]{3,})/i);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  const normalizedOnlyText = message
    .replace(/\+?\d[\d\s().-]{7,}\d/g, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedOnlyText) {
    const lower = normalizeText(normalizedOnlyText);
    const blocked = new Set([
      "quero",
      "preciso",
      "orcamento",
      "site",
      "whatsapp",
      "agenda",
      "sistema",
      "atendimento",
      "integracao",
      "crm",
      "bom dia",
      "boa tarde",
      "boa noite",
      "oi",
      "ola",
      "opa",
      "sim",
      "nao",
    ]);
    const words = normalizedOnlyText.split(/\s+/).filter(Boolean);

    if (
      words.length >= 1 &&
      words.length <= 3 &&
      words.every((word) => word.length >= 2) &&
      !blocked.has(lower) &&
      /^[\p{L}][\p{L}\s'-]+$/u.test(normalizedOnlyText)
    ) {
      const formattedName = words.map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ");

      if (formattedName.length >= 3) {
        return formattedName;
      }
    }
  }

  if (!extractPhone(message)) {
    return null;
  }

  const candidate = message
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .replace(/\b(?:meu|nome|e|eh|sou|o|a|telefone|fone|celular|zap|whatsapp|ddd|com)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || !/^[\p{L}][\p{L}' -]*$/u.test(candidate)) {
    return null;
  }

  const words = candidate.split(/\s+/).filter((word) => word.length >= 2);
  if (words.length === 0 || words.length > 4) {
    return null;
  }

  return words.join(" ");
}
