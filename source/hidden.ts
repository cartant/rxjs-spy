/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";

export function hidden<T>(observable: Observable<T>): boolean {

    const operator = observable["operator"];
    return Boolean(operator && operator["hide"]);
}
