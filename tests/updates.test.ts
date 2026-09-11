import { expect, test } from "bun:test";
import { AppUpdates, newestRelease } from "../src/main/updates";
import type { UpdateNotice } from "../src/main/updates";

function harness(kind: "manual" | "automatic", release: string | null = "0.1.4") {
  const events: string[] = [];
  const notices: UpdateNotice[] = [];
  const options = {
    version: "0.1.3",
    delivery: {
      kind,
      check: async () => { events.push("check"); return release; },
      download: async (progress: (percent: number) => void) => { events.push("download"); progress(50); },
      install: () => { events.push("install"); },
      dispose: () => { events.push("dispose"); },
    },
    notice: async (notice: UpdateNotice) => { notices.push(notice); return false; },
    openRelease: async (version?: string) => { events.push(`open:${version ?? "all"}`); },
    prepareToInstall: async () => { events.push("save"); },
    changed: () => {},
  };
  return { options, events, notices };
}

test("preview updates choose a newer compatible public release without trusting external links", () => {
  const release = (tag_name: string, name = `Reedar-${tag_name.slice(1)}-mac-arm64-preview.dmg`, draft = false) => ({ tag_name, draft, assets: [{ name }], html_url: "https://attacker.invalid" });
  expect(newestRelease([release("v0.1.2"), release("v0.1.5", undefined, true), release("v0.1.4"), release("v0.1.6", "Reedar-0.1.6-mac-x64-preview.zip"), release("not-a-version")], "0.1.3", "arm64")).toBe("0.1.4");
  expect(newestRelease([release("v0.1.3"), release("v0.1.2")], "0.1.3", "arm64")).toBeNull();
  expect(newestRelease([release("v0.2.0-beta.1")], "0.1.3", "arm64")).toBe("0.2.0-beta.1");
  expect(() => newestRelease({ releases: [] }, "0.1.3", "arm64")).toThrow();
});

test("ad-hoc previews notify once per version and never download or install themselves", async () => {
  const { options, events, notices } = harness("manual");
  const updates = new AppUpdates(options);
  await updates.check();
  await updates.check();
  expect(notices).toEqual([{ kind: "available", version: "0.1.4" }]);
  expect(events).toEqual(["check", "check"]);
  options.notice = async () => true;
  await updates.check(true);
  expect(events.at(-1)).toBe("open:0.1.4");
  expect(events).not.toContain("download");
  expect(events).not.toContain("install");
  updates.dispose();
});

test("signed updates download, wait for validation, and save before a confirmed restart", async () => {
  const { options, events, notices } = harness("automatic");
  let complete: (() => void) | undefined;
  options.delivery.download = async () => { events.push("download"); await new Promise<void>((resolve) => { complete = resolve; }); };
  const updates = new AppUpdates(options);
  const check = updates.check();
  await Promise.resolve();
  expect(updates.state.kind).toBe("downloading");
  expect(notices).toHaveLength(0);
  complete?.();
  await check;
  expect(updates.state).toEqual({ kind: "ready", version: "0.1.4" });
  expect(events).toEqual(["check", "download"]);
  options.notice = async () => true;
  await updates.check(true);
  expect(events).toEqual(["check", "download", "save", "install"]);
  updates.dispose();
});

test("signature or download failure never enables installation or exposes the raw error", async () => {
  const { options, events, notices } = harness("automatic");
  options.delivery.download = async () => { throw new Error("token=secret /Users/private/file signature failed"); };
  const updates = new AppUpdates(options);
  await updates.check(true);
  expect(updates.state).toEqual({ kind: "error" });
  expect(notices).toEqual([{ kind: "error", stage: "download" }]);
  expect(events).not.toContain("install");
  updates.dispose();
});

test("failed persistence prevents an update restart", async () => {
  const { options, events, notices } = harness("automatic");
  options.notice = async (notice) => { notices.push(notice); return notice.kind === "ready"; };
  options.prepareToInstall = async () => { throw new Error("disk full"); };
  const updates = new AppUpdates(options);
  await updates.check();
  expect(events).not.toContain("install");
  expect(notices.at(-1)).toEqual({ kind: "error", stage: "install" });
  updates.dispose();
});

test("overlapping checks are coalesced and shutdown suppresses late notifications", async () => {
  const { options, events, notices } = harness("automatic");
  let complete: ((version: string) => void) | undefined;
  options.delivery.check = async () => { events.push("check"); return new Promise<string>((resolve) => { complete = resolve; }); };
  const updates = new AppUpdates(options);
  const first = updates.check();
  await updates.check(true);
  expect(events).toEqual(["check"]);
  updates.dispose();
  complete?.("0.1.4");
  await first;
  expect(notices).toHaveLength(0);
  expect(events).not.toContain("download");
});

test("no-update and offline checks stay quiet in the background and report manual results", async () => {
  const { options, notices } = harness("manual", null);
  const updates = new AppUpdates(options);
  await updates.check();
  expect(notices).toHaveLength(0);
  await updates.check(true);
  expect(notices).toEqual([{ kind: "current", version: "0.1.3" }]);
  options.delivery.check = async () => { throw new Error("offline"); };
  await updates.check();
  expect(notices).toHaveLength(1);
  await updates.check(true);
  expect(notices.at(-1)).toEqual({ kind: "error", stage: "check" });
  updates.dispose();
});

test("an updater cannot request a downgrade or an invalid version", async () => {
  for (const release of ["0.1.2", "invalid"]) {
    const { options, events } = harness("automatic", release);
    const updates = new AppUpdates(options);
    await updates.check();
    expect(events).not.toContain("download");
    expect(events).not.toContain("install");
    updates.dispose();
  }
});
