function wrap (path,module){
  var ref = {};
  var buffer = '';
  module.dependence.forEach((rpo)=>{
    ref[rpo['refPath']] = rpo['relativePath'];
    if(rpo['refPath'] === 'buffer') buffer = `var Buffer = require('buffer');\r\n`;
  })
  var _code = function(){
    if(path.match(/\.css/)){
      return ''
    }else {
      return module.code
    }
  }
  return `_modules['${path}'] = {exec:function(require,module,exports){
            ${buffer}
            ${_code()}
          },module:{exports:{}},ref:${JSON.stringify(ref)}};\r\n`
}
function head (){
  return `var _modules = Object.create(null);
          var process = {env:{NODE_ENV:''}};
          var global = {};
          function require(refPath){
            var relativePath = this.ref[refPath];
             //console.log(refPath,this.ref);
            if(_modules[relativePath].ready)return _modules[relativePath].module.exports;
            return _exec(relativePath)
          }
          function _exec(relativePath){
             //console.log('_exec',relativePath)
            var _module = _modules[relativePath].module;
            if(_modules[relativePath].working){
              //console.log('模块已经在执行中，不能再次执行',_module.exports,relativePath);
              return _module.exports
            }
            _modules[relativePath].working = true;
            _modules[relativePath].exec(require.bind(_modules[relativePath]),_module,_module.exports);
            _modules[relativePath].ready = true;
            _modules[relativePath].working = false;
            return _module.exports;
          }\n\r`

}
function all (head,module,portal){

  return `(function(portal){
            ${head}
            ${module.join('\r\n')}
            _exec(portal);
          })('${portal}');`
}
function jsFile (portal,modules){
  var _modules = [];
  Object.keys(modules).forEach((path)=>{
    _modules.push(wrap(path,modules[path]));
  })

  return all(head(),_modules,portal);
}
function cssFile (portal,modules){
  var head = `/*** generate by Babel-Dev-Server ***/`;
  var _codes = [];
  Object.keys(modules).forEach((path)=>{
    _codes.push(modules[path].code);
  })
  return `${head}\r\n${_codes.join('\r\n')}`
}
exports.jsFile = jsFile;
exports.cssFile = cssFile;
