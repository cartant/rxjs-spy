/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { isObservable, noop, Observable, Subject } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { patch } from "../factory";
import { identify } from "../identify";
import { toLogger } from "../logger";
import { tag } from "../operators";
import { Patcher } from "../patcher";
import { GraphPlugin } from "./graph-plugin";
import { SnapshotPlugin } from "./snapshot-plugin";
import { QueryPredicate } from "./snapshot-plugin-types";
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
            snapshotPlugin
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

    describe("blocking", () => {

        it("should match blocking observables", () => {
            harness.outer.next(0);
            const result = query("blocking");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.mapped));
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

    describe("depth", () => {

        it("should match observables with the specified depth", () => {
            const result = query("depth > 1");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(harness.outer));
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

    afterEach(() => {

        if (patcher) {
            patcher.teardown();
        }
    });

    function foundRegExp(count: number): RegExp {
        return new RegExp(`${count} snapshot\\(s\\) found`);
    }

    function idRegExp(arg: number | string | Observable<number>): RegExp {
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
