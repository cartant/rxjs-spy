/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { compile, compileOrderBy } from "../expression";
import { Logger } from "../logger";
import {
    ObservableSnapshot,
    QueryDerivations,
    QueryPredicate,
    QueryRecord,
    Snapshot,
    SubscriberSnapshot,
    SubscriptionSnapshot
} from "./snapshot-plugin-types";

class QueryContext {

    readonly observableSnapshot_: ObservableSnapshot;
    readonly subscriberSnapshot_: SubscriberSnapshot;
    readonly subscriptionSnapshot_: SubscriptionSnapshot;
    private readonly derivations_: QueryDerivations;
    private readonly now_ = Date.now();

    constructor(
        observableSnapshot: ObservableSnapshot,
        subscriberSnapshot: SubscriberSnapshot,
        subscriptionSnapshot: SubscriptionSnapshot,
        derivations: QueryDerivations
    ) {
        this.derivations_ = derivations;
        this.observableSnapshot_ = observableSnapshot;
        this.subscriberSnapshot_ = subscriberSnapshot;
        this.subscriptionSnapshot_ = subscriptionSnapshot;
        // subscriptionSnapshot.queryRecord
    }

    get age(): number {
        const {
            completeAge,
            errorAge,
            nextAge,
            subscribeAge,
            unsubscribeAge
        } = this;
        return Math.min(
            completeAge || Infinity,
            errorAge || Infinity,
            nextAge || Infinity,
            subscribeAge || Infinity,
            unsubscribeAge || Infinity
        );
    }

    get blocking(): boolean {
        const { nextAge, sourceNextAge } = this;
        return (sourceNextAge !== undefined) && ((nextAge === undefined) || (nextAge > sourceNextAge));
    }

    get complete(): boolean {
        const { subscriptionSnapshot_ } = this;
        const { completeTimestamp } = subscriptionSnapshot_;
        return completeTimestamp !== 0;
    }

