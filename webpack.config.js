"use strict";

const path = require("path");
const webpack = require("webpack");
const webpackRxjsExternals = require("webpack-rxjs-externals");

module.exports = env => {

    let filename = "rxjs-spy.umd.js";
    let mode = "development";

    if (env && env.production) {
        filename = "rxjs-spy.min.umd.js";
        mode = "production";
    }

    return {
        context: path.join(__dirname, "./"),
        entry: {
            index: "./source/index.ts"
        },
        mode,
        externals: webpackRxjsExternals(),
        module: {
            rules: [{
                test: /\.ts$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        compilerOptions: {
                            declaration: false
                        },
                        configFile: "tsconfig-dist.json"
                    }
                }
            }]
        },
        output: {
            filename,
            library: "rxjsSpy",
            libraryTarget: "umd",
            path: path.resolve(__dirname, "./bundles")
        },
        plugins: [require("./webpack.define")],
        resolve: {
            extensions: [".ts", ".js"]
        }
    }
};
