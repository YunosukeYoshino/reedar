import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";

const MAX_BYTES = 5 * 1024 * 1024;

export function publicUrl(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("認証情報を含まないHTTPまたはHTTPSのURLを入力してください。");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("フィードは標準のHTTP/HTTPSポートに対応しています。");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".")) {
    throw new Error("ローカルネットワークのURLにはアクセスできません。");
  }
  if (ipaddr.isValid(host) && !isPublicAddress(host)) {
    throw new Error("ローカルネットワークのURLにはアクセスできません。");
  }
  url.hash = "";
  return url;
}

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === "unicast"; }
  catch { return false; }
}

export async function fetchPublic(value: string, redirects = 0): Promise<{ body: Buffer; url: string; contentType: string }> {
  const url = publicUrl(value);
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address.address))) {
    throw new Error("このURLは公開インターネット上の配信元ではありません。");
  }
  const address = addresses[0];
  if (!address) throw new Error("配信元のアドレスを解決できません。");

  return new Promise((resolve, reject) => {
    // Pin the validated address so DNS cannot change between validation and connection.
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      agent: false,
      headers: { "User-Agent": "Reedar/0.1 (+local RSS reader)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, image/*;q=0.8, */*;q=0.1", "Accept-Encoding": "identity" },
    }, (response) => {
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 4 || !response.headers.location) return reject(new Error("リダイレクト先を取得できません。"));
        const next = new URL(response.headers.location, url).href;
        fetchPublic(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`配信元がHTTP ${response.statusCode ?? "エラー"}を返しました。`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error("配信データが大きすぎます（上限5MB）。"));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ body: Buffer.concat(chunks), url: url.href, contentType: response.headers["content-type"] ?? "" }));
    });
    const timeout = setTimeout(() => request.destroy(new Error("配信元への接続がタイムアウトしました。")), 20_000);
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
    request.end();
  });
}
