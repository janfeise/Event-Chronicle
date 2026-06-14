// install.js — SDK version update helper (dev-only, not needed by end users)
// =============================================================================
// ST users install this extension via "Install from Git URL" in SillyTavern.
// The vendor/event-chronicle/ directory is COMMITTED into the repo — no install
// step is required for end users.
//
// This script is for DEVELOPERS who need to update the vendored SDK:
//   1. cd event-chronicle (SDK repo) && npm run build
//   2. cd st-extension && node install.js
//   3. git add vendor/ && git commit -m "chore: update vendored SDK to 0.x.x"
//
// Usage: node install.js
// =============================================================================

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Locate SDK dist/
// ---------------------------------------------------------------------------

function findSDKDist() {
  const candidates = [
    // 1. In the event-chronicle repo itself (dev mode)
    path.join(__dirname, '..', 'dist'),
    // 2. Installed via npm in ST's node_modules/event-chronicle
    path.join(__dirname, 'node_modules', 'event-chronicle', 'dist'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.js'))) {
      return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Recursive copy
// ---------------------------------------------------------------------------

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('[Event Chronicle] Running install.js...\n');

  // ---- Locate SDK ----
  const sdkDist = findSDKDist();
  if (!sdkDist) {
    console.error(
      '[Event Chronicle] SDK dist/ not found.\n\n' +
      '  Please build the SDK first:\n' +
      '    cd event-chronicle && npm run build\n\n' +
      '  Or install via npm:\n' +
      '    npm install event-chronicle\n'
    );
    process.exit(1);
  }
  console.log(`  Found SDK: ${sdkDist}`);

  // ---- Copy SDK to vendor/ ----
  const vendorDir = path.join(__dirname, 'vendor', 'event-chronicle');

  if (fs.existsSync(vendorDir)) {
    fs.rmSync(vendorDir, { recursive: true });
  }

  copyRecursive(sdkDist, vendorDir);
  console.log('  Copied SDK dist/ → vendor/event-chronicle/');

  // ---- Verify prompts ----
  const promptsDir = path.join(vendorDir, 'prompts');
  if (fs.existsSync(promptsDir)) {
    const mdFiles = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md'));
    console.log(`  Prompt files (${mdFiles.length}): ${mdFiles.join(', ')}`);
  } else {
    console.warn('  Warning: prompts/ directory not found in vendor copy.');
    fs.mkdirSync(promptsDir, { recursive: true });
  }

  // ---- Create data directory ----
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('  Created data/ directory');
  }

  console.log('\n[Event Chronicle] Installation complete!');
  console.log('  Restart SillyTavern to load the extension.\n');
}

main();
