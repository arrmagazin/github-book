// The cml/ templates are imported as strings (bun --loader .xml:txt; esbuild loader ".xml": "text").
declare module "*.xml" {
  const content: string;
  export default content;
}
