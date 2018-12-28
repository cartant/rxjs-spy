/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { combineLatest, NEVER, Observable, Subject, Subscription } from "rxjs";
import { filter, map, mergeMap, switchMap, tap } from "rxjs/operators";
import { identify } from "../identify";
import { tag } from "../operators";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { GraphPlugin, GraphRef } from "./graph-plugin";
import { SubscriptionRefsPlugin } from "./subscription-refs-plugin";

describe("GraphPlugin", () => {

    describe("flushing", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionRefsPlugin: SubscriptionRefsPlugin;

        function delay(duration: number): Promise<void> {
            const buffer = 50;
            return new Promise(resolve => setTimeout(resolve, duration + buffer));
        }

        function test(duration: number): void {

            beforeEach(() => {

                spy = create({ defaultPlugins: false, warning: false });
                graphPlugin = new GraphPlugin({ keptDuration: duration, spy });
                subscriptionRefsPlugin = new SubscriptionRefsPlugin({ spy });
                spy.plug(graphPlugin, subscriptionRefsPlugin);
            });

            it("should flush completed root subscriptions", () => {

                const subject = new Subject<number>();
                subject.subscribe();

                const { sentinel } = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(subject));
                expect(sentinel.sources).to.have.length(1);

                subject.complete();

                if (duration === 0) {
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sentinel.sources).to.have.length(0));
            });

            it("should flush errored root subscriptions", () => {

                const subject = new Subject<number>();
                subject.subscribe(() => {}, () => {});

                const { sentinel } = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(subject));
                expect(sentinel.sources).to.have.length(1);

                subject.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sentinel.sources).to.have.length(0));
            });

            it("should flush explicitly unsubscribed root subscriptions", () => {

                const subject = new Subject<number>();
                const subscription = subject.subscribe();

                const { sentinel } = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(subject));
                expect(sentinel.sources).to.have.length(1);

                subscription.unsubscribe();

                if (duration === 0) {
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sentinel.sources).to.have.length(0));
            });

            it("should flush completed source subscriptions", () => {

                const source1 = new Subject<number>();
                const source2 = new Subject<number>();
                const combined = combineLatest(source1, source2);
                combined.subscribe();

                const sourceGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(source1));
                const sinkGraphRef = graphPlugin.getGraphRef(sourceGraphRef.sink!);
                const { sentinel } = sourceGraphRef;

                expect(sinkGraphRef.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.complete();
                source2.complete();

                if (duration === 0) {
                    expect(sinkGraphRef.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRef.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphRef.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                });
            });

            it("should flush errored source subscriptions", () => {

                const source1 = new Subject<number>();
                const source2 = new Subject<number>();
                const combined = combineLatest(source1, source2);
                combined.subscribe(() => {}, () => {});

                const sourceGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(source1));
                const sinkGraphRef = graphPlugin.getGraphRef(sourceGraphRef.sink!);
                const { sentinel } = sourceGraphRef;

                expect(sinkGraphRef.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRef.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRef.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphRef.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                });
            });

            it("should flush completed flat subscriptions", () => {

                const subject = new Subject<number>();
                const inner = new Subject<number>();
                const outer = subject.pipe(tag("outer"));
                const composed = outer.pipe(mergeMap(value => inner));
                composed.subscribe();

                subject.next(0);

                const innerGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(inner));
                const sinkGraphRef = graphPlugin.getGraphRef(innerGraphRef.sink!);

                expect(sinkGraphRef.flats).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphRef.flats).to.have.length(0);
                } else {
                    expect(sinkGraphRef.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRef.flats).to.have.length(0));
            });

            it("should flush errored flat subscriptions", () => {

                const subject = new Subject<number>();
                const inner = new Subject<number>();
                const outer = subject.pipe(tag("outer"));
                const composed = outer.pipe(mergeMap(value => inner));
                composed.subscribe(() => {}, () => {});

                subject.next(0);

                const innerGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(inner));
                const sinkGraphRef = graphPlugin.getGraphRef(innerGraphRef.sink!);

                expect(sinkGraphRef.flats).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRef.flats).to.have.length(0);
                } else {
                    expect(sinkGraphRef.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRef.flats).to.have.length(0));
            });

            it("should flush completed custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(inner));
                const sinkGraphRef = graphPlugin.getGraphRef(innerGraphRef.sink!);

                expect(sinkGraphRef.sources).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphRef.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRef.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRef.sources).to.have.length(0));
            });

            it("should flush errored custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe(() => {}, () => {});

                const innerGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(inner));
                const sinkGraphRef = graphPlugin.getGraphRef(innerGraphRef.sink!);

                expect(sinkGraphRef.sources).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRef.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRef.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRef.sources).to.have.length(0));
            });

            it("should flush explicitly unsubscribed custom source subscriptions", () => {

                const inner = new Subject<number>();
                let innerSubscription: Subscription = undefined!;
                const custom = new Observable<number>(observer => {
                    innerSubscription = inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphRef = graphPlugin.getGraphRef(subscriptionRefsPlugin.getSubscription(inner));
                const sinkGraphRef = graphPlugin.getGraphRef(innerGraphRef.sink!);

                expect(sinkGraphRef.sources).to.have.length(1);

                innerSubscription.unsubscribe();

                if (duration === 0) {
                    expect(sinkGraphRef.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRef.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRef.sources).to.have.length(0));
            });

            afterEach(() => {

                if (spy) {
                    spy.teardown();
                }
            });
        }

        describe("with zero duration", () => {

            test(0);
        });

        describe("with 10 ms duration", () => {

            test(10);
        });
    });

    describe("graphing", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionRefsPlugin: SubscriptionRefsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionRefsPlugin = new SubscriptionRefsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionRefsPlugin);
        });

        it("should graph sources and sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRef = subscriptionRefsPlugin.getSubscription(subject);
            const mappedSubscriptionRef = subscriptionRefsPlugin.getSubscription(mapped);

            const subjectGraphRef = graphPlugin.getGraphRef(subjectSubscriptionRef);
            const mappedGraphRef = graphPlugin.getGraphRef(mappedSubscriptionRef);

            expect(subjectGraphRef).to.exist;
            expect(subjectGraphRef).to.have.property("sink", mappedSubscriptionRef);
            expect(subjectGraphRef).to.have.property("sources");
            expect(subjectGraphRef.sources).to.deep.equal([]);

            expect(mappedGraphRef).to.exist;
            expect(mappedGraphRef).to.have.property("sink", undefined);
            expect(mappedGraphRef).to.have.property("sources");
            expect(mappedGraphRef.sources).to.deep.equal([subjectSubscriptionRef]);
        });

        it("should graph array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionRef = subscriptionRefsPlugin.getSubscription(subject1);
            const subject2SubscriptionRef = subscriptionRefsPlugin.getSubscription(subject2);
            const combinedSubscriptionRef = subscriptionRefsPlugin.getSubscription(combined);

            const subject1GraphRef = graphPlugin.getGraphRef(subject1SubscriptionRef);
            const subject2GraphRef = graphPlugin.getGraphRef(subject2SubscriptionRef);
            const combinedGraphRef = graphPlugin.getGraphRef(combinedSubscriptionRef);

            expect(subject1GraphRef).to.exist;
            expect(subject1GraphRef).to.have.property("sources");
            expect(subject1GraphRef.sources).to.deep.equal([]);
            expect(hasSink(subject1GraphRef, combinedSubscriptionRef)).to.be.true;

            expect(subject2GraphRef).to.exist;
            expect(subject2GraphRef).to.have.property("sources");
            expect(subject2GraphRef.sources).to.deep.equal([]);
            expect(hasSink(subject2GraphRef, combinedSubscriptionRef)).to.be.true;

            expect(combinedGraphRef).to.exist;
            expect(combinedGraphRef).to.have.property("sink", undefined);
            expect(combinedGraphRef).to.have.property("sources");
            expect(combinedGraphRef.sources).to.not.be.empty;
            expect(hasSource(combinedGraphRef, subject1SubscriptionRef)).to.be.true;
            expect(hasSource(combinedGraphRef, subject2SubscriptionRef)).to.be.true;
        });

        it("should graph flats", () => {

            const subject = new Subject<number>();
            const outer = subject.pipe(tag("outer"));
            const merges: Observable<number>[] = [];
            const composed = outer.pipe(mergeMap(value => {
                const m = NEVER.pipe(tag("inner"));
                merges.push(m);
                return m;
            }));
            composed.subscribe();

            const subjectSubscriptionRef = subscriptionRefsPlugin.getSubscription(subject);
            const outerSubscriptionRef = subscriptionRefsPlugin.getSubscription(outer);
            const composedSubscriptionRef = subscriptionRefsPlugin.getSubscription(composed);

            const outerGraphRef = graphPlugin.getGraphRef(outerSubscriptionRef);
            expect(outerGraphRef).to.have.property("sink", composedSubscriptionRef);
            expect(outerGraphRef).to.have.property("sources");
            expect(outerGraphRef.sources).to.not.be.empty;
            expect(hasSource(outerGraphRef, subjectSubscriptionRef)).to.be.true;

            const composedGraphRef = graphPlugin.getGraphRef(composedSubscriptionRef);
            expect(composedGraphRef).to.have.property("sink", undefined);
            expect(composedGraphRef).to.have.property("sources");
            expect(composedGraphRef.flats).to.be.empty;
            expect(composedGraphRef.sources).to.not.be.empty;
            expect(hasSource(composedGraphRef, subjectSubscriptionRef)).to.be.true;
            expect(hasSource(composedGraphRef, outerSubscriptionRef)).to.be.true;

            subject.next(0);

            expect(composedGraphRef.flats).to.not.be.empty;
            expect(composedGraphRef.flats).to.contain(subscriptionRefsPlugin.getSubscription(merges[0]));

            subject.next(1);

            expect(composedGraphRef.flats).to.not.be.empty;
            expect(composedGraphRef.flats).to.contain(subscriptionRefsPlugin.getSubscription(merges[0]));
            expect(composedGraphRef.flats).to.contain(subscriptionRefsPlugin.getSubscription(merges[1]));
        });

        it("should graph custom observables", () => {

            const inner1 = NEVER;
            const inner2 = NEVER;

            const custom = new Observable<number>(observer => {

                inner1.subscribe(observer);
                inner2.subscribe(observer);

                return () => {};
            });
            custom.subscribe();

            const inner1SubscriptionRef = subscriptionRefsPlugin.getSubscription(inner1);
            const inner2SubscriptionRef = subscriptionRefsPlugin.getSubscription(inner2);
            const customSubscriptionRef = subscriptionRefsPlugin.getSubscription(custom);

            const inner1GraphRef = graphPlugin.getGraphRef(inner1SubscriptionRef);
            const inner2GraphRef = graphPlugin.getGraphRef(inner2SubscriptionRef);
            const customGraphRef = graphPlugin.getGraphRef(customSubscriptionRef);

            expect(inner1GraphRef).to.exist;
            expect(inner1GraphRef).to.have.property("sources");
            expect(inner1GraphRef.sources).to.deep.equal([]);
            expect(hasSink(inner1GraphRef, customSubscriptionRef)).to.be.true;

            expect(inner2GraphRef).to.exist;
            expect(inner2GraphRef).to.have.property("sources");
            expect(inner2GraphRef.sources).to.deep.equal([]);
            expect(hasSink(inner2GraphRef, customSubscriptionRef)).to.be.true;

            expect(customGraphRef).to.exist;
            expect(customGraphRef).to.have.property("sink", undefined);
            expect(customGraphRef).to.have.property("sources");
            expect(customGraphRef.sources).to.not.be.empty;
            expect(hasSource(customGraphRef, inner1SubscriptionRef)).to.be.true;
            expect(hasSource(customGraphRef, inner2SubscriptionRef)).to.be.true;
        });

        it("should determine sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRef = subscriptionRefsPlugin.getSubscription(subject);
            const mappedSubscriptionRef = subscriptionRefsPlugin.getSubscription(mapped);

            const subjectGraphRef = graphPlugin.getGraphRef(subjectSubscriptionRef);
            const mappedGraphRef = graphPlugin.getGraphRef(mappedSubscriptionRef);

            expect(subjectGraphRef).to.have.property("sink", mappedSubscriptionRef);
            expect(subjectGraphRef).to.have.property("rootSink", mappedSubscriptionRef);
            expect(mappedGraphRef).to.have.property("sink", undefined);
            expect(mappedGraphRef).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            const remapped = mapped.pipe(map(value => value));
            remapped.subscribe();

            const subjectSubscriptionRef = subscriptionRefsPlugin.getSubscription(subject);
            const mappedSubscriptionRef = subscriptionRefsPlugin.getSubscription(mapped);
            const remappedSubscriptionRef = subscriptionRefsPlugin.getSubscription(remapped);

            const subjectGraphRef = graphPlugin.getGraphRef(subjectSubscriptionRef);
            const mappedGraphRef = graphPlugin.getGraphRef(mappedSubscriptionRef);
            const remappedGraphRef = graphPlugin.getGraphRef(remappedSubscriptionRef);

            expect(subjectGraphRef).to.have.property("sink", mappedSubscriptionRef);
            expect(subjectGraphRef).to.have.property("rootSink", remappedSubscriptionRef);
            expect(mappedGraphRef).to.have.property("sink", remappedSubscriptionRef);
            expect(mappedGraphRef).to.have.property("rootSink", remappedSubscriptionRef);
            expect(remappedGraphRef).to.have.property("sink", undefined);
            expect(remappedGraphRef).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionRef = subscriptionRefsPlugin.getSubscription(subject1);
            const subject2SubscriptionRef = subscriptionRefsPlugin.getSubscription(subject2);
            const combinedSubscriptionRef = subscriptionRefsPlugin.getSubscription(combined);

            const subject1GraphRef = graphPlugin.getGraphRef(subject1SubscriptionRef);
            const subject2GraphRef = graphPlugin.getGraphRef(subject2SubscriptionRef);
            const combinedGraphRef = graphPlugin.getGraphRef(combinedSubscriptionRef);

            expect(subject1GraphRef).to.have.property("sink");
            expect(subject1GraphRef).to.have.property("rootSink", combinedSubscriptionRef);
            expect(subject2GraphRef).to.have.property("sink");
            expect(subject2GraphRef).to.have.property("rootSink", combinedSubscriptionRef);
            expect(combinedGraphRef).to.have.property("sink", undefined);
            expect(combinedGraphRef).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for flats", () => {

            const outerSubject = new Subject<number>();
            const innerSubject1 = new Subject<number>();
            const innerSubject2 = new Subject<number>();
            const composed1 = outerSubject.pipe(switchMap(value => innerSubject1));
            const composed2 = outerSubject.pipe(switchMap(value => innerSubject2));
            composed1.subscribe();
            composed2.subscribe();

            outerSubject.next(0);

            const innerSubject1SubscriptionRef = subscriptionRefsPlugin.getSubscription(innerSubject1);
            const innerSubject2SubscriptionRef = subscriptionRefsPlugin.getSubscription(innerSubject2);
            const composed1SubscriptionRef = subscriptionRefsPlugin.getSubscription(composed1);
            const composed2SubscriptionRef = subscriptionRefsPlugin.getSubscription(composed2);

            const innerSubject1GraphRef = graphPlugin.getGraphRef(innerSubject1SubscriptionRef);
            const innerSubject2GraphRef = graphPlugin.getGraphRef(innerSubject2SubscriptionRef);

            expect(innerSubject1GraphRef).to.have.property("sink");
            expect(innerSubject1GraphRef).to.have.property("rootSink", composed1SubscriptionRef);
            expect(innerSubject2GraphRef).to.have.property("sink");
            expect(innerSubject2GraphRef).to.have.property("rootSink", composed2SubscriptionRef);
        });

        it("should determine the depth", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRef = subscriptionRefsPlugin.getSubscription(subject);
            const mappedSubscriptionRef = subscriptionRefsPlugin.getSubscription(mapped);

            const subjectGraphRef = graphPlugin.getGraphRef(subjectSubscriptionRef);
            const mappedGraphRef = graphPlugin.getGraphRef(mappedSubscriptionRef);

            expect(subjectGraphRef).to.exist;
            expect(subjectGraphRef).to.have.property("depth", 2);

            expect(mappedGraphRef).to.exist;
            expect(mappedGraphRef).to.have.property("depth", 1);
        });

        it("should indicate flattened subscriptions", () => {

            const subject = new Subject<number>();
            const outer = subject.pipe(tag("outer"));
            const merges: Observable<number>[] = [];
            const composed = outer.pipe(mergeMap(value => {
                const m = NEVER.pipe(tag("inner"));
                merges.push(m);
                return m;
            }));
            composed.subscribe();

            const composedSubscriptionRef = subscriptionRefsPlugin.getSubscription(composed);
            const composedGraphRef = graphPlugin.getGraphRef(composedSubscriptionRef);
            expect(composedGraphRef).to.have.property("flattened", false);

            subject.next(0);

            let flattenedSubscriptionRef = composedGraphRef.flats[0];
            let flattenedGraphRef = graphPlugin.getGraphRef(flattenedSubscriptionRef);
            expect(flattenedGraphRef).to.have.property("flattened", true);

            subject.next(1);

            flattenedSubscriptionRef = composedGraphRef.flats[1];
            flattenedGraphRef = graphPlugin.getGraphRef(flattenedSubscriptionRef);
            expect(flattenedGraphRef).to.have.property("flattened", true);
        });

        afterEach(() => {

            if (spy) {
                spy.teardown();
            }
        });

        function hasSink(graphRef: GraphRef, sink: Subscription): boolean {

            if (graphRef.sink === undefined) {
                return false;
            } else if (graphRef.sink === sink) {
                return true;
            }
            return hasSink(graphPlugin.getGraphRef(graphRef.sink), sink);
        }

        function hasSource(graphRef: GraphRef, source: Subscription): boolean {

            if (graphRef.sources.indexOf(source as Subscription) !== -1) {
                return true;
            }
            return graphRef.sources.some(s => hasSource(graphPlugin.getGraphRef(s), source));
        }
    });

    describe("methods", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionRefsPlugin: SubscriptionRefsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionRefsPlugin = new SubscriptionRefsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionRefsPlugin);
        });

        describe("findRootSubscriptions", () => {

            it("should should return the root subscriptions", () => {

                const subject = new Subject<number>();
                const filtered = subject.pipe(
                    tap(() => {}),
                    filter(Boolean)
                );
                const mapped = subject.pipe(
                    tap(() => {}),
                    map(value => value)
                );
                filtered.subscribe();
                mapped.subscribe();

                const filteredSubscription = subscriptionRefsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionRefsPlugin.getSubscription(mapped);

                const rootSubscriptions = graphPlugin.findRootSubscriptions();
                expect(rootSubscriptions).to.have.length(2);
                expect(rootSubscriptions).to.contain(filteredSubscription);
                expect(rootSubscriptions).to.contain(mappedSubscription);
            });
        });

        describe("findSubscription", () => {

            it("should return the matched subscription", () => {

                const subject = new Subject<number>();
                const filtered = subject.pipe(
                    filter(Boolean)
                );
                const mapped = filtered.pipe(
                    map(value => value)
                );
                mapped.subscribe();

                const filteredSubscription = subscriptionRefsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionRefsPlugin.getSubscription(mapped);
                const subjectSubscription = subscriptionRefsPlugin.getSubscription(subject);

                expect(
                    graphPlugin.findSubscription(
                        identify(filteredSubscription)
                    )
                ).to.equal(filteredSubscription);
                expect(
                    graphPlugin.findSubscription(
                        identify(mappedSubscription)
                    )
                ).to.equal(mappedSubscription);
                expect(
                    graphPlugin.findSubscription(
                        identify(subjectSubscription)
                    )
                ).to.equal(subjectSubscription);
                expect(
                    graphPlugin.findSubscription("missing")
                ).to.be.undefined;
            });
        });

        afterEach(() => {

            if (spy) {
                spy.teardown();
            }
        });
    });
});
