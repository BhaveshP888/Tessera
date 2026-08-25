# Tessera — Privacy-First Bookmark Manager

A local-first, end-to-end encrypted bookmark manager with a typed extension system and zero AI.

![Architecture Status](https://img.shields.io/badge/Architecture-Clean-0891b2?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-19%20passed-16a34a?style=flat-square)
![Privacy](https://img.shields.io/badge/Zero-AI%20%26%20E2E%20Encrypted-rose?style=flat-square)

---

## 🏛️ Monorepo Structure

```text
.
├── packages/
│   ├── schemas/        # Zod models for Bookmarks, Tags, Collections, Sync Deltas, Manifests
│   ├── core/           # Local core: Drizzle SQLite, WebCrypto XChaCha20, Vector Clocks, FTS5/Trigram
│   └── sdk/            # Typed Extension SDK, capability gatekeeper & sandbox RPC dispatcher
├── apps/
│   ├── web/            # React 19 + Vite SPA with local-first persistence & E2E master key UI
│   └── extension/      # Manifest V3 browser extension (service worker, popup, context menus)
├── server/             # Fastify zero-knowledge relay, Passkeys (WebAuthn), Reader proxy, Registry
├── extensions/
│   ├── html-import     # Standard Netscape HTML browser bookmarks importer & exporter
│   └── markdown-export # Reference extension for structured Markdown export
├── turbo.json          # Turborepo pipeline configuration
└── package.json        # Bun workspaces
```

---

## 🔑 Core Guarantees

1. **Deterministic & Zero AI**: Search is powered purely by SQLite FTS5 prefix matching and Sørensen–Dice character trigram similarity. No embeddings, vector stores, or remote inference.
2. **End-to-End Encrypted Sync**: Master keys (256-bit) are generated on-device. Per-record encryption keys are derived using `HKDF-SHA256` and encrypted with `XChaCha20-Poly1305`.
3. **Multi-Device Conflict Resolution**: Field-level Last-Write-Wins (LWW) with vector clocks and tombstones.
4. **Sandboxed & Capability-Gated Extensions**: Extensions communicate through typed RPC over `postMessage` with strict permission boundary enforcement (`bookmarks.read`, `bookmarks.write`, `tags.write`, etc.).
5. **Local-First & Offline Capable**: Fully functional without network connectivity; cloud relay is additive and zero-knowledge.

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) (v1.2+)

### 1. Install Dependencies
```bash
bun install
```

### 2. Run Tests
```bash
bun test
```

### 3. Start Development Servers
Start the Web App, Relay Server, and Extensions concurrently:
```bash
bun run dev
```

- **Web App**: `http://localhost:3000`
- **Sync Relay & Proxy**: `http://localhost:8787`

---

## 🐳 Docker Deployment

Tessera ships with a self-contained, multi-stage Alpine Docker image that serves both the Fastify API / Zero-Knowledge Relay and the compiled React SPA web bundle on a single port.

### Run with Docker Compose (Recommended)
```bash
docker compose up -d
```
Access the application at `http://localhost:8787`.

### Run with Docker CLI
```bash
# Build the image
docker build -t tessera .

# Run container with persistent data volume
docker run -d \
  --name tessera-app \
  -p 8787:8787 \
  -v tessera-data:/app/data \
  --restart unless-stopped \
  tessera
```

---

## 🧪 Testing

Run all unit and integration tests across schemas, crypto primitives, sync causality, search indexing, server relay, and extension capabilities:
```bash
bun test
```
