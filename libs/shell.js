function wrap (path,module){
  var ref = {};
  var buffer = '';
  module.dependence.forEach((rpo)=>{
    ref[rpo['refPath']] = rpo['relativePath'];
    if(rpo['refPath'] === 'buffer') buffer = `var Buffer = require('buffer');\r\n`;
  })

  return `_modules['${path}'] = {exec:function(require,module,exports){
            ${buffer}
            ${module.code}
          },module:{exports:{}},ref:${JSON.stringify(ref)}};\r\n`
}
function head (){
  return `var _modules = Object.create(null);
          var global = {};
          function require(refPath){
            var relativePath = this.ref[refPath];
            if(_modules[relativePath].ready)return _modules[relativePath].module.exports;
            return _exec(relativePath)
          }
          function _exec(relativePath){
            var _module = _modules[relativePath].module;
            _modules[relativePath].exec(require.bind(_modules[relativePath]),_module,_module.exports);
            _modules[relativePath].ready = true;
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
exports.jsFile = jsFile;
