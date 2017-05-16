import nodeResolve from "rollup-plugin-node-resolve";
import { external, globals } from "./rollup-constants";

export default {
    banner: "/*MIT license https://github.com/cartant/rxjs-spy/blob/master/LICENSE*/",
    dest: "bundles/rxjs-spy.umd.js",
    entry: "dist/index.js",
    external: external,
    format: "umd",
    globals: Object.assign({}, globals),
    moduleName: "rxjsSpy",
    plugins: [nodeResolve({})]
}
