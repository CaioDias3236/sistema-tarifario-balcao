const { parseISO, differenceInHours } = require('date-fns');
const start = parseISO('2026-07-13T00:00');
const end = parseISO('2026-07-24T00:00');
console.log(differenceInHours(end, start) / 24);
