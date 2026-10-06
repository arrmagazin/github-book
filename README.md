# github-book

Book sites from GitHub repos. Each site here shows a book whose markdown lives in a public
GitHub repo, read at a tagged release through jsDelivr. The same repo also renders each
book as an EPUB and a PDF. One app shell, one service worker and one book builder serve
every site.

| Site | Folder | URL | Content |
| --- | --- | --- | --- |
| `engx` | [www_engx/](www_engx/) | <https://software-engineering.web.app> | [arrmagazin/engx](https://github.com/arrmagazin/engx) |

## How it fits together

```text
github.com/<owner>/<repo>@<tag>/<scope>/*.md
        │                         │
   jsDelivr (browser)       git clone (book build)
        │                         │
  www_<site>/  ── Firebase    build/<site>/<site>.epub, .pdf
```

- **A site** is a folder `www_<site>/`: the Firebase public root. Its `index.html` names
  the content repo and tag in one line, `const repo = '<owner>/<repo>@<tag>'`, and the
  folder inside it in another, `const scope = "docs"`. Both the site and the book builder
  read those lines.
- **Shared files** live once in [shared/www/](shared/www/) and are spread into every site
  by relative symlinks, so each site's `service-worker.js` is a link to
  `../shared/www/service-worker.js`. A site that needs its own version replaces the link
  with a real file.
- **The UI** is `arrmatura-books`, a sibling checkout; `index.ts` only calls `launchBook()`.

## Run a site

Needs [bun](https://bun.sh) (it runs every serve, build, book and new-site script), the
sibling checkouts `../arrmatura-books` and `../ultimus` (linked into `node_modules`), and
for deploys the [firebase CLI](https://firebase.google.com/docs/cli), logged in. The book
tools are listed under **Build the books**.

```sh
npm install                  # once: toolchain, library links, shared-file links
SITE=engx npm run dev        # serves engx on http://localhost:8092
```

| Command | What it does |
| --- | --- |
| `SITE=<site> npm run dev` | Serves the site on :8092 (`PORT` overrides), opens a browser |
| `SITE=<site> npm run build` | Bundles the app and CSS into `www_<site>/dist` |
| `SITE=<site> npm run deploy` | Bumps `www_<site>/version`, builds, deploys that site's hosting |
| `REPO=<site> VERSION=<tag> npm run gen:index` | Rewrites `www_<site>/index.html` from `cml/`, `window.R.app` from the content repo's `package.json` at that tag |
| `npm run stop` | Frees the port |
| `npm run book` | Builds every site's book; `SITE=<site>` for one |
| `npm run new-site -- …` | Adds a site (see below) |
| `npm run link` | Re-creates the library and shared-file links |

The site shows the docs as of the tag in its `index.html`, not any local working tree.

## Build the books

```sh
npm run book                               # every site, EPUB and PDF
SITE=engx npm run book -- --pdf            # one site, one format
SITE=engx npm run book -- --src ../engx    # from a local checkout, before tagging
```

The builder clones each site's tag into `build/<site>/src/` and writes
`build/<site>/<site>.epub` and `.pdf`. It needs `pandoc`, and the PDF also needs
`xelatex`; `--markdown` assembles and checks the structure without rendering either.
Title, author and rights come from `www_<site>/book.yaml`; the cover is generated from
them over `www_<site>/cover.png`. Details: [book/README.md](book/README.md).

> Known state: `www_engx` pins `arrmagazin/engx@1.0.1`, which fails the structure check
> (two dead glossary links, fixed in engx after that tag), so `npm run book` reports
> `failed: engx`. Until a new tag is released and pinned, use
> `SITE=engx npm run book -- --src ../engx`.

## Add a site

```sh
npm run new-site -- clean-code clean-code-book someone/clean-code@v1.0.0 --title "Clean Code"
firebase hosting:sites:create clean-code-book
```

That creates `www_clean-code/` from [shared/template/](shared/template/), adds its
`firebase.json` entry and `.firebaserc` target, and links the shared files. Then add
`www_clean-code/cover.png`, review `index.html` and `book.yaml`, and run
`SITE=clean-code npm run dev`.

## Publish doc changes

1. In the content repo: commit, push, release a new tag.
2. Here: `REPO=<site> VERSION=<tag> npm run gen:index` rewrites `www_<site>/index.html`.
3. `SITE=<site> npm run deploy`.

Agent and maintainer notes are in [CLAUDE.md](CLAUDE.md).
