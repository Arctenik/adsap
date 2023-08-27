
const fs = require("fs");
const adsapParser = require("./adsap-parser.js");

const [, , filePath] = process.argv;

fs.readFile(filePath, "utf8", (err, source) => {
	if (err) console.error(err);
	else {
		getOpenNodes(adsapParser.parse(source));
	}
});

function getOpenNodes(story) {
	const allNodeNames = new Set(story.nodes.map(({name}) => name));
	const foundMissing = new Set();
	let foundUnclosed = false;
	for (const node of story.nodes) {
		if (!nodeClosed(node)) {
			foundUnclosed = true;
			console.log(node.name);
		}
	}
	if (!(foundUnclosed || foundMissing.size)) console.log("None found");


	function nodeClosed(node) {
		if (progClosed(node.autoprog)) return true;
		if (node.opts?.length) {
			if (optsClosed(node.opts)) return true;
		} else {
			if (progClosed(node.arrows)) return true;
		}
		return false;
	}

	function optsClosed(opts) {
		if (!opts.length) return false;
		for (const opt of opts) {
			if (!progClosed(opt.arrows)) return false;
		}
		return true;
	}

	function progClosed(prog) {
		if (!prog) return false;
		let arrows;
		if (Array.isArray(prog)) {
			arrows = prog;
		} else {
			if (prog.hasContinue) return true;
			arrows = prog.arrows;
		}
		if (!arrows.length) return false;
		for (const item of arrows.slice().reverse()) {
			if (item.type !== "break") {
				if (item.val?.type === "node") return nodeClosed(item.val);
				else {
					if (item.val && !item.val.type && !allNodeNames.has(item.val.name) && !foundMissing.has(item.val.name)) {
						foundMissing.add(item.val.name);
						console.log(item.val.name + "  (missing)");
					}
					return true;
				}
			}
		}
	}
}
