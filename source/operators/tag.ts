/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-use-before-declare*/

import { Operator } from "rxjs/Operator";
import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";

export function tag<T>(tag: string): (source: Observable<T>) => Observable<T> {

    return function tagOperation(source: Observable<T>): Observable<T> {

        return source.lift(new TagOperator(tag));
    };
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
