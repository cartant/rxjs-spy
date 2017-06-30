/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscriber } from "rxjs/Subscriber";
import { Subscription } from "rxjs/Subscription";
import { defaultLogger, Logger, PartialLogger, toLogger } from "../logger";
import { Match, matches, read, toString as matchToString } from "../match";
import { BasePlugin, Event } from "./plugin";
import { subscribeWithoutSpy } from "../spy";

interface State {
    events_: { error?: any; type: Event; value?: any; }[];
    subject_: Subject<any>;
    subscription_: Subscription | null;
    tag_: string | null;
}

export class Deck {

    public teardown: () => void;

    private match_: Match;
    private paused_ = true;
    private states_ = new Map<Observable<any>, State>();

    constructor(match: Match) {

        this.match_ = match;
    }

    get paused(): boolean {

        return this.paused_;
    }

    clear(): void {

        this.states_.forEach((state) => {
            state.events_ = state.events_.filter((event) => event.type !== "next");
        });
    }

    log(partialLogger: PartialLogger = defaultLogger): void {

        const logger = toLogger(partialLogger);

        logger.group(`Deck matching ${matchToString(this.match_)}`);
        logger.log("Paused =", this.paused_);
        this.states_.forEach((state) => {
            logger.group(`Observable; tag = ${state.tag_}`);
            logger.log("Values =", values(state));
            logger.groupEnd();
        });
        logger.groupEnd();
    }

    pause(): void {

        this.paused_ = true;
    }

    resume(): void {

        this.states_.forEach((state) => {
            while (state.events_.length > 0) {
                step(state);
            }
        });
        this.paused_ = false;
    }

    select(observable: Observable<any>, subscriber: Subscriber<any>): (source: Observable<any>) => Observable<any> {

        return (source: Observable<any>) => {

            let state = this.states_.get(observable);
            if (state) {
                state.subscription_!.unsubscribe();
            } else {
                state = {
                    events_: [],
                    subject_: new Subject<any>(),
                    subscription_: null,
                    tag_: read(observable)
                };
                this.states_.set(observable, state);
            }

            state.subscription_ = subscribeWithoutSpy.call(source, {
                complete: () => {
                    if (this.paused_) {
                        state!.events_.push({ type: "complete" });
                    } else {
                        state!.subject_.complete();
                    }
                },
                error: (error: any) => {
                    if (this.paused_) {
                        state!.events_.push({ error, type: "error" });
                    } else {
                        state!.subject_.error(error);
                    }
                },
                next: (value: any) => {
                    if (this.paused_) {
                        state!.events_.push({ type: "next", value });
                    } else {
                        state!.subject_.next(value);
                    }
                }
            });
            return state!.subject_.asObservable();
        };
    }

    skip(): void {

        this.states_.forEach((state) => {
            skip(state);
        });
    }

    step(): void {

        this.states_.forEach((state) => {
            step(state);
        });
    }

    unsubscribe(): void {

        this.states_.forEach((state) => {
            if (state.subscription_) {
                state.subscription_.unsubscribe();
                state.subscription_ = null;
            }
        });
    }
}

export class PausePlugin extends BasePlugin {

    private match_: Match;
    private deck_: Deck;

    constructor(match: Match) {

        super();

        this.deck_ = new Deck(match);
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

    select(observable: Observable<any>, subscriber: Subscriber<any>): ((source: Observable<any>) => Observable<any>) | null {

        const { deck_, match_ } = this;

        if (matches(observable, match_)) {
            return deck_.select(observable, subscriber);
        }
        return null;
    }

    teardown(): void {

        const { deck_ } = this;

        if (deck_) {
            deck_.resume();
            deck_.unsubscribe();
        }
    }
}

function skip(state: State): void {

    if (state.events_.length > 0) {
        const [event, ...rest] = state.events_;
        if (event.type === "next") {
            state.events_ = rest;
        }
    }
}

function step(state: State): void {

    if (state.events_.length > 0) {
        const [event, ...rest] = state.events_;
        switch (event.type) {
        case "complete":
            state.subject_.complete();
            break;
        case "error":
            state.subject_.error(event.error);
            break;
        case "next":
            state.subject_.next(event.value);
            break;
        default:
            throw new Error(`Unexpected event type (${event.type}).`);
        }
        state.events_ = rest;
    }
}

function values(state: State): any[] {

    return state.events_
        .filter((event) => event.type === "next")
        .map((event) => event.value);
}
