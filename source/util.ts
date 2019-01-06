/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable, OperatorFunction, PartialObserver, Subscriber } from "rxjs";

export function inferName(observable: Observable<any>): string;
export function inferName(operator: OperatorFunction<any, any>): string;
export function inferName(target: Observable<any> | OperatorFunction<any, any>): string {
    return isObservable(target) ?
        inferObservableName(target) :
        inferOperatorName(target);
}

function inferObservableName(observable: Observable<any>): string {
    const { operator } = observable as any;
    const prototype = Object.getPrototypeOf(operator ? operator : observable);
    if (prototype.constructor && prototype.constructor.name) {
        let name = prototype.constructor.name || "unknown";
        name = `${name.charAt(0).toLowerCase()}${name.substring(1)}`;
        return name.replace(/^(\w+)(Observable|Operator)$/, (match: string, p: string) => p);
    }
    return "unknown";
}

function inferOperatorName(operator: OperatorFunction<any, any>): string {
    let name = operator.name || "unknown";
    name = `${name.charAt(0).toLowerCase()}${name.substring(1)}`;
    return name.replace(/^(\w+)(Operation)$/, (match: string, p: string) => p);
}

export function inferPipeline(observable: Observable<any>): string {
    const { source } = observable as any;
    if (source) {
        return `${inferPipeline(source)}-${inferName(observable)}`;
    }
    return `${inferName(observable)}`;
}

export function isObservable(arg: any): arg is Observable<any> {
    return arg && arg.subscribe;
}

// This is included because - although there is an "rxjs/Observer.js" in the
// RxJS NPM distribution - there is no "Rx.Observer" (and, therefore, no
// "Rx.Observer.empty") in the bundle:

const empty = {
    closed: true,
    error(error: any): void { throw error; },
    next(value: any): void {},
    complete(): void {}
};
const SubscriberSymbol = Symbol.for("rxSubscriber");

// https://github.com/ReactiveX/rxjs/blob/master/src/util/toSubscriber.ts
//
// toSubscriber is not part of the RxJS bundle's public API, so if it were to
// be imported using a Rollup CommonJS plugin, it would need to be included in
// this lib's bundle - but the other RxJS modules should not be included. This
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
        if (nextOrObserver[SubscriberSymbol]) {
            return nextOrObserver[SubscriberSymbol]();
        }
    }
    if (!nextOrObserver && !error && !complete) {
        return new Subscriber(empty);
    }
    return new Subscriber(nextOrObserver, error, complete);
}
