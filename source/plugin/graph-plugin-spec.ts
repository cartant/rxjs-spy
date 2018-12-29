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
import { GraphPlugin, GraphRecord } from "./graph-plugin";
import { SubscriptionRecordsPlugin } from "./subscription-records-plugin";

describe("GraphPlugin", () => {

    describe("flushing", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

        function delay(duration: number): Promise<void> {
            const buffer = 50;
            return new Promise(resolve => setTimeout(resolve, duration + buffer));
        }

        function test(duration: number): void {

            beforeEach(() => {

                spy = create({ defaultPlugins: false, warning: false });
                graphPlugin = new GraphPlugin({ keptDuration: duration, spy });
                subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ spy });
                spy.plug(graphPlugin, subscriptionRecordsPlugin);
            });

            it("should flush completed root subscriptions", () => {

                const subject = new Subject<number>();
                subject.subscribe();

                const { sentinel } = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(subject));
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

                const { sentinel } = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(subject));
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

                const { sentinel } = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(subject));
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

                const sourceGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(source1));
                const sinkGraphRecord = graphPlugin.getGraphRecord(sourceGraphRecord.sink!);
                const { sentinel } = sourceGraphRecord;

                expect(sinkGraphRecord.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.complete();
                source2.complete();

                if (duration === 0) {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                });
            });

            it("should flush errored source subscriptions", () => {

                const source1 = new Subject<number>();
                const source2 = new Subject<number>();
                const combined = combineLatest(source1, source2);
                combined.subscribe(() => {}, () => {});

                const sourceGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(source1));
                const sinkGraphRecord = graphPlugin.getGraphRecord(sourceGraphRecord.sink!);
                const { sentinel } = sourceGraphRecord;

                expect(sinkGraphRecord.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphRecord.sources).to.have.length(0);
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

                const innerGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(inner));
                const sinkGraphRecord = graphPlugin.getGraphRecord(innerGraphRecord.sink!);

                expect(sinkGraphRecord.flats).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphRecord.flats).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRecord.flats).to.have.length(0));
            });

            it("should flush errored flat subscriptions", () => {

                const subject = new Subject<number>();
                const inner = new Subject<number>();
                const outer = subject.pipe(tag("outer"));
                const composed = outer.pipe(mergeMap(value => inner));
                composed.subscribe(() => {}, () => {});

                subject.next(0);

                const innerGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(inner));
                const sinkGraphRecord = graphPlugin.getGraphRecord(innerGraphRecord.sink!);

                expect(sinkGraphRecord.flats).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRecord.flats).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRecord.flats).to.have.length(0));
            });

            it("should flush completed custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(inner));
                const sinkGraphRecord = graphPlugin.getGraphRecord(innerGraphRecord.sink!);

                expect(sinkGraphRecord.sources).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRecord.sources).to.have.length(0));
            });

            it("should flush errored custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe(() => {}, () => {});

                const innerGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(inner));
                const sinkGraphRecord = graphPlugin.getGraphRecord(innerGraphRecord.sink!);

                expect(sinkGraphRecord.sources).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRecord.sources).to.have.length(0));
            });

            it("should flush explicitly unsubscribed custom source subscriptions", () => {

                const inner = new Subject<number>();
                let innerSubscription: Subscription = undefined!;
                const custom = new Observable<number>(observer => {
                    innerSubscription = inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphRecord = graphPlugin.getGraphRecord(subscriptionRecordsPlugin.getSubscription(inner));
                const sinkGraphRecord = graphPlugin.getGraphRecord(innerGraphRecord.sink!);

                expect(sinkGraphRecord.sources).to.have.length(1);

                innerSubscription.unsubscribe();

                if (duration === 0) {
                    expect(sinkGraphRecord.sources).to.have.length(0);
                } else {
                    expect(sinkGraphRecord.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphRecord.sources).to.have.length(0));
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
        let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionRecordsPlugin);
        });

        it("should graph sources and sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject);
            const mappedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(mapped);

            const subjectGraphRecord = graphPlugin.getGraphRecord(subjectSubscriptionRecord);
            const mappedGraphRecord = graphPlugin.getGraphRecord(mappedSubscriptionRecord);

            expect(subjectGraphRecord).to.exist;
            expect(subjectGraphRecord).to.have.property("sink", mappedSubscriptionRecord);
            expect(subjectGraphRecord).to.have.property("sources");
            expect(subjectGraphRecord.sources).to.deep.equal([]);

            expect(mappedGraphRecord).to.exist;
            expect(mappedGraphRecord).to.have.property("sink", undefined);
            expect(mappedGraphRecord).to.have.property("sources");
            expect(mappedGraphRecord.sources).to.deep.equal([subjectSubscriptionRecord]);
        });

        it("should graph array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject1);
            const subject2SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject2);
            const combinedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(combined);

            const subject1GraphRecord = graphPlugin.getGraphRecord(subject1SubscriptionRecord);
            const subject2GraphRecord = graphPlugin.getGraphRecord(subject2SubscriptionRecord);
            const combinedGraphRecord = graphPlugin.getGraphRecord(combinedSubscriptionRecord);

            expect(subject1GraphRecord).to.exist;
            expect(subject1GraphRecord).to.have.property("sources");
            expect(subject1GraphRecord.sources).to.deep.equal([]);
            expect(hasSink(subject1GraphRecord, combinedSubscriptionRecord)).to.be.true;

            expect(subject2GraphRecord).to.exist;
            expect(subject2GraphRecord).to.have.property("sources");
            expect(subject2GraphRecord.sources).to.deep.equal([]);
            expect(hasSink(subject2GraphRecord, combinedSubscriptionRecord)).to.be.true;

            expect(combinedGraphRecord).to.exist;
            expect(combinedGraphRecord).to.have.property("sink", undefined);
            expect(combinedGraphRecord).to.have.property("sources");
            expect(combinedGraphRecord.sources).to.not.be.empty;
            expect(hasSource(combinedGraphRecord, subject1SubscriptionRecord)).to.be.true;
            expect(hasSource(combinedGraphRecord, subject2SubscriptionRecord)).to.be.true;
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

            const subjectSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject);
            const outerSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(outer);
            const composedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(composed);

            const outerGraphRecord = graphPlugin.getGraphRecord(outerSubscriptionRecord);
            expect(outerGraphRecord).to.have.property("sink", composedSubscriptionRecord);
            expect(outerGraphRecord).to.have.property("sources");
            expect(outerGraphRecord.sources).to.not.be.empty;
            expect(hasSource(outerGraphRecord, subjectSubscriptionRecord)).to.be.true;

            const composedGraphRecord = graphPlugin.getGraphRecord(composedSubscriptionRecord);
            expect(composedGraphRecord).to.have.property("sink", undefined);
            expect(composedGraphRecord).to.have.property("sources");
            expect(composedGraphRecord.flats).to.be.empty;
            expect(composedGraphRecord.sources).to.not.be.empty;
            expect(hasSource(composedGraphRecord, subjectSubscriptionRecord)).to.be.true;
            expect(hasSource(composedGraphRecord, outerSubscriptionRecord)).to.be.true;

            subject.next(0);

            expect(composedGraphRecord.flats).to.not.be.empty;
            expect(composedGraphRecord.flats).to.contain(subscriptionRecordsPlugin.getSubscription(merges[0]));

            subject.next(1);

            expect(composedGraphRecord.flats).to.not.be.empty;
            expect(composedGraphRecord.flats).to.contain(subscriptionRecordsPlugin.getSubscription(merges[0]));
            expect(composedGraphRecord.flats).to.contain(subscriptionRecordsPlugin.getSubscription(merges[1]));
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

            const inner1SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(inner1);
            const inner2SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(inner2);
            const customSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(custom);

            const inner1GraphRecord = graphPlugin.getGraphRecord(inner1SubscriptionRecord);
            const inner2GraphRecord = graphPlugin.getGraphRecord(inner2SubscriptionRecord);
            const customGraphRecord = graphPlugin.getGraphRecord(customSubscriptionRecord);

            expect(inner1GraphRecord).to.exist;
            expect(inner1GraphRecord).to.have.property("sources");
            expect(inner1GraphRecord.sources).to.deep.equal([]);
            expect(hasSink(inner1GraphRecord, customSubscriptionRecord)).to.be.true;

            expect(inner2GraphRecord).to.exist;
            expect(inner2GraphRecord).to.have.property("sources");
            expect(inner2GraphRecord.sources).to.deep.equal([]);
            expect(hasSink(inner2GraphRecord, customSubscriptionRecord)).to.be.true;

            expect(customGraphRecord).to.exist;
            expect(customGraphRecord).to.have.property("sink", undefined);
            expect(customGraphRecord).to.have.property("sources");
            expect(customGraphRecord.sources).to.not.be.empty;
            expect(hasSource(customGraphRecord, inner1SubscriptionRecord)).to.be.true;
            expect(hasSource(customGraphRecord, inner2SubscriptionRecord)).to.be.true;
        });

        it("should determine sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject);
            const mappedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(mapped);

            const subjectGraphRecord = graphPlugin.getGraphRecord(subjectSubscriptionRecord);
            const mappedGraphRecord = graphPlugin.getGraphRecord(mappedSubscriptionRecord);

            expect(subjectGraphRecord).to.have.property("sink", mappedSubscriptionRecord);
            expect(subjectGraphRecord).to.have.property("rootSink", mappedSubscriptionRecord);
            expect(mappedGraphRecord).to.have.property("sink", undefined);
            expect(mappedGraphRecord).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            const remapped = mapped.pipe(map(value => value));
            remapped.subscribe();

            const subjectSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject);
            const mappedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(mapped);
            const remappedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(remapped);

            const subjectGraphRecord = graphPlugin.getGraphRecord(subjectSubscriptionRecord);
            const mappedGraphRecord = graphPlugin.getGraphRecord(mappedSubscriptionRecord);
            const remappedGraphRecord = graphPlugin.getGraphRecord(remappedSubscriptionRecord);

            expect(subjectGraphRecord).to.have.property("sink", mappedSubscriptionRecord);
            expect(subjectGraphRecord).to.have.property("rootSink", remappedSubscriptionRecord);
            expect(mappedGraphRecord).to.have.property("sink", remappedSubscriptionRecord);
            expect(mappedGraphRecord).to.have.property("rootSink", remappedSubscriptionRecord);
            expect(remappedGraphRecord).to.have.property("sink", undefined);
            expect(remappedGraphRecord).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject1);
            const subject2SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject2);
            const combinedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(combined);

            const subject1GraphRecord = graphPlugin.getGraphRecord(subject1SubscriptionRecord);
            const subject2GraphRecord = graphPlugin.getGraphRecord(subject2SubscriptionRecord);
            const combinedGraphRecord = graphPlugin.getGraphRecord(combinedSubscriptionRecord);

            expect(subject1GraphRecord).to.have.property("sink");
            expect(subject1GraphRecord).to.have.property("rootSink", combinedSubscriptionRecord);
            expect(subject2GraphRecord).to.have.property("sink");
            expect(subject2GraphRecord).to.have.property("rootSink", combinedSubscriptionRecord);
            expect(combinedGraphRecord).to.have.property("sink", undefined);
            expect(combinedGraphRecord).to.have.property("rootSink", undefined);
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

            const innerSubject1SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(innerSubject1);
            const innerSubject2SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(innerSubject2);
            const composed1SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(composed1);
            const composed2SubscriptionRecord = subscriptionRecordsPlugin.getSubscription(composed2);

            const innerSubject1GraphRecord = graphPlugin.getGraphRecord(innerSubject1SubscriptionRecord);
            const innerSubject2GraphRecord = graphPlugin.getGraphRecord(innerSubject2SubscriptionRecord);

            expect(innerSubject1GraphRecord).to.have.property("sink");
            expect(innerSubject1GraphRecord).to.have.property("rootSink", composed1SubscriptionRecord);
            expect(innerSubject2GraphRecord).to.have.property("sink");
            expect(innerSubject2GraphRecord).to.have.property("rootSink", composed2SubscriptionRecord);
        });

        it("should determine the depth", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(subject);
            const mappedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(mapped);

            const subjectGraphRecord = graphPlugin.getGraphRecord(subjectSubscriptionRecord);
            const mappedGraphRecord = graphPlugin.getGraphRecord(mappedSubscriptionRecord);

            expect(subjectGraphRecord).to.exist;
            expect(subjectGraphRecord).to.have.property("depth", 2);

            expect(mappedGraphRecord).to.exist;
            expect(mappedGraphRecord).to.have.property("depth", 1);
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

            const composedSubscriptionRecord = subscriptionRecordsPlugin.getSubscription(composed);
            const composedGraphRecord = graphPlugin.getGraphRecord(composedSubscriptionRecord);
            expect(composedGraphRecord).to.have.property("flattened", false);

            subject.next(0);

            let flattenedSubscriptionRecord = composedGraphRecord.flats[0];
            let flattenedGraphRecord = graphPlugin.getGraphRecord(flattenedSubscriptionRecord);
            expect(flattenedGraphRecord).to.have.property("flattened", true);

            subject.next(1);

            flattenedSubscriptionRecord = composedGraphRecord.flats[1];
            flattenedGraphRecord = graphPlugin.getGraphRecord(flattenedSubscriptionRecord);
            expect(flattenedGraphRecord).to.have.property("flattened", true);
        });

        afterEach(() => {

            if (spy) {
                spy.teardown();
            }
        });

        function hasSink(graphRecord: GraphRecord, sink: Subscription): boolean {

            if (graphRecord.sink === undefined) {
                return false;
            } else if (graphRecord.sink === sink) {
                return true;
            }
            return hasSink(graphPlugin.getGraphRecord(graphRecord.sink), sink);
        }

        function hasSource(graphRecord: GraphRecord, source: Subscription): boolean {

            if (graphRecord.sources.indexOf(source as Subscription) !== -1) {
                return true;
            }
            return graphRecord.sources.some(s => hasSource(graphPlugin.getGraphRecord(s), source));
        }
    });

    describe("methods", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionRecordsPlugin: SubscriptionRecordsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionRecordsPlugin = new SubscriptionRecordsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionRecordsPlugin);
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

                const filteredSubscription = subscriptionRecordsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionRecordsPlugin.getSubscription(mapped);

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

                const filteredSubscription = subscriptionRecordsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionRecordsPlugin.getSubscription(mapped);
                const subjectSubscription = subscriptionRecordsPlugin.getSubscription(subject);

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
