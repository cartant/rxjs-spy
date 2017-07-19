/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Observable";
import { PartialObserver } from "rxjs/Observer";
import { Subject } from "rxjs/Subject";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match, matches, toString as matchToString } from "./match";

import {
    DebugPlugin,
    Deck,
    LetPlugin,
    LogPlugin,
    Notification,
    PausePlugin,
    Plugin,
    SnapshotObservable,
    SnapshotPlugin
} from "./plugin";

import { isObservable, toSubscriber } from "./util";

import "rxjs/add/operator/let";

const subscribeBase = Observable.prototype.subscribe;
let plugins_: Plugin[] = [];
let pluginsSubject_ = new BehaviorSubject(plugins_);
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
                return pausePlugin ? pausePlugin.deck : null;
            }
        },

        debug(...args: any[]): void {

            debug.apply(null, args);
        },

        flush(): void {

            flush();
        },

        let(...args: any[]): void {

            _let.apply(null, args);
        },

        log(...args: any[]): void {

            log.apply(null, args);
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

export function debug(match: Match, ...notifications: Notification[]): () => void {

    if (notifications.length === 0) {
        notifications = ["complete", "error", "next", "subscribe", "unsubscribe"];
    }

    const foundPlugin = plugins_.find((plugin) => plugin instanceof SnapshotPlugin);
    return plugin(
        new DebugPlugin(match, notifications, foundPlugin ? foundPlugin as SnapshotPlugin : null),
        `debug(${matchToString(match)})`
    );
}

export function flush(): void {

    plugins_.forEach((plugin) => plugin.flush());
}

export function _let(match: Match, select: (source: Observable<any>) => Observable<any>): () => void {

    return plugin(new LetPlugin(match, select), `let(${matchToString(match)})`);
}

export function log(partialLogger?: PartialLogger): () => void;
export function log(match: Match, partialLogger?: PartialLogger): () => void;
export function log(match: any, partialLogger?: PartialLogger): () => void {

    const anyTagged = /.+/;
    if (!match) {
        match = anyTagged;
    } else if (typeof match.log === "function") {
        partialLogger = match;
        match = anyTagged;
    }

    return plugin(new LogPlugin(match, partialLogger), `log(${matchToString(match)})`);
}

export function pause(match: Match): Deck {

    const pausePlugin = new PausePlugin(match);
    const teardown = plugin(pausePlugin, `pause(${matchToString(match)})`);

    const deck = pausePlugin.deck;
    deck.teardown = teardown;
    return deck;
}

export function plugin(plugin: Plugin, name: string): () => void {

    plugins_.push(plugin);
    pluginsSubject_.next(plugins_);

    const teardown = () => {

        plugin.teardown();
        plugins_ = plugins_.filter((p) => p !== plugin);
        pluginsSubject_.next(plugins_);
        undos_ = undos_.filter((u) => u.teardown !== teardown);
    };
    undos_.push({ name, teardown });

    return teardown;
}

export function plugins(): Plugin[] {

    return plugins_.slice();
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
    const snapshotGroupMethod = (filtered.length > 3) ? "groupCollapsed" : "group";

    logger.group(`Snapshot(s) matching ${matchToString(match)}`);
    filtered.forEach((o) => {

        logger[snapshotGroupMethod].call(logger, `Tag = ${o.tag}`);
        logger.log("State =", o.complete ? "complete" : o.error ? "error" : "incomplete");
        if (o.error) {
            logger.error("Error =", o.error);
        }
        const subscriptionGroupMethod = (o.subscriptions.length > 3) ? "groupCollapsed" : "group";
        logger[snapshotGroupMethod].call(logger, `${o.subscriptions.length} Subscription(s)`);
        o.subscriptions.forEach((s) => {
            logger[snapshotGroupMethod].call(logger, "Subscription");
            logger.log("Value count =", s.values.length + s.valuesFlushed);
            if (s.values.length > 0) {
                logger.log("Last value =", s.values[s.values.length - 1].value);
            }
            logger.groupEnd();
        });
        logger.groupEnd();
        logger.groupCollapsed("Raw snapshot");
        logger.log(o);
        logger.groupEnd();
        logger.groupEnd();
    });
    logger.groupEnd();
}

export function spy({ plugins }: { plugins?: Plugin[] } = {}): () => void {

    if (Observable.prototype.subscribe !== subscribeBase) {
        throw new Error("Already spying on Observable.prototype.subscribe.");
    }
    Observable.prototype.subscribe = subscribeWithSpy;

    if (plugins) {
        plugins_ = plugins;
    } else {
        plugins_ = [new SnapshotPlugin()];
    }
    pluginsSubject_.next(plugins_);

    const teardown = () => {

        plugins_.forEach((plugin) => plugin.teardown());
        plugins_ = [];
        pluginsSubject_.next(plugins_);
        pluginsSubject_ = new BehaviorSubject(plugins_);
        undos_ = [];
        Observable.prototype.subscribe = subscribeBase;
    };
    undos_.push({ name: "spy", teardown });

    return teardown;
}

export function tick(): number {

    return tick_;
}

export function subscribeWithoutSpy(this: Observable<any>, ...args: any[]): Subscription {

    const subscribePrevious = Observable.prototype.subscribe;
    Observable.prototype.subscribe = subscribeBase;

    try {
        /*tslint:disable-next-line:no-invalid-this*/
        return Observable.prototype.subscribe.apply(this, args);
    } finally {
        Observable.prototype.subscribe = subscribePrevious;
    }
}

function subscribeWithSpy(this: Observable<any>, ...args: any[]): any {

    /*tslint:disable-next-line:no-invalid-this*/
    const observable = this;
    const subscriber = toSubscriber.apply(null, args);

    interface PostLetObserver {
        complete: () => void;
        error: (error: any) => void;
        next: (value: any) => void;
        unsubscribed: boolean;
    }

    /*tslint:disable:no-invalid-this*/
    const postLetObserver: PostLetObserver = {

        complete(this: PostLetObserver): void {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeComplete(observable, subscriber));

            subscriber.complete();

            plugins_.forEach((plugin) => plugin.afterComplete(observable, subscriber));
        },

        error(this: PostLetObserver, error: any): void {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeError(observable, subscriber, error));

            subscriber.error(error);

            plugins_.forEach((plugin) => plugin.afterError(observable, subscriber, error));
        },

        next(this: PostLetObserver, value: any): void {

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeNext(observable, subscriber, value));

            subscriber.next(value);

            plugins_.forEach((plugin) => plugin.afterNext(observable, subscriber, value));
        },

        unsubscribed: false
    };
    /*tslint:enable:no-invalid-this*/
    const postLetSubscriber = toSubscriber(
        postLetObserver.next.bind(postLetObserver),
        postLetObserver.error.bind(postLetObserver),
        postLetObserver.complete.bind(postLetObserver)
    );

    interface PreLetObserver {
        complete: () => void;
        completed: boolean;
        error: (error: any) => void;
        errored: boolean;
        let: (plugins: Plugin[]) => void;
        next: (value: any) => void;
        postLetSubscriber: Subscriber<any>;
        postLetSubscription: Subscription | null;
        preLetSubject: Subject<any> | null;
        unsubscribed: boolean;
    }

    /*tslint:disable:no-invalid-this*/
    const preLetObserver: PreLetObserver = {

        complete(this: PreLetObserver): void {

            this.completed = true;

            if (this.preLetSubject) {
                this.preLetSubject.complete();
            } else {
                this.postLetSubscriber.complete();
            }
        },

        completed: false,

        error(this: PreLetObserver, error: any): void {

            this.errored = true;

            if (this.preLetSubject) {
                this.preLetSubject.error(error);
            } else {
                this.postLetSubscriber.error(error);
            }
        },

        errored: false,

        let(this: PreLetObserver, plugins: Plugin[]): void {

            const selectors = plugins.map((plugin) => plugin.select(observable, subscriber)).filter(Boolean);
            if (selectors.length > 0) {

                if (!this.preLetSubject) {
                    this.preLetSubject = new Subject<any>();
                }
                if (this.postLetSubscription) {
                    this.postLetSubscription.unsubscribe();
                }

                let source = this.preLetSubject.asObservable();
                selectors.forEach((selector: (source: Observable<any>) => Observable<any>) => source = source.let(selector));
                this.postLetSubscription = subscribeWithoutSpy.call(source, {
                    complete: () => this.postLetSubscriber.complete(),
                    error: (error: any) => this.postLetSubscriber.error(error),
                    next: (value: any) => this.postLetSubscriber.next(value)
                });

            } else if (this.postLetSubscription) {

                this.postLetSubscription.unsubscribe();
                this.postLetSubscription = null;
                this.preLetSubject = null;
            }
        },

        next(this: PreLetObserver, value: any): void {

            if (this.preLetSubject) {
                this.preLetSubject.next(value);
            } else {
                this.postLetSubscriber.next(value);
            }
        },

        postLetSubscriber,
        postLetSubscription: null,
        preLetSubject: null,
        unsubscribed: false
    };
    /*tslint:enable:no-invalid-this*/
    const preLetSubscriber = toSubscriber(
        preLetObserver.next.bind(preLetObserver),
        preLetObserver.error.bind(preLetObserver),
        preLetObserver.complete.bind(preLetObserver)
    );

    const pluginsSubscription = subscribeWithoutSpy.call(pluginsSubject_, {
        next: (plugins: any) => preLetObserver.let(plugins)
    });

    const preLetUnsubscribe = preLetSubscriber.unsubscribe;
    preLetSubscriber.unsubscribe = () => {

        if (!preLetObserver.unsubscribed) {

            preLetObserver.unsubscribed = true;

            if (!preLetObserver.completed && !preLetObserver.errored) {
                if (preLetObserver.postLetSubscription) {
                    preLetObserver.postLetSubscription.unsubscribe();
                    preLetObserver.postLetSubscription = null;
                }
                preLetObserver.postLetSubscriber.unsubscribe();
            }
        }
        preLetUnsubscribe.call(preLetSubscriber);
    };
    subscriber.add(preLetSubscriber);

    const postLetUnsubscribe = postLetSubscriber.unsubscribe;
    postLetSubscriber.unsubscribe = () => {

        if (!postLetObserver.unsubscribed) {

            postLetObserver.unsubscribed = true;

            ++tick_;
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(observable, subscriber));

            postLetUnsubscribe.call(postLetSubscriber);
            pluginsSubscription.unsubscribe();

            plugins_.forEach((plugin) => plugin.afterUnsubscribe(observable, subscriber));

        } else {
            postLetUnsubscribe.call(postLetSubscriber);
        }
    };

    ++tick_;
    plugins_.forEach((plugin) => plugin.beforeSubscribe(observable, subscriber));

    const subscription = subscribeBase.call(observable, preLetSubscriber);

    plugins_.forEach((plugin) => plugin.afterSubscribe(observable, subscriber));

    return subscription;
}
