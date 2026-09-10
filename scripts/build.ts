import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist/web", { recursive: true });
const web = await Bun.build({ entrypoints: ["src/ui/main.tsx"], outdir: "dist/web", target: "browser", format: "esm", minify: true, naming: "[name].[ext]" });
if (!web.success) throw new AggregateError(web.logs, "Renderer build failed");
await copyFile("src/ui/index.html", "dist/web/index.html");
await copyFile("assets/icon.png", "dist/icon.png");
const desktop = await Bun.build({ entrypoints: ["src/main/electron.ts"], outdir: "dist", target: "node", format: "cjs", packages: "bundle", external: ["electron"], naming: "[name].cjs" });
if (!desktop.success) throw new AggregateError(desktop.logs, "Desktop build failed");
console.log("Built Reedar desktop and reader UI.");
