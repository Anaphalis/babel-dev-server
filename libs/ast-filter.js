var Log = require('./log.js');
//从AST中提取信息
//参考https://github.com/estree/estree/blob/master/spec.md
//Functions 函数
//Statements 语句
//Declarations 声明
//Expressions：表达式
//Literal:字面量

function requires_filter(program,filePath){
  var ret = [];
  var _CallExpression = parse.CallExpression;
  var _Identifier = parse.Identifier;
  var _NewExpression = parse.NewExpression;
  var useBuffer = false;
  var isBufferModule = (filePath === 'node_modules/buffer/index.js');
  parse.CallExpression = function (obj){
    _CallExpression(obj);
    if(obj.callee.name === 'require'){
      if(obj.arguments[0].type === 'StringLiteral'){
        var path = obj.arguments[0].value;
        ret.push(path);
      }
    }
  }
  parse.Identifier = function(obj){
    _Identifier(obj);
    if(obj.name==='Buffer'){
      Log.debug('在标识符发现 Buffer');
      if(!isBufferModule)useBuffer = true;
    }
  }
  parse.NewExpression = function (obj){
    _NewExpression(obj);
    if(obj.callee.name==='Buffer'){
      Log.debug('发现 new Buffer');
      if(!isBufferModule)useBuffer = true;
    }
  }
  parse.Program(program);
  if(useBuffer)ret.push('buffer');
  Log.debug('收集到的依赖',ret);
  //还原借用
  parse.CallExpression = _CallExpression;
  parse.Identifier = _Identifier;
  parse.NewExpression = _NewExpression;
  return ret;
}



var parse = {};
parse._parse = function(obj,field){
  var _o = obj;
  if(field)_o = obj[field];
  //这里_o可能为null
  if(_o){
    if(!_o.type){
      return Log.warn(`发现特殊的语句,${obj}`)
    }
    if(!parse[_o.type]){
      //console.log(obj)
      return Log.warn(`Parse不存在的表达式类型,${_o.type}`)
    }
    parse[_o.type](_o);
  }
}
parse.Program = function(obj){
  Log.dev('Program')
  obj.body.forEach((_stat)=>{
    parse._parse(_stat)
  })
}
parse.FunctionDeclaration = function(obj){
  Log.dev('parse_function');
  parse._parse(obj,'body')
}

parse.BlockStatement = function (obj){
  Log.dev('BlockStatement')
  obj.body.forEach((_stat)=>{
    parse._parse(_stat)
  })
}
parse.Expression = function (obj){
  Log.dev('Expression');
  parse._parse(obj)
}
 parse.Statement = function(obj){
  Log.dev('Statement')
  parse._parse(obj)
}
parse.ExpressionStatement = function (obj){
  parse._parse(obj,'expression')
}

