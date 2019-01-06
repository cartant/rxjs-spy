/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { interval, Subject } from "rxjs";
import { map, mapTo } from "rxjs/operators";
import { tag } from "./operators";
import { inferName, inferPipeline } from "./util";

describe("util", () => {

    describe("inferName", () => {

        it("should infer an observable's name", () => {
            const source = interval(1000);
            expect(inferName(source)).to.equal("observable");
        });

        it("should infer an operator's name", () => {
            const source = interval(1000).pipe(mapTo(0));
            expect(inferName(source)).to.equal("mapTo");
        });

        it("should infer a subject's name", () => {
            const source = new Subject<number>();
            expect(inferName(source)).to.equal("subject");
        });

        it("should infer an operator function's name", () => {
            const operator = map(value => value);
            expect(inferName(operator)).to.equal("map");
        });
    });

    describe("inferPipeline", () => {

        it("should infer a composed observable's pipeline", () => {
            const source = interval(1000).pipe(
                tag("interval"),
                mapTo(0),
                tag("map")
            );
            expect(inferPipeline(source)).to.equal("observable-tag-mapTo-tag");
        });
    });
});
