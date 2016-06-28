var colors = require('./colors/lib/index.js');
var map = {
  dev:0,
  debug:1,
  info:2,
  warn:3,
  error:4
}
function Log(level){Log.setLevel(level)}
Log.setLevel = function(level){
  Log._level = map[level];
};
Log.dev = function(){
  if(Log._level===0)console.log(colors.green.apply(colors,arguments));
}
Log.debug = function(){
  if(Log._level<=1)console.log(colors.gray.apply(colors,arguments));
}
Log.info = function(){
  if(Log._level<=2)console.log(colors.cyan.apply(colors,arguments));
}
Log.warn = function(){
  if(Log._level<=3)console.log(colors.yellow.apply(colors,arguments));
}
Log.error = function(){
  if(Log._level<=4)console.log(colors.red.apply(colors,arguments));
}

module.exports = Log;
