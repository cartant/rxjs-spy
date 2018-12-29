/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

const subscriptionRecordSymbol = Symbol("subscriptionRecord");

export interface SubscriptionRecord {
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

export function getSubscriptionRecord(subscription: Subscription): SubscriptionRecord {
    return subscription[subscriptionRecordSymbol];
}

export function setSubscriptionRecord(subscription: Subscription, record: SubscriptionRecord): SubscriptionRecord {
    subscription[subscriptionRecordSymbol] = record;
    return record;
}
