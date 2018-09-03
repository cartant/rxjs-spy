/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import {
    BehaviorSubject,
    Observable,
    Subject,
    Subscription
} from "rxjs";

import { Auditor } from "./auditor";
import { hook } from "./detect";
import { Detector } from "./detector";
import { hidden } from "./hidden";
import { identify } from "./identify";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match, matches, toString as matchToString } from "./match";
import { hide } from "./operators";

import {
    CyclePlugin,
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
    StatsPlugin,
    SubscriptionSnapshot
} from "./plugin";

import { wrap } from "./spy-console";
import { Ctor, Options, Spy, Teardown } from "./spy-interface";
import { SubscriberRef, SubscriptionRef } from "./subscription-ref";
import { isObservable, toSubscriber } from "./util";

declare const __RX_SPY_VERSION__: string;
const observableSubscribe = Observable.prototype.subscribe;
const previousWindow: Record<string, any> = {};

export class SpyCore implements Spy {

    private static spy_: SpyCore | undefined = undefined;

    private auditor_: Auditor;
    private defaultLogger_: PartialLogger;
    private plugins_: Plugin[];
    private pluginsSubject_: BehaviorSubject<Plugin[]>;
    private teardown_: Teardown | undefined;
    private tick_: number;
    private undos_: Plugin[];
    private warned_: { [key: string]: boolean };

    constructor(options: {
        [key: string]: any,
        audit?: number;
        defaultLogger?: PartialLogger,
        defaultPlugins?: boolean,
        devTools?: boolean,
        plugins?: Plugin[],
        warning?: boolean
    } = {}) {

        if (SpyCore.spy_) {
            throw new Error("Already spying on Observable.prototype.subscribe.");
        }
        if (options.warning) {
            /*tslint:disable-next-line:no-console*/
            console.warn("Spying on Observable.prototype.subscribe.");
        }

        SpyCore.spy_ = this;
        Observable.prototype.subscribe = SpyCore.coreSubscribe_;

        this.auditor_ = new Auditor(options.audit || 0);
        this.defaultLogger_ = options.defaultLogger || defaultLogger;
        if (options.defaultPlugins ===  false) {
            this.plugins_ = [];
        } else {
            this.plugins_ = [
                new StackTracePlugin(options as Options),
                new GraphPlugin(options as Options),
                new SnapshotPlugin(this, options as Options),
                new CyclePlugin(this, this.defaultLogger_),
                new StatsPlugin(this)
            ];
            if (options.devTools !==  false) {
                this.plugins_.push(new DevToolsPlugin(this));
            }
        }
        this.pluginsSubject_ = new BehaviorSubject(this.plugins_);
        this.tick_ = 0;
        this.undos_ = [];
        this.warned_ = {};

        const detector = new Detector(this);
        hook((id) => this.detect_(id, detector));

        if (typeof window !== "undefined") {
            ["rxSpy", "spy"].forEach(key => {
                if (window.hasOwnProperty(key)) {
                    this.defaultLogger_.log(`Overwriting window.${key}`);
                    previousWindow[key] = window[key];
                }
                window[key] = wrap(this, key === "spy" ?
                    undefined :
                    () => this.warnOnce(this.defaultLogger_, `${key} is deprecated; use spy instead`)
                );
            });
        }

        this.teardown_ = () => {

            if (typeof window !== "undefined") {
                ["rxSpy", "spy"].forEach(key => {
                    if (previousWindow.hasOwnProperty(key)) {
                        this.defaultLogger_.log(`Restoring window.${key}`);
                        window[key] = previousWindow[key];
                        delete previousWindow[key];
                    } else {
                        delete window[key];
                    }
                });
            }

            hook(undefined);
            this.plugins_.forEach((plugin) => plugin.teardown());
            this.plugins_ = [];
            this.pluginsSubject_.next(this.plugins_);
            this.undos_ = [];

            SpyCore.spy_ = undefined;
            Observable.prototype.subscribe = observableSubscribe;
        };
    }

    get auditor(): Auditor {

        return this.auditor_;
    }

    get tick(): number {

        return this.tick_;
    }

    get undos(): Plugin[] {

        return [...this.undos_];
    }

    get version(): string {

        return __RX_SPY_VERSION__;
    }

    debug(match: Match, ...notifications: Notification[]): Teardown {

        if (notifications.length === 0) {
            notifications = ["complete", "error", "next", "subscribe", "unsubscribe"];
        }
        return this.plug(new DebugPlugin(match, notifications));
    }

