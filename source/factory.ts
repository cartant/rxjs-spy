/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { PartialLogger } from "./logger";
import { Patcher } from "./patcher";

export function patch(options: {
    [key: string]: any,
    defaultLogger?: PartialLogger,
    defaultPlugins?: boolean,
    global?: string,
    warning?: boolean
} = {}): Patcher {

    return new Patcher(options);
}

export type Spy = Patcher;
export const create = patch;
