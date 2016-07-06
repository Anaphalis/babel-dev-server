var http = require('http');
var URL = require('url');
var PATH = require('path');
var Log = require('./log.js');
function Output (opts) {
  this.nest = opts.nest;
  this.config = opts.config;
  var port = this.port = this.config.port;
  var urlMap = this.urlMap = this.config.map;
  urlMap.forEach((obj)=>{
    var jsDir = obj.urlPath;
    obj.jsPattern = new RegExp(jsDir+'(.*)\\.js$');//这里限制了只能获取js文件
    obj.cssPattern = new RegExp(jsDir+'(.*)-in-js-css\\.css$')
  })
  this.server = http.createServer((req,res)=>{
    var url = req.url;
    if(url.match(/\.css/)){
      this.sendCSS(url,req,res)
    }else if(url.match(/\.js/)){
      this.sendJS(url,req,res)
    }else{
      this.sendError(url,req,res)
    }
    //根据路由找入口文件，根据入口文件拿js字符串回传
  })
  this.server.listen(port);
  Log.info('server listen on '+ port);
}
Output.prototype.sendCSS = function(url,req,res){
  var jsName = '',urlMap = this.urlMap;
  for(var i = 0,l = urlMap.length;i<l;i++){
    var _jsName = req.url.match(urlMap[i].cssPattern);
    if(_jsName){
      jsName = PATH.join(urlMap[i].filePath,_jsName[1])+'.js';
    }
  }
  if(jsName){
    Log.dev('申请in-js-cssFile',jsName);
    console.time('cssFile');
    this.nest.pushOrder({type:'getFile',entity:{path:jsName,type:'in-js-css'},callback:(result)=>{
      if(!result)result = `缓存不存在：${jsName}`
      console.timeEnd('cssFile');
      res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Server':'Babel-Dev-Server'});
      res.write(result);
      res.end();
    }})
  }else{
    this.sendError(url,req,res);
  }


}
Output.prototype.sendJS = function(url,req,res){
  var jsName = '',urlMap = this.urlMap;
  for(var i = 0,l = urlMap.length;i<l;i++){
    var _jsName = req.url.match(urlMap[i].jsPattern);
    if(_jsName){
      jsName = PATH.join(urlMap[i].filePath,_jsName[1])+'.js';
    }
  }
  if(jsName){
    Log.dev('申请JsFile',jsName);
    console.time('JsFile');
    this.nest.pushOrder({type:'getFile',entity:{path:jsName,type:'js'},callback:(result)=>{
      if(!result)result = `缓存不存在：${jsName}`
      console.timeEnd('JsFile');
      res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Server':'Babel-Dev-Server'});
      res.write(result);
      res.end();
    }})
  }else{
    this.sendError(url,req,res);
  }
}
Output.prototype.sendError = function(url,req,res){
  res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Server':'Babel-Dev-Server'});
  res.write('请求路径错误');
  res.end();
}
module.exports = Output;
