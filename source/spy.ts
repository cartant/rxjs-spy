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
import { forConsole } from "./console";
import { hidden } from "./hidden";
import { identify } from "./identify";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match } from "./match";
import { hide } from "./operators";

import {
    BufferPlugin,
    CyclePlugin,
    Deck,
    DevToolsPlugin,
    DiffPlugin,
    GraphPlugin,
    LogPlugin,
    PausePlugin,
    PipePlugin,
    Plugin,
    PluginCtor,
    PluginOptions,
    SnapshotPlugin,
    StackTracePlugin,
    StatsPlugin
} from "./plugin";

import { QueryDerivations, QueryPredicate } from "./query";
import { setSubscriptionRecord, SubscriptionRecord } from "./subscription-record";
import { Teardown } from "./teardown";
import { toSubscriber } from "./util";

declare const __RXJS_SPY_VERSION__: string;
const defaultLimit = 20;
const defaultOrderBy = "age asc";
const observableLift = Observable.prototype.lift;
const observablePipe = Observable.prototype.pipe;
const observableSubscribe = Observable.prototype.subscribe;
const previousGlobalScope: Record<string, any> = {};

export class Spy {

    private static spy_: Spy | undefined = undefined;

    private auditor_: Auditor;
    private defaultLogger_: Logger;
    private limit_ = defaultLimit;
    private orderBy_ = defaultOrderBy;
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

        if (Spy.spy_) {
            throw new Error("Already spying on Observable.prototype.subscribe.");
        }
        if (options.warning) {
            /*tslint:disable-next-line:no-console*/
            console.warn("Spying on Observable.prototype.subscribe.");
        }

        Spy.spy_ = this;
        Observable.prototype.lift = Spy.patchedLift_;
        Observable.prototype.pipe = Spy.patchedPipe_;
        Observable.prototype.subscribe = Spy.patchedSubscribe_;

        this.auditor_ = new Auditor(options.audit || 0);
        this.defaultLogger_ = toLogger(options.defaultLogger || defaultLogger);
        if (options.defaultPlugins ===  false) {
            this.plugins_ = [];
        } else {
            this.plugins_ = [
                new StackTracePlugin({ ...options, pluginHost: this }),
                new GraphPlugin({ ...options, pluginHost: this }),
                new SnapshotPlugin({ ...options, pluginHost: this }),
                new BufferPlugin({ ...options, pluginHost: this }),
                new CyclePlugin({ ...options, pluginHost: this }),
                new StatsPlugin({ pluginHost: this })
            ];
            if (options.devTools !==  false) {
                this.plugins_.push(new DevToolsPlugin({ pluginHost: this }));
            }
        }
        this.pluginsSubject_ = new BehaviorSubject(this.plugins_);
        this.tick_ = 0;
        this.undos_ = [];

        let globalScope: any;
        let globalName: string = "";
        if (typeof window !== "undefined") {
            globalScope = window;
            globalName = "window";
        } else if (typeof global !== "undefined") {
            globalScope = global;
            globalName = "global";
        }

        if (globalScope) {
            const preferredKey = options.global || "spy";
            [preferredKey, "rxSpy"].forEach(key => {
                if (globalScope.hasOwnProperty(key)) {
                    this.defaultLogger_.log(`Overwriting ${globalName}.${key}`);
                    previousGlobalScope[key] = globalScope[key];
                }
                globalScope[key] = forConsole(this, key !== preferredKey ?
                    () => this.defaultLogger_.warnOnce(`${globalName}.${key} is deprecated and has been renamed; use ${globalName}.spy instead`) :
                    undefined
                );
            });
        }

