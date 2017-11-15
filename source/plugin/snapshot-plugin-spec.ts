/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { GraphPlugin } from "./graph-plugin";
import { matches } from "../match";
import { SnapshotPlugin, SubscriptionSnapshot } from "./snapshot-plugin";
import { spy } from "../spy";
import { toSubscriber } from "../util";

import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/switchMap";
import "../add/operator/tag";

describe("SnapshotPlugin", () => {

    const keptDuration = -1;
    const keptValues = 2;
    let plugin: SnapshotPlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        plugin = new SnapshotPlugin({ keptValues });
        teardown = spy({ plugins: [new GraphPlugin({ keptDuration }), plugin], warning: false });
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

            const subscription = subject.subscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);
            expect(snapshot.subscribers).to.have.property("size", 1);
            expect(snapshot.subscriptions).to.have.property("size", 1);

            const observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            const subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            const subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", false);
        });

        it("should spy on unsubscriptions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", false);

            subscription.unsubscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", true);
        });

        it("should spy on completions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", false);

            subject.complete();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", true);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", true);
        });

        it("should spy on errors", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            let subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            let subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", null);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", false);

            const error = new Error("Boom!");
            subject.error(error);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = getAt(snapshot.subscribers, 0);
            expect(subscriberSnapshot.subscriptions).to.have.property("size", 1);

            subscriptionSnapshot = getAt(snapshot.subscriptions, 0);
            expect(subscriptionSnapshot).to.have.property("complete", false);
            expect(subscriptionSnapshot).to.have.property("error", error);
            expect(subscriptionSnapshot).to.have.property("unsubscribed", true);
        });

        it("should spy on values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            let subscriberSnapshot = getAt(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values).to.deep.equal([]);

            subject.next(1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = getAt(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values.map((t) => t.value)).to.deep.equal([1]);

            subject.next(-1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = get(snapshot.observables, subject);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = getAt(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values.map((t) => t.value)).to.deep.equal([1, -1]);
        });

        it("should spy on changes since the specified snapshot", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

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
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);

            const subjectSubscriptionSnapshot = getAt(getAt(subjectSnapshot.subscribers, 0).subscriptions, 0);
            const mappedSubscriptionSnapshot = getAt(getAt(mappedSnapshot.subscribers, 0).subscriptions, 0);

            expect(subjectSubscriptionSnapshot.sink).to.equal(mappedSubscriptionSnapshot);
            expect(subjectSubscriptionSnapshot.sources).to.have.property("size", 0);

            expect(mappedSubscriptionSnapshot.sink).to.equal(null);
            expect(mappedSubscriptionSnapshot.sources).to.have.property("size", 1);
            expect(getAt(mappedSubscriptionSnapshot.sources, 0)).to.equal(subjectSubscriptionSnapshot);
        });

        it("should spy on array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = get(snapshot.observables, subject1);
            const subject2Snapshot = get(snapshot.observables, subject2);
            const combinedSnapshot = get(snapshot.observables, combined);

            const subject1SubscriptionSnapshot = getAt(getAt(subject1Snapshot.subscribers, 0).subscriptions, 0);
            const subject2SubscriptionSnapshot = getAt(getAt(subject2Snapshot.subscribers, 0).subscriptions, 0);
            const combinedSubscriptionSnapshot = getAt(getAt(combinedSnapshot.subscribers, 0).subscriptions, 0);

            expect(subject1SubscriptionSnapshot.sources).to.have.property("size", 0);
            expect(subject1SubscriptionSnapshot.sources).to.have.property("size", 0);

            expect(combinedSubscriptionSnapshot.sources).to.not.have.property("size", 0);
            expect(hasSource(combinedSubscriptionSnapshot, subject1SubscriptionSnapshot)).to.be.true;
            expect(hasSource(combinedSubscriptionSnapshot, subject2SubscriptionSnapshot)).to.be.true;
        });

        it("should spy on merges", () => {

            const subject = new Subject<number>();
            const outer = subject.tag("outer");
            const composed = outer.mergeMap((value) => Observable.of(value).tag("inner"));
            const subscription = composed.subscribe();

            let snapshot = plugin.snapshotAll();
            let outerSnapshot = get(snapshot.observables, outer);
            let outerSubscriber = getAt(outerSnapshot.subscribers, 0);
            let outerSubscription = getAt(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 0);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            outerSnapshot = get(snapshot.observables, outer);
            outerSubscriber = getAt(outerSnapshot.subscribers, 0);
            outerSubscription = getAt(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 1);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            outerSnapshot = get(snapshot.observables, outer);
            outerSubscriber = getAt(outerSnapshot.subscribers, 0);
            outerSubscription = getAt(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 2);
        });

        it("should determine a subscription's sink subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);

            expect(subjectSnapshot.subscribers).to.have.property("size", 1);
            expect(mappedSnapshot.subscribers).to.have.property("size", 1);

            const subjectSubscriber = getAt(subjectSnapshot.subscribers, 0);
            const mappedSubscriber = getAt(mappedSnapshot.subscribers, 0);

            expect(subjectSubscriber.subscriptions).to.have.property("size", 1);
            expect(mappedSubscriber.subscriptions).to.have.property("size", 1);

            const subjectSubscription = getAt(subjectSubscriber.subscriptions, 0);
            const mappedSubscription = getAt(mappedSubscriber.subscriptions, 0);

            expect(subjectSubscription).to.have.property("sink", mappedSubscription);
            expect(subjectSubscription).to.have.property("rootSink", mappedSubscription);
            expect(mappedSubscription).to.have.property("sink", null);
            expect(mappedSubscription).to.have.property("rootSink", null);
        });

        it("should determine a subscription's root sink subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const remapped = mapped.map((value) => value);
            const subscription = remapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 3);

            const subjectSnapshot = get(snapshot.observables, subject);
            const mappedSnapshot = get(snapshot.observables, mapped);
            const remappedSnapshot = get(snapshot.observables, remapped);

            expect(subjectSnapshot.subscribers).to.have.property("size", 1);
            expect(mappedSnapshot.subscribers).to.have.property("size", 1);
            expect(remappedSnapshot.subscribers).to.have.property("size", 1);

            const subjectSubscriber = getAt(subjectSnapshot.subscribers, 0);
            const mappedSubscriber = getAt(mappedSnapshot.subscribers, 0);
            const remappedSubscriber = getAt(remappedSnapshot.subscribers, 0);

            expect(subjectSubscriber.subscriptions).to.have.property("size", 1);
            expect(mappedSubscriber.subscriptions).to.have.property("size", 1);
            expect(remappedSubscriber.subscriptions).to.have.property("size", 1);

            const subjectSubscription = getAt(subjectSubscriber.subscriptions, 0);
            const mappedSubscription = getAt(mappedSubscriber.subscriptions, 0);
            const remappedSubscription = getAt(remappedSubscriber.subscriptions, 0);

            expect(subjectSubscription).to.have.property("sink", mappedSubscription);
            expect(subjectSubscription).to.have.property("rootSink", remappedSubscription);
            expect(mappedSubscription).to.have.property("sink", remappedSubscription);
            expect(mappedSubscription).to.have.property("rootSink", remappedSubscription);
            expect(remappedSubscription).to.have.property("sink", null);
            expect(remappedSubscription).to.have.property("rootSink", null);
        });

        it("should determine root sinks for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = get(snapshot.observables, subject1);
            const subject2Snapshot = get(snapshot.observables, subject2);
            const combinedSnapshot = get(snapshot.observables, combined);

            expect(subject1Snapshot.subscribers).to.have.property("size", 1);
            expect(subject2Snapshot.subscribers).to.have.property("size", 1);
            expect(combinedSnapshot.subscribers).to.have.property("size", 1);

            const subject1Subscriber = getAt(subject1Snapshot.subscribers, 0);
            const subject2Subscriber = getAt(subject2Snapshot.subscribers, 0);
            const combinedSubscriber = getAt(combinedSnapshot.subscribers, 0);

            expect(subject1Subscriber.subscriptions).to.have.property("size", 1);
            expect(subject2Subscriber.subscriptions).to.have.property("size", 1);
            expect(combinedSubscriber.subscriptions).to.have.property("size", 1);

            const subject1Subscription = getAt(subject1Subscriber.subscriptions, 0);
            const subject2Subscription = getAt(subject2Subscriber.subscriptions, 0);
            const combinedSubscription = getAt(combinedSubscriber.subscriptions, 0);

            expect(subject1Subscription).to.have.property("sink");
            expect(subject1Subscription).to.have.property("rootSink", combinedSubscription);
            expect(subject2Subscription).to.have.property("sink");
            expect(subject2Subscription).to.have.property("rootSink", combinedSubscription);
            expect(combinedSubscription).to.have.property("sink", null);
            expect(combinedSubscription).to.have.property("rootSink", null);
        });

        it("should determine root sinks for merges", () => {

            const outerSubject = new Subject<number>();
            const innerSubject1 = new Subject<number>();
            const innerSubject2 = new Subject<number>();
            const composed1 = outerSubject.switchMap((value) => innerSubject1);
            const composed2 = outerSubject.switchMap((value) => innerSubject2);
            const subscription1 = composed1.subscribe();
            const subscription2 = composed2.subscribe();

            outerSubject.next(1);

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const composed1Snapshot = get(snapshot.observables, composed1);
            const composed2Snapshot = get(snapshot.observables, composed2);
            const inner1Snapshot = get(snapshot.observables, innerSubject1);
            const inner2Snapshot = get(snapshot.observables, innerSubject2);

            expect(composed1Snapshot.subscribers).to.have.property("size", 1);
            expect(composed2Snapshot.subscribers).to.have.property("size", 1);
            expect(inner1Snapshot.subscribers).to.have.property("size", 1);
            expect(inner2Snapshot.subscribers).to.have.property("size", 1);

            const composed1Subscriber = getAt(composed1Snapshot.subscribers, 0);
            const composed2Subscriber = getAt(composed2Snapshot.subscribers, 0);
            const inner1Subscriber = getAt(inner1Snapshot.subscribers, 0);
            const inner2Subscriber = getAt(inner2Snapshot.subscribers, 0);

            expect(composed1Subscriber.subscriptions).to.have.property("size", 1);
            expect(composed2Subscriber.subscriptions).to.have.property("size", 1);
            expect(inner1Subscriber.subscriptions).to.have.property("size", 1);
            expect(inner2Subscriber.subscriptions).to.have.property("size", 1);

            const composed1Subscription = getAt(composed1Subscriber.subscriptions, 0);
            const composed2Subscription = getAt(composed2Subscriber.subscriptions, 0);
            const inner1Subscription = getAt(inner1Subscriber.subscriptions, 0);
            const inner2Subscription = getAt(inner2Subscriber.subscriptions, 0);

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
            expect(sourceSnapshot.subscribers).to.have.property("size", 1);

            const sourceSubscriber = get(snapshot.subscribers, subscriber);
            expect(sourceSubscriber.subscriptions).to.have.property("size", 2);
        });
    });

    describe("snapshotObservable", () => {

        it("should snapshot the specified observable", () => {

            const subject = new Subject<number>();
            const subscriber = toSubscriber(() => {});
            const subscription = subject.subscribe(subscriber);

            let observableSnapshot = plugin.snapshotObservable({
                observable: subject,
                subscriber,
                subscription,
                timestamp: Date.now(),
                unsubscribed: false
            });

            expect(observableSnapshot).to.exist;
            expect(observableSnapshot).to.have.property("observable", subject);
            expect(observableSnapshot).to.have.property("subscribers");
        });
    });

    describe("snapshotSubscriber", () => {

        it("should snapshot the specified subscriber", () => {

            const subject = new Subject<number>();
            const subscriber = toSubscriber(() => {});
            const subscription = subject.subscribe(subscriber);

            let subscriberSnapshot = plugin.snapshotSubscriber({
                observable: subject,
                subscriber,
                subscription,
                timestamp: Date.now(),
                unsubscribed: false
            });

            expect(subscriberSnapshot).to.exist;
            expect(subscriberSnapshot).to.have.property("subscriber", subscriber);
            expect(subscriberSnapshot).to.have.property("subscriptions");
        });
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
    subscriptionSnapshot.sources.forEach((s) => {
        if (s === source) {
            result = true;
        }
    });

    if (result) {
        return true;
    }

    subscriptionSnapshot.sources.forEach((s) => {
        if (hasSource(s, source)) {
            result = true;
        }
    });
    return result;
}
