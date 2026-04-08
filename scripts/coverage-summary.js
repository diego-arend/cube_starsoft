#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const lcovParse = require("lcov-parse");

const defaultLcovPath = path.resolve(process.cwd(), "coverage/lcov.info");
const lcovPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultLcovPath;

if (!fs.existsSync(lcovPath)) {
  console.log(`No merged LCOV report found at ${lcovPath}`);
  console.log(
    "Try running `pnpm run test:all:coverage` or the specific coverage command."
  );
  process.exit(0);
}

console.log(`\n=== Coverage summary for: ${path.basename(lcovPath)} ===`);
lcovParse(lcovPath, (err, data) => {
  if (err) {
    console.error("Failed to parse LCOV:", err);
    process.exit(1);
  }

  let linesFound = 0;
  let linesHit = 0;
  let funcsFound = 0;
  let funcsHit = 0;
  let branchesFound = 0;
  let branchesHit = 0;

  for (const rec of data) {
    if (rec.lines) {
      const found = rec.lines.found || rec.lines.details.length || 0;
      const hit =
        rec.lines.hit || rec.lines.details.filter((d) => d.hit > 0).length || 0;
      linesFound += found;
      linesHit += hit;
    }
    if (rec.functions) {
      const found = rec.functions.found || rec.functions.details.length || 0;
      const hit =
        rec.functions.hit ||
        rec.functions.details.filter((d) => d.hit > 0).length ||
        0;
      funcsFound += found;
      funcsHit += hit;
    }
    if (rec.branches) {
      const found = rec.branches.found || rec.branches.details.length || 0;
      const hit =
        rec.branches.hit ||
        rec.branches.details.filter((d) => d.hit > 0).length ||
        0;
      branchesFound += found;
      branchesHit += hit;
    }
  }

  function pct(hit, found) {
    if (!found) return "100.00";
    return ((hit / found) * 100).toFixed(2);
  }

  console.log("\n=== Consolidated coverage summary ===");
  console.log(
    `Lines:     ${linesHit}/${linesFound} (${pct(linesHit, linesFound)}%)`
  );
  console.log(
    `Functions: ${funcsHit}/${funcsFound} (${pct(funcsHit, funcsFound)}%)`
  );
  console.log(
    `Branches:  ${branchesHit}/${branchesFound} (${pct(branchesHit, branchesFound)}%)`
  );
  console.log("====================================\n");

  process.exit(0);
});
