var Nest = require('./nest.js');
var exec = require('child_process').exec;
var PATH = require('path');
var Log = require('./log.js');
var storePath;
var rootPath;
var globeConfig;
function Starter(config) {
  if(config.log&&config.log.level)Log(config.log.level||'info');
  exec('npm root',(err,stdout,stderr)=>{
    if(err) return Log.error('找不到模块目录');
    if(stderr) return Log.error(stderr);
    if(stdout)storePath = stdout.replace(/\s*$/,'');//末尾有回车
    rootPath = PATH.dirname(storePath);
    Log.info(`工程根目录：${rootPath},npm根目录：${storePath}`);
    globeConfig = _checkConfig(config);
    var nest = new Nest({
      rootPath:rootPath,
      storePath:storePath,
      watchConfig:globeConfig.watch,
      outputConfig:globeConfig.output,
      babelConfig:globeConfig.babel
    });
    var paths = [];
    globeConfig.entry.forEach((_entry)=>{
      paths.push(PATH.resolve(rootPath,_entry))
    })
    Log.debug('确认入口路径 ',paths)
    nest.pushOrder({type:'transform',entity:paths});//这里应该使用文件路径，而不是引用路径
    //要能根据一个路径获得所有模块
  })
}



//检查+格式化配置
function _checkConfig(config){
  if(!config.entry||!config.output||!config.watch)throw '配置错误';
  //处理entry
  if(!Array.isArray(config.entry))config.entry = [config.entry];
  //处理watch
  if(!config.watch.path)throw '配置错误,watch path不存在'
  //处理output
  if(config.output.mode === 'plugin'){

  }else{
    config.output.mode = 'server';
    if(!config.output.port||!config.output.map)throw '配置错误,output path不存在'
  }
  if(!config.babel)config.babel = {};
  if(!Array.isArray(config.watch.path))config.watch.path = [config.watch.path];
  config.watch.path.forEach((_path)=>{
    _path = PATH.resolve(rootPath,_path);
  })
  //config.watch.path = PATH.resolve(rootPath,config.watch.path);
  config.output.rootPath = rootPath;
  return config
}
Starter.output = function(config,callback){
  //这时应该不用启动output server
  if(!config)Log.error('缺少配置');
  if(config.output){
    config.output.mode = "plugin";
    config.output.entry = config.entry;
    config.output.next = callback;
    //config.log.level = 'warn';
  }
  if(config.watch){
    config.watch.notuse = true;
  }
  Starter(config)

}
module.exports = Starter;
