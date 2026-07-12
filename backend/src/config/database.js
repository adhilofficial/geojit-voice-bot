const mongoose = require("mongoose");

async function connectDatabase() {
  const mongoUri = String(process.env.MONGODB_URI || "").trim();

  if (!mongoUri) {
    throw new Error("Missing environment variable: MONGODB_URI");
  }

  const connection = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log(
    `MongoDB connected: ${connection.connection.host}`
  );

  return connection;
}

module.exports = connectDatabase;
