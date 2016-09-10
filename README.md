# babel-dev-server

  之前在项目中使用了gulp+browserify+es6做前端工程化，模块增加到上百个以后，browserify转换代码很慢，大概要8秒以上。开发中肯定会经常保存，每次保存用8秒时间编译，体验非常差，整个团队日积月累浪费的时间也不是小数目。因此有了做优化的想法，主要思路就是：
    1. 虽然模块总数很多，但是每一时刻被修改的模块只有一个，所以应该只重新编译被修改的模块，而不应该重新编译所有模块
    2. 被修改的模块可能增加了新的依赖，但是增加大量依赖并不是开发的常态，是非常小概率的事件，因此只编译、分析被修改的那一个模块可以大幅增加开发效率
    3. 编译后的js其实没必要写入文件系统。把js写入文件系统，js被请求的时候再从文件系统中读出，再通过http发送，这是多此一举。如果不写入文件系统，就可以把编译好的js按模块缓存起来，根据http请求实时合并js并返回
    4. 为保证不会返回正在编译中的模块，使用状态机进行调度
    5. 同时支持发布模式，将转换后的js以各种格式(比如vinyl-stream)输出，交给后面的插件处理。

  最后确实达到了目的，除了启动时的第一次编译需要秒级的时间，添加依赖超多的模块，如react时需要秒级时间，平时开发编译均为毫秒级时间完成，发布模式可以输出vinyl-stream,gulp插件可以直接处理此流。

###  更新v0.19
  最近项目里使用了react和css module,css也可以通过require来引用，因此在依赖分析、实时编译、代码输出中加入了css。输出的js里引用到的css会以[jsfilename]-in-app-css.css的方式输出，发布时同样支持后续处理

### 安装
> npm install babel-dev-server

### 配置示例
``` js
module.exports = {
  babel:{
    presets:['es2015','stage-1','react'],
    plugins: [["antd", { "style": 'css' }]]
  },
  entry:'client/src/page/*.js',
  output:{
    port:3029,
    map:[
      {
        urlPath:'/static/js/',
        filePath:'client/src'
      }
    ]
  },
  watch:{
    path:['client/src','libs'],
    extension:['.js','.jsx','.css'],
    ignored:/\/\.\w+/
  },
  log:{
    level:'info'
  }
}
```

### gulp发布示例
``` js
  var gulp = require('gulp');
  var server = require('babel-dev-server');
  var bdsConfig = require('./dev-config.js');
  var cleanCSS = require('gulp-clean-css');
  var uglify = require('gulp-uglify');
  var pump = require('pump');//使用pump监测流数据消费结束
  gulp.task('dev',function() {
    server(bdsConfig);
  });
  gulp.task('transform',function(cb){
    bdsConfig.output.exportFormat = 'vinyl-stream';
    server.output(bdsConfig,function(jsstream,cssstream){
      var jsFin,cssFin;
      pump([
        jsstream,
        uglify(),
        gulp.dest('./client/dist/static/js/page/')
      ],function(){
        jsFin = true;
        next();
      });
      pump([
        cssstream,
        cleanCSS(),
        gulp.dest('./client/dist/static/js/page/')
      ],function(){
        cssFin = true;
        next()
      })
      function next(){
        if(jsFin&&cssFin){
          console.log('transform完成');
          cb();
        }
      }
    })
  })
  ```
