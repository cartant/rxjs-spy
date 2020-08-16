import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";

const extensions = [".js", ".ts"];

export default {
    external: [
        "rxjs",
        "rxjs/operators"
    ],
    input: "source/operators/index.ts",
    output: [
        {
            file: "dist/esm/operators/index.js",
            format: "esm",
            sourcemap: true
        }
    ],
    plugins: [
        json(),
        resolve({ extensions }),
        commonjs(),
        babel({ babelHelpers: "bundled", extensions })
    ]
};
