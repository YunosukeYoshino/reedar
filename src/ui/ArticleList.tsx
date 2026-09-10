import { Search, Rss, Star, X } from "lucide-react";
import type { Article, Feed } from "../shared/schema";
import { shortDate, time } from "./format";
import type { Filter } from "./Sidebar";

type Props = { title: string; articles: Article[]; feeds: Feed[]; selectedId: string | null; filter: Filter; setFilter: (filter: Filter) => void; search: string; setSearch: (value: string) => void; onSelect: (article: Article) => void };

export function ArticleList({ title, articles, feeds, selectedId, filter, setFilter, search, setSearch, onSelect }: Props) {
  const feedNames = new Map(feeds.map((feed) => [feed.id, feed.title]));
  return <section className="article-list" aria-label="記事一覧">
    <header className="list-heading"><div><h1>{title}</h1><p>{articles.length}件の記事</p></div><Rss size={17} className="muted" /></header>
    <div className="list-filter"><div className="segmented" role="group" aria-label="記事フィルタ">{(["all", "unread", "starred"] as const).map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "すべて" : value === "unread" ? "未読" : "スター"}</button>)}</div></div>
    <div className="search-field"><Search size={14} /><input aria-label="記事を検索" placeholder="記事を検索" value={search} onChange={(event) => setSearch(event.target.value)} />{search ? <button className="icon-button" aria-label="検索をクリア" onClick={() => setSearch("")}><X size={13} /></button> : <kbd>/</kbd>}</div>
    <div className="article-items">
      {articles.map((article) => <button key={article.id} className={`article-row ${selectedId === article.id ? "selected" : ""} ${article.read ? "is-read" : ""}`} onClick={() => onSelect(article)} aria-current={selectedId === article.id ? "true" : undefined} aria-label={`${article.read ? "既読" : "未読"}：${article.title}`}>
        <div className="article-row-meta"><span>{feedNames.get(article.feedId)}</span><time dateTime={article.publishedAt}>{shortDate.format(new Date(article.publishedAt))}</time></div>
        <div className="article-row-content"><div className="article-row-copy"><h2>{!article.read ? <span className="unread-dot" /> : null}{article.title}</h2><p>{article.excerpt || "本文は原文のページで読むことができます。"}</p></div>{article.imageUrl ? <img className="article-thumbnail" src={`/image?url=${encodeURIComponent(article.imageUrl)}`} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}</div>
        <div className="article-row-footer"><span>{time.format(new Date(article.publishedAt))}</span>{article.starred ? <Star size={11} className="star-filled" /> : null}</div>
      </button>)}
      {!articles.length ? <div className="list-empty"><Rss size={26} strokeWidth={1.4} /><h2>{search ? "一致する記事がありません" : filter === "starred" ? "スターを付けた記事はありません" : filter === "unread" ? "未読の記事はありません" : "記事を集めましょう"}</h2><p>{search ? "別のキーワードで検索してください。" : feeds.length ? "フィルタを切り替えるか、フィードを更新してください。" : "フィードを登録すると、ここに新しい記事が届きます。"}</p></div> : null}
    </div>
    <footer className="list-footer"><span>{articles.filter((article) => !article.read).length}件の未読</span><span><kbd>J</kbd><kbd>K</kbd> で移動</span></footer>
  </section>;
}
