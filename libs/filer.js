var glob = require('glob');
var Log = require('./log.js');
function getFiles(pattern){
  return new Promise((resolve,reject)=>{
    glob(pattern,(err,files)=>{
      if(err){
        throw err
      }else{
        //console.log(pattern,'--->',files);
        resolve(files);
      }
    })
  })
}
function isNegative(pattern) {
  if (typeof pattern !== 'string') throw 'pattern error :'+ pattern;
  if (pattern[0] === '!') return true;
  return false;
}

function Filer(patterns){
  console.time('Filer');
  return new Promise((resolve)=>{
    if(!patterns)patterns = [];
    if(!Array.isArray(patterns))patterns = [patterns];
    var positives = [];
    var negatives = [];
    patterns.forEach((pattern)=>{
      if(isNegative(pattern)){
        negatives.push(pattern.slice(1));
      }else{
        positives.push(pattern);
      }
    })
    //得到了确定组和否定组
    var qsp = [],qsn = [];
    positives.forEach((p)=>{
      qsp.push(getFiles(p))
    })
    negatives.forEach((n)=>{
      qsn.push(getFiles(n))
    })
    var set = new Set();
    Promise.all(qsp).then((result)=>{
      //console.log(result);
      result.forEach((arr)=>{
        arr.forEach((path)=>{
          set.add(path)
        })
      })
      return Promise.all(qsn);
    }).catch((err) => {console.log(err)})
    .then((result)=>{
      //console.log(result);
      result.forEach((arr)=>{
        arr.forEach((path)=>{
          set.delete(path)
        })
      })
      //console.log(set);
      console.timeEnd('Filer');
      resolve(set)
    })
  })
}
exports.Filer = Filer;
//Filer('src/**/*');
