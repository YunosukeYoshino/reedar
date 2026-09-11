import { expect, test } from "bun:test";
import { parseOpml, serializeOpml } from "../src/main/opml";
import type { Feed } from "../src/shared/schema";

const wrap = (body: string) => `<?xml version="1.0"?><opml version="2.0"><head><title>Subscriptions</title></head><body>${body}</body></opml>`;

test("reads nested subscription folders and ignores links and commented outlines", async () => {
  const entries = await parseOpml(wrap(`<outline text="技術"><outline text="Web"><outline type="rss" text="記事 &amp; News" xmlUrl="https://example.com/feed?a=1&amp;b=2" /></outline></outline><outline text="Root" xmlUrl="https://example.org/rss" /><outline type="link" text="Included" url="https://example.net/list.opml" /><outline type="include" text="External include" xmlUrl="https://example.net/external.opml" /><outline text="Hidden" isComment="true"><outline text="Secret" xmlUrl="https://example.net/hidden" /></outline>`));
  expect(entries).toEqual([{ title: "記事 & News", url: "https://example.com/feed?a=1&b=2", folderName: "技術 / Web" }, { title: "Root", url: "https://example.org/rss", folderName: null }]);
});

test("round-trips escaped subscriptions and excludes removed feeds, article bodies and conversations", async () => {
  const feed: Feed = { id: "f", url: "https://example.com/rss?a=1&b=2", title: 'News <today> & "updates"', siteUrl: "https://example.com", folderId: "folder", updatedAt: null, error: null };
  const xml = serializeOpml([feed, { ...feed, id: "removed", url: "https://example.net/removed", removedAt: "now" }], [{ id: "folder", name: "R&D" }]);
  expect(xml).not.toContain("https://example.net/removed");
  expect(xml).toContain("&lt;today&gt;");
  expect(await parseOpml(xml)).toEqual([{ title: 'News & "updates"', url: feed.url, folderName: "R&D" }]);
});

test("rejects DTDs, malformed XML, unsupported roots, oversized files and excessive subscription lists", async () => {
  for (const xml of ['<!DOCTYPE opml [<!ENTITY x SYSTEM "file:///etc/passwd">]><opml/>', '<opml version="2.0"><body><outline></body></opml>', '<rss><channel/></rss>', ' '.repeat(262145), wrap(Array.from({ length: 201 }, (_, i) => `<outline text="Feed ${i}" xmlUrl="https://example.com/${i}"/>`).join(""))]) {
    await expect(parseOpml(xml)).rejects.toThrow();
  }
});

test("accepts an empty exported library without inventing subscriptions", async () => {
  expect(await parseOpml(serializeOpml([], []))).toEqual([]);
});
