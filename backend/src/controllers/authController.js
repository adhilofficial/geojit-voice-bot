const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logActivity } = require("../utils/activityLogger");

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_NUMBERED_ADMINS = 20;
const loginAttempts = new Map();
const DUMMY_PASSWORD_HASH =
  "$2b$12$SPOQpzAnyZTHSmG15IKoTuSx22m2CVN491lt/8MseTOeoLnSM/S4y";

function getClientKey(req) {
  return String(
    req.ip ||
      req.get("x-forwarded-for") ||
      req.socket?.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim();
}

function getAttemptRecord(key) {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || now - current.startedAt >= LOGIN_WINDOW_MS) {
    const fresh = {
      count: 0,
      startedAt: now,
    };

    loginAttempts.set(key, fresh);
    return fresh;
  }

  return current;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeHash(value) {
  return String(value || "").trim();
}

function createConfigurationError(message) {
  const error = new Error(message);
  error.code = "AUTH_NOT_CONFIGURED";
  return error;
}

function collectAdminUsers() {
  const users = [];
  const seenEmails = new Set();

  function addAdmin(emailValue, passwordHashValue, label) {
    const email = normalizeEmail(emailValue);
    const passwordHash = normalizeHash(passwordHashValue);

    if (!email && !passwordHash) {
      return;
    }

    if (!email || !passwordHash) {
      throw createConfigurationError(
        `${label} requires both an email and a password hash`
      );
    }

    if (seenEmails.has(email)) {
      throw createConfigurationError(
        `Duplicate administrator email configured: ${email}`
      );
    }

    seenEmails.add(email);
    users.push({
      email,
      passwordHash,
      role: "admin",
    });
  }

  // Primary administrator. These names are kept for backward compatibility.
  addAdmin(
    process.env.ADMIN_EMAIL,
    process.env.ADMIN_PASSWORD_HASH,
    "Primary administrator"
  );

  // Additional administrators use numbered environment-variable pairs.
  for (let index = 2; index <= MAX_NUMBERED_ADMINS; index += 1) {
    addAdmin(
      process.env[`ADMIN_EMAIL_${index}`],
      process.env[`ADMIN_PASSWORD_HASH_${index}`],
      `Administrator ${index}`
    );
  }

  if (users.length === 0) {
    throw createConfigurationError(
      "At least one administrator email and password hash must be configured"
    );
  }

  return users;
}

function getAuthConfiguration() {
  const adminUsers = collectAdminUsers();
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const expiresIn = String(
    process.env.JWT_EXPIRES_IN || "8h"
  ).trim();

  if (!jwtSecret) {
    throw createConfigurationError(
      "JWT_SECRET is required for administrator authentication"
    );
  }

  return {
    adminUsers,
    jwtSecret,
    expiresIn,
  };
}

function sendNoStore(res) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
}

async function login(req, res) {
  sendNoStore(res);

  try {
    const key = getClientKey(req);
    const attempt = getAttemptRecord(key);

    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (LOGIN_WINDOW_MS - (Date.now() - attempt.startedAt)) /
            1000
        )
      );

      res.set("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        success: false,
        message:
          "Too many login attempts. Please try again later.",
      });
    }

    const { adminUsers, jwtSecret, expiresIn } =
      getAuthConfiguration();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      await logActivity(req, {
        adminEmail: email || "unknown",
        action: "admin_login",
        category: "auth",
        result: "failed",
        description: "Administrator login failed because credentials were incomplete",
        metadata: {
          reason: "missing_credentials",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const matchedAdmin = adminUsers.find(
      (admin) => admin.email === email
    );

    // Always compare a hash so unknown emails do not return faster.
    const passwordMatches = await bcrypt.compare(
      password,
      matchedAdmin?.passwordHash || DUMMY_PASSWORD_HASH
    );

    if (!matchedAdmin || !passwordMatches) {
      attempt.count += 1;
      loginAttempts.set(key, attempt);

      await logActivity(req, {
        adminEmail: email,
        action: "admin_login",
        category: "auth",
        result: "failed",
        description: `Failed login attempt for ${email}`,
        metadata: {
          reason: "invalid_credentials",
          attemptCount: attempt.count,
        },
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    loginAttempts.delete(key);

    const token = jwt.sign(
      {
        email: matchedAdmin.email,
        role: matchedAdmin.role,
      },
      jwtSecret,
      {
        algorithm: "HS256",
        expiresIn,
        issuer: "geojit-voice-bot-api",
        audience: "geojit-voice-bot-dashboard",
        subject: "admin",
      }
    );

    const decoded = jwt.decode(token);

    await logActivity(req, {
      adminEmail: matchedAdmin.email,
      action: "admin_login",
      category: "auth",
      description: `Administrator ${matchedAdmin.email} signed in`,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      expiresAt: decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : null,
      admin: {
        email: matchedAdmin.email,
        role: matchedAdmin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error.message);

    if (error.code === "AUTH_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete login",
    });
  }
}

async function logout(req, res) {
  sendNoStore(res);

  await logActivity(req, {
    action: "admin_logout",
    category: "auth",
    description: `Administrator ${req.admin.email} signed out`,
  });

  return res.status(200).json({
    success: true,
    message: "Logout recorded",
  });
}

function getCurrentAdmin(req, res) {
  sendNoStore(res);

  return res.status(200).json({
    success: true,
    admin: {
      email: req.admin.email,
      role: req.admin.role,
    },
    expiresAt: req.admin.exp
      ? new Date(req.admin.exp * 1000).toISOString()
      : null,
  });
}

module.exports = {
  getCurrentAdmin,
  login,
  logout,
};
