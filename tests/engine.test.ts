import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthenticationRequired } from "../src/main/agents/reader";
import type { runReader } from "../src/main/agents/reader";
import { Engine } from "../src/main/engine";
import { parseFeed } from "../src/main/feeds";
import { Store } from "../src/main/store";

const directory = await mkdtemp(join(tmpdir(), "reedar-engine-test-"));
afterAll(async () => { await Bun.spawn(["trash", directory]).exited; });
const xml = `<rss version="2.0"><channel><title>Test</title><link>https://example.com</link><item><guid>article</guid><title>Article</title><link>https://example.com/a</link><description>Evidence in the article.</description></item></channel></rss>`;

async function setup(name: string, run: typeof runReader, failRefresh = false) {
  const path = join(directory, name, "state.json");
  const store = await Store.open(path);
  const result = await parseFeed(xml, "https://example.com/rss", null);
  store.mergeFeed(result.feed, result.articles);
  const engine = new Engine(store, join(directory, name, "runner"), {
    run,
    connect: async (agent) => ({ agent, installed: true, status: "ready", detail: "fixture" }),
    fetchFeed: async (url, folderId) => { if (failRefresh) throw new Error("Network failed"); return parseFeed(xml, url, folderId); },
  });
  await engine.initialize();
  const article = store.state.articles[0];
  if (!article) throw new Error("fixture missing");
  return { engine, store, article, path };
}

describe("reading workflow", () => {
  test("AI reading leaves human unread state unchanged and passes previous completed history to follow-up", async () => {
    const contexts: number[] = [];
    const { engine, store, article, path } = await setup("conversation", async (_agent, conversation, _question, _cwd, _signal, emit) => {
      contexts.push(conversation.messages.length);
      emit({ type: "delta", text: "First" });
      emit({ type: "delta", text: "First answer" });
    });
    await engine.dispatch({ type: "chat.send", articleId: article.id, agent: "codex", text: "Summarize" });
    await engine.settle();
    await engine.dispatch({ type: "chat.send", articleId: article.id, agent: "codex", text: "Why?" });
    await engine.settle();
    expect(contexts).toEqual([0, 2]);
    expect(article.read).toBe(false);
    expect(store.state.conversations[0]?.messages.at(-1)).toMatchObject({ role: "assistant", text: "First answer", state: { status: "completed" } });
    expect((await Store.open(path)).state.conversations[0]?.messages).toHaveLength(4);
    await engine.close();
  });

  test("stop preserves partial text and cannot be overwritten by a late successful runner", async () => {
    let started: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    const { engine, store, article, path } = await setup("stop", async (_agent, _conversation, _question, _cwd, signal, emit) => {
      emit({ type: "delta", text: "Partial answer" });
      started?.();
      await new Promise<void>((resolve) => { if (signal.aborted) resolve(); else signal.addEventListener("abort", () => resolve(), { once: true }); });
      emit({ type: "delta", text: "Late answer that must be ignored" });
    });
    await engine.dispatch({ type: "chat.send", articleId: article.id, agent: "codex", text: "Summarize" });
    await ready;
    const conversation = store.state.conversations[0];
    if (!conversation) throw new Error("conversation missing");
    await expect(engine.dispatch({ type: "chat.send", articleId: article.id, agent: "codex", text: "Duplicate" })).rejects.toThrow("実行中");
    await engine.dispatch({ type: "chat.stop", conversationId: conversation.id });
    await engine.settle();
    expect((await Store.open(path)).state.conversations[0]?.messages.at(-1)).toMatchObject({ text: "Partial answer", state: { status: "cancelled" } });
    await engine.close();
  });

  test("authentication is a waiting state, not a fake completed response", async () => {
    const { engine, store, article } = await setup("auth", async () => { throw new AuthenticationRequired("ログインしてください"); });
    await engine.dispatch({ type: "chat.send", articleId: article.id, agent: "claude", text: "Summarize" });
    await engine.settle();
    expect(store.state.conversations[0]?.messages.at(-1)).toMatchObject({ text: "", state: { status: "waiting", reason: "ログインしてください" } });
    await engine.close();
  });

  test("refresh failure preserves cached articles and reports the feed error", async () => {
    const { engine, store } = await setup("refresh", async () => {}, true);
    await engine.dispatch({ type: "refresh" });
    expect(store.state.articles).toHaveLength(1);
    expect(store.state.feeds[0]?.error).toBe("Network failed");
    expect(engine.refreshing).toBe(false);
    await engine.close();
  });
});
