/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Auditor } from "./auditor";

describe("Auditor", () => {

    it("should call tasks synchronously if duration is zero", () => {

        const duration = 0;
        const auditor = new Auditor(duration);
        let called = false;
        const task = () => called = true;

        auditor.audit("task", task);
        expect(called).to.be.true;
    });

    if (typeof window !== "undefined") {

        it.skip("should wait at least the duration before calling a task asynchronously", (callback: Function) => {

            const duration = 10;
            const auditor = new Auditor(duration);
            const since = window.performance.now();
            const task = () => {
                expect(window.performance.now() - since).to.be.at.least(duration);
                callback();
            };

            auditor.audit("task", task);
        });
    }

    it("should audit tasks", (callback: Function) => {

        const duration = 10;
        const auditor = new Auditor(duration);
        const task = (ignored: number) => {
            expect(ignored).to.equal(1);
            callback();
        };

        auditor.audit("task", task);
        auditor.audit("task", task);
    });

    it("should call the most recent task", (callback: Function) => {

        const duration = 10;
        const auditor = new Auditor(duration);

        auditor.audit("task", (ignored: number) => {
            callback(new Error("Should not be called."));
        });
        auditor.audit("task", (ignored: number) => {
            expect(ignored).to.equal(1);
            callback();
        });
    });

    if (typeof window !== "undefined") {

        it.skip("should wait only the required amount of time", (callback: Function) => {

            const duration = 50;
            const auditor = new Auditor(duration);
            const since = window.performance.now();

            auditor.audit("task1", () => {
                expect(window.performance.now() - since).to.be.at.least(duration);
            });
            setTimeout(() => auditor.audit("task2", () => {
                expect(window.performance.now() - since).to.be.at.least(20 + duration);
                expect(window.performance.now() - since).to.be.below(20 + duration + 10);
                callback();
            }), 20);
        });
    }

    it("should call tasks in audited order", (callback: Function) => {

        const duration = 50;
        const auditor = new Auditor(duration);
        let called1 = false;
        let called2 = false;

        auditor.audit("task1", () => {
            callback(new Error("Should not be called."));
        });
        auditor.audit("task2", () => {
            called2 = true;
            expect(called1).to.be.false;
        });
        auditor.audit("task1", () => {
            called1 = true;
            expect(called2).to.be.true;
            callback();
        });
    });
});
