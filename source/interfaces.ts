/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";

export interface SubscriberRef {
    observable: Observable<any>;
    subscriber: Subscriber<any>;
    timestamp: number;
    unsubscribed: boolean;
}

export interface SubscriptionRef extends SubscriberRef {
    subscription: Subscription;
}

export function inferType(ref: SubscriberRef): string {

    const { observable } = ref;
    const { operator } = observable as any;

    const prototype = Object.getPrototypeOf(operator ? operator : observable);
    if (prototype.constructor && prototype.constructor.name) {
        return prototype.constructor.name.replace(
            /^([\w])(\w+)(Observable|Operator)$/,
            (match: string, p1: string, p2: string) => `${p1.toLowerCase()}${p2}`
        );
    }
    return "unknown";
}

export function isSubscriptionRef(subscriberRef: SubscriberRef): subscriberRef is SubscriptionRef {
    return subscriberRef && subscriberRef["subscription"];
}
