(asc => typeof module === "undefined" ? adsapCompile = asc : module.exports = asc)(
	function adsapCompile(src, varName, parser = adsapParser) {
		var parsed = parser.parse(src);
		
		parsed.props = convertStoryProps(parsed.props);
		
		const hasStopArrows = checkStopArrows();
		
		const knownSyncNodes = new Set();
		
		getInitialSyncNodes(parsed.nodes);
		
		const funcText = makeStoryJs(parsed, varName);
		
		if (varName) {
			const f = varName === "f" ? "F" : "f";
			return `(${f} => typeof module === "undefined" ? ${varName} = ${f} : module.exports = ${f})(${funcText});`;
		} else {
			return `module.exports = ${funcText};`;
		}
		
		
		function convertStoryProps(propsList) {
			var result = {},
				arrProps = ["init", "css", "author"];
			
			propsList.forEach(p => {
				if (arrProps.includes(p.type))
					(result[p.type] || (result[p.type] = [])).push(p.val);
				else result[p.type] = p.val;
			});
			
			return result;
		}
		
		function checkStopArrows() {
			return parsed.nodes.some(checkNode) || parsed.props.init?.some(checkScript) || checkText(parsed.props.title) || parsed.props.author.some(checkText);
			
			function checkNode(node) {
				return node.opts?.some(checkOption) || node.arrows?.arrows.some(checkArrow) || node.autoprog?.some(checkArrow) || checkScript(node.params) || checkScript(node.startEvents) || checkScript(node.endEvents) || checkText(node.text);
			}
			
			function checkOption(opt) {
				return opt.arrows?.arrows.some(checkArrow) || checkScript(opt.startEvents) || checkScript(opt.endEvents) || checkText(opt.text);
			}
			
			function checkArrow(arrow) {
				return arrow.type === "stop" || (arrow.type === "noderef" && checkNodeRef(arrow.val));
			}
			
			function checkText(text) {
				return text.some(item => item.type === "js" && checkScript(item.val));
			}
			
			function checkScript(script) {
				return script && script.some(item => typeof item !== "string" && checkNodeRef(item));
			}
			
			function checkNodeRef(val) {
				return val.type === "node" ? checkNode(val) : val.type === "js" ? checkScript(val.val) : checkScript(val.params);
			}
		}
		
		function getInitialSyncNodes(nodes) {
			const nodesByName = new Map(nodes.map(node => [node.name, node]));
			
			for (const node of nodes) {
				checkNode(node, new Set());
			}
			
			function checkNode(node, ancestors) {
				if (!node) return false;
				if (ancestors.has(node)) {
					console.warn("Synchronous recursion at " + node.name);
					return true;
				}
				if (knownSyncNodes.has(node)) return false;
				ancestors = new Set(ancestors);
				ancestors.add(node);
				const isAsync = !!node.opts || checkArrows(node.arrows?.arrows, ancestors) || checkArrows(node.autoprog, ancestors);
				if (!isAsync && nodesByName.get(node.name) === node) knownSyncNodes.add(node.name);
				return isAsync;
			}
			
			function checkArrows(arrows, ancestors) {
				return (arrows || []).some(arrow => {
					if (arrow.type === "noderef") {
						if (arrow.val.type === "js") return true;
						else if (arrow.val.type === "node") return checkNode(arrow.val, ancestors);
						else return checkNode(nodesByName.get(arrow.val.name), ancestors);
					}
					return false;
				});
			}
		}
		
		function makeStoryJs(parsed, varName) {
			return `
				async function ${varName || ""}(adsap_container, adsap_initConfig, adsap_data = {}) {
					const adsap_state = {container: adsap_container, parentContainers: [], section: null, data: adsap_data};
					const {
						initContainer: adsap_initContainer,
						addCss: adsap_addCss,
						showCover: adsap_showCover,
						addSection: adsap_addAndGetSection,
						addText: adsap_addText,
						showOptions: adsap_showOptions,
						addSubContainer: adsap_addSubContainer,
						finish: adsap_finish = d => d
					} = adsap_initConfig(adsap_state);
					const adsap_addSection = () => adsap_state.section = adsap_addAndGetSection();
					const adsap_runOptions = opts => new Promise((resolve, reject) => {
						adsap_showOptions(opts.map(([text, cb]) => ({
							text,
							callback: () => Promise.resolve(cb()).then(resolve).catch(reject)
						})));
					});
					const adsap_useSubContainer = () => {
						adsap_state.parentContainers.push(adsap_state.container);
						const sc = adsap_addSubContainer();
						return adsap_state.container = sc;
					};
					const adsap_exitSubContainer = () => adsap_state.container = adsap_state.parentContainers.pop() || adsap_state.container;
					adsap_state.container = adsap_initContainer() || adsap_state.container;
					const ${makeNodesJs(parsed.nodes)};
					${parsed.props.css?.length ? parsed.props.css.map(css => `adsap_addCss(${JSON.stringify(css)});`).join("") : ""}
					${makeStatementScriptsJs(parsed.props.init)}
					adsap_showCover({title: ${makeTextJs(parsed.props.title)}, authors: [${parsed.props.author.map(a => makeTextJs(a)).join(",")}]});
					adsap_state.section = adsap_addAndGetSection();
					return adsap_finish(await adsap_node_${parsed.nodes[0].name}());
				}
			`;
		}
		
		function makeNodesJs(nodes) {
			return nodes.map(node => {
				const [nodeText, nodeAsync] = makeNodeJs(node, true)
				if (!nodeAsync) knownSyncNodes.add(node.name);
				return "adsap_node_" +node.name + "=" + nodeText;
			}).join(",");
		}
		
		function makeNodeJs(node, requireFunc) {
			const endJsText = makeStatementScriptsJs(node.endEvents);
			const [progText, progAsync, progHasAwait] = makeArrowsJs(node.arrows?.arrows, !!node.opts || !node.autoprog);
			const [autoprogText, autoprogAsync, autoprogHasAwait] = makeArrowsJs(node.autoprog, true);
			const [optsText, optsHasAwait] = node.opts ? makeProgressionCall(`adsap_runOptions([${node.opts.map(o => makeOptionJs(o, !!endJsText, !!progText, progAsync)).join(",")}])`, true, !autoprogText) : ["", false];
			const nodeAsync = !!node.opts || progAsync || autoprogAsync;
			const nodeHasAwait = autoprogHasAwait || (optsText ? optsHasAwait : progHasAwait);
			return [
				`
					${nodeHasAwait ? "async" : ""} (${node.params ? makeScriptJs(node.params) : ""}) => {
						${makeStatementScriptsJs(node.startEvents)}
						adsap_addText(${makeTextJs(node.text)});
						${
							node.opts
							? `
								${endJsText ? `const adsap_endJs = () => {${endJsText}};` : ""}
								${progText ? `const adsap_prog = ${progHasAwait ? "async" : ""} () => {${progText}};` : ""}
								${optsText}
							`
							: endJsText + ";" + progText
						}
						${autoprogText}
					}
				`,
				nodeAsync
			];
		}
		
		function makeOptionJs(opt, nodeHasEndJs, nodeHasProg, nodeProgAsync) {
			const textText = makeTextJs(opt.text);
			const startJsText = opt.startEvents.map(s => makeScriptJs(s)).join(",");
			const [progText, , progHasAwait] = makeArrowsJs(opt.arrows?.arrows, true);
			const [nodeProgText, nodeProgHasAwait] = nodeHasProg ? makeProgressionCall(`adsap_prog()`, nodeProgAsync, !progText) : ["", false];
			const callbackHasAwait = nodeProgHasAwait || progHasAwait;
			return `[
				${startJsText ? `(${startJsText}, ${textText})` : textText},
				${callbackHasAwait ? "async" : ""} () => {
					${nodeHasEndJs ? `adsap_endJs();` : ""}
					${makeStatementScriptsJs(opt.endEvents)}
					${nodeProgText}
					${progText}
				}
			]`;
		}
		
		function makeStatementScriptsJs(scripts = []) {
			return scripts.map(script => makeScriptJs(script)).join(";")
		}
		
		function makeTextJs(text) {
			return text.map(item =>
				item.type === "js"
					? `(${makeScriptJs(item.val)})`
					: JSON.stringify(item)
			).join("+") || '""';
		}
		
		function makeArrowsJs(arrows, isFinal) {
			if (!arrows) return ["", false, false, false];
			let isAsync = false;
			let hasAwait = false;
			let result = "";
			for (const arrow of arrows) {
				const [arrowText, arrowAsync, arrowHasAwait] = makeArrowJs(arrow, isFinal && arrow === arrows[arrows.length - 1]);
				if (arrowAsync) isAsync = true;
				if (arrowHasAwait) hasAwait = true;
				result += arrowText;
			}
			return [result, isAsync, hasAwait];
		}
		
		function makeArrowJs(arrow, isFinal) {
			if (arrow.type === "stop") return [`return true;`, false, false];
			else if (arrow.type === "break") return [`adsap_addSection();`, false, false];
			else {
				const {val} = arrow;
				if (val.type === "js") {
					const [text, hasAwait] = makeProgressionCall(`(${makeScriptJs(val.val)})()`, true, isFinal);
					return [text, true, hasAwait];
				} else if (val.type === "node") {
					const [nodeText, nodeAsync] = makeNodeJs(val, false);
					const [text, hasAwait] = makeProgressionCall(`(${nodeText})()`, nodeAsync, isFinal);
					return [text, nodeAsync, hasAwait];
				} else {
					const [callText, callAsync] = makeNodeCallJs(val);
					const [text, hasAwait] = makeProgressionCall(callText, callAsync, isFinal);
					return [text, callAsync, hasAwait];
				}
			}
		}
		
		function makeNodeCallJs(val) {
			return [
				`adsap_node_${val.name}(${val.params ? makeScriptJs(val.params) : ""})`,
				!knownSyncNodes.has(val.name)
			];
		}
		
		function makeScriptJs(script) {
			return script.map(item => {
				if (typeof item === "string") return item;
				else if (item.type === "node") return `(${makeNodeJs(item, true)[0]})`;
				else return `(() => ${makeNodeCallJs(item)[0]})`;
			}).join("");
		}
		
		function makeProgressionCall(resultExpr, isAsync, isFinal) {
			const hasAwait = isAsync && (hasStopArrows || !isFinal);
			if (hasAwait) resultExpr = "await " + resultExpr;
			return [
				hasStopArrows
					? `if (${resultExpr}) return true;`
					: `${isFinal && isAsync ? "return" : ""} ${resultExpr};`,
				hasAwait
			];
		}
	}
);