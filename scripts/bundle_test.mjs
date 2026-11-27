import { bundle } from "@remotion/bundler";
import path from "node:path";
const t=Date.now();
const url = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
console.log("bundle ok", url, ((Date.now()-t)/1000).toFixed(0)+"s");
