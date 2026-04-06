const fs = require("fs");
const { execSync } = require("child_process");

execSync("npm run build", { stdio: "inherit" });

if (!fs.existsSync("dist/index.html")) {
  throw new Error("Build output not found. Expected dist/index.html");
}
