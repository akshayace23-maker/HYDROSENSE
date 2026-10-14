// launcher.js - lets HydroSense be deployed from just 3 flat files
// (package.json, launcher.js, hydrosense-app.zip), so no folder structure
// needs to survive a browser upload to GitHub.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const ROOT = __dirname;
const APP = path.join(ROOT, "app");
const BACKEND = path.join(APP, "backend");

function setup() {
  const AdmZip = require("adm-zip");
  fs.rmSync(APP, { recursive: true, force: true });
  new AdmZip(path.join(ROOT, "hydrosense-app.zip")).extractAllTo(APP, true);
  console.log("[launcher] app unpacked to", APP);
  execSync("npm install --omit=dev --no-audit --no-fund", { cwd: BACKEND, stdio: "inherit" });
  console.log("[launcher] backend dependencies installed");
}

function start() {
  if (!fs.existsSync(path.join(BACKEND, "server.js"))) setup();
  process.chdir(BACKEND);
  require(path.join(BACKEND, "server.js"));
}

const cmd = process.argv[2];
if (cmd === "setup") setup();
else if (cmd === "start") start();
else { console.log("usage: node launcher.js setup|start"); process.exit(1); }
