const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const jwtSecret = String(
    process.env.JWT_SECRET || ""
  ).trim();

  if (!jwtSecret) {
    return res.status(503).json({
      success: false,
      message: "Admin authentication is not configured",
    });
  }

  const authorization = String(
    req.get("authorization") || ""
  ).trim();
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required",
    });
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: "geojit-voice-bot-api",
      audience: "geojit-voice-bot-dashboard",
      subject: "admin",
    });

    if (payload.role !== "admin" || !payload.email) {
      throw new Error("Invalid administrator token");
    }

    req.admin = {
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };

    return next();
  } catch (error) {
    const expired = error.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message: expired
        ? "Your session has expired. Please sign in again."
        : "Your session is invalid. Please sign in again.",
    });
  }
}

module.exports = requireAuth;
