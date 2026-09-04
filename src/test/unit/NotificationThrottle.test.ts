import * as assert from "node:assert/strict";
import test from "node:test";
import { NotificationThrottle } from "../../NotificationThrottle";

test("NotificationThrottle permits only one notification per session", () => {
  const throttle = new NotificationThrottle();
  assert.equal(throttle.shouldNotify(), true);
  assert.equal(throttle.shouldNotify(), false);
  assert.equal(throttle.shouldNotify(), false);
});
