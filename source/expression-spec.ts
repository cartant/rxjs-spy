/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { compile } from "./expression";

describe("expression", () => {

    it("should evaluate the expression using the specfied record", () => {
        const { func } = compile("a + b + c");
        expect(func({ a: "A", b: "B", c: "C" })).to.equal("ABC");
    });

    it("should relax ===", () => {
        const { func } = compile("a === b");
        expect(func({ a: "1", b: 1 })).to.be.true;
    });

    it("should relax !==", () => {
        const { func } = compile("a !== b");
        expect(func({ a: "1", b: 1 })).to.be.false;
    });

    it("should support functions", () => {
        const { func } = compile(`file('a') || file("b")`);
        expect(func({
            file: (name: string) => name === "a"
        })).to.be.true;
    });
});
