/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable, Subject } from "rxjs";
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
            tagged.subscribe();
        }
        composeHarness();
    });

    describe("blocked", () => {

        it("should match blocked observables", () => {
            harness.outer.next(0);
            const result = query("blocked");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(identify(harness.mapped)));
        });
    });

    describe("file", () => {

        it.skip("should match observables declared within the specified function", () => {
            const result = query("file(/snapshot-plugin-query/)");
            expect(result).to.match(foundRegExp(4));
        });
    });

    describe("func", () => {

        it.skip("should match observables declared within the specified function", () => {
            const result = query("func(/composeHarness/)");
            expect(result).to.match(foundRegExp(4));
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

    describe("innerIncompleteCount", () => {

        it("should match observables with incomplete inner observables", () => {
            harness.outer.next(0);
            const result = query("innerIncompleteCount === 1");
            expect(result).to.match(foundRegExp(1));
            expect(result).to.match(idRegExp(identify(harness.mapped)));
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

    function idRegExp(id: number | string): RegExp {
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
