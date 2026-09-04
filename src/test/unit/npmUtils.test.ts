import * as assert from "node:assert/strict";
import test from "node:test";
import {
  getDprintExecutableRelativePath,
  getDprintExeName,
  getDprintPackageName,
  shouldResolveNpmExecutable,
} from "../../executable/npmUtils";

test("dprint npm package names include the Linux libc family", () => {
  assert.equal(getDprintPackageName("linux", "x64", "glibc"), "linux-x64-glibc");
  assert.equal(getDprintPackageName("linux", "arm64", "musl"), "linux-arm64-musl");
  assert.equal(getDprintPackageName("darwin", "arm64"), "darwin-arm64");
  assert.equal(getDprintPackageName("win32", "x64"), "win32-x64");
});

test("dprint npm executable paths are platform-specific", () => {
  assert.equal(getDprintExeName("win32"), "dprint.exe");
  assert.equal(getDprintExeName("linux"), "dprint");
  assert.equal(
    getDprintExecutableRelativePath("linux-x64-glibc", "linux").split("\\").join("/"),
    "node_modules/@dprint/linux-x64-glibc/dprint",
  );
});

test("npm executable resolution is enabled by default and can be disabled for loose files", () => {
  assert.equal(shouldResolveNpmExecutable(undefined), true);
  assert.equal(shouldResolveNpmExecutable(true), true);
  assert.equal(shouldResolveNpmExecutable(false), false);
});
