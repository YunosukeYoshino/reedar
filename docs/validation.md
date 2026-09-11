# Validation record

Last verified: **September 12, 2026 (JST)**. Environment: macOS, Bun 1.3.12, Electron 42.11.1. This record describes observed behavior, not a promise of compatibility with every account or future CLI release. Earlier checks retain their original scope below; see the [roadmap](../ROADMAP.md) for outstanding work.

## Automated checks

`bun run check` passed TypeScript checking, **45 tests with 139 assertions**, and the renderer and Electron builds. The linked-article and inline-summary section below records the latest additions.

The suite covers:

- RSS / Atom parsing, stable article identity, and HTML sanitization.
- Rejection of private network destinations and unsafe URLs.
- Session authentication, Origin / Host checks, malformed launch credentials, and split UTF-8 input.
- Persistence, concurrent saves, corrupt storage, and interrupted responses.
- Conversation history, authentication waiting, cancellation, and late output after cancellation.
- CLI request routing, timeouts, streaming, sandbox parameters, and rejection of model substitution.
- Antigravity detection without execution and rejection of reading requests before any provider is launched.
- Desktop asset resolution and keyboard navigation without intercepting text input.

Tests use fixtures and local child processes; they do not make live model requests.

React Doctor reported no errors. The full UI scan scored 84/100 with maintainability warnings around conditional rendering, state, and array iteration. A later scan of seven changed files scored 87/100, with four existing warnings about Zod APIs and chained iteration. Scores from different scopes are not directly comparable. The warnings were retained where inspection found no concrete regression.

## Manual RSS and library checks

These public feeds were added through the application form:

| Feed | URL | Articles at the time of validation |
| --- | --- | --- |
| Zenn trends | https://zenn.dev/feed | 20 |
| Publickey | https://www.publickey1.jp/atom.xml | 15 |
| Hacker News front page | https://hnrss.org/frontpage | 20 |

The 55-article library was used to verify folder creation, moving feeds between folders, reading article bodies, unread counts, starring, and `J` navigation after selecting an article. These actions were performed through the UI rather than by editing storage.

## Codex

Live checks used the app-bundled **Codex CLI 0.153.4** and an existing ChatGPT login. The source was a Publickey article about the .NET 11 release candidate.

Initial checks confirmed:

1. A Japanese summary, a source link, and the completed state.
2. A follow-up answer distinguishing information in the supplied body from information present only in the title.
3. Incremental output during a longer answer, followed by cancellation and preservation of the partial text.

The feed supplied an excerpt. The response acknowledged the incomplete source rather than claiming the entire article had been retrieved.

### GPT-5.3-Codex-Spark

After pinning the model, the CLI's `model/list` response confirmed availability of `gpt-5.3-codex-spark` and support for medium reasoning effort. Reedar specifies the model in both `thread/start` and `turn/start`, then checks the model returned at thread creation. Automated coverage verifies that substitution is rejected.

In the Mac app, a request for a three-point Japanese summary completed with the **Codex · Spark** label. A follow-up asking for more detail about the third point also completed, referencing the previous answer and separating supplied facts from missing details. Both included the source link.

Completed Spark responses and their model labels remained in local storage after normal shutdown and restart. Older responses without recorded model metadata retained the generic Codex label. The cancellation check above preceded the Spark-specific checks; it is not a separate live Spark cancellation result.

## Claude Code

CLI detection, the login-required connection state, and an authentication-waiting reading request were verified. The test machine did not have a usable existing Claude Code login.

**Successful live summarization, follow-up questions, and streaming remain unverified.** Further live checks were deferred. Adapter implementation and authentication-state checks do not establish successful end-to-end support.

## Antigravity

The application detects the installed `agy` CLI and displays **integration pending**. Automated checks verify that reading requests fail explicitly and cannot fall through to Codex.

During a separate compatibility investigation, `agy models` returned a model list using the existing login. No article content was supplied to the headless initialization probes. In an isolated temporary workspace, a custom agent was tested with `tools: []` and `tools: [finish]`; the second probe also used `--mode plan`.

Both initialization responses still listed filesystem, command, browser, and MCP tools, and reported `permission_mode: always-proceed`. The probes therefore did not establish the required isolation. No global permission or plugin settings were changed, and article execution remains disabled in Reedar.

