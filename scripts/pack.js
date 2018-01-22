/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

"use strict";

const fs = require("fs");

const content = Object.assign(
    {},
    JSON.parse(fs.readFileSync("./package.json")),
    JSON.parse(fs.readFileSync("./package-dist.json"))
);
if (content.publishConfig && (content.publishConfig.tag !== "latest")) {
    console.warn(`\n\nWARNING: package.json contains publishConfig.tag = ${content.publishConfig.tag}\n\n`);
}
fs.writeFileSync("./dist/package.json", JSON.stringify(content, null, 2));
