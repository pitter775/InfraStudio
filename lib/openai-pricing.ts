import "server-only";

const DEFAULT_MODEL = "gpt-4o-mini";

type ModelPricing = {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
  },
};

function normalizeModel(model?: string | null) {
  const normalized = String(model ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^gpt4o-mini$/, "gpt-4o-mini")
    .replace(/^gpt-4omini$/, "gpt-4o-mini");

  return normalized || DEFAULT_MODEL;
}

export function getDefaultOpenAIModel() {
  return DEFAULT_MODEL;
}

export function resolvePricingModel(model?: string | null) {
  const normalized = normalizeModel(model);
  return MODEL_PRICING[normalized] ? normalized : DEFAULT_MODEL;
}

export function estimateOpenAICostUsd(inputTokens: number, outputTokens: number, model?: string | null) {
  const resolvedModel = resolvePricingModel(model);
  const pricing = MODEL_PRICING[resolvedModel];
  const safeInput = Math.max(0, Number(inputTokens) || 0);
  const safeOutput = Math.max(0, Number(outputTokens) || 0);

  const total =
    (safeInput / 1_000_000) * pricing.inputPerMillionUsd +
    (safeOutput / 1_000_000) * pricing.outputPerMillionUsd;

  return Number(total.toFixed(8));
}
