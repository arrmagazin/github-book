# github-book

One repo that hosts **many book sites**. Each site shows a book whose markdown lives in a
**public GitHub repo**, served by jsDelivr at a tag. The same repo builds each site's book
as an EPUB and a PDF from that repo's content. This repo holds no book content of its own:
content repos own their markdown, their releases and their checkers.

## Structure

| Path | What it is |
| --- | --- |
| `www_<site>/` | One site: its Firebase public root, and the inputs for its book. See **Sites** |
| `shared/www/` | Files every site serves unchanged. The one copy of each. See **Shared files** |
| `shared/template/` | Files `new-site` fills in for a new site, with `{{placeholders}}` |
| `index.ts`, `index.css` | The app shell, the same for every site |
| `cml/` | The page-shell templates `gen:index` renders a site's `index.html` from. See **Generating index.html** |
| `scripts/` | Site tooling: `serve.ts`, `build.ts`, `generateIndexHtml.ts`, `new-site.ts`, `deploy.sh`, `link-shared.sh`, `link-modules.sh`, `bump-version.sh`, `utils/` |
| `book/` | The book builder. See [book/README.md](book/README.md) |
| `firebase.json`, `.firebaserc` | Hosting: one entry and one target per site |
| `build/` | Gitignored: `build/<site>/` per site, `build/diagrams/` shared |
| `tsconfig.json`, `biome.json` | TypeScript and lint config. biome skips `firebase.json` and `.firebaserc`, which `new-site` writes with `JSON.stringify` |

## Sites

A site is a folder `www_<name>/` at the root that holds an `index.html`. The folder name
minus `www_` is the site name. `scripts/utils/site.ts` is the one place that knows this:

| Export | Does |
| --- | --- |
| `sites()` | Every site, sorted |
| `siteDir(name)` | The site's folder; throws if there is no such site |
| `requireSite()` | The site named by env `SITE`; exits with the list of sites if unset or unknown |
| `siteSource(name)` | `{ owner, repo, ref, scope }`, parsed from the site's `index.html` |

A site folder holds:

| File | Served | Purpose |
| --- | --- | --- |
| `index.html` | yes | Page shell and `window.R`, the app's one config surface |
| `favicon.svg`, `site.webmanifest` | yes | Icon and PWA manifest |
| `version` | yes | Deploy counter; the service worker's cache key. Never hand-edit |
| `service-worker.js` | yes | Symlink to `../shared/www/service-worker.js` |
| `dist/` | yes | The bundle, built per site. Gitignored |
| `book.yaml` | no | pandoc metadata for the book: title, subtitle, author, rights |
| `cover.png` | no | The book cover's photograph. Optional |

**`SITE` picks the site** for every per-site command. npm runs scripts with `sh`, and
`${SITE:?set SITE=<site>}` in `package.json` fails fast when it is unset.

```sh
SITE=engx npm run dev        # serve www_engx on :8092 (PORT overrides)
SITE=engx npm run build      # bundle into www_engx/dist
SITE=engx npm run deploy     # bump www_engx/version, build, deploy
npm run book                 # every site's book; SITE=engx for one
```

## Shared files

`shared/www/` holds files every site serves unchanged (today `service-worker.js`). Each
is **spread into every site by a relative symlink**, never copied:
`www_<site>/service-worker.js -> ../shared/www/service-worker.js`.

- The links are committed; git stores them as symlinks.
- firebase-tools follows them on deploy (its `lib/listFiles.js` globs with `follow: true`),
  and esbuild's dev server follows them too.
- `scripts/link-shared.sh` makes the links. For every site and every file in `shared/www/`:
  creates a missing link, fixes one that points elsewhere, and **skips a real file** with
  a note. It is idempotent. `npm install` (via `postinstall` → `link`) and `new-site` run it.
- A site that needs its own version of a shared file replaces the link with a real file.
  The spreader then leaves it alone.
- To share a new file: put it in `shared/www/`, run `npm run link`, commit the links.

## The web app

