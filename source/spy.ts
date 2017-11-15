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
import { detect, hook } from "./detect";
import { Detector } from "./detector";
import { identify } from "./identify";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match, matches, toString as matchToString } from "./match";

import {
    DebugPlugin,
    Deck,
    DevToolsPlugin,
    GraphPlugin,
    LetPlugin,
    LogPlugin,
    Notification,
    PausePlugin,
    Plugin,
    SnapshotPlugin,
    StackTracePlugin,
    Stats,
    StatsPlugin,
    SubscriberSnapshot,
    SubscriptionRef,
    SubscriptionSnapshot
} from "./plugin";

import { increment } from "./tick";
import { isObservable, toSubscriber } from "./util";

import "rxjs/add/operator/let";

const subscribeBase = Observable.prototype.subscribe;
let plugins_: Plugin[] = [];
let pluginsSubject_ = new BehaviorSubject(plugins_);
let undos_: { name: string, teardown: () => void }[] = [];

if (typeof window !== "undefined") {

    const consoleApi = {

        deck(call?: number): any {

            const pausePlugins = findAll(PausePlugin);
            if (call === undefined) {
                const logger = toLogger(defaultLogger);
                logger.group(`${pausePlugins.length} Deck(s)`);
                pausePlugins.forEach((pausePlugin, index) => {
                    logger.log(`${index + 1} pause(${matchToString(pausePlugin.match)})`);
                });
                logger.groupEnd();
            } else {
                const pausePlugin = pausePlugins[call - 1];
                return pausePlugin ? pausePlugin.deck : null;
            }
        },

        debug(...args: any[]): void {

            debug.apply(null, args);
        },

        detect(id: string = ""): void {

            detect(id);
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

        stats(): void {

            stats();
        },

        undo(...args: any[]): void {

            if (args.length === 0) {
                const logger = toLogger(defaultLogger);
                logger.group(`${undos_.length} undo(s)`);
                undos_.forEach((undo, index) => {
                    logger.log(`${index + 1} ${undo.name}`);
                });
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

    return plugin(
        new DebugPlugin(match, notifications),
        `debug(${matchToString(match)})`
    );
}

export function find<T extends Plugin>(constructor: { new (...args: any[]): T }): T | null {

    const found = plugins_.find((plugin) => plugin instanceof constructor);
    return found ? found as T : null;
}

export function findAll<T extends Plugin>(constructor: { new (...args: any[]): T }): T[] {

    return plugins_.filter((plugin) => plugin instanceof constructor) as T[];
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

    return plugin(
        new LogPlugin(match, partialLogger),
        `log(${matchToString(match)})`
    );
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

    const snapshotPlugin = find(SnapshotPlugin);
    if (!snapshotPlugin) {
        /*tslint:disable-next-line:no-console*/
        console.warn("Snapshotting is not enabled.");
        return;
    }

    const snapshot = snapshotPlugin.snapshotAll();
    const filtered = Array
        .from(snapshot.observables.values())
        .filter((observableSnapshot) => matches(observableSnapshot.observable, match));
    const logger = toLogger(partialLogger);
    const snapshotGroupMethod = (filtered.length > 3) ? "groupCollapsed" : "group";

    logger.group(`${filtered.length} snapshot(s) matching ${matchToString(match)}`);
    filtered.forEach((observableSnapshot) => {

        const { subscribers } = observableSnapshot;
        logger[snapshotGroupMethod].call(logger, `Tag = ${observableSnapshot.tag}`);

        const subscriberGroupMethod = (subscribers.size > 3) ? "groupCollapsed" : "group";
        logger.group(`${subscribers.size} subscriber(s)`);
        subscribers.forEach((subscriberSnapshot) => {

            const { values, valuesFlushed } = subscriberSnapshot;
            logger[subscriberGroupMethod].call(logger, "Subscriber");
            logger.log("Value count =", values.length + valuesFlushed);
            if (values.length > 0) {
                logger.log("Last value =", values[values.length - 1].value);
            }

            const { subscriptions } = subscriberSnapshot;
            logger.groupCollapsed(`${subscriptions.size} subscription(s)`);
            subscriptions.forEach((subscriptionSnapshot) => {

                const { complete, error, rootSink, stackTrace, unsubscribed } = subscriptionSnapshot;
                logger.log("State =", complete ? "complete" : error ? "error" : "incomplete");
                if (error) {
                    logger.error("Error =", error);
                }
                if (unsubscribed) {
                    logger.error("Unsubscribed =", true);
                }
                logger.log("Root subscribe", rootSink ? rootSink.stackTrace : stackTrace);
            });
            logger.groupEnd();
            logger.groupEnd();
        });
        logger.groupEnd();
        logger.groupCollapsed("Raw snapshot");
        logger.log(observableSnapshot);
        logger.groupEnd();
        logger.groupEnd();
    });
    logger.groupEnd();
}

export function spy(options: {
    [key: string]: any,
    plugins?: Plugin[]
    warning?: boolean
} = {}): () => void {

    const { plugins, warning } = options;

    if (Observable.prototype.subscribe !== subscribeBase) {
        throw new Error("Already spying on Observable.prototype.subscribe.");
    }
    if (warning) {
        /*tslint:disable-next-line:no-console*/
        console.warn("Spying on Observable.prototype.subscribe.");
    }

    Observable.prototype.subscribe = subscribeWithSpy;

    if (plugins) {
        plugins_ = plugins;
    } else {
        plugins_ = [
            new StackTracePlugin(options as { [key: string]: any }),
            new GraphPlugin(options as { [key: string]: any }),
            new SnapshotPlugin(options as { [key: string]: any }),
            new StatsPlugin(),
            new DevToolsPlugin()
        ];
    }
    pluginsSubject_.next(plugins_);

    const detector = new Detector(find(SnapshotPlugin));
    hook((id) => detectWithLog(id, detector));

    const teardown = () => {

        hook(null);
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

export function stats(partialLogger?: PartialLogger): void {

    const statsPlugin = find(StatsPlugin);
    if (!statsPlugin) {
        /*tslint:disable-next-line:no-console*/
        console.warn("Stats are not enabled.");
        return;
    }

    const stats = statsPlugin.stats;
    const { leafSubscribes, maxDepth, mergedSubscribes, rootSubscribes, totalDepth } = stats;
    const logger = toLogger(partialLogger || defaultLogger);
    logger.group("Stats");
    logger.log("subscribes =", stats.subscribes);
    if (rootSubscribes > 0) {
        logger.log("root subscribes =", rootSubscribes);
    }
    if (leafSubscribes > 0) {
        logger.log("leaf subscribes =", leafSubscribes);
    }
    if (mergedSubscribes > 0) {
        logger.log("merged subscribes =", mergedSubscribes);
    }
    logger.log("unsubscribes =", stats.unsubscribes);
    logger.log("nexts =", stats.nexts);
    logger.log("errors =", stats.errors);
    logger.log("completes =", stats.completes);
    if (maxDepth > 0) {
        logger.log("max. depth =", maxDepth);
        logger.log("avg. depth =", (totalDepth / leafSubscribes).toFixed(1));
    }
    logger.log("tick =", stats.tick);
    logger.log("timespan =", stats.timespan);
    logger.groupEnd();
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

function detectWithLog(id: string, detector: Detector): void {

    const detected = detector.detect(id);
    const logger = toLogger(defaultLogger);

    if (detected) {
        logger.group(`Subscription changes detected; id = '${id}'`);
        detected.subscriptions.forEach((s) => {
            logSubscription(logger, "Subscription", s);
        });
        detected.unsubscriptions.forEach((s) => {
            logSubscription(logger, "Unsubscription", s);
        });
        detected.mergeSubscriptions.forEach((s) => {
            logSubscription(logger, "Merge subscription", s);
        });
        detected.mergeUnsubscriptions.forEach((s) => {
            logSubscription(logger, "Merge unsubscription", s);
        });
        logger.groupEnd();
    }

    function logSubscription(logger: Logger, name: string, subscription: SubscriptionSnapshot): void {

        logger.group(name);
        logger.log("Root subscribe", subscription.rootSink ?
            subscription.rootSink.stackTrace :
            subscription.stackTrace
        );
        logger.log("Subscribe", subscription.stackTrace);
        logger.groupEnd();
    }
}

function subscribeWithSpy(this: Observable<any>, ...args: any[]): any {

    /*tslint:disable-next-line:no-invalid-this*/
    const observable = this;
    const subscriber = toSubscriber.apply(null, args);

    identify(observable);
    identify(subscriber);

    const ref: SubscriptionRef = {
        observable,
        subscriber,
        subscription: null!,
        timestamp: Date.now(),
        unsubscribed: false
    };
    identify(ref);

    interface PostLetObserver {
        complete: () => void;
        error: (error: any) => void;
        next: (value: any) => void;
        unsubscribed: boolean;
    }

    /*tslint:disable:no-invalid-this*/
    const postLetObserver: PostLetObserver = {

        complete(this: PostLetObserver): void {

            increment();
            plugins_.forEach((plugin) => plugin.beforeComplete(ref));

            subscriber.complete();

            plugins_.forEach((plugin) => plugin.afterComplete(ref));
        },

        error(this: PostLetObserver, error: any): void {

            if (!(error instanceof Error)) {
                /*tslint:disable-next-line:no-console*/
                console.warn("Value passed as error notification is not an Error instance =", error);
            }

            increment();
            plugins_.forEach((plugin) => plugin.beforeError(ref, error));

            subscriber.error(error);

            plugins_.forEach((plugin) => plugin.afterError(ref, error));
        },

        next(this: PostLetObserver, value: any): void {

            increment();
            plugins_.forEach((plugin) => plugin.beforeNext(ref, value));

            subscriber.next(value);

            plugins_.forEach((plugin) => plugin.afterNext(ref, value));
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

            const selectors = plugins.map((plugin) => plugin.select(ref)).filter(Boolean);
            if (selectors.length > 0) {

                if (!this.preLetSubject) {
                    this.preLetSubject = new Subject<any>();
                }
                if (this.postLetSubscription) {
                    this.postLetSubscription.unsubscribe();
                }

                let source = this.preLetSubject.asObservable();
                selectors.forEach(selector => source = source.let(selector!));
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

            increment();
            plugins_.forEach((plugin) => plugin.beforeUnsubscribe(ref));

            postLetUnsubscribe.call(postLetSubscriber);
            pluginsSubscription.unsubscribe();
            ref.unsubscribed = true;

            plugins_.forEach((plugin) => plugin.afterUnsubscribe(ref));

        } else {
            postLetUnsubscribe.call(postLetSubscriber);
        }
    };

    increment();
    plugins_.forEach((plugin) => plugin.beforeSubscribe(ref));

    const subscription = subscribeBase.call(observable, preLetSubscriber);
    ref.subscription = subscription;

    plugins_.forEach((plugin) => plugin.afterSubscribe(ref));

    return subscription;
}