        this.teardown_ = () => {

            let globalScope: any;
            let globalName: string = "";
            if (typeof window !== "undefined") {
                globalScope = window;
                globalName = "window";
            } else if (typeof global !== "undefined") {
                globalScope = global;
                globalName = "global";
            }

            if (globalScope) {
                [options.global || "spy", "rxSpy"].forEach(key => {
                    if (previousGlobalScope.hasOwnProperty(key)) {
                        this.defaultLogger_.log(`Restoring ${globalName}.${key}`);
                        globalScope[key] = previousGlobalScope[key];
                        delete previousGlobalScope[key];
                    } else {
                        delete globalScope[key];
                    }
                });
            }

            this.plugins_.forEach(plugin => plugin.teardown());
            this.plugins_ = [];
            this.pluginsSubject_.next(this.plugins_);
            this.undos_ = [];

            Spy.spy_ = undefined;
            Observable.prototype.lift = observableLift;
            Observable.prototype.pipe = observablePipe;
            Observable.prototype.subscribe = observableSubscribe;
        };
    }

    get auditor(): Auditor {

        return this.auditor_;
    }

    get limit(): number {

        return this.limit_;
    }

    set limit(value: number) {

        this.limit_ = Math.max(value, 1);
    }

    get logger(): Logger {

        return this.defaultLogger_;
    }

    get orderBy(): string {

        return this.orderBy_;
    }

    set orderBy(value: string) {

        this.orderBy_ = value || defaultOrderBy;
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

    diff(id: string, options: { teardown?: boolean } = {}): void {

        const diffPlugin = this.findPlugins(DiffPlugin).find(plugin => plugin.id === id);
        if (diffPlugin) {
            const diff = diffPlugin.diff();
            if (diff) {
                const { defaultLogger_ } = this;
                diffPlugin.logDiff(diff, defaultLogger_);
            }
            if (options.teardown) {
                this.unplug(diffPlugin);
            }
        } else if (!options.teardown) {
            this.plug(new DiffPlugin({ id, pluginHost: this }));
        }
    }

    findPlugins<P extends Plugin, O extends PluginOptions>(
        ctor: PluginCtor<P, O>,
        dependent?: PluginCtor<any, any>
    ): P[] {

        const { plugins_ } = this;
        if (dependent && (plugins_.findIndex(plugin => plugin instanceof dependent) < plugins_.findIndex(plugin => plugin instanceof ctor))) {
            return [];
        }
        return plugins_.filter(plugin => plugin instanceof ctor) as P[];
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
            pluginHost: this
        }));
    }

    pause(match: Match): Deck {

        const pausePlugin = new PausePlugin({ match, pluginHost: this });
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
            pluginHost: this
        }));
    }

    plug(...plugins: Plugin[]): Teardown {

        this.plugins_.push(...plugins);
        this.pluginsSubject_.next(this.plugins_);

        this.undos_.push(...plugins);
        return () => this.unplug(...plugins);
    }

    query(predicate: string | QueryPredicate, orderBy: string, limit: number, partialLogger?: PartialLogger): void;
    query(predicate: string | QueryPredicate, orderBy: string, partialLogger?: PartialLogger): void;
    query(predicate: string | QueryPredicate, partialLogger?: PartialLogger): void;
    query(derivations: QueryDerivations): void;
    query(...args: any[]): void {

        const [snapshotPlugin] = this.findPlugins(SnapshotPlugin);
        if (!snapshotPlugin) {
            this.defaultLogger_.warnOnce("Snapshotting is not enabled.");
            return;
        }

        const [derivationsArg] = args;
        if (typeof derivationsArg === "object") {
            snapshotPlugin.derivations = derivationsArg;
            return;
        }

        const logger = (typeof args[args.length - 1] === "object") ?
            toLogger(args.pop()) :
            this.defaultLogger_;

        const [
            predicateArg,
            orderByArg,
            limitArg
        ] = args as [
            string | QueryPredicate,
            string?,
            number?
        ];

        snapshotPlugin.query({
            limit: limitArg || defaultLimit,
            logger,
            orderBy: orderByArg || defaultOrderBy,
            predicate: predicateArg
        });
    }

    stats(partialLogger?: PartialLogger): void {

        const [statsPlugin] = this.findPlugins(StatsPlugin);
        if (!statsPlugin) {
            this.defaultLogger_.warnOnce("Stats are not enabled.");
            return;
        }

        const stats = statsPlugin.stats;
        statsPlugin.logStats(stats, partialLogger);
    }

    teardown(): void {

        if (this.teardown_) {
            this.teardown_();
            this.teardown_ = undefined;
        }
    }

    unplug(...plugins: Plugin[]): void {

        plugins.forEach(plugin => {
            if (this.plugins_.find(p => p === plugin)) {
                plugin.teardown();
                this.plugins_ = this.plugins_.filter(p => p !== plugin);
                this.pluginsSubject_.next(this.plugins_);
                this.undos_ = this.undos_.filter(u => u !== plugin);
            }
        });
    }

    /*tslint:disable-next-line:member-ordering*/
    private static patchedLift_(this: Observable<any>, operator: Operator<any, any>): Observable<any> {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = Spy;
        if (!spy_) {
            return observableLift.call(source, operator);
        }

        spy_.plugins_.forEach(plugin => plugin.beforeLift(operator, source));
        const sink = observableLift.call(source, operator);
        spy_.plugins_.forEach(plugin => plugin.afterLift(operator, source, sink));
        return sink;
    }

    /*tslint:disable-next-line:member-ordering*/
    private static patchedPipe_(this: Observable<any>, ...args: any[]): any {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = Spy;
        if (!spy_) {
            return observablePipe.apply(source, args);
        }

        spy_.plugins_.forEach(plugin => plugin.beforePipe(args, source));
        const sink = observablePipe.apply(source, args);
        spy_.plugins_.forEach(plugin => plugin.afterPipe(args, source, sink));
        return sink;
    }

    /*tslint:disable-next-line:member-ordering*/
    private static patchedSubscribe_(this: Observable<any>, ...args: any[]): Subscription {

        /*tslint:disable-next-line:no-invalid-this*/
        const observable = this;

        const { spy_ } = Spy;
        if (!spy_) {
            return observableSubscribe.apply(observable, args);
        }
        if (hidden(observable)) {
            Spy.spy_ = undefined;
            try {
                return observableSubscribe.apply(observable, args);
            } finally {
                Spy.spy_ = spy_;
            }
        }

        const subscriber = toSubscriber.apply(undefined, args);
        const subscription = new Subscription();

        identify(observable);
        identify(subscriber);
        identify(subscription);

        const subscriptionRecord: SubscriptionRecord = {
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
        setSubscriptionRecord(subscription, subscriptionRecord);

        const notify_ = (before: (plugin: Plugin) => void, block: () => void, after: (plugin: Plugin) => void) => {
            subscriptionRecord.tick = ++spy_.tick_;
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
                        subscriptionRecord.subscription.unsubscribe();
                        subscriptionRecord.unsubscribeTimestamp = Date.now();
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
                        subscriptionRecord.completeTimestamp = Date.now();
                    },
                    plugin => plugin.afterComplete(subscription)
                );
            },

            error(error: any): void {
                notify_(
                    plugin => plugin.beforeError(subscription, error),
                    () => {
                        subscriber.error(error);
                        subscriptionRecord.errorTimestamp = Date.now();
                    },
                    plugin => plugin.afterError(subscription, error)
                );
            },

            next(value: any): void {
                notify_(
                    plugin => plugin.beforeNext(subscription, value),
                    () => {
                        subscriber.next(value);
                        ++subscriptionRecord.nextCount;
                        subscriptionRecord.nextTimestamp = Date.now();
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
                const operators = plugins.map(plugin => plugin.getOperator(subscription)).filter(Boolean);
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
}
