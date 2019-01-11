/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { isObservable, noop, Observable, Subject, zip } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { patch } from "../factory";
import { identify } from "../identify";
import { toLogger } from "../logger";
import { tag } from "../operators";
import { Patcher } from "../patcher";
import { BufferPlugin } from "./buffer-plugin";
import { CyclePlugin } from "./cycle-plugin";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { QueryPredicate, QueryRecord } from "./snapshot-plugin-types";
import { StackTracePlugin } from "./stack-trace-plugin";

describe("SnapshotPlugin#query", () => {

    const keptDuration = -1;
    const keptValues = 2;
    let harness: {
        inner: Subject<number>;
        mapped: Observable<number>;
        outer: Subject<number>;
        tagged: Observable<number>;
    };
    let patcher: Patcher;
    let snapshotPlugin: SnapshotPlugin;

    beforeEach(() => {

        patcher = patch({ defaultPlugins: false, warning: false });
        snapshotPlugin = new SnapshotPlugin({ keptValues, pluginHost: patcher.pluginHost });
        patcher.pluginHost.plug(
            new StackTracePlugin({ sourceMaps: false, pluginHost: patcher.pluginHost }),
            new GraphPlugin({ keptDuration, pluginHost: patcher.pluginHost }),
            snapshotPlugin,
            new BufferPlugin({ pluginHost: patcher.pluginHost }),
            new CyclePlugin({ pluginHost: patcher.pluginHost })
        );

        function composeHarness(): void {
            const outer = new Subject<number>();
            const inner = new Subject<number>();
            const mapped = outer.pipe(mergeMap(() => inner));
            const tagged = mapped.pipe(tag("mapped"));
            harness = { inner, mapped, outer, tagged };
            tagged.subscribe(noop, noop, noop);
        }
        composeHarness();
    });

    describe("age", () => {

        it("should match observable ages", (done: Mocha.Done) => {
            setTimeout(() => {
                harness.outer.next(0);
                const result = query("age > 0.010");
                expect(result).to.match(foundRegExp(2));
                expect(result).to.match(idRegExp(harness.mapped));
                expect(result).to.match(idRegExp(harness.tagged));
                done();
            }, 20);
        });
    });

    describe("blocking", () => {

        it("should match blocking observables", () => {
            harness.outer.next(0);
            const result = query("blocking");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });
    });

    describe("bufferCount", () => {

        it("should match buffer counts", () => {
            const first = new Subject<number>();
            const second = new Subject<number>();
            const zipped = zip(first, second);
            zipped.subscribe(noop, noop, noop);
            first.next(1);
            const result = query("bufferCount > 0");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(zipped));
        });
    });

    describe("complete", () => {

        it("should match observables that have completed", () => {
            harness.outer.next(0);
            harness.inner.complete();
            const result = query("complete");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.inner));
        });
    });

    describe("cycleCount", () => {

        it("should match cycle counts", () => {
            const subject1 = new Subject<number>();
            const subject2 = new Subject<number>();
            subject1.subscribe(value => {
                if (value < 10) {
                    subject2.next(value + 1);
                }
            });
            subject2.subscribe(value => {
                if (value < 10) {
                    subject1.next(value + 1);
                }
            });
            subject1.next(0);
            const result = query("cycleCount > 0");
            expect(result).to.match(foundRegExp(2));
        });
    });

    describe("depth", () => {

        it("should match observables with the specified depth", () => {
            const result = query("depth > 1");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.outer));
        });
    });

    describe("derivations", () => {

        it("should support custom derivations", () => {
            patcher.query({
                custom: function (this: QueryRecord): boolean {
                    return this.incomplete && this.root;
                }
            });
            const result = query("custom()");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    describe("error", () => {

        it("should match observables that have errored", () => {
            harness.outer.next(0);
            harness.inner.error(new Error("Kaboom!"));
            const result = query("error");
            expect(result).to.match(foundRegExp(3));
            expect(result).to.match(idRegExp(harness.inner));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    describe("file", () => {

        it("should match observables declared within the specified function", () => {
            const result = query("file(/snapshot-plugin-query/)");
            expect(result).to.match(foundRegExp(3));
            expect(result).to.match(idRegExp(harness.outer));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    describe("func", () => {

        it("should match observables declared within the specified function", () => {
            const result = query("func(/composeHarness/)");
            expect(result).to.match(foundRegExp(3));
            expect(result).to.match(idRegExp(harness.outer));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    describe("id", () => {

        it("should match string IDs", () => {
            const id = identify(harness.mapped);
            const result = query(`id("${id}")`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(id));
        });

        it("should match numeric IDs", () => {
            const id = identify(harness.mapped);
            const result = query(`id(${id})`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(id));
        });
    });

    describe("incomplete", () => {

        it("should match incomplete observables", () => {
            const result = query("incomplete");
            expect(result).to.match(foundRegExp(3));
            expect(result).to.match(idRegExp(harness.outer));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    describe("inner", () => {

        it("should match inner observables", () => {
            harness.outer.next(0);
            const result = query("inner");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.inner));
        });
    });

    describe("innerIncompleteCount", () => {

        it("should match observables with incomplete inner observables", () => {
            harness.outer.next(0);
            const result = query("innerIncompleteCount === 1");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });
    });

    describe("leaking", () => {

        it("should match observables that appear to be leaking", () => {
            Array.from(new Array(11), () => harness.outer.next(0));
            const result = query("leaking(10)");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });
    });

    describe("observable", () => {

        it("should match a string", () => {
            const result = query(`observable("subject")`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.outer));
        });

        it("should match a regular expression", () => {
            const result = query(`observable(/subject/)`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.outer));
        });
    });

    describe("observableId", () => {

        it("should match string IDs", () => {
            const id = identify(harness.mapped);
            const result = query(`observableId === "${id}"`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(id));
        });

        it("should match numeric IDs", () => {
            const id = identify(harness.mapped);
            const result = query(`observableId === ${id}`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(id));
        });
    });

    describe("operator", () => {

        it("should match a string", () => {
            const result = query(`observable("mergeMap")`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });

        it("should match a regular expression", () => {
            const result = query(`observable(/mergeMap/)`);
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });
    });

    describe("pipeline", () => {

        it("should match a string", () => {
            const result = query("pipeline('subject-mergeMap')");
            expect(result).to.match(foundRegExp(2));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });

        it("should match a regular expression", () => {
            const result = query("pipeline(/^subject-mergeMap$/)");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
        });
    });

    describe("root", () => {

        beforeEach(() => {
            harness.outer.next(0);
        });

        it("should match root subscriptions", () => {
            const result = query("root");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(tagRegExp("mapped"));
        });

        it("should match non-root subscriptions when negated", () => {
            const result = query("!root");
            expect(result).to.match(foundRegExp(3));
        });
    });

    describe("slow", () => {

        it("should match slow observables", (done: Mocha.Done) => {
            harness.outer.next(0);
            setTimeout(() => {
                harness.outer.next(0);
                const result = query("slow(10)");
                expect(result).to.match(foundRegExp(3));
                expect(result).to.match(idRegExp(harness.inner));
                expect(result).to.match(idRegExp(harness.mapped));
                expect(result).to.match(idRegExp(harness.tagged));
                done();
            }, 20);
        });
    });

    describe("tag", () => {

        it("should match all tags if no argument is passed", () => {
            const result = query("tag()");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(tagRegExp("mapped"));
        });

        it("should match a string", () => {
            let result = query("tag('mapped')");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(tagRegExp("mapped"));
            result = query("tag('missing')");
            expect(result).to.match(foundRegExp(0));
        });

        it("should match a regular expression", () => {
            let result = query("tag(/mapped/)");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(tagRegExp("mapped"));
            result = query("tag(/missing/)");
            expect(result).to.match(foundRegExp(0));
        });
    });

    describe("value", () => {

        it("should match observables their nexted value", () => {
            harness.outer.next(0);
            harness.inner.next(1);
            const result = query("value === 1");
            expect(result).to.match(foundRegExp(3));
            expect(result).to.match(idRegExp(harness.inner));
            expect(result).to.match(idRegExp(harness.mapped));
            expect(result).to.match(idRegExp(harness.tagged));
        });
    });

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });

    function foundRegExp(count: number): RegExp {
        return new RegExp(`${count} snapshot\\(s\\) found`);
    }

    function idRegExp(arg: number | string | Observable<any>): RegExp {
        const id = isObservable(arg) ? identify(arg) : arg;
        return new RegExp(`ID = ${id}`);
    }

    function query(
        predicate: string | QueryPredicate,
        orderBy: string = "age asc",
        limit: number = Infinity
    ): string {
        let result = "";
        const logger = toLogger({
            log(message?: any, ...args: any[]): void {
                result = `${result}${message || ""} ${args.join(" ")}\n`;
            }
        });
        snapshotPlugin.query({
            limit,
            logger,
            orderBy,
            predicate
        });
        return result;
    }

    function tagRegExp(tag: string): RegExp {
        return new RegExp(`tag = ${tag}`);
    }
});