    get completeAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { completeTimestamp } = subscriptionSnapshot_;
        return this.age_(completeTimestamp);
    }

    get depth(): number {
        const { subscriptionSnapshot_ } = this;
        let { rootSink, sink } = subscriptionSnapshot_;
        if (!sink) {
            return 0;
        }
        let depth = 1;
        for (; sink !== rootSink; ++depth) {
            sink = sink.sink!;
        }
        return depth;
    }

    get error(): any {
        const { subscriptionSnapshot_ } = this;
        const { error, errorTimestamp } = subscriptionSnapshot_;
        return (errorTimestamp === 0) ? undefined : (error || "unknown");
    }

    get errorAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { errorTimestamp } = subscriptionSnapshot_;
        return this.age_(errorTimestamp);
    }

    get frequency(): number {
        const { subscriptionSnapshot_ } = this;
        const { nextCount, nextTimestamp, subscribeTimestamp } = subscriptionSnapshot_;
        return nextTimestamp ? (nextCount / (nextTimestamp - subscribeTimestamp)) * 1e3 : 0;
    }

    get incomplete(): boolean {
        const { subscriptionSnapshot_ } = this;
        const { completeTimestamp, errorTimestamp } = subscriptionSnapshot_;
        return (completeTimestamp === 0) && (errorTimestamp === 0);
    }

    get inner(): boolean {
        const { subscriptionSnapshot_ } = this;
        return subscriptionSnapshot_.inner;
    }

    get innerCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { inners, innersFlushed } = subscriptionSnapshot_;
        return inners.size + innersFlushed;
    }

    get innerIds(): string[] {
        const { subscriptionSnapshot_ } = this;
        const { inners } = subscriptionSnapshot_;
        const innerSnapshots = Array.from(inners.values());
        return innerSnapshots.map(inner => inner.id);
    }

    get innerIncompleteCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { inners } = subscriptionSnapshot_;
        let count = 0;
        inners.forEach(({
            completeTimestamp,
            errorTimestamp,
            unsubscribeTimestamp
        }) => count += (completeTimestamp || errorTimestamp || unsubscribeTimestamp) ? 0 : 1);
        return count;
    }

    get innerNextAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { inners } = subscriptionSnapshot_;
        const innerSnapshots = Array.from(inners.values());
        return this.age_(innerSnapshots.reduce((max, inner) => Math.max(max, inner.nextTimestamp), 0));
    }

    get innerNextCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { inners } = subscriptionSnapshot_;
        const innerSnapshots = Array.from(inners.values());
        return innerSnapshots.reduce((total, inner) => total + inner.nextCount, 0);
    }

    get name(): string {
        const { observableSnapshot_ } = this;
        return observableSnapshot_.name;
    }

    get nextAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { nextTimestamp } = subscriptionSnapshot_;
        return this.age_(nextTimestamp);
    }

    get nextCount(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        return subscriptionSnapshot_.nextCount;
    }

    get observableId(): string {
        const { observableSnapshot_ } = this;
        return observableSnapshot_.id;
    }

    get observablePipeline(): string {
        const { observableSnapshot_ } = this;
        return observableSnapshot_.pipeline;
    }

    get root(): boolean {
        const { subscriptionSnapshot_ } = this;
        return !subscriptionSnapshot_.sink;
    }

    get rootSinkId(): string | undefined {
        const { subscriptionSnapshot_ } = this;
        const { rootSink } = subscriptionSnapshot_;
        return rootSink ? rootSink.id : undefined;
    }

    get sinkId(): string | undefined {
        const { subscriptionSnapshot_ } = this;
        const { sink } = subscriptionSnapshot_;
        return sink ? sink.id : undefined;
    }

    get sinkNextAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { sink } = subscriptionSnapshot_;
        return sink ? this.age_(sink.nextTimestamp) : undefined;
    }

    get sinkNextCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { sink } = subscriptionSnapshot_;
        return sink ? sink.nextCount : 0;
    }

    get sourceCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { sources, sourcesFlushed } = subscriptionSnapshot_;
        return sources.size + sourcesFlushed;
    }

    get sourceIds(): string[] {
        const { subscriptionSnapshot_ } = this;
        const { sources } = subscriptionSnapshot_;
        const sourceSnapshots = Array.from(sources.values());
        return sourceSnapshots.map(source => source.id);
    }

    get sourceNextAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { sources } = subscriptionSnapshot_;
        const sourceSnapshots = Array.from(sources.values());
        return this.age_(sourceSnapshots.reduce((max, source) => Math.max(max, source.nextTimestamp), 0));
    }

    get sourceNextCount(): number {
        const { subscriptionSnapshot_ } = this;
        const { sources } = subscriptionSnapshot_;
        const sourceSnapshots = Array.from(sources.values());
        return sourceSnapshots.reduce((total, source) => total + source.nextCount, 0);
    }

    get subscribeAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { subscribeTimestamp } = subscriptionSnapshot_;
        return this.age_(subscribeTimestamp);
    }

    get subscriberId(): string {
        const { subscriberSnapshot_ } = this;
        return subscriberSnapshot_.id;
    }

    get subscriptionId(): string {
        const { subscriptionSnapshot_ } = this;
        return subscriptionSnapshot_.id;
    }

    get unsubscribeAge(): number | undefined {
        const { subscriptionSnapshot_ } = this;
        const { unsubscribeTimestamp } = subscriptionSnapshot_;
        return this.age_(unsubscribeTimestamp);
    }

    get unsubscribed(): boolean {
        const { subscriptionSnapshot_ } = this;
        const { unsubscribeTimestamp } = subscriptionSnapshot_;
        return unsubscribeTimestamp !== 0;
    }

    get value(): any {
        const { subscriptionSnapshot_ } = this;
        const { values } = subscriptionSnapshot_;
        return values.length ? values[0].value : undefined;
    }

    file(match: string | RegExp): boolean {
        return this.stackTrace_("fileName", match);
    }

    func(match: string | RegExp): boolean {
        return this.stackTrace_("functionName", match);
    }

    id(match: number | string): boolean {
        const { observableId, subscriberId, subscriptionId } = this;
        if (typeof match === "number") {
            match = match.toString();
        }
        return (match === observableId) || (match === subscriberId) || (match === subscriptionId);
    }

    leaking(threshold: number): boolean {
        const { bufferCount, innerIncompleteCount } = this as QueryRecord;
        return (bufferCount > threshold) || (innerIncompleteCount > threshold);
    }

    pipeline(match: string | RegExp): boolean {
        const { observablePipeline } = this;
        if (typeof match === "string") {
            return observablePipeline.indexOf(match) !== -1;
        }
        return (match && match.test) ? match.test(observablePipeline) : false;
    }

    slow(threshold: number): boolean {
        const { nextAge, subscribeAge } = this;
        return (nextAge || subscribeAge || 0) > (threshold / 1e3);
    }

    tag(match: string | RegExp): boolean {
        const { observableSnapshot_ } = this;
        const { tag } = observableSnapshot_;
        if (match === undefined) {
            return Boolean(tag);
        }
        if (typeof match === "string") {
            return tag === match;
        }
        return (match && match.test && tag) ? match.test(tag) : false;
    }

    private age_(timestamp: number): number | undefined {
        const { now_ } = this;
        return timestamp ? ((now_ - timestamp) / 1e3) : undefined;
    }

    private stackTrace_(property: string, match: string | RegExp): boolean {
        const predicate = (stackFrame: any) => {
            const value: string = stackFrame[property];
            switch (property) {
            case "fileName":
                return (typeof match === "string") ? value.endsWith(match) : match.test(value);
            case "functionName":
                return (typeof match === "string") ? (value === match) : match.test(value);
            default:
                return false;
            }
        };
        const {
            observableSnapshot_,
            subscriptionSnapshot_
        } = this;
        const rootStackTrace = subscriptionSnapshot_.rootSink ?
            subscriptionSnapshot_.rootSink.stackTrace : [];
        return observableSnapshot_.stackTrace.some(predicate) ||
            subscriptionSnapshot_.stackTrace.some(predicate) ||
            rootStackTrace.some(predicate);
    }
}

