//babel作业状态机，保证时序清楚
var gulp = require('gulp');
var through = require('through2');
var babel = require('babel-core');
var PATH = require('path');
var fs = require('fs');
var buildinMap = require('./buildin.js').buildinMap;
var RequirePath = require('./requirePath.js');
var shell = require('./shell.js');
var Output = require('./output.js');
var Watcher = require('./watcher.js');
var Log = require('./log.js');
//cache设计是关键，减少重复作业，便于更新到文件，一个模块更新时怎么能不重复拼接文件
function Nest(opts){
  this.cache = {};
  this.transformList = [];//里面都是文件路径绝对路径
  this.finishList = [];//里面都是文件路径绝对路径
  this.babelOptions = opts.babelConfig;
  this.rootPath = opts.rootPath;
  this.storePath = opts.storePath;
  this.output = new Output({nest:this,config:opts.outputConfig});
  this.watcher = new Watcher({nest:this,config:opts.watchConfig});
  this.orderList = [];//只有进入真正的空闲态，即没有任务需要执行时，如果这里有命令，执行一条命令
  Object.defineProperties(this,{
    //wait parse idle
    state:{
      set:function(val){
        this._state = val;
        this[val+'Start']();
      },
      get:function(){
        return this._state;
      }
    }
  })
  this.module_buffer_path = new RequirePath({refPath:'buffer',filePath:this.storePath,rootPath:this.rootPath,storePath:this.storePath});
  this.state = 'idle';
}
//对等待列表里的路径进行统一作业,如果path不为空，就把path和等待列表合并一起flush
//这里进来的是文件路径，和引用路径没有关系,应该用绝对路径
Nest.prototype._flushList = function(path){
  //这里的path不管是否有缓存都要进行一次作业
  //可使用的状态是什么
  Log.dev('====FLUSH LIST====');
  if(Array.isArray(path)){
    path.forEach((ps)=>{
      if(this.transformList.indexOf(ps)==-1)this.transformList.push(ps);
    })
  }else if(path!==undefined){
    Log.debug('_flushList 参数错误',path);
  }
  if(this.state === 'wait'){
    this.state = 'parse';
  }
}
//外部推入指令，这是外部唯一指挥作业的方法
Nest.prototype.pushOrder = function(order){
  if(order&&order.type&&order.entity){
    Log.debug(`命令队列新加入一条命令,类型：${order.type},实体：${order.entity}`);
    this.orderList.push(order);
    if(this.state === 'idle')this._getOneAndRun();//如果处于空闲态说明没有其他命令，立即执行
  }else{
    Log.error(`错误的命令,类型：${order.type},实体：${order.entity}`);
  }
}
//如果指令队列里有指令的话，取一条指令执行
Nest.prototype._getOneAndRun = function(){
  if(this.state!=='idle')return Log.debug('状态错误 _getOneAndRun',this.state);
  if(this.orderList.length!==0){
    var order = this.orderList.shift();
    if(order.type === 'remove'){
      this._removeCacheByFilePath(order.entity);
      this.state = 'wait';
    }else if(order.type === 'transform'){
      this._flushList(order.entity);
      this.state = 'wait';
    }else if(order.type === 'getFile'){
      var jsFile = this._getModulesByRelativePath(order.entity);
      order.callback(jsFile);
      this.state = 'wait';
    }
  }else{
    //继续留在空闲态，等待命令
  }
}

