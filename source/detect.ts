/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export type Hook = (id: string) => void;

const noop_: Hook = () => {};
let hook_: Hook = noop_;

export function detect(id: string): void {

    hook_(id);
}

export function hook(hook: Hook | undefined): void {

    hook_ = hook || noop_;
}
