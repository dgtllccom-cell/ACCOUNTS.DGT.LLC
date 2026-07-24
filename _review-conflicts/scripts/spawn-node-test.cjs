/* eslint-disable no-console */
const { spawn } = require("node:child_process");

console.log("parent execPath:", process.execPath);

const child = spawn(
  process.execPath,
  ["-e", 'console.log("child started"); process.exit(0);'],
  // Try with an IPC channel like `child_process.fork()` uses.
  { stdio: ["inherit", "inherit", "inherit", "ipc"] },
);

child.on("error", (err) => {
  console.error("child error:", err.code, err.message);
});

child.on("exit", (code, signal) => {
  console.log("child exit:", code, signal);
});