Nest.prototype.idleStart = function(){
  Log.dev('进入空闲态',this.orderList)
  this._getOneAndRun();
}
Nest.prototype.parseStart = function(){
  //真正的作业
  Log.dev('状态变更至parse');
  Log.debug(`作业总数${this.transformList.length}`)
  var _transformList = this.transformList.concat();
  var l = _transformList.length;
  this.transformList = [];//清空队列，全部取出来作业
  gulp.src(_transformList)
  .pipe(through.obj((file,enc,cb) => {
    Log.dev('收到pipe',file.path);
    var filePath = file.path;
    var content = file.contents.toString();
    var result = this._getDependence(content,filePath,this.babelOptions);
    var relativeFilePath = PATH.relative(this.rootPath,filePath);//相对路径做键

    if(!this.cache[relativeFilePath])this.cache[relativeFilePath] = {};
    this.cache[relativeFilePath]['code'] = result.code;//缓存模块代码
    this.cache[relativeFilePath]['dependence'] = [];

    result.requirePath.forEach((rpo)=>{
      this.cache[relativeFilePath]['dependence'].push(rpo);
      //路径过滤
      //这里的path如果有缓存则不进行作业
      //有缓存的、在完成队列里的，在等待队列里的都不加入下一次作业
      if(!this.cache[rpo.relativeFilePath]&&this.transformList.indexOf(rpo.absolutePath)==-1&&this.finishList.indexOf(rpo.absolutePath)==-1)this.transformList.push(rpo.absolutePath);
    });
    l--;
    this.finishList.push(filePath);
    Log.debug(`完成路径${filePath}的解析，还差${l}个`);

    if(l===0){
      Log.dev('一轮parse结束以后检查下一组队列',this.transformList)
      cb()//不回调不会收到下一个流
      this.state = 'wait';//一轮flush结束
    }else {cb()}
  }))
}
Nest.prototype.waitStart = function(){
  Log.dev('状态变更至wait');
  if(this.transformList.length){
    this._flushList();
  }else{
    Log.info('空闲...');
    Log.info('缓存模块：',Object.keys(this.cache));
    Log.info(`缓存模块${Object.keys(this.cache).length}个`);
    //重置transformList和finishList
    //this.finishList = [];
    this.state ='idle';
  }
}
Nest.prototype._getDependence = function(jsFile,filePath,opt){
  //从js文件中提取正确的依赖
  //fuck有些json文件也特么混进来了卧槽
  if(filePath.match(/\.json$/i)){
    return {requirePath:[],code:jsFile};
  }else{
    try {
      var babelResult = babel.transform(jsFile,opt);//这里是不是需要try catch
      var requirePath = [];

      var tokens = babelResult.ast.tokens;
      var hasBuffer = false;
      for(var i = 0,l = tokens.length;i<l;i++){
        //至少后面要有3个token
        //提取require的路径
        if(i+3<l
          &&tokens[i].value === 'require'
          &&tokens[i].type.label === 'name'
          &&tokens[i+1].type.label === '('
          &&tokens[i+3].type.label === ')'){
            if(tokens[i+2].type.label === 'string'){
              requirePath.push(tokens[i+2].value);
            }else{
              Log.debug('require的path不是字符串',tokens[i+2].value);
            }
          }
        //特殊的后端独有全局对象Buffer，使用不需要require,因此要单独提取
        //但是buffer模块里不能加，不然就是循环引用
        if(tokens[i].value === 'Buffer'&&tokens[i].type.label === 'name'){
          hasBuffer = true;
        }
      }
      if(hasBuffer===true&&filePath!==this.module_buffer_path.absolutePath)requirePath.push('buffer');
      var imports =  babelResult.metadata.modules.imports;
      imports.forEach((obj)=>{
        requirePath.push(obj.source);
      })
      var _requirePath = [];
      requirePath.forEach((ps)=>{
        _requirePath.push(new RequirePath({
          refPath:ps,filePath:filePath,rootPath:this.rootPath,storePath:this.storePath
        }));
      })
      var code = babelResult.code;
      if(filePath.match(this.storePath)){
        //console.log('来自node_modules的直接使用转换前的代码,fuck some gl-matrix',filePath);
        code = jsFile;
      }

    } catch (e) {
      Log.warn('[BABEL ERROR]',e.toString())
      console.log(e.codeFrame);
      _requirePath = [];
      code = jsFile;
    } finally {
      return {requirePath:_requirePath,code:code};
    }



  }
}

// 根据一个入口路径获取所有的模块
//不应该在parse状态下运行，否则不知道会得到什么东西
//path为相对文件路径
// Nest.prototype._getJsFileByName = function(name){
//   //只能在空闲态下运行
//   if(this.state!=='idle')return console.log('在错误的状态下调用,_getJsFileByName',this.state);
//   var _path = PATH.resolve(this.rootPath,this.portalRelativeDirPath,name)
//   var path = PATH.relative(this.rootPath,_path);
//   return this._getModulesByRelativePath(path);
// }
//cache里的键是相对路径，因此这里输入的路径为相对路径
Nest.prototype._getModulesByRelativePath = function(path){
  if(this.state!=='idle')return Log.debug('在错误的状态下调用,_getJsFileByName',this.state);
  Log.dev('申请js文件',path);
  if(!this.cache.hasOwnProperty(path)){
    Log.warn('_getModulesByRelativePath 错误',path)
    return ''
  }
  var _module = {};
  var portal = path;
  var  _dep = function(path,cache){
    if(_module.hasOwnProperty(path))return
    _module[path] = cache[path];
    cache[path]['dependence'].forEach((rpo)=>{
      _dep(rpo.relativePath,cache);
    })
  };
  _dep(portal,this.cache);
  //console.log(Object.keys(_module));
  //console.log(`获取模块结果,入口${portal},模块${Object.keys(_module).length}个`);

  var jsFile = shell.jsFile(portal,_module);
  return jsFile;
}
Nest.prototype._removeCacheByFilePath = function(filePath){
  //只能在空闲态下调用
  //!!!要从完成列表里干掉这个路径
  if(this.state!=='idle')return
  var relativeFilePath = PATH.relative(this.rootPath,filePath);
  if(this.cache[relativeFilePath]){
    delete this.cache[relativeFilePath]
    Log.info(`删除废弃文件${relativeFilePath}对应的模块缓存`);
  }else{
    Log.warn(`未发现废弃文件${relativeFilePath}对应的模块缓存`);
  }
  var index = this.finishList.indexOf(filePath);
  if(index!==-1){
    this.finishList.splice(index,1);
    Log.info(`从完成列表里删除文件${filePath}`)
  }else{
    Log.warn(`在完成列表里未发现文件${filePath}`)
  }
}
module.exports = Nest;
