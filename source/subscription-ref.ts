/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

export interface SubscriberRef {
    observable: Observable<any>;
    subscriber: Subscriber<any>;
    timestamp: number;
    unsubscribed: boolean;
}

export interface SubscriptionRef extends SubscriberRef {
    subscription: Subscription;
}

export function isSubscriptionRef(subscriberRef: SubscriberRef): subscriberRef is SubscriptionRef {
    return subscriberRef && subscriberRef["subscription"];
}
