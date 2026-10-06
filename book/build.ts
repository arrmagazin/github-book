#!/usr/bin/env bun
/**
 * Assemble each site's markdown into one document and render it as an EPUB and a PDF.
 *
 * Node built-ins only. Pandoc does the rendering. The modules beside this one do the
 * part pandoc cannot: put the files in reading order, demote their headings so a
 * folder reads as a chapter, turn cross-document links into intra-document anchors so
 * navigation still works when many files become one (assemble.ts), and rasterize the
 * mermaid diagrams (diagrams.ts) and the cover (cover.ts), which neither output format
 * can draw.
 *
 *     bun book/build.ts                      # every site, both formats
 *     SITE=engx bun book/build.ts --pdf      # one site, one format
 *     SITE=engx bun book/build.ts --src ../engx --markdown
 *
 * A site's book takes its file name from the site: build/<site>/<site>.md, .epub, .pdf.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { requireSite, sites } from "../scripts/utils/site";
import { assemble, collectDocuments } from "./assemble";
import { DIAGRAMS, type Site, warn } from "./context";
import { buildCover } from "./cover";
import { resolveMermaid } from "./diagrams";
import { duplicateAnchors } from "./markdown";
import { render, verifyAnchors } from "./render";
import { resolveSite, type SourceOptions } from "./source";

const USAGE = `usage: [SITE=<site>] bun book/build.ts [--epub] [--pdf] [--markdown] [--src <dir>] [--refresh]

  SITE         the site to build; unset, every site in turn
  --epub       build the EPUB only
  --pdf        build the PDF only
  --markdown   assemble build/<site>/<site>.md and stop
  --src <dir>  read the markdown from a local checkout instead of cloning
               the tag in <site>_www/index.html (needs a single SITE)
  --refresh    discard the cached clone and clone again`;

interface Options extends SourceOptions {
  epub: boolean;
  pdf: boolean;
  markdownOnly: boolean;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Flags and their one value. Exits with the usage on anything it does not know. */
function parseArgs(argv: string[]): Options | null {
  const options: Options = { epub: false, pdf: false, markdownOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return null;
    else if (arg === "--epub") options.epub = true;
    else if (arg === "--pdf") options.pdf = true;
    else if (arg === "--markdown") options.markdownOnly = true;
    else if (arg === "--refresh") options.refresh = true;
    else if (arg === "--src") {
      options.src = argv[++i];
      if (!options.src || options.src.startsWith("--")) fail(`--src needs a directory\n\n${USAGE}`);
    } else fail(`unknown option ${arg}\n\n${USAGE}`);
  }
  return options;
}

/** Assemble, verify and render one site's book. Throws on anything that stops it. */
async function buildSite(site: Site, options: Options): Promise<void> {
  const documents = collectDocuments(site);

  // Before the assembled file is written, so that what verifyAnchors checks and what
  // pandoc reads are the same document. --markdown renders diagrams too: they are
  // the markdown's own content, and a cache hit costs nothing.
  const { markdown, diagrams, rendered } = resolveMermaid(assemble(documents, site));

  const source = path.join(site.build, `${site.name}.md`);
  fs.writeFileSync(source, markdown);
  const words = markdown.split(/\s+/).filter(Boolean).length;
  console.log(`assembled ${documents.length} documents, ${words.toLocaleString("en-US")} words -> ${source}`);
  if (diagrams) {
    console.log(`  ${diagrams} mermaid diagram(s): ${rendered} rendered, ${diagrams - rendered} cached -> ${DIAGRAMS}`);
  }

  for (const slug of duplicateAnchors(markdown)) warn(`  warning: heading slug '${slug}' occurs more than once`);

  const problems = verifyAnchors(source);
  for (const problem of problems) warn(`  error: ${problem}`);
  if (problems.length) throw new Error(`${problems.length} structural problem(s); not rendering`);
  console.log("  structure verified: every heading and link target resolves");

  if (options.markdownOnly) return;

  // Both formats take the same cover, so it is rendered once, before either.
  const cover = await buildCover(site);

  const both = !(options.epub || options.pdf);
  if (options.epub || both) {
    const out = path.join(site.build, `${site.name}.epub`);
    render(site, source, "epub", out, cover);
    console.log(`wrote ${out}`);
  }
  if (options.pdf || both) {
    const out = path.join(site.build, `${site.name}.pdf`);
    render(site, source, "pdf", out, cover);
    console.log(`wrote ${out}`);
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(argv);
  if (!options) {
    console.log(USAGE);
    return 0;
  }

  // One SITE, or every site. --src names one checkout, so it can only feed one site.
  if (options.src && !process.env.SITE) fail(`--src needs a single site: SITE=<site> bun book/build.ts --src ${options.src}`);
  const names = process.env.SITE ? [requireSite()] : sites();
  if (!names.length) fail("no sites: expected at least one <site>_www/index.html");

  if (!options.markdownOnly && spawnSync("pandoc", ["--version"]).error) fail("pandoc is not installed: brew install pandoc");

  // A failing site is reported and skipped, so one broken book does not hold back
  // the rest; the exit code still says something failed.
  const failed: string[] = [];
  for (const name of names) {
    console.log(`\n== ${name}`);
    try {
      await buildSite(resolveSite(name, options), options);
    } catch (error) {
      console.error(`  error [${name}]: ${(error as Error).message}`);
      failed.push(name);
    }
  }
  if (failed.length) console.error(`\nfailed: ${failed.join(", ")}`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
