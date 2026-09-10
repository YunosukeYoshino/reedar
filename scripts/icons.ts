import { mkdir } from "node:fs/promises";

if (process.platform !== "darwin") throw new Error("macOS icon generation requires sips and iconutil.");

const directory = "build/icon.iconset";
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = String(size * scale);
    const target = `${directory}/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`;
    const result = Bun.spawn(["sips", "-z", pixels, pixels, "assets/icon.png", "--out", target], { stdout: "ignore", stderr: "inherit" });
    if (await result.exited !== 0) throw new Error(`Could not generate ${target}.`);
  }
}
const result = Bun.spawn(["iconutil", "-c", "icns", directory, "-o", "build/icon.icns"], { stdout: "inherit", stderr: "inherit" });
if (await result.exited !== 0) throw new Error("Could not generate the macOS icon.");
console.log("Built build/icon.icns from assets/icon.png.");
