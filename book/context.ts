/**
 * Where things live: the paths shared by every site, and the per-site context.
 *
 * Nothing here is derived from one site's layout. A site's paths travel in a `Site`
 * object, built by source.ts and handed to whatever needs them.
 */

import * as path from "node:path";
import { ROOT } from "../scripts/utils/site";

export { ROOT };

export const BUILD = path.join(ROOT, "build");

// Content-addressed, so one cache serves every site: a diagram is named by a digest
// of its own source, and two sites drawing the same diagram share one render.
export const DIAGRAMS = path.join(BUILD, "diagrams");

const BOOK_DIR = path.join(ROOT, "book");
export const TABLE_WIDTHS = path.join(BOOK_DIR, "table-widths.lua");
export const TABLE_RULES = path.join(BOOK_DIR, "table-rules.lua");
export const CODE_BREAKS = path.join(BOOK_DIR, "code-breaks.lua");
export const EPUB_CSS = path.join(BOOK_DIR, "epub.css");

/** One site's book: where its markdown comes from and where its outputs go. All absolute. */
export interface Site {
  name: string;
  dir: string; // www_<site>, the site's public root, holding its book inputs
  src: string; // root of the content repo checkout
  docs: string; // src/<scope>, the markdown the book is made from
  build: string; // build/<site>
  metadata: string; // <dir>/book.yaml
  coverPhoto: string; // <dir>/cover.png
}

export const warn = (message: string) => console.error(message);

/** A path relative to `from`, with forward slashes, as markdown and pandoc expect. */
export const relativePosix = (from: string, to: string) => path.relative(from, to).split(path.sep).join("/");
