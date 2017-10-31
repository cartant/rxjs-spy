/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export const defaultKeptDuration = 30000;
export const defaultKeptValues = 4;

export function flushAfterDuration(duration: number, flush: () => void): void {

    if ((duration >= 0) && (duration < Infinity)) {
        setTimeout(flush, duration);
    }
}
