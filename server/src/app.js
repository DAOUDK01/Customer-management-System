const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const itemRoutes = require("./routes/itemRoutes");
const stockRoutes = require("./routes/stockRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const healthRoutes = require("./routes/healthRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins =
  process.env.NODE_ENV === "production" && process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim())
    : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/salaries", salaryRoutes);

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientBuildPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
