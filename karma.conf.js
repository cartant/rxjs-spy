"use strict";

process.env.CHROME_BIN = require("puppeteer").executablePath();

exports = module.exports = function (config) {

    config.set({
        basePath: "",
        browsers: ["ChromeHeadless"],
        colors: true,
        concurrency: Infinity,
        exclude: [],
        files: [
            { pattern: "source/**/*-spec.ts", watched: false },
        ],
        frameworks: ["mocha"],
        logLevel: config.LOG_INFO,
        mime : {
            "text/x-typescript": ["ts"]
        },
        port: 9876,
        preprocessors: {
            "source/**/*-spec.ts": ["webpack"]
        },
        proxies: {},
        reporters: ["spec"],
        webpack: require("./webpack.config.test")({}),
        webpackMiddleware: {
            noInfo: true,
            stats: "errors-only"
        }
    });
};
