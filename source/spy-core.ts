/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import {
    BehaviorSubject,
    Observable,
    Operator,
    Subject,
    Subscription
} from "rxjs";

import { Auditor } from "./auditor";
import { compile } from "./expression";
import { hidden } from "./hidden";
import { identify } from "./identify";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match, matches, toString as matchToString } from "./match";
import { hide } from "./operators";
import { hook } from "./sweep";
import { Sweeper } from "./sweeper";

import {
    BufferPlugin,
    CyclePlugin,
    Deck,
    DevToolsPlugin,
    GraphPlugin,
    LogPlugin,
    ObservableSnapshot,
    PausePlugin,
    PipePlugin,
    Plugin,
    PluginCtor,
    PluginOptions,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin,
    SubscriberSnapshot,
    SubscriptionSnapshot
} from "./plugin";

import { wrap } from "./spy-console";
import { QueryDerivations, QueryPredicate, Spy, Teardown } from "./spy-interface";
import { setSubscriptionRef, SubscriptionRef } from "./subscription-ref";
import { toSubscriber } from "./util";

declare const __RXJS_SPY_VERSION__: string;
const observableLift = Observable.prototype.lift;
const observablePipe = Observable.prototype.pipe;
const observableSubscribe = Observable.prototype.subscribe;
const previousWindow: Record<string, any> = {};

const defaultDerivations: QueryDerivations = {
    blocked: ({ nextAge, sinkNextAge }) => nextAge > sinkNextAge,
    blocking: ({ nextAge, sourceNextAge }) => sourceNextAge > nextAge,
    file: record => (match: string | RegExp) => matchStackTrace(record, "fileName", match),
    flat: record => (match: number | string) => matchSource(record, "flats", match),
    func: record => (match: string | RegExp) => matchStackTrace(record, "functionName", match),
    id: record => (match: number | string) => matchId(record, match),
    source: record => (match: number | string) => matchSource(record, "sources", match)
};

export class SpyCore implements Spy {

    private static spy_: SpyCore | undefined = undefined;

    private auditor_: Auditor;
    private defaultLogger_: Logger;
    private derivations_: QueryDerivations;
    private maxLogged_ = 20;
    private plugins_: Plugin[];
    private pluginsSubject_: BehaviorSubject<Plugin[]>;
    private teardown_: Teardown | undefined;
    private tick_: number;
    private undos_: Plugin[];

