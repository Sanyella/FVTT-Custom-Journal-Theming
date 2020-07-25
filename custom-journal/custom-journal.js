//import JournalSheet from "C:\\Program Files\\FoundryVTT\\resources\\app\\public\\scripts\\foundry.js";

class CustomJournalSheet extends JournalSheet {
	static get defaultOptions(){
		const options = super.defaultOptions;
		options.classes.push('custom-journal');
		return options;
	}

	_createEditor(target, editorOptions, initialContent) {
		editorOptions.content_css = "./custom-journal.css";
		return super._createEditor(target, editorOptions, initialContent);
	};
}

Hooks.on('init', () => {
	document.body.classList.add('pretty-story')
});


