/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { matches, MatchFunction, toString as matchToString } from "./operator/tag";
import { Event, LogPlugin, PatchPlugin, Plugin, SnapshotObservable, SnapshotPlugin } from "./plugin";
import { isObservable, toSubscriber } from "./util";

const observableSubscribe = Observable.prototype.subscribe;
let debugMatchers_: ((observable: Observable<any>, event: Event) => boolean)[] = [];
let plugins_: Plugin[] = [];
let undos_: { name: string, teardown: () => void }[] = [];
let tick_ = 0;

if (typeof window !== "undefined") {

    const consoleApi = {

        debug(...args: any[]): void {

            debug.apply(null, args);
        },

        flush(): void {

            flush();
        },

        log(...args: any[]): void {

            log.apply(null, args);
        },

        patch(...args: any[]): void {

            patch.apply(null, args);
        },

        show(...args: any[]): void {

            show.apply(null, args);
        },

        spy(...args: any[]): void {

            spy.apply(null, args);
        },

        undo(...args: any[]): void {

            if (args.length === 0) {
                /*tslint:disable:no-console*/
                console.group("Undo(s)");
                undos_.forEach((undo, index) => {
                    console.log(`${index + 1} ${undo.name}`);
                });
                console.groupEnd();
                /*tslint:enable:no-console*/
            } else {
                args
                    .map((at) => undos_[at - 1])
                    .forEach((undo) => { if (undo) { undo.teardown(); } });
            }
        }
    };
    window["rxSpy"] = consoleApi;
}

export function debug(observable: Observable<any>, ...events: Event[]): () => void;
export function debug(match: string, ...events: Event[]): () => void;
export function debug(match: RegExp, ...events: Event[]): () => void;
export function debug(match: MatchFunction, ...events: Event[]): () => void;
export function debug(match: any, ...events: Event[]): () => void {

    if (events.length === 0) {
        events = ["complete", "error", "next", "subscribe", "unsubscribe"];
    }

    const matcher = (observable: Observable<any>, event: Event) => matches(observable, match) && (events.indexOf(event) !== -1);
    debugMatchers_.push(matcher);

    const teardown = () => {

        const index = debugMatchers_.indexOf(matcher);
        if (index !== -1) {
            debugMatchers_.splice(index, 1);
            undos_ = undos_.filter((undo) => undo.teardown !== teardown);
        }
    };
    undos_.push({ name: `debug(${matchToString(match)})`, teardown });

    return teardown;
}

export function flush(): void {

    plugins_.forEach((plugin) => plugin.flush());
}

export function log(observable: Observable<any>, partialLogger?: PartialLogger): () => void;
export function log(match: string, partialLogger?: PartialLogger): () => void;
export function log(match: RegExp, partialLogger?: PartialLogger): () => void;
export function log(match: MatchFunction, partialLogger?: PartialLogger): () => void;
export function log(match: any, partialLogger: PartialLogger = defaultLogger): () => void {

    const plugin = new LogPlugin(match, partialLogger);
    plugins_.push(plugin);

    const teardown = () => {

        const index = plugins_.indexOf(plugin);
        if (index !== -1) {
            plugins_.splice(index, 1);
            undos_ = undos_.filter((undo) => undo.teardown !== teardown);
        }
    };
    undos_.push({ name: `log(${matchToString(match)})`, teardown });

    return teardown;
}

export function patch(observable: Observable<any>, source: Observable<any>): () => void;
export function patch(observable: Observable<any>, project: (value: any) => any): () => void;
export function patch(observable: Observable<any>, value: any): () => void;
export function patch(match: string, source: Observable<any>): () => void;
export function patch(match: string, project: (value: any) => any): () => void;
export function patch(match: string, value: any): () => void;
export function patch(match: RegExp, source: Observable<any>): () => void;
export function patch(match: RegExp, project: (value: any) => any): () => void;
export function patch(match: RegExp, value: any): () => void;
export function patch(match: MatchFunction, source: Observable<any>): () => void;
export function patch(match: MatchFunction, project: (value: any) => any): () => void;
export function patch(match: MatchFunction, value: any): () => void;
export function patch(match: any, arg: any): () => void {

    const plugin = new PatchPlugin(match, arg);
    plugins_.push(plugin);

    const teardown = () => {

        const index = plugins_.indexOf(plugin);
        if (index !== -1) {
            plugins_.splice(index, 1);
            undos_ = undos_.filter((undo) => undo.teardown !== teardown);
        }
    };
    undos_.push({ name: `patch(${matchToString(match)})`, teardown });

    return teardown;
}

