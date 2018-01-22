/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

const idSymbol = Symbol("id");
let lastId = 0;

export function identify(instance: object): string {
    const id = instance[idSymbol] = instance[idSymbol] || (++lastId).toString();
    return id;
}
