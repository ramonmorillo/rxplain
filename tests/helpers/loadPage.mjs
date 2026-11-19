import { JSDOM } from "jsdom";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function loadPage() {
  const dom = await JSDOM.fromFile(path.join(root, "index.html"), {
    url: pathToFileURL(path.join(root, "index.html")).href,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", () => resolve());
  });
  return dom;
}
