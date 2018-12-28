/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

const subscriptionRefSymbol = Symbol("subscriptionRef");

export interface SubscriptionRef {
    completeTimestamp: number;
    errorTimestamp: number;
    nextCount: number;
    nextTimestamp: number;
    observable: Observable<any>;
    subscribeTimestamp: number;
    subscriber: Subscriber<any>;
    subscription: Subscription;
    tick: number;
    unsubscribeTimestamp: number;
}

export function getSubscriptionRef(subscription: Subscription): SubscriptionRef {
    return subscription[subscriptionRefSymbol];
}

export function setSubscriptionRef(subscription: Subscription, value: SubscriptionRef): SubscriptionRef {
    subscription[subscriptionRefSymbol] = value;
    return value;
}
