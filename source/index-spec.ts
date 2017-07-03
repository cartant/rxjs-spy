/**
 * @license Copyright © 2017 Nicholas Jamieson. All Rights Reserved.
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

// Workaround for https://github.com/Microsoft/TypeScript/issues/16593
// See https://stackoverflow.com/a/44813884/6680611

import { Operator } from "rxjs/Operator";
import { Observable } from "rxjs/Observable";

declare module "rxjs/Subject" {
    interface Subject<T> {
        lift<R>(operator: Operator<T, R>): Observable<R>;
    }
}

import "./add/operator/tag-spec";
import "./match-spec";
import "./plugin/let-plugin-spec";
import "./plugin/log-plugin-spec";
import "./plugin/pause-plugin-spec";
import "./plugin/snapshot-plugin-spec";
import "./spy-spec";
