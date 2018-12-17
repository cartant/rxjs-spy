/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */
/*tslint:disable:no-unused-expression*/

import { expect } from "chai";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";
import { getStackTrace, StackTracePlugin } from "./stack-trace-plugin";
import { SubscriptionRefsPlugin } from "./subscription-refs-plugin";
import { create } from "../spy-factory";
import { Spy } from "../spy-interface";
import { SubscriptionRef } from "../subscription-ref";

describe("StackTracePlugin", () => {

    let spy: Spy;
    let stackTracePlugin: StackTracePlugin;
    let subscriptionRefsPlugin: SubscriptionRefsPlugin;

    beforeEach(() => {

        stackTracePlugin = new StackTracePlugin();
        subscriptionRefsPlugin = new SubscriptionRefsPlugin();
        spy = create({ defaultPlugins: false, warning: false });
        spy.plug(stackTracePlugin, subscriptionRefsPlugin);
    });

    it("should determine the stack traces", () => {

        const subject = new Subject<number>();
        const mapped = subject.pipe(map((value) => value));
        const subscription = mapped.subscribe();

        const subjectSubscriptionRef = subscriptionRefsPlugin.get(subject);
        const mappedSubscriptionRef = subscriptionRefsPlugin.get(mapped);

        const subjectStackTrace = getStackTrace(subjectSubscriptionRef);
        const mappedStackTrace = getStackTrace(mappedSubscriptionRef);

        expect(subjectStackTrace).to.exist;
        expect(subjectStackTrace).to.not.be.empty;

        expect(mappedStackTrace).to.exist;
        expect(mappedStackTrace).to.not.be.empty;
    });

    afterEach(() => {

        if (spy) {
            spy.teardown();
        }
    });
});
