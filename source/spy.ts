/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import {
    Observable,
    Operator,
    Subject,
    Subscription
} from "rxjs";

import { Auditor } from "./auditor";
import { forConsole } from "./console";
import { hidden } from "./hidden";
import { Host } from "./host";
import { identify } from "./identify";
import { defaultLogger, Logger, PartialLogger, toLogger } from "./logger";
import { Match } from "./match";
import { hide } from "./operators";

import {
    Deck,
    DiffPlugin,
    LogPlugin,
    PausePlugin,
    PipePlugin,
    Plugin,
    PluginHost,
    QueryDerivations,
    QueryPredicate,
    SnapshotPlugin,
    StatsPlugin
} from "./plugin";

import { setSubscriptionRecord, SubscriptionRecord } from "./subscription-record";
import { Teardown } from "./teardown";
import { toSubscriber } from "./util";

declare const __RXJS_SPY_VERSION__: string;
const defaultLimit = 20;
const defaultOrderBy = "age asc";
const observableLift = Observable.prototype.lift;
const observablePipe = Observable.prototype.pipe;
const observableSubscribe = Observable.prototype.subscribe;
const prePatchGlobalScope: Record<string, any> = {};

export class Spy {

    private static spy_: Spy | undefined = undefined;
    private defaultLogger_: Logger;
    private host_: Host;
    private limit_ = defaultLimit;
    private orderBy_ = defaultOrderBy;
    private teardown_: Teardown | undefined;

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

        this.defaultLogger_ = toLogger(options.defaultLogger || defaultLogger);
        this.host_ = new Host({
            ...options,
            auditor: new Auditor(options.audit || 0),
            logger: this.defaultLogger_,
            version: __RXJS_SPY_VERSION__
        });

