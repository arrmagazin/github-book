# github-book

Book sites from GitHub repos. Each site here shows a book whose markdown lives in a public
GitHub repo, read at a tagged release through jsDelivr. The same repo also renders each
book as an EPUB and a PDF. One app shell, one service worker and one book builder serve
every site.

| Site | Folder | URL | Content |
| --- | --- | --- | --- |
| `engx` | [engx_www/](engx_www/) | <https://software-engineering.web.app> | [arrmagazin/engx](https://github.com/arrmagazin/engx) |

## How it fits together

```text
github.com/<owner>/<repo>@<tag>/<scope>/*.md
        │                         │
   jsDelivr (browser)       git clone (book build)
        │                         │
  <site>_www/  ── Firebase    build/<site>/<site>.epub, .pdf
```

- **A site** is a folder `<site>_www/`: the Firebase public root. Its `index.html` names
  the content repo and tag in one line, `const repo = '<owner>/<repo>@<tag>'`, and the
  folder inside it in another, `const scope = "docs"`. Both the site and the book builder
  read those lines.
- **Shared files** live once in [shared/www/](shared/www/) and are spread into every site
  by relative symlinks, so each site's `service-worker.js` is a link to
  `../shared/www/service-worker.js`. A site that needs its own version replaces the link
  with a real file.
- **The UI** is `arrmatura-books`, a sibling checkout; `index.ts` only calls `launchBook()`.

## Run a site

```sh
npm install                  # once: toolchain, library links, shared-file links
SITE=engx npm run dev        # serves engx on http://localhost:8092
```

| Command | What it does |
| --- | --- |
| `SITE=<site> npm run dev` | Serves the site on :8092 (`PORT` overrides), opens a browser |
| `SITE=<site> npm run build` | Bundles the app and CSS into `<site>_www/dist` |
| `SITE=<site> npm run deploy` | Bumps `<site>_www/version`, builds, deploys that site's hosting |
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
Title, author and rights come from `<site>_www/book.yaml`; the cover is generated from
them over `<site>_www/cover.png`. Details: [book/README.md](book/README.md).

## Add a site

```sh
npm run new-site -- clean-code clean-code-book someone/clean-code@v1.0.0 --title "Clean Code"
firebase hosting:sites:create clean-code-book
```

That creates `clean-code_www/` from [shared/template/](shared/template/), adds its
`firebase.json` entry and `.firebaserc` target, and links the shared files. Then add
`clean-code_www/cover.png`, review `index.html` and `book.yaml`, and run
`SITE=clean-code npm run dev`.

## Publish doc changes

1. In the content repo: commit, push, release a new tag.
2. Here: set that tag in `const repo` in `<site>_www/index.html`.
3. `SITE=<site> npm run deploy`.

Agent and maintainer notes are in [CLAUDE.md](CLAUDE.md).
