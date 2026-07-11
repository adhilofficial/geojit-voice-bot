function normalizePhone(phone) {
  if (!phone) {
    return null;
  }

  let digits = String(phone).replace(/\D/g, "");

  // Indian number without country code
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Indian number starting with zero
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  // Indian number with country code
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return null;
}

module.exports = normalizePhone;