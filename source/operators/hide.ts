/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-use-before-declare*/

import { Operator } from "rxjs/Operator";
import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";

export function hide<T>(): (source: Observable<T>) => Observable<T> {

    return function hideOperation(source: Observable<T>): Observable<T> {

        return source.lift(new HideOperator());
    };
}

class HideOperator<T> implements Operator<T, T> {

    // It would be better if this were a symbol. However ...
    // error TS1166: A computed property name in a class property declaration must directly refer to a built-in symbol.
    readonly hide = true;

    constructor() {}

    call(subscriber: Subscriber<T>, source: any): any {

        return source.subscribe(subscriber);
    }
}