    find<T extends Plugin>(ctor: Ctor<T>): T | undefined {

        const found = this.plugins_.find((plugin) => plugin instanceof ctor);
        return found ? found as T : undefined;
    }

    findAll<T extends Plugin>(ctor: Ctor<T>): T[];
    findAll(): Plugin[];
    findAll<T extends Plugin>(ctor?: Ctor<T>): T[] | Plugin[] {

        return ctor ?
            this.plugins_.filter((plugin) => plugin instanceof ctor) as T[] :
            this.plugins_;
    }

    flush(): void {

        this.plugins_.forEach((plugin) => plugin.flush());
    }

    let(match: Match, select: (source: Observable<any>) => Observable<any>, options?: Options): Teardown {

        return this.plug(new LetPlugin(match, select, options));
    }

    log(match: Match, partialLogger?: PartialLogger): Teardown;
    log(partialLogger?: PartialLogger): Teardown;
    log(match: any, partialLogger?: PartialLogger): Teardown {

        const anyTagged = /.+/;
        if (!match) {
            match = anyTagged;
        } else if (typeof match.log === "function") {
            partialLogger = match;
            match = anyTagged;
        }

        return this.plug(new LogPlugin(this, match, partialLogger || this.defaultLogger_));
    }

    pause(match: Match): Deck {

        const pausePlugin = new PausePlugin(match);
        const teardown = this.plug(pausePlugin);

        const deck = pausePlugin.deck;
        deck.teardown = teardown;
        return deck;
    }

    plug(...plugins: Plugin[]): Teardown {

        this.plugins_.push(...plugins);
        this.pluginsSubject_.next(this.plugins_);

        this.undos_.push(...plugins);
        return () => this.unplug(...plugins);
    }

    show(match: Match, partialLogger?: PartialLogger): void;
    show(partialLogger?: PartialLogger): void;
    show(match: any, partialLogger?: PartialLogger): void {

        const anyTagged = /.+/;
        if (!match) {
            match = anyTagged;
        } else if (typeof match.log === "function") {
            partialLogger = match;
            match = anyTagged;
        }

        const snapshotPlugin = this.find(SnapshotPlugin);
        if (!snapshotPlugin) {
            this.warnOnce(console, "Snapshotting is not enabled.");
            return;
        }

        const snapshot = snapshotPlugin.snapshotAll();
        const filtered = Array
            .from(snapshot.observables.values())
            .filter((observableSnapshot) => matches(observableSnapshot.observable, match));
        const logger = toLogger(partialLogger || this.defaultLogger_);
        const observableGroupMethod = (filtered.length > 3) ? "groupCollapsed" : "group";

        const maxShown = 20;
        const notShown = (filtered.length > maxShown) ? filtered.length - maxShown : 0;
        if (notShown) {
            filtered.splice(maxShown, notShown);
        }

        snapshot.mapStackTraces(filtered).subscribe(() => {

            logger.group(`${filtered.length + notShown} snapshot(s) matching ${matchToString(match)}`);
            filtered.forEach((observableSnapshot) => {

                const { subscriptions } = observableSnapshot;
                logger[observableGroupMethod].call(logger, observableSnapshot.tag ?
                    `Tag = ${observableSnapshot.tag}` :
                    `Type = ${observableSnapshot.type}`
                );
                logger.log("Path =", observableSnapshot.path);

                const subscriberGroupMethod = (subscriptions.size > 3) ? "groupCollapsed" : "group";
                logger.group(`${subscriptions.size} subscriber(s)`);
                subscriptions.forEach((subscriptionSnapshot) => {

                    const subscriberSnapshot = snapshot.subscribers.get(subscriptionSnapshot.subscriber);
                    if (subscriberSnapshot) {

                        const { values, valuesFlushed } = subscriberSnapshot;
                        logger[subscriberGroupMethod].call(logger, "Subscriber");
                        logger.log("Value count =", values.length + valuesFlushed);
                        if (values.length > 0) {
                            logger.log("Last value =", values[values.length - 1].value);
                        }
                        logSubscription(subscriptionSnapshot);

                        const otherSubscriptions = Array
                            .from(subscriberSnapshot.subscriptions.values())
                            .filter((otherSubscriptionSnapshot) => otherSubscriptionSnapshot !== subscriptionSnapshot);
                        otherSubscriptions.forEach((otherSubscriptionSnapshot) => {
                            logger.groupCollapsed("Other subscription");
                            logSubscription(otherSubscriptionSnapshot);
                            logger.groupEnd();
                        });
                        logger.groupEnd();
                    } else {
                        logger.warn("Cannot find subscriber snapshot");
                    }
                });
                logger.groupEnd();
                logger.groupEnd();
            });
            if (notShown) {
                logger.log(`... another ${notShown} snapshot(s) not shown.`);
            }
            logger.groupEnd();
        });

        function logStackTrace(subscriptionSnapshot: SubscriptionSnapshot): void {

            const { mappedStackTrace, rootSink } = subscriptionSnapshot;
            const mapped = rootSink ? rootSink.mappedStackTrace : mappedStackTrace;
            mapped.subscribe(stackTrace => logger.log("Root subscribe", stackTrace));
        }

        function logSubscription(subscriptionSnapshot: SubscriptionSnapshot): void {

            const { complete, error, unsubscribed } = subscriptionSnapshot;
            logger.log("State =", complete ? "complete" : error ? "error" : "incomplete");
            if (error) {
                logger.error("Error =", error);
            }
            if (unsubscribed) {
                logger.log("Unsubscribed =", true);
            }
            logStackTrace(subscriptionSnapshot);
        }
    }

