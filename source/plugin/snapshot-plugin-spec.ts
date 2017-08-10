/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { matches } from "../match";
import { ObservableSnapshot, SnapshotPlugin } from "./snapshot-plugin";
import { spy } from "../spy";
import { toSubscriber } from "../util";

import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/switchMap";
import "../add/operator/tag";

describe("SnapshotPlugin", () => {

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
        teardown = spy({ plugins: [plugin], warning: false });
    });

    describe("flush", () => {

        it("should flush completed observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            subject.complete();
            plugin.flush({ completed: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush only completed observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            subject.error(new Error("Boom!"));
            plugin.flush({ completed: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);
        });

        it("should flush errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            subject.error(new Error("Boom!"));
            plugin.flush({ errored: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush only errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            subject.complete();
            plugin.flush({ errored: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);
        });

        it("should flush completed and errored observables by default", () => {

            const subject1 = new Subject<number>();
            const subscription1 = subject1.subscribe();

            const subject2 = new Subject<number>();
            const subscription2 = subject2.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(2);

            subject1.complete();
            subject2.error(new Error("Boom!"));
            plugin.flush();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush excess values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            subject.next(1);
            subject.next(2);
            subject.next(3);
            subject.next(4);

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            let observableSnapshot = snapshot.observables[0];
            let subscriberSnapshot = observableSnapshot.subscribers[0];
            expect(subscriberSnapshot.values).to.have.length(4);
            expect(subscriberSnapshot.valuesFlushed).to.equal(0);

            plugin.flush();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            subscriberSnapshot = observableSnapshot.subscribers[0];
            expect(subscriberSnapshot.values).to.have.length(2);
            expect(subscriberSnapshot.valuesFlushed).to.equal(2);
        });
    });

    describe("snapshotAll", () => {

        it("should spy on subscriptions", () => {

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(0);

            const subject = new Subject<number>();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(0);

            const subscription = subject.subscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            const observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot).to.have.property("complete", false);
            expect(observableSnapshot).to.have.property("error", null);
            expect(observableSnapshot.subscribers).to.have.length(1);
        });

        it("should clone the snapshot content", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            const snapshot1 = plugin.snapshotAll();
            expect(snapshot1.observables).to.have.length(1);

            subscription.unsubscribe();

            const snapshot2 = plugin.snapshotAll();
            expect(snapshot2.observables).to.have.length(1);
            expect(snapshot2.observables[0]).to.not.equal(snapshot1.observables[0]);
        });

        it("should spy on unsubscriptions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            let observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot.subscribers).to.have.length(1);

            subscription.unsubscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot.subscribers).to.have.length(0);
        });

        it("should spy on completions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            let observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot).to.have.property("complete", false);

            subject.complete();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot).to.have.property("complete", true);
        });

        it("should spy on errors", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            let observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot).to.have.property("error", null);

            const error = new Error("Boom!");
            subject.error(error);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot).to.have.property("error", error);
        });

        it("should spy on values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            let observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot.subscribers).to.have.length(1);

            let subscriberSnapshot = observableSnapshot.subscribers[0];
            expect(subscriberSnapshot.values).to.deep.equal([]);

            subject.next(1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot.subscribers).to.have.length(1);

            subscriberSnapshot = observableSnapshot.subscribers[0];
            expect(subscriberSnapshot.values.map((t) => t.value)).to.deep.equal([1]);

            subject.next(-1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            observableSnapshot = snapshot.observables[0];
            expect(observableSnapshot.subscribers).to.have.length(1);

            subscriberSnapshot = observableSnapshot.subscribers[0];
            expect(subscriberSnapshot.values.map((t) => t.value)).to.deep.equal([1, -1]);
        });

        it("should spy on changes since the specified snapshot", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let since = plugin.snapshotAll();
            expect(since.observables).to.have.length(1);

            let snapshot = plugin.snapshotAll({ since });
            expect(snapshot.observables).to.have.length(0);

            subject.next(1);

            snapshot = plugin.snapshotAll({ since });
            expect(snapshot.observables).to.have.length(1);
        });

        it("should support a filter", () => {

            const subject = new Subject<number>();
            const subscription = subject.tag("tagged").subscribe();

            let since = plugin.snapshotAll();
            expect(since.observables).to.have.length(2);

            let snapshot = plugin.snapshotAll({ filter: (o) => matches(o.observable, "tagged") });
            expect(snapshot.observables).to.have.length(1);

            snapshot = plugin.snapshotAll({
                filter: (o) => o.subscribers.some((s) =>
                    s.subscriptions.some((s) => !Boolean(s.destination))
                )
            });
            expect(snapshot.observables).to.have.length(1);
        });

        it("should spy on sources and destinations", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(2);

            const subjectSnapshot = find(snapshot.observables, (o) => o.observable === subject);
            const mappedSnapshot = find(snapshot.observables, (o) => o.observable === mapped);

            expect(subjectSnapshot).to.exist;
            expect(subjectSnapshot.destinations).to.have.length(1);
            expect(subjectSnapshot.destinations[0]).to.equal(mappedSnapshot);
            expect(subjectSnapshot.sources).to.deep.equal([]);

            expect(mappedSnapshot).to.exist;
            expect(mappedSnapshot.destinations).to.deep.equal([]);
            expect(mappedSnapshot.sources).to.have.length(1);
            expect(mappedSnapshot.sources[0]).to.equal(subjectSnapshot);
        });

        it("should spy on array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.be.empty;

            const subject1Snapshot = find(snapshot.observables, (o) => o.observable === subject1);
            const subject2Snapshot = find(snapshot.observables, (o) => o.observable === subject2);
            const combinedSnapshot = find(snapshot.observables, (o) => o.observable === combined);

            expect(subject1Snapshot).to.exist;
            expect(subject1Snapshot.sources).to.be.empty;

            expect(subject2Snapshot).to.exist;
            expect(subject2Snapshot.sources).to.be.empty;

            expect(combinedSnapshot).to.exist;
            expect(combinedSnapshot.sources).to.not.be.empty;
            expect(hasSource(combinedSnapshot, subject1Snapshot)).to.be.true;
            expect(hasSource(combinedSnapshot, subject2Snapshot)).to.be.true;

            function hasSource(
                observable: ObservableSnapshot,
                source: ObservableSnapshot
            ): boolean {

                if (observable.sources.indexOf(source) !== -1) {
                    return true;
                }
                return observable.sources.some((o) => hasSource(o, source));
            }
        });

        it("should spy on merges", () => {

            const subject = new Subject<number>();
            const outer = subject.tag("outer");
            const composed1 = outer.switchMap((value) => Observable.of(value).tag("inner1"));
            const composed2 = outer.switchMap((value) => Observable.of(value).tag("inner2"));
            const subscription1 = composed1.subscribe();
            const subscription2 = composed2.subscribe();

            let snapshot = plugin.snapshotAll();
            let outerSnapshot = find(snapshot.observables, (o) => o.observable === outer);

            expect(outerSnapshot).to.exist;
            expect(outerSnapshot.merges).to.be.empty;

            subject.next(1);

            snapshot = plugin.snapshotAll();
            outerSnapshot = find(snapshot.observables, (o) => o.observable === outer);

            expect(outerSnapshot).to.exist;
            expect(outerSnapshot.merges).to.have.length(2);
            expect(outerSnapshot.merges.some((o) => o.tag === "inner1")).to.be.true;
            expect(outerSnapshot.merges.some((o) => o.tag === "inner2")).to.be.true;
        });

        it("should determine a subscription's destination subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(2);

            const subjectSnapshot = find(snapshot.observables, (o) => o.observable === subject);
            const mappedSnapshot = find(snapshot.observables, (o) => o.observable === mapped);

            expect(subjectSnapshot.subscribers).to.have.length(1);
            expect(mappedSnapshot.subscribers).to.have.length(1);

            const subjectSubscriber = subjectSnapshot.subscribers[0];
            const mappedSubscriber = mappedSnapshot.subscribers[0];

            expect(subjectSubscriber.subscriptions).to.have.length(1);
            expect(mappedSubscriber.subscriptions).to.have.length(1);

            const subjectSubscription = subjectSubscriber.subscriptions[0];
            const mappedSubscription = mappedSubscriber.subscriptions[0];

            expect(subjectSubscription).to.have.property("destination", mappedSubscription);
            expect(subjectSubscription).to.have.property("finalDestination", mappedSubscription);
            expect(mappedSubscription).to.have.property("destination", null);
            expect(mappedSubscription).to.have.property("finalDestination", null);
        });

        it("should determine a subscription's final destination subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const remapped = mapped.map((value) => value);
            const subscription = remapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(3);

            const subjectSnapshot = find(snapshot.observables, (o) => o.observable === subject);
            const mappedSnapshot = find(snapshot.observables, (o) => o.observable === mapped);
            const remappedSnapshot = find(snapshot.observables, (o) => o.observable === remapped);

            expect(subjectSnapshot.subscribers).to.have.length(1);
            expect(mappedSnapshot.subscribers).to.have.length(1);
            expect(remappedSnapshot.subscribers).to.have.length(1);

            const subjectSubscriber = subjectSnapshot.subscribers[0];
            const mappedSubscriber = mappedSnapshot.subscribers[0];
            const remappedSubscriber = remappedSnapshot.subscribers[0];

            expect(subjectSubscriber.subscriptions).to.have.length(1);
            expect(mappedSubscriber.subscriptions).to.have.length(1);
            expect(remappedSubscriber.subscriptions).to.have.length(1);

            const subjectSubscription = subjectSubscriber.subscriptions[0];
            const mappedSubscription = mappedSubscriber.subscriptions[0];
            const remappedSubscription = remappedSubscriber.subscriptions[0];

            expect(subjectSubscription).to.have.property("destination", mappedSubscription);
            expect(subjectSubscription).to.have.property("finalDestination", remappedSubscription);
            expect(mappedSubscription).to.have.property("destination", remappedSubscription);
            expect(mappedSubscription).to.have.property("finalDestination", remappedSubscription);
            expect(remappedSubscription).to.have.property("destination", null);
            expect(remappedSubscription).to.have.property("finalDestination", null);
        });

        it("should determine final destinations for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.be.empty;

            const subject1Snapshot = find(snapshot.observables, (o) => o.observable === subject1);
            const subject2Snapshot = find(snapshot.observables, (o) => o.observable === subject2);
            const combinedSnapshot = find(snapshot.observables, (o) => o.observable === combined);

            expect(subject1Snapshot.subscribers).to.have.length(1);
            expect(subject2Snapshot.subscribers).to.have.length(1);
            expect(combinedSnapshot.subscribers).to.have.length(1);

            const subject1Subscriber = subject1Snapshot.subscribers[0];
            const subject2Subscriber = subject2Snapshot.subscribers[0];
            const combinedSubscriber = combinedSnapshot.subscribers[0];

            expect(subject1Subscriber.subscriptions).to.have.length(1);
            expect(subject2Subscriber.subscriptions).to.have.length(1);
            expect(combinedSubscriber.subscriptions).to.have.length(1);

            const subject1Subscription = subject1Subscriber.subscriptions[0];
            const subject2Subscription = subject2Subscriber.subscriptions[0];
            const combinedSubscription = combinedSubscriber.subscriptions[0];

            expect(subject1Subscription).to.have.property("destination");
            expect(subject1Subscription).to.have.property("finalDestination", combinedSubscription);
            expect(subject2Subscription).to.have.property("destination");
            expect(subject2Subscription).to.have.property("finalDestination", combinedSubscription);
            expect(combinedSubscription).to.have.property("destination", null);
            expect(combinedSubscription).to.have.property("finalDestination", null);
        });

        it("should determine final destinations for merges", () => {

            const outerSubject = new Subject<number>();
            const innerSubject1 = new Subject<number>();
            const innerSubject2 = new Subject<number>();
            const composed1 = outerSubject.switchMap((value) => innerSubject1);
            const composed2 = outerSubject.switchMap((value) => innerSubject2);
            const subscription1 = composed1.subscribe();
            const subscription2 = composed2.subscribe();

            outerSubject.next(1);

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.be.empty;

            const composed1Snapshot = find(snapshot.observables, (o) => o.observable === composed1);
            const composed2Snapshot = find(snapshot.observables, (o) => o.observable === composed2);
            const inner1Snapshot = find(snapshot.observables, (o) => o.observable === innerSubject1);
            const inner2Snapshot = find(snapshot.observables, (o) => o.observable === innerSubject2);

            expect(composed1Snapshot.subscribers).to.have.length(1);
            expect(composed2Snapshot.subscribers).to.have.length(1);
            expect(inner1Snapshot.subscribers).to.have.length(1);
            expect(inner2Snapshot.subscribers).to.have.length(1);

            const composed1Subscriber = composed1Snapshot.subscribers[0];
            const composed2Subscriber = composed2Snapshot.subscribers[0];
            const inner1Subscriber = inner1Snapshot.subscribers[0];
            const inner2Subscriber = inner2Snapshot.subscribers[0];

            expect(composed1Subscriber.subscriptions).to.have.length(1);
            expect(composed2Subscriber.subscriptions).to.have.length(1);
            expect(inner1Subscriber.subscriptions).to.have.length(1);
            expect(inner2Subscriber.subscriptions).to.have.length(1);

            const composed1Subscription = composed1Subscriber.subscriptions[0];
            const composed2Subscription = composed2Subscriber.subscriptions[0];
            const inner1Subscription = inner1Subscriber.subscriptions[0];
            const inner2Subscription = inner2Subscriber.subscriptions[0];

            expect(inner1Subscription).to.have.property("destination");
            expect(inner1Subscription).to.have.property("finalDestination", composed1Subscription);
            expect(inner2Subscription).to.have.property("destination");
            expect(inner2Subscription).to.have.property("finalDestination", composed2Subscription);
        });

        it("should support multiple subscriptions", () => {

            const source = new Subject<number>();
            const subscriber = toSubscriber(() => {});

            source.subscribe(subscriber);
            source.subscribe(subscriber);

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.length(1);

            const sourceSnapshot = find(snapshot.observables, (o) => o.observable === source);

            expect(sourceSnapshot.subscribers).to.have.length(1);

            const sourceSubscriber = sourceSnapshot.subscribers[0];

            expect(sourceSubscriber.subscriptions).to.have.length(2);
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
                subscription
            });

            expect(observableSnapshot).to.exist;
            expect(observableSnapshot).to.have.property("observable", subject);
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
                subscription
            });

            expect(subscriberSnapshot).to.exist;
            expect(subscriberSnapshot).to.have.property("subscriber", subscriber);
        });
    });
});

function find<T>(values: T[], predicate: (value: T) => boolean): T {

    const found = values.find(predicate);
    if (found === undefined) {
        throw new Error("Not found.");
    }
    return found as T;
}
