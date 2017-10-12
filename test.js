var date1 = '01/01/2020';
var date2 = '01/04/2020';

console.log((Date.parse(date2) - Date.parse(date1)) / (24 * 3600000));

console.log( new Date(date1).toString() );

console.log(new Date() / 1);

var date3 = new Date('2017-09-28')

console.log(date3.getFullYear()  );
