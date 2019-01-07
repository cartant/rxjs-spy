/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { compile, compileOrderBy } from "../expression";
import { identify } from "../identify";
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

const defaultDerivations: QueryDerivations = {
    age: deriveAge,
    blocking: deriveBlocking,
    depth: deriveDepth,
    file: record => (match: string | RegExp) => matchStackTrace(record, "fileName", match),
    func: record => (match: string | RegExp) => matchStackTrace(record, "functionName", match),
    id: record => (match: number | string) => matchId(record, match),
    innerIncompleteCount: deriveInnerIncompleteCount,
    pipeline: record => (match: string | RegExp) => matchPipeline(record, match),
    tag: record => (match: string | RegExp) => matchTag(record, match)
};

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
                    const queryRecord = toQueryRecord(
                        derivations,
                        observableSnapshot,
                        subscriberSnapshot,
                        subscriptionSnapshot
                    );
                    if (predicateEvaluator(queryRecord)) {
                        const orderByRecord = queryRecord;
                        if (!find) {
                            find = {
                                observable: observableSnapshot,
                                orderByRecord,
                                subs: []
                            };
                        } else if (comparer(orderByRecord, find.orderByRecord) < 0) {
                            find.orderByRecord = orderByRecord;
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
                logSubscription(
                    logger,
                    derivations,
                    keys,
                    observableSnapshot,
                    subscriberSnapshot,
                    subscriptionSnapshot
                );

                const otherSubscriptions = Array
                    .from(subscriberSnapshot.subscriptions.values())
                    .filter(otherSubscriptionSnapshot => otherSubscriptionSnapshot !== subscriptionSnapshot);
                otherSubscriptions.forEach(otherSubscriptionSnapshot => {
                    logger.groupCollapsed("Other subscription");
                    logSubscription(
                        logger,
                        derivations,
                        keys,
                        observableSnapshot,
                        subscriberSnapshot,
                        otherSubscriptionSnapshot
                    );
                    logger.groupEnd();
                });
                logger.groupEnd();
            });
            logger.groupEnd();
            logger.groupEnd();
        });

        if (omitted) {
            logger.log(`... another ${omitted} snapshot(s) not logged.`);
        }
        logger.groupEnd();
    });
}

function deriveAge({
    completeAge,
    errorAge,
    nextAge,
    subscribeAge,
    unsubscribeAge
}: QueryRecord): number {
    return Math.min(
        completeAge || Infinity,
        errorAge || Infinity,
        nextAge || Infinity,
        subscribeAge || Infinity,
        unsubscribeAge || Infinity
    );
}

function deriveBlocking({
    nextAge,
    sourceNextAge
}: QueryRecord): boolean {
    return ((nextAge === undefined) && (sourceNextAge !== undefined)) || (nextAge > sourceNextAge);
}

function deriveDepth(
    record: QueryRecord,
    { rootSink, sink }: SubscriptionSnapshot
): number {
    if (!sink) {
        return 0;
    }
    let depth = 1;
    for (; sink !== rootSink; ++depth) {
        sink = sink.sink!;
    }
    return depth;
}

function deriveInnerIncompleteCount(
    record: QueryRecord,
    { inners }: SubscriptionSnapshot
): number {
    let count = 0;
    inners.forEach(({
        completeTimestamp,
        errorTimestamp,
        unsubscribeTimestamp
    }) => count += (completeTimestamp || errorTimestamp || unsubscribeTimestamp) ? 0 : 1);
    return count;
}

function logStackTrace(
    logger: Logger,
    subscriptionSnapshot: SubscriptionSnapshot
): void {

    const { mappedStackTrace, rootSink } = subscriptionSnapshot;
    const mapped = rootSink ? rootSink.mappedStackTrace : mappedStackTrace;
    mapped.subscribe(stackTrace => logger.log("Root subscribe at", stackTrace));
}

function logSubscription(
    logger: Logger,
    derivations: QueryDerivations,
    keys: string[] = [],
    observableSnapshot: ObservableSnapshot,
    subscriberSnapshot: SubscriberSnapshot,
    subscriptionSnapshot: SubscriptionSnapshot
): void {

    const {
        completeTimestamp,
        error,
        errorTimestamp,
        unsubscribeTimestamp
    } = subscriptionSnapshot;
    const record = toQueryRecord(
        derivations,
        observableSnapshot,
        subscriberSnapshot,
        subscriptionSnapshot
    );

    logger.log("State =", completeTimestamp ? "complete" : errorTimestamp ? "error" : "incomplete");
    keys = keys
        .sort()
        .filter(key => !["function", "undefined"].includes(typeof record[key]));
    if (keys.length > 0) {
        logger.group("Query match");
        keys.forEach(key => logger.log(`${key} =`, record[key]));
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
    logStackTrace(logger, subscriptionSnapshot);
}

function matchId(
    { observableId, subscriberId, subscriptionId }: QueryRecord,
    match: number | string
): boolean {
    if (typeof match === "number") {
        match = match.toString();
    }
    return (match === observableId) || (match === subscriberId) || (match === subscriptionId);
}

function matchPipeline(
    queryRecord: QueryRecord,
    match: string | RegExp | undefined
): boolean {
    const { observablePipeline } = queryRecord;
    if (typeof match === "string") {
        return observablePipeline.indexOf(match) !== -1;
    }
    return (match && match.test) ? match.test(observablePipeline) : false;
}

function matchStackTrace(
    queryRecord: QueryRecord,
    property: string,
    match: string | RegExp
): boolean {
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
        observableStackTrace,
        rootStackTrace,
        subscriptionStackTrace
    } = queryRecord;
    return observableStackTrace.some(predicate) ||
        rootStackTrace.some(predicate) ||
        subscriptionStackTrace.some(predicate);
}

