require("dotenv").config();

const mongoose = require("mongoose");

const app = require("./src/app");
const connectDatabase = require("./src/config/database");

const PORT = Number(process.env.PORT) || 5000;
let server;

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await mongoose.connection.close().catch(() => {});
  process.exit(0);
}

async function startServer() {
  try {
    await connectDatabase();

    server = app.listen(PORT, () => {
      console.log(
        `Geojit Voice Bot API running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

void startServer();
