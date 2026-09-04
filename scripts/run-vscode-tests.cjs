const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixtureTemplate = path.join(root, "src", "test", "fixtures", "lsp-workspace");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-vscode-test-"));
const workspace = path.join(testRoot, "workspace");
const userDataDir = path.join(testRoot, "u");
let cleaned = false;

function cleanup() {
  if (cleaned) {
    return;
  }
  cleaned = true;
  fs.rmSync(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    cleanup();
    process.exit(128);
  });
}

try {
  fs.cpSync(fixtureTemplate, workspace, { recursive: true });
  fs.mkdirSync(path.join(workspace, "node_modules"), { recursive: true });
  fs.cpSync(
    path.join(root, "node_modules", "@dprint"),
    path.join(workspace, "node_modules", "@dprint"),
    { recursive: true },
  );

  const vsixIndex = process.argv.indexOf("--vsix");
  const isVsixRun = vsixIndex !== -1;
  const vsixPath = isVsixRun ? process.argv[vsixIndex + 1] : undefined;
  if (isVsixRun && (vsixPath == null || !fs.existsSync(vsixPath))) {
    throw new Error("Pass an existing VSIX path after --vsix.");
  }

  const cliPath = path.join(path.dirname(require.resolve("@vscode/test-cli")), "bin.mjs");
  const result = childProcess.spawnSync(
    process.execPath,
    [cliPath, "--config", path.join(root, ".vscode-test.cjs"), "--label", isVsixRun ? "lsp-vsix" : "lsp-development"],
    {
      cwd: root,
      env: {
        ...process.env,
        DPRINT_TEST_WORKSPACE: workspace,
        DPRINT_TEST_USER_DATA_DIR: userDataDir,
        ...(vsixPath == null ? {} : { DPRINT_TEST_VSIX: path.resolve(vsixPath) }),
      },
      stdio: "inherit",
    },
  );
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
} finally {
  cleanup();
}
