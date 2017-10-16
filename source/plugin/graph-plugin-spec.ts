/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Observer } from "rxjs/Observer";
import { Subject } from "rxjs/Subject";
import { get as getGraphRef, GraphPlugin, GraphRef } from "./graph-plugin";
import { BasePlugin, SubscriptionRef } from "./plugin";
import { spy } from "../spy";

import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/switchMap";
import "../add/operator/tag";

describe("GraphPlugin", () => {

    let plugin: GraphPlugin;
    let subscriptionRefs: Map<Observable<any>, SubscriptionRef>;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        class SubscriptionRefsPlugin extends BasePlugin {
            beforeSubscribe(ref: SubscriptionRef): void { subscriptionRefs.set(ref.observable, ref); }
        }
        subscriptionRefs = new Map<Observable<any>, SubscriptionRef>();

        plugin = new GraphPlugin();
        teardown = spy({ plugins: [plugin, new SubscriptionRefsPlugin()], warning: false });
    });

    it("should graph sources and destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriptionRef = subscriptionRefs.get(subject)!;
        const mappedSubscriptionRef = subscriptionRefs.get(mapped)!;

        const subjectGraphRef = getGraphRef(subjectSubscriptionRef);
        const mappedGraphRef = getGraphRef(mappedSubscriptionRef);

        expect(subjectGraphRef).to.exist;
        expect(subjectGraphRef).to.have.property("destination", mappedSubscriptionRef);
        expect(subjectGraphRef).to.have.property("sources");
        expect(subjectGraphRef.sources).to.deep.equal([]);

        expect(mappedGraphRef).to.exist;
        expect(mappedGraphRef).to.have.property("destination", null);
        expect(mappedGraphRef).to.have.property("sources");
        expect(mappedGraphRef.sources).to.deep.equal([subjectSubscriptionRef]);
    });

    it("should graph array-based sources", () => {

        const subject1 = new Subject<number>();
        const subject2 = new Subject<number>();
        const combined = Observable.combineLatest(subject1, subject2);
        const subscription = combined.subscribe();

        const subject1SubscriptionRef = subscriptionRefs.get(subject1)!;
        const subject2SubscriptionRef = subscriptionRefs.get(subject2)!;
        const combinedSubscriptionRef = subscriptionRefs.get(combined)!;

        const subject1GraphRef = getGraphRef(subject1SubscriptionRef);
        const subject2GraphRef = getGraphRef(subject2SubscriptionRef);
        const combinedGraphRef = getGraphRef(combinedSubscriptionRef);

        expect(subject1GraphRef).to.exist;
        expect(subject1GraphRef).to.have.property("sources");
        expect(subject1GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(subject1GraphRef, combinedSubscriptionRef)).to.be.true;

        expect(subject2GraphRef).to.exist;
        expect(subject2GraphRef).to.have.property("sources");
        expect(subject2GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(subject2GraphRef, combinedSubscriptionRef)).to.be.true;

        expect(combinedGraphRef).to.exist;
        expect(combinedGraphRef).to.have.property("destination", null);
        expect(combinedGraphRef).to.have.property("sources");
        expect(combinedGraphRef.sources).to.not.be.empty;
        expect(hasSource(combinedGraphRef, subject1SubscriptionRef)).to.be.true;
        expect(hasSource(combinedGraphRef, subject2SubscriptionRef)).to.be.true;
    });

    it("should graph merges", () => {

        const subject = new Subject<number>();
        const outer = subject.tag("outer");
        const merges: Observable<number>[] = [];
        const composed = outer.mergeMap((value) => {
            const m = Observable.of(value).tag("inner");
            merges.push(m);
            return m;
        });
        const subscription = composed.subscribe();

        const subjectSubscriptionRef = subscriptionRefs.get(subject)!;
        const outerSubscriptionRef = subscriptionRefs.get(outer)!;
        const composedSubscriptionRef = subscriptionRefs.get(composed)!;

        const composedGraphRef = getGraphRef(composedSubscriptionRef);
        expect(composedGraphRef).to.have.property("destination", null);
        expect(composedGraphRef).to.have.property("sources");
        expect(composedGraphRef.sources).to.not.be.empty;
        expect(hasSource(composedGraphRef, subjectSubscriptionRef)).to.be.true;
        expect(hasSource(composedGraphRef, outerSubscriptionRef)).to.be.true;
        expect(hasNoMerges(composedGraphRef)).to.be.true;

        subject.next(0);

        expect(hasNoMerges(composedGraphRef)).to.be.false;
        expect(hasMerge(composedGraphRef, subscriptionRefs.get(merges[0])!)).to.be.true;

        subject.next(1);

        expect(hasNoMerges(composedGraphRef)).to.be.false;
        expect(hasMerge(composedGraphRef, subscriptionRefs.get(merges[0])!)).to.be.true;
        expect(hasMerge(composedGraphRef, subscriptionRefs.get(merges[1])!)).to.be.true;
    });

    it("should graph custom observables", () => {

        const inner1 = Observable.of(1);
        const inner2 = Observable.of(2);

        const custom = Observable.create((observer: Observer<number>) => {

            inner1.subscribe(observer);
            inner2.subscribe(observer);

            return () => {};
        });
        const subscription = custom.subscribe();

        const inner1SubscriptionRef = subscriptionRefs.get(inner1)!;
        const inner2SubscriptionRef = subscriptionRefs.get(inner2)!;
        const customSubscriptionRef = subscriptionRefs.get(custom)!;

        const inner1GraphRef = getGraphRef(inner1SubscriptionRef);
        const inner2GraphRef = getGraphRef(inner2SubscriptionRef);
        const customGraphRef = getGraphRef(customSubscriptionRef);

        expect(inner1GraphRef).to.exist;
        expect(inner1GraphRef).to.have.property("sources");
        expect(inner1GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(inner1GraphRef, customSubscriptionRef)).to.be.true;

        expect(inner2GraphRef).to.exist;
        expect(inner2GraphRef).to.have.property("sources");
        expect(inner2GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(inner2GraphRef, customSubscriptionRef)).to.be.true;

        expect(customGraphRef).to.exist;
        expect(customGraphRef).to.have.property("destination", null);
        expect(customGraphRef).to.have.property("sources");
        expect(customGraphRef.sources).to.not.be.empty;
        expect(hasSource(customGraphRef, inner1SubscriptionRef)).to.be.true;
        expect(hasSource(customGraphRef, inner2SubscriptionRef)).to.be.true;
    });

    it("should determine destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriptionRef = subscriptionRefs.get(subject)!;
        const mappedSubscriptionRef = subscriptionRefs.get(mapped)!;

        const subjectGraphRef = getGraphRef(subjectSubscriptionRef);
        const mappedGraphRef = getGraphRef(mappedSubscriptionRef);

        expect(subjectGraphRef).to.have.property("destination", mappedSubscriptionRef);
        expect(subjectGraphRef).to.have.property("finalDestination", mappedSubscriptionRef);
        expect(mappedGraphRef).to.have.property("destination", null);
        expect(mappedGraphRef).to.have.property("finalDestination", null);
    });

    it("should determine final destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const remapped = mapped.map((value) => value);
        const subscription = remapped.subscribe();

        const subjectSubscriptionRef = subscriptionRefs.get(subject)!;
        const mappedSubscriptionRef = subscriptionRefs.get(mapped)!;
        const remappedSubscriptionRef = subscriptionRefs.get(remapped)!;

        const subjectGraphRef = getGraphRef(subjectSubscriptionRef);
        const mappedGraphRef = getGraphRef(mappedSubscriptionRef);
        const remappedGraphRef = getGraphRef(remappedSubscriptionRef);

        expect(subjectGraphRef).to.have.property("destination", mappedSubscriptionRef);
        expect(subjectGraphRef).to.have.property("finalDestination", remappedSubscriptionRef);
        expect(mappedGraphRef).to.have.property("destination", remappedSubscriptionRef);
        expect(mappedGraphRef).to.have.property("finalDestination", remappedSubscriptionRef);
        expect(remappedGraphRef).to.have.property("destination", null);
        expect(remappedGraphRef).to.have.property("finalDestination", null);
    });

    it("should determine final destinations for array-based sources", () => {

        const subject1 = new Subject<number>();
        const subject2 = new Subject<number>();
        const combined = Observable.combineLatest(subject1, subject2);
        const subscription = combined.subscribe();

        const subject1SubscriptionRef = subscriptionRefs.get(subject1)!;
        const subject2SubscriptionRef = subscriptionRefs.get(subject2)!;
        const combinedSubscriptionRef = subscriptionRefs.get(combined)!;

        const subject1GraphRef = getGraphRef(subject1SubscriptionRef);
        const subject2GraphRef = getGraphRef(subject2SubscriptionRef);
        const combinedGraphRef = getGraphRef(combinedSubscriptionRef);

        expect(subject1GraphRef).to.have.property("destination");
        expect(subject1GraphRef).to.have.property("finalDestination", combinedSubscriptionRef);
        expect(subject2GraphRef).to.have.property("destination");
        expect(subject2GraphRef).to.have.property("finalDestination", combinedSubscriptionRef);
        expect(combinedGraphRef).to.have.property("destination", null);
        expect(combinedGraphRef).to.have.property("finalDestination", null);
    });

    it("should determine final destinations for merges", () => {

        const outerSubject = new Subject<number>();
        const innerSubject1 = new Subject<number>();
        const innerSubject2 = new Subject<number>();
        const composed1 = outerSubject.switchMap((value) => innerSubject1);
        const composed2 = outerSubject.switchMap((value) => innerSubject2);
        const subscription1 = composed1.subscribe();
        const subscription2 = composed2.subscribe();

        outerSubject.next(0);

        const innerSubject1SubscriptionRef = subscriptionRefs.get(innerSubject1)!;
        const innerSubject2SubscriptionRef = subscriptionRefs.get(innerSubject2)!;
        const composed1SubscriptionRef = subscriptionRefs.get(composed1)!;
        const composed2SubscriptionRef = subscriptionRefs.get(composed2)!;

        const innerSubject1GraphRef = getGraphRef(innerSubject1SubscriptionRef);
        const innerSubject2GraphRef = getGraphRef(innerSubject2SubscriptionRef);

        expect(innerSubject1GraphRef).to.have.property("destination");
        expect(innerSubject1GraphRef).to.have.property("finalDestination", composed1SubscriptionRef);
        expect(innerSubject2GraphRef).to.have.property("destination");
        expect(innerSubject2GraphRef).to.have.property("finalDestination", composed2SubscriptionRef);
    });
});

function hasDestination(graphRef: GraphRef, destinationRef: SubscriptionRef): boolean {

    if (graphRef.destination === null) {
        return false;
    } else if (graphRef.destination === destinationRef) {
        return true;
    }
    return hasDestination(getGraphRef(graphRef.destination), destinationRef);
}

function hasMerge(graphRef: GraphRef, mergeRef: SubscriptionRef): boolean {

    if (graphRef.merges.indexOf(mergeRef) !== -1) {
        return true;
    }
    return graphRef.sources.some((s) => hasMerge(getGraphRef(s), mergeRef));
}

function hasNoMerges(graphRef: GraphRef): boolean {

    if (graphRef.merges.length > 0) {
        return false;
    }
    return graphRef.sources.every((s) => hasNoMerges(getGraphRef(s)));
}

function hasSource(graphRef: GraphRef, sourceRef: SubscriptionRef): boolean {

    if (graphRef.sources.indexOf(sourceRef) !== -1) {
        return true;
    }
    return graphRef.sources.some((s) => hasSource(getGraphRef(s), sourceRef));
}