    stats(partialLogger?: PartialLogger): void {

        const statsPlugin = this.find(StatsPlugin);
        if (!statsPlugin) {
            this.warnOnce(console, "Stats are not enabled.");
            return;
        }

        const stats = statsPlugin.stats;
        const { leafSubscribes, maxDepth, flattenedSubscribes, rootSubscribes, totalDepth } = stats;
        const logger = toLogger(partialLogger || this.defaultLogger_);
        logger.group("Stats");
        logger.log("Subscribes =", stats.subscribes);
        if (rootSubscribes > 0) {
            logger.log("Root subscribes =", rootSubscribes);
        }
        if (leafSubscribes > 0) {
            logger.log("Leaf subscribes =", leafSubscribes);
        }
        if (flattenedSubscribes > 0) {
            logger.log("Flattened subscribes =", flattenedSubscribes);
        }
        logger.log("Unsubscribes =", stats.unsubscribes);
        logger.log("Nexts =", stats.nexts);
        logger.log("Errors =", stats.errors);
        logger.log("Completes =", stats.completes);
        if (maxDepth > 0) {
            logger.log("Max. depth =", maxDepth);
            logger.log("Avg. depth =", (totalDepth / leafSubscribes).toFixed(1));
        }
        logger.log("Tick =", stats.tick);
        logger.log("Timespan =", stats.timespan);
        logger.groupEnd();
    }

    teardown(): void {

        if (this.teardown_) {
            this.teardown_();
            this.teardown_ = undefined;
        }
    }

    unplug(...plugins: Plugin[]): void {

        plugins.forEach((plugin) => {
            plugin.teardown();
            this.plugins_ = this.plugins_.filter((p) => p !== plugin);
            this.pluginsSubject_.next(this.plugins_);
            this.undos_ = this.undos_.filter((u) => u !== plugin);
        });
    }

    /** @deprecated Use warnOnce */
    warn(logger: PartialLogger, message: any, ...args: any[]): void {

        this.warnOnce(logger, message, ...args);
    }

    warnOnce(logger: PartialLogger, message: any, ...args: any[]): void {

        if (!this.warned_[message]) {
            toLogger(logger).warn(message, ...args);
            this.warned_[message] = true;
        }
    }

