"use strict";

const path = require("path");
const webpack = require("webpack");

module.exports = env => {

    return {
        context: path.join(__dirname, "./"),
        devtool: undefined,
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
        plugins: [require("./webpack.define")],
        resolve: {
            extensions: [".ts", ".js"]
        }
    }
};
