/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/rxjs-spy
 */

const literalRegExp = /^(false|null|true|undefined)$/;

export function compile(expression: string): {
    evaluator: (context: any) => any,
    keys: string[]
} {
    const keys = expression.split(/[^a-z]+/i).filter(key => key && !literalRegExp.test(key));
    const replaced = expression.replace(/===/g, "==").replace(/!==/g, "!=");

    // https://stackoverflow.com/a/28244500/6680611

    const compiled = new (Function.bind.apply(Function, [
        null,
        ...keys,
        `return ${replaced};`
    ]))();

    const evaluator = (context: Record<string, any>) => {
        return compiled(...keys.map(key => {
            let value = context[key];
            if (typeof value === "function") {
                value = value.bind(context);
            }
            return value;
        }));
    };
    return { evaluator, keys };
}

export function compileOrderBy(expression: string): {
    comparer: (left: any, right: any) => number,
    evaluator: (context: any) => any,
    keys: string[]
} {
    let ascending = true;
    const match = expression.match(/[a-z]\s+(asc|desc)(\s*)$/i);
    if (match) {
        const [, direction, trailing] = match;
        ascending = direction.toLowerCase() === "asc";
        expression = expression.substring(0, expression.length - direction.length - trailing.length);
    }
    const { evaluator, keys } = compile(expression);
    let comparer = (left: any, right: any) => {
        const l = evaluator(left);
        const r = evaluator(right);
        return (l < r) ? -1 : (l > r) ? 1 : 0;
    };
    return {
        comparer: ascending ? comparer : (l, r) => comparer(l, r) * -1,
        evaluator,
        keys
    };
}
