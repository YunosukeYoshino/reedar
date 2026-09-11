import Markdown from "react-markdown";

export function MarkdownText({ text }: { text: string }) {
  return <Markdown skipHtml urlTransform={(url) => { try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; } catch { return ""; } }} components={{ img: () => null, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{text}</Markdown>;
}
