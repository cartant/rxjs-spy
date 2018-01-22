/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-invalid-this*/

import { Observable } from "rxjs/Observable";
import { hide as higherOrderHide } from "../operators/hide";

export function hide<T>(this: Observable<T>): Observable<T> {

    return higherOrderHide<T>()(this);
}
