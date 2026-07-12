const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const leadRoutes = require("./routes/leadRoutes");
const callRoutes = require("./routes/callRoutes");
const liveCallRoutes = require("./routes/liveCallRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();

function getAllowedOrigins() {
  const configuredOrigins = String(
    process.env.CLIENT_URL || "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configuredOrigins);
}

const allowedOrigins = getAllowedOrigins();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot backend is running",
    health: "/api/health",
    leads: "/api/leads",
    liveCalls: "/api/live-calls/:leadId/start",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot API is working",
    callProvider: process.env.CALL_PROVIDER || "mock",
    exotelConfigured: Boolean(
      process.env.EXOTEL_ACCOUNT_SID &&
        process.env.EXOTEL_API_KEY &&
        process.env.EXOTEL_API_TOKEN &&
        process.env.EXOTEL_SUBDOMAIN &&
        process.env.EXOTEL_CALLER_ID &&
        process.env.EXOTEL_FLOW_ID
    ),
  });
});

app.use("/api/leads", leadRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/live-calls", liveCallRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((error, req, res, next) => {
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
