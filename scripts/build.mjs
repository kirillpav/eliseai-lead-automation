import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const gasExports = [
  "onOpen",
  "onEdit",
  "processNewLeadRows",
  "processLeadRow",
  "installTriggers",
  "resetTriggers",
  "ensureLeadSheet"
];

const footer = gasExports
  .map((name) => `function ${name}(...args){ return __gasBundle.${name}(...args); }`)
  .join("\n");

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/code.js",
  bundle: true,
  format: "iife",
  globalName: "__gasBundle",
  platform: "browser",
  target: "es2019",
  sourcemap: false,
  legalComments: "none",
  footer: {
    js: footer
  }
});

await cp("appsscript.json", "dist/appsscript.json");
