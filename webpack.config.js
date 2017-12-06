"use strict";

const path = require("path");
const UglifyJsWebpackPlugin = require("uglifyjs-webpack-plugin");
const webpack = require("webpack");
const webpackRxjsExternals = require("webpack-rxjs-externals");

module.exports = env => {

    let filename;
    let plugins;

    if (env && env.production) {
        filename = "rxjs-spy.min.umd.js";
        plugins = [new UglifyJsWebpackPlugin({
            uglifyOptions: {
                beautify: false,
                ecma: 6,
                compress: true,
                comments: false
            }
        })];
    } else {
        filename = "rxjs-spy.umd.js";
        plugins = []
    }
    plugins.unshift(require("./webpack.define"));

    return {
        context: path.join(__dirname, "./"),
        devtool: undefined,
        entry: {
            index: "./source/index.ts"
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
                        configFile: "tsconfig-dist.json"
                    }
                }
            }]
        },
        output: {
            filename,
            library: "RxSpy",
            libraryTarget: "umd",
            path: path.resolve(__dirname, "./bundles")
        },
        plugins,
        resolve: {
            extensions: [".ts", ".js"]
        }
    }
};
