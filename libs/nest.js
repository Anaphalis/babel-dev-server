//babel作业状态机，保证时序清楚
var babel = require('babel-core');
var PATH = require('path');
var fs = require('fs');
var buildinMap = require('./buildin.js').buildinMap;
var RequirePath = require('./requirePath.js');
var shell = require('./shell.js');
var Output = require('./output.js');
var Watcher = require('./watcher.js');
var Filer = require('./filer.js').Filer;
var requires_filter = require('./ast-filter.js').requires_filter;
var Log = require('./log.js');
//cache设计是关键，减少重复作业
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
  var _transformList = this.transformList.concat();
  var l ;//需要转换的文件个数
  this.transformList = [];//清空队列，全部取出来作业
  Filer(_transformList).then((set)=>{
    l = set.size;
    Log.debug(`作业总数${set.size}`)
    set.forEach((filePath)=>{
      var relativePath = PATH.relative(this.rootPath,filePath);
      Log.dev('准备用fs读取的文件路径：',filePath,'相对路径：',relativePath);
      fs.readFile(filePath,(err,fileBuffer)=>{
        if(err){
          Log.error(`读取文件${filePath}错误,跳过,${err}`);
          l--;
        }else{
          var content = fileBuffer.toString();
          var result = this._getDependence(content,filePath,this.babelOptions);

          if(!this.cache[relativePath])this.cache[relativePath] = {};
          this.cache[relativePath]['code'] = result.code;//缓存模块代码
          this.cache[relativePath]['dependence'] = [];

          result.requirePath.forEach((rpo)=>{
            this.cache[relativePath]['dependence'].push(rpo);
            //路径过滤
            //这里的path如果有缓存则不进行作业
            //有缓存的、在完成队列里的，在等待队列里的都不加入下一次作业
            if(!this.cache[rpo.relativePath]&&this.transformList.indexOf(rpo.absolutePath)==-1&&this.finishList.indexOf(rpo.absolutePath)==-1)this.transformList.push(rpo.absolutePath);
          });
          l--;
          this.finishList.push(filePath);
          Log.debug(`完成路径${filePath}的解析，还差${l}个`);
        }
        if(l===0){
          Log.dev('一轮parse结束以后检查下一组队列',this.transformList)
          this.state = 'wait';//一轮flush结束
        }
      })
    })
  })

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
  //然后less,css也混进来了..
  if(filePath.match(/\.json$/i)){
    return {requirePath:[],code:jsFile};
  }
  else if(filePath.match(/\.less$/i)){
    Log.warn(`发现less文件${filePath}，应该调用less解析器转换code`);
    return {requirePath:[],code:jsFile};
  }
  else if(filePath.match(/\.css$/i)){
    Log.info(`发现css文件${filePath}，不做任何转换跳过`);
    return {requirePath:[],code:jsFile};
  }
  else{
    try {
      var babelResult = babel.transform(jsFile,opt);//这里是不是需要try catch
      var requirePath = requires_filter(babelResult.ast.program);
      Log.debug('在文件路径',filePath,'下','[获取的依赖]：',requirePath);
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
      //console.log('路径:',filePath,'收集到的依赖:',_requirePath)
      return {requirePath:_requirePath,code:code};
    }
  }
}

// 根据一个入口路径获取所有的模块
//不应该在parse状态下运行，否则不知道会得到什么东西
//path为相对文件路径
//cache里的键是相对路径，因此这里输入的路径为相对路径
Nest.prototype._getModulesByRelativePath = function(entity){
  var path = entity.path;
  var type = entity.type;
  if(this.state!=='idle')return Log.debug('在错误的状态下调用,_getJsFileByName',this.state);
  Log.dev(`申请${type}文件`,path);
  if(!this.cache.hasOwnProperty(path)){
    Log.warn('_getModulesByRelativePath 错误',path)
    return ''
  }
  var _module = {};
  var _inJsCssModule = {};
  var portal = path;
  var  _dep = function(path,cache){
    if(_module.hasOwnProperty(path))return
    //不要把css模块混入_module
    if(path.match(/\.css$/)){
      if(!_inJsCssModule.hasOwnProperty(path)){
        _inJsCssModule[path] = cache[path]
      }
    }
    _module[path] = cache[path];
    cache[path]['dependence'].forEach((rpo)=>{
      _dep(rpo.relativePath,cache);
    })
  };
  _dep(portal,this.cache);
  //console.log(Object.keys(_module));
  //console.log(`获取模块结果,入口${portal},模块${Object.keys(_module).length}个`);
  if(type === 'js'){
    var jsFile = shell.jsFile(portal,_module);
    return jsFile;
  }else if(type === 'in-js-css'){
    var cssFile = shell.cssFile(portal,_inJsCssModule);
    return cssFile;
  }

}
Nest.prototype._removeCacheByFilePath = function(filePath){
  //只能在空闲态下调用
  //要从完成列表里干掉这个路径
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
