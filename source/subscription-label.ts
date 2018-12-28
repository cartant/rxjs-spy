/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, Subscriber, Subscription } from "rxjs";

const subscriptionLabelSymbol = Symbol("subscriptionLabel");

export interface SubscriptionLabel {
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

export function getSubscriptionLabel(subscription: Subscription): SubscriptionLabel {
    return subscription[subscriptionLabelSymbol];
}

export function setSubscriptionLabel(subscription: Subscription, label: SubscriptionLabel): SubscriptionLabel {
    subscription[subscriptionLabelSymbol] = label;
    return label;
}
