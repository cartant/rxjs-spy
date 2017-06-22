import { Observable } from "rxjs/Observable";
import { PartialObserver } from "rxjs/Observer";
import { Subscriber } from "rxjs/Subscriber";
import { rxSubscriber as rxSubscriberSymbol } from "rxjs/symbol/rxSubscriber";

export function isObservable(arg: any): arg is Observable<any> {

    return arg && arg.subscribe;
}

const empty = {
    closed: true,
    error(error: any): void { throw error; },
    next(value: any): void { },
    complete(): void { }
};

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
        return new Subscriber(empty);
    }
    return new Subscriber(nextOrObserver, error, complete);
}
