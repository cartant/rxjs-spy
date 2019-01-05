"use strict";

const webpack = require("webpack");
const version = require("./package.json").version;

exports = module.exports = new webpack.DefinePlugin({
    __RXJS_DEVTOOLS_VERSION__: JSON.stringify(version)
});
