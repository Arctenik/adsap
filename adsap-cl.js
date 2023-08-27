
const fsp = require("fs/promises");
const repl = require("repl");
const adsapParser = require("./adsap-parser.js");
const adsapCompile = require("./adsap-compile.js");

const htmlEntities = {
	"lt": "<",
	"gt": ">",
	"amp": "&"
};

const config = state => {
	let currentOptions;
	let replCallback = startRepl;
	let r;
	
	function startRepl() {
		r = repl.start({
			prompt: "> ",
			eval(cmd, c, f, callback) {
				const opt = currentOptions[cmd - 1];
				if (opt) {
					replCallback = callback;
					opt.callback();
				} else {
					console.log("Invalid option");
					callback();
				}
			}
		});
	}
	
	return {
		initContainer() {},
		addCss() {},
		showCover({title, authors}) {
			logFormatted("\n\n" + title + " by " + (authors.length > 2 ? authors.slice(0, authors.length - 1).join(", ") + ", and " + authors[authors.length - 1] : authors.join(" and ")));
		},
		addSection() {
			displaySection();
			return {
				text: "\n"
			};
		},
		addText(text) {
			state.section.text += text;
		},
		showOptions(opts) {
			displaySection();
			console.log("");
			for (const [i, opt] of opts.entries()) {
				logFormatted((i + 1) + ": " + opt.text);
			}
			currentOptions = opts;
			replCallback?.();
		},
		addSubContainer() {},
		finish(d) {
			displaySection();
			r.close();
			return d;
		}
	};
	
	function displaySection() {
		if (state.section?.text) {
			logFormatted(state.section.text);
			state.section.text = "";
		}
	}
	
	function logFormatted(text) {
		console.log(
			text.replace(/&(lt|gt|amp);/ig, (fullMatch, code) => htmlEntities[code.toLowerCase()] || fullMatch)
		);
	}
};


const [, , storyPath] = process.argv;

(async () => {
	
	const runStory = evalStoryScript(adsapCompile(await fsp.readFile(storyPath, "utf8"), "runStory", adsapParser));
	
	await runStory(null, config);
	
})();

function evalStoryScript(text) {
	let module = {};
	eval(text);
	return module.exports;
}