parse.WithStatement = function (obj){
  Log.error('发现with表达式，with表达式不应该被使用');
}
parse.ReturnStatement = function (obj){
  Log.dev('ReturnStatement')
  parse._parse(obj,'argument')
}
parse.LabeledStatement = function (obj){
  Log.dev('LabeledStatement');
  parse._parse(obj,'body')
}
parse.IfStatement = function (obj){
  Log.dev('IfStatement')
  parse._parse(obj,'test')
  parse._parse(obj,'consequent')
  parse._parse(obj,'alternate')
}
parse.SwitchStatement = function (obj){
  Log.dev('SwitchStatement')
  parse._parse(obj,'discriminant')
  obj.cases.forEach((_case)=>{
    parse._parse(_case)
  })
}
parse.SwitchCase = function (obj){
  Log.dev('SwitchCase')
  parse._parse(obj,'test')
  obj.consequent.forEach((_stat)=>{
    parse._parse(_stat);
  })
}
parse.ThrowStatement = function (obj){
  Log.dev('ThrowStatement')
  parse._parse(obj,'argument')
}
parse.TryStatement = function (obj){
  Log.dev('TryStatement')
  parse._parse(obj,'block')
  parse._parse(obj,'handler')
  parse._parse(obj,'finalizer')
}
parse.CatchClause = function (obj){
  Log.dev('CatchClause')
  parse._parse(obj,'body')
}
parse.WhileStatement = function (obj){
  Log.dev('WhileStatement')
  parse._parse(obj,'test')
  parse._parse(obj,'body')
}
parse.DoWhileStatement = function (obj){
  Log.dev('DoWhileStatement')
  parse._parse(obj,'test')
  parse._parse(obj,'body')
}
parse.ForStatement = function (obj){
  Log.dev('ForStatement')
  parse._parse(obj,'init')
  parse._parse(obj,'test')
  parse._parse(obj,'update')
  parse._parse(obj,'body')
}
parse.ForInStatement = function (obj){
  Log.dev('ForInStatement')
  parse._parse(obj,'left')
  parse._parse(obj,'right')
  parse._parse(obj,'body')
}
parse.VariableDeclaration = function (obj){
  Log.dev('VariableDeclaration')
  obj.declarations.forEach((vd)=>{
    parse._parse(vd)
  })
}
parse.VariableDeclarator = function (obj){
  Log.dev('VariableDeclarator')
  parse._parse(obj,'id')
  parse._parse(obj,'init')
}
parse.ArrayExpression = function (obj){
  Log.dev('ArrayExpression')
  if(obj.elements){
    obj.elements.forEach((ele)=>{
      parse._parse(ele)
    })
  }
}
parse.ObjectExpression = function (obj){
  Log.dev('ObjectExpression')
  if(obj.properties){
    obj.properties.forEach((prop)=>{
      parse._parse(prop)
    })
  }
}
parse.ObjectProperty = function (obj){
  Log.dev('ObjectProperty')
  parse._parse(obj,'key')
  parse._parse(obj,'value')
}
parse.FunctionExpression = function (obj){
  Log.dev('FunctionExpression');
  parse._parse(obj,'body')
}
parse.UnaryExpression = function (obj){
  Log.dev('UnaryExpression')
  //parse._parse(obj,'operator')
  parse._parse(obj,'argument')
}
parse.UpdateExpression = function (obj){
  //parse._parse(obj,'operator')
  parse._parse(obj,'argument')
}
parse.BinaryExpression = function (obj){
  //parse._parse(obj,'operator')
  parse._parse(obj,'left')
  parse._parse(obj,'right')
}
parse.AssignmentExpression = function (obj){
  Log.dev('AssignmentExpression')
  //parse._parse(obj,'operator')
  parse._parse(obj,'left')
  parse._parse(obj,'right')
}
parse.LogicalExpression = function (obj){
  //parse._parse(obj,'operator')
  parse._parse(obj,'left')
  parse._parse(obj,'right')
}
parse.MemberExpression = function (obj){
  Log.dev('MemberExpression');
  parse._parse(obj,'object')
  parse._parse(obj,'property')
}
parse.ConditionalExpression = function (obj){
  parse._parse(obj,'test')
  parse._parse(obj,'alternate')
  parse._parse(obj,'consequent')
}
parse.CallExpression = function (obj){
  parse._parse(obj,'test')
  parse._parse(obj,'callee')
  obj.arguments.forEach((exp)=>{
    parse._parse(exp);
  })
}
parse.NewExpression = function (obj){
  Log.dev('NewExpression');
  parse._parse(obj,'callee')
  obj.arguments.forEach((exp)=>{
    parse._parse(exp);
  })
}
parse.SequenceExpression = function (obj){
  Log.dev('SequenceExpression')
  obj.expressions.forEach((exp)=>{
    parse._parse(exp);
  })
}
parse.ObjectMethod = function (obj){
  Log.dev('ObjectMethod')
  parse._parse(obj,'key')
  parse._parse(obj,'body')
  obj.params.forEach((exp)=>{
    parse._parse(exp);
  })
}
parse.EmptyStatement = function (obj){}
parse.DebuggerStatement = function (obj){}
parse.BreakStatement = function (obj){}
parse.ContinueStatement = function (obj){}
parse.ThisExpression = function (obj){}
parse.UnaryOperator = function (obj){}
parse.UpdateOperator = function (obj){}
parse.BinaryOperator = function (obj){}
parse.LogicalOperator = function (obj){}
parse.Pattern = function (obj){}
parse.Identifier = function(obj){}
parse.StringLiteral = function(obj){}
parse.RegExpLiteral = function(obj){}
parse.BooleanLiteral = function(obj){}
parse.NullLiteral = function(obj){}
parse.NumericLiteral = function(obj){}
exports.requires_filter = requires_filter;