function matchTag(
    queryRecord: QueryRecord,
    match: string | RegExp | undefined
): boolean {
    const { tag } = queryRecord;
    if (match === undefined) {
        return Boolean(tag);
    }
    if (typeof match === "string") {
        return tag === match;
    }
    return (match && match.test) ? match.test(tag) : false;
}

function toQueryRecord(
    derivations: QueryDerivations,
    observableSnapshot: ObservableSnapshot,
    subscriberSnapshot: SubscriberSnapshot,
    subscriptionSnapshot: SubscriptionSnapshot
): QueryRecord {

    const now = Date.now();
    function age(timestamp: number): number | undefined {
        return timestamp ? ((now - timestamp) / 1e3) : undefined;
    }

    const {
        pipeline,
        stackTrace: observableStackTrace
    } = observableSnapshot;

    const {
        completeTimestamp,
        error,
        errorTimestamp,
        inner,
        inners,
        innersFlushed,
        nextCount,
        nextTimestamp,
        observable,
        rootSink,
        sink,
        sources,
        sourcesFlushed,
        stackTrace: subscriptionStackTrace,
        subscribeTimestamp,
        subscriber,
        subscription,
        unsubscribeTimestamp
    } = subscriptionSnapshot;

    const innerSnapshots = Array.from(inners.values());
    const sourceSnapshots = Array.from(sources.values());

    const queryRecord = {
        ...subscriptionSnapshot.queryRecord,
        complete: completeTimestamp !== 0,
        completeAge: age(completeTimestamp),
        error: (errorTimestamp === 0) ? undefined : (error || "unknown"),
        errorAge: age(errorTimestamp),
        frequency: nextTimestamp ? (nextCount / (nextTimestamp - subscribeTimestamp)) * 1e3 : 0,
        incomplete: (completeTimestamp === 0) && (errorTimestamp === 0),
        inner,
        innerCount: innerSnapshots.length + innersFlushed,
        innerIds: innerSnapshots.map(inner => inner.id),
        innerNextAge: age(innerSnapshots.reduce((max, inner) => Math.max(max, inner.nextTimestamp), 0)),
        innerNextCount: innerSnapshots.reduce((total, inner) => total + inner.nextCount, 0),
        name: observableSnapshot.name,
        nextAge: age(nextTimestamp),
        nextCount,
        observableId: identify(observable),
        observablePipeline: pipeline,
        observableStackTrace,
        root: !sink,
        rootSinkId: rootSink ? rootSink.id : undefined,
        rootStackTrace: rootSink ? rootSink.stackTrace : [],
        sinkId: sink ? sink.id : undefined,
        sinkNextAge: sink ? age(sink.nextTimestamp) : undefined,
        sinkNextCount: sink ? sink.nextCount : 0,
        sourceCount: sourceSnapshots.length + sourcesFlushed,
        sourceIds: sourceSnapshots.map(source => source.id),
        sourceNextAge: age(sourceSnapshots.reduce((max, source) => Math.max(max, source.nextTimestamp), 0)),
        sourceNextCount: sourceSnapshots.reduce((total, source) => total + source.nextCount, 0),
        subscribeAge: age(subscribeTimestamp),
        subscriberId: identify(subscriber),
        subscriptionId: identify(subscription),
        subscriptionStackTrace,
        tag: observableSnapshot.tag,
        unsubscribeAge: age(unsubscribeTimestamp),
        unsubscribed: unsubscribeTimestamp !== 0
    };

    const defaultDerived = {};
    Object.keys(defaultDerivations).forEach(key => {
        defaultDerived[key] = defaultDerivations[key](
            queryRecord,
            subscriptionSnapshot
        );
    });

    const derived = {};
    Object.keys(derivations).forEach(key => {
        derived[key] = derivations[key](
            queryRecord,
            subscriptionSnapshot
        );
    });
    return { ...queryRecord, ...defaultDerived, ...derived };
}
