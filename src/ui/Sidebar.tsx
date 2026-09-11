import { ArrowDownUp, BookOpen, Bot, ChevronDown, ChevronRight, Circle, Folder, FolderPlus, MoreHorizontal, Plus, RefreshCw, Rss, Star } from "lucide-react";
import { useState } from "react";
import type { Action, ReaderState } from "../shared/schema";
import { tone } from "./format";

export type Scope = { type: "all" } | { type: "feed" | "folder"; id: string };
export type Filter = "all" | "unread" | "starred";
type Props = {
  state: ReaderState; scope: Scope; filter: Filter; refreshing: boolean;
  select: (scope: Scope, filter?: Filter) => void; perform: (action: Action) => void;
  editFolder: (id: string | null) => void;
};

export function Sidebar({ state, scope, filter, refreshing, select, perform, editFolder }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const unread = state.articles.filter((article) => !article.read).length;
  const starred = state.articles.filter((article) => article.starred).length;
  const activeRuns = state.conversations.filter((conversation) => {
    const last = conversation.messages.at(-1);
    return last?.role === "assistant" && ["running", "waiting"].includes(last.state.status);
  }).length;
  const feedRow = (feed: ReaderState["feeds"][number]) => {
    const count = state.articles.filter((article) => article.feedId === feed.id && !article.read).length;
    return <button key={feed.id} className={`nav-row feed-row ${scope.type === "feed" && scope.id === feed.id ? "selected" : ""}`} onClick={() => select({ type: "feed", id: feed.id })} title={feed.error ?? feed.title}>
      <span className="feed-monogram" data-tone={tone(feed.title)}>{feed.title.slice(0, 1)}</span><span className="nav-label">{feed.title}</span>
      {feed.error ? <span className="feed-error-dot" aria-label="更新エラー" /> : count > 0 ? <span className="nav-count">{count}</span> : null}
    </button>;
  };
  return <aside className="sidebar" aria-label="ライブラリ">
    <div className="sidebar-header"><button className="brand" onClick={() => select({ type: "all" }, "all")}><Rss size={21} strokeWidth={2.4} /><span>Reedar</span></button>
      <div className="sidebar-tools"><button className="icon-button" aria-label="フィードを更新" title="フィードを更新" disabled={refreshing || state.feeds.length === 0} onClick={() => perform({ type: "refresh" })}><RefreshCw size={14} className={refreshing ? "spin" : ""} /></button><button className="icon-button" commandfor="feed-dialog" command="show-modal" aria-label="フィードを追加" title="フィードを追加 (N)"><Plus size={18} /></button></div>
    </div>
    <div className="sidebar-scroll">
      <nav className="primary-nav" aria-label="記事の種類">
        <button className={`nav-row ${scope.type === "all" && filter === "all" ? "selected" : ""}`} onClick={() => select({ type: "all" }, "all")}><BookOpen size={17} /><span className="nav-label">すべての記事</span><span className="nav-count">{state.articles.length || ""}</span></button>
        <button className={`nav-row ${scope.type === "all" && filter === "unread" ? "selected" : ""}`} onClick={() => select({ type: "all" }, "unread")}><Circle size={16} /><span className="nav-label">未読</span><span className="nav-count">{unread || ""}</span></button>
        <button className={`nav-row ${scope.type === "all" && filter === "starred" ? "selected" : ""}`} onClick={() => select({ type: "all" }, "starred")}><Star size={17} /><span className="nav-label">スター</span><span className="nav-count">{starred || ""}</span></button>
      </nav>
      <div className="section-heading"><span>フィード</span><div className="toolbar-group"><button className="icon-button" commandfor="organize-dialog" command="show-modal" aria-label="フィードを整理" title="フィードを整理"><MoreHorizontal size={15} /></button><button className="icon-button" commandfor="folder-dialog" command="show-modal" onClick={() => editFolder(null)} aria-label="フォルダを作成" title="フォルダを作成"><FolderPlus size={15} /></button></div></div>
      {state.folders.map((folder) => {
        const feeds = state.feeds.filter((feed) => feed.folderId === folder.id);
        const ids = new Set(feeds.map((feed) => feed.id));
        const count = state.articles.filter((article) => ids.has(article.feedId) && !article.read).length;
        const folded = collapsed.has(folder.id);
        return <section className="folder-group" key={folder.id} aria-label={folder.name}>
          <div className={`folder-row ${scope.type === "folder" && scope.id === folder.id ? "selected" : ""}`}>
            <button className="folder-toggle icon-button" aria-label={`${folder.name}を${folded ? "展開" : "折りたたむ"}`} aria-expanded={!folded} onClick={() => setCollapsed((previous) => { const next = new Set(previous); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); return next; })}>{folded ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
            <button className="folder-select" onClick={() => select({ type: "folder", id: folder.id })}><Folder size={15} /><span className="nav-label">{folder.name}</span><span className="nav-count">{count || ""}</span></button>
            <button className="icon-button folder-edit" commandfor="folder-dialog" command="show-modal" onClick={() => editFolder(folder.id)} aria-label={`${folder.name}の名前を変更`}><MoreHorizontal size={14} /></button>
          </div>
          {!folded ? <div className="folder-feeds">{feeds.length ? feeds.map(feedRow) : <p className="empty-folder">フィードを追加できます</p>}</div> : null}
        </section>;
      })}
      <div className="unfiled-feeds">{state.feeds.filter((feed) => feed.folderId === null).map(feedRow)}</div>
      {!state.feeds.length ? <button className="add-first-feed" commandfor="feed-dialog" command="show-modal"><Plus size={15} />最初のフィードを追加</button> : null}
    </div>
    <div className="sidebar-bottom">
      <button className="nav-row" commandfor="opml-dialog" command="show-modal"><ArrowDownUp size={16} /><span className="nav-label">OPML入出力</span></button>
      <button className="nav-row" commandfor="activity-dialog" command="show-modal"><Bot size={17} /><span className="nav-label">AIの会話</span>{activeRuns ? <span className="activity-count">{activeRuns}</span> : <span className="nav-count">{state.conversations.length || ""}</span>}</button>
      <button className="connection-link" commandfor="connections-dialog" command="show-modal"><span className="local-dot" />エージェント接続<span>↗</span></button>
    </div>
  </aside>;
}
