{
	
	
	function makeExpr(type, val, addTo = {}) {
		addTo.type = type;
		if (val !== undefined) addTo.val = val;
		return addTo;
	}
	
	
	var specialEscs = {
		"0": "\0",
		"n": "\n",
		"r": "\r",
		"v": "\v",
		"t": "\t",
		"b": "\b",
		"f": "\f"
	}
	
	function esc(d) {
		if (Array.isArray(d)) {
			var code;
			if (d[0] === "u") {
				if (d[1].length === 8 /* (missing digits are null) */) {
					code = d[1].slice(1, 7).join(""); // null converts to empty string
				} else {
					code = d[1].join("");
				}
			} else {
				code = d[1] + d[2];
			}
			return String.fromCodePoint(parseInt(code, 16));
		} else {
			return specialEscs[d] || d;
		}
	}
	
	
	function joinStrings(arr) {
		var result = [];
		
		function add(obj) {
			if (typeof obj === "string" && typeof result[result.length - 1] === "string")
				result[result.length - 1] += obj;
			else if (obj !== "") result.push(obj);
		}
		
		arr.forEach(add);
		
		return result;
	}
	
	
	function concatItems(arr) {
		var result = [];
		arr.forEach(item => {
			if (Array.isArray(item)) result.push(...item);
			else result.push(item);
		});
		return joinStrings(result);
	}
	
	
	function arrows(endArrow, otherArrows) {
		const result = {arrows: otherArrows || []};
		if (endArrow === "continue") result.hasContinue = true;
		else if (endArrow) result.arrows.push(endArrow);
		return result;
	}
	
	
	function progressors(arr) {
		var result = [];
		arr.forEach(item => {
			if (item === "break") result.push(makeExpr("break"));
			else if (item) result.push(makeExpr("noderef", item));
		});
		return result;
	}
	
	
	function contenttext(arr) {
		var endWhite = true,
			result = [];
		
		function add(obj) {
			if (typeof obj === "string" && typeof result[result.length - 1] === "string")
				result[result.length - 1] += obj;
			else if (obj !== "") result.push(obj);
		}
		
		arr.reverse().filter((obj, x, a) => {
			if (endWhite) {
				if (obj.type === "white" || obj.type === "break") return false;
				else {
					endWhite = false;
				}
			} else if (obj.type === "white") {
				var prev = a[x - 1],
					next = a[x + 1];
				if ((prev && prev.type === "break") || (next && next.type === "break")) {
					return false;
				}
			}
			return true; // default result
		}).reverse().forEach(obj => {
			add((obj.type === "white" || obj.type === "break") ? obj.val : obj);
		});
		
		return result;
	}
	
}



//test = contenttext


file = props:fileprops
       nodes:(_ n:nodedeclaration {return n})*
	   _
	   {return {nodes, props}}


fileprops = (_ p:fileprop {return p})*

fileprop = init:jsbrackets {return makeExpr("init", init)}
		 / prop:(cssprop / textprop) {return prop}


cssprop = "#" _ "css" (_ ":")? _ css:cssbrackets {return makeExpr("css", css)}


textprop = "#" _ type:("title" / "author") _ ":" linew? (proptextbreak linew?)? text:proptext {return makeExpr(type, text)}

proptext = c:proptextitem* {return contenttext(c)}

proptextbreak = [\r\n]+ !proptextlinenostart

