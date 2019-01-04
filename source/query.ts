/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

import { SubscriptionSnapshot } from "./plugin";

export type QueryRecord = Record<string, any>;
export type QueryPredicate = (queryRecord: QueryRecord) => boolean;
export type QueryDerivation = (
    queryRecord: QueryRecord,
    subscriptionSnapshot: SubscriptionSnapshot
) => any;
export type QueryDerivations = Record<string, QueryDerivation>;
