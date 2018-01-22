/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

"use strict";

const fs = require("fs");
const version = JSON.stringify(require("../package.json").version);

const files = [
    "./build/spy-core.js",
    "./dist/spy-core.js"
];
files.forEach(file => {

    try {
        const content = fs.readFileSync(file).toString();
        fs.writeFileSync(file, content.replace(/__RX_SPY_VERSION__/g, version));
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
});