        this.defaultLogger_ = toLogger(options.defaultLogger || defaultLogger);

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
                    prePatchGlobalScope[key] = globalScope[key];
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
                    if (prePatchGlobalScope.hasOwnProperty(key)) {
                        this.defaultLogger_.log(`Restoring ${globalName}.${key}`);
                        globalScope[key] = prePatchGlobalScope[key];
                        delete prePatchGlobalScope[key];
                    } else {
                        delete globalScope[key];
                    }
                });
            }

            this.host_.teardown();
            Spy.spy_ = undefined;

            Observable.prototype.lift = observableLift;
            Observable.prototype.pipe = observablePipe;
            Observable.prototype.subscribe = observableSubscribe;
        };
    }

    get limit(): number {
        return this.limit_;
    }

    set limit(value: number) {
        this.limit_ = Math.max(value, 1);
    }

    get orderBy(): string {
        return this.orderBy_;
    }

    set orderBy(value: string) {
        this.orderBy_ = value || defaultOrderBy;
    }

    get pluginHost(): PluginHost {
        return this.host_;
    }

    get undos(): Plugin[] {
        return this.host_.undos;
    }

    get version(): string {
        return __RXJS_SPY_VERSION__;
    }

    diff(id: string, options: { teardown?: boolean } = {}): void {

        const { host_ } = this;
        const diffPlugin = host_.findPlugins(DiffPlugin).find(plugin => plugin.id === id);
        if (diffPlugin) {
            const diff = diffPlugin.diff();
            if (diff) {
                const { defaultLogger_ } = this;
                diffPlugin.logDiff(diff, defaultLogger_);
            }
            if (options.teardown) {
                host_.unplug(diffPlugin);
            }
        } else if (!options.teardown) {
            host_.plug(new DiffPlugin({ id, pluginHost: host_ }));
        }
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

        const { host_ } = this;
        return host_.plug(new LogPlugin({
            logger: partialLogger,
            notificationMatch,
            observableMatch,
            pluginHost: host_
        }));
    }

    pause(match: Match): Deck {

        const { host_ } = this;
        const pausePlugin = new PausePlugin({ match, pluginHost: host_ });
        const teardown = host_.plug(pausePlugin);

        const deck = pausePlugin.deck;
        deck.teardown = teardown;
        return deck;
    }

    pipe(match: Match, operator: (source: Observable<any>) => Observable<any>, complete?: boolean): Teardown {

        const { host_ } = this;
        return host_.plug(new PipePlugin({
            complete,
            match,
            operator,
            pluginHost: host_
        }));
    }

    query(predicate: string | QueryPredicate, orderBy: string, limit: number, partialLogger?: PartialLogger): void;
    query(predicate: string | QueryPredicate, orderBy: string, partialLogger?: PartialLogger): void;
    query(predicate: string | QueryPredicate, partialLogger?: PartialLogger): void;
    query(derivations: QueryDerivations): void;
    query(...args: any[]): void {

        const [snapshotPlugin] = this.host_.findPlugins(SnapshotPlugin);
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

        const [statsPlugin] = this.host_.findPlugins(StatsPlugin);
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

    /*tslint:disable-next-line:member-ordering*/
    private static patchedLift_(this: Observable<any>, operator: Operator<any, any>): Observable<any> {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = Spy;
        if (!spy_) {
            return observableLift.call(source, operator);
        }

        /*tslint:disable:object-literal-sort-keys*/
        const result = spy_.host_.notifyPlugins<Observable<any>>({
            beforeEach: plugin => plugin.beforeLift(operator, source),
            between: () => observableLift.call(source, operator),
            afterEach: (plugin, sink) => plugin.afterLift(operator, source, sink)
        });
        /*tslint:enable:object-literal-sort-keys*/
        return result;
    }

    /*tslint:disable-next-line:member-ordering*/
    private static patchedPipe_(this: Observable<any>, ...args: any[]): any {

        /*tslint:disable-next-line:no-invalid-this*/
        const source = this;

        const { spy_ } = Spy;
        if (!spy_) {
            return observablePipe.apply(source, args);
        }

        /*tslint:disable:object-literal-sort-keys*/
        const result = spy_.host_.notifyPlugins<any>({
            beforeEach: plugin => plugin.beforePipe(args, source),
            between: () => observablePipe.apply(source, args),
            afterEach: (plugin, sink) => plugin.afterPipe(args, source, sink)
        });
        /*tslint:enable:object-literal-sort-keys*/
        return result;
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

        const { host_ } = spy_;
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

        const subscriberUnsubscribe = subscriber.unsubscribe;
        subscriber.unsubscribe = () => {
            if (!subscriber.closed) {
                /*tslint:disable:object-literal-sort-keys*/
                host_.notifyPlugins({
                    before: () => subscriptionRecord.tick = host_.tick,
                    beforeEach: plugin => plugin.beforeUnsubscribe(subscription),
                    between: () => {
                        subscriptionRecord.subscription.unsubscribe();
                        subscriptionRecord.unsubscribeTimestamp = Date.now();
                        subscriberUnsubscribe.call(subscriber);
                    },
                    afterEach: plugin => plugin.afterUnsubscribe(subscription)
                });
                /*tslint:enable:object-literal-sort-keys*/
            } else {
                subscriberUnsubscribe.call(subscriber);
            }
        };

        const postOpObserver = {

            complete(): void {
                /*tslint:disable:object-literal-sort-keys*/
                host_.notifyPlugins({
                    before: () => subscriptionRecord.tick = host_.tick,
                    beforeEach: plugin => plugin.beforeComplete(subscription),
                    between: () => {
                        subscriber.complete();
                        subscriptionRecord.completeTimestamp = Date.now();
                    },
                    afterEach: plugin => plugin.afterComplete(subscription)
                });
                /*tslint:enable:object-literal-sort-keys*/
            },

            error(error: any): void {
                /*tslint:disable:object-literal-sort-keys*/
                host_.notifyPlugins({
                    before: () => subscriptionRecord.tick = host_.tick,
                    beforeEach: plugin => plugin.beforeError(subscription, error),
                    between: () => {
                        subscriber.error(error);
                        subscriptionRecord.errorTimestamp = Date.now();
                    },
                    afterEach: plugin => plugin.afterError(subscription, error)
                });
                /*tslint:enable:object-literal-sort-keys*/
            },

            next(value: any): void {
                /*tslint:disable:object-literal-sort-keys*/
                host_.notifyPlugins({
                    before: () => subscriptionRecord.tick = host_.tick,
                    beforeEach: plugin => plugin.beforeNext(subscription, value),
                    between: () => {
                        subscriber.next(value);
                        ++subscriptionRecord.nextCount;
                        subscriptionRecord.nextTimestamp = Date.now();
                    },
                    afterEach: plugin => plugin.afterNext(subscription, value)
                });
                /*tslint:enable:object-literal-sort-keys*/
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

        subscriber.add(host_.plugins.pipe(hide()).subscribe({
            next: (plugins: any) => preOpObserver.pipe(plugins)
        }));

        /*tslint:disable:object-literal-sort-keys*/
        host_.notifyPlugins({
            before: () => subscriptionRecord.tick = host_.tick,
            beforeEach: plugin => plugin.beforeSubscribe(subscription),
            between: () => {
                subscriber.add(observableSubscribe.call(observable, preOpObserver));
                subscriber.add(() => preOpObserver.unsubscribe());
            },
            afterEach: plugin => plugin.afterSubscribe(subscription)
        });
        /*tslint:enable:object-literal-sort-keys*/
        return subscriber;
    }
}
