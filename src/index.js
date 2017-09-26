/*
	reference: 
	https://github.com/paperjs/paper.js/blob/develop/src/core/PaperScript.js
*/

var acorn = require('acorn');

var minamike = function(codeFunc, option = {}){
	
	var m = codeFunc.toString().match(/{[\s\S]*}/);
	if(!m || !m.length){
		console.warn("code is invalid : " + m.toString() );
		return;
	}

	var code = m[0].slice(1, -1);

	this.compiledCode = "";

	var insertions = [];

	var params = [], args = [];

	var logLines = "";

	if(option.debug)
	{
		this.debug = true;
	}

	minamike.prototype.exec = function(scope){

		scope = scope || this;
		
		return (Function(params, this.compile())).apply(scope ,args);

	}

	minamike.prototype.getLogLines = function(){

		return logLines;

	}

	minamike.prototype.clearLogLines = function(){

		logLines = "";

	}

	minamike.prototype.compile = function(){

		if(this.debug)
		{

			code = code.replace(/console\.log/g, "__debugLog__");

		}
		
		walkAST(acorn.parse(code, { ranges: true, preserveParens: true }));	

		function expose(scope, hidden) {
	        // Look through all enumerable properties on the scope and expose
	        // these too as pseudo-globals, but only if they seem to be in use.
	        for (var key in scope) {
	            // Next to \b well also need to match \s and \W in the beginning
	            // of $__, since $ is not part of \w. And that causes \b to not
	            // match ^ longer, so include that specifically too.
	            if ((hidden || !/^_/.test(key)) && new RegExp('([\\b\\s\\W]|^)'
	                    + key.replace(/\$/g, '\\$') + '\\b').test(code)) {
	                params.push(key);
	                args.push(scope[key]);
	            }
	        }
	    }

    	expose({ __$__: __$__, $__: $__, __debugLog__, __debugLog__}, true);

		return code;
	}

	

	 // Converts an original offset to the one in the current state of the
    // modified code.
    function getOffset(offset) {
        // Add all insertions before this location together to calculate
        // the current offset
        for (var i = 0, l = insertions.length; i < l; i++) {
            var insertion = insertions[i];
            if (insertion[0] >= offset)
                break;
            offset += insertion[1];
        }
        return offset;
    }

    // Returns the node's code as a string, taking insertions into account.
    function getCode(node) {
        return code.substring(getOffset(node.range[0]),
                getOffset(node.range[1]));
    }

    // Returns the code between two nodes, e.g. an operator and white-space.
    function getBetween(left, right) {
        return code.substring(getOffset(left.range[1]),
                getOffset(right.range[0]));
    }

    // Replaces the node's code with a new version and keeps insertions
    // information up-to-date.
    function replaceCode(node, str) {
        var start = getOffset(node.range[0]),
            end = getOffset(node.range[1]),
            insert = 0;
        // Sort insertions by their offset, so getOffest() can do its thing
        for (var i = insertions.length - 1; i >= 0; i--) {
            if (start > insertions[i][0]) {
                insert = i + 1;
                break;
            }
        }
        insertions.splice(insert, 0, [start, str.length - end + start]);
        code = code.substring(0, start) + str + code.substring(end);
    }
 

	 function walkAST(node, parent) {
        if (!node)
            return;
        // The easiest way to walk through the whole AST is to simply loop
        // over each property of the node and filter out fields we don't
        // need to consider...
        for (var key in node) {
            if (key === 'range' || key === 'loc')
                continue;
            var value = node[key];
            if (Array.isArray(value)) {
                for (var i = 0, l = value.length; i < l; i++)
                    walkAST(value[i], node);
            } else if (value && typeof value === 'object') {
                // We cannot use Base.isPlainObject() for these since
                // Acorn.js uses its own internal prototypes now.
                walkAST(value, node);
            }
        }
        switch (node.type) {
        case 'UnaryExpression': // -a
            if (node.argument.type !== 'Literal') {
                var arg = getCode(node.argument);
                replaceCode(node, '$__("' + node.operator + '", '
                        + arg + ')');
            }
            break;
        case 'BinaryExpression': // a + b, a - b, a / b, a * b, a == b, ...
            if (node.left.type !== 'Literal') {
                var left = getCode(node.left),
                    right = getCode(node.right),
                    between = getBetween(node.left, node.right),
                    operator = node.operator;
                replaceCode(node, '__$__(' + left + ','
                        // To preserve line-breaks, get the code in between
                        // left & right, and replace the occurrence of the
                        // operator with its string counterpart:
                        + between.replace(new RegExp('\\' + operator),
                            '"' + operator + '"')
                        + ', ' + right + ')');
            }
            break;
        case 'UpdateExpression': // a++, a--, ++a, --a
        case 'AssignmentExpression': /// a += b, a -= b
            var parentType = parent && parent.type;
            if (!(
                    // Filter out for statements to allow loop increments
                    // to perform well
                    parentType === 'ForStatement'
                    // We need to filter out parents that are comparison
                    // operators, e.g. for situations like `if (++i < 1)`,
                    // as we can't replace that with
                    // `if (__$__(i, "+", 1) < 1)`
                    // Match any operator beginning with =, !, < and >.
                    || parentType === 'BinaryExpression'
                        && /^[=!<>]/.test(parent.operator)
                    // array[i++] is a MemberExpression with computed = true
                    // We can't replace that with array[__$__(i, "+", 1)].
                    || parentType === 'MemberExpression' && parent.computed
            )) {
                if (node.type === 'UpdateExpression') {
                    var arg = getCode(node.argument),
                        exp = '__$__(' + arg + ', "' + node.operator[0]
                                + '", 1)',
                        str = arg + ' = ' + exp;
                    // If this is not a prefixed update expression
                    // (++a, --a), assign the old value before updating it.
                    if (!node.prefix
                            && (parentType === 'AssignmentExpression'
                                || parentType === 'VariableDeclarator')) {
                        // Handle special issue #691 where the old value is
                        // assigned to itself, and the expression is just
                        // executed after, e.g.: `var x = ***; x = x++;`
                        if (getCode(parent.left || parent.id) === arg)
                            str = exp;
                        str = arg + '; ' + str;
                    }
                    replaceCode(node, str);
                } else { // AssignmentExpression
                    if (/^.=$/.test(node.operator)
                            && node.left.type !== 'Literal') {
                        var left = getCode(node.left),
                            right = getCode(node.right),
                            exp = left + ' = __$__(' + left + ', "'
                                + node.operator[0] + '", ' + right + ')';
                        // If the original expression is wrapped in
                        // parenthesis, do the same with the replacement:
                        replaceCode(node, /^\(.*\)$/.test(getCode(node))
                                ? '(' + exp + ')' : exp);
                    }
                }
            }
            break;
        }
    }

	// Binary Operator Handler
    function __$__(left, operator, right) {
       	if(right == null
            || left == null 
            || right.constructer !== left.constructer 
            || !right.__operators__ 
            || !right.__operators__[operator])
		{
            return (Function(['right', 'left'], `return  left  ${operator} right`))
                .call(this, right, left);
		}

		return right.__operators__[operator](left, right);
    }

    // Unary Operator Handler
    function $__(operator, value) {
      
       if(value && value.__unary_operators__ && value.__unary_operators__[operator])
       {
       	return value.__unary_operators__[operator]();
       }

       return value;
    }

    function __debugLog__(log){
    	
    	logLines += log + "\n";
    	
    	console.log(log);
    
    }

}

//window.minamike = minamike;
if (typeof module !== 'undefined') {
	module.exports = minamike;
}
if (typeof window !== 'undefined') {
	window.minamike = minamike;
}