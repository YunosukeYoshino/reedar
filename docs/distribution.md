# macOS distribution

Reedar can be packaged as a `.app`, a drag-to-Applications DMG, and a ZIP archive. Recipients do not need Bun or the source checkout to run a packaged app. AI reading still requires a supported CLI, its existing login, and model access on the recipient's Mac.

The current configuration produces **ad-hoc-signed, unnotarized preview builds**. These are not Developer ID releases. macOS may block a downloaded preview, and a successful launch on the build machine does not establish Gatekeeper approval on another Mac.

## Build locally

Use macOS with Bun and the requirements listed in [Contributing](../CONTRIBUTING.md).

```sh
bun install --frozen-lockfile
bun run check
bun run dist:mac --arm64
bun run checksums
```

The packaging command rebuilds the app, creates the ICNS icon using macOS `sips` and `iconutil`, and invokes electron-builder with publishing disabled.

For version 0.1.1, Apple Silicon outputs are:

```text
release/
  mac-arm64/Reedar.app
  Reedar-0.1.1-mac-arm64-preview.dmg
  Reedar-0.1.1-mac-arm64-preview.zip
  SHA256SUMS.txt
```

The DMG includes an Applications shortcut. The ZIP contains the same application bundle. After installation, the app stores its library under `~/Library/Application Support/Reedar/`; it does not store articles inside the application bundle.

Use `bun run dist:mac --x64` to request an Intel build. Intel execution is not currently validated. Without an architecture flag, electron-builder uses the build machine's architecture. Generated bundles and archives are ignored by Git.

To verify downloaded archives, place them beside `SHA256SUMS.txt` and run:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

Checksums detect accidental changes relative to the supplied manifest; they are not a replacement for trusted code signing.

## Build with GitHub Actions

The [Build macOS preview workflow](../.github/workflows/build-macos.yml) runs only through `workflow_dispatch`:

1. Put the repository on GitHub and enable Actions.
2. Open **Actions → Build macOS preview → Run workflow**.
3. Choose `arm64` or `x64` and the source ref.
4. Download the artifact containing the DMG, ZIP, and checksum manifest.

The workflow pins action revisions, runs the automated checks, and packages on a macOS runner. Its repository token has read-only contents permission; it does not create a tag, push code, or publish a release. Workflow artifacts expire after 14 days.

For distribution, create a GitHub Release from the intended source tag and attach the DMG, ZIP, and manifest. Describe the architecture, source commit, signing status, and known agent limitations in the release notes. CI artifacts are temporary build outputs, while Release assets are the intended download location.

The workflow has been reviewed locally but has not been run on GitHub yet. No remote repository or public download URL is configured in this checkout.

## Developer ID releases

For a normal publicly distributed macOS release, prepare a **Developer ID Application** certificate and Apple notarization credentials. An Apple Development certificate is not a substitute for this distribution identity.

The preview settings in `electron-builder.json` deliberately use an ad-hoc identity, disable notarization, and disable Hardened Runtime. Before a Developer ID release:

- Select the Developer ID Application signing identity and require successful code signing.
- Enable Hardened Runtime and the Electron entitlements required by the selected runtime version.
- Enable notarization and supply credentials through a secure environment or keychain profile.
- Verify the resulting signature, notarization/stapling, and Gatekeeper assessment, then test the downloaded app on another Mac.
- Replace the preview artifact naming only after those release checks pass.

Do not store certificates, passwords, or API keys in the repository or upload them as build artifacts. Refer to the [electron-builder macOS guide](https://www.electron.build/docs/mac/) for the current signing and notarization options. The project does not yet include a verified Developer ID release pipeline or automatic updater.

## Package contents

The package configuration allows the built `dist/` application and its package manifest. electron-builder also includes production dependencies. It does not include the local library, Git checkout, tests, or CLI login directories. Agent CLIs are discovered on the recipient's machine and are not bundled.

Electron's license and Chromium third-party notices are copied to `Reedar.app/Contents/Resources/licenses/`. Production dependency license files remain within `app.asar`. The generated icon's source prompt is recorded in [assets/README.md](../assets/README.md).

The project source license has not been selected yet. No open-source license has been added as part of this packaging work.
