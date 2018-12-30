/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export type QueryRecord = Record<string, any>;
export type QueryPredicate = (queryRecord: QueryRecord) => boolean;
export type QueryDerivations = Record<string, (queryRecord: QueryRecord) => any>;
