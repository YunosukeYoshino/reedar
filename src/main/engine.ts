import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { Action, Connection, Conversation, Snapshot, Update } from "../shared/schema";
import { codexModel } from "../shared/schema";
import { agentError, AuthenticationRequired, connection, runReader } from "./agents/reader";
import { loadFeed } from "./feeds";
import { publicUrl } from "./network";
import { Store } from "./store";

type Dependencies = { fetchFeed: typeof loadFeed; run: typeof runReader; connect: typeof connection };
const defaults: Dependencies = { fetchFeed: loadFeed, run: runReader, connect: connection };

export class Engine {
  connections: Connection[] = ["claude", "codex"].map((agent) => ({ agent: agent === "claude" ? "claude" : "codex", installed: false, status: "checking", detail: "接続を確認しています" }));
  refreshing = false;
  private listeners = new Set<(update: Update) => void>();
  private jobs = new Map<string, { controller: AbortController; done: Promise<void> }>();

  constructor(readonly store: Store, private readonly runnerDirectory: string, private readonly dependencies: Dependencies = defaults) {}

  async initialize() {
    await mkdir(this.runnerDirectory, { recursive: true, mode: 0o700 });
    await this.refreshConnections();
  }

  get snapshot(): Snapshot { return { state: this.store.state, connections: this.connections, refreshing: this.refreshing }; }

  subscribe(listener: (update: Update) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(update: Update) { for (const listener of this.listeners) listener(update); }
  private changed() { this.emit({ type: "snapshot", snapshot: this.snapshot }); }

  async refreshConnections() {
    this.connections = await Promise.all([this.dependencies.connect("claude", this.runnerDirectory), this.dependencies.connect("codex", this.runnerDirectory)]);
    this.changed();
  }

  async dispatch(action: Action) {
    switch (action.type) {
      case "feed.add": {
        const url = publicUrl(action.url).href;
        if (this.store.state.feeds.some((feed) => feed.url === url)) throw new Error("このフィードは登録済みです。");
        const result = await this.dependencies.fetchFeed(url, this.store.folder(action.folderId));
        this.store.mergeFeed(result.feed, result.articles);
        break;
      }
      case "feed.move": {
        const feed = this.store.state.feeds.find((item) => item.id === action.id);
        if (!feed) throw new Error("フィードが見つかりません。");
        feed.folderId = this.store.folder(action.folderId);
        break;
      }
      case "folder.save": this.store.saveFolder(action.id, action.name); break;
      case "article.read": this.store.article(action.id).read = action.read; break;
      case "article.star": this.store.article(action.id).starred = action.starred; break;
      case "refresh": return this.refreshFeeds();
      case "connections.refresh": return this.refreshConnections();
      case "chat.send": return this.send(action.articleId, action.agent, action.text);
      case "chat.stop": return this.stop(action.conversationId);
    }
    await this.store.save();
    this.changed();
  }

  private async refreshFeeds() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.changed();
    try {
      const feeds = [...this.store.state.feeds];
      for (let offset = 0; offset < feeds.length; offset += 4) {
        await Promise.all(feeds.slice(offset, offset + 4).map(async (feed) => {
          try {
            const result = await this.dependencies.fetchFeed(feed.url, feed.folderId);
            const current = this.store.state.feeds.find((item) => item.id === feed.id);
            this.store.mergeFeed({ ...result.feed, folderId: current?.folderId ?? null }, result.articles);
          } catch (error) {
            const current = this.store.state.feeds.find((item) => item.id === feed.id);
            if (current) current.error = error instanceof Error ? error.message : "更新できませんでした。";
          }
        }));
        await this.store.save();
      }
    } finally { this.refreshing = false; this.changed(); }
  }

  private async send(articleId: string, agent: Conversation["agent"], text: string) {
    const article = this.store.article(articleId);
    if (!article.text.trim()) throw new Error("記事本文がありません。原文を開いて確認してください。");
    let conversation = this.store.state.conversations.find((item) => item.articleId === articleId && item.agent === agent);
    if (!conversation) {
      conversation = {
        id: randomUUID(), articleId, agent,
        source: { title: article.title, url: article.url, text: article.text, capturedAt: new Date().toISOString() }, messages: [],
      };
      this.store.state.conversations.push(conversation);
    }
    if (this.jobs.has(conversation.id)) throw new Error("この会話は実行中です。完了を待つか停止してください。");
    if (this.jobs.size >= 2) throw new Error("同時に実行できる会話は2件です。完了を待ってください。");
    const previous = structuredClone(conversation);
    const now = new Date().toISOString();
    const message: Extract<Conversation["messages"][number], { role: "assistant" }> = {
      id: randomUUID(), role: "assistant", text: "", createdAt: now, state: { status: "running" },
      ...(agent === "codex" ? { model: codexModel } : {}),
    };
    conversation.messages.push({ id: randomUUID(), role: "user", text, createdAt: now }, message);
    const current = conversation;
    const controller = new AbortController();
    let notifyTimer: ReturnType<typeof setTimeout> | undefined;
    const notify = () => {
      if (!notifyTimer) notifyTimer = setTimeout(() => { notifyTimer = undefined; this.emit({ type: "conversation", conversation: current }); }, 60);
    };
    const done = (async () => {
      try {
        await this.store.save();
        this.changed();
        await this.dependencies.run(agent, previous, text, this.runnerDirectory, controller.signal, (event) => {
          if (controller.signal.aborted) return;
          if (event.type === "delta") { message.text = event.text; message.state = { status: "running" }; }
          else message.state = { status: "waiting", reason: event.reason };
          notify();
        });
        if (!controller.signal.aborted) message.state = { status: "completed" };
      } catch (error) {
        message.state = controller.signal.aborted ? { status: "cancelled" }
          : error instanceof AuthenticationRequired ? { status: "waiting", reason: error.message }
          : { status: "failed", error: agentError(error) };
      } finally {
        if (notifyTimer) clearTimeout(notifyTimer);
        try { await this.store.save(); }
        finally { this.jobs.delete(current.id); this.changed(); }
      }
    })();
    this.jobs.set(current.id, { controller, done });
    // The job owns its errors and persists an explicit final state; the HTTP request only starts it.
    void done.catch(() => { this.changed(); });
  }

  private async stop(conversationId: string) {
    this.jobs.get(conversationId)?.controller.abort();
    const conversation = this.store.state.conversations.find((item) => item.id === conversationId);
    const last = conversation?.messages.at(-1);
    if (last?.role === "assistant" && ["running", "waiting"].includes(last.state.status)) last.state = { status: "cancelled" };
    await this.store.save();
    this.changed();
  }

  async settle() { await Promise.all([...this.jobs.values()].map((job) => job.done)); }

  async close() {
    for (const job of this.jobs.values()) job.controller.abort();
    await this.settle();
    await this.store.save();
  }
}
