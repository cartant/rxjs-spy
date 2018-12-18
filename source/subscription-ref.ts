/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

export interface SubscriptionRef {
    completeTimestamp: number;
    errorTimestamp: number;
    nextCount: number;
    nextTimestamp: number;
    observable: Observable<any>;
    subscribeTimestamp: number;
    subscriber: Subscriber<any>;
    subscription: Subscription;
    unsubscribeTimestamp: number;
}
