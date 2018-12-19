/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

export function compile(expression: string): { func: Function, keys: string[] } {
    const keys = expression.split(/[^a-z]+/i).filter(Boolean);
    const replaced = expression.replace(/===/g, "==").replace(/!==/g, "!=");

    // https://stackoverflow.com/a/28244500/6680611

    const compiled = new (Function.bind.apply(Function, [null].concat([
        ...keys,
        `return ${replaced};`
    ] as any)))();

    const func = (record: Record<string, any>) => compiled(
        ...keys.map(key => record[key])
    );
    return { func, keys };
}
/*
spy.query({
  dead: r => r.incomplete && r.nextAge > 60,
  user: r => /user\.ts$/.test(r.fileName)
})
spy.query("dead && user")
*/
/*
spy.query({
  dead: r => r.incomplete && r.nextAge > 60,
  quiet: r => r.incomplete && r.nextAge > 10
  frequency: r => Math.max(r.nextCount / (r.nextAge - r.subscribeAge), 0)
});
*/
/*
Mention - in the README - that IDs can be passed wherever a match is accepted.
*/
