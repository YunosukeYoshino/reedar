import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import type { Root } from "react-dom/client";
import { App } from "../src/ui/App";
import { parseFeed } from "../src/main/feeds";
import type { Action, Snapshot } from "../src/shared/schema";

const window = new Window();
const saved = new Map<string, PropertyDescriptor | undefined>();
const actions: Action[] = [];
let stream: TestStream | undefined;
let root: Root;
let snapshot: Snapshot;
class TestStream {
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { stream = this; }
  close() {}
}

beforeAll(async () => {
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement, EventSource: TestStream, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (_url: unknown, init: RequestInit) => { actions.push(JSON.parse(String(init.body))); return new Response('{"ok":true}'); } })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import("react-dom/client");
  const container = window.document.createElement("div");
  window.document.body.append(container);
  root = createRoot(container as unknown as HTMLElement);
  await act(async () => root.render(<App />));
  const parsed = await parseFeed('<rss version="2.0"><channel><title>Test feed</title><link>https://example.com</link><item><guid>one</guid><title>First article</title><description>First body</description></item><item><guid>two</guid><title>Second article</title><description>Second body</description></item></channel></rss>', "https://example.com/rss", null);
  snapshot = { state: { version: 1, folders: [], feeds: [parsed.feed], articles: parsed.articles, conversations: [] }, connections: [], refreshing: false };
  await act(async () => { stream?.onopen?.(); stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }); });
});
afterAll(async () => {
  await act(async () => root.unmount());
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  await window.happyDOM.close();
});

test("J/K continue article navigation after a row receives keyboard focus", async () => {
  const first = window.document.querySelector('[aria-label="未読：First article"]');
  if (!(first instanceof window.HTMLButtonElement)) throw new Error("Missing article row");
  await act(async () => { first?.focus(); first?.click(); });
  expect(window.document.querySelector(".article-body h1")?.textContent).toBe("First article");
  await act(async () => first?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "j", bubbles: true })));
  expect(window.document.querySelector(".article-body h1")?.textContent).toBe("Second article");
  expect(actions.filter((action) => action.type === "article.read")).toHaveLength(2);
});

test("typing J into search does not navigate to a different article", async () => {
  const before = window.document.querySelector(".article-body h1")?.textContent;
  const search = window.document.querySelector('input[aria-label="記事を検索"]');
  if (!(search instanceof window.HTMLInputElement)) throw new Error("Missing search input");
  await act(async () => { search?.focus(); search?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "j", bubbles: true })); });
  expect(window.document.querySelector(".article-body h1")?.textContent).toBe(before);
});

test("an authentication-waiting conversation can be cancelled from the panel", async () => {
  const article = snapshot.state.articles[0];
  if (!article) throw new Error("Missing fixture article");
  snapshot.state.conversations.push({ id: "waiting", articleId: article.id, agent: "codex", source: { title: article.title, url: article.url, text: article.text, capturedAt: article.receivedAt }, messages: [{ id: "answer", role: "assistant", text: "", createdAt: article.receivedAt, state: { status: "waiting", reason: "Log in first" } }] });
  await act(async () => stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }));
  const first = window.document.querySelector('[aria-label="未読：First article"]');
  if (!(first instanceof window.HTMLButtonElement)) throw new Error("Missing article row");
  await act(async () => first.click());
  const toggle = window.document.querySelector(".ai-toggle");
  if (!(toggle instanceof window.HTMLButtonElement)) throw new Error("Missing AI toggle");
  await act(async () => toggle.click());
  const cancel = window.document.querySelector('[aria-label="確認待ちを中止"]');
  expect(cancel instanceof window.HTMLButtonElement).toBe(true);
  if (!(cancel instanceof window.HTMLButtonElement)) return;
  await act(async () => cancel.click());
  expect(actions.at(-1)).toEqual({ type: "chat.stop", conversationId: "waiting" });
});

test("the conversation list shows the failure reason instead of claiming it is still waiting", async () => {
  const last = snapshot.state.conversations[0]?.messages.at(-1);
  if (last?.role !== "assistant") throw new Error("Missing assistant fixture");
  last.state = { status: "failed", error: "Interrupted on restart" };
  await act(async () => stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }));
  expect(window.document.querySelector(".activity-row p")?.textContent).toBe("Interrupted on restart");
});


