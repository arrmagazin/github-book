import * as esbuild from "esbuild";
import { readFileJsonContent } from "./utils/files";
import { getEsbuildOptions } from "./utils/getEsbuildOptions";
import { requireSite } from "./utils/site";

export async function main(options: any = {}) {
  try {
    // The package.json `esbuild` block supplies the WHOLE option set — `format`, `outExtension`,
    // `packages`, anything esbuild accepts — not just entry points. Libraries emitting CJS for
    // their `require` condition need that; apps still get the browser/ESM defaults by naming
    // only `entryPoints` and `outdir`. An explicit argument outranks the file.
    const { esbuild: packageOptions = {} } = readFileJsonContent([`${process.cwd()}/package.json`]) ?? {};

    // One shell, many sites: the same bundle is built into the dist/ of the site SITE names.
    const outdir = `./www_${requireSite()}/dist`;

    const buildOptions = getEsbuildOptions({ outdir, ...packageOptions, ...options });

    // `--watch` keeps the process alive and rebuilds on change. Apps that run a library's dev
    // build alongside their own (firebasis under the emulators) depend on it.
    if (process.argv.includes("--watch")) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log("👀 watching…");
      return;
    }

    await esbuild.build(buildOptions);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }
}

main();
