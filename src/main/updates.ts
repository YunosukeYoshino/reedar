import { gt, valid } from "semver";
import { z } from "zod";

const releasesSchema = z.array(z.object({ tag_name: z.string().max(128), draft: z.boolean(), assets: z.array(z.object({ name: z.string() })) })).max(100);

export function newestRelease(value: unknown, currentVersion: string, architecture: string) {
  let newest: string | null = null;
  for (const release of releasesSchema.parse(value)) {
    if (release.draft || !release.tag_name.startsWith("v")) continue;
    const version = valid(release.tag_name.slice(1));
    if (!version || release.tag_name !== `v${version}` || !gt(version, currentVersion) || (newest && !gt(version, newest))) continue;
    if (release.assets.some((asset) => asset.name === `Reedar-${version}-mac-${architecture}-preview.dmg` || asset.name === `Reedar-${version}-mac-${architecture}-preview.zip`)) newest = version;
  }
  return newest;
}

type UpdateState = { kind: "idle" | "checking" | "error" }
  | { kind: "available" | "ready" | "installing"; version: string }
  | { kind: "downloading"; version: string; percent: number };

export type UpdateNotice = { kind: "available" | "ready" | "current"; version: string }
  | { kind: "error"; stage: "check" | "download" | "install" }
  | { kind: "development" };

type Dependencies = {
  version: string;
  delivery: {
    kind: "manual" | "automatic";
    check: () => Promise<string | null>;
    download: (progress: (percent: number) => void) => Promise<void>;
    install: () => void;
    dispose: () => void;
  } | null;
  notice: (notice: UpdateNotice) => Promise<boolean>;
  openRelease: (version?: string) => Promise<void>;
  prepareToInstall: () => Promise<void>;
  changed: () => void;
};

export class AppUpdates {
  state: UpdateState = { kind: "idle" };
  private disposed = false;
  private prompting = false;
  private notifiedVersion: string | null = null;
  private initialCheck: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly dependencies: Dependencies) {}

  get busy() { return ["checking", "downloading", "installing"].includes(this.state.kind) || this.prompting; }

  start() {
    if (!this.dependencies.delivery || this.disposed || this.initialCheck) return;
    this.initialCheck = setTimeout(() => { void this.check(); }, 30_000);
    this.interval = setInterval(() => { void this.check(); }, 6 * 60 * 60 * 1000);
    this.initialCheck.unref();
    this.interval.unref();
  }

  private setState(state: UpdateState) {
    if (this.disposed) return;
    this.state = state;
    this.dependencies.changed();
  }

  async check(manual = false) {
    if (this.disposed || this.busy) return;
    if (!this.dependencies.delivery) {
      if (manual) await this.notify({ kind: "development" });
      return;
    }
    if (this.state.kind === "ready" || (manual && this.state.kind === "available")) {
      if (manual) await this.offer({ kind: this.state.kind, version: this.state.version });
      return;
    }
    let stage: "check" | "download" = "check";
    try {
      this.setState({ kind: "checking" });
      const version = await this.dependencies.delivery.check();
      if (this.disposed) return;
      if (!version || (valid(version) && !gt(version, this.dependencies.version))) {
        this.setState({ kind: "idle" });
        if (manual) await this.notify({ kind: "current", version: this.dependencies.version });
        return;
      }
      if (!valid(version)) throw new Error("Invalid update version");
      if (this.dependencies.delivery.kind === "automatic") {
        stage = "download";
        this.setState({ kind: "downloading", version, percent: 0 });
        await this.dependencies.delivery.download((percent) => {
          if (Number.isFinite(percent)) this.setState({ kind: "downloading", version, percent: Math.max(0, Math.min(100, percent)) });
        });
        if (this.disposed) return;
        this.setState({ kind: "ready", version });
      } else this.setState({ kind: "available", version });
      if (manual || this.notifiedVersion !== version) {
        this.notifiedVersion = version;
        await this.offer({ kind: this.dependencies.delivery.kind === "automatic" ? "ready" : "available", version });
      }
    } catch {
      if (this.disposed) return;
      this.setState({ kind: "error" });
      if (manual || stage === "download") await this.notify({ kind: "error", stage });
    }
  }

  private async notify(notice: UpdateNotice) {
    if (this.disposed || this.prompting) return false;
    this.prompting = true;
    this.dependencies.changed();
    try { return await this.dependencies.notice(notice); }
    finally { this.prompting = false; if (!this.disposed) this.dependencies.changed(); }
  }

  private async offer(update: { kind: "available" | "ready"; version: string }) {
    if (!await this.notify(update) || this.disposed) return;
    if (update.kind === "available") {
      try { await this.dependencies.openRelease(update.version); }
      catch { await this.notify({ kind: "error", stage: "check" }); }
      return;
    }
    if (this.dependencies.delivery?.kind !== "automatic") return;
    try {
      this.setState({ kind: "installing", version: update.version });
      await this.dependencies.prepareToInstall();
      if (!this.disposed) this.dependencies.delivery.install();
    } catch {
      this.setState({ kind: "error" });
      await this.notify({ kind: "error", stage: "install" });
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.initialCheck);
    clearInterval(this.interval);
    this.dependencies.delivery?.dispose();
  }
}
