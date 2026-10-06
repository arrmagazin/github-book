// import { arrmaturaTemplatePlugin } from "./arrmaturaTemplatePlugin";
import type { BuildOptions } from "esbuild";

export function getEsbuildOptions({
  entryPoints = ["./index.ts"],
  outdir = "./www/dist",
  plugins = [],
  loader = {},
  ...options
}: Partial<BuildOptions> = {}): BuildOptions {
  return {
    entryPoints,
    bundle: true,
    outdir,
    platform: "browser",
    format: "esm",
    sourcemap: "external",
    target: "esnext",
    minify: true,
    keepNames: true,
    plugins: [...plugins], //arrmaturaTemplatePlugin,
    loader: {
      ".xml": "text",
      ".md": "text",
      ".png": "file",
      ".svg": "file",
      ...loader,
    },
    ...options,
  };
}
