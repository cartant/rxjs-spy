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
import { isObservable } from "../util";

export type MatchFunction = (tag: string, observable?: Observable<any>) => boolean;

export function matches<T>(observable: Observable<T>, match: Observable<T>): boolean;
export function matches<T>(observable: Observable<T>, match: string): boolean;
export function matches<T>(observable: Observable<T>, match: RegExp): boolean;
export function matches<T>(observable: Observable<T>, match: MatchFunction): boolean;
export function matches<T>(observable: Observable<T>, match: any): boolean {

    if (isObservable(match)) {
        return observable === match;
    }

    const tag = read(observable);

    if (typeof match === "function") {
        return match(tag, observable);
    }

    if (tag === null) {
        return false;
    } else if (typeof match === "string") {
        return match === tag;
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

class TagOperator<T> implements Operator<T, T> {

    tag: string;

    constructor(tag: string) {

        this.tag = tag;
    }

    call(subscriber: Subscriber<T>, source: any): any {

        return source.subscribe(subscriber);
    }
}
