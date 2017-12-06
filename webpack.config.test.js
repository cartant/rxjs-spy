"use strict";

const path = require("path");
const pkg = require("./package.json");
const webpack = require("webpack");
const webpackRxjsExternals = require("webpack-rxjs-externals");

module.exports = env => {

    return {
        context: path.join(__dirname, "./"),
        devtool: undefined,
        entry: {
            index: "./source/index-spec.ts"
        },
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
                        configFile: "tsconfig.json"
                    }
                }
            }]
        },
        output: {
            filename: "rxjs-spy-test.umd.js",
            library: "RxSpyTest",
            libraryTarget: "umd",
            path: path.resolve(__dirname, "./bundles")
        },
        plugins: [require("./webpack.define")],
        resolve: {
            extensions: [".ts", ".js"]
        }
    }
};
