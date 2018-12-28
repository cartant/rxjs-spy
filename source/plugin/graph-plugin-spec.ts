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
import { GraphLabel, GraphPlugin } from "./graph-plugin";
import { SubscriptionLabelsPlugin } from "./subscription-labels-plugin";

describe("GraphPlugin", () => {

    describe("flushing", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionLabelsPlugin: SubscriptionLabelsPlugin;

        function delay(duration: number): Promise<void> {
            const buffer = 50;
            return new Promise(resolve => setTimeout(resolve, duration + buffer));
        }

        function test(duration: number): void {

            beforeEach(() => {

                spy = create({ defaultPlugins: false, warning: false });
                graphPlugin = new GraphPlugin({ keptDuration: duration, spy });
                subscriptionLabelsPlugin = new SubscriptionLabelsPlugin({ spy });
                spy.plug(graphPlugin, subscriptionLabelsPlugin);
            });

            it("should flush completed root subscriptions", () => {

                const subject = new Subject<number>();
                subject.subscribe();

                const { sentinel } = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(subject));
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

                const { sentinel } = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(subject));
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

                const { sentinel } = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(subject));
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

                const sourceGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(source1));
                const sinkGraphLabel = graphPlugin.getGraphLabel(sourceGraphLabel.sink!);
                const { sentinel } = sourceGraphLabel;

                expect(sinkGraphLabel.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.complete();
                source2.complete();

                if (duration === 0) {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                });
            });

            it("should flush errored source subscriptions", () => {

                const source1 = new Subject<number>();
                const source2 = new Subject<number>();
                const combined = combineLatest(source1, source2);
                combined.subscribe(() => {}, () => {});

                const sourceGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(source1));
                const sinkGraphLabel = graphPlugin.getGraphLabel(sourceGraphLabel.sink!);
                const { sentinel } = sourceGraphLabel;

                expect(sinkGraphLabel.sources).to.have.length(2);
                expect(sentinel.sources).to.have.length(1);

                source1.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                    expect(sentinel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.sources).to.have.length(2);
                    expect(sentinel.sources).to.have.length(1);
                }
                return delay(duration).then(() => {
                    expect(sinkGraphLabel.sources).to.have.length(0);
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

                const innerGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(inner));
                const sinkGraphLabel = graphPlugin.getGraphLabel(innerGraphLabel.sink!);

                expect(sinkGraphLabel.flats).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphLabel.flats).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphLabel.flats).to.have.length(0));
            });

            it("should flush errored flat subscriptions", () => {

                const subject = new Subject<number>();
                const inner = new Subject<number>();
                const outer = subject.pipe(tag("outer"));
                const composed = outer.pipe(mergeMap(value => inner));
                composed.subscribe(() => {}, () => {});

                subject.next(0);

                const innerGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(inner));
                const sinkGraphLabel = graphPlugin.getGraphLabel(innerGraphLabel.sink!);

                expect(sinkGraphLabel.flats).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphLabel.flats).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.flats).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphLabel.flats).to.have.length(0));
            });

            it("should flush completed custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(inner));
                const sinkGraphLabel = graphPlugin.getGraphLabel(innerGraphLabel.sink!);

                expect(sinkGraphLabel.sources).to.have.length(1);

                inner.complete();

                if (duration === 0) {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphLabel.sources).to.have.length(0));
            });

            it("should flush errored custom source subscriptions", () => {

                const inner = new Subject<number>();
                const custom = new Observable<number>(observer => {
                    inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe(() => {}, () => {});

                const innerGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(inner));
                const sinkGraphLabel = graphPlugin.getGraphLabel(innerGraphLabel.sink!);

                expect(sinkGraphLabel.sources).to.have.length(1);

                inner.error(new Error("Boom!"));

                if (duration === 0) {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphLabel.sources).to.have.length(0));
            });

            it("should flush explicitly unsubscribed custom source subscriptions", () => {

                const inner = new Subject<number>();
                let innerSubscription: Subscription = undefined!;
                const custom = new Observable<number>(observer => {
                    innerSubscription = inner.subscribe(observer);
                    return () => {};
                });
                custom.subscribe();

                const innerGraphLabel = graphPlugin.getGraphLabel(subscriptionLabelsPlugin.getSubscription(inner));
                const sinkGraphLabel = graphPlugin.getGraphLabel(innerGraphLabel.sink!);

                expect(sinkGraphLabel.sources).to.have.length(1);

                innerSubscription.unsubscribe();

                if (duration === 0) {
                    expect(sinkGraphLabel.sources).to.have.length(0);
                } else {
                    expect(sinkGraphLabel.sources).to.have.length(1);
                }
                return delay(duration).then(() => expect(sinkGraphLabel.sources).to.have.length(0));
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
        let subscriptionLabelsPlugin: SubscriptionLabelsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionLabelsPlugin = new SubscriptionLabelsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionLabelsPlugin);
        });

        it("should graph sources and sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject);
            const mappedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(mapped);

            const subjectGraphLabel = graphPlugin.getGraphLabel(subjectSubscriptionLabel);
            const mappedGraphLabel = graphPlugin.getGraphLabel(mappedSubscriptionLabel);

            expect(subjectGraphLabel).to.exist;
            expect(subjectGraphLabel).to.have.property("sink", mappedSubscriptionLabel);
            expect(subjectGraphLabel).to.have.property("sources");
            expect(subjectGraphLabel.sources).to.deep.equal([]);

            expect(mappedGraphLabel).to.exist;
            expect(mappedGraphLabel).to.have.property("sink", undefined);
            expect(mappedGraphLabel).to.have.property("sources");
            expect(mappedGraphLabel.sources).to.deep.equal([subjectSubscriptionLabel]);
        });

        it("should graph array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject1);
            const subject2SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject2);
            const combinedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(combined);

            const subject1GraphLabel = graphPlugin.getGraphLabel(subject1SubscriptionLabel);
            const subject2GraphLabel = graphPlugin.getGraphLabel(subject2SubscriptionLabel);
            const combinedGraphLabel = graphPlugin.getGraphLabel(combinedSubscriptionLabel);

            expect(subject1GraphLabel).to.exist;
            expect(subject1GraphLabel).to.have.property("sources");
            expect(subject1GraphLabel.sources).to.deep.equal([]);
            expect(hasSink(subject1GraphLabel, combinedSubscriptionLabel)).to.be.true;

            expect(subject2GraphLabel).to.exist;
            expect(subject2GraphLabel).to.have.property("sources");
            expect(subject2GraphLabel.sources).to.deep.equal([]);
            expect(hasSink(subject2GraphLabel, combinedSubscriptionLabel)).to.be.true;

            expect(combinedGraphLabel).to.exist;
            expect(combinedGraphLabel).to.have.property("sink", undefined);
            expect(combinedGraphLabel).to.have.property("sources");
            expect(combinedGraphLabel.sources).to.not.be.empty;
            expect(hasSource(combinedGraphLabel, subject1SubscriptionLabel)).to.be.true;
            expect(hasSource(combinedGraphLabel, subject2SubscriptionLabel)).to.be.true;
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

            const subjectSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject);
            const outerSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(outer);
            const composedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(composed);

            const outerGraphLabel = graphPlugin.getGraphLabel(outerSubscriptionLabel);
            expect(outerGraphLabel).to.have.property("sink", composedSubscriptionLabel);
            expect(outerGraphLabel).to.have.property("sources");
            expect(outerGraphLabel.sources).to.not.be.empty;
            expect(hasSource(outerGraphLabel, subjectSubscriptionLabel)).to.be.true;

            const composedGraphLabel = graphPlugin.getGraphLabel(composedSubscriptionLabel);
            expect(composedGraphLabel).to.have.property("sink", undefined);
            expect(composedGraphLabel).to.have.property("sources");
            expect(composedGraphLabel.flats).to.be.empty;
            expect(composedGraphLabel.sources).to.not.be.empty;
            expect(hasSource(composedGraphLabel, subjectSubscriptionLabel)).to.be.true;
            expect(hasSource(composedGraphLabel, outerSubscriptionLabel)).to.be.true;

            subject.next(0);

            expect(composedGraphLabel.flats).to.not.be.empty;
            expect(composedGraphLabel.flats).to.contain(subscriptionLabelsPlugin.getSubscription(merges[0]));

            subject.next(1);

            expect(composedGraphLabel.flats).to.not.be.empty;
            expect(composedGraphLabel.flats).to.contain(subscriptionLabelsPlugin.getSubscription(merges[0]));
            expect(composedGraphLabel.flats).to.contain(subscriptionLabelsPlugin.getSubscription(merges[1]));
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

            const inner1SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(inner1);
            const inner2SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(inner2);
            const customSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(custom);

            const inner1GraphLabel = graphPlugin.getGraphLabel(inner1SubscriptionLabel);
            const inner2GraphLabel = graphPlugin.getGraphLabel(inner2SubscriptionLabel);
            const customGraphLabel = graphPlugin.getGraphLabel(customSubscriptionLabel);

            expect(inner1GraphLabel).to.exist;
            expect(inner1GraphLabel).to.have.property("sources");
            expect(inner1GraphLabel.sources).to.deep.equal([]);
            expect(hasSink(inner1GraphLabel, customSubscriptionLabel)).to.be.true;

            expect(inner2GraphLabel).to.exist;
            expect(inner2GraphLabel).to.have.property("sources");
            expect(inner2GraphLabel.sources).to.deep.equal([]);
            expect(hasSink(inner2GraphLabel, customSubscriptionLabel)).to.be.true;

            expect(customGraphLabel).to.exist;
            expect(customGraphLabel).to.have.property("sink", undefined);
            expect(customGraphLabel).to.have.property("sources");
            expect(customGraphLabel.sources).to.not.be.empty;
            expect(hasSource(customGraphLabel, inner1SubscriptionLabel)).to.be.true;
            expect(hasSource(customGraphLabel, inner2SubscriptionLabel)).to.be.true;
        });

        it("should determine sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject);
            const mappedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(mapped);

            const subjectGraphLabel = graphPlugin.getGraphLabel(subjectSubscriptionLabel);
            const mappedGraphLabel = graphPlugin.getGraphLabel(mappedSubscriptionLabel);

            expect(subjectGraphLabel).to.have.property("sink", mappedSubscriptionLabel);
            expect(subjectGraphLabel).to.have.property("rootSink", mappedSubscriptionLabel);
            expect(mappedGraphLabel).to.have.property("sink", undefined);
            expect(mappedGraphLabel).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            const remapped = mapped.pipe(map(value => value));
            remapped.subscribe();

            const subjectSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject);
            const mappedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(mapped);
            const remappedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(remapped);

            const subjectGraphLabel = graphPlugin.getGraphLabel(subjectSubscriptionLabel);
            const mappedGraphLabel = graphPlugin.getGraphLabel(mappedSubscriptionLabel);
            const remappedGraphLabel = graphPlugin.getGraphLabel(remappedSubscriptionLabel);

            expect(subjectGraphLabel).to.have.property("sink", mappedSubscriptionLabel);
            expect(subjectGraphLabel).to.have.property("rootSink", remappedSubscriptionLabel);
            expect(mappedGraphLabel).to.have.property("sink", remappedSubscriptionLabel);
            expect(mappedGraphLabel).to.have.property("rootSink", remappedSubscriptionLabel);
            expect(remappedGraphLabel).to.have.property("sink", undefined);
            expect(remappedGraphLabel).to.have.property("rootSink", undefined);
        });

        it("should determine root sinks for array-based sources", () => {

            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            const combined = combineLatest(subject1, subject2);
            combined.subscribe();

            const subject1SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject1);
            const subject2SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject2);
            const combinedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(combined);

            const subject1GraphLabel = graphPlugin.getGraphLabel(subject1SubscriptionLabel);
            const subject2GraphLabel = graphPlugin.getGraphLabel(subject2SubscriptionLabel);
            const combinedGraphLabel = graphPlugin.getGraphLabel(combinedSubscriptionLabel);

            expect(subject1GraphLabel).to.have.property("sink");
            expect(subject1GraphLabel).to.have.property("rootSink", combinedSubscriptionLabel);
            expect(subject2GraphLabel).to.have.property("sink");
            expect(subject2GraphLabel).to.have.property("rootSink", combinedSubscriptionLabel);
            expect(combinedGraphLabel).to.have.property("sink", undefined);
            expect(combinedGraphLabel).to.have.property("rootSink", undefined);
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

            const innerSubject1SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(innerSubject1);
            const innerSubject2SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(innerSubject2);
            const composed1SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(composed1);
            const composed2SubscriptionLabel = subscriptionLabelsPlugin.getSubscription(composed2);

            const innerSubject1GraphLabel = graphPlugin.getGraphLabel(innerSubject1SubscriptionLabel);
            const innerSubject2GraphLabel = graphPlugin.getGraphLabel(innerSubject2SubscriptionLabel);

            expect(innerSubject1GraphLabel).to.have.property("sink");
            expect(innerSubject1GraphLabel).to.have.property("rootSink", composed1SubscriptionLabel);
            expect(innerSubject2GraphLabel).to.have.property("sink");
            expect(innerSubject2GraphLabel).to.have.property("rootSink", composed2SubscriptionLabel);
        });

        it("should determine the depth", () => {

            const subject = new Subject<number>();
            const mapped = subject.pipe(map(value => value));
            mapped.subscribe();

            const subjectSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(subject);
            const mappedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(mapped);

            const subjectGraphLabel = graphPlugin.getGraphLabel(subjectSubscriptionLabel);
            const mappedGraphLabel = graphPlugin.getGraphLabel(mappedSubscriptionLabel);

            expect(subjectGraphLabel).to.exist;
            expect(subjectGraphLabel).to.have.property("depth", 2);

            expect(mappedGraphLabel).to.exist;
            expect(mappedGraphLabel).to.have.property("depth", 1);
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

            const composedSubscriptionLabel = subscriptionLabelsPlugin.getSubscription(composed);
            const composedGraphLabel = graphPlugin.getGraphLabel(composedSubscriptionLabel);
            expect(composedGraphLabel).to.have.property("flattened", false);

            subject.next(0);

            let flattenedSubscriptionLabel = composedGraphLabel.flats[0];
            let flattenedGraphLabel = graphPlugin.getGraphLabel(flattenedSubscriptionLabel);
            expect(flattenedGraphLabel).to.have.property("flattened", true);

            subject.next(1);

            flattenedSubscriptionLabel = composedGraphLabel.flats[1];
            flattenedGraphLabel = graphPlugin.getGraphLabel(flattenedSubscriptionLabel);
            expect(flattenedGraphLabel).to.have.property("flattened", true);
        });

        afterEach(() => {

            if (spy) {
                spy.teardown();
            }
        });

        function hasSink(graphLabel: GraphLabel, sink: Subscription): boolean {

            if (graphLabel.sink === undefined) {
                return false;
            } else if (graphLabel.sink === sink) {
                return true;
            }
            return hasSink(graphPlugin.getGraphLabel(graphLabel.sink), sink);
        }

        function hasSource(graphLabel: GraphLabel, source: Subscription): boolean {

            if (graphLabel.sources.indexOf(source as Subscription) !== -1) {
                return true;
            }
            return graphLabel.sources.some(s => hasSource(graphPlugin.getGraphLabel(s), source));
        }
    });

    describe("methods", () => {

        let graphPlugin: GraphPlugin;
        let spy: Spy;
        let subscriptionLabelsPlugin: SubscriptionLabelsPlugin;

        beforeEach(() => {

            spy = create({ defaultPlugins: false, warning: false });
            graphPlugin = new GraphPlugin({ keptDuration: 0, spy });
            subscriptionLabelsPlugin = new SubscriptionLabelsPlugin({ spy });
            spy.plug(graphPlugin, subscriptionLabelsPlugin);
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

                const filteredSubscription = subscriptionLabelsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionLabelsPlugin.getSubscription(mapped);

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

                const filteredSubscription = subscriptionLabelsPlugin.getSubscription(filtered);
                const mappedSubscription = subscriptionLabelsPlugin.getSubscription(mapped);
                const subjectSubscription = subscriptionLabelsPlugin.getSubscription(subject);

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
