/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { compile, compileOrderBy } from "./expression";

describe("expression", () => {

    describe("compile", () => {

        it("should evaluate the expression using the specfied record", () => {
            const { evaluator } = compile("a + b + c");
            expect(evaluator({ a: "A", b: "B", c: "C" })).to.equal("ABC");
        });

        it("should relax ===", () => {
            const { evaluator } = compile("a === b");
            expect(evaluator({ a: "1", b: 1 })).to.be.true;
        });

        it("should relax !==", () => {
            const { evaluator } = compile("a !== b");
            expect(evaluator({ a: "1", b: 1 })).to.be.false;
        });

        it("should support functions", () => {
            const { evaluator } = compile(`file('a') || file("b")`);
            expect(evaluator({
                file: (name: string) => name === "a"
            })).to.be.true;
        });

        it("should support regular expressions", () => {
            const { evaluator } = compile(`file(/a/)`);
            expect(evaluator({
                file: (name: RegExp) => name.test("abc")
            })).to.be.true;
        });
    });

    describe("compileOrderBy", () => {

        it("should default to ascending", () => {
            const { comparer, evaluator } = compileOrderBy("name");
            expect(evaluator({ name: "alice" })).to.equal("alice");
            expect(evaluator({ name: "bob" })).to.equal("bob");
            expect(comparer({ name: "alice" }, { name: "bob" })).to.equal(-1);
        });

        it("should support ascending", () => {
            const { comparer, evaluator } = compileOrderBy("name asc");
            expect(evaluator({ name: "alice" })).to.equal("alice");
            expect(evaluator({ name: "bob" })).to.equal("bob");
            expect(comparer({ name: "alice" }, { name: "bob" })).to.equal(-1);
        });

        it("should support descending", () => {
            const { comparer, evaluator } = compileOrderBy("name desc");
            expect(evaluator({ name: "alice" })).to.equal("alice");
            expect(evaluator({ name: "bob" })).to.equal("bob");
            expect(comparer({ name: "alice" }, { name: "bob" })).to.equal(1);
        });
    });
});
