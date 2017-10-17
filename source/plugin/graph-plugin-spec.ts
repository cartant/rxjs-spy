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
import { getGraphRef, GraphPlugin, GraphRef } from "./graph-plugin";
import { BasePlugin, SubscriberRef, SubscriptionRef } from "./plugin";
import { SubscriberRefsPlugin } from "./subscriber-refs-plugin";
import { spy } from "../spy";

import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/of";
import "rxjs/add/operator/map";
import "rxjs/add/operator/mergeMap";
import "rxjs/add/operator/switchMap";
import "../add/operator/tag";

describe("GraphPlugin", () => {

    let graphPlugin: GraphPlugin;
    let subscriberRefsPlugin: SubscriberRefsPlugin;
    let teardown: () => void;

    afterEach(() => {

        if (teardown) {
            teardown();
        }
    });

    beforeEach(() => {

        graphPlugin = new GraphPlugin();
        subscriberRefsPlugin = new SubscriberRefsPlugin();
        teardown = spy({ plugins: [graphPlugin, subscriberRefsPlugin], warning: false });
    });

    it("should graph sources and destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriberRef = subscriberRefsPlugin.get(subject);
        const mappedSubscriberRef = subscriberRefsPlugin.get(mapped);

        const subjectGraphRef = getGraphRef(subjectSubscriberRef);
        const mappedGraphRef = getGraphRef(mappedSubscriberRef);

        expect(subjectGraphRef).to.exist;
        expect(subjectGraphRef).to.have.property("destination", mappedSubscriberRef);
        expect(subjectGraphRef).to.have.property("sources");
        expect(subjectGraphRef.sources).to.deep.equal([]);

        expect(mappedGraphRef).to.exist;
        expect(mappedGraphRef).to.have.property("destination", null);
        expect(mappedGraphRef).to.have.property("sources");
        expect(mappedGraphRef.sources).to.deep.equal([subjectSubscriberRef]);
    });

    it("should graph array-based sources", () => {

        const subject1 = new Subject<number>();
        const subject2 = new Subject<number>();
        const combined = Observable.combineLatest(subject1, subject2);
        const subscription = combined.subscribe();

        const subject1SubscriberRef = subscriberRefsPlugin.get(subject1);
        const subject2SubscriberRef = subscriberRefsPlugin.get(subject2);
        const combinedSubscriberRef = subscriberRefsPlugin.get(combined);

        const subject1GraphRef = getGraphRef(subject1SubscriberRef);
        const subject2GraphRef = getGraphRef(subject2SubscriberRef);
        const combinedGraphRef = getGraphRef(combinedSubscriberRef);

        expect(subject1GraphRef).to.exist;
        expect(subject1GraphRef).to.have.property("sources");
        expect(subject1GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(subject1GraphRef, combinedSubscriberRef)).to.be.true;

        expect(subject2GraphRef).to.exist;
        expect(subject2GraphRef).to.have.property("sources");
        expect(subject2GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(subject2GraphRef, combinedSubscriberRef)).to.be.true;

        expect(combinedGraphRef).to.exist;
        expect(combinedGraphRef).to.have.property("destination", null);
        expect(combinedGraphRef).to.have.property("sources");
        expect(combinedGraphRef.sources).to.not.be.empty;
        expect(hasSource(combinedGraphRef, subject1SubscriberRef)).to.be.true;
        expect(hasSource(combinedGraphRef, subject2SubscriberRef)).to.be.true;
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

        const subjectSubscriberRef = subscriberRefsPlugin.get(subject);
        const outerSubscriberRef = subscriberRefsPlugin.get(outer);
        const composedSubscriberRef = subscriberRefsPlugin.get(composed);

        const outerGraphRef = getGraphRef(outerSubscriberRef);
        expect(outerGraphRef).to.have.property("destination", composedSubscriberRef);
        expect(outerGraphRef).to.have.property("sources");
        expect(outerGraphRef.merges).to.be.empty;
        expect(outerGraphRef.sources).to.not.be.empty;
        expect(hasSource(outerGraphRef, subjectSubscriberRef)).to.be.true;

        const composedGraphRef = getGraphRef(composedSubscriberRef);
        expect(composedGraphRef).to.have.property("destination", null);
        expect(composedGraphRef).to.have.property("sources");
        expect(composedGraphRef.sources).to.not.be.empty;
        expect(hasSource(composedGraphRef, subjectSubscriberRef)).to.be.true;
        expect(hasSource(composedGraphRef, outerSubscriberRef)).to.be.true;

        subject.next(0);

        expect(outerGraphRef.merges).to.not.be.empty;
        expect(outerGraphRef.merges).to.contain(subscriberRefsPlugin.get(merges[0]));

        subject.next(1);

        expect(outerGraphRef.merges).to.not.be.empty;
        expect(outerGraphRef.merges).to.contain(subscriberRefsPlugin.get(merges[0]));
        expect(outerGraphRef.merges).to.contain(subscriberRefsPlugin.get(merges[1]));
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

        const inner1SubscriberRef = subscriberRefsPlugin.get(inner1);
        const inner2SubscriberRef = subscriberRefsPlugin.get(inner2);
        const customSubscriberRef = subscriberRefsPlugin.get(custom);

        const inner1GraphRef = getGraphRef(inner1SubscriberRef);
        const inner2GraphRef = getGraphRef(inner2SubscriberRef);
        const customGraphRef = getGraphRef(customSubscriberRef);

        expect(inner1GraphRef).to.exist;
        expect(inner1GraphRef).to.have.property("sources");
        expect(inner1GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(inner1GraphRef, customSubscriberRef)).to.be.true;

        expect(inner2GraphRef).to.exist;
        expect(inner2GraphRef).to.have.property("sources");
        expect(inner2GraphRef.sources).to.deep.equal([]);
        expect(hasDestination(inner2GraphRef, customSubscriberRef)).to.be.true;

        expect(customGraphRef).to.exist;
        expect(customGraphRef).to.have.property("destination", null);
        expect(customGraphRef).to.have.property("sources");
        expect(customGraphRef.sources).to.not.be.empty;
        expect(hasSource(customGraphRef, inner1SubscriberRef)).to.be.true;
        expect(hasSource(customGraphRef, inner2SubscriberRef)).to.be.true;
    });

    it("should determine destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const subscription = mapped.subscribe();

        const subjectSubscriberRef = subscriberRefsPlugin.get(subject);
        const mappedSubscriberRef = subscriberRefsPlugin.get(mapped);

        const subjectGraphRef = getGraphRef(subjectSubscriberRef);
        const mappedGraphRef = getGraphRef(mappedSubscriberRef);

        expect(subjectGraphRef).to.have.property("destination", mappedSubscriberRef);
        expect(subjectGraphRef).to.have.property("rootDestination", mappedSubscriberRef);
        expect(mappedGraphRef).to.have.property("destination", null);
        expect(mappedGraphRef).to.have.property("rootDestination", null);
    });

    it("should determine root destinations", () => {

        const subject = new Subject<number>();
        const mapped = subject.map((value) => value);
        const remapped = mapped.map((value) => value);
        const subscription = remapped.subscribe();

        const subjectSubscriberRef = subscriberRefsPlugin.get(subject);
        const mappedSubscriberRef = subscriberRefsPlugin.get(mapped);
        const remappedSubscriberRef = subscriberRefsPlugin.get(remapped);

        const subjectGraphRef = getGraphRef(subjectSubscriberRef);
        const mappedGraphRef = getGraphRef(mappedSubscriberRef);
        const remappedGraphRef = getGraphRef(remappedSubscriberRef);

        expect(subjectGraphRef).to.have.property("destination", mappedSubscriberRef);
        expect(subjectGraphRef).to.have.property("rootDestination", remappedSubscriberRef);
        expect(mappedGraphRef).to.have.property("destination", remappedSubscriberRef);
        expect(mappedGraphRef).to.have.property("rootDestination", remappedSubscriberRef);
        expect(remappedGraphRef).to.have.property("destination", null);
        expect(remappedGraphRef).to.have.property("rootDestination", null);
    });

    it("should determine root destinations for array-based sources", () => {

        const subject1 = new Subject<number>();
        const subject2 = new Subject<number>();
        const combined = Observable.combineLatest(subject1, subject2);
        const subscription = combined.subscribe();

        const subject1SubscriberRef = subscriberRefsPlugin.get(subject1);
        const subject2SubscriberRef = subscriberRefsPlugin.get(subject2);
        const combinedSubscriberRef = subscriberRefsPlugin.get(combined);

        const subject1GraphRef = getGraphRef(subject1SubscriberRef);
        const subject2GraphRef = getGraphRef(subject2SubscriberRef);
        const combinedGraphRef = getGraphRef(combinedSubscriberRef);

        expect(subject1GraphRef).to.have.property("destination");
        expect(subject1GraphRef).to.have.property("rootDestination", combinedSubscriberRef);
        expect(subject2GraphRef).to.have.property("destination");
        expect(subject2GraphRef).to.have.property("rootDestination", combinedSubscriberRef);
        expect(combinedGraphRef).to.have.property("destination", null);
        expect(combinedGraphRef).to.have.property("rootDestination", null);
    });

    it("should determine root destinations for merges", () => {

        const outerSubject = new Subject<number>();
        const innerSubject1 = new Subject<number>();
        const innerSubject2 = new Subject<number>();
        const composed1 = outerSubject.switchMap((value) => innerSubject1);
        const composed2 = outerSubject.switchMap((value) => innerSubject2);
        const subscription1 = composed1.subscribe();
        const subscription2 = composed2.subscribe();

        outerSubject.next(0);

        const innerSubject1SubscriberRef = subscriberRefsPlugin.get(innerSubject1);
        const innerSubject2SubscriberRef = subscriberRefsPlugin.get(innerSubject2);
        const composed1SubscriberRef = subscriberRefsPlugin.get(composed1);
        const composed2SubscriberRef = subscriberRefsPlugin.get(composed2);

        const innerSubject1GraphRef = getGraphRef(innerSubject1SubscriberRef);
        const innerSubject2GraphRef = getGraphRef(innerSubject2SubscriberRef);

        expect(innerSubject1GraphRef).to.have.property("destination");
        expect(innerSubject1GraphRef).to.have.property("rootDestination", composed1SubscriberRef);
        expect(innerSubject2GraphRef).to.have.property("destination");
        expect(innerSubject2GraphRef).to.have.property("rootDestination", composed2SubscriberRef);
    });
});

function hasDestination(graphRef: GraphRef, destinationRef: SubscriberRef): boolean {

    if (graphRef.destination === null) {
        return false;
    } else if (graphRef.destination === destinationRef) {
        return true;
    }
    return hasDestination(getGraphRef(graphRef.destination), destinationRef);
}

function hasSource(graphRef: GraphRef, sourceRef: SubscriberRef): boolean {

    if (graphRef.sources.indexOf(sourceRef as SubscriptionRef) !== -1) {
        return true;
    }
    return graphRef.sources.some((s) => hasSource(getGraphRef(s), sourceRef));
}
