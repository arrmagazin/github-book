/// <reference types="node" />
// Renders a site's index.html from the templates in cml/, with `window.R.app` filled from the
// content repo's package.json at the release the site shows:
//
//   REPO=engx VERSION=1.0.1 npm run gen:index     # bun --loader .xml:txt scripts/generateIndexHtml.ts engx 1.0.1
//
// REPO names the site (`www_<REPO>/`) and the content repo, which share the name. The owner and
// scope are read from the site's current index.html (siteSource); VERSION replaces its ref and
// is optional. Needs the `.xml:txt` loader: the templates are imported as strings.

import * as path from "node:path";
import { applyTemplate } from "arrmatura";
import { htmlStringify, join, stringifyJson } from "ultimus";
import head from "../cml/head.xml";
import html from "../cml/html.xml";
import seo from "../cml/seo.xml";
import indexApp from "../cml/index.xml";
import { writeFileContent } from "./utils/files";
import { siteDir } from "./utils/site";

type Source = { owner: string; repo: string; ref: string; scope: string };

/** A file of the content repo at a ref, as jsDelivr serves it. */
export const docUrl = ({ owner, repo, ref }: Source, file: string) =>
  `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${file}`;

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

/** `window.R.app`, from the content repo's package.json. */
export function appResources(pkg: any) {
  return {
    id: pkg.name,
    name: pkg.displayName ?? pkg.name,
    logo: "/favicon.svg",
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    keywords: pkg.keywords ?? [],
    email: pkg.email,
    copyright: pkg.copyright,
  };
}

/** `window.R`: the app block and the book's two jsDelivr endpoints at the pinned release. */
export function bootstrap(source: Source, app: object) {
  const { owner, repo, ref, scope } = source;
  return {
    app,
    book: {
      indexUrl: `https://data.jsdelivr.com/v1/packages/gh/${owner}/${repo}@${ref}?structure=tree`,
      docUrl: docUrl(source, `${scope}/*`),
      scope,
    },
  };
}

/** The `json` pipe: a value as a JSON literal, indented to sit inside the script. */
const json = (x: unknown) => stringifyJson(x).replaceAll("\n", "\n        ");

export async function main(source: Source) {
  const url = docUrl(source, "package.json");
  const app = appResources(await fetchJson(url));

  const config = {
    app,
    source,
    bootstrap: bootstrap(source, app),
    functions: { join, json },
    components: [html, head, seo, indexApp],
  };
  const root = applyTemplate(`<Index/>`, config);

  const file = path.join(siteDir(repo), "index.html");
  writeFileContent(file, `<!DOCTYPE html>\n${htmlStringify(root.nodes[0])}\n`);
  console.log(`✅ ${path.relative(process.cwd(), file)} ← ${url}`);
}

const [owner, repo, ref, scope] = process.argv[2].split("/");

const source = { owner, repo, ref, scope };
main(source).catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
