const { interval } = require("rxjs");
const { map } = require("rxjs/operators");
const { tag } = require("../../dist/operators");

const source = interval(2000).pipe(
    tag("interval")
);
const people = source.pipe(
    map(value => {
        const names = ["alice", "bob"];
        return names[value % names.length];
    }),
    tag("people")
);

exports.people = people;
