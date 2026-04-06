const fs = require("fs");
const { execSync } = require("child_process");

execSync("npm run build", { stdio: "inherit" });

if (fs.existsSync("client/dist")) {
  fs.rmSync("dist", { recursive: true, force: true });
  fs.cpSync("client/dist", "dist", { recursive: true });
} else if (!fs.existsSync("dist")) {
  throw new Error("Build output not found. Expected client/dist or dist");
}
