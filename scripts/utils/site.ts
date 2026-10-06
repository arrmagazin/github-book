/// <reference types="node" />
// Site resolution. A site is a folder `www_<name>/` at the repo root holding an
// `index.html`; that folder is the site's Firebase public root. Its index.html is the
// ONE place the source repo is stated, in two constants of its inline script:
//
//   const repo = 'arrmagazin/engx@1.0.1';   // <owner>/<repo>@<ref>, the tag jsDelivr serves
//   const scope = "docs";                   // the folder of the repo holding the markdown
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
