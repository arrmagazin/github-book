/**
 * Where a site's markdown comes from.
 *
 * By default, from the same place the site serves it: the repo and tag named in
 * <site>_www/index.html (scripts/utils/site.ts reads them), shallow-cloned into
 * build/<site>/src/<owner>/<repo>/<ref>/. The book is then built from exactly what
 * the site shows. With --src, from a local checkout instead — a working tree, to preview a change
 * before it is tagged.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { siteDir, siteSource } from "../scripts/utils/site";
import { BUILD, ROOT, relativePosix, type Site } from "./context";

export interface SourceOptions {
  src?: string; // a local checkout of the content repo, used instead of a clone
  refresh?: boolean; // clone again, replacing a cached clone on success
}

/**
 * Shallow-clone `owner/repo` at `ref` into `dest`, unless a clone is already there.
 *
 * `dest` names owner, repo and ref, so pointing a site at another repo with the same
 * tag never reuses the old repo's clone. The clone lands on a partial path and is
 * renamed into place only once complete, so an interrupted clone is never mistaken
 * for a cached one. With `refresh`, the cached clone is removed only after the new one
 * has succeeded: a refresh that fails (offline, rate-limited, tag deleted) keeps it.
 * `ref` must be a tag or a branch: `--branch` takes nothing else, and jsDelivr's
 * version ranges (`@1`, `@latest`) mean nothing to git.
 */
function checkout(owner: string, repo: string, ref: string, dest: string, refresh: boolean): string {
  if (!refresh && fs.existsSync(dest)) return dest;
  const url = `https://github.com/${owner}/${repo}.git`;
  const partial = `${dest}.part`;
  fs.rmSync(partial, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(partial), { recursive: true });
  console.log(`  cloning ${owner}/${repo}@${ref} -> ${relativePosix(ROOT, dest)}`);
  // GIT_TERMINAL_PROMPT=0: a missing or private repo fails instead of asking for a password.
  const result = spawnSync("git", ["clone", "--quiet", "--depth", "1", "--branch", ref, url, partial], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (result.error) throw new Error("git is not installed");
  if (result.status !== 0) {
    fs.rmSync(partial, { recursive: true, force: true });
    throw new Error(
      `cannot clone ${url} at '${ref}': the ref must be an exact tag or branch, not a jsDelivr range\n` +
        result.stderr.trim(),
    );
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(partial, dest);
  return dest;
}

/**
 * The context for building site `name`: its inputs checked, its markdown on disk.
 *
 * Throws with a message naming the site when anything the book needs is missing.
 */
export function resolveSite(name: string, options: SourceOptions = {}): Site {
  const dir = siteDir(name);
  const build = path.join(BUILD, name);
  const metadata = path.join(dir, "book.yaml");
  if (!fs.existsSync(metadata)) {
    throw new Error(`missing ${relativePosix(ROOT, metadata)}: the book's title, author and rights live there`);
  }
  const { owner, repo, ref, scope } = siteSource(name);
  let src: string;
  if (options.src) {
    src = path.resolve(options.src);
    if (!fs.statSync(src, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`--src ${options.src} is not a directory`);
    }
  } else {
    for (const part of [owner, repo, ...ref.split("/")]) {
      if (!part || part === "." || part === ".." || part.includes("/")) {
        throw new Error(`'${owner}/${repo}@${ref}' does not make a usable directory name`);
      }
    }
    src = checkout(owner, repo, ref, path.join(build, "src", owner, repo, ref), options.refresh ?? false);
  }
  const docs = path.resolve(src, scope);
  if (!fs.statSync(docs, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`no '${scope}' folder in ${src}: index.html says the markdown lives there`);
  }
  fs.mkdirSync(build, { recursive: true });
  return { name, dir, src, docs, build, metadata, coverPhoto: path.join(dir, "cover.png") };
}
