import { useDeferredValue, useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type { Agent, Article, Conversation } from "../shared/schema";
import { Sidebar } from "./Sidebar";
import type { Filter, Scope } from "./Sidebar";
import { ArticleList } from "./ArticleList";
import { Reader } from "./Reader";
import { AiPanel } from "./AiPanel";
import { LibraryDialogs } from "./LibraryDialogs";
import { useReader } from "./use-reader";

export function App() {
  const { snapshot, connected, error, setError, act, perform } = useReader();
  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent>("codex");
  const [aiOpen, setAiOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const state = snapshot?.state;
  const article = state?.articles.find((item) => item.id === selectedId);
  const feed = state?.feeds.find((item) => item.id === article?.feedId);
  const feedIds = new Set(state?.feeds.filter((item) => scope.type === "all" || (scope.type === "feed" ? item.id === scope.id : item.folderId === scope.id)).map((item) => item.id));
  const articles = state?.articles.filter((item) => feedIds.has(item.feedId) && (filter === "all" || (filter === "unread" ? !item.read || item.id === selectedId : item.starred)) && (!query || `${item.title} ${item.text}`.toLocaleLowerCase().includes(query))).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) ?? [];
  const index = articles.findIndex((item) => item.id === selectedId);
  const title = scope.type === "all" ? "すべての記事" : scope.type === "feed" ? state?.feeds.find((item) => item.id === scope.id)?.title ?? "フィード" : state?.folders.find((item) => item.id === scope.id)?.name ?? "フォルダ";
  const conversation = state?.conversations.find((item) => item.articleId === selectedId && item.agent === agent);
  function selectArticle(item: Article) { setSelectedId(item.id); if (!item.read) perform({ type: "article.read", id: item.id, read: true }); }
  function move(offset: number) { const item = articles[index + offset]; if (item) selectArticle(item); }
  function openConversation(item: Conversation) { setScope({ type: "all" }); setFilter("all"); setSearch(""); setSelectedId(item.articleId); setAgent(item.agent); setAiOpen(true); }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing || document.querySelector("dialog[open]") || event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      if (event.key === "j" || event.key === "ArrowDown") { event.preventDefault(); move(1); }
      else if (event.key === "k" || event.key === "ArrowUp") { event.preventDefault(); move(-1); }
      else if (event.key === "/") { event.preventDefault(); document.querySelector<HTMLInputElement>('input[aria-label="記事を検索"]')?.focus(); }
      else if (event.key === "n") document.querySelector<HTMLDialogElement>("#feed-dialog")?.showModal();
      else if (event.key === "s" && article) perform({ type: "article.star", id: article.id, starred: !article.starred });
      else if (event.key === "m" && article) perform({ type: "article.read", id: article.id, read: !article.read });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!snapshot) return <div className="loading-screen"><span className="loading-dot" /><p>{connected ? "ライブラリを読み込んでいます…" : "Reedarに接続しています…"}</p>{error ? <p role="alert">{error}</p> : null}</div>;
  return <><main className={`app-shell ${navigator.userAgent.includes("Electron") ? "desktop" : ""} ${aiOpen && article ? "ai-is-open" : ""}`}><Sidebar state={snapshot.state} scope={scope} filter={filter} refreshing={snapshot.refreshing} select={(value, nextFilter) => { setScope(value); setFilter(nextFilter ?? "all"); setSearch(""); setSelectedId(null); }} perform={perform} editFolder={setFolderId} /><ArticleList title={title} articles={articles} feeds={snapshot.state.feeds} selectedId={selectedId} filter={filter} setFilter={(value) => { setFilter(value); setSelectedId(null); }} search={search} setSearch={setSearch} onSelect={selectArticle} /><Reader article={article} feed={feed} aiOpen={aiOpen} toggleAi={() => setAiOpen(!aiOpen)} perform={perform} previous={() => move(-1)} next={() => move(1)} hasPrevious={index > 0} hasNext={index < articles.length - 1} />{aiOpen && article ? <AiPanel key={`${article.id}:${agent}`} article={article} agent={agent} setAgent={setAgent} conversation={conversation} connections={snapshot.connections} act={act} perform={perform} close={() => setAiOpen(false)} /> : null}</main><LibraryDialogs snapshot={snapshot} folderId={folderId} act={act} perform={perform} openConversation={openConversation} />{error || !connected ? <div className="toast" role="alert"><AlertCircle size={16} /><span>{error ?? "接続が切れました。再接続しています…"}</span>{error ? <button className="icon-button" aria-label="通知を閉じる" onClick={() => setError(null)}><X size={14} /></button> : null}</div> : null}</>;
}
