/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { tag } from "../../operator/tag";

Observable.prototype.tag = tag;

declare module "rxjs/Observable" {
    interface Observable<T> {
        tag: typeof tag;
    }
}
