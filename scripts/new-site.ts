/// <reference types="node" />
// Usage: bun scripts/new-site.ts <name> <firebase-site-id> <owner/repo@ref> [--scope docs] [--project parlang]
//                                [--title T] [--description D] [--keywords a,b] [--book-title T] [--subtitle S]
//                                [--author A] [--language L] [--book-description D] [--subjects a,b]
//
// Adds a site: <name>_www/ from shared/template/ (every {{placeholder}} filled), a firebase.json
// hosting entry, and the .firebaserc target mapping <name> to <firebase-site-id> in <project>.
// Then runs scripts/link-shared.sh, which links shared/www/* into the new folder.
// Refuses when <name>_www/ or the target already exists. Does not create the Firebase site:
// `firebase hosting:sites:create <firebase-site-id>` does that, once.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROOT } from "./utils/site";

const TEMPLATE = path.join(ROOT, "shared", "template");

/** `engx` -> `Engx`, `clean-code` -> `Clean code`. */
const titleCase = (name: string) => name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

const list = (csv: string) =>
  csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Every {{placeholder}} the templates use. Plain values come from `--kebab-flag` options or
 * their defaults; the list-shaped ones are rendered here once for each place they appear.
 */
export function templateVars(name: string, repo: string, opts: Record<string, string> = {}) {
  const title = opts.title ?? titleCase(name);
  const description = opts.description ?? title;
  const keywords = list(opts.keywords ?? "");
  const subjects = list(opts.subjects ?? title);
  return {
    name,
    repo,
    scope: opts.scope ?? "docs",
    title,
    description,
    keywordsMeta: keywords.map((k) => `&quot;${k}&quot;`).join(","),
    keywordsJson: JSON.stringify(keywords).replace(/","/g, '", "'),
    bookTitle: opts.bookTitle ?? title,
    subtitle: opts.subtitle ?? description,
    author: opts.author ?? "Company, Inc",
    language: opts.language ?? "en-GB",
    year: opts.year ?? String(new Date().getFullYear()),
    bookDescription: opts.bookDescription ?? description,
    subjectsYaml: subjects.map((s) => `\n  - ${s}`).join(""),
  };
}

/** Fills every {{key}}; throws on a placeholder with no value, so none ships unfilled. */
export function fill(text: string, vars: Record<string, string>, file = "template"): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`${file}: no value for {{${key}}}`);
    return vars[key];
  });
}

/** Writes every shared/template file, filled, into `dir`. */
export function instantiate(dir: string, vars: Record<string, string>) {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(TEMPLATE)) {
    const text = fs.readFileSync(path.join(TEMPLATE, file), "utf8");
    fs.writeFileSync(path.join(dir, file), fill(text, vars, file));
  }
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const writeJson = (file: string, x: unknown) =>
  fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(x, null, 2)}\n`);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`${arg} needs a value`);
    opts[arg.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
  }
  return { positional, opts };
}

const KNOWN = [
  "scope",
  "project",
  "title",
  "description",
  "keywords",
  "bookTitle",
  "subtitle",
  "author",
  "language",
  "year",
  "bookDescription",
  "subjects",
];
const USAGE =
  "usage: bun scripts/new-site.ts <name> <firebase-site-id> <owner/repo@ref> [--scope docs] [--project parlang]";

function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const [name, siteId, repo] = positional;
  if (positional.length !== 3) throw new Error(USAGE);
  const unknown = Object.keys(opts).filter((k) => !KNOWN.includes(k));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(", ")}\n${USAGE}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`site name "${name}": use lowercase kebab-case`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(siteId)) throw new Error(`firebase site id "${siteId}": use lowercase kebab-case`);
  if (!/^[\w.-]+\/[\w.-]+@[\w./-]+$/.test(repo)) throw new Error(`repo "${repo}": expected <owner>/<repo>@<ref>`);
  // Values land in HTML attributes, JSON strings and YAML scalars unescaped; keep them plain.
  for (const [k, v] of Object.entries(opts)) {
    if (/["<>&\\\n]/.test(v)) throw new Error(`--${k}: no quotes, <, >, &, \\ or line breaks`);
  }
  const project = opts.project ?? "parlang";

  const dir = path.join(ROOT, `${name}_www`);
  const firebase = readJson("firebase.json");
  const rc = readJson(".firebaserc");
  if (!firebase.hosting?.[0]) throw new Error("firebase.json has no hosting entry to copy");
  if (fs.existsSync(dir)) throw new Error(`${name}_www/ already exists`);
  if (firebase.hosting.some((h: any) => h.target === name))
    throw new Error(`firebase.json already has target "${name}"`);
  for (const [p, t] of Object.entries<any>(rc.targets ?? {})) {
    if (t?.hosting?.[name]) throw new Error(`.firebaserc already has target "${name}" in project ${p}`);
  }

  instantiate(dir, templateVars(name, repo, opts));
  fs.writeFileSync(path.join(dir, "version"), "0");

  // Every entry has the same shape; only target and public root differ.
  const [first] = firebase.hosting;
  firebase.hosting.push({ ...structuredClone(first), target: name, public: `${name}_www` });
  writeJson("firebase.json", firebase);

  rc.targets ??= {};
  rc.targets[project] ??= {};
  rc.targets[project].hosting ??= {};
  rc.targets[project].hosting[name] = [siteId];
  writeJson(".firebaserc", rc);

  execFileSync(path.join(ROOT, "scripts", "link-shared.sh"), { stdio: "inherit" });

  console.log(`✅ Site "${name}" -> ${siteId} (project ${project}), docs from ${repo}`);
  console.log(`   Next: add ${name}_www/cover.png for the book cover, review ${name}_www/book.yaml,`);
  console.log(`   then SITE=${name} npm run dev`);
}

if (import.meta.main) {
  try {
    main();
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
