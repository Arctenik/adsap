(c => typeof module === "undefined" ? adsapDefaultConfig = c : module.exports = c)(
	state => ({
		initContainer() {
			state.container.classList.add("adsapContainer");
		},
		addCss(text) {
			const style = document.createElement("style");
			style.innerHTML = text;
			state.container.appendChild(style);
		},
		showCover({title, authors}) {
			const coverElem = document.createElement("div");
			coverElem.classList.add("adsapCover");
			const titleElem = document.createElement("span");
			titleElem.classList.add("adsapTitle");
			const authorsElem = document.createElement("span");
			authorsElem.classList.add("adsapAuthors");
			coverElem.appendChild(titleElem);
			coverElem.insertAdjacentText("beforeend", " ");
			coverElem.appendChild(authorsElem);
			titleElem.innerHTML = title;
			authorsElem.innerHTML = "by " + (authors.length > 2 ? authors.slice(0, authors.length - 1).join(", ") + ", and " + authors[authors.length - 1] : authors.join(" and "));
			state.container.appendChild(coverElem);
		},
		addSection() {
			const sectionElem = document.createElement("div");
			sectionElem.classList.add("adsapSection");
			state.container.appendChild(sectionElem);
			return sectionElem;
		},
		addText(text) {
			state.section.insertAdjacentHTML("beforeend", text);
		},
		showOptions(opts) {
			const optsElem = document.createElement("div");
			optsElem.classList.add("adsapOptions");
			for (const [optIndex, {text, callback}] of opts.entries()) {
				const wrapper = document.createElement("div");
				let optElem = document.createElement("button");
				const optContentElem = document.createElement("div");
				optElem.classList.add("adsapOption");
				optContentElem.innerHTML = text;
				optElem.appendChild(optContentElem);
				optElem.addEventListener("click", () => {
					const newOptElem = document.createElement("div");
					newOptElem.appendChild(optContentElem);
					optElem.replaceWith(newOptElem);
					optElem = newOptElem;
					optsElem.classList.add("adsapOptionsResolved");
					optElem.classList.remove("adsapOption");
					optElem.classList.add("adsapChosenOption");
					const allWrappers = Array.from(optsElem.children)
					for (const w of allWrappers.slice(optIndex + 1)) w.remove();
					const otherWrappers = allWrappers.slice(0, optIndex);
					for (const otherWrapper of otherWrappers) {
						otherWrapper.style.height = otherWrapper.clientHeight + "px";
						otherWrapper.classList.add("adsapOptionWrapperCollapsing");
					}
					callback();
					requestAnimationFrame(() => {
						for (const otherWrapper of otherWrappers) {
							otherWrapper.style.height = "0";
						}
						optsElem.classList.add("adsapOptionsCollapsed");
						wrapper.classList.add("adsapChosenOptionWrapper");
						setTimeout(() => {
							optsElem.replaceWith(wrapper);
						}, 400);
					});
				});
				wrapper.appendChild(optElem);
				optsElem.appendChild(wrapper);
			}
			state.container.appendChild(optsElem);
		},
		addSubContainer() {
			const subContainer = document.createElement("div");
			subContainer.classList.add("adsapSubContainer");
			state.container.appendChild(subContainer);
			return subContainer;
		}
	})
);