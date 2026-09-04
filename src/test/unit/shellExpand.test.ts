import * as assert from "node:assert/strict";
import test from "node:test";
import { shellExpand } from "../../utils/shellExpand";

test("shellExpand expands only a leading home-directory path", () => {
  assert.equal(shellExpand("~/bin/dprint", { HOME: "/home/tester" }), "/home/tester/bin/dprint");
  assert.equal(shellExpand("~other/bin/dprint", { HOME: "/home/tester" }), "~other/bin/dprint");
  assert.equal(shellExpand("/usr/bin/dprint", { HOME: "/home/tester" }), "/usr/bin/dprint");
});

test("shellExpand handles an unavailable home directory", () => {
  assert.equal(shellExpand("~/bin/dprint", {}), "/bin/dprint");
});
