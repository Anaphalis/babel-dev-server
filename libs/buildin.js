//fork from browserify
//need npm install browserify
//!!!!!注意：内建路径不要加.js !!!!!!!!
var Log = require ('./log.js')
var _map = {
  assert:'assert/',
  buffer:'buffer/',
  child_process:'./_empty',
  cluster:'browserify/lib/_empty',
  console:'console-browserify',
  constants:'constants-browserify',
  crypto:'crypto-browserify',
  dgram:'browserify/lib/_empty',
  dns:'browserify/lib/_empty',
  domain:'domain-browser',
  events:'events/',
  fs:'browserify/lib/_empty',
  http:'stream-http',
  https:'https-browserify',
  module:'browserify/lib/_empty',
  net:'browserify/lib/_empty',
  os:'os-browserify/browser',
  path:'path-browserify',
  punycode:'punycode/',
  querystring:'querystring-es3/',
  readline:'browserify/lib/_empty',
  repl:'browserify/lib/_empty',
  stream:'stream-browserify',
  _stream_duplex:'readable-stream/duplex',
  _stream_passthrough:'readable-stream/passthrough',
  _stream_readable:'readable-stream/readable',
  _stream_transform:'readable-stream/transform',
  _stream_writable:'readable-stream/writable',
  string_decoder:'string_decoder/',
  sys:'util/util',
  timers:'timers-browserify',
  tls:'browserify/lib/_empty',
  tty:'tty-browserify',
  url:'url/',
  util:'util/util',
  vm:'vm-browserify',
  zlib:'browserify-zlib',
  _process:'process/browser'
}
//!!!!!注意：内建路径不要加.js !!!!!!!!
var PATH = require('path');
!function checkMap(map){
  Object.keys(map).forEach((key)=>{
    if(map[key].match(/\.js$/))throw 'buildin map error,dont end with .js'
  })
}(_map)

function buildinMap(path,storePath){
  if(!path)return path;
  var dirname = PATH.dirname(path);
  var basename = PATH.basename(path);
  if(_map[basename]&&storePath===dirname){
    var _path = PATH.resolve(dirname,_map[basename]);
    Log.debug('转换成内建模块路径',_path);
    return _path;
  }
  return path;
}
exports.buildinMap = buildinMap;
