import * as assert from "node:assert/strict";
import * as path from "node:path";
import test from "node:test";
import {
  ancestorDirsContainConfigFilePath,
  enumerateAncestorDirectories,
  findConfigFileInAncestorDirectoriesPath,
  getFileSystemRootPath,
  isPathWithin,
} from "../../configPaths";
import { DPRINT_CONFIG_FILE_NAMES } from "../../constants";

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

test("findConfigFileInAncestorDirectoriesPath checks the supplied directory and returns the nearest config", () => {
  for (const fileName of DPRINT_CONFIG_FILE_NAMES) {
    const nearestConfig = path.join(extension, fileName);
    const fartherConfig = path.join(repo, "dprint.json");
    const existing = new Set([nearestConfig, fartherConfig]);
    assert.equal(
      findConfigFileInAncestorDirectoriesPath(extension, candidate => existing.has(candidate)),
      nearestConfig,
    );
  }
});

test("findConfigFileInAncestorDirectoriesPath tolerates lookup failures and returns undefined when absent", () => {
  assert.equal(
    findConfigFileInAncestorDirectoriesPath(extension, candidate => {
      if (candidate.includes("packages")) {
        throw new Error("permission denied");
      }
      return false;
    }),
    undefined,
  );
});

test("isPathWithin uses path boundaries instead of string prefixes", () => {
  assert.equal(isPathWithin(path.join(root, "repo"), path.join(root, "repo", "file.ts")), true);
  assert.equal(isPathWithin(path.join(root, "repo"), path.join(root, "repository", "file.ts")), false);
  assert.equal(isPathWithin(path.join(root, "repo"), path.join(root, "repo")), true);
});

test("path helpers support Windows drive and UNC roots", () => {
  assert.equal(isPathWithin("C:\\repo", "C:\\repo\\src\\file.ts", path.win32), true);
  assert.equal(isPathWithin("C:\\repo", "D:\\repo\\src\\file.ts", path.win32), false);
  assert.equal(getFileSystemRootPath("C:\\repo\\file.ts", path.win32), "C:\\");
  assert.equal(getFileSystemRootPath("\\\\server\\share\\repo\\file.ts", path.win32), "\\\\server\\share\\");
});
