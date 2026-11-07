import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(resolve(root, "server/package.json"));
require("dotenv").config({ path: resolve(root, ".env") });
const env = {
  ...process.env,
  SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
};
const children = [
  spawn(
    process.execPath,
    [resolve(root, "server/node_modules/tsx/dist/cli.mjs"), "watch", "src/server.ts"],
    {
      cwd: resolve(root, "server"),
      env,
      stdio: "inherit",
    },
  ),
  spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "dev"], {
    cwd: root,
    env,
    stdio: "inherit",
  }),
];

let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Could not start the development services:", error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
