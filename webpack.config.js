const path = require("path");
const UglifyJsWebpackPlugin = require("uglifyjs-webpack-plugin");
const webpack = require("webpack");
const { alias, externals } = require("./webpack.common");

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

    return {
        context: path.join(__dirname, "./"),
        devtool: undefined,
        entry: {
            index: "./source/index.ts"
        },
        externals,
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
            alias,
            extensions: [".ts", ".js"]
        }
    }
};