`index.ts` calls `launchBook()` from `arrmatura-books`, which supplies the whole UI. UI
changes belong in `arrmatura-books`; the local `cml/` holds only the static page shell
(see **Generating index.html**). `index.css` is the Tailwind v4 + DaisyUI entry. `scripts/build.ts` bundles into
`./www_<SITE>/dist`; `scripts/serve.ts` serves `./www_<SITE>` with esbuild and rebuilds
on change.

**Library links.** `npm install` runs `postinstall` → `link`, which runs
`scripts/link-modules.sh arrmatura-books arrmatura ultimus` (symlinks the sibling checkouts
into `node_modules`; `arrmatura` is for `gen:index`), then `link-shared.sh`.

### The docs come from jsDelivr, not from a local tree

`window.R` in the inline `<script>` of `www_<site>/index.html` is the only config surface.
Two constants above it name the source, and they are the **one place** it is stated:

```js
const repo = 'arrmagazin/engx@1.0.1';   // <owner>/<repo>@<ref>
const scope = "docs";                   // the repo folder holding the markdown
...
"book": {
  "indexUrl": "https://data.jsdelivr.com/v1/packages/gh/"+repo+"?structure=tree",
  "docUrl": "https://cdn.jsdelivr.net/gh/"+repo+"/"+scope+"/*",
  scope,
}
```

The browser reads them, and so does the book builder, through `siteSource()`. Keep both
lines in that shape (either quote style). So the site, locally too, shows the docs as of
that tag, not any working tree.

### Generating index.html

`REPO=engx VERSION=1.0.1 npm run gen:index` (or `npm run gen:index:engx`) rewrites
`www_<REPO>/index.html` from the templates in `cml/`, so the shell and `window.R` cannot
drift between sites. `REPO` names the site and the content repo, which share the name;
owner and scope come from the site's current `index.html` (`siteSource`), `VERSION`
replaces the ref. `window.R.app` is filled from the content repo's `package.json` at that
tag, fetched from jsDelivr: `name` → `id`, `displayName` → `name`, and `version`,
`description`, `author`, `keywords`, `email`, `copyright` as they are. The `<meta>` tags
read the same values.

- `cml/html.xml` is the document frame (`Html`) and the page (`Index`, an empty body);
  `cml/head.xml` is `Head` and the `SEO` tags. The script runs under
  `bun --loader .xml:txt`, which imports them as strings.
- Inline JS in a template is CML text: a bare `{ }` is read as an expression and silently
  dropped. So the script in `head.xml` has no blocks or object literals; `window.R` comes
  in as data (`R.bootstrap`) through the `json` pipe, and the `if` is a single statement.
  `&&` is written `&amp;&amp;`. `htmlStringify` writes `script`/`style` text raw (ultimus);
  before that fix the same JS came out as `&amp;&amp;`.
- The generated script still opens with the `const repo` / `const scope` lines, in the
  shape `siteSource()` parses; the browser does not use them.

### Cross-document links

Docs link to each other the way they do on GitHub: `sibling.md`, `sub/child.md`,
`../other-dir/doc.md`. `DocsService.gotoLocalLink` resolves each href against the document
it appears in and matches the result against the file tree, so all of them navigate
in-app. A `.md` target missing from the tree logs `No such document: …` rather than
opening a dead tab. Bare `#anchor` links do nothing: the renderer emits no heading ids,
and the app is hash-routed, so following one would clobber the current route.

## Deploy

`SITE=<site> npm run deploy`:

1. `predeploy` bumps `www_<site>/version` (`bump-version.sh`) and runs `npm run build`.
2. `scripts/deploy.sh <site>` finds the project whose `.firebaserc`
   `targets.<project>.hosting` names `<site>`, then runs
   `firebase deploy --only hosting:<site> --config ./firebase.json -P <project>`.
   Extra args pass through: `./scripts/deploy.sh engx --dry-run`.

- `firebase.json` `hosting` is an **array**, one entry per site:
  `{ target, public: "www_<site>", ignore, headers, rewrites }`. Every entry has the same
  shape; only `target` and `public` differ.
- `.firebaserc` maps each target to its Firebase site id:
  `targets.parlang.hosting.engx = ["software-engineering"]`.
- `ignore` drops `book.yaml` and `cover.png` (book inputs are not served), source maps and
  dotfiles.
