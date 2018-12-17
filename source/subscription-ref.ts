/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

export interface SubscriptionRef {
    observable: Observable<any>;
    subscriber: Subscriber<any>;
    subscription: Subscription;
    timestamp: number;
    unsubscribed: boolean;
}
