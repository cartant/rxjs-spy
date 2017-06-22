/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Match, matches } from "../match";
import { BasePlugin } from "./plugin";
import { isObservable } from "../util";

export class Deck {

    public teardown: () => void;
    private paused_: boolean;
    private resumables_: { resume: (value: any) => void; value: any[]; }[];

    constructor() {

        this.paused_ = true;
        this.resumables_ = [];
    }

    get paused(): boolean {

        return this.paused_;
    }

    clear(): void {

        this.resumables_ = [];
    }

    next(): void {

        if (this.resumables_.length > 0) {
            const [resumable, ...kept] = this.resumables_;
            this.resumables_ = kept;
            resumable.resume(resumable.value);
        }
    }

    pause(): void {

        this.paused_ = true;
    }

    pause_(value: any, resume: (value: any) => void): boolean {

        const { paused_, resumables_ } = this;

        if (paused_) {
            resumables_.push({ resume, value });
            return true;
        }
        return false;
    }

    resume(): void {

        this.paused_ = false;
        this.resumables_.forEach((resumable) => resumable.resume(resumable.value));
        this.resumables_ = [];
    }

    values(): any[] {

        return this.resumables_.map((resumable) => resumable.value);
    }
}

export class PausePlugin extends BasePlugin {

    private match_: Match;
    private deck_: Deck;

    constructor(match: Match) {

        super();

        this.deck_ = new Deck();
        this.match_ = match;
    }

    get deck(): Deck {

        const { deck_ } = this;
        return deck_;
    }

    get match(): Match {

        const { match_ } = this;
        return match_;
    }

    pause(observable: Observable<any>, subscriber: Subscriber<any>, value: any, release: (value: any) => void): boolean {

        const { deck_, match_ } = this;

        if (matches(observable, match_)) {
            return deck_.pause_(value, release);
        }
        return false;
    }

    teardown(): void {

        const { deck_ } = this;

        if (deck_ && deck_.teardown) {
            const teardown = deck_.teardown;
            deck_.teardown = () => {};
            teardown.call(deck_);
        }
    }
}
