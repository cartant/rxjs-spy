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

class LazyQueryRecord {

    readonly observableSnapshot: ObservableSnapshot;
    readonly subscriberSnapshot: SubscriberSnapshot;
    readonly subscriptionSnapshot: SubscriptionSnapshot;
    private readonly now_ = Date.now();

    constructor(
        observableSnapshot: ObservableSnapshot,
        subscriberSnapshot: SubscriberSnapshot,
        subscriptionSnapshot: SubscriptionSnapshot,
        derivations: QueryDerivations
    ) {
        Object.assign(this, subscriptionSnapshot.queryRecord);
        Object.assign(this, derivations);
        this.observableSnapshot = observableSnapshot;
        this.subscriberSnapshot = subscriberSnapshot;
        this.subscriptionSnapshot = subscriptionSnapshot;
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
            (completeAge === undefined) ? Infinity : completeAge,
            (errorAge === undefined) ? Infinity : errorAge,
            (nextAge === undefined) ? Infinity : nextAge,
            (subscribeAge === undefined) ? Infinity : subscribeAge,
            (unsubscribeAge === undefined) ? Infinity : unsubscribeAge
        );
    }

    get blocking(): boolean {
        const { nextAge, sourceNextAge } = this;
        return (sourceNextAge !== undefined) && ((nextAge === undefined) || (nextAge > sourceNextAge));
    }

    get complete(): boolean {
        const { subscriptionSnapshot } = this;
        const { completeTimestamp } = subscriptionSnapshot;
        return completeTimestamp !== 0;
    }

    get completeAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { completeTimestamp } = subscriptionSnapshot;
        return this.age_(completeTimestamp);
    }

    get depth(): number {
        const { subscriptionSnapshot } = this;
        let { rootSink, sink } = subscriptionSnapshot;
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
        const { subscriptionSnapshot } = this;
        const { error, errorTimestamp } = subscriptionSnapshot;
        return (errorTimestamp === 0) ? undefined : (error || "unknown");
    }

    get errorAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { errorTimestamp } = subscriptionSnapshot;
        return this.age_(errorTimestamp);
    }

    get frequency(): number {
        const { subscriptionSnapshot } = this;
        const { nextCount, nextTimestamp, subscribeTimestamp } = subscriptionSnapshot;
        if ((nextCount === 0) || (nextTimestamp === 0)) {
            return 0;
        }
        const elapsed = nextTimestamp - subscribeTimestamp;
        if (elapsed === 0) {
            return Infinity;
        }
        return (nextCount / elapsed) * 1e3;
    }

    get incomplete(): boolean {
        const { subscriptionSnapshot } = this;
        const { completeTimestamp, errorTimestamp } = subscriptionSnapshot;
        return (completeTimestamp === 0) && (errorTimestamp === 0);
    }

    get inner(): boolean {
        const { subscriptionSnapshot } = this;
        return subscriptionSnapshot.inner;
    }

    get innerCount(): number {
        const { subscriptionSnapshot } = this;
        const { inners, innersFlushed } = subscriptionSnapshot;
        return inners.size + innersFlushed;
    }

    get innerIds(): string[] {
        const { subscriptionSnapshot } = this;
        const { inners } = subscriptionSnapshot;
        const innerSnapshots = Array.from(inners.values());
        return innerSnapshots.map(inner => inner.id);
    }

    get innerIncompleteCount(): number {
        const { subscriptionSnapshot } = this;
        const { inners } = subscriptionSnapshot;
        let count = 0;
        inners.forEach(({
            completeTimestamp,
            errorTimestamp,
            unsubscribeTimestamp
        }) => count += (completeTimestamp || errorTimestamp || unsubscribeTimestamp) ? 0 : 1);
        return count;
    }

    get innerNextAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { inners } = subscriptionSnapshot;
        const innerSnapshots = Array.from(inners.values());
        return this.age_(innerSnapshots.reduce((max, inner) => Math.max(max, inner.nextTimestamp), 0));
    }

    get innerNextCount(): number {
        const { subscriptionSnapshot } = this;
        const { inners } = subscriptionSnapshot;
        const innerSnapshots = Array.from(inners.values());
        return innerSnapshots.reduce((total, inner) => total + inner.nextCount, 0);
    }

    get name(): string {
        const { observableSnapshot } = this;
        return observableSnapshot.name;
    }

    get nextAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { nextTimestamp } = subscriptionSnapshot;
        return this.age_(nextTimestamp);
    }

    get nextCount(): number | undefined {
        const { subscriptionSnapshot } = this;
        return subscriptionSnapshot.nextCount;
    }

    get observableId(): string {
        const { observableSnapshot } = this;
        return observableSnapshot.id;
    }

    get observablePipeline(): string {
        const { observableSnapshot } = this;
        return observableSnapshot.pipeline;
    }

    get root(): boolean {
        const { subscriptionSnapshot } = this;
        return !subscriptionSnapshot.sink;
    }

    get rootSinkId(): string | undefined {
        const { subscriptionSnapshot } = this;
        const { rootSink } = subscriptionSnapshot;
        return rootSink ? rootSink.id : undefined;
    }

    get sinkId(): string | undefined {
        const { subscriptionSnapshot } = this;
        const { sink } = subscriptionSnapshot;
        return sink ? sink.id : undefined;
    }

    get sinkNextAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { sink } = subscriptionSnapshot;
        return sink ? this.age_(sink.nextTimestamp) : undefined;
    }

    get sinkNextCount(): number {
        const { subscriptionSnapshot } = this;
        const { sink } = subscriptionSnapshot;
        return sink ? sink.nextCount : 0;
    }

    get sourceCount(): number {
        const { subscriptionSnapshot } = this;
        const { sources, sourcesFlushed } = subscriptionSnapshot;
        return sources.size + sourcesFlushed;
    }

    get sourceIds(): string[] {
        const { subscriptionSnapshot } = this;
        const { sources } = subscriptionSnapshot;
        const sourceSnapshots = Array.from(sources.values());
        return sourceSnapshots.map(source => source.id);
    }

    get sourceNextAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { sources } = subscriptionSnapshot;
        const sourceSnapshots = Array.from(sources.values());
        return this.age_(sourceSnapshots.reduce((max, source) => Math.max(max, source.nextTimestamp), 0));
    }

    get sourceNextCount(): number {
        const { subscriptionSnapshot } = this;
        const { sources } = subscriptionSnapshot;
        const sourceSnapshots = Array.from(sources.values());
        return sourceSnapshots.reduce((total, source) => total + source.nextCount, 0);
    }

    get subscribeAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { subscribeTimestamp } = subscriptionSnapshot;
        return this.age_(subscribeTimestamp);
    }

    get subscriberId(): string {
        const { subscriberSnapshot } = this;
        return subscriberSnapshot.id;
    }

    get subscriptionId(): string {
        const { subscriptionSnapshot } = this;
        return subscriptionSnapshot.id;
    }

    get unsubscribeAge(): number | undefined {
        const { subscriptionSnapshot } = this;
        const { unsubscribeTimestamp } = subscriptionSnapshot;
        return this.age_(unsubscribeTimestamp);
    }

    get unsubscribed(): boolean {
        const { subscriptionSnapshot } = this;
        const { unsubscribeTimestamp } = subscriptionSnapshot;
        return unsubscribeTimestamp !== 0;
    }

    get value(): any {
        const { subscriptionSnapshot } = this;
        const { values } = subscriptionSnapshot;
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

    observable(match: string | RegExp): boolean {
        const { observableSnapshot } = this;
        const { name } = observableSnapshot;
        return (typeof match === "string") ? (name === match) : match.test(name);
    }

    operator(match: string | RegExp): boolean {
        return this.observable(match);
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
        return ((nextAge === undefined) ? (subscribeAge || 0) : nextAge) > threshold;
    }

    tag(match: string | RegExp): boolean {
        const { observableSnapshot } = this;
        const { tag } = observableSnapshot;
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
        return timestamp ? (now_ - timestamp) : undefined;
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
            observableSnapshot,
            subscriptionSnapshot
        } = this;
        const rootStackTrace = subscriptionSnapshot.rootSink ?
            subscriptionSnapshot.rootSink.stackTrace : [];
        return observableSnapshot.stackTrace.some(predicate) ||
            subscriptionSnapshot.stackTrace.some(predicate) ||
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
            observableSnapshot: ObservableSnapshot;
            orderByQueryRecord: QueryRecord;
            queryRecords: LazyQueryRecord[];
        }[] = [];

        observableSnapshots.forEach(observableSnapshot => {

            let find: typeof found[0] | undefined;

            const { subscriptions } = observableSnapshot;
            subscriptions.forEach(subscriptionSnapshot => {

                const subscriberSnapshot = snapshot.subscribers.get(subscriptionSnapshot.subscriber);
                if (subscriberSnapshot) {
                    const queryRecord = new LazyQueryRecord(
                        observableSnapshot,
                        subscriberSnapshot,
                        subscriptionSnapshot,
                        derivations
                    );
                    if (predicateEvaluator(queryRecord)) {
                        const orderByRecord = queryRecord;
                        if (!find) {
                            find = {
                                observableSnapshot,
                                orderByQueryRecord: orderByRecord,
                                queryRecords: []
                            };
                        } else if (comparer(orderByRecord, find.orderByQueryRecord) < 0) {
                            find.orderByQueryRecord = orderByRecord;
                        }
                        find.queryRecords.push(queryRecord);
                    }
                }
            });

            if (find) {
                found.push(find);
            }
        });

        if (comparer) {
            found.sort((l, r) => comparer(
                l.orderByQueryRecord,
                r.orderByQueryRecord
            ));
        }

        const omitted = (found.length > limit) ? found.length - limit : 0;
        if (omitted) {
            found.splice(limit, omitted);
        }

        logger.group(`${found.length + omitted} snapshot(s) found`);

        const observableGroupMethod = (found.length > 3) ? "groupCollapsed" : "group";
        found.forEach(find => {
            const { observableSnapshot } = find;
            logger[observableGroupMethod].call(logger, observableSnapshot.tag ?
                `ID = ${observableSnapshot.id}; tag = ${observableSnapshot.tag}` :
                `ID = ${observableSnapshot.id}`
            );
            logger.log("Name =", observableSnapshot.name);
            logger.log("Pipeline =", observableSnapshot.pipeline);
            const { queryRecords } = find;
            logger.group(`${queryRecords.length} subscriber(s)`);
            queryRecords.forEach(queryRecord => logSubscriber_(logger, queryRecord, queryRecords.length <= 3, keys));
            logger.groupEnd();
            logger.groupEnd();
        });

        if (omitted) {
            logger.log(`... another ${omitted} snapshot(s) not logged.`);
        }
        logger.groupEnd();
    });
}

