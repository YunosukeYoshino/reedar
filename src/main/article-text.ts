import { Readability } from "@mozilla/readability";
import { DOMParser } from "linkedom";
import { plainText } from "./feeds";
import { fetchPublic } from "./network";

export function extractArticleText(html: string, url: string) {
  // This DOM parser does not run scripts or load page resources.
  const document = new DOMParser().parseFromString(html, "text/html");
  Object.defineProperty(document, "documentURI", { value: url });
  Object.defineProperty(document, "baseURI", { value: url });
  // Linkedom implements the DOM operations Readability uses, but omits unrelated browser APIs.
  // Keep this library type mismatch at the adapter boundary; extraction fixtures cover compatibility.
  const article = new Readability(document as unknown as Document, { charThreshold: 200, maxElemsToParse: 20_000 }).parse();
  const text = plainText(article?.content ?? "");
  if (text.length < 200) throw new Error("リンク先の記事本文を抽出できませんでした。");
  return text;
}

export async function loadArticleText(url: string, signal: AbortSignal) {
  const result = await fetchPublic(url, 0, AbortSignal.any([signal, AbortSignal.timeout(25_000)]));
  signal.throwIfAborted();
  if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(result.contentType)) throw new Error("リンク先がHTML記事ではありません。");
  const charset = /charset=["']?([^;\s"']+)/i.exec(result.contentType)?.[1]
    ?? /<meta[^>]+charset=["']?([^\s"'/>]+)/i.exec(result.body.subarray(0, 4096).toString("ascii"))?.[1] ?? "utf-8";
  return { text: extractArticleText(new TextDecoder(charset).decode(result.body), result.url), url: result.url };
}
