const mongoose = require("mongoose");

const globalForMongoose = globalThis;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!globalForMongoose.__mongooseConnectPromise) {
    globalForMongoose.__mongooseConnectPromise = mongoose.connect(
      process.env.MONGODB_URI,
    );
  }

  await globalForMongoose.__mongooseConnectPromise;
  return mongoose.connection;
}

module.exports = connectDB;
