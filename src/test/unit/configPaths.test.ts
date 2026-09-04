import * as assert from "node:assert/strict";
import * as path from "node:path";
import test from "node:test";
import { ancestorDirsContainConfigFilePath, enumerateAncestorDirectories } from "../../configPaths";

const root = path.parse(process.cwd()).root;
const repo = path.join(root, "repo");
const extension = path.join(repo, "packages", "extension");

test("ancestorDirsContainConfigFilePath discovers all supported config names in ancestors", () => {
  const existing = new Set([path.join(repo, "dprint.jsonc")]);
  assert.equal(
    ancestorDirsContainConfigFilePath(extension, candidate => existing.has(candidate)),
    true,
  );
  assert.equal(
    ancestorDirsContainConfigFilePath(extension, () => false),
    false,
  );
});

test("ancestorDirsContainConfigFilePath tolerates failed file-system checks", () => {
  assert.equal(
    ancestorDirsContainConfigFilePath(extension, candidate => {
      if (candidate.includes("packages")) {
        throw new Error("permission denied");
      }
      return candidate === path.join(repo, ".dprint.json");
    }),
    true,
  );
});

test("enumerateAncestorDirectories excludes the supplied directory", () => {
  assert.deepEqual([...enumerateAncestorDirectories(extension)], [path.join(repo, "packages"), repo, root]);
});
