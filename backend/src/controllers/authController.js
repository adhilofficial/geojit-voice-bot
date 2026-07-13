const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
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

function getAuthConfiguration() {
  const adminEmail = String(
    process.env.ADMIN_EMAIL || ""
  )
    .trim()
    .toLowerCase();
  const passwordHash = String(
    process.env.ADMIN_PASSWORD_HASH || ""
  ).trim();
  const jwtSecret = String(
    process.env.JWT_SECRET || ""
  ).trim();
  const expiresIn = String(
    process.env.JWT_EXPIRES_IN || "8h"
  ).trim();

  if (!adminEmail || !passwordHash || !jwtSecret) {
    const error = new Error(
      "Admin authentication is not configured on the server"
    );
    error.code = "AUTH_NOT_CONFIGURED";
    throw error;
  }

  return {
    adminEmail,
    passwordHash,
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

    const { adminEmail, passwordHash, jwtSecret, expiresIn } =
      getAuthConfiguration();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const emailMatches = email === adminEmail;
    const passwordMatches = await bcrypt.compare(
      password,
      emailMatches ? passwordHash : DUMMY_PASSWORD_HASH
    );

    if (!emailMatches || !passwordMatches) {
      attempt.count += 1;
      loginAttempts.set(key, attempt);

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    loginAttempts.delete(key);

    const token = jwt.sign(
      {
        email: adminEmail,
        role: "admin",
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

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      expiresAt: decoded?.exp
        ? new Date(decoded.exp * 1000).toISOString()
        : null,
      admin: {
        email: adminEmail,
        role: "admin",
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
};
