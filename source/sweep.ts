/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export type Hook = (id: string, options: { flush?: boolean }) => void;

const noop_: Hook = () => {};
let hook_: Hook = noop_;

export function hook(hook: Hook | undefined): void {
    hook_ = hook || noop_;
}

export function sweep(id: string, options: { flush?: boolean } = {}): void {
    hook_(id, options);
}
