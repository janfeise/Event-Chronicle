/**
 * Headless browser test runner for Event Chronicle SDK.
 *
 * Launches Chromium via Playwright, runs the test page, extracts results.
 * Usage: node test/browser/run-tests.mjs
 */

import { chromium } from "playwright";

const TEST_URL = "http://localhost:8765/test/browser/test-runner.html";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Collect console messages
const logs = [];
page.on("console", (msg) => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
});

// Collect any uncaught errors
const errors = [];
page.on("pageerror", (err) => {
  errors.push(err.message);
});

console.log("🌐 Navigating to test page...");
await page.goto(TEST_URL, { waitUntil: "networkidle" });

// Wait for tests to complete (the auto-run with setTimeout 200ms + test time)
// We poll for the summary to be populated
await page.waitForFunction(() => {
  const pass = document.getElementById("cnt-pass");
  return pass && pass.textContent !== "—";
}, { timeout: 15000 });

// Extract results
const results = await page.evaluate(() => {
  const suites = [];
  document.querySelectorAll(".suite").forEach((suiteEl) => {
    const header = suiteEl.querySelector(".suite-header span")?.textContent || "";
    const cases = [];
    suiteEl.querySelectorAll(".case").forEach((caseEl) => {
      const icon = caseEl.querySelector(".icon");
      const desc = caseEl.querySelector(".desc");
      const err = caseEl.querySelector(".error");
      const dur = caseEl.querySelector(".duration");
      if (desc) {
        cases.push({
          ok: icon?.classList.contains("pass") || false,
          desc: desc.textContent.trim(),
          error: err ? err.textContent.trim() : null,
          duration: dur ? dur.textContent.trim() : null,
        });
      }
    });
    suites.push({ name: header, cases });
  });

  const totalPass = parseInt(document.getElementById("cnt-pass")?.textContent || "0", 10);
  const totalFail = parseInt(document.getElementById("cnt-fail")?.textContent || "0", 10);

  return { suites, totalPass, totalFail };
});

// Print results
console.log("\n" + "=".repeat(60));
console.log("  Event Chronicle SDK — Browser Compatibility Test Results");
console.log("=".repeat(60) + "\n");

let allOk = true;

for (const suite of results.suites) {
  const suitePass = suite.cases.filter(c => c.ok).length;
  const suiteFail = suite.cases.filter(c => !c.ok).length;
  const icon = suiteFail === 0 ? "✅" : "❌";
  console.log(`${icon} ${suite.name}  [${suitePass}/${suite.cases.length} passed]`);
  for (const c of suite.cases) {
    const mark = c.ok ? "  ✅" : "  ❌";
    console.log(`${mark} ${c.desc}  (${c.duration})`);
    if (c.error) {
      console.log(`      Error: ${c.error}`);
      allOk = false;
    }
  }
  console.log("");
}

console.log("-".repeat(60));
console.log(`Total: ${results.totalPass} passed, ${results.totalFail} failed`);
console.log("-".repeat(60));

if (errors.length > 0) {
  console.log("\n⚠️  Page errors:");
  for (const e of errors) console.log(`  - ${e}`);
  allOk = false;
}

// Print console warnings/errors from the SDK
const sdkLogs = logs.filter(l => l.includes("[EC:SDK]") || l.includes("[warn]") || l.includes("[error]"));
if (sdkLogs.length > 0) {
  console.log("\n📋 SDK console output:");
  for (const l of sdkLogs) console.log(`  ${l}`);
}

await browser.close();

if (!allOk) {
  console.log("\n❌ Some tests FAILED.");
  process.exit(1);
}

console.log("\n✅ All browser compatibility tests PASSED.");
process.exit(0);
