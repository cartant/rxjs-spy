/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { PartialLogger } from "./logger";
import { Spy } from "./spy";

export function create(options: {
    [key: string]: any,
    defaultLogger?: PartialLogger,
    defaultPlugins?: boolean,
    global?: string,
    warning?: boolean
} = {}): Spy {

    return new Spy(options);
}