export function query(options: {
    derivations: QueryDerivations,
    limit: number,
    logger: Logger,
    orderBy: string,
    predicate: string | QueryPredicate,
    snapshot: Snapshot
}): void {

    const {
        derivations,
        limit,
        logger,
        orderBy,
        predicate,
        snapshot
    } = options;

    const { evaluator: predicateEvaluator, keys } = (typeof predicate === "string") ?
        compile(predicate || "true") :
        { evaluator: predicate, keys: [] };
    const { comparer } = compileOrderBy(orderBy);

    const observableSnapshots = Array.from(snapshot.observables.values());
    snapshot.mapStackTraces(observableSnapshots).subscribe(() => {

        const found: {
            observable: ObservableSnapshot;
            orderByRecord: QueryRecord;
            queryContexts: QueryContext[];
        }[] = [];

        observableSnapshots.forEach(observableSnapshot => {

            let find: typeof found[0] | undefined;

            const { subscriptions } = observableSnapshot;
            subscriptions.forEach(subscriptionSnapshot => {

                const subscriberSnapshot = snapshot.subscribers.get(subscriptionSnapshot.subscriber);
                if (subscriberSnapshot) {
                    const queryContext = new QueryContext(
                        observableSnapshot,
                        subscriberSnapshot,
                        subscriptionSnapshot,
                        derivations
                    );
                    if (predicateEvaluator(queryContext)) {
                        const orderByRecord = queryContext;
                        if (!find) {
                            find = {
                                observable: observableSnapshot,
                                orderByRecord,
                                queryContexts: []
                            };
                        } else if (comparer(orderByRecord, find.orderByRecord) < 0) {
                            find.orderByRecord = orderByRecord;
                        }
                        find.queryContexts.push(queryContext);
                    }
                }
            });

            if (find) {
                found.push(find);
            }
        });

        if (comparer) {
            found.sort((l, r) => comparer(
                l.orderByRecord,
                r.orderByRecord
            ));
        }

        const omitted = (found.length > limit) ? found.length - limit : 0;
        if (omitted) {
            found.splice(limit, omitted);
        }

        logger.group(`${found.length + omitted} snapshot(s) found`);

        const observableGroupMethod = (found.length > 3) ? "groupCollapsed" : "group";
        found.forEach(find => {
            const observableSnapshot = find.observable;
            logger[observableGroupMethod].call(logger, observableSnapshot.tag ?
                `ID = ${observableSnapshot.id}; tag = ${observableSnapshot.tag}` :
                `ID = ${observableSnapshot.id}`
            );
            logger.log("Name =", observableSnapshot.name);
            logger.log("Pipeline =", observableSnapshot.pipeline);
            const { queryContexts } = find;
            logger.group(`${queryContexts.length} subscriber(s)`);
            queryContexts.forEach(queryContext => logSubscriber_(logger, queryContext, queryContexts.length <= 3, keys));
            logger.groupEnd();
            logger.groupEnd();
        });

        if (omitted) {
            logger.log(`... another ${omitted} snapshot(s) not logged.`);
        }
        logger.groupEnd();
    });
}

