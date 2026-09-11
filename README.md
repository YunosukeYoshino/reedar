# Reedar

<img src="assets/icon.png" alt="Reedar: an open book with RSS arcs on a graphite tile" width="128" height="128">

**A quiet RSS reader. A conversation with every article.**

Reedar is a desktop RSS reader for macOS, inspired by the familiar three-pane reading experience. Follow your feeds, organize articles, and ask your existing coding agents to help you understand what you read.

Bring your own CLI login. Reedar uses the agent's existing service access and usage allowance; it does not require a separate model API key.

> **Early preview.** Run from source on macOS. The interface and reading assistant currently use Japanese. Codex reading is verified with GPT-5.3-Codex-Spark; other integrations have different levels of support.

[Getting started](#getting-started) · [Agent support](#agent-support) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md) · [Validation](docs/validation.md) · [Distribution](docs/distribution.md)

## Features

- **Three-pane reading:** feeds and folders, an article list, and the article itself.
- **Your own library:** direct RSS / Atom subscriptions, folders, unread filters, stars, and search across downloaded titles and text.
- **Read with an agent:** summarize a selected article, ask follow-up questions, and see answers as they stream.
- **Conversations that stay with the article:** local history includes a snapshot of the source text used for the conversation.
- **Clear execution states:** running, waiting, completed, failed, and cancelled, with a stop control that preserves partial answers.
- **Keyboard navigation:** move through articles and manage reading state without leaving the keyboard.

AI requests are explicit and apply to the selected article. AI activity does not change whether you have read an article.

## Getting started

### Requirements

- macOS. Other platforms have not been validated.
- Bun. The current development baseline is **1.3.12**.
- For AI reading, a supported CLI installed and signed in with access to the requested model. Feed reading works without an AI login.
- For running the test suite, the `trash` command must be available on `PATH`; tests use it to clean up temporary files.

### Run the desktop app

From a local checkout:

```sh
bun install --frozen-lockfile
bun run start
```

Installation downloads Electron. The start command builds the renderer and desktop entry point, then opens Reedar. Local DMG and ZIP previews can also be built with `bun run dist:mac --arm64`. Public signed releases are not available yet; see [Distribution](docs/distribution.md).

### Add your first feed

1. Click **+** in the sidebar and enter an RSS or Atom URL.
2. Select an article to read it. Use the toolbar to star it or mark it unread.
3. Open **Read with AI** (`AIと読む`), choose an agent, and send a question or use the summary shortcut.

Reedar initially displays the text supplied by the feed. Before answering or summarizing, it fetches the linked HTML page and extracts the article text locally. The **要約する** button displays a streamed summary in the main reader; **フィード本文に戻る** restores the feed view. You can inspect the text supplied to the AI beneath the summary.

If retrieval fails or produces less text than the feed, the assistant uses the saved feed text and identifies that limitation. Extraction does not execute JavaScript, use browser cookies, or bypass login/paywalls, and cannot guarantee complete text on every website. Follow-up questions reuse the retrieved source. Ordinary webpage URLs cannot yet be registered as feeds automatically.

## Agent support

| Agent | Status | Reading model / behavior |
| --- | --- | --- |
| **Codex** | Verified with a real account | GPT-5.3-Codex-Spark, pinned explicitly; Japanese summaries and follow-up questions verified in the Mac app |
| **Claude Code** | Adapter implemented; live verification pending | Authentication-waiting behavior verified; successful live reading has not been validated |
| **Antigravity** | CLI detection only | Shown as integration pending; article submission is disabled until per-session tool restrictions can be enforced |

Open **Agent connections** (`エージェント接続`) to inspect availability. Sign in through the CLI outside Reedar, then refresh the connection status:

```sh
# Choose the CLI you use:
codex login
claude auth login
```

Codex requires a ChatGPT login and access to `gpt-5.3-codex-spark`. Reedar checks the model returned by the CLI and stops if it differs; it does not silently substitute another model. Claude Code is intended to use an existing subscription login. Requests consume the connected service's usage allowance.

Reedar prefers the Codex CLI bundled with the desktop app, then checks `PATH` and common install locations. You can specify an executable with `REEDAR_CODEX_BIN`, `REEDAR_CLAUDE_BIN`, or `REEDAR_ANTIGRAVITY_BIN`. The Antigravity override affects detection only. Reedar does not rewrite your existing CLI settings.

See the [validation record](docs/validation.md) for tested versions, evidence, and integration limitations.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `J` / `↓` | Next article |
| `K` / `↑` | Previous article |
| `S` | Toggle star |
| `M` | Toggle read / unread |
| `/` | Focus article search |
| `N` | Add a feed |
| `⌘ Enter` | Send an AI question |

Article shortcuts are inactive while typing in an input field.

## Data and privacy

Your library is stored locally:

| Mode | Default location |
| --- | --- |
| Desktop | `~/Library/Application Support/Reedar/reader.json` |
| Browser development | `.data/dev/reader.json` |

The two modes use separate libraries. Data includes feeds, cached articles, folders, reading state, stars, and conversations. Files are protected by OS permissions and are **not encrypted**. Quit the app before backing up the data directory.

When you send a question, the selected article text and that conversation are sent to the chosen AI provider through its CLI. Local storage does not make model inference local. Feed and image retrieval also makes network requests.

Reading sessions treat article content as untrusted input, restrict external tools, and reject permission escalation. The renderer sanitizes feed HTML and runs with Electron isolation and a content security policy. A session-authenticated loopback server checks request origins and hosts; network fetching rejects private destinations.

See [Security](SECURITY.md) for the boundaries and their limitations.

## Development

```sh
bun run dev        # Build and start the browser development server
bun run typecheck  # TypeScript checks
bun test           # Automated tests; no live model requests
bun run build      # Renderer and Electron bundles
bun run check      # Typecheck, tests, and build
bun run dist:mac --arm64  # Build a macOS DMG and ZIP preview
bun run checksums  # Write the archive checksum manifest
```

Open the URL printed by `bun run dev`. The server uses a fresh session and an available port on each launch. Keep that URL private. This command does not watch files; restart it after source changes.

Browser development accepts `REEDAR_DATA_DIR` to choose a data directory and `REEDAR_PORT` to choose a port. These settings do not change the desktop app's data location.

Built with **Electron, React, TypeScript, and Bun**. Source lives in `src/main` (desktop host and local services), `src/ui` (reader interface), and `src/shared` (validated data contracts). See [Contributing](CONTRIBUTING.md) for the repository map and workflow.

## Scope

This preview focuses on reading a local feed library and discussing individual articles. It does not yet include subscription deletion, OPML import/export, Inoreader or other service sync, mobile clients, automatic digests, or publicly released installers. Large-library performance has not been benchmarked.

The [roadmap checklist](ROADMAP.md) tracks completed work, public-preview preparation, daily-reader improvements, and longer-term candidates.

Normal shutdown preserves partial answers. A crash may lose deltas written since the last save; interrupted responses are marked as failed on the next launch. Corrupt storage produces an error instead of being replaced with an empty library.

## Contributing

Bug reports, focused fixes, and documentation improvements are welcome. Start with the [contribution guide](CONTRIBUTING.md), [design notes](docs/design-notes.md), and [validation record](docs/validation.md).

Reedar is an independent project inspired by Reeder's reading layout. It is not affiliated with Reeder or the connected AI providers.
