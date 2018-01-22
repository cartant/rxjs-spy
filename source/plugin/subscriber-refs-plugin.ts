/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { BasePlugin } from "./plugin";
import { SubscriberRef } from "../subscription-ref";

export class SubscriberRefsPlugin extends BasePlugin {

    private subscriberRefs_: Map<Observable<any>, SubscriberRef> = new Map<Observable<any>, SubscriberRef>();

    constructor() { super("subscriberRefs"); }

    beforeSubscribe(ref: SubscriberRef): void {

        const { subscriberRefs_ } = this;
        subscriberRefs_.set(ref.observable, ref);
    }

    get(observable: Observable<any>): SubscriberRef {

        const { subscriberRefs_ } = this;
        return subscriberRefs_.get(observable)!;
    }
}
