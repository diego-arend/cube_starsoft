/**
 * Artillery beforeScenario hook for the idempotency test.
 *
 * Generates a unique `runId` once per scenario execution (not per request),
 * so all 20 users created in a single run share the same prefix but different
 * runs never produce duplicate emails.
 *
 * Example generated email:  test-a3f9c2b1-7@example.com
 * Example generated name:   Test User 7 [a3f9c2b1]
 */

"use strict";

function generateRunId() {
  // 8-char hex string derived from the current timestamp + random salt.
  // Collision probability for two concurrent runs is ~1 in 4 billion.
  const ts = Date.now().toString(16).slice(-4); // last 4 hex digits of epoch ms
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `${ts}${rand}`;
}

function setRunId(context, events, done) {
  context.vars["runId"] = generateRunId();
  return done();
}

module.exports = { setRunId };
