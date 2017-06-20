/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match, matches, toString as matchToString } from "./operator/tag";

import {
    DebugPlugin,
    Deck,
    Event,
    LogPlugin,
    PatchPlugin,
    PausePlugin,
    Plugin,
    SnapshotObservable,
    SnapshotPlugin
} from "./plugin";

import { isObservable, toSubscriber } from "./util";

const observableSubscribe = Observable.prototype.subscribe;
let plugins_: Plugin[] = [];
let undos_: { name: string, teardown: () => void }[] = [];
let tick_ = 0;

if (typeof window !== "undefined") {

    const consoleApi = {

        deck(call?: number): any {

            const pausePlugins = plugins_.filter((plugin) => plugin instanceof PausePlugin) as PausePlugin[];
            if (call === undefined) {
                const logger = toLogger(defaultLogger);
                logger.group("Deck(s)");
                if (pausePlugins.length) {
                    pausePlugins.forEach((pausePlugin, index) => {
                        logger.log(`${index + 1} pause(${matchToString(pausePlugin.match)})`);
                    });
                } else {
                    logger.log("No decks");
                }
                logger.groupEnd();
            } else {
                const pausePlugin = pausePlugins[call - 1];
                return pausePlugin ? pausePlugin.deck() : null;
            }
        },

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

        pause(...args: any[]): any {

            return pause.apply(null, args);
        },

        show(...args: any[]): void {

            show.apply(null, args);
        },

        spy(...args: any[]): void {

            spy.apply(null, args);
        },

        undo(...args: any[]): void {

            if (args.length === 0) {
                const logger = toLogger(defaultLogger);
                logger.group("Undo(s)");
                if (undos_.length) {
                    undos_.forEach((undo, index) => {
                        logger.log(`${index + 1} ${undo.name}`);
                    });
                } else {
                    logger.log("Nothing to undo");
                }
                logger.groupEnd();
            } else {
                args
                    .map((at) => undos_[at - 1])
                    .forEach((undo) => { if (undo) { undo.teardown(); } });
            }
        }
    };
    window["rxSpy"] = consoleApi;
}

export function debug(match: Match, ...events: Event[]): () => void {

    if (events.length === 0) {
        events = ["complete", "error", "next", "subscribe", "unsubscribe"];
    }

    const foundPlugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    const plugin = new DebugPlugin(match, events, foundPlugin ? foundPlugin as SnapshotPlugin : null);
    plugins_.push(plugin);

    const teardown = () => {

        plugin.teardown();
        plugins_ = plugins_.filter((p) => p !== plugin);
        undos_ = undos_.filter((u) => u.teardown !== teardown);
    };
    undos_.push({ name: `debug(${matchToString(match)})`, teardown });

    return teardown;
}

export function flush(): void {

    plugins_.forEach((plugin) => plugin.flush());
}

export function log(match: Match, partialLogger?: PartialLogger): () => void {

    const plugin = new LogPlugin(match, partialLogger);
    plugins_.push(plugin);

    const teardown = () => {

        plugin.teardown();
        plugins_ = plugins_.filter((p) => p !== plugin);
        undos_ = undos_.filter((u) => u.teardown !== teardown);
    };
    undos_.push({ name: `log(${matchToString(match)})`, teardown });

    return teardown;
}

export function patch(match: Match, source: Observable<any>): () => void;
export function patch(match: Match, project: (value: any) => any): () => void;
export function patch(match: Match, value: any): () => void;
export function patch(match: Match, arg: any): () => void {

    const plugin = new PatchPlugin(match, arg);
    plugins_.push(plugin);

    const teardown = () => {

        plugin.teardown();
        plugins_ = plugins_.filter((p) => p !== plugin);
        undos_ = undos_.filter((u) => u.teardown !== teardown);
    };
    undos_.push({ name: `patch(${matchToString(match)})`, teardown });

    return teardown;
}

export function pause(match: Match): Deck {

    const plugin = new PausePlugin(match);
    plugins_.push(plugin);

    const teardown = () => {

        plugin.teardown();
        plugins_ = plugins_.filter((p) => p !== plugin);
        undos_ = undos_.filter((u) => u.teardown !== teardown);
    };
    undos_.push({ name: `pause(${matchToString(match)})`, teardown });

    const deck = plugin.deck();
    deck.teardown = () => { deck.clear(); teardown(); };
    return deck;
}

export function show(partialLogger?: PartialLogger): void;
export function show(match: Match, partialLogger?: PartialLogger): void;
export function show(match: any, partialLogger: PartialLogger = defaultLogger): void {

    const anyTagged = /.+/;
    if (!match) {
        match = anyTagged;
    } else if (typeof match.log === "function") {
        partialLogger = match;
        match = anyTagged;
    }

    const plugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    if (!plugin) {
        throw new Error("Snapshotting is not enabled.");
    }

    const snapshotPlugin = plugin as SnapshotPlugin;
    const snapshot = snapshotPlugin.snapshot();
    const filtered = snapshot.observables.filter((o) => matches(o.observable, match));
    const logger = toLogger(partialLogger);
    const method = (filtered.length > 3) ? "groupCollapsed" : "group";

    logger.group(`Snapshot(s) matching ${matchToString(match)}`);
    filtered.forEach((o) => {

        logger[method].call(logger, `Tag = ${o.tag}`);
        logger.log("State =", o.complete ? "complete" : o.error ? "error" : "incomplete");
        if (o.error) {
            logger.error("Error =", o.error);
        }
        logger.log("Subscriber count =", o.subscriptions.length);
        logger.log("Value count =", o.values.length + o.valuesFlushed);
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

        plugins_.forEach((plugin) => plugin.teardown());
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

function paused(
    observable: Observable<any>,
    subscriber: Subscriber<any>,
    value: any,
    resume: (value: any) => void
): boolean {

    for (let p = plugins_.length - 1; p > -1; --p) {
        const plugin = plugins_[p];
        const paused = plugin.pause(observable, subscriber, value, resume);
        if (paused) {
            return true;
        }
    }
    return false;
}

function spySubscribe(this: Observable<any>, ...args: any[]): any {

    /*tslint:disable-next-line:no-invalid-this*/
    const observable = this;
    const subscriber = toSubscriber.apply(null, args);
    let subscribed = true;

    ++tick_;
    plugins_.forEach((plugin) => plugin.beforeSubscribe(observable, subscriber));

    const subscription = observableSubscribe.call(patchSource(observable, subscriber),
        (value: any) => {

            function next(value: any): void {

                if (subscribed) {

                    value = patchValue(observable, subscriber, value);

                    ++tick_;
                    plugins_.forEach((plugin) => plugin.beforeNext(observable, subscriber, value));

                    subscriber.next(value);

                    plugins_.forEach((plugin) => plugin.afterNext(observable, subscriber, value));
                }
            }

            if (!paused(observable, subscriber, value, next)) {
                next(value);
            }
        },
        (error: any) => {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeError(observable, subscriber, error));

            subscriber.error(error);
            subscribed = false;

            plugins_.forEach((plugin) => plugin.afterError(observable, subscriber, error));
        },
        () => {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeComplete(observable, subscriber));

            subscriber.complete();
            subscribed = false;

            plugins_.forEach((plugin) => plugin.afterComplete(observable, subscriber));
        }
    );

    plugins_.forEach((plugin) => plugin.afterSubscribe(observable, subscriber));

    return {
        unsubscribe(): void {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(observable, subscriber));

            subscription.unsubscribe();
            subscribed = false;

            plugins_.forEach((plugin) => plugin.afterUnsubscribe(observable, subscriber));
        }
    };
}
