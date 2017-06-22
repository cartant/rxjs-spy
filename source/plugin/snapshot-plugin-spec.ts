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
import { spy } from "../spy";
import { SnapshotObservable, SnapshotPlugin } from "./snapshot-plugin";

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
        teardown = spy({ plugins: [plugin] });
    });

    describe("flush", () => {

        it("should flush completed observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            subject.complete();
            plugin.flush({ completed: true });

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush only completed observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            subject.error(new Error("Boom!"));
            plugin.flush({ completed: true });

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);
        });

        it("should flush errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            subject.error(new Error("Boom!"));
            plugin.flush({ errored: true });

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush only errored observables", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            subject.complete();
            plugin.flush({ errored: true });

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);
        });

        it("should flush completed and errored observables by default", () => {

            const subject1 = new Subject<number>();
            const subscription1 = subject1.subscribe();

            const subject2 = new Subject<number>();
            const subscription2 = subject2.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(2);

            subject1.complete();
            subject2.error(new Error("Boom!"));
            plugin.flush();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(0);
        });

        it("should flush excess values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            subject.next(1);
            subject.next(2);
            subject.next(3);
            subject.next(4);

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            let snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.values).to.have.length(4);
            expect(snapshotObservable.valuesFlushed).to.equal(0);

            plugin.flush();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.values).to.have.length(2);
            expect(snapshotObservable.valuesFlushed).to.equal(2);
        });
    });

    describe("snapshot", () => {

        it("should spy on subscriptions", () => {

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(0);

            const subject = new Subject<number>();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(0);

            const subscription = subject.subscribe();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            const snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable).to.have.property("complete", false);
            expect(snapshotObservable).to.have.property("error", null);
            expect(snapshotObservable.subscriptions).to.have.length(1);
        });

        it("should clone the snapshot content", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            const snapshot1 = plugin.snapshot();
            expect(snapshot1.observables).to.have.length(1);

            subscription.unsubscribe();

            const snapshot2 = plugin.snapshot();
            expect(snapshot2.observables).to.have.length(1);
            expect(snapshot2.observables[0]).to.not.equal(snapshot1.observables[0]);
        });

        it("should spy on unsubscriptions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            let snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.subscriptions).to.have.length(1);

            subscription.unsubscribe();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.subscriptions).to.have.length(0);
        });

        it("should spy on completions", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            let snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable).to.have.property("complete", false);

            subject.complete();

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable).to.have.property("complete", true);
        });

        it("should spy on errors", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe((value) => {}, (error) => {});

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            let snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable).to.have.property("error", null);

            const error = new Error("Boom!");
            subject.error(error);

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable).to.have.property("error", error);
        });

        it("should spy on values", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            let snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.values).to.deep.equal([]);
            expect(snapshotObservable.subscriptions).to.have.length(1);

            let snapshotSubscription = snapshotObservable.subscriptions[0];
            expect(snapshotSubscription.values).to.deep.equal([]);

            subject.next(1);

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.values.map((t) => t.value)).to.deep.equal([1]);
            expect(snapshotObservable.subscriptions).to.have.length(1);

            snapshotSubscription = snapshotObservable.subscriptions[0];
            expect(snapshotSubscription.values.map((t) => t.value)).to.deep.equal([1]);

            subject.next(-1);

            snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(1);

            snapshotObservable = snapshot.observables[0];
            expect(snapshotObservable.values.map((t) => t.value)).to.deep.equal([1, -1]);
            expect(snapshotObservable.subscriptions).to.have.length(1);

            snapshotSubscription = snapshotObservable.subscriptions[0];
            expect(snapshotSubscription.values.map((t) => t.value)).to.deep.equal([1, -1]);
        });

        it("should spy on changes since the specified snapshot", () => {

            const subject = new Subject<number>();
            const subscription = subject.subscribe();

            let since = plugin.snapshot();
            expect(since.observables).to.have.length(1);

            let snapshot = plugin.snapshot({ since });
            expect(snapshot.observables).to.have.length(0);

            subject.next(1);

            snapshot = plugin.snapshot({ since });
            expect(snapshot.observables).to.have.length(1);
        });

        it("should support a filter", () => {

            const subject = new Subject<number>();
            const subscription = subject.tag("tagged").subscribe();

            let since = plugin.snapshot();
            expect(since.observables).to.have.length(2);

            let snapshot = plugin.snapshot({ filter: (o) => matches(o.observable, "tagged") });
            expect(snapshot.observables).to.have.length(1);

            snapshot = plugin.snapshot({ filter: (o) => o.subscriptions.some((s) => s.explicit) });
            expect(snapshot.observables).to.have.length(1);
        });

        it("should spy on dependents and dependencies", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(2);

            const snapshotSubject = snapshot.observables.find((o) => o.observable === subject);
            const snapshotMapper = snapshot.observables.find((o) => o.observable === mapped);

            expect(snapshotSubject).to.exist;
            expect(snapshotSubject!.dependencies).to.deep.equal([]);
            expect(snapshotSubject!.dependents).to.have.length(1);
            expect(snapshotSubject!.dependents[0]).to.equal(snapshotMapper);

            expect(snapshotMapper).to.exist;
            expect(snapshotMapper!.dependencies).to.have.length(1);
            expect(snapshotMapper!.dependencies[0]).to.equal(snapshotSubject);
            expect(snapshotMapper!.dependents).to.deep.equal([]);
        });

        it("should spy on array-based dependencies", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = Observable.combineLatest(subject1, subject2);
            const subscription = combined.subscribe();

            const snapshot = plugin.snapshot();
            expect(snapshot.observables).to.not.be.empty;

            const snapshotSubject1 = snapshot.observables.find((o) => o.observable === subject1);
            const snapshotSubject2 = snapshot.observables.find((o) => o.observable === subject2);
            const snapshotCombined = snapshot.observables.find((o) => o.observable === combined);

            expect(snapshotSubject1).to.exist;
            expect(snapshotSubject1!.dependencies).to.be.empty;

            expect(snapshotSubject2).to.exist;
            expect(snapshotSubject2!.dependencies).to.be.empty;

            expect(snapshotCombined).to.exist;
            expect(snapshotCombined!.dependencies).to.not.be.empty;
            expect(hasDependency(snapshotCombined!, snapshotSubject1!)).to.be.true;
            expect(hasDependency(snapshotCombined!, snapshotSubject2!)).to.be.true;

            function hasDependency(
                observable: SnapshotObservable,
                dependency: SnapshotObservable
            ): boolean {

                if (observable.dependencies.indexOf(dependency) !== -1) {
                    return true;
                }
                return observable.dependencies.some((o) => hasDependency(o, dependency));
            }
        });

        it("should spy on merges", () => {

            const subject = new Subject<number>();
            const outer = subject.tag("outer");
            const composed1 = outer.switchMap((value) => Observable.of(value).tag("inner1"));
            const composed2 = outer.switchMap((value) => Observable.of(value).tag("inner2"));
            const subscription1 = composed1.subscribe();
            const subscription2 = composed2.subscribe();

            let snapshot = plugin.snapshot();
            let snapshotOuter = snapshot.observables.find((o) => o.observable === outer);

            expect(snapshotOuter).to.exist;
            expect(snapshotOuter!.merges).to.be.empty;

            subject.next(1);

            snapshot = plugin.snapshot();
            snapshotOuter = snapshot.observables.find((o) => o.observable === outer);

            expect(snapshotOuter).to.exist;
            expect(snapshotOuter!.merges).to.have.length(2);
            expect(snapshotOuter!.merges.some((o) => o.tag === "inner1")).to.be.true;
            expect(snapshotOuter!.merges.some((o) => o.tag === "inner2")).to.be.true;
        });

        it("should indicate explicit subscriptions", () => {

            const subject = new Subject<number>();
            const mapped = subject.map((value) => value);
            const subscription = mapped.subscribe();

            const snapshot = plugin.snapshot();
            expect(snapshot.observables).to.have.length(2);

            const snapshotSubject = snapshot.observables.find((o) => o.observable === subject);
            const snapshotMapper = snapshot.observables.find((o) => o.observable === mapped);

            expect(snapshotMapper!.subscriptions).to.have.length(1);
            expect(snapshotMapper!.subscriptions[0]).to.have.property("explicit", true);

            expect(snapshotSubject!.subscriptions).to.have.length(1);
            expect(snapshotSubject!.subscriptions[0]).to.have.property("explicit", false);
        });
    });
});
