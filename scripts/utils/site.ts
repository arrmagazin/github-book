/// <reference types="node" />
// Site resolution. A site is a folder `www_<name>/` at the repo root holding an
// `index.html`; that folder is the site's Firebase public root. Its index.html is the
// ONE place the source repo is stated, in `window.R.book` (the `<script id="R">` JSON
// that scripts/generateIndexHtml.ts writes):
//
//   "indexUrl": "https://data.jsdelivr.com/v1/packages/gh/<owner>/<repo>@<ref>?structure=tree",
//   "scope": "docs"                         // the folder of the repo holding the markdown
//
// The web app reads them in the browser; the book builder reads them here.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** The github-book root, absolute. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const PREFIX = "www_";

/** Every site, sorted: each `www_<name>` folder that holds an index.html. */
export function sites(): string[] {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(PREFIX) && e.name.length > PREFIX.length)
    .filter((e) => fs.existsSync(path.join(ROOT, e.name, "index.html")))
    .map((e) => e.name.slice(PREFIX.length))
    .sort();
}

const listing = () => sites().join(", ") || "(none)";

/** The absolute folder of site `name`; throws if no such site exists. */
export function siteDir(name: string): string {
  const dir = path.join(ROOT, `${PREFIX}${name}`);
  if (!name || !fs.existsSync(path.join(dir))) {
    throw new Error(`No site "${name}": expected ${PREFIX}${name}/index.html. Sites: ${listing()}`);
  }
  return dir;
}

/** The site named by env SITE; exits with a message listing the sites if unset or unknown. */
export function requireSite(): string {
  const name = process.env.SITE ?? "";
  if (!name) {
    console.error(`❌ Set SITE=<site>. Sites: ${listing()}`);
    process.exit(1);
  }
  try {
    siteDir(name);
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  return name;
}

// The config script, and the jsDelivr listing URL inside it that names the repo and ref.
const R_RE = /<script id="R" type="application\/json">([\s\S]*?)<\/script>/;
const INDEX_URL_RE = /\/gh\/([^/@\s]+)\/([^/@\s]+)@([^?\s]+)\?/;

/** Where site `name` takes its markdown from, parsed from `window.R.book` in its index.html. */
export function siteSource(name: string): { owner: string; repo: string; ref: string; scope: string } {
  const file = path.join(siteDir(name), "index.html");
  const json = fs.readFileSync(file, "utf8").match(R_RE);
  if (!json) throw new Error(`${file}: no <script id="R" type="application/json">`);
  const { indexUrl = "", scope } = JSON.parse(json[1]).book ?? {};
  const repo = indexUrl.match(INDEX_URL_RE);
  if (!repo) throw new Error(`${file}: R.book.indexUrl does not name <owner>/<repo>@<ref>`);
  if (typeof scope !== "string") throw new Error(`${file}: no R.book.scope`);
  return { owner: repo[1], repo: repo[2], ref: repo[3], scope };
}
