const { interval } = require("rxjs");
const { startWith, switchMap, tap } = require("rxjs/operators");
const { create } = require("../../dist");
const { people } = require("./people");

const browser = typeof window !== "undefined";
const spy = create({
    devTools: browser,
    keptDuration: 10e3,
    sourceMaps: browser
});

interval(5000).pipe(
    startWith(-1),
    tap(() => {
        const placeBreakpointHere = true;
    }),
    switchMap(() => people),
    tap(() => {
        const placeBreakpointHere = true;
    })
).subscribe();
