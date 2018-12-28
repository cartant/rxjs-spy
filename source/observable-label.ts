/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs";

const observableLabelSymbol = Symbol("observableLabel");

export interface ObservableLabel {
}

export function getObservableLabel(observable: Observable<any>): ObservableLabel {
    return observable[observableLabelSymbol];
}

export function setObservableLabel(observable: Observable<any>, label: ObservableLabel): ObservableLabel {
    observable[observableLabelSymbol] = label;
    return label;
}
