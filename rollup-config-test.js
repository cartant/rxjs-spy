import nodeResolve from "rollup-plugin-node-resolve";
import { external, globals } from "./rollup-constants";

export default {
    dest: "bundles/rxjs-spy-test.umd.js",
    entry: "build/index-spec.js",
    external: [
        "chai",
        "sinon",
        ...external
    ],
    format: "umd",
    globals: Object.assign({
        "chai": "chai",
        "sinon": "sinon"
    }, globals),
    onwarn: (warning, next) => {
        if (warning.code === "THIS_IS_UNDEFINED") return;
        next(warning);
    },
    plugins: [nodeResolve({})]
}
