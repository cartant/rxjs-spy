/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { inferPath, inferType } from "./util";

import "rxjs/add/observable/interval";
import "rxjs/add/operator/mapTo";
import "./add/operator/tag";

describe("util", () => {

    describe("inferPath", () => {

        it("should infer a composed observable's path", () => {

            const source = Observable.interval(1000).tag("interval").mapTo(0).tag("map");
            expect(inferPath(source)).to.equal("/interval/tag/mapTo/tag");
        });
    });

    describe("inferType", () => {

        it("should infer an observable's type", () => {

            const source = Observable.interval(1000);
            expect(inferType(source)).to.equal("interval");
        });

        it("should infer an operator's type", () => {

            const source = Observable.interval(1000).mapTo(0);
            expect(inferType(source)).to.equal("mapTo");
        });

        it("should infer a subject's type", () => {

            const source = new Subject<number>();
            expect(inferType(source)).to.equal("Subject");
        });
    });
});
