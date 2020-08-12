// The custom parent class that allows the various setting needed to have 
// a choice of journals similar to what actor sheets get
class CustomJournalSheet extends JournalSheet {

	get journal(){
		return this.object;
	}

	/*
	 *	Useful in creating a custom TinyMCE editor, to be looked into for further 
	 *	tinkering in that direction.
	 */
	// _createEditor(target, editorOptions, initialContent) {
	// 	editorOptions.content_css = "./dark-slate-journal.css";
	// 	return super._createEditor(target, editorOptions, initialContent);
	// };

	// Add the sheet configuration button to the journal header
	_getHeaderButtons() {
		let buttons = super._getHeaderButtons();

		// Token Configuration
		const canConfigure = game.user.isGM || this.entity.owner;
		if (this.options.editable && canConfigure) {
			buttons = [
				{
					label: "Sheet",
					class: "configure-sheet",
					icon: "fas fa-cog",
					onclick: ev => this._onConfigureSheet(ev)
				}
			].concat(buttons);
		}
		return buttons
	}

	// Allow the sheet configuration button to actually *do* something
	_onConfigureSheet(event) {
		event.preventDefault();
		new EntitySheetConfig(this.journal, {
			top: this.position.top + 40,
			left: this.position.left + ((this.position.width - 400) / 2)
		}).render(true);
	}
}

/* CUSTOMIZE
 * Add any extra themes here: just copy-paste the whole block, changing only the class
 * name for the theme's name that will appear in the drop-down, and the name in single
 * quotes (here, dark-slate-journal) with whatever name you gave your theme in the .css
 * file
 */
class DarkSlateJournal extends CustomJournalSheet {
	static get defaultOptions() {
		const options = super.defaultOptions;
		options.classes.push('dark-slate-journal');
		return options;
	}
}

class HandwrittenLetter extends CustomJournalSheet {
	static get defaultOptions() {
		const options = super.defaultOptions;
		options.classes.push('handwritten-letter');
		return options;
	}
}

class RoyalJournal extends CustomJournalSheet {
	static get defaultOptions() {
		const options = super.defaultOptions;
		options.classes.push('royal-journal');
		return options;
	}
}

// Creating the structure in CONFIG for Journals to have different sheets
console.log("CustomJournals | Creating the structure to allow multiple Journal Sheets.")
CONFIG["JournalEntry"]["sheetClasses"] = {};
CONFIG["JournalEntry"]["sheetClasses"][CONST.BASE_ENTITY_TYPE] = {};

console.log("CustomJournals | Registering the module's sheets.")

/*CUSTOMIZE
 * Here, register your sheet so it shows up properly in the dropdown, just change
 * for your sheet name and you're good to go
 */
// The default Foundry journal
EntitySheetConfig.registerSheet(JournalEntry, "journals", CustomJournalSheet, {
	types: [CONST.BASE_ENTITY_TYPE],
	makeDefault: true
});

EntitySheetConfig.registerSheet(JournalEntry, "journals", DarkSlateJournal, {
	types: [CONST.BASE_ENTITY_TYPE],
	makeDefault: false
});

EntitySheetConfig.registerSheet(JournalEntry, "journals", HandwrittenLetter, {
	types: [CONST.BASE_ENTITY_TYPE],
	makeDefault: false
});

EntitySheetConfig.registerSheet(JournalEntry, "journals", RoyalJournal, {
	types: [CONST.BASE_ENTITY_TYPE],
	makeDefault: false
});