export function show(observable: Observable<any>, partialLogger?: PartialLogger): void;
export function show(match: string, partialLogger?: PartialLogger): void;
export function show(match: RegExp, partialLogger?: PartialLogger): void;
export function show(match: (tag: string) => boolean, partialLogger?: PartialLogger): void;
export function show(match: any, partialLogger: PartialLogger = defaultLogger): void {

    const plugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    if (!plugin) {
        throw new Error("Snapshotting is not enabled.");
    }

    const snapshotPlugin = plugin as SnapshotPlugin;
    const snapshot = snapshotPlugin.snapshot();
    const filtered = snapshot.observables.filter((o) => matches(o.observable, match));
    const method = (filtered.length > 3) ? "groupCollapsed" : "group";

    const logger = toLogger(partialLogger);
    const tag = (typeof match === "function") ? "function" : match.toString();

    logger.group(`Snapshot(s) matching ${matchToString(match)}`);
    filtered.forEach((o) => {

        logger[method].call(logger, `Tag = ${o.tag}`);
        logger.log("State =", o.complete ? "complete" : o.error ? "error" : "incomplete");
        if (o.error) {
            logger.error("Error =", o.error);
        }
        logger.log("Subscriber count =", o.subscriptions.length);
        logger.log("Value count =", o.values.length);
        if (o.values.length > 0) {
            logger.log("Last value =", o.values[o.values.length - 1].value);
        }
        logger.groupCollapsed("Raw snapshot");
        logger.log(o);
        logger.groupEnd();
        logger.groupEnd();
    });
    logger.groupEnd();
}

export function spy({ plugins }: { plugins?: Plugin[] } = {}): () => void {

    if (Observable.prototype.subscribe !== observableSubscribe) {
        throw new Error("Already spying on Observable.prototype.subscribe.");
    }
    Observable.prototype.subscribe = spySubscribe;

    if (plugins) {
        plugins_ = plugins;
    } else {
        plugins_ = [new SnapshotPlugin()];
    }

    const teardown = () => {

        debugMatchers_ = [];
        plugins_ = [];
        undos_ = [];
        Observable.prototype.subscribe = observableSubscribe;
    };
    undos_.push({ name: "spy", teardown });

    return teardown;
}

export function tick(): number {

    return tick_;
}

/*tslint:disable:no-debugger*/

function debugComplete(snapshot: SnapshotObservable | null): void {

    debugger;
}

function debugError(error: any, snapshot: SnapshotObservable | null): void {

    debugger;
}

function debugNext(value: any, snapshot: SnapshotObservable | null): void {

    debugger;
}

function debugSubscribe(snapshot: SnapshotObservable | null): void {

    debugger;
}

function debugUnsubscribe(snapshot: SnapshotObservable | null): void {

    debugger;
}

/*tslint:enable:no-debugger*/

function getSnapshot(observable: Observable<any>): SnapshotObservable | null {

    const plugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    if (!plugin) {
        return null;
    }

    const snapshotPlugin = plugin as SnapshotPlugin;
    const snapshot = snapshotPlugin.snapshot();
    return snapshot.observables.find((o) => o.observable === observable) || null;
}

function patchSource(
    observable: Observable<any>,
    subscriber: Subscriber<any>
): Observable<any> {

    for (let p = plugins_.length - 1; p > -1; --p) {
        const plugin = plugins_[p];
        const patch = plugin.patch(observable, subscriber);
        if (isObservable(patch)) {
            return patch;
        }
    }
    return observable;
}

function patchValue(
    observable: Observable<any>,
    subscriber: Subscriber<any>,
    value: any
): any {

    for (let p = plugins_.length - 1; p > -1; --p) {
        const plugin = plugins_[p];
        const patch = plugin.patch(observable, subscriber);
        if (typeof patch === "function") {
            return patch(value);
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

    debugMatchers_.forEach((matcher) => {
        if (matcher(observable, "subscribe")) {
            debugSubscribe(getSnapshot(observable));
        }
    });
    const subscription = observableSubscribe.call(patchSource(observable, subscriber),
        (value: any) => {

            value = patchValue(observable, subscriber, value);

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeNext(observable, subscriber, value));

            debugMatchers_.forEach((matcher) => {
                if (matcher(observable, "next")) {
                    debugNext(value, getSnapshot(observable));
                }
            });
            subscriber.next(value);

            plugins_.forEach((plugin) => plugin.afterNext(observable, subscriber, value));
        },
        (error: any) => {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeError(observable, subscriber, error));

            debugMatchers_.forEach((matcher) => {
                if (matcher(observable, "error")) {
                    debugError(error, getSnapshot(observable));
                }
            });
            subscriber.error(error);

            plugins_.forEach((plugin) => plugin.afterError(observable, subscriber, error));
        },
        () => {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeComplete(observable, subscriber));

            debugMatchers_.forEach((matcher) => {
                if (matcher(observable, "complete")) {
                    debugComplete(getSnapshot(observable));
                }
            });
            subscriber.complete();

            plugins_.forEach((plugin) => plugin.afterComplete(observable, subscriber));
        }
    );

    plugins_.forEach((plugin) => plugin.afterSubscribe(observable, subscriber));

    return {
        unsubscribe(): void {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(observable, subscriber));

            debugMatchers_.forEach((matcher) => {
                if (matcher(observable, "unsubscribe")) {
                    debugUnsubscribe(getSnapshot(observable));
                }
            });
            subscription.unsubscribe();

            plugins_.forEach((plugin) => plugin.afterUnsubscribe(observable, subscriber));
        }
    };
}
