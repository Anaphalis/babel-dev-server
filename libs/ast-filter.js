var Log = require('./log.js');
//从AST中提取信息
//参考https://github.com/estree/estree/blob/master/spec.md
//Functions 函数
//Statements 语句
//Declarations 声明
//Expressions：表达式
//Literal:字面量

function requires_filter(program){
  var ret = [];
  var _CallExpression = parse.CallExpression;
  var _Identifier = parse.Identifier;
  var _NewExpression = parse.NewExpression;
  var useBuffer = false;
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
      useBuffer = true;
    }
  }
  parse.NewExpression = function (obj){
    _NewExpression(obj);
    if(obj.callee.name==='Buffer'){
      Log.debug('发现 new Buffer');
      useBuffer = true;
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
parse.Program = function(obj){
  Log.dev('Program')
  obj.body.forEach((_stat)=>{
    parse.Statement(_stat)
  })
}
parse.FunctionDeclaration = function(obj){
  Log.dev('parse_function');
  parse.BlockStatement(obj.body)
}

parse.BlockStatement = function (obj){
  Log.dev('BlockStatement')
  obj.body.forEach((_stat)=>{
    parse.Statement(_stat)
  })
}
parse.Expression = function (obj){
  var type = obj.type;
  if(!parse[type])return Log.warn(`Parse Expression不存在的表达式类型,${type}`)
  parse[type](obj);
}
 parse.Statement = function(obj){
  var type = obj.type;
  if(!parse[type])return Log.warn(`Parse Statement不存在的语句类型,${type}`);
  parse[type](obj);
}
parse.ExpressionStatement = function (obj){
  parse.Expression(obj.expression)
}

parse.WithStatement = function (obj){
  Log.error('发现with表达式，with表达式不应该被使用');
}
parse.ReturnStatement = function (obj){
  Log.dev('ReturnStatement')
  if(obj.argument&&obj.argument.type==='Expression'){
    parse.Expression(obj.argument)
  }
}
parse.LabeledStatement = function (obj){
  Log.dev('LabeledStatement');
  parse.Statement(obj.body)
}
parse.IfStatement = function (obj){
  Log.dev('IfStatement')
  if(obj.test)parse.Expression(obj.test);
  parse.Statement(obj.consequent);
  if(obj.alternate&&obj.alternate.type==='Statements'){
    parse.Statement(obj.alternate);
  }
}
parse.SwitchStatement = function (obj){
  Log.dev('SwitchStatement')
  parse.Expression(obj.discriminant);
  obj.cases.forEach((_case)=>{
    parse.SwitchCase(_case)
  })
}
parse.SwitchCase = function (obj){
  Log.dev('SwitchCase')
  if(obj.test)parse.Expression(obj.test);
  obj.consequent.forEach((_stat)=>{
    parse.Statement(_stat);
  })
}
parse.ThrowStatement = function (obj){
  Log.dev('ThrowStatement')
  parse.Expression(obj.argument);
}
parse.TryStatement = function (obj){
  Log.dev('TryStatement')
  parse.BlockStatement(obj.block);
  if(obj.handler)parse.CatchClause(obj.handler);
  if(obj.finalizer)parse.BlockStatement(obj.finalizer);
}
parse.CatchClause = function (obj){
  Log.dev('CatchClause')
  //parse.Pattern(obj.param);
  parse.BlockStatement(obj.body);
}
parse.WhileStatement = function (obj){
  Log.dev('WhileStatement')
  if(obj.test)parse.Expression(obj.test);
  parse.Statement(obj.body);
}
parse.DoWhileStatement = function (obj){
  Log.dev('DoWhileStatement')
  if(obj.test)parse.Expression(obj.test);
  parse.Statement(obj.body);
}
parse.ForStatement = function (obj){
  Log.dev('ForStatement')
  if(obj.init){
    var init = obj.init;
    if(init.type==='VariableDeclaration'){
      parse.VariableDeclaration(init);
    }
    if(init.type==='Expression'){
      parse.Expression(init);
    }
  }
  if(obj.test)parse.Expression(obj.test);
  if(obj.update)parse.Expression(obj.update);
  parse.Statement(obj.body);
}
parse.ForInStatement = function (obj){
  Log.dev('ForInStatement')
  if(obj.left.type==='VariableDeclaration'){
    parse.VariableDeclaration(obj.left);
  }
  if(obj.left.type==='Pattern'){
    parse.Pattern(obj.left);
  }
  parse.Expression(obj.right);
  parse.Statement(obj.body);
}
parse.VariableDeclaration = function (obj){
  Log.dev('VariableDeclaration')
  obj.declarations.forEach((vd)=>{
    parse.VariableDeclarator(vd)
  })
}
parse.VariableDeclarator = function (obj){
  Log.dev('VariableDeclarator')
  parse.Pattern(obj.id);
  if(obj.init)parse.Expression(obj.init);
}
parse.ArrayExpression = function (obj){
  Log.dev('ArrayExpression')
  if(obj.elements){
    obj.elements.forEach((ele)=>{
      parse.Expression(ele)
    })
  }
}
parse.ObjectExpression = function (obj){
  Log.dev('ObjectExpression')
  if(obj.properties){
    obj.properties.forEach((prop)=>{
      parse.Property(prop)
    })
  }
}
parse.Property = function (obj){
  Log.dev('Property')
  if(obj.key.type.match(/Literal/))parse[obj.key.type](obj.key);
  if(obj.key.type==='Identifier')parse.Identifier(obj.key);
  if(obj.value)parse.Expression(obj.value)
}
parse.FunctionExpression = function (obj){
  Log.dev('FunctionExpression');
  parse.BlockStatement(obj.body)
}
parse.UnaryExpression = function (obj){
  Log.dev('UnaryExpression')
  //parse.UnaryOperator(obj.operator)
  parse.Expression(obj.argument)
}
parse.UpdateExpression = function (obj){
  //parse.UpdateOperator(obj.operator)
  parse.Expression(obj.argument)
}
parse.BinaryExpression = function (obj){
  //parse.BinaryOperator(obj.operator)
  parse.Expression(obj.left);
  parse.Expression(obj.right);
}
parse.AssignmentExpression = function (obj){
  //parse.AssignmentOperator(obj.operator)
  if(obj.left.type==='Expression')parse.Expression(obj.left);
  if(obj.left.type==='Pattern')parse.Pattern(obj.left);
  parse.Expression(obj.right);
}
parse.LogicalExpression = function (obj){
  //parse.LogicalOperator(obj.operator)
  parse.Expression(obj.left);
  parse.Expression(obj.right);
}
parse.MemberExpression = function (obj){
  Log.dev('MemberExpression')
  parse.Expression(obj.object);
  parse.Expression(obj.property);
}
parse.ConditionalExpression = function (obj){
  if(obj.test)parse.Expression(obj.test);
  parse.Expression(obj.alternate);
  parse.Expression(obj.consequent);
}
parse.CallExpression = function (obj){
  //console.log('函数调用',obj);
  if(obj.test)parse.Expression(obj.test);
  parse.Expression(obj.callee);
  obj.arguments.forEach((exp)=>{
    parse.Expression(exp);
  })
}
parse.NewExpression = function (obj){
  Log.dev('NewExpression');
  parse.Expression(obj.callee);
  obj.arguments.forEach((exp)=>{
    parse.Expression(exp);
  })
}
parse.SequenceExpression = function (obj){
  Log.dev('SequenceExpression')
  obj.expressions.forEach((exp)=>{
    parse.Expression(exp);
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
