module.exports = {
  babel:{
    presets:['es2015','stage-1','react'],
    plugins: [["antd", { "style": 'css' }]]
  },
  entry:'src/jsportal/*.js',
  output:{
    port:3020,
    map:[
      {
        urlPath:'/static/js/',
        filePath:'src'
      }
    ]
  },
  watch:{
    path:'src',
    extension:['.js','.jsx'],
    ignored:/\/\.\w+/
  },
  log:{
    level:'info'
  }
}