The [headless documentation](https://antigravity.google/docs/cli/headless/) and [permission documentation](https://antigravity.google/docs/cli/permissions/), reviewed on the verification date, describe use of existing permissions and default workspace read/write access. The [SDK](https://antigravity.google/docs/sdk/overview/) provides tool restrictions but requires Gemini API-key or Vertex authentication, so it was not adopted for the existing-CLI-login path.

The unresolved requirement is a supported connection method that reuses the existing login while enforcing per-session restrictions on external actions. **Antigravity summaries and follow-up questions are neither implemented nor verified.**

## Desktop lifecycle and recovery

The library initially created through the browser UI was copied into an empty desktop data directory for desktop verification. The desktop and browser modes do not otherwise synchronize their libraries.

Manual shutdown and restart checks preserved articles, folders, unread state, stars, completed answers, and cancelled partial answers. A desktop asset-resolution failure found during the first run was fixed after adding a failing build regression test. The final restart also showed Codex as connected and Antigravity as integration pending.

## Remaining limits

- Article extraction is available on explicit AI requests; JavaScript-only, blocked, authenticated, and paywalled pages may fall back to feed text.
- CLI and account compatibility can change and must be revalidated.
- Large feed libraries and very long histories have not been performance-tested.
- A crash can lose unsaved response deltas; normal stop and shutdown preserve partial output.
- Signed installers, notarization, mobile clients, and subscription-service sync have not been validated or shipped.

Return to the [README](../README.md) or [contribution guide](../CONTRIBUTING.md).

## macOS preview packaging

On September 11, 2026, electron-builder 26.15.3 produced Apple Silicon `.app`, DMG, and ZIP previews for version 0.1.0 using Electron 42.11.1. The package metadata points to `icon.icns`; the generated icon and version appeared in the packaged app's About panel during a native Mac UI check.

After normally quitting the development app, the packaged app launched successfully and displayed the existing library and conversation count. Its connection dialog reported Codex connected, Claude Code requiring login, and Antigravity pending. Packaging verification did not issue additional live model requests.

`codesign --verify --deep --strict` passed for the ad-hoc-signed bundle. DMG verification and ZIP integrity checks passed. The SHA-256 manifest was generated and verified. The ASAR root contained only `dist`, `node_modules`, and `package.json`; checks found no local data, Git directory, source/test tree, or release outputs. Electron and Chromium license notices were present in `Contents/Resources/licenses/`.

The automated suite remained at 37 passing tests, with type checking and builds passing. The manually triggered GitHub Actions workflow parsed successfully and has read-only repository contents permission; it has not run on GitHub. Intel execution, Developer ID signing, notarization, and downloaded-app Gatekeeper approval on another Mac remain unverified. See [Distribution](distribution.md) for commands and release requirements.


## Linked article text and inline summaries — September 12, 2026

Version 0.1.1 retrieves the linked HTML article before explicit AI requests. Readability extracts the article using an inert Linkedom DOM; the initial feed display remains available. Retrieval failures use a marked feed fallback, and successful retrieval is retained for follow-up questions. Legacy conversations retain their original excerpt snapshot when upgraded.

The automated suite passed **45 tests / 139 assertions**, with type checking and renderer/desktop builds passing. Added coverage checks article opening and final paragraphs, removal of navigation/scripts, source reuse, marked retrieval failure, cancellation during retrieval, legacy-source preservation, empty-source failure, inline summary rendering, safe Markdown, and returning to the feed view without a second model request. React Doctor scored 84/100 for the changed UI with no errors; remaining warnings concern component control-flow complexity and existing state/iteration patterns.

A live packaged-app check used the Publickey article about .NET 11 RC1. Its feed text contained **242 characters**; the extracted linked article contained **2,139 characters**, including the final WebAssembly/CoreCLR section and release-timing paragraph. The extracted endpoint was compared with the public page. The app upgraded the existing Codex conversation, retained the 242-character original source, and completed a GPT-5.3-Codex-Spark summary in the main article pane. The answer included JIT, AOT, and WebAssembly content absent from the excerpt. The UI showed the 2,139-character source, expanded the supplied text, returned to the feed excerpt, and reopened the saved summary without another model run. The existing library remained available after the update.

Extraction remains best effort: blocked, authenticated, paywalled, non-HTML, and JavaScript-only pages may not yield an article. Text is not silently truncated to fit the model; the existing 180,000-character prompt limit fails explicitly. Automated tests cover fallback and cancellation; the live model check covered the successful Codex path.

The Apple Silicon 0.1.1 app, DMG, and ZIP were rebuilt locally. Distribution remains an ad-hoc signed, unnotarized preview; no GitHub publication was performed.