- `service-worker.js` derives its cache name from `/version`, so the bump is what
  invalidates stale client caches. Never hand-edit `version`.
- `version` needs its `no-store` header (in `firebase.json`) and must not be named
  `.version`: the `**/.*` ignore would silently drop it.
- `** -> /index.html` rewrite: every path serves the app.
- Port 8092 by default; `npm run stop` frees it. 8091 is the almaat site.

## Add a site

```sh
npm run new-site -- <name> <firebase-site-id> <owner/repo@ref> [--scope docs] [--project parlang]
```

It creates `www_<name>/` from `shared/template/` with `version` 0, appends a
`firebase.json` entry (a copy of the first, with the new `target` and `public`), adds the
`.firebaserc` target, and runs `link-shared.sh`. It refuses if the folder or the target
already exists, or if another target already deploys to `<firebase-site-id>` (deploying
either would replace the other's release). `--project` may be an alias from `.firebaserc`
`projects`; the target is written under the project id it names, where firebase-tools
looks for it.

Optional flags fill the template: `--title`, `--description`, `--keywords a,b`,
`--book-title`, `--subtitle`, `--author`, `--language`, `--year`, `--book-description`,
`--subjects a,b`. Values are written in unescaped: into HTML attributes, JSON strings and
double-quoted YAML scalars. So they may not contain `"`, `<`, `>`, `&`, `\` or line breaks;
anything else, `: ` and `#` included, is safe.

Then, by hand:

- `firebase hosting:sites:create <firebase-site-id>`, once; `new-site` writes config only.
- Add `www_<name>/cover.png` for the book cover.
- Review `index.html` and `book.yaml`. The template carries fixed values copied from engx:
  author `Company, Inc`, the contact email, `© 2025`, `"version": "1.0.0"`,
  `data-theme="corporate"`, theme colour `#1060c8`, and engx's favicon.

## Publish doc changes

The site shows a tag, so a doc change goes live in three steps:

1. In the content repo: commit, push, and release a new tag. jsDelivr serves tags.
2. Here: `REPO=<site> VERSION=<new-tag> npm run gen:index` rewrites `www_<site>/index.html`
   (or set `const repo = '<owner>/<repo>@<new-tag>'` by hand).
3. `SITE=<site> npm run deploy`.

The book follows the same line: `SITE=<site> npm run book` clones the new tag.

## The book

`npm run book` builds every site's book; `SITE=<site>` builds one. Flags: `--epub`,
`--pdf`, `--markdown`, `--src <dir>` (a local checkout, one site only), `--refresh`.

- Source: `siteSource()` gives repo, ref and scope; the builder shallow-clones the ref into
  `build/<site>/src/<owner>/<repo>/<ref>/` and reuses it until `--refresh`. The ref must be
  an exact tag or branch, not a jsDelivr range.
- Outputs: `build/<site>/<site>.md`, `.epub`, `.pdf`. Diagrams cache in `build/diagrams/`.
- Needs pandoc, xelatex (PDF), git, npx (mermaid) and Chrome (cover). Missing `book.yaml`
  fails that site; missing `cover.png` or Chrome only drops the cover.
- Known state: `arrmagazin/engx@1.0.1`, the tag `www_engx` pins, fails the structure check
  (two links to `#glossary--delivery` and `#glossary--solution`; engx fixed them after the
  tag). Until a new tag is released and pinned, build engx from its working tree:
  `SITE=engx npm run book -- --src ../engx`.

Why it does what it does (titles, reading order, page breaks, ids, links, `---`, mermaid,
cover, void tags, image formats, table rules, callouts, PDF layout) is in
[book/README.md](book/README.md). Read it before changing `book/`, and keep it in step.

## Working conventions

- Plain standard English in docs and comments; no rare words, no idioms.
- `book/` uses Node built-ins only and runs on bun. Keep its modules near 250 lines, split
  by concern, and keep the comments that carry the reasons.
- Nothing in `book/` or `scripts/` hard-codes one site. Per-site paths come from `SITE`,
  `siteDir()` or the book's `Site` object.
- One copy of each idea: a file every site serves goes in `shared/www/` and is linked;
  the source repo is stated only in `index.html`.
- No `release` or checker scripts here: content repos own those.