function logStackTrace_(logger: Logger, queryContext: QueryContext): void {
    const { subscriptionSnapshot_ } = queryContext;
    const { mappedStackTrace, rootSink } = subscriptionSnapshot_;
    const mapped = rootSink ? rootSink.mappedStackTrace : mappedStackTrace;
    mapped.subscribe(stackTrace => logger.log("Root subscribe at", stackTrace));
}

function logSubscriber_(logger: Logger, queryContext: QueryContext, group: boolean, keys: string[] = []): void {
    const { subscriberSnapshot_, subscriptionSnapshot_ } = queryContext;
    const { values, valuesFlushed } = subscriberSnapshot_;
    logger[group ? "group" : "groupCollapsed"].call(logger, "Subscriber");
    logger.log("Value count =", values.length + valuesFlushed);
    if (values.length > 0) {
        logger.log("Last value =", values[values.length - 1].value);
    }
    logSubscription_(logger, queryContext, keys);
    const otherSubscriptions = Array
        .from(subscriberSnapshot_.subscriptions.values())
        .filter(otherSubscriptionSnapshot => otherSubscriptionSnapshot !== subscriptionSnapshot_);
    otherSubscriptions.forEach(otherSubscriptionSnapshot => {
        logger.groupCollapsed("Other subscription");
        logSubscription_(logger, queryContext, keys);
        logger.groupEnd();
    });
    logger.groupEnd();
}

function logSubscription_(logger: Logger, queryContext: QueryContext, keys: string[] = []): void {
    const { complete, error, unsubscribed } = queryContext;
    logger.log("State =", complete ? "complete" : error ? "error" : "incomplete");
    keys = keys
        .sort()
        .filter(key => !["function", "undefined"].includes(typeof queryContext[key]));
    if (keys.length > 0) {
        logger.group("Query match");
        keys.forEach(key => logger.log(`${key} =`, queryContext[key]));
        logger.groupEnd();
    }
    logger.groupCollapsed("Query record");
    Object.keys(queryContext)
        .sort()
        .filter(key => !["function", "undefined"].includes(typeof queryContext[key]))
        .forEach(key => logger.log(`${key} =`, queryContext[key]));
    logger.groupEnd();
    if (error) {
        logger.error("Error =", error || "unknown");
    }
    if (unsubscribed) {
        logger.log("Unsubscribed =", true);
    }
    logStackTrace_(logger, queryContext);
}
