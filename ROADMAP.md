# Roadmap

Current baseline: **0.1.1**, September 12, 2026. Reedar runs locally on macOS with verified Codex reading and locally built Apple Silicon previews. There is no public release or configured Git remote yet.

Checked items are implemented and validated within the scope stated. Unchecked items are proposed work, not release-date commitments. The sections below have separate completion criteria: daily-reader improvements and additional providers do not all need to ship before a first public preview.

## Available now

- [x] Three-pane reader with direct RSS / Atom subscriptions and manual refresh.
- [x] Folder creation, renaming, and feed organization; unread state, stars, local search, and keyboard navigation.
- [x] Local library and conversation persistence across normal app restarts.
- [x] Linked-page article extraction before AI requests, with an explicit feed-text fallback.
- [x] Streamed summaries in the main reader, a return-to-feed control, and inspection of the supplied source text.
- [x] Codex / GPT-5.3-Codex-Spark summaries and follow-up conversations using an existing CLI login.
- [x] Explicit execution states, cancellation, source snapshots, and restricted reading sessions.
- [x] App icon, local Apple Silicon DMG / ZIP packaging, and checksums; ad-hoc signing only.
- [x] English project and contribution documentation, issue / PR templates, and a manual packaging workflow definition.
- [x] Local automated checks: 45 tests / 139 assertions, type checking, and desktop / renderer builds.

Evidence and provider-specific limits: [Validation](docs/validation.md).

## First public preview — make the project available

The next distribution milestone is a discoverable source repository and an accurately described downloadable preview.

- [ ] **Choose the source license.** Add the selected `LICENSE` and matching project metadata; a license has not been selected yet.
- [ ] **Publish the repository.** Configure its GitHub remote and public project information, then publish the intended source revision.
- [ ] **Run checks on pull requests.** Add automatic typecheck, test, and build CI. The existing workflow is manual only.
- [ ] **Validate hosted packaging.** Run the existing macOS workflow on GitHub and verify its downloaded artifacts. Local packaging already works.
- [ ] **Publish a tagged preview.** Attach the DMG, ZIP, and checksums to a GitHub Release; include a changelog, architecture, signing status, and supported-agent limitations.
- [ ] **Document a fresh installation.** Test on another Apple Silicon Mac with no source checkout, including reading without a CLI and connecting a supported CLI; add a short, non-personal screenshot or demo to the README.

See [Distribution](docs/distribution.md) for the current build procedure. Repository publication and release uploads are still outstanding actions; this checklist does not perform them.

## Daily reading — proposed next product work

Prioritize moving an existing feed library into Reedar and managing it without editing local JSON.

- [ ] **Remove subscriptions and folders.** Define what happens to cached articles and conversations, and provide a recoverable removal flow.
- [ ] **Import and export OPML.** Preserve folder membership, handle duplicate subscriptions, and report individual import failures.
- [ ] **Refresh feeds automatically while the app is open.** Add a configurable interval, retry/backoff, and conditional requests so repeated refreshes do not download unchanged feeds unnecessarily.
- [ ] **Mark a feed or folder as read.** Add scoped bulk actions with a clear target and undo.
- [ ] **Discover feeds from website URLs.** Offer RSS / Atom candidates when a user enters a normal site URL; retain the existing public-network checks.
- [ ] **Manage and back up local data.** Export and restore a library, remove individual conversations, and define cache retention without discarding starred articles or their conversation sources.

## Reliability and AI reading

- [ ] **Broaden article-extraction coverage.** Add representative fixtures and live checks for additional sites, short articles, encodings, and partial extraction. Login and paywall bypass are outside this work.
- [ ] **Handle long articles and conversations.** Provide a deliberate continuation or segmentation flow with visible source coverage. The current 180,000-character prompt limit rejects oversized requests explicitly.
- [ ] **Checkpoint streamed answers during a run.** Recover more recent partial output after a crash; normal cancellation and shutdown already save it.
- [ ] **Measure larger libraries.** Benchmark refresh, search, scrolling, and persistence with thousands of articles, then fix demonstrated bottlenecks.
- [ ] **Validate keyboard and assistive-technology use.** Check focus, dialogs, source disclosures, and streamed status announcements with VoiceOver and the minimum supported window size.
- [ ] **Verify Claude Code end to end.** The adapter exists; successful live summaries, follow-ups, streaming, and cancellation still need a usable subscription login and recorded results.
- [ ] **Resolve Antigravity's reading boundary.** Establish an existing-login connection that enforces per-session tool restrictions before implementing or enabling article execution. Current CLI detection does not establish reading support.

Provider work can progress independently. Neither Claude verification nor Antigravity support blocks a Codex-only preview when its scope is stated accurately.

## Broader macOS distribution

- [ ] **Sign and notarize releases.** Configure Developer ID signing, Hardened Runtime and required entitlements, notarization, and stapling; validate the downloaded app with Gatekeeper on another Mac. The current preview uses ad-hoc signing.
- [ ] **Validate Intel support if it will be advertised.** The packaging configuration accepts `x64`, but Intel execution has not been tested. An Apple Silicon-only release is a valid initial scope.
- [ ] **Provide an update path.** Start with visible version information and release instructions; add automatic updates after signed release hosting is established.

## Later candidates — not required for the first release

- [ ] English UI and selectable summary language.
- [ ] Reading preferences such as font size and appearance, plus saved agent preferences.
- [ ] Dedicated translation, highlighting, notes, and conversation export.
- [ ] Multi-article comparisons and explicitly enabled digests.
- [ ] Subscription-service sync, other desktop platforms, or mobile clients, after choosing a supported scope.

## Keeping this checklist useful

For implementation work, create a focused issue with acceptance criteria, link its PR here, and check the item only after the relevant tests and manual verification pass. Keep [Validation](docs/validation.md) aligned with claims of live provider and release support. No issue or PR links are present yet because this checkout has no configured remote.
