# Event Chronicle — CLAUDE.md

## Build Commands

| Command | Description |
|---|---|
| `npm run build` | Node.js SDK (tsup: ESM + CJS → `dist/`) |
| `npm run build:browser` | Browser SDK (tsup: ESM only → `dist/browser/`) |
| `npm run sync:st` | Build browser + copy to `st-extension/lib/ec-sdk.mjs` |
| `npm run test:browser` | Start browser test server (`node test/browser/server.mjs`) |
| `npm run dev` | Watch mode for Node.js SDK |
| `npm run prepublishOnly` | Build both targets before npm publish |

## Project Structure

```
Event Chronicle/
├── sdk/
│   ├── index.ts          # Node.js entry (full pipeline, LLM client)
│   ├── browser.ts        # Browser entry (pure functions, no LLM client)
│   └── browser/          # Browser-specific: prompts.ts, apply-instructions.ts, etc.
├── core/                 # Pipeline: extractor, merge, store, exporter, llm
├── config/               # .env loading (Node.js only)
├── prompts/              # .md prompt templates → compiled into sdk/browser/prompts.ts
├── types/                # Shared TypeScript types (Event, ChatMessage, etc.)
├── st-extension/         # SillyTavern plugin (separate git repo)
├── dist/                 # Build output (Node.js + Browser)
├── test/                 # Test suites
│   └── browser/          # Browser SDK test page + Playwright runner
├── tsup.config.ts        # Node.js build config
├── tsup.browser.config.ts # Browser build config
└── docs/                 # Development docs
```

## Architecture

**Two SDKs, one codebase:**

```
                    core/ config/ types/ prompts/
                         │
              ┌──────────┴──────────┐
              ▼                      ▼
       sdk/index.ts           sdk/browser.ts
       (Node.js entry)        (Browser entry)
              │                      │
     startup()              parseEvents()
     processMessages()      formatMessages()
     exportMemory()         extractPrompt
     initLLM()              mergePrompt
     loadEnv()              applyInstructions()
```

- **Node.js SDK**: Full pipeline — LLM client (openai), .env config, file I/O
- **Browser SDK**: Pure functions only — no LLM client, no Node deps. Host environment provides the API call.
- **SillyTavern Extension** (`st-extension/`): Three-layer — `index.js` (ST integration) → `ec-bridge.js` (adapter) → `lib/ec-sdk.mjs` (SDK bundle). LLM via ST backend API.

## Key Design Decisions

- Browser SDK has NO LLM client — `_generateRaw` is injected by the host
- ST extension uses `extension_settings['event-chronicle']` for storage, not file I/O
- ST extension LLM goes through `POST /api/backends/chat-completions/generate`
- Merge uses instruction-driven approach (update/delete/add/keep)
- `ec-sdk.mjs` is a build artifact — edit source in `sdk/browser/`, then run `npm run sync:st`
