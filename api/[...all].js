const app = require("../server/src/app");
const connectDB = require("../server/src/config/db");

module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("API request failed:", error);
    res.status(500).json({ message: "Unable to process the request" });
  }
};
