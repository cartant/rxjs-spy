/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { PartialObserver, empty as emptyObserver } from "rxjs/Observer";
import { Subscriber } from "rxjs/Subscriber";
import { rxSubscriber as rxSubscriberSymbol } from "rxjs/symbol/rxSubscriber";
import { Plugin } from "./plugin";

const observableSubscribe = Observable.prototype.subscribe;
let plugins_: Plugin[] = [];
let tick_ = 0;

export function attach(plugin: Plugin): void {

    plugins_.push(plugin);

    if (Observable.prototype.subscribe === observableSubscribe) {
        Observable.prototype.subscribe = spySubscribe;
    }
}

export function detach(plugin: Plugin): void {

    const index = plugins_.indexOf(plugin);
    if (index !== -1) {
        plugins_.splice(index, 1);
    }

    if (plugins_.length === 0) {
        Observable.prototype.subscribe = observableSubscribe;
    }
}

export function tick(): number {

    return tick_;
}

function overrideObservable(
    observable: Observable<any>,
    subscriber: Subscriber<any>
): Observable<any> {

    for (let p = plugins_.length - 1; p >= 0; --p) {
        const plugin = plugins_[p];
        if (plugin.overrideObservable) {
            return plugin.overrideObservable(observable, subscriber);
        }
    }
    return observable;
}

function overrideValue(
    observable: Observable<any>,
    subscriber: Subscriber<any>,
    value: any
): any {

    for (let p = plugins_.length - 1; p >= 0; --p) {
        const plugin = plugins_[p];
        if (plugin.overrideValue) {
            return plugin.overrideValue(observable, subscriber, value);
        }
    }
    return value;
}

function spySubscribe(this: Observable<any>, ...args: any[]): any {

    /*tslint:disable-next-line:no-invalid-this*/
    const observable = this;
    const subscriber = toSubscriber.apply(null, args);

    ++tick_;
    plugins_.forEach((plugin) => plugin.beforeSubscribe(observable, subscriber));

    const subscription = observableSubscribe.call(overrideObservable(observable, subscriber),
        (value: any) => {
            value = overrideValue(observable, subscriber, value);
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeNext(observable, subscriber, value));
            subscriber.next(value);
            plugins_.forEach((plugin) => plugin.afterNext(observable, subscriber, value));
        },
        (error: any) => {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeError(observable, subscriber, error));
            subscriber.error(error);
            plugins_.forEach((plugin) => plugin.afterError(observable, subscriber, error));
        },
        () => {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeComplete(observable, subscriber));
            subscriber.complete();
            plugins_.forEach((plugin) => plugin.afterComplete(observable, subscriber));
        }
    );

    plugins_.forEach((plugin) => plugin.afterSubscribe(observable, subscriber));

    return {
        unsubscribe(): void {
            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(observable, subscriber));
            subscription.unsubscribe();
            plugins_.forEach((plugin) => plugin.afterUnsubscribe(observable, subscriber));
        }
    };
}

// https://github.com/ReactiveX/rxjs/blob/master/src/util/toSubscriber.ts
//
// toSubscriber is not part of the RxJS bundle's public API, so if it were to
// be imported using a Rollup CommonJS plugin, it would need to be included in
// the spy's bundle - but the other RxJS modules should not be included. This
// seems too complicated, for the moment.

export function toSubscriber<T>(
    nextOrObserver?: PartialObserver<T> | ((value: T) => void),
    error?: (error: any) => void,
    complete?: () => void
): Subscriber<T> {

    if (nextOrObserver) {
        if (nextOrObserver instanceof Subscriber) {
            return nextOrObserver as Subscriber<T>;
        }
        if (nextOrObserver[rxSubscriberSymbol]) {
            return nextOrObserver[rxSubscriberSymbol]();
        }
    }

    if (!nextOrObserver && !error && !complete) {
        return new Subscriber(emptyObserver);
    }
    return new Subscriber(nextOrObserver, error, complete);
}
