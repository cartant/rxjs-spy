"use strict";

const webpack = require("webpack");
const version = require("./package.json").version;

exports = module.exports = new webpack.DefinePlugin({
    __RX_SPY_VERSION__: JSON.stringify(version)
});
