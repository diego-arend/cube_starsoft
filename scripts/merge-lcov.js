const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = process.cwd();
const outputFile = path.join(rootDir, "coverage/lcov.info");

if (!fs.existsSync(path.join(rootDir, "coverage"))) {
  fs.mkdirSync(path.join(rootDir, "coverage"));
}

// Find all lcov.info files
const findCmd =
  "find apps packages -name lcov.info -not -path '*/node_modules/*'";
const files = execSync(findCmd)
  .toString()
  .trim()
  .split("\n")
  .filter((f) => f);

let combinedLcov = "";

for (const file of files) {
  const fullPath = path.join(rootDir, file);
  const content = fs.readFileSync(fullPath, "utf8");

  // Determine the prefix (e.g., apps/backend/)
  const relativeDir = path.dirname(path.dirname(file)); // apps/backend/coverage -> apps/backend

  // Fix SF: paths
  const fixedContent = content.replace(/^SF:(.*)$/gm, (match, p1) => {
    // If it's already absolute, leave it
    if (path.isAbsolute(p1)) return match;
    return `SF:${path.join(relativeDir, p1)}`;
  });

  combinedLcov += fixedContent + "\n";
}

fs.writeFileSync(outputFile, combinedLcov);
console.log(`Merged ${files.length} reports into ${outputFile}`);
