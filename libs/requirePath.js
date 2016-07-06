//一个路径有多种形态
//1.require时的引用路径
//2.绝对路径
//3.相对路径
var fs = require('fs');
var PATH = require('path');
var buildinMap = require('./buildin.js').buildinMap;
var Log = require('./log.js');
var Exception = require('./exception.js');
function RequirePath (opts){
  this.rootPath = opts.rootPath;//工程根目录
  this.storePath = opts.storePath;//node_modules目录
  this.refPath = opts.refPath;//在文件中的引用路径
  this.filePath = opts.filePath;//被引用的文件
  //获取绝对路径和相对路径
  this.absolutePath = this._formatPathBefore(this.refPath,this.filePath);//这个路径用来放进transformList来解析文件
  this.relativePath = PATH.relative(this.rootPath,this.absolutePath)
  //refPath有多种写法，而且是相对某文件路径,relativePath是相对于工程根目录的路径，能够让文件路径统一
}
//前处理，加上绝对路径，但是末尾没有文件扩展名的路径还需要处理
//模块来自node_modules的路径要加上前面的路径
RequirePath.prototype._formatPathBefore = function(path,filePath){
  var _path = '';
  var rootPath = this.rootPath;
  var storePath = this.storePath;
  if(!path||!filePath)return;
  //获filePath的目录
  var dir = PATH.dirname(filePath);
  //怎么判断是来自仓库的模块,末尾不是.js/node/json结束，头部不是window路径和unix路径
  if(path.match(/^(\/|\w:\\|\.)/)){
    //相对路径，不是来自仓库
    _path = PATH.resolve(dir,path)

  }else{
    //来自仓库，用storePath和当前路径拼接
    _path = PATH.resolve(storePath,path);
  }
  var __path = this._formatPathAfter(_path);

  var ___path = PATH.relative(rootPath,__path);//相对化，不怕暴露本机目录可以去掉
  return __path;
}
RequirePath.prototype._formatPathAfter =  function (path){
  //console.log('路径后处理',path)
  //格式化路径，这个步骤在路径绝对化之后,解决以下问题
  //1.路径末尾没有.js，这时应该是直接加上js，还是应该去找下一级的index.js，这太傻逼了
  //为了这个要把每个文件都确定一遍，时间都花这上面太傻逼了，需要建立缓存
  //为了防止多种写法其实指向同一路径，每种写法都做了自己的缓存，还是要把这个解析出来，草了
  //优先级 path.js|path.node|path.json|path/package.json->main|path/index.js|path/index.node|path/index.json|throw error
  if(path.match(/\.(js|node|json|less|css)$/))return path;//完整路径直接返回
  //这里使用同步,首先要过内建列表的映射，来自browserify/lib/builtins.js
  path = buildinMap(path,this.storePath);
  if(fs.existsSync(path+'.js'))return path+'.js';
  if(fs.existsSync(path+'.node'))return path+'.node';
  if(fs.existsSync(path+'.json'))return path+'.json';
  if(fs.existsSync(PATH.resolve(path,'package.json'))){
    //console.log('fuck',PATH.resolve(path,'package.json'));
    try {
      var json = JSON.parse(fs.readFileSync(PATH.resolve(path,'package.json')).toString());
      var _path = json.browser||json.main;
      if(_path){
        if(fs.existsSync(PATH.resolve(path,_path)))return PATH.resolve(path,_path)
        if(fs.existsSync(PATH.resolve(path,_path+'.js')))return PATH.resolve(path,_path+'.js')
      }
      //可以考虑信任package.json,去掉上面一句
    } catch (e) {
      Log.error('解析模块',path,'的package.json错误,但并不一定影响获取包文件，一般是因为不规范的package.json写法造成 ',e);
    } finally {
    }
  }
  if(fs.existsSync(PATH.resolve(path,'index.js')))return PATH.resolve(path,'index.js');
  if(fs.existsSync(PATH.resolve(path,'index.node')))return PATH.resolve(path,'index.node');
  if(fs.existsSync(PATH.resolve(path,'index.json')))return PATH.resolve(path,'index.json');
  //这里还有一种可能，就是Node内置模块
  var name = PATH.basename(path);
  Log.error('路径解析失败，没有符合条件的路径',path);
  throw new Error('路径错误，中断运行');
}
module.exports = RequirePath
