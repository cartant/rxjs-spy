/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { interval, Subject } from "rxjs";
import { mapTo } from "rxjs/operators";
import { tag } from "./operators";
import { inferPath, inferType } from "./util";

describe("util", () => {

    describe("inferPath", () => {

        it("should infer a composed observable's path", () => {

            const source = interval(1000).pipe(
                tag("interval"),
                mapTo(0),
                tag("map")
            );
            expect(inferPath(source)).to.equal("/observable/tag/mapTo/tag");
        });
    });

    describe("inferType", () => {

        it("should infer an observable's type", () => {

            const source = interval(1000);
            expect(inferType(source)).to.equal("observable");
        });

        it("should infer an operator's type", () => {

            const source = interval(1000).pipe(mapTo(0));
            expect(inferType(source)).to.equal("mapTo");
        });

        it("should infer a subject's type", () => {

            const source = new Subject<number>();
            expect(inferType(source)).to.equal("subject");
        });
    });
});
