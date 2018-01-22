/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { hide } from "../../operator/hide";

Observable.prototype.hide = hide;

declare module "rxjs/Observable" {
    interface Observable<T> {
        hide: typeof hide;
    }
}
