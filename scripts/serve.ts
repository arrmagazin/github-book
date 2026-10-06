import * as esbuild from "esbuild";
import { readFileJsonContent } from "./utils/files";
import { getEsbuildOptions } from "./utils/getEsbuildOptions";
import { requireSite } from "./utils/site";

export async function main(options: any = {}) {
  try {
    const { name, esbuild: esBuildPackageOpions } = readFileJsonContent([`${process.cwd()}/package.json`]) ?? {};

    // One shell, many sites: SITE picks the folder served, and the bundle lands in its dist/.
    const site = requireSite();

    const {
      entryPoints = esBuildPackageOpions?.entryPoints,
      servedir = `./${site}_www`,
      fallback = `${servedir}/index.html`,
      port = parseInt(process.env.PORT ?? "8080", 10),
      host = process.env.HOST ?? "localhost",
      noWatch = false,
      ...buildOptions
    } = options;

    const ctx = await esbuild.context(
      getEsbuildOptions({
        entryPoints,
        plugins: [],
        outdir: `${servedir}/dist`,
        // Dev only: link the map so devtools pick it up. Production builds (build.ts) keep
        // the "external" default, which emits no sourceMappingURL reference.
        sourcemap: "linked",
        ...buildOptions,
      }),
    );

    if (!noWatch) {
      await ctx.watch();
    }

    const serveOptions = {
      servedir,
      fallback,
      port,
      host,
      onRequest: ({ method, path, status }) => {
        console.log(`>> ${method}${path} - ${status}`);
      },
    };

    const { hosts: serveHosts, port: servePort } = await ctx.serve(serveOptions);

    const addresses = (port) =>
      String(serveHosts)
        .split(",")
        .map((h) => `http://${h}:${port}`)
        .join(" ");

    console.log(`✅ Serving "${name}" site "${site}" at ${addresses(servePort)} from ${servedir}`);
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    if (err.details) {
      console.error(err.details);
    }
    process.exit(1);
  }
}

main();
