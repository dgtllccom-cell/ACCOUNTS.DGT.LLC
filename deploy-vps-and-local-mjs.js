// Wrapper so "node deploy-vps-and-local-mjs" works whether typed with dash or dot
import('./deploy-vps-and-local.mjs').catch((err) => {
  console.error("Deploy wrapper error:", err);
  process.exit(1);
});
