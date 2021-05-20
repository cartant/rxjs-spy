/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, PartialObserver, Subscriber } from "rxjs";

export function inferPath(observable: Observable<any>): string {
    const { source } = observable as any;

    if (source) {
        return `${inferPath(source)}/${inferType(observable)}`;
    }
    return `/${inferType(observable)}`;
}

export function inferType(observable: Observable<any>): string {
    const { operator } = observable as any;

    const prototype = Object.getPrototypeOf(operator ? operator : observable);
    if (prototype.constructor && prototype.constructor.name) {
        let { name } = prototype.constructor;
        name = `${name.charAt(0).toLowerCase()}${name.substring(1)}`;
        return name.replace(
            /^(\w+)(Observable|Operator)$/,
            (match: string, p: string) => p
        );
    }
    return "unknown";
}

export function isObservable(arg: any): arg is Observable<any> {
    return arg && arg.subscribe;
}

// This is included because - although there is an "rxjs/Observer.js" in the
// RxJS NPM distribution - there is no "Rx.Observer" (and, therefore, no
// "Rx.Observer.empty") in the bundle:

const empty = {
    closed: true,
    error(error: any): void {
        throw error;
    },
    next(value: any): void {},
    complete(): void {},
};
const SubscriberSymbol = Symbol.for("rxSubscriber");

// https://github.com/ReactiveX/rxjs/blob/master/src/util/toSubscriber.ts
//
// toSubscriber is not part of the RxJS bundle's public API, so if it were to
// be imported using a Rollup CommonJS plugin, it would need to be included in
// the spy's bundle - but the other RxJS modules should not be included. This
// seems too complicated, for the moment.

let SafeSubscriberCtor: typeof Subscriber;
const observable = new Observable<any>((subscriber) => {
    SafeSubscriberCtor = Object.getPrototypeOf(subscriber).constructor;
});
observable.subscribe(() => {}).unsubscribe();

export function toSubscriber<T>(
    observerOrNext?: PartialObserver<T> | ((value: T) => void),
    error?: (error: any) => void,
    complete?: () => void
): Subscriber<T> {
    if (observerOrNext instanceof Subscriber) {
        return observerOrNext as Subscriber<T>;
    }
    let next: ((value: T) => void) | undefined;
    if (typeof observerOrNext === "function") {
        next = observerOrNext;
    } else if (observerOrNext) {
        ({ complete, error, next } = observerOrNext);
        next = next ? (value) => observerOrNext.next!(value) : undefined;
        error = error ? (error) => observerOrNext.error!(error) : undefined;
        complete = complete ? () => observerOrNext.complete!() : undefined;
    }
    return new SafeSubscriberCtor({
        complete,
        error,
        next,
    } as any);
}