    constructor(options: {
        [key: string]: any,
        audit?: number;
        defaultLogger?: PartialLogger,
        defaultPlugins?: boolean,
        devTools?: boolean,
        global?: string,
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
        Observable.prototype.lift = SpyCore.coreLift_;
        Observable.prototype.pipe = SpyCore.corePipe_;
        Observable.prototype.subscribe = SpyCore.coreSubscribe_;

        this.auditor_ = new Auditor(options.audit || 0);
        this.defaultLogger_ = toLogger(options.defaultLogger || defaultLogger);
        this.derivations_ = {};
        if (options.defaultPlugins ===  false) {
            this.plugins_ = [];
        } else {
            this.plugins_ = [
                new StackTracePlugin({ ...options, spy: this }),
                new GraphPlugin({ ...options, spy: this }),
                new SnapshotPlugin({ ...options, spy: this }),
                new BufferPlugin({ ...options, spy: this }),
                new CyclePlugin({ ...options, spy: this }),
                new StatsPlugin({ spy: this })
            ];
            if (options.devTools !==  false) {
                this.plugins_.push(new DevToolsPlugin({ spy: this }));
            }
        }
        this.pluginsSubject_ = new BehaviorSubject(this.plugins_);
        this.tick_ = 0;
        this.undos_ = [];

        const sweeper = new Sweeper(this);
        hook(id => this.sweep_(id, sweeper));

        if (typeof window !== "undefined") {
            [options.global || "spy", "rxSpy"].forEach(key => {
                if (window.hasOwnProperty(key)) {
                    this.defaultLogger_.log(`Overwriting window.${key}`);
                    previousWindow[key] = window[key];
                }
                window[key] = wrap(this, key === "rxSpy" ?
                    () => this.defaultLogger_.warnOnce(`window.${key} is deprecated and has been renamed; use window.spy instead`) :
                    undefined
                );
            });
        }

        this.teardown_ = () => {

            if (typeof window !== "undefined") {
                [options.global || "spy", "rxSpy"].forEach(key => {
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
            this.plugins_.forEach(plugin => plugin.teardown());
            this.plugins_ = [];
            this.pluginsSubject_.next(this.plugins_);
            this.undos_ = [];

            SpyCore.spy_ = undefined;
            Observable.prototype.lift = observableLift;
            Observable.prototype.pipe = observablePipe;
            Observable.prototype.subscribe = observableSubscribe;
        };
    }

    get auditor(): Auditor {

        return this.auditor_;
    }

    get logger(): Logger {

        return this.defaultLogger_;
    }

    get tick(): number {

        return this.tick_;
    }

    get undos(): Plugin[] {

        return [...this.undos_];
    }

    get version(): string {

        return __RXJS_SPY_VERSION__;
    }

    find<P extends Plugin, O extends PluginOptions>(ctor: PluginCtor<P, O>): P[] {

        return this.plugins_.filter(plugin => plugin instanceof ctor) as P[];
    }

    log(observableMatch: Match, notificationMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(observableMatch: Match, partialLogger?: PartialLogger): Teardown;
    log(partialLogger?: PartialLogger): Teardown;
    log(...args: any[]): Teardown {

        let observableMatch: Match = /.+/;
        let notificationMatch: Match = /.+/;
        let partialLogger: PartialLogger = this.defaultLogger_;

        if (args.length === 1) {
            const [arg] = args;
            if (typeof arg.log === "function") {
                partialLogger = arg;
            } else {
                observableMatch = arg;
            }
        } else if (args.length === 2) {
            let arg: any;
            [observableMatch, arg] = args;
            if (typeof arg.log === "function") {
                partialLogger = arg;
            } else {
                notificationMatch = arg;
            }
        } else if (args.length === 3) {
            [observableMatch, notificationMatch, partialLogger] = args;
        }

        return this.plug(new LogPlugin({
            logger: partialLogger,
            notificationMatch,
            observableMatch,
            spy: this
        }));
    }

    maxLogged(value: number): void {

        this.maxLogged_ = Math.max(value, 1);
    }

    pause(match: Match): Deck {

        const pausePlugin = new PausePlugin({ match, spy: this });
        const teardown = this.plug(pausePlugin);

        const deck = pausePlugin.deck;
        deck.teardown = teardown;
        return deck;
    }

    pipe(match: Match, operator: (source: Observable<any>) => Observable<any>, complete?: boolean): Teardown {

        return this.plug(new PipePlugin({
            complete,
            match,
            operator,
            spy: this
        }));
    }

    plug(...plugins: Plugin[]): Teardown {

        this.plugins_.push(...plugins);
        this.pluginsSubject_.next(this.plugins_);

        this.undos_.push(...plugins);
        return () => this.unplug(...plugins);
    }

    query(predicate: string | QueryPredicate, partialLogger?: PartialLogger): void;
    query(derivations: QueryDerivations): void;
    query(arg: string | QueryPredicate | QueryDerivations, partialLogger?: PartialLogger): void {

        if ((typeof arg !== "string") && (typeof arg !== "function")) {
            this.derivations_ = arg;
            return;
        }

        const { func: predicate, keys } = (typeof arg === "string") ?
            compile(arg) :
            { func: arg, keys: [] };

        const [snapshotPlugin] = this.find(SnapshotPlugin);
        if (!snapshotPlugin) {
            this.defaultLogger_.warnOnce("Snapshotting is not enabled.");
            return;
        }

        const snapshot = snapshotPlugin.snapshotAll();
        const observableSnapshots = Array.from(snapshot.observables.values());
        const logger = toLogger(partialLogger || this.defaultLogger_);

        snapshot.mapStackTraces(observableSnapshots).subscribe(() => {

            const found: {
                observable: ObservableSnapshot;
                subs: {
                    subscriber: SubscriberSnapshot;
                    subscription: SubscriptionSnapshot;
                }[]
            }[] = [];

            observableSnapshots.forEach(observableSnapshot => {

                let find: typeof found[0] | undefined;

                const { subscriptions } = observableSnapshot;
                subscriptions.forEach(subscriptionSnapshot => {

                    const subscriberSnapshot = snapshot.subscribers.get(subscriptionSnapshot.subscriber);
                    if (subscriberSnapshot) {
                        if (predicate(this.toRecord_(
                            observableSnapshot,
                            subscriberSnapshot,
                            subscriptionSnapshot
                        ))) {
                            if (!find) {
                                find = {
                                    observable: observableSnapshot,
                                    subs: []
                                };
                            }
                            find.subs.push({
                                subscriber: subscriberSnapshot,
                                subscription: subscriptionSnapshot
                            });
                        }
                    }
                });

                if (find) {
                    found.push(find);
                }
            });

            const { maxLogged_ } = this;
            const notLogged = (found.length > maxLogged_) ? found.length - maxLogged_ : 0;
            if (notLogged) {
                found.splice(maxLogged_, notLogged);
            }

            logger.group(`${found.length + notLogged} snapshot(s) found`);

            const observableGroupMethod = (found.length > 3) ? "groupCollapsed" : "group";
            found.forEach(find => {
                const observableSnapshot = find.observable;
                logger[observableGroupMethod].call(logger, observableSnapshot.tag ?
                    `ID = ${observableSnapshot.id}; tag = ${observableSnapshot.tag}` :
                    `ID = ${observableSnapshot.id}`
                );
                logger.log("Path =", observableSnapshot.path);
                logger.log("Type =", observableSnapshot.type);

                const { subs } = find;
                const subscriberGroupMethod = (find.subs.length > 3) ? "groupCollapsed" : "group";
                logger.group(`${subs.length} subscriber(s)`);
                subs.forEach(sub => {

                    const subscriptionSnapshot = sub.subscription;
                    const subscriberSnapshot = sub.subscriber;
                    const { values, valuesFlushed } = subscriberSnapshot;
                    logger[subscriberGroupMethod].call(logger, "Subscriber");
                    logger.log("Value count =", values.length + valuesFlushed);
                    if (values.length > 0) {
                        logger.log("Last value =", values[values.length - 1].value);
                    }
                    this.logSubscription_(
                        logger,
                        observableSnapshot,
                        subscriberSnapshot,
                        subscriptionSnapshot,
                        keys
                    );

                    const otherSubscriptions = Array
                        .from(subscriberSnapshot.subscriptions.values())
                        .filter(otherSubscriptionSnapshot => otherSubscriptionSnapshot !== subscriptionSnapshot);
                    otherSubscriptions.forEach(otherSubscriptionSnapshot => {
                        logger.groupCollapsed("Other subscription");
                        this.logSubscription_(
                            logger,
                            observableSnapshot,
                            subscriberSnapshot,
                            otherSubscriptionSnapshot,
                            keys
                        );
                        logger.groupEnd();
                    });
                    logger.groupEnd();
                });
                logger.groupEnd();
                logger.groupEnd();
            });

            if (notLogged) {
                logger.log(`... another ${notLogged} snapshot(s) not logged.`);
            }
            logger.groupEnd();
        });
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

        const [snapshotPlugin] = this.find(SnapshotPlugin);
        if (!snapshotPlugin) {
            this.defaultLogger_.warnOnce("Snapshotting is not enabled.");
            return;
        }

        const snapshot = snapshotPlugin.snapshotAll();
        const matched = Array
            .from(snapshot.observables.values())
            .filter(observableSnapshot => matches(observableSnapshot.observable, match));
        const logger = toLogger(partialLogger || this.defaultLogger_);

        const { maxLogged_ } = this;
        const notLogged = (matched.length > maxLogged_) ? matched.length - maxLogged_ : 0;
        if (notLogged) {
            matched.splice(maxLogged_, notLogged);
        }

        snapshot.mapStackTraces(matched).subscribe(() => {
            logger.group(`${matched.length + notLogged} snapshot(s) matching ${matchToString(match)}`);

            const observableGroupMethod = (matched.length > 3) ? "groupCollapsed" : "group";
            matched.forEach(observableSnapshot => {

                logger[observableGroupMethod].call(logger, observableSnapshot.tag ?
                    `Tag = ${observableSnapshot.tag}; ID = ${observableSnapshot.id}` :
                    `ID = ${observableSnapshot.id}`
                );
                logger.log("Path =", observableSnapshot.path);
                logger.log("Type =", observableSnapshot.type);

                const { subscriptions } = observableSnapshot;
                const subscriberGroupMethod = (subscriptions.size > 3) ? "groupCollapsed" : "group";
                logger.group(`${subscriptions.size} subscriber(s)`);
                subscriptions.forEach(subscriptionSnapshot => {

                    const subscriberSnapshot = snapshot.subscribers.get(subscriptionSnapshot.subscriber);
                    if (subscriberSnapshot) {

                        const { values, valuesFlushed } = subscriberSnapshot;
                        logger[subscriberGroupMethod].call(logger, "Subscriber");
                        logger.log("Value count =", values.length + valuesFlushed);
                        if (values.length > 0) {
                            logger.log("Last value =", values[values.length - 1].value);
                        }
                        this.logSubscription_(
                            logger,
                            observableSnapshot,
                            subscriberSnapshot,
                            subscriptionSnapshot
                        );

                        const otherSubscriptions = Array
                            .from(subscriberSnapshot.subscriptions.values())
                            .filter(otherSubscriptionSnapshot => otherSubscriptionSnapshot !== subscriptionSnapshot);
                        otherSubscriptions.forEach(otherSubscriptionSnapshot => {
                            logger.groupCollapsed("Other subscription");
                            this.logSubscription_(
                                logger,
                                observableSnapshot,
                                subscriberSnapshot,
                                otherSubscriptionSnapshot
                            );
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

            if (notLogged) {
                logger.log(`... another ${notLogged} snapshot(s) not logged.`);
            }
            logger.groupEnd();
        });
    }

    stats(partialLogger?: PartialLogger): void {

        const [statsPlugin] = this.find(StatsPlugin);
        if (!statsPlugin) {
            this.defaultLogger_.warnOnce("Stats are not enabled.");
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

        plugins.forEach(plugin => {
            plugin.teardown();
            this.plugins_ = this.plugins_.filter(p => p !== plugin);
            this.pluginsSubject_.next(this.plugins_);
            this.undos_ = this.undos_.filter(u => u !== plugin);
        });
    }

    /*tslint:disable-next-line:member-ordering*/
    private static coreLift_(this: Observable<any>, operator: Operator<any, any>): Observable<any> {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = SpyCore;
        if (!spy_) {
            return observableLift.call(source, operator);
        }

        spy_.plugins_.forEach(plugin => plugin.beforeLift(operator, source));
        const sink = observableLift.call(source, operator);
        spy_.plugins_.forEach(plugin => plugin.afterLift(operator, source, sink));
        return sink;
    }

    /*tslint:disable-next-line:member-ordering*/
    private static corePipe_(this: Observable<any>, ...args: any[]): any {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = SpyCore;
        if (!spy_) {
            return observablePipe.apply(source, args);
        }

        spy_.plugins_.forEach(plugin => plugin.beforePipe(args, source));
        const sink = observablePipe.apply(source, args);
        spy_.plugins_.forEach(plugin => plugin.afterPipe(args, source, sink));
        return sink;
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

        const subscriber = toSubscriber.apply(undefined, args);
        const subscription = new Subscription();

        identify(observable);
        identify(subscriber);
        identify(subscription);

        const subscriptionRef: SubscriptionRef = {
            completeTimestamp: 0,
            errorTimestamp: 0,
            nextCount: 0,
            nextTimestamp: 0,
            observable,
            subscribeTimestamp: Date.now(),
            subscriber,
            subscription,
            tick: 0,
            unsubscribeTimestamp: 0
        };
        setSubscriptionRef(subscription, subscriptionRef);

        const notify_ = (before: (plugin: Plugin) => void, block: () => void, after: (plugin: Plugin) => void) => {
            subscriptionRef.tick = ++spy_.tick_;
            spy_.plugins_.forEach(before);
            block();
            spy_.plugins_.forEach(after);
        };

        const subscriberUnsubscribe = subscriber.unsubscribe;
        subscriber.unsubscribe = () => {
            if (!subscriber.closed) {
                notify_(
                    plugin => plugin.beforeUnsubscribe(subscription),
                    () => {
                        subscriptionRef.subscription.unsubscribe();
                        subscriptionRef.unsubscribeTimestamp = Date.now();
                        subscriberUnsubscribe.call(subscriber);
                    },
                    plugin => plugin.afterUnsubscribe(subscription)
                );
            } else {
                subscriberUnsubscribe.call(subscriber);
            }
        };

        const postOpObserver = {

            complete(): void {
                notify_(
                    plugin => plugin.beforeComplete(subscription),
                    () => {
                        subscriber.complete();
                        subscriptionRef.completeTimestamp = Date.now();
                    },
                    plugin => plugin.afterComplete(subscription)
                );
            },

            error(error: any): void {
                notify_(
                    plugin => plugin.beforeError(subscription, error),
                    () => {
                        subscriber.error(error);
                        subscriptionRef.errorTimestamp = Date.now();
                    },
                    plugin => plugin.afterError(subscription, error)
                );
            },

            next(value: any): void {
                notify_(
                    plugin => plugin.beforeNext(subscription, value),
                    () => {
                        subscriber.next(value);
                        ++subscriptionRef.nextCount;
                        subscriptionRef.nextTimestamp = Date.now();
                    },
                    plugin => plugin.afterNext(subscription, value)
                );
            }
        };

        const preOpObserver = {

            complete(): void {
                this.completed = true;
                if (this.preOpSubject) {
                    this.preOpSubject.complete();
                } else {
                    this.postOpObserver.complete();
                }
            },

            completed: false,

            error(error: any): void {
                this.errored = true;
                if (this.preOpSubject) {
                    this.preOpSubject.error(error);
                } else {
                    this.postOpObserver.error(error);
                }
            },

            errored: false,

            next(value: any): void {
                if (this.preOpSubject) {
                    this.preOpSubject.next(value);
                } else {
                    this.postOpObserver.next(value);
                }
            },

            pipe(plugins: Plugin[]): void {
                const operators = plugins.map(plugin => plugin.operator(subscription)).filter(Boolean);
                if (operators.length > 0) {
                    if (!this.preOpSubject) {
                        this.preOpSubject = new Subject<any>();
                    }
                    if (this.postOpSubscription) {
                        this.postOpSubscription.unsubscribe();
                    }
                    let source = this.preOpSubject.asObservable();
                    operators.forEach(operator => source = operator!(source));
                    this.postOpSubscription = source.pipe(hide()).subscribe(postOpObserver);
                } else if (this.postOpSubscription) {
                    this.postOpSubscription.unsubscribe();
                    this.postOpSubscription = undefined;
                    this.preOpSubject = undefined;
                }
            },

            postOpObserver: postOpObserver,
            postOpSubscription: undefined as Subscription | undefined,
            preOpSubject: undefined as Subject<any> | undefined,

            unsubscribe(): void {
                if (!this.unsubscribed) {
                    this.unsubscribed = true;
                    if (!this.completed && !this.errored) {
                        if (this.postOpSubscription) {
                            this.postOpSubscription.unsubscribe();
                            this.postOpSubscription = undefined;
                        }
                    }
                }
            },

            unsubscribed: false
        };

        subscriber.add(spy_.pluginsSubject_.pipe(hide()).subscribe({
            next: (plugins: any) => preOpObserver.pipe(plugins)
        }));

        notify_(
            plugin => plugin.beforeSubscribe(subscription),
            () => {
                subscriber.add(observableSubscribe.call(observable, preOpObserver));
                subscriber.add(() => preOpObserver.unsubscribe());
            },
            plugin => plugin.afterSubscribe(subscription)
        );
        return subscriber;
    }

    private sweep_(id: string, sweeper: Sweeper): void {

        const { auditor_, defaultLogger_ } = this;

        auditor_.audit(id, ignored => {

            const swept = sweeper.sweep(id);
            const logger = toLogger(defaultLogger_);

            if (swept) {
                const audit = (ignored === 0) ? "" : `; ignored ${ignored}`;
                logger.group(`Subscription changes found; id = '${id}'${audit}`);
                swept.subscriptions.forEach(s => {
                    logSubscription(logger, "Subscription", s);
                });
                swept.unsubscriptions.forEach(s => {
                    logSubscription(logger, "Unsubscription", s);
                });
                swept.flatSubscriptions.forEach(s => {
                    logSubscription(logger, "Flat subscription", s);
                });
                swept.flatUnsubscriptions.forEach(s => {
                    logSubscription(logger, "Flat unsubscription", s);
                });
                logger.groupEnd();
            }

            function logSubscription(logger: Logger, name: string, subscription: SubscriptionSnapshot): void {

                logger.group(name);
                logger.log("Root subscribe at", subscription.rootSink ?
                    subscription.rootSink.stackTrace :
                    subscription.stackTrace
                );
                logger.log("Subscribe at", subscription.stackTrace);
                logger.groupEnd();
            }
        });
    }

    private logStackTrace_(
        logger: Logger,
        subscriptionSnapshot: SubscriptionSnapshot
    ): void {

        const { mappedStackTrace, rootSink } = subscriptionSnapshot;
        const mapped = rootSink ? rootSink.mappedStackTrace : mappedStackTrace;
        mapped.subscribe(stackTrace => logger.log("Root subscribe at", stackTrace));
    }

    private logSubscription_(
        logger: Logger,
        observableSnapshot: ObservableSnapshot,
        subscriberSnapshot: SubscriberSnapshot,
        subscriptionSnapshot: SubscriptionSnapshot,
        queryKeys: string[] = []
    ): void {

        const {
            completeTimestamp,
            error,
            errorTimestamp,
            unsubscribeTimestamp
        } = subscriptionSnapshot;
        const record = this.toRecord_(
            observableSnapshot,
            subscriberSnapshot,
            subscriptionSnapshot
        );

        logger.log("State =", completeTimestamp ? "complete" : errorTimestamp ? "error" : "incomplete");
        queryKeys = queryKeys
            .sort()
            .filter(key => !["function", "undefined"].includes(typeof record[key]));
        if (queryKeys.length > 0) {
            logger.group("Query match");
            queryKeys.forEach(key => logger.log(`${key} =`, record[key]));
            logger.groupEnd();
        }
        logger.groupCollapsed("Query record");
        Object.keys(record)
            .sort()
            .filter(key => !["function", "undefined"].includes(typeof record[key]))
            .forEach(key => logger.log(`${key} =`, record[key]));
        logger.groupEnd();
        if (errorTimestamp) {
            logger.error("Error =", error || "unknown");
        }
        if (unsubscribeTimestamp) {
            logger.log("Unsubscribed =", true);
        }
        this.logStackTrace_(logger, subscriptionSnapshot);
    }

    private toRecord_(
        observableSnapshot: ObservableSnapshot,
        subscriberSnapshot: SubscriberSnapshot,
        subscriptionSnapshot: SubscriptionSnapshot
    ): Record<string, any> {

        const now = Date.now();
        function age(timestamp: number): number | undefined {
            return timestamp ? ((now - timestamp) / 1e3) : undefined;
        }

        const {
            completeTimestamp,
            error,
            errorTimestamp,
            flats,
            flatsFlushed,
            flattened,
            nextCount,
            nextTimestamp,
            observable,
            rootSink,
            sink,
            sources,
            sourcesFlushed,
            stackTrace,
            subscribeTimestamp,
            subscriber,
            subscription,
            unsubscribeTimestamp
        } = subscriptionSnapshot;
        const { derivations_ } = this;

        const flatSnapshots = Array.from(flats.values());
        const sourceSnapshots = Array.from(sources.values());

        const record = {
            ...subscriptionSnapshot.query,
            complete: completeTimestamp !== 0,
            completeAge: age(completeTimestamp),
            error: (errorTimestamp === 0) ? undefined : (error || "unknown"),
            errorAge: age(errorTimestamp),
            flatCount: flatSnapshots.length + flatsFlushed,
            flatIds: flatSnapshots.map(flat => flat.id),
            flatNextAge: age(flatSnapshots.reduce((max, flat) => Math.max(max, flat.nextTimestamp), 0)),
            flatNextCount: flatSnapshots.reduce((total, flat) => total + flat.nextCount, 0),
            flattened,
            frequency: nextTimestamp ? (nextCount / (nextTimestamp - subscribeTimestamp)) * 1e3 : 0,
            incomplete: (completeTimestamp === 0) && (errorTimestamp === 0),
            nextAge: age(nextTimestamp),
            nextCount,
            observableId: identify(observable),
            root: !sink,
            rootSinkId: rootSink ? rootSink.id : undefined,
            sinkId: sink ? sink.id : undefined,
            sinkNextAge: sink ? age(sink.nextTimestamp) : undefined,
            sinkNextCount: sink ? sink.nextCount : 0,
            sourceCount: sourceSnapshots.length + sourcesFlushed,
            sourceIds: sourceSnapshots.map(source => source.id),
            sourceNextAge: age(sourceSnapshots.reduce((max, source) => Math.max(max, source.nextTimestamp), 0)),
            sourceNextCount: sourceSnapshots.reduce((total, source) => total + source.nextCount, 0),
            stackTrace,
            subscribeAge: age(subscribeTimestamp),
            subscriberId: identify(subscriber),
            subscriptionId: identify(subscription),
            tag: observableSnapshot.tag,
            type: observableSnapshot.type,
            unsubscribeAge: age(unsubscribeTimestamp),
            unsubscribed: unsubscribeTimestamp !== 0
        };

        const defaultDerived = {};
        Object.keys(defaultDerivations).forEach(key => {
            defaultDerived[key] = defaultDerivations[key](record);
        });

        const derived = {};
        Object.keys(derivations_).forEach(key => {
            derived[key] = derivations_[key](record);
        });
        return { ...defaultDerived, ...derived, ...record };
    }
}

function matchId(
    { observableId, subscriberId, subscriptionId }: Record<string, any>,
    match: number | string
): boolean {
    if (typeof match === "number") {
        match = match.toString();
    }
    return (match === observableId) || (match === subscriberId) || (match === subscriptionId);
}

function matchStackTrace(
    record: Record<string, any>,
    property: string,
    match: string | RegExp
): boolean {
    const [stackFrame] = record.stackTrace;
    if (!stackFrame) {
        return false;
    }
    const value: string = stackFrame[property];
    switch (property) {
    case "fileName":
        return (typeof match === "string") ? value.endsWith(match) : match.test(value);
    case "functionName":
        return (typeof match === "string") ? (value === match) : match.test(value);
    default:
        return false;
    }
}

function matchSource(
    record: Record<string, any>,
    property: string,
    match: number | string
): boolean {
    const ids: string[] = record[property];
    if (typeof match === "number") {
        match = match.toString();
    }
    return ids.some(id => id === match);
}
