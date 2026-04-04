const BRAZIL_COUNTRY_CODE = "55";
const MAX_LOCAL_PHONE_DIGITS = 11;

function extractDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

export function getNormalizedBrazilPhoneLocalDigits(value: string | null | undefined) {
  let digits = extractDigits(value).replace(/^0+/, "");

  while (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > MAX_LOCAL_PHONE_DIGITS) {
    digits = digits.slice(BRAZIL_COUNTRY_CODE.length);
  }

  if (digits.length > MAX_LOCAL_PHONE_DIGITS) {
    digits = digits.slice(-MAX_LOCAL_PHONE_DIGITS);
  }

  return digits;
}

export function normalizeBrazilWhatsAppPhone(value: string | null | undefined) {
  const localDigits = getNormalizedBrazilPhoneLocalDigits(value);
  if (!localDigits) {
    return "";
  }

  return `${BRAZIL_COUNTRY_CODE}${localDigits}`;
}

export function formatBrazilWhatsAppPhone(value: string | null | undefined) {
  const digits = getNormalizedBrazilPhoneLocalDigits(value);

  if (!digits) {
    return "";
  }

  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  let formatted = `+${BRAZIL_COUNTRY_CODE}`;

  if (area) {
    formatted += ` ${area}`;
  }

  if (local) {
    if (local.length <= 4) {
      formatted += ` ${local}`;
    } else if (local.length <= 8) {
      formatted += ` ${local.slice(0, 4)}-${local.slice(4)}`;
    } else {
      formatted += ` ${local.slice(0, 5)}-${local.slice(5, 9)}`;
    }
  }

  return formatted;
}

export function formatBrazilWhatsAppPhoneInput(value: string | null | undefined) {
  const digits = getNormalizedBrazilPhoneLocalDigits(value);

  if (!digits) {
    return "";
  }

  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  let formatted = area;

  if (local) {
    if (local.length <= 4) {
      formatted += ` ${local}`;
    } else if (local.length <= 8) {
      formatted += ` ${local.slice(0, 4)}-${local.slice(4)}`;
    } else {
      formatted += ` ${local.slice(0, 5)}-${local.slice(5, 9)}`;
    }
  }

  return formatted.trim();
}

export function areSameBrazilWhatsAppPhone(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeBrazilWhatsAppPhone(left);
  const normalizedRight = normalizeBrazilWhatsAppPhone(right);

  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}
