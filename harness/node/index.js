const { interval } = require("rxjs");
const { startWith, switchMap, tap } = require("rxjs/operators");
const { create } = require("../../dist");
const { people } = require("./people");

const spy = create({
    devTools: false,
    keptDuration: 10e3,
    sourceMaps: false
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
