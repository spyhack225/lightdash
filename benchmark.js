var Benchmark = require('benchmark');
var {formatRows, formatRowsWithoutSpread, formatRowsWithMap} = require('@lightdash/common');

function generateRow() {
    return {
        name: 'Jose',
        first: 'Jose',
        last: 'Jose',
        middle: 'Jose',
        title: 'Jose',
        age: 26,
        date: new Date(),
        extra: null,
        isAdult: true
    }
}

const createRows = (size) => {
    return Array.from({length: size}, generateRow);
}

const ITEM_MAP = {
    name: {
        fieldType: 'dimension',
        type: 'string',
    },
    first: {
        fieldType: 'dimension',
        type: 'string',
    },
    last: {
        fieldType: 'dimension',
        type: 'string',
    },
    middle: {
        fieldType: 'dimension',
        type: 'string',
    },
    title: {
        fieldType: 'dimension',
        type: 'string',
    },
    age: {
        fieldType: 'dimension',
        type: 'number',
    },
    date: {
        fieldType: 'dimension',
        type: 'date',
    },
    extra: {
        fieldType: 'dimension',
        type: 'string',
    },
    isAdult: {
        fieldType: 'dimension',
        type: 'boolean',
    },
}


const suite = new Benchmark.Suite;
const RESULTS = createRows(5000);
suite
    .add('with spread', function () {
        formatRows(RESULTS, ITEM_MAP);
    })
    .add('without spread', function () {
        formatRowsWithoutSpread(RESULTS, ITEM_MAP);
    })
    .add('with map', function () {
        formatRowsWithMap(RESULTS, ITEM_MAP);
    })
    .on('cycle', function(event) {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log(`With ${RESULTS.length} rows, the fastest is ` + this.filter('fastest').map('name'));
    })
    .run({'async': false});