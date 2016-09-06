var Filer = require('./../filer.js').Filer;
var Log = require('./../log.js');
var stream = require('stream');
var PATH = require('path');
var File = require('vinyl');
var through = require('through2');
function PluginOutput(opts){
  //先连接原型后执行构造器
  Log.dev(opts.nest.state,opts.nest.pushOrder);
  Log.dev(opts.config.entry);
  var retjs = {},retcss = {};
  Filer([opts.config.entry]).then((set)=>{
    Log.info(set);
    var l = set.size;
    var finished = 0;
    set.forEach((relativeFilePath)=>{
      //这里要把相对路径转成绝对路径
      relativeFilePath = PATH.normalize(relativeFilePath);
      opts.nest.pushOrder({
        type:'getFile',
        entity:{path:relativeFilePath,type:'js'},
        callback:(result)=>{
          var rs = new Buffer(result);
          //使用绝对路径输出
          retjs[PATH.resolve(opts.rootPath,relativeFilePath)] = rs;
          _next();
        }
      });
      opts.nest.pushOrder({
        type:'getFile',
        entity:{path:relativeFilePath,type:'in-js-css'},
        callback:(result)=>{
          var rs = new Buffer(result);
          //使用绝对路径输出,要把结尾的.js换成.css
          var jsPath = PATH.resolve(opts.rootPath,relativeFilePath);
          var inJsCssPath = jsPath.replace(/\.js$/,'-in-js-css.css');
          retcss[inJsCssPath] = rs;
          _next();
        }
      });
    });
    function _next () {
      finished++;
      Log.info(`获取输出的js和css,总共${2*l}个,完成${finished}个,exportFormat:${opts.config.exportFormat}`);
      if(finished === 2 * l){
        Log.debug(Object.keys(retjs),Object.keys(retcss));
        var jsResult = format(retjs,opts.config.exportFormat);
        var cssResult = format(retcss,opts.config.exportFormat);
        opts.config.next(jsResult,cssResult);
      }
    }
  })
}


function format(obj,type) {
  if(!type)return obj;
  if(type === 'vinyl-stream'){
    return ObjToVinylStream(obj);
  }
}

function ObjToVinylStream (obj) {
  var files = obj;
  var filePaths = Object.keys(files);
  var retStream = through.obj(function (data, enc, next) {

    if(data.end == 'end'){
      Log.info(`vinyl-stream流结束`)
      //手动输入一个流结束标志
      this.push(null)
    }else{
      Log.info(`准备vinyl-stream流,${data.path}`)
      this.push(data)
    }
    next()
  });
  //1.将对象里的每个文件路径建立Vinyl对象
  //1.1获取绝对路径
  filePaths.forEach((filePath)=>{
    var vFile = new File({
      path:filePath,
      contents:files[filePath],
      //base://path、cwd、base设置两个即可
      cwd:PATH.dirname(filePath)//切换cwd,确保base是不带路径的文件名
    });
    //console.log(vFile)
    retStream.write(vFile);
  });
  //retStream.write(null)
  retStream.write({end:'end'});
  return retStream;

}

module.exports = PluginOutput;
