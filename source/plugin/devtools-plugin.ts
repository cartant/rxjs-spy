/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-debugger*/

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { BasePlugin, SubscriberRef, SubscriptionRef } from "./plugin";

export class DevToolsPlugin extends BasePlugin {

    beforeComplete(ref: SubscriptionRef): void {
    }

    beforeError(ref: SubscriptionRef, error: any): void {
    }

    beforeNext(ref: SubscriptionRef, value: any): void {
    }

    beforeSubscribe(ref: SubscriberRef): void {
    }

    beforeUnsubscribe(ref: SubscriptionRef): void {
    }
}
