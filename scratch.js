const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/celulares.json', 'utf8'));
console.log(data.items[0]);
