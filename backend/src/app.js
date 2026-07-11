const callRoutes = require("./routes/callRoutes");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const leadRoutes = require("./routes/leadRoutes");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot API is working",
  });
});

app.use("/api/leads", leadRoutes);
app.use("/api/calls", callRoutes);

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

  return res.status(500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Geojit Voice Bot backend is running",
    health: "/api/health",
    leads: "/api/leads",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

module.exports = app;