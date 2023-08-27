const path = require("path");
const fsp = require("fs/promises");
const http = require("http");

// idk what the best way to do a minimal server is. oh well

const DEFAULT = Symbol("DEFAULT");
const fileTypes = {
	".adsap": "text/plain",
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif"
};

const rootPath = path.resolve(".");
const pathPrefix = rootPath + path.sep;

const indexName = "adsap-test.html";

const fileNameRegExp = /^[^.]*/;

const routes = {
	"/": async (req, res) => {
		res.writeHead(200, {"Content-Type": "text/html"}).end(await fsp.readFile(path.resolve(rootPath, indexName)));
	},
	"/storyExtraFiles.json": async (req, res, url) => {
		let storyPath = /[?&]story=([^&]+)/.exec(url.search)?.[1];
		if (storyPath) storyPath = path.resolve(rootPath, decodeURIComponent(storyPath));
		if (!storyPath || !storyPath.startsWith(pathPrefix)) {
			res.writeHead(400).end();
			return;
		}
		const folderPath = path.resolve(storyPath, "..");
		const storyFileName = path.basename(storyPath);
		const storyName = fileNameRegExp.exec(storyFileName)[0];
		const filePaths = [];
		for (name of await fsp.readdir(folderPath)) {
			if (fileNameRegExp.exec(name)[0] === storyName && name !== storyFileName) {
				filePaths.push(path.relative(rootPath, path.resolve(folderPath, name)).replaceAll(path.sep, "/"));
			}
		}
		res.writeHead(200, {"Content-Type": "application/json"}).end(JSON.stringify(filePaths));
	},
	[DEFAULT]: async (req, res, url) => {
		const filePath = path.resolve(rootPath, decodeURIComponent(url.pathname.replace(/^\//, "")));
		if (!filePath.startsWith(pathPrefix)) {
			res.writeHead(400).end();
			return;
		}
		try {
			await fsp.access(filePath);
		} catch(e) {
			res.writeHead(400).end();
			return;
		}
		res.writeHead(200, {
			"Content-Type": fileTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
		}).end(
			await fsp.readFile(path.resolve(rootPath, filePath))
		);
	}
};

http.createServer((req, res) => {
	if (req.method !== "GET") {
		res.writeHead(405).end();
		return;
	}
	const url = new URL(req.url, `http://${req.headers.host}`);
	Promise.resolve((routes[url.pathname] || routes[DEFAULT])(req, res, url)).catch(e => {
		console.error(e);
		res.writeHead(500).end(e.toString());
	});
}).listen(3000, "localhost");
