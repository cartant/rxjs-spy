/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-invalid-this*/
/*tslint:disable:no-use-before-declare*/

import { Observable } from "rxjs/Observable";
import { Operator } from "rxjs/Operator";
import { Subscriber } from "rxjs/Subscriber";

export function matches<T>(tag: string | null, match: string): boolean;
export function matches<T>(tag: string | null, match: RegExp): boolean;
export function matches<T>(tag: string | null, match: (tag: string) => boolean): boolean;
export function matches<T>(tag: string | null, match: any): boolean {

    if (tag === null) {
        return false;
    }

    if (typeof match === "string") {
        return match === tag;
    } else if (typeof match === "function") {
        return match(tag);
    }
    return match.test(tag);
}

export function read<T>(observable: Observable<T>): string | null {

    const operator = observable["operator"];
    if (operator === undefined) {
        return null;
    }

    const tag = operator["tag"];
    if (tag === undefined) {
        return null;
    }
    return tag;
}

export function tag<T>(this: Observable<T>, tag: string): Observable<T> {

    return this.lift(new TagOperator(tag));
}

export function tagged<T>(observable: Observable<T>, match: string): boolean;
export function tagged<T>(observable: Observable<T>, match: RegExp): boolean;
export function tagged<T>(observable: Observable<T>, match: (tag: string) => boolean): boolean;
export function tagged<T>(observable: Observable<T>, match: any): boolean {

    return matches(read(observable), match);
}

class TagOperator<T> implements Operator<T, T> {

    tag: string;

    constructor(tag: string) {

        this.tag = tag;
    }

    call(subscriber: Subscriber<T>, source: any): any {

        return source.subscribe(subscriber);
    }
}