test("summarizes in the article area, shows the supplied source and restores the excerpt", async () => {
  const article = snapshot.state.articles[1];
  if (!article) throw new Error("Missing fixture article");
  const close = window.document.querySelector('[aria-label="AIパネルを閉じる"]');
  if (close instanceof window.HTMLButtonElement) await act(async () => close.click());
  const row = window.document.querySelector('[aria-label="未読：Second article"]');
  if (!(row instanceof window.HTMLButtonElement)) throw new Error("Missing row");
  await act(async () => row.click());
  const button = window.document.querySelector('[aria-label="記事を要約"]');
  expect(button instanceof window.HTMLButtonElement).toBe(true);
  if (!(button instanceof window.HTMLButtonElement)) return;
  await act(async () => button.click());
  expect(actions.at(-1)).toEqual({ type: "chat.summarize", articleId: article.id, agent: "codex" });
  expect(window.document.querySelector(".ai-panel")).toBeNull();
  snapshot.state.conversations.push({ id: "summary", articleId: article.id, agent: "codex", source: { title: article.title, url: article.url, text: "Complete body including the final conclusion.", origin: "web", capturedAt: article.receivedAt }, messages: [{ id: "summary-answer", role: "assistant", purpose: "summary", sourceOrigin: "web", text: "## 要点\n全文に基づく要約。[危険](javascript:alert(1)) ![tracking](https://example.com/track.png)<script>alert(1)</script>", createdAt: article.receivedAt, state: { status: "completed" } }] });
  await act(async () => stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }));
  expect(window.document.querySelector(".reader-summary")?.textContent).toContain("全文に基づく要約");
  expect(window.document.querySelector(".reader-summary")?.textContent).toContain("リンク先本文");
  expect(window.document.querySelector(".reader-summary details")?.textContent).toContain("final conclusion");
  expect(window.document.querySelector(".reader-summary img, .reader-summary script, .reader-summary a[href^='javascript:']")).toBeNull();
  expect(window.document.querySelector(".article-html")).toBeNull();
  const back = window.document.querySelector('[aria-label="フィード本文に戻る"]');
  if (!(back instanceof window.HTMLButtonElement)) throw new Error("Missing back button");
  await act(async () => back.click());
  expect(window.document.querySelector(".article-html")?.textContent).toBe("Second body");
  const again = window.document.querySelector('[aria-label="記事を要約"]');
  if (!(again instanceof window.HTMLButtonElement)) throw new Error("Missing summary button");
  const count = actions.length;
  await act(async () => again.click());
  expect(actions).toHaveLength(count);
});


test("a removed feed disappears from reading views and can be restored with its articles", async () => {
  const feed = snapshot.state.feeds[0];
  if (!feed) throw new Error("Missing feed fixture");
  const remove = window.document.querySelector('[aria-label="Test feedを削除"]');
  if (!(remove instanceof window.HTMLButtonElement)) throw new Error("Missing remove control");
  await act(async () => remove.click());
  expect(actions.at(-1)).toEqual({ type: "feed.remove", id: feed.id });
  feed.removedAt = new Date().toISOString();
  await act(async () => stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }));
  expect(window.document.querySelectorAll(".article-row")).toHaveLength(0);
  expect(window.document.querySelector(".article-body")).toBeNull();
  expect(window.document.querySelector(".sidebar .feed-row")).toBeNull();
  const restore = window.document.querySelector('[aria-label="Test feedを復元"]');
  if (!(restore instanceof window.HTMLButtonElement)) throw new Error("Missing restore control");
  await act(async () => restore.click());
  expect(actions.at(-1)).toEqual({ type: "feed.restore", id: feed.id });
  delete feed.removedAt;
  await act(async () => stream?.onmessage?.({ data: JSON.stringify({ type: "snapshot", snapshot }) }));
  expect(window.document.querySelectorAll(".article-row")).toHaveLength(2);
  expect(window.document.querySelector(".sidebar .feed-row")?.textContent).toContain("Test feed");
});
