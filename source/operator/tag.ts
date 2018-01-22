/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-invalid-this*/

import { Observable } from "rxjs/Observable";
import { tag as higherOrderTag } from "../operators/tag";

export function tag<T>(this: Observable<T>, tag: string): Observable<T> {

    return higherOrderTag<T>(tag)(this);
}
