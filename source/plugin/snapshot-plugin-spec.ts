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
import "rxjs/add/operator/mergeMap";
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
            expect(snapshot.observables).to.have.property("size", 1);

            subject.complete();
            plugin.flush({ completed: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 0);
        });

        it("should flush only completed observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            subject.error(new Error("Boom!"));
            plugin.flush({ completed: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);
        });

        it("should flush errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            subject.error(new Error("Boom!"));
            plugin.flush({ errored: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 0);
        });

        it("should flush only errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            subject.complete();
            plugin.flush({ errored: true });

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);
        });

        it("should flush completed and errored observables by default", () => {

            const subject1 = new Subject<number>();
            const subscription1 = subject1.subscribe();

            const subject2 = new Subject<number>();
            const subscription2 = subject2.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            subject1.complete();
            subject2.error(new Error("Boom!"));
            plugin.flush();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 0);
        });

        it("should flush excess values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            subject.next(1);
            subject.next(2);
            subject.next(3);
            subject.next(4);

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = snapshot.observables.get(subject)!;
            let subscriberSnapshot = get(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values).to.have.length(4);
            expect(subscriberSnapshot.valuesFlushed).to.equal(0);

            plugin.flush();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            subscriberSnapshot = get(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values).to.have.length(keptValues);
            expect(subscriberSnapshot.valuesFlushed).to.equal(4 - keptValues);
        });

        it("should flush unsubscribed merges", () => {

            const subject = new Subject<number>();
            const outer = subject.tag("outer");
            const composed = outer.mergeMap((value) => Observable.of(value).tag("inner"));
            const subscription = composed.subscribe();

            let snapshot = plugin.snapshotAll();
            let outerSnapshot = snapshot.observables.get(outer)!;
            let outerSubscriber = get(outerSnapshot.subscribers, 0);
            let outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 0);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            outerSnapshot = snapshot.observables.get(outer)!;
            outerSubscriber = get(outerSnapshot.subscribers, 0);
            outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 1);

            plugin.flush();

            snapshot = plugin.snapshotAll();
            outerSnapshot = snapshot.observables.get(outer)!;
            outerSubscriber = get(outerSnapshot.subscribers, 0);
            outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 0);
        });
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

            const observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot).to.have.property("complete", false);
            expect(observableSnapshot).to.have.property("error", null);
            expect(observableSnapshot.subscribers).to.have.property("size", 1);
        });

        it("should clone the snapshot content", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            const snapshot1 = plugin.snapshotAll();
            expect(snapshot1.observables).to.have.property("size", 1);

            subscription.unsubscribe();

            const snapshot2 = plugin.snapshotAll();
            expect(snapshot2.observables).to.have.property("size", 1);
            expect(snapshot2.observables.get(subject)).to.not.equal(snapshot1.observables.get(subject));
        });

        it("should spy on unsubscriptions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscription.unsubscribe();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot.subscribers).to.have.property("size", 0);
        });

        it("should spy on completions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot).to.have.property("complete", false);

            subject.complete();

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot).to.have.property("complete", true);
        });

        it("should spy on errors", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot).to.have.property("error", null);

            const error = new Error("Boom!");
            subject.error(error);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot).to.have.property("error", error);
        });

        it("should spy on values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            let observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            let subscriberSnapshot = get(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values).to.deep.equal([]);

            subject.next(1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = get(observableSnapshot.subscribers, 0);
            expect(subscriberSnapshot.values.map((t) => t.value)).to.deep.equal([1]);

            subject.next(-1);

            snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 1);

            observableSnapshot = snapshot.observables.get(subject)!;
            expect(observableSnapshot.subscribers).to.have.property("size", 1);

            subscriberSnapshot = get(observableSnapshot.subscribers, 0);
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

        it("should spy on sources and destinations", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = snapshot.observables.get(subject)!;
            const mappedSnapshot = snapshot.observables.get(mapped)!;

            expect(subjectSnapshot).to.exist;
            expect(subjectSnapshot.destinations).to.have.property("size", 1);
            expect(get(subjectSnapshot.destinations, 0)).to.equal(mappedSnapshot);
            expect(subjectSnapshot.sources).to.have.property("size", 0);

            expect(mappedSnapshot).to.exist;
            expect(mappedSnapshot.destinations).to.have.property("size", 0);
            expect(mappedSnapshot.sources).to.have.property("size", 1);
            expect(get(mappedSnapshot.sources, 0)).to.equal(subjectSnapshot);
        });

        it("should spy on array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = snapshot.observables.get(subject1)!;
            const subject2Snapshot = snapshot.observables.get(subject2)!;
            const combinedSnapshot = snapshot.observables.get(combined)!;

            expect(subject1Snapshot).to.exist;
            expect(subject1Snapshot.sources).to.have.property("size", 0);

            expect(subject2Snapshot).to.exist;
            expect(subject2Snapshot.sources).to.have.property("size", 0);

            expect(combinedSnapshot).to.exist;
            expect(combinedSnapshot.sources).to.not.have.property("size", 0);
            expect(hasSource(combinedSnapshot, subject1)).to.be.true;
            expect(hasSource(combinedSnapshot, subject2)).to.be.true;
        });

        it("should spy on merges", () => {

            const subject = new Subject<number>();
            const outer = subject.tag("outer");
            const composed = outer.mergeMap((value) => Observable.of(value).tag("inner"));
            const subscription = composed.subscribe();

            let snapshot = plugin.snapshotAll();
            let outerSnapshot = snapshot.observables.get(outer)!;
            let outerSubscriber = get(outerSnapshot.subscribers, 0);
            let outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 0);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            outerSnapshot = snapshot.observables.get(outer)!;
            outerSubscriber = get(outerSnapshot.subscribers, 0);
            outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 1);

            subject.next(0);

            snapshot = plugin.snapshotAll();
            outerSnapshot = snapshot.observables.get(outer)!;
            outerSubscriber = get(outerSnapshot.subscribers, 0);
            outerSubscription = get(outerSubscriber.subscriptions, 0);

            expect(outerSubscription.merges).to.have.property("size", 2);
        });

        it("should determine a subscription's destination subscription", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshotAll();
            expect(snapshot.observables).to.have.property("size", 2);

            const subjectSnapshot = snapshot.observables.get(subject)!;
            const mappedSnapshot = snapshot.observables.get(mapped)!;

            expect(subjectSnapshot.subscribers).to.have.property("size", 1);
            expect(mappedSnapshot.subscribers).to.have.property("size", 1);

            const subjectSubscriber = get(subjectSnapshot.subscribers, 0);
            const mappedSubscriber = get(mappedSnapshot.subscribers, 0);

            expect(subjectSubscriber.subscriptions).to.have.property("size", 1);
            expect(mappedSubscriber.subscriptions).to.have.property("size", 1);

            const subjectSubscription = get(subjectSubscriber.subscriptions, 0);
            const mappedSubscription = get(mappedSubscriber.subscriptions, 0);

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
            expect(snapshot.observables).to.have.property("size", 3);

            const subjectSnapshot = snapshot.observables.get(subject)!;
            const mappedSnapshot = snapshot.observables.get(mapped)!;
            const remappedSnapshot = snapshot.observables.get(remapped)!;

            expect(subjectSnapshot.subscribers).to.have.property("size", 1);
            expect(mappedSnapshot.subscribers).to.have.property("size", 1);
            expect(remappedSnapshot.subscribers).to.have.property("size", 1);

            const subjectSubscriber = get(subjectSnapshot.subscribers, 0);
            const mappedSubscriber = get(mappedSnapshot.subscribers, 0);
            const remappedSubscriber = get(remappedSnapshot.subscribers, 0);

            expect(subjectSubscriber.subscriptions).to.have.property("size", 1);
            expect(mappedSubscriber.subscriptions).to.have.property("size", 1);
            expect(remappedSubscriber.subscriptions).to.have.property("size", 1);

            const subjectSubscription = get(subjectSubscriber.subscriptions, 0);
            const mappedSubscription = get(mappedSubscriber.subscriptions, 0);
            const remappedSubscription = get(remappedSubscriber.subscriptions, 0);

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
            expect(snapshot.observables).to.not.have.property("size", 0);

            const subject1Snapshot = snapshot.observables.get(subject1)!;
            const subject2Snapshot = snapshot.observables.get(subject2)!;
            const combinedSnapshot = snapshot.observables.get(combined)!;

            expect(subject1Snapshot.subscribers).to.have.property("size", 1);
            expect(subject2Snapshot.subscribers).to.have.property("size", 1);
            expect(combinedSnapshot.subscribers).to.have.property("size", 1);

            const subject1Subscriber = get(subject1Snapshot.subscribers, 0);
            const subject2Subscriber = get(subject2Snapshot.subscribers, 0);
            const combinedSubscriber = get(combinedSnapshot.subscribers, 0);

            expect(subject1Subscriber.subscriptions).to.have.property("size", 1);
            expect(subject2Subscriber.subscriptions).to.have.property("size", 1);
            expect(combinedSubscriber.subscriptions).to.have.property("size", 1);

            const subject1Subscription = get(subject1Subscriber.subscriptions, 0);
            const subject2Subscription = get(subject2Subscriber.subscriptions, 0);
            const combinedSubscription = get(combinedSubscriber.subscriptions, 0);

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
            expect(snapshot.observables).to.not.have.property("size", 0);

            const composed1Snapshot = snapshot.observables.get(composed1)!;
            const composed2Snapshot = snapshot.observables.get(composed2)!;
            const inner1Snapshot = snapshot.observables.get(innerSubject1)!;
            const inner2Snapshot = snapshot.observables.get(innerSubject2)!;

            expect(composed1Snapshot.subscribers).to.have.property("size", 1);
            expect(composed2Snapshot.subscribers).to.have.property("size", 1);
            expect(inner1Snapshot.subscribers).to.have.property("size", 1);
            expect(inner2Snapshot.subscribers).to.have.property("size", 1);

            const composed1Subscriber = get(composed1Snapshot.subscribers, 0);
            const composed2Subscriber = get(composed2Snapshot.subscribers, 0);
            const inner1Subscriber = get(inner1Snapshot.subscribers, 0);
            const inner2Subscriber = get(inner2Snapshot.subscribers, 0);

            expect(composed1Subscriber.subscriptions).to.have.property("size", 1);
            expect(composed2Subscriber.subscriptions).to.have.property("size", 1);
            expect(inner1Subscriber.subscriptions).to.have.property("size", 1);
            expect(inner2Subscriber.subscriptions).to.have.property("size", 1);

            const composed1Subscription = get(composed1Subscriber.subscriptions, 0);
            const composed2Subscription = get(composed2Subscriber.subscriptions, 0);
            const inner1Subscription = get(inner1Subscriber.subscriptions, 0);
            const inner2Subscription = get(inner2Subscriber.subscriptions, 0);

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
            expect(snapshot.observables).to.have.property("size", 1);
            expect(snapshot.subscribers).to.have.property("size", 1);
            expect(snapshot.subscriptions).to.have.property("size", 2);

            const sourceSnapshot = snapshot.observables.get(source)!;
            expect(sourceSnapshot.subscribers).to.have.property("size", 1);

            const sourceSubscriber = snapshot.subscribers.get(subscriber)!;
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
                subscription
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
                subscription
            });

            expect(subscriberSnapshot).to.exist;
            expect(subscriberSnapshot).to.have.property("subscriber", subscriber);
            expect(subscriberSnapshot).to.have.property("subscriptions");
        });
    });
});

function get<K, V>(map: Map<K, V>, index: number): V {

    return Array.from(map.values())[index];
}

function hasSource(observableSnapshot: ObservableSnapshot, source: Observable<any>): boolean {

    if (observableSnapshot.sources.has(source)) {
        return true;
    }
    let result = false;
    observableSnapshot.sources.forEach((o) => {
        if (hasSource(o, source)) {
            result = true;
        }
    });
    return result;
}
