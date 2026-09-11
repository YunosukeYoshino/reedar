import { expect, test } from "bun:test";
import { extractArticleText } from "../src/main/article-text";

const paragraphs = Array.from({ length: 12 }, (_, index) => `<p>Section ${index}. ${"本文の根拠と詳細について説明しています。".repeat(20)}</p>`).join("");
test("extracts every article paragraph without scripts, navigation or footer", () => {
  const html = `<!doctype html><html><head><title>記事タイトル</title></head><body><nav>Navigation canary</nav><article><h1>記事タイトル</h1>${paragraphs}<p>FINAL ARTICLE CONCLUSION</p><script>globalThis.executed = true</script></article><footer>Footer canary</footer></body></html>`;
  const text = extractArticleText(html, "https://example.com/story");
  expect(text).toContain("Section 0");
  expect(text).toContain("Section 11");
  expect(text).toContain("FINAL ARTICLE CONCLUSION");
  expect(text).not.toMatch(/Navigation canary|Footer canary|globalThis/);
});
test("rejects empty pages instead of claiming the page is an article", () => {
  expect(() => extractArticleText("<html><body><nav>Login</nav></body></html>", "https://example.com")).toThrow();
});
