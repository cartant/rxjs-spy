/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

"use strict";

const fs = require("fs");
const mkdirp = require("mkdirp");

mkdirp.sync("./dist/operators");
mkdirp.sync("./dist/operators/hide");
mkdirp.sync("./dist/operators/tag");

const content = Object.assign(
    {},
    JSON.parse(fs.readFileSync("./package.json")),
    JSON.parse(fs.readFileSync("./package-dist.json"))
);
if (content.publishConfig && (content.publishConfig.tag !== "latest")) {
    console.warn(`\n\nWARNING: package.json contains publishConfig.tag = ${content.publishConfig.tag}\n\n`);
}
fs.writeFileSync("./dist/package.json", JSON.stringify(content, null, 2));

fs.writeFileSync("./dist/operators/package.json", JSON.stringify({
    "main": "../cjs/operators/index.js",
    "module": "../esm/operators/index.js",
    "types": "../cjs/operators/index.d.js",
}, null, 2));

fs.writeFileSync("./dist/operators/hide/package.json", JSON.stringify({
    "main": "../../cjs/operators/hide.js",
    "module": "./esm.js",
    "types": "../cjs/operators/hide.d.js",
}, null, 2));
fs.writeFileSync("./dist/operators/hide/esm.js", `export { hide } from "..";`);

fs.writeFileSync("./dist/operators/tag/package.json", JSON.stringify({
    "main": "../../cjs/operators/tag.js",
    "module": "./esm.js",
    "types": "../../cjs/operators/tag.d.js",
}, null, 2));
fs.writeFileSync("./dist/operators/tag/esm.js", `export { tag } from "..";`);