function logStackTrace_(logger: Logger, queryRecord: LazyQueryRecord): void {
    const { subscriptionSnapshot } = queryRecord;
    const { mappedStackTrace, rootSink } = subscriptionSnapshot;
    const mapped = rootSink ? rootSink.mappedStackTrace : mappedStackTrace;
    mapped.subscribe(stackTrace => logger.log("Root subscribe at", stackTrace));
}

function logSubscriber_(logger: Logger, queryRecord: LazyQueryRecord, group: boolean, keys: string[] = []): void {
    const { subscriberSnapshot, subscriptionSnapshot } = queryRecord;
    const { values, valuesFlushed } = subscriberSnapshot;
    logger[group ? "group" : "groupCollapsed"].call(logger, "Subscriber");
    logger.log("Value count =", values.length + valuesFlushed);
    if (values.length > 0) {
        logger.log("Last value =", values[values.length - 1].value);
    }
    logSubscription_(logger, queryRecord, keys);
    const otherSubscriptions = Array
        .from(subscriberSnapshot.subscriptions.values())
        .filter(otherSubscriptionSnapshot => otherSubscriptionSnapshot !== subscriptionSnapshot);
    otherSubscriptions.forEach(otherSubscriptionSnapshot => {
        logger.groupCollapsed("Other subscription");
        logSubscription_(logger, queryRecord, keys);
        logger.groupEnd();
    });
    logger.groupEnd();
}

function logSubscription_(logger: Logger, queryRecord: LazyQueryRecord, keys: string[] = []): void {
    const { complete, error, unsubscribed } = queryRecord;
    logger.log("State =", complete ? "complete" : error ? "error" : "incomplete");
    keys = keys
        .sort()
        .filter(key => !["function", "undefined"].includes(typeof queryRecord[key]));
    if (keys.length > 0) {
        logger.group("Query match");
        keys.forEach(key => logger.log(`${key} =`, queryRecord[key]));
        logger.groupEnd();
    }
    logger.groupCollapsed("Query record");
    Object.keys(queryRecord)
        .sort()
        .filter(key => !["function", "undefined"].includes(typeof queryRecord[key]))
        .forEach(key => logger.log(`${key} =`, queryRecord[key]));
    logger.groupEnd();
    if (error) {
        logger.error("Error =", error || "unknown");
    }
    if (unsubscribed) {
        logger.log("Unsubscribed =", true);
    }
    logStackTrace_(logger, queryRecord);
}
