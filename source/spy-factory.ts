/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { PartialLogger } from "./logger";
import { Plugin } from "./plugin";
import { SpyCore } from "./spy-core";
import { Spy } from "./spy-interface";

export function create(options: {
    [key: string]: any,
    defaultLogger?: PartialLogger,
    defaultPlugins?: boolean,
    warning?: boolean
} = {}): Spy {

    return new SpyCore(options);
}
