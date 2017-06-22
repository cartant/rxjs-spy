/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/firebase-thermite
 */

"use strict";

const browserify = require("browserify");
const fs = require("fs");
const shim = require("browserify-global-shim").configure(require("./bundle-config"));

browserify({
    entries: "./dist/index.js",
    fullPaths: false,
    standalone: "RxSpy"
})
.transform(shim)
.bundle()
.pipe(fs.createWriteStream("./bundles/rxjs-spy.umd.js"));
