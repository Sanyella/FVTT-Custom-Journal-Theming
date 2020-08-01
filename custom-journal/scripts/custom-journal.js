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
// Creating the structure in CONFIG for Journals to have different sheets
console.log("CustomJournals | Creating the structure to allow multiple Journal Sheets.")
CONFIG["JournalEntry"]["sheetClasses"] = {};
CONFIG["JournalEntry"]["sheetClasses"][CONST.BASE_ENTITY_TYPE] = {};

console.log("CustomJournals | Registering the module's sheets.")
// Registering the sheet itself
EntitySheetConfig.registerSheet(JournalEntry, "customJ", CustomJournalSheet, {
	types: [CONST.BASE_ENTITY_TYPE],
	makeDefault: true
});
// Eventually if allowing for custom sheets to be loaded as well:
// console.log("CustomJournals | Registering your personal sheets.")