proptextlinenostart = [#{}] / "=="

proptextitem = [^{}\\ \t\r\n] / esc / middlejs / contenttextwhite


node = head:(h:nodehead _ {return h})? node:nodebody {if (head) {node.name = head.name; node.params = head.params} return node}

nodedeclaration = head:nodeheadnamed _ node:nodebody {node.name = head.name; node.params = head.params; return node}


nodehead = "==" linew? n:adsapid? p:(linew? jsparens)? linew? "=="? {return {name: n, params: p && p[1]}}

nodeheadnamed = "==" linew? n:adsapid p:(linew? jsparens)? linew? "=="? {return {name: n, params: p && p[1]}}


nodebody = startevents:nodestartevents?
		   _ text:contenttext
		   arrows:(_ a:arrows {return a})?
		   endevents:(_ ee:nodeendevents {return ee})?
		   opts:(_ o:options {return o})?
		   autoprog:(_ p:autoprog {return p})?
		 {return {type: "node", startEvents: startevents || [], endEvents: endevents || [], text, arrows, opts, autoprog}}


nodestartevents = h:startjs t:(_ c:startjs {return c})* {return [h].concat(t)}

nodeendevents = h:endjs t:(_ c:endjs {return c})* {return [h].concat(t)}


contenttext = !contenttextlinenostart c:(!contenttextdisallow i:contenttextitem {return i})* {return contenttext(c)}

contenttextitem = [^{}\\ \t\r\n] / esc / middlejs / contenttextwhite / contenttextlinebreak

contenttextwhite = c:[ \t]+ {return makeExpr("white", c.join(""))}

contenttextlinebreak = c:("\r\n" / [\r\n]) !(linew? contenttextlinenostart) {return makeExpr("break", c)}

contenttextlinenostart = [*|#] / "=="

contenttextdisallow = _ ([\[\]] / "=>" / "->" / "==>" / "=!>" / [$@] "{")


arrows = a:endarrow {return arrows(a)} / p:progressors e:(_ a:endarrow {return a})? {return arrows(e, p)}

endarrow = a:("==>" {return "continue"} / "=!>" {return makeExpr("stop")}) (!endarrowdisallow .)* {return a}

endarrowdisallow = [\r\n\[\]] / [$@] "{"

progressors = h:progressarrow t:(_ c:(progressarrow / noderef) {return c})* {return progressors([h].concat(t))}

progressarrow = "=>" {return "break"}  / "->" {return null}

noderef = nodecall / middlejs / nodelambda

nodecall = n:adsapid p:(linew? jsparens)? {return {name: n, params: p && p[1]}}


options = h:option t:(_ o:option {return o})* {return [h].concat(t)}

option = "*" 
         pre:(_ r:startjs {return r})*
		 _ text:contenttext
		 arrows:(_ a:arrows {return a})?
		 post:(_ o:endjs {return o})*
		 {return {text, arrows, startEvents: pre, endEvents: post}}


autoprog = "|"  _ p:progressors {return p}


nodelambda = "[" _ n:node _ "]" {return n}


adsapid = c:[0-9a-zA-Z_]+ {return c.join("")}


esc = "\\" d:([^ux] / "x" h h / "u" ("{" h hq hq hq hq hq "}" / h h h h)) {return esc(d)}

h = [0-9a-z]i

hq = h?



cssbrackets = "{" c:bcss "}" {return c}


bcss = c:(cssesc / bcsschar / bcssbrackets)* {return c.join("")}

bcsschar = [^{}]

bcssbrackets = c:("{" bcss "}") {return c.join("")}


cssesc = "\\" c:[{}] {return c}



middlejs = c:jsbrackets {return makeExpr("js", c)}

startjs = "$" c:jsbrackets {return c}

endjs = "@" c:jsbrackets {return c}


jsbrackets = "{" c:bjs "}" {return c}

jsparens = "(" c:pjs ")" {return c}


bjs = c:(jsesc / jsadsap / bjschar / bjsbrackets)* {return concatItems(c)}

bjschar = [^{}]

bjsbrackets = c:("{" bjs "}") {return concatItems(c)}

pjs = c:(jsesc / jsadsap / pjschar / pjsparens)* {return concatItems(c)}

pjschar = [^()]

pjsparens = c:("(" pjs ")") {return concatItems(c)}

jsadsap = "%%" expr:(nodelambda / nodecall) {return expr}

jsesc = "\\" c:[{}()%] {return c}


linew = [ \t\ufeff]+

_ = [ \t\r\n\ufeff]*