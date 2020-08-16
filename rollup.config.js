import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import pack from "./package.json";

const extensions = [".js", ".ts"];

export default {
    external: [
        "rxjs",
        "rxjs/operators"
    ],
    input: "source/index.ts",
    output: [
        {
            file: "dist/esm/index.js",
            format: "esm",
            sourcemap: true
        }
    ],
    plugins: [
        json(),
        resolve({ extensions }),
        commonjs(),
        babel({ babelHelpers: "bundled", extensions }),
        replace({
            __RX_SPY_VERSION__: `"${pack.version}"`
        })
    ]
};
