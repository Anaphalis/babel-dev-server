var http = require('http');
var URL = require('url');
var PATH = require('path');
var Log = require('./log.js');
function Output (opts) {
  this.nest = opts.nest;
  this.config = opts.config;
  var port = this.config.port;
  var urlMap = this.config.map;
  urlMap.forEach((obj)=>{
    var jsDir = obj.urlPath;
    obj.jsPattern = new RegExp(jsDir+'(.*\\.js)$');//这里限制了只能获取js文件
  })
  this.server = http.createServer((req,res)=>{
    var jsName = '';
    for(var i = 0,l = urlMap.length;i<l;i++){
      var _jsName = req.url.match(urlMap[i].jsPattern);
      if(_jsName){
        jsName = PATH.join(urlMap[i].filePath,_jsName[1]);
      }
    }
    if(jsName){
      Log.dev('申请JsFile',jsName);
      console.time('JsFile');
      this.nest.pushOrder({type:'getFile',entity:jsName,callback:(result)=>{
        if(!result)result = `缓存不存在：${jsName}`
        console.timeEnd('JsFile');
        res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Server':'HMR'});
        res.write(result);
        res.end();
      }})
    }else{
      res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Server':'HMR'});
      res.write('请求路径错误');
      res.end();
    }
    //根据路由找入口文件，根据入口文件拿js字符串回传
  })

  this.server.listen(port);
  Log.info('server listen on '+ port);
}
module.exports = Output;
