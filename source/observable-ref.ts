/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs";

const observableRefSymbol = Symbol("observableRef");

export interface ObservableRef {
}

export function getObservableRef(observable: Observable<any>): ObservableRef {
    return observable[observableRefSymbol];
}

export function setObservableRef(observable: Observable<any>, value: ObservableRef): ObservableRef {
    observable[observableRefSymbol] = value;
    return value;
}
