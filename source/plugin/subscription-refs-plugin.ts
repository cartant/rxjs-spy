/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { BasePlugin, SubscriptionRef } from "./plugin";

export class SubscriptionRefsPlugin extends BasePlugin {

    private subscriptionRefs_: Map<Observable<any>, SubscriptionRef> = new Map<Observable<any>, SubscriptionRef>();

    beforeSubscribe(ref: SubscriptionRef): void {

        const { subscriptionRefs_ } = this;
        subscriptionRefs_.set(ref.observable, ref);
    }

    get(observable: Observable<any>): SubscriptionRef {

        const { subscriptionRefs_ } = this;
        return subscriptionRefs_.get(observable)!;
    }
}
