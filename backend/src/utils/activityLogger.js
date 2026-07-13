const ActivityLog = require("../models/ActivityLog");

const blockedMetadataKeys = new Set([
  "password",
  "passwordhash",
  "token",
  "authorization",
  "secret",
  "apikey",
  "apitoken",
  "jwt",
]);

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getClientIp(req) {
  return normalizeText(
    req?.get?.("x-forwarded-for") ||
      req?.ip ||
      req?.socket?.remoteAddress
  )
    .split(",")[0]
    .trim();
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4 || value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value === "string") {
      return value.slice(0, 1000);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitized = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (blockedMetadataKeys.has(normalizedKey)) {
        continue;
      }

      const safeValue = sanitizeMetadata(nestedValue, depth + 1);

      if (safeValue !== undefined) {
        sanitized[key] = safeValue;
      }
    }

    return sanitized;
  }

  return String(value).slice(0, 1000);
}

async function logActivity(req, entry = {}) {
  try {
    const adminEmail = normalizeText(
      entry.adminEmail || req?.admin?.email,
      "system"
    ).toLowerCase();
    const action = normalizeText(entry.action, "unknown_action");
    const category = normalizeText(entry.category, "system");
    const result = entry.result === "failed" ? "failed" : "success";
    const description = normalizeText(
      entry.description,
      action.replaceAll("_", " ")
    ).slice(0, 500);

    return await ActivityLog.create({
      adminEmail,
      action,
      category,
      result,
      description,
      targetType: normalizeText(entry.targetType) || null,
      targetId: normalizeText(entry.targetId) || null,
      targetName: normalizeText(entry.targetName) || null,
      metadata: sanitizeMetadata(entry.metadata || {}) || {},
      ipAddress: getClientIp(req) || null,
      userAgent: normalizeText(req?.get?.("user-agent")).slice(0, 500) || null,
    });
  } catch (error) {
    console.warn("Unable to save admin activity log:", error.message);
    return null;
  }
}

module.exports = {
  logActivity,
  sanitizeMetadata,
};
