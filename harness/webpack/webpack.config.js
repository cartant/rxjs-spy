"use strict";

const path = require("path");
const webpack = require("webpack");

module.exports = env => {

    return {
        context: path.join(__dirname, "./"),
        // https://github.com/webpack/webpack/issues/5186#issuecomment-312800903
        devtool: "source-map",
        entry: {
            index: "../node/index.js"
        },
        mode: "development",
        module: {
            rules: []
        },
        output: {
            filename: "harness.bundle.js",
            path: path.resolve(__dirname, "./bundles")
        },
        resolve: {
            extensions: [".js"]
        }
    }
};
