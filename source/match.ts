/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Operator } from "rxjs/Operator";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { identify } from "./identify";
import { isSubscriptionRef, SubscriberRef, SubscriptionRef } from "./subscription-ref";
import { isObservable } from "./util";

export type MatchPredicate = (tag: string | undefined, observable?: Observable<any>) => boolean;
export type Match = Observable<any> | string | RegExp | MatchPredicate;

export function matches<T>(observable: Observable<T>, match: Match): boolean;
export function matches(subscriberRef: SubscriberRef, match: Match): boolean;
export function matches<T>(arg: Observable<T> | SubscriberRef, match: Match): boolean {

    let observable: Observable<T>;
    let subscriber: Subscriber<T> | undefined = undefined;
    let subscription: Subscription | undefined = undefined;

    if (isObservable(arg)) {
        observable = arg;
    } else {
        observable = arg.observable;
        subscriber = arg.subscriber;
        subscription = isSubscriptionRef(arg) ? arg.subscription : undefined;
    }

    if (isObservable(match)) {
        return observable === match;
    }

    const observableId = identify(observable);
    const subscriberId = subscriber ? identify(subscriber) : undefined;
    const subscriptionId = subscription ? identify(subscription) : undefined;
    const tag = read(observable);

    if (typeof match === "function") {
        return match(tag, observable);
    }
    if (typeof match === "string") {
        return (match === observableId) || (match === subscriberId) || (match === subscriptionId) || (match === tag);
    }
    if (tag === undefined) {
        return false;
    }
    return match.test(tag);
}

export function read<T>(observable: Observable<T>): string | undefined {

    const operator = observable["operator"];
    if (!operator) {
        return undefined;
    }

    const tag = operator["tag"];
    if (!tag) {
        return undefined;
    }
    return tag;
}

export function toString(match: Match): string {

    if (isObservable(match)) {
        return "[Observable]";
    } else if (typeof match === "function") {
        return "[Function]";
    }
    return match.toString();
}
