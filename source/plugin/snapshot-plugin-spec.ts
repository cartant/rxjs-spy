/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { combineLatest, of, Subject } from "rxjs";
import { map, mergeMap, switchMap } from "rxjs/operators";
import { tag } from "../operators";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { toSubscriber } from "../util";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin, SubscriptionSnapshot } from "./snapshot-plugin";

describe("SnapshotPlugin", () => {

    const keptDuration = -1;
    const keptValues = 2;
    let plugin: SnapshotPlugin;
    let spy: Spy;

    beforeEach(() => {

        spy = create({ defaultPlugins: false, warning: false });
        plugin = new SnapshotPlugin({ keptValues, spy });
        spy.plug(new GraphPlugin({ keptDuration, spy }), plugin);
    });

    describe("snapshotAll", () => {

        it("should spy on subscriptions", () => {

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 0);
            expect(snapshot.subscribers).to.have.property("size", 0);
            expect(snapshot.subscriptions).to.have.property("size", 0);

            const subject = new Subject<number>();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 0);
            expect(snapshot.subscribers).to.have.property("size", 0);
            expect(snapshot.subscriptions).to.have.property("size", 0);

            subject.subscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);
            expect(snapshot.subscribers).to.have.property("size", 1);
            expect(snapshot.subscriptions).to.have.property("size", 1);

            const observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            const subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            const subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp", 0);
        });

        it("should spy on unsubscriptions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp", 0);

            subscription.unsubscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp");
            expect(subscriptionSnapshot.unsubscribeTimestamp).to.be.above(0);
        });

        it("should spy on completions", () => {

            const subject = new Subject<number>();
            subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp", 0);

            subject.complete();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp");
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp");
            expect(subscriptionSnapshot.completeTimestamp).to.be.above(0);
            expect(subscriptionSnapshot.unsubscribeTimestamp).to.be.above(0);
        });

        it("should spy on errors", () => {

            const subject = new Subject<number>();
            subject.subscribe(value => {}, error => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", undefined);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp", 0);

            const error = new Error("Boom!");
            subject.error(error);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("completeTimestamp", 0);
            expect(subscriptionSnapshot).to.have.property("error", error);
            expect(subscriptionSnapshot).to.have.property("errorTimestamp");
            expect(subscriptionSnapshot).to.have.property("unsubscribeTimestamp");
            expect(subscriptionSnapshot.errorTimestamp).to.be.above(0);
            expect(subscriptionSnapshot.unsubscribeTimestamp).to.be.above(0);
        });

        it("should spy on values", () => {

            const subject = new Subject<number>();
            subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(observableSnapshot.subscriptions, 0);
            let subscriberSnapshot = get(snapshot.subscribers, subscriptionSnapshot.subscriber);
            expect(subscriberSnapshot.values).to.deep.equal([]);

            subject.next(1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(observableSnapshot.subscriptions, 0);
            subscriberSnapshot = get(snapshot.subscribers, subscriptionSnapshot.subscriber);
            expect(subscriberSnapshot.values.map(t => t.value)).to.deep.equal([1]);

            subject.next(-1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(observableSnapshot.subscriptions, 0);
            subscriberSnapshot = get(snapshot.subscribers, subscriptionSnapshot.subscriber);
            expect(subscriberSnapshot.values.map(t => t.value)).to.deep.equal([1, -1]);
        });

        it("should spy on changes since the specified snapshot", () => {

            const subject = new Subject<number>();
            subject.subscribe();

            const since = plugin.snapshotAll();
            expect(since.observables).to.have.property("size", 1);
            expect(since.subscribers).to.have.property("size", 1);
            expect(since.subscriptions).to.have.property("size", 1);

            let snapshot = plugin.snapshotAll({ since });
            expect(snapshot.observables).to.have.property("size", 0);
            expect(snapshot.subscribers).to.have.property("size", 0);
            expect(snapshot.subscriptions).to.have.property("size", 0);

            subject.next(1);

            snapshot = plugin.snapshotAll({ since });
            expect(snapshot.observables).to.have.property("size", 1);
            expect(snapshot.subscribers).to.have.property("size", 1);
            expect(snapshot.subscriptions).to.have.property("size", 1);
        });

        it("should spy on sources and sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);

            const subjectSubscriptionSnapshot = getAt(subjectSnapshot.subscriptions, 0);
            const mappedSubscriptionSnapshot = getAt(mappedSnapshot.subscriptions, 0);

            expect(subjectSubscriptionSnapshot.sink).to.equal(mappedSubscriptionSnapshot);
            expect(subjectSubscriptionSnapshot.sources).to.have.property("size", 0);

            expect(mappedSubscriptionSnapshot.sink).to.equal(undefined);
            expect(mappedSubscriptionSnapshot.sources).to.have.property("size", 1);
            expect(getAt(mappedSubscriptionSnapshot.sources, 0)).to.equal(subjectSubscriptionSnapshot);
        });

        it("should spy on array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = get(snapshot.observables, subject1);
            const subject2Snapshot = get(snapshot.observables, subject2);
            const combinedSnapshot = get(snapshot.observables, combined);

            const subject1SubscriptionSnapshot = getAt(subject1Snapshot.subscriptions, 0);
            const subject2SubscriptionSnapshot = getAt(subject2Snapshot.subscriptions, 0);
            const combinedSubscriptionSnapshot = getAt(combinedSnapshot.subscriptions, 0);

            expect(subject1SubscriptionSnapshot.sources).to.have.property("size", 0);
            expect(subject1SubscriptionSnapshot.sources).to.have.property("size", 0);

            expect(combinedSubscriptionSnapshot.sources).to.not.have.property("size", 0);
            expect(hasSource(combinedSubscriptionSnapshot, subject1SubscriptionSnapshot)).to.be.true;
            expect(hasSource(combinedSubscriptionSnapshot, subject2SubscriptionSnapshot)).to.be.true;
        });

        it("should spy on flats", () => {

            const subject = new Subject<number>();
            const outer = subject.pipe(tag("outer"));
            const composed = outer.pipe(mergeMap(value => of(value).pipe(tag("inner"))));
            composed.subscribe();

            let snapshot = plugin.snapshotAll();
            let composedSnapshot = get(snapshot.observables, composed);
            let composedSubscription = getAt(composedSnapshot.subscriptions, 0);
            let composedSubscriber = get(snapshot.subscribers, composedSubscription.subscriber);

            expect(composedSubscription.flats).to.have.property("size", 0);
            expect(composedSubscriber.subscriptions).to.have.property("size", 1);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            composedSnapshot = get(snapshot.observables, composed);
            composedSubscription = getAt(composedSnapshot.subscriptions, 0);
            composedSubscriber = get(snapshot.subscribers, composedSubscription.subscriber);

            expect(composedSubscription.flats).to.have.property("size", 1);
            expect(composedSubscriber.subscriptions).to.have.property("size", 1);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            composedSnapshot = get(snapshot.observables, composed);
            composedSubscription = getAt(composedSnapshot.subscriptions, 0);
            composedSubscriber = get(snapshot.subscribers, composedSubscription.subscriber);

            expect(composedSubscription.flats).to.have.property("size", 2);
            expect(composedSubscriber.subscriptions).to.have.property("size", 1);
        });

        it("should determine a subscription's sink subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);

            expect(subjectSnapshot.subscriptions).to.have.property("size", 1);
            expect(mappedSnapshot.subscriptions).to.have.property("size", 1);

            const subjectSubscription = getAt(subjectSnapshot.subscriptions, 0);
            const mappedSubscription = getAt(mappedSnapshot.subscriptions, 0);

            expect(subjectSubscription).to.have.property("sink", mappedSubscription);
            expect(subjectSubscription).to.have.property("rootSink", mappedSubscription);
            expect(mappedSubscription).to.have.property("sink", undefined);
            expect(mappedSubscription).to.have.property("rootSink", undefined);
        });

        it("should determine a subscription's root sink subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            const remapped = mapped.pipe(map(value => value));
            remapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 3);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);
            const remappedSnapshot = get(snapshot.observables, remapped);

            expect(subjectSnapshot.subscriptions).to.have.property("size", 1);
            expect(mappedSnapshot.subscriptions).to.have.property("size", 1);
            expect(remappedSnapshot.subscriptions).to.have.property("size", 1);

            const subjectSubscription = getAt(subjectSnapshot.subscriptions, 0);
            const mappedSubscription = getAt(mappedSnapshot.subscriptions, 0);
            const remappedSubscription = getAt(remappedSnapshot.subscriptions, 0);

            expect(subjectSubscription).to.have.property("sink", mappedSubscription);
            expect(subjectSubscription).to.have.property("rootSink", remappedSubscription);
            expect(mappedSubscription).to.have.property("sink", remappedSubscription);
            expect(mappedSubscription).to.have.property("rootSink", remappedSubscription);
            expect(remappedSubscription).to.have.property("sink", undefined);
            expect(remappedSubscription).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = get(snapshot.observables, subject1);
            const subject2Snapshot = get(snapshot.observables, subject2);
            const combinedSnapshot = get(snapshot.observables, combined);

            expect(subject1Snapshot.subscriptions).to.have.property("size", 1);
            expect(subject2Snapshot.subscriptions).to.have.property("size", 1);
            expect(combinedSnapshot.subscriptions).to.have.property("size", 1);

            const subject1Subscription = getAt(subject1Snapshot.subscriptions, 0);
            const subject2Subscription = getAt(subject2Snapshot.subscriptions, 0);
            const combinedSubscription = getAt(combinedSnapshot.subscriptions, 0);

            expect(subject1Subscription).to.have.property("sink");
            expect(subject1Subscription).to.have.property("rootSink", combinedSubscription);
            expect(subject2Subscription).to.have.property("sink");
            expect(subject2Subscription).to.have.property("rootSink", combinedSubscription);
            expect(combinedSubscription).to.have.property("sink", undefined);
            expect(combinedSubscription).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for flats", () => {

            const outerSubject = new Subject<number>();
            const innerSubject1 = new Subject<number>();
            const innerSubject2 = new Subject<number>();
            const composed1 = outerSubject.pipe(switchMap(value => innerSubject1));
            const composed2 = outerSubject.pipe(switchMap(value => innerSubject2));
            composed1.subscribe();
            composed2.subscribe();

            outerSubject.next(1);

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const composed1Snapshot = get(snapshot.observables, composed1);
            const composed2Snapshot = get(snapshot.observables, composed2);
            const inner1Snapshot = get(snapshot.observables, innerSubject1);
            const inner2Snapshot = get(snapshot.observables, innerSubject2);

            expect(composed1Snapshot.subscriptions).to.have.property("size", 1);
            expect(composed2Snapshot.subscriptions).to.have.property("size", 1);
            expect(inner1Snapshot.subscriptions).to.have.property("size", 1);
            expect(inner2Snapshot.subscriptions).to.have.property("size", 1);

            const composed1Subscription = getAt(composed1Snapshot.subscriptions, 0);
            const composed2Subscription = getAt(composed2Snapshot.subscriptions, 0);
            const inner1Subscription = getAt(inner1Snapshot.subscriptions, 0);
            const inner2Subscription = getAt(inner2Snapshot.subscriptions, 0);

            expect(inner1Subscription).to.have.property("sink");
            expect(inner1Subscription).to.have.property("rootSink", composed1Subscription);
            expect(inner2Subscription).to.have.property("sink");
            expect(inner2Subscription).to.have.property("rootSink", composed2Subscription);
        });

        it("should support multiple subscriptions", () => {

            const source = new Subject<number>();
            const subscriber = toSubscriber(() => {});

            source.subscribe(subscriber);
            source.subscribe(subscriber);

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);
            expect(snapshot.subscribers).to.have.property("size", 1);
            expect(snapshot.subscriptions).to.have.property("size", 2);

            const sourceSnapshot = get(snapshot.observables, source);
            expect(sourceSnapshot.subscriptions).to.have.property("size", 2);

            const sourceSubscriber = get(snapshot.subscribers, subscriber);
            expect(sourceSubscriber.subscriptions).to.have.property("size", 2);
        });
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});

function get<K, V>(map: Map<K, V>, key: K): V {

    return map.get(key)!;
}

function getAt<K, V>(map: Map<K, V>, index: number): V {

    return Array.from(map.values())[index];
}

function hasSource(subscriptionSnapshot: SubscriptionSnapshot, source: SubscriptionSnapshot): boolean {

    let result = false;
    subscriptionSnapshot.sources.forEach(s => {
        if (s === source) {
            result = true;
        }
    });

    if (result) {
        return true;
    }

    subscriptionSnapshot.sources.forEach(s => {
        if (hasSource(s, source)) {
            result = true;
        }
    });
    return result;
}
