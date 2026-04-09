export function isDemoUser(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase().startsWith("demonstracao_");
}
