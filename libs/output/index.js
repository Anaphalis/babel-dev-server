const ServerOutput = require('./server-output');
const PluginOutput = require('./plugin-output');
var Log = require('./../log.js');
function OutputFactory () {}
OutputFactory.useOutput = function(opts){
  Log.info('获取output对象',JSON.stringify(opts))
  if(opts.config.mode === 'server'){
    Log.info('使用服务器动态输出');
    new ServerOutput(opts);
  }
  if(opts.config.mode === "plugin"){
    Log.info('作为中间件使用，需要输出Js和css');
    new PluginOutput(opts);
  }
}
module.exports = OutputFactory;
