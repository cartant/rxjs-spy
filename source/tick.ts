/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

let tick_ = 0;

export function increment(): void {

    ++tick_;
}

export function tick(): number {

    return tick_;
}
