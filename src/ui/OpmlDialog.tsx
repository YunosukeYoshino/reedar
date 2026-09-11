import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { Action, OpmlImport } from "../shared/schema";
import { Dialog } from "./Dialog";

type Props = { report: OpmlImport | null | undefined; hasFeeds: boolean; act: (action: Action) => Promise<void>; perform: (action: Action) => void };
const resultLabels = { imported: "登録", skipped: "スキップ", failed: "失敗" };

export function OpmlDialog({ report, hasFeeds, act, perform }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = report?.status === "running";
  async function importFile() {
    if (sending || running) return;
    const file = fileInput.current?.files?.[0];
    if (!file) { setError("OPMLファイルを選択してください。"); return; }
    if (file.size > 262_144) { setError("OPMLファイルは256KB以下にしてください。"); return; }
    setSending(true); setError(null);
    try {
      let xml: string;
      try { xml = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
      catch { throw new Error("UTF-8で保存したOPMLファイルを選択してください。"); }
      await act({ type: "opml.import", xml });
    }
    catch (error: unknown) { setError(error instanceof Error ? error.message : "OPMLを読み込めませんでした。"); }
    finally { setSending(false); }
  }
  return <Dialog id="opml-dialog" title="OPML入出力">
    <p className="dialog-description" id="opml-help">他のRSSリーダーからフィードを移行できます。UTF-8のOPMLファイル（256KB・200フィードまで）に対応しています。重複はスキップし、削除済みのフィードは復元します。階層のあるフォルダ名は「親 / 子」にまとめます。</p>
    <form onSubmit={(event) => { event.preventDefault(); void importFile(); }}>
      <label htmlFor="opml-file">読み込むOPMLファイル</label><input ref={fileInput} id="opml-file" name="opml" type="file" accept=".opml,.xml,text/x-opml,text/xml,application/xml" required disabled={sending || running} aria-describedby={error ? "opml-help opml-error" : "opml-help"} aria-invalid={!!error} onChange={() => setError(null)} />
      {error ? <p className="form-error" id="opml-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><button className="primary-button" type="submit" disabled={sending || running}><Upload size={14} />{sending ? "ファイルを確認中…" : "OPMLを読み込む"}</button>{running ? <button className="secondary-button" type="button" aria-label="OPMLの読み込みを中止" onClick={() => perform({ type: "opml.stop" })}>中止</button> : null}</div>
    </form>
    {report ? <ImportReport report={report} /> : null}
    <div className="opml-export"><h3>登録中のフィードを書き出す</h3><p className="dialog-description">フィードURLとフォルダ名を保存します。記事本文・スター・AIの会話・削除済みのフィードは含みません。</p>{hasFeeds ? <a className="secondary-button" href="/api/opml" download="Reedar.opml"><Download size={14} />OPMLを書き出す</a> : <button className="secondary-button" disabled><Download size={14} />OPMLを書き出す</button>}</div>
  </Dialog>;
}

function ImportReport({ report }: { report: OpmlImport }) {
  const running = report.status === "running";
  const counts = { imported: 0, skipped: 0, failed: 0 };
  for (const result of report.results) counts[result.status]++;
  return <section className="opml-report" aria-label="OPMLの読み込み結果"><p role="status">{running ? "読み込み中" : report.status === "cancelled" ? "読み込みを中止しました" : report.status === "failed" ? "読み込みを完了できませんでした" : report.total ? "読み込みが完了しました" : "フィードがありませんでした"} · {report.results.length} / {report.total}件</p>{running ? <progress aria-label="OPMLの読み込み進捗" value={report.results.length} max={report.total || 1} /> : null}<p className="opml-counts">登録 {counts.imported} · スキップ {counts.skipped} · 失敗 {counts.failed}</p>{report.error ? <p className="form-error" role="alert">{report.error}</p> : null}<ul className="opml-results">{report.results.map((result) => <li key={result.id}><div><strong>{result.title}</strong><span className={`opml-result-${result.status}`}>{resultLabels[result.status]}</span></div><p>{result.detail}</p></li>)}</ul>{report.status === "cancelled" ? <p className="dialog-footnote">中止する前に登録が完了したフィードは保持されています。</p> : null}</section>;
}
