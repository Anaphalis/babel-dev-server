//文件监视器
//关键：精确控制watch范围，剔除不需要转换的文件
//定一批后缀 .js .jsx .coffee
var chokidar = require('chokidar');
var PATH = require('path');
var Log = require('./log');
function Watcher (opts) {
  if(opts.config.notuse === true){
    Log.warn(`放弃启动Watcher`);
    return
  }
  this.nest = opts.nest;
  this.config = opts.config;
  this.watchDir = this.config.path;
  this.exts = this.config.extension||['.js'];
  this.ignored = this.config.ignored;
  this.watcher = chokidar.watch(this.watchDir,{
    ignored:this.ignored,//忽略隐藏文件
    persistent:true
  })
  this.ready = false;
  this.watcher
    .on('ready',(path)=>{
      Log.info('[BDS WACHER]:ready');
      this._ready();
      this.ready = true;
    })
}
Watcher.prototype._ready = function (){
  this.watcher
  .on('add',(path)=>{
    Log.info('[BDS WATCHER]:add',path);
    this.check('add',path);
  })
  .on('change',(path)=>{
    Log.info('[BDS WATCHER]:change',path);
    this.check('change',path);
  })
  .on('unlink',(path)=>{
    Log.info('[BDS WATCHER]:remove',path);
    this.check('remove',path);
  })
}
Watcher.prototype.check = function(type,path){
  var ext = PATH.extname(path);
  Log.dev(type,path,ext)
  if(this.exts.indexOf(ext)===-1)return
  if(type === 'remove') this.nest.pushOrder({type:'remove',entity:path});
  if(type === 'add'||type === 'change') this.nest.pushOrder({type:'transform',entity:[path]})

}
module.exports = Watcher;
