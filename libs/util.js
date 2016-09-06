var PATH = require('path');
exports.forceUnixFilePath = function forceUnixFilePath (path) {
  //将window文件路径转化成linux格式
  return path.split(PATH.sep).join('/')
};
