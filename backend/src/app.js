const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const leadRoutes = require("./routes/leadRoutes");
const callRoutes = require("./routes/callRoutes");
const liveCallRoutes = require("./routes/liveCallRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const authRoutes = require("./routes/authRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const requireAuth = require("./middleware/requireAuth");

const app = express();

function getAllowedOrigins() {
  const configuredOrigins = String(
    process.env.CLIENT_URL || "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return new Set(configuredOrigins);
}

const allowedOrigins = getAllowedOrigins();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = origin?.replace(/\/+$/, "");

      if (!origin || allowedOrigins.has(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    skip(req) {
      return req.path.startsWith("/api/webhooks/exotel/");
    },
  })
);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot backend is running",
    health: "/api/health",
    leads: "/api/leads",
    login: "/api/auth/login",
    liveCalls: "/api/live-calls/:leadId/start",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot API is working",
    callProvider: process.env.CALL_PROVIDER || "mock",
    authConfigured: Boolean(
      process.env.ADMIN_EMAIL &&
        process.env.ADMIN_PASSWORD_HASH &&
        process.env.JWT_SECRET
    ),
    exotelConfigured: Boolean(
      process.env.EXOTEL_ACCOUNT_SID &&
        process.env.EXOTEL_API_KEY &&
        process.env.EXOTEL_API_TOKEN &&
        process.env.EXOTEL_SUBDOMAIN &&
        process.env.EXOTEL_CALLER_ID &&
        process.env.EXOTEL_FLOW_ID &&
        process.env.PUBLIC_BACKEND_URL
    ),
  });
});

// Public routes: login, health and Exotel callbacks.
app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);

// All business APIs below this point require an administrator token.
app.use("/api", requireAuth);
app.use("/api/leads", leadRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/live-calls", liveCallRoutes);
app.use("/api/activity-logs", activityLogRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((error, req, res, _next) => {
  console.error("Application error:", error);

  if (error.message === "Only CSV files are allowed") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "CSV file must be smaller than 5 MB",
    });
  }

  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

module.exports = app;