    /*tslint:disable-next-line:member-ordering*/
    private static coreSubscribe_(this: Observable<any>, ...args: any[]): Subscription {

        /*tslint:disable-next-line:no-invalid-this*/
        const observable = this;

        const { spy_ } = SpyCore;
        if (!spy_) {
            return observableSubscribe.apply(observable, args);
        }
        if (hidden(observable)) {
            SpyCore.spy_ = undefined;
            try {
                return observableSubscribe.apply(observable, args);
            } finally {
                SpyCore.spy_ = spy_;
            }
        }
        const notify_ = (before: (plugin: Plugin) => void, block: () => void, after: (plugin: Plugin) => void) => {
            ++spy_.tick_;
            spy_.plugins_.forEach(before);
            block();
            spy_.plugins_.forEach(after);
        };

        const subscriber = toSubscriber.apply(undefined, args);
        const ref: SubscriptionRef = {
            observable,
            subscriber,
            subscription: new Subscription(),
            timestamp: Date.now(),
            unsubscribed: false
        };

        identify(observable);
        identify(subscriber);
        identify(ref);

        const subscriberUnsubscribe = subscriber.unsubscribe;
        subscriber.unsubscribe = () => {
            if (!subscriber.closed) {
                notify_(
                    (plugin) => plugin.beforeUnsubscribe(ref),
                    () => {
                        ref.subscription.unsubscribe();
                        ref.unsubscribed = true;
                        subscriberUnsubscribe.call(subscriber);
                    },
                    (plugin) => plugin.afterUnsubscribe(ref)
                );
            } else {
                subscriberUnsubscribe.call(subscriber);
            }
        };

        const postSelectObserver = {

            complete(): void {
                notify_(
                    (plugin) => plugin.beforeComplete(ref),
                    () => subscriber.complete(),
                    (plugin) => plugin.afterComplete(ref)
                );
            },

            error(error: any): void {
                if (!(error instanceof Error)) {
                    /*tslint:disable-next-line:no-console*/
                    console.warn("Value passed as error notification is not an Error instance =", error);
                }
                notify_(
                    (plugin) => plugin.beforeError(ref, error),
                    () => subscriber.error(error),
                    (plugin) => plugin.afterError(ref, error)
                );
            },

            next(value: any): void {
                notify_(
                    (plugin) => plugin.beforeNext(ref, value),
                    () => subscriber.next(value),
                    (plugin) => plugin.afterNext(ref, value)
                );
            }
        };

        const preSelectObserver = {

            complete(): void {
                this.completed = true;
                if (this.preSelectSubject) {
                    this.preSelectSubject.complete();
                } else {
                    this.postSelectObserver.complete();
                }
            },

            completed: false,

            error(error: any): void {
                this.errored = true;
                if (this.preSelectSubject) {
                    this.preSelectSubject.error(error);
                } else {
                    this.postSelectObserver.error(error);
                }
            },

            errored: false,

            let(plugins: Plugin[]): void {
                const selectors = plugins.map((plugin) => plugin.select(ref)).filter(Boolean);
                if (selectors.length > 0) {
                    if (!this.preSelectSubject) {
                        this.preSelectSubject = new Subject<any>();
                    }
                    if (this.postSelectSubscription) {
                        this.postSelectSubscription.unsubscribe();
                    }
                    let source = this.preSelectSubject.asObservable();
                    selectors.forEach(selector => source = selector!(source));
                    this.postSelectSubscription = source.pipe(hide()).subscribe(postSelectObserver);
                } else if (this.postSelectSubscription) {
                    this.postSelectSubscription.unsubscribe();
                    this.postSelectSubscription = undefined;
                    this.preSelectSubject = undefined;
                }
            },

            next(value: any): void {
                if (this.preSelectSubject) {
                    this.preSelectSubject.next(value);
                } else {
                    this.postSelectObserver.next(value);
                }
            },

            postSelectObserver,
            postSelectSubscription: undefined as Subscription | undefined,
            preSelectSubject: undefined as Subject<any> | undefined,

            unsubscribe(): void {
                if (!this.unsubscribed) {
                    this.unsubscribed = true;
                    if (!this.completed && !this.errored) {
                        if (this.postSelectSubscription) {
                            this.postSelectSubscription.unsubscribe();
                            this.postSelectSubscription = undefined;
                        }
                    }
                }
            },

            unsubscribed: false
        };

        subscriber.add(spy_.pluginsSubject_.pipe(hide()).subscribe({
            next: (plugins: any) => preSelectObserver.let(plugins)
        }));

        notify_(
            (plugin) => plugin.beforeSubscribe(ref),
            () => {
                subscriber.add(observableSubscribe.call(observable, preSelectObserver));
                subscriber.add(() => preSelectObserver.unsubscribe());
            },
            (plugin) => plugin.afterSubscribe(ref)
        );
        return subscriber;
    }

    private detect_(id: string, detector: Detector): void {

        const { auditor_, defaultLogger_ } = this;

        auditor_.audit(id, (ignored) => {

            const detected = detector.detect(id);
            const logger = toLogger(defaultLogger_);

            if (detected) {
                const audit = (ignored === 0) ? "" : `; ignored ${ignored}`;
                logger.group(`Subscription changes detected; id = '${id}'${audit}`);
                detected.subscriptions.forEach((s) => {
                    logSubscription(logger, "Subscription", s);
                });
                detected.unsubscriptions.forEach((s) => {
                    logSubscription(logger, "Unsubscription", s);
                });
                detected.flatteningSubscriptions.forEach((s) => {
                    logSubscription(logger, "Flattening subscription", s);
                });
                detected.flatteningUnsubscriptions.forEach((s) => {
                    logSubscription(logger, "Flattening unsubscription", s);
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
        });
    }
}
