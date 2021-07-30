export class ImageJournal extends DocumentSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			baseApplication: 'JournalSheet',
			classes: [],
			template: 'modules/custom-journal/templates/customimage.html',
			closeOnSubmit: false,
			submitOnClose: true,
			viewPermission: CONST.ENTITY_PERMISSIONS.NONE,
		});
	}

	handlers = {};

	getFlag(flag) {
		return this.object.getFlag('custom-journal', flag);
	}

	async setFlag(flag, value) {
		return this.object.setFlag('custom-journal', flag, value);
	}

	async setDefaultFlag(flag, value) {
		if (this.object.getFlag('custom-journal', flag) === undefined) return this.object.setFlag('custom-journal', flag, value);
	}

	async setDefaultFlags() {
		await this.setDefaultFlag('img', '');
		await this.setDefaultFlag('opacity', '1');
		await this.setDefaultFlag('locked', true);
		await this.setDefaultFlag('draggable', false);
		await this.setDefaultFlag('image_position', { width: 0, height: 0, top: 0, left: 0 });
		await this.setDefaultFlag('editor_position', { width: 0, height: 0, top: 0, left: 0 });
		await this.setDefaultFlag('text-color', '#ffffff');
		await this.setDefaultFlag('image_rotation', '0');
		await this.setDefaultFlag('editor_rotation', '0');
	}

	/** @inheritdoc */
	getData(options) {
		const data = super.getData(options);
		data.title = this.title; // Needed for image mode
		data.image = this.getFlag('img');
		data.folders = game.folders.filter((f) => f.data.type === 'JournalEntry' && f.displayed);
		return data;
	}

	/** @inheritdoc */
	async _updateObject(event, formData) {
		return super._updateObject(event, formData);
	}

	_replaceHTML(element, html) {
		if (!element.length) return;

		element.replaceWith(html);
		//this._element = html;
	}

	async _render(force, options = {}) {
		let reset = false;
		if (!this.getFlag('image_position')) reset = true;
		this.setDefaultFlags();

		if (!this.object.compendium && !this.object.testUserPermission(game.user, this.options.viewPermission)) {
			if (!force) return; // If rendering is not being forced, fail silently
			const err = game.i18n.localize('SHEETS.EntitySheetPrivate');
			ui.notifications.warn(err);
			return console.warn(err);
		}

		// Update editable permission
		options.editable = options.editable ?? this.object.isOwner;

		// Register the active Application with the referenced Documents
		this.object.apps[this.appId] = this;

		// Do not render under certain conditions
		const states = Application.RENDER_STATES;
		this._priorState = this._state;
		if ([states.CLOSING, states.RENDERING].includes(this._state)) return;

		// Applications which are not currently rendered must be forced
		if (!force && this._state <= states.NONE) return;

		// Begin rendering the application
		if ([states.NONE, states.CLOSED, states.ERROR].includes(this._state)) {
			console.log(`${vtt} | Rendering ${this.constructor.name}`);
		}
		this._state = states.RENDERING;

		// Merge provided options with those supported by the Application class
		mergeObject(this.options, options, { insertKeys: false });

		// Get the existing HTML element and application data used for rendering
		const img = this.getFlag('img') || 'modules/custom-journal/textures/bg.png';
		const windowData = {
			id: this.id,
			appId: this.appId,
			img,
			data: this.object.data,
			opacity: this.getFlag('opacity'),
			headerButtons: this._getHeaderButtons(),
			userButtons: this._getUserButtons(),
			textcolor: this.getFlag('text-color'),
			editorRotation: this.getFlag('editor_rotation'),
			imgRotation: this.getFlag('image_rotation'),
		};
		windowData.buttons = [...windowData.headerButtons, ...windowData.userButtons];
		options = mergeObject(options, windowData);
		const element = this.element;
		const data = options;

		// Store scroll positions
		if (element.length && this.options.scrollY) this._saveScrollPositions(element);

		// Render the inner content
		const html = await this._renderInner(data);
		let renderinner = false;

		// If the application already exists in the DOM, replace the inner content
		if (element.length) {
			this._replaceHTML(element.find('form div.editor')[0], html.find('form div.editor')[0]);
			element.find('input[type=hidden]').remove();
			renderinner = true;
		}
		// Otherwise render a new app
		else {
			ui.windows[this.appId] = this;
			// Add the HTML to the DOM and record the element
			this._injectHTML(html);
		}

		mergeObject(this.position, options, { insertKeys: false });

		// Activate event listeners on the inner HTML
		this._activateCoreListeners(html);
		this.activateListeners(html);

		await this._onRender(html, options, renderinner);

		setTimeout(() => {
			html.find('.custom-image-buttons a').click((event) => {
				event.preventDefault();
				const button = options.buttons.find((b) => event.currentTarget.classList.contains(b.class));
				button.onclick(event);
			});
		}, 500);

		// Dispatch Hooks for rendering the base and subclass applications
		for (let cls of this.constructor._getInheritanceChain()) {
			/**
			 * A hook event that fires whenever this Application is rendered.
			 * The hook provides the pending application HTML which will be added to the DOM.
			 * Hooked functions may modify that HTML or attach interactive listeners to it.
			 *
			 * @function renderApplication
			 * @memberof hookEvents
			 * @param {Application} app     The Application instance being rendered
			 * @param {jQuery} html         The inner HTML of the document that will be displayed and may be modified
			 * @param {object} data         The object of data used when rendering the application
			 */
			Hooks.call(`render${cls.name}`, this, html, data);
		}

		// Restore prior scroll positions
		//if (this.options.scrollY) this._restoreScrollPositions(html);
		this._state = states.RENDERED;

		if (reset) {
			await this.resetPosition();
			this.savePosition();
		}
	}

	async _onRender(html, options, renderinner) {
		const bgImage = this.getFlag('img') || 'modules/custom-journal/textures/bg.png';
		const position = await ImagePopout.getPosition(bgImage);
		mergeObject(options, position);
		options.classes = this.constructor.defaultOptions.classes.concat(ImagePopout.defaultOptions.classes);

		this.setPosition(this.position);
		this.bringToTop();

		// Make Image Draggable when Locked
		const img = html.find('.background-image');
		const editor = html.find('#editor');
		if (!renderinner) {
			this.handlers.editor_lockhandler = new DraggableElement(this, editor, undefined, true, true, this.getFlag('editor_position'));
			this.handlers.image_lockhandler = new DraggableElement(this, img, undefined, true, true, this.getFlag('image_position'));
			this.handlers.draghandler = new DraggableExtended(this, img);
		}
	}

	setPosition({ height, width, left, top, scale } = {}) {
		if (!this.popOut) return; // Only configure position for popout apps
		const el = this.element[0];
		const currentPosition = this.position;
		const pop = this.popOut;
		const styles = window.getComputedStyle(el);

		// If Height is "auto" unset current preference
		if (height === 'auto' || this.options.height === 'auto') {
			el.style.height = '';
			height = null;
		}

		// Update width if an explicit value is passed, or if no width value is set on the element
		if (!el.style.width || width) {
			const tarW = width || el.offsetWidth;
			const minW = parseInt(styles.minWidth) || (pop ? MIN_WINDOW_WIDTH : 0);
			const maxW = el.style.maxWidth || window.innerWidth;
			currentPosition.width = width = Math.clamped(tarW, minW, maxW);
			//el.style.width = width + 'px';
			if (width + currentPosition.left > window.innerWidth) left = currentPosition.left;
		}
		width = el.offsetWidth;

		// Update height if an explicit value is passed, or if no height value is set on the element
		if (!el.style.height || height) {
			const tarH = height || el.offsetHeight + 1;
			const minH = parseInt(styles.minHeight) || (pop ? MIN_WINDOW_HEIGHT : 0);
			const maxH = el.style.maxHeight || window.innerHeight;
			currentPosition.height = height = Math.clamped(tarH, minH, maxH);
			//el.style.height = height + 'px';
			if (height + currentPosition.top > window.innerHeight + 1) top = currentPosition.top - 1;
		}
		height = el.offsetHeight;

		// Update Left
		if ((pop && !el.style.left) || Number.isFinite(left)) {
			const tarL = Number.isFinite(left) ? left : (window.innerWidth - width) / 2;
			const maxL = Math.max(window.innerWidth - width, 0);
			currentPosition.left = left = Math.clamped(tarL, 0, maxL);
			el.style.left = left + 'px';
		}

		// Update Top
		if ((pop && !el.style.top) || Number.isFinite(top)) {
			const tarT = Number.isFinite(top) ? top : (window.innerHeight - height) / 2;
			const maxT = Math.max(window.innerHeight - height, 0);
			currentPosition.top = top = Math.clamped(tarT, 0, maxT);
			el.style.top = currentPosition.top + 'px';
		}

		// Update Scale
		if (scale) {
			currentPosition.scale = Math.max(scale, 0);
			if (scale === 1) el.style.transform = '';
			else el.style.transform = `scale(${scale})`;
		}

		// Return the updated position object
		return currentPosition;
	}

	savePosition() {
		const check = (str, flag) => {
			const regex = /-?\d+/;
			const el = this.element[0].querySelector(str);
			const el_pos = {
				width: +regex.exec(el.style.width),
				height: +regex.exec(el.style.height),
				left: +regex.exec(el.style.left),
				top: +regex.exec(el.style.top),
			};
			this.setFlag(`${flag}_position`, el_pos);
			this.setFlag(`${flag}_rotation`, regex.exec(el.style.transform)[0]);
		};
		check('.background-image', 'image');
		check('#editor', 'editor');
	}

	async resetPosition() {
		const img_pos = await ImagePopout.getPosition(this.getFlag('img') || 'modules/custom-journal/textures/bg.png');
		const ratio = img_pos.width / img_pos.height;
		if (img_pos.width > 1000) {
			img_pos.width = 1000;
			img_pos.height = 1000 / ratio;
		}
		if (img_pos.height > 600) {
			img_pos.height = 600;
			img_pos.width = 600 * ratio;
		}
		this.handlers.image_lockhandler.setPosition({ ...img_pos, top: 0, left: 0 });
		this.handlers.image_lockhandler.setRotation(0);
		this.handlers.editor_lockhandler.setPosition({ width: 0, height: 0, top: 0, left: 0 });
		this.handlers.editor_lockhandler.setRotation(0);
	}

	_getUserButtons() {
		return [
			{
				label: 'Close',
				class: 'close',
				icon: 'C',
				onclick: () => this.close(),
			},
		];
	}

	_getHeaderButtons() {
		const canConfigure = game.user.isGM || this.owner;
		const buttons = [];
		const app = this;

		// Journal Configuration
		if (this.options.editable && canConfigure) {
			buttons.push({
				label: 'Sheet',
				class: 'configure-sheet',
				icon: 'fas fa-cog',
				onclick: (ev) => this._onConfigureSheet(ev),
			});
			buttons.push({
				label: 'Image',
				class: 'configure-image',
				icon: 'fas fa-magic',
				onclick: (ev) => this._onConfigImage(ev),
			});
			buttons.push({
				label: 'Unlock',
				class: 'lock-sheet',
				locked: true,
				onclick: function (ev) {
					const handlers = app.handlers;
					const html = ev.target.parentElement.parentElement;
					const btn = ev.target;
					const img = html.querySelector('.background-image');
					const editor = html.querySelector('#editor');
					this.locked = !this.locked;
					btn.text = this.locked ? 'Unlock' : 'Lock';
					img.classList.toggle('stripes');
					editor.classList.toggle('stripes');

					// If its unlocked
					if (!this.locked) {
						// Remove the drag event listeners
						handlers.draghandler.removeListeners();

						// Make the Image and Text Editor resizable and draggable when unlocked
						handlers.image_lockhandler.activateListeners();
						handlers.editor_lockhandler.activateListeners();

						return;
					}
					handlers.image_lockhandler.removeListeners();
					handlers.editor_lockhandler.removeListeners();

					handlers.draghandler.activateListeners();
				},
			});
			buttons.push({
				label: 'Save',
				class: 'save-sheet',
				icon: 'fas fa-magic',
				onclick: (ev) => this.savePosition(),
			});
			buttons.push({
				label: 'Reset',
				class: 'reset-position',
				icon: 'fas fa-magic',
				onclick: async (ev) => this.resetPosition(),
			});
		}

		// Share Entry
		if (game.user.isGM) {
			buttons.push({
				label: 'JOURNAL.ActionShow',
				class: 'share-image',
				icon: 'fas fa-eye',
				onclick: (ev) => this._onShowPlayers(ev),
			});
		}
		return buttons;
	}

	async _onShowPlayers(event) {
		event.preventDefault();
		await this.submit();
		return this.object.show(this._sheetMode, true);
	}

	async _onConfigImage() {
		this._lock();
		const img = this.getFlag('img') || '';
		const opacity = this.getFlag('opacity');
		const textcolor = this.getFlag('text-color');
		const imageRotation = this.getFlag('image_rotation');
		const editorRotation = this.getFlag('editor_rotation');
		//const resizable = this.object.getFlag('custom-journal', 'resizable');
		const html = await getTemplate('modules/custom-journal/templates/customimage-config.html');
		const journal = this.object;
		const name = journal.name;

		const app = new Dialog(
			{
				title: `${this.object.name}: Custom Image Configuration`,
				content: html({ img, opacity, name, textcolor, imageRotation, editorRotation }),
				buttons: {
					yes: {
						icon: `<i class="fas fa-magic"></i>`,
						label: 'Save and Apply',
						callback: async (html) => {
							async function renderSheet() {
								const sheet = journal.sheet;
								// De-register the current sheet class
								await sheet.close();

								// Re-draw the updated sheet
								sheet.render(true);
							}
							const img = html.querySelector('#img').value;
							const opacity = html.querySelector('#opacity').value;
							const newName = html.querySelector('#name').value;
							const textcolor = html.querySelector('#textcolor').value || '#ffffff';
							const imageRotation = html.querySelector('#image-rotation').value;
							const editorRotation = html.querySelector('#editor-rotation').value;

							const updates = {};
							if (newName !== name) updates.name = newName;
							if (opacity !== this.getFlag('opacity')) journal.sheet.setFlag('opacity', opacity);
							if (textcolor !== this.getFlag('text-color')) this.setFlag('text-color', textcolor);
							if (imageRotation !== this.getFlag('image_rotation')) this.setFlag('image_rotation', imageRotation);
							if (editorRotation !== this.getFlag('editor_rotation')) this.setFlag('editor_rotation', editorRotation);

							if (Object.keys(updates).length) await journal.update(updates);

							if (img !== this.getFlag('img')) {
								this.setFlag('img', img);
								Hooks.once('renderImageJournal', async () => {
									await sheet.resetPosition();
									sheet.savePosition();
								});
							}
							renderSheet();
						},
					},
					no: {
						icon: `<i class="fas fa-times"></i>`,
						label: 'Cancel',
					},
				},
				default: 'yes',
				render: (html) => {
					function updateRange({ selector, value, str }) {
						value.textContent = str(selector.value);
					}
					function updateColor(selector) {
						const target = selector.dataset?.edit;
						if (target) {
							html.querySelector(`#${target}`).value = selector.value;
						}
					}

					html.querySelectorAll('input[type=range]').forEach((range) => {
						const value = range.nextElementSibling;
						if (value.tagName !== 'SPAN') return;
						const selector = range;
						let str = (value) => value;
						if (selector.id === 'opacity') str = (value) => ~~(+value * 100) + '%';
						if (selector.id === 'rotation') str = (value) => +value + 'deg';
						const rangeData = {
							selector,
							value,
							str,
						};
						updateRange(rangeData);
						range.addEventListener('change', (ev) => updateRange(rangeData));
					});

					html.querySelectorAll('input[type=color]').forEach((colorpick) => {
						updateColor(colorpick);
						colorpick.addEventListener('change', (ev) => updateColor(colorpick));
					});

					// Register the File Picker
					const img = html.querySelector('#img');
					const picker = html.querySelector('button.file-picker');
					const filePicker = new FilePicker({
						type: 'image',
						field: img,
						displayMode: 'tiles',
					});
					picker.addEventListener('click', (ev) => filePicker.render(true));
				},
			},
			{ jQuery: false }
		);
		app.render(true);

		this.styleApp = app;
	}

	// Allow the sheet configuration button to actually *do* something
	_onConfigureSheet(event) {
		event.preventDefault();
		this._lock();
		new EntitySheetConfig(this.object, {
			top: this.position.top + 40,
			left: this.position.left + (this.position.width - 400) / 2,
		}).render(true);
	}

	_lock() {
		const el = this.element.find('.lock-sheet')[0];
		if (el.text === 'Lock') el.click();
	}

	activateEditor(name, options = {}, ...args) {
		mergeObject(options, {
			preview_styles: false,
			content_style: `body {color: ${this.getFlag('text-color')}}`,
		});
		super.activateEditor(name, options, ...args);
	}
}

class DraggableExtended extends Draggable {
	removeListeners() {
		this.element.removeEventListener(...this.handlers.click);
		this.handle.removeEventListener(...this.handlers.dragDown);
		this.handle.classList.remove('draggable');
	}
}

class DraggableElement extends Draggable {
	constructor(app, element, handle, resizable = false, rotation = false, position = { left: 0, width: 0, top: 0, height: 0 }) {
		super(app, element, handle, resizable);

		// Activate interactivity
		this.position = position;
		this.rotation = rotation;
		this.setPosition(position);
		this.removeListeners();
	}

	activateListeners() {
		super.activateListeners();
		// Rotation handlers
		if (!this.rotation) return;
		let handle = $('<div class="window-rotation-handle"><i class="far fa-circle"></i></div>')[0];
		this.element.appendChild(handle);
		// Register handlers
		this.handlers['rotateDown'] = ['mousedown', (e) => this._onRotateMouseDown(e), false];
		this.handlers['rotateMove'] = ['mousemove', (e) => this._onRotateMouseMove(e), false];
		this.handlers['rotateUp'] = ['mouseup', (e) => this._onRotateMouseUp(e), false];

		// Attach the click handler and CSS class
		handle.addEventListener(...this.handlers.rotateDown);
		this.handle.classList.add('rotatable');
	}

	/**
	 * Handle the initial mouse click which activates dragging behavior for the application
	 * @private
	 */
	_onRotateMouseDown(event) {
		event.preventDefault();
		if (event.target.tagName !== 'I') return;

		// Limit dragging to 60 updates per second
		const now = Date.now();
		if (now - this._moveTime < 1000 / 60) return;
		this._moveTime = now;

		const el = this.element;
		this.position = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };

		// Record initial rotation
		this.rotation = /-?\d+/.exec(this.element.style.transform)[0];
		const pos = this.element.getBoundingClientRect();
		this._initial = { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };

		// Add temporary handlers
		window.addEventListener(...this.handlers.rotateMove);
		window.addEventListener(...this.handlers.rotateUp);
	}

	/**
	 * Move the window with the mouse, bounding the movement to ensure the window stays within bounds of the viewport
	 * @private
	 */
	_onRotateMouseMove(event) {
		event.preventDefault();

		const diffX = (this._initial.x - event.clientX) / this.position.width;
		const diffY = (this._initial.y - event.clientY) / this.position.height;
		const tan = diffY / diffX;

		let atan = (Math.atan(tan) * 180) / Math.PI;
		if (diffY > 0 && diffX > 0) {
			atan += 180;
		} else if (diffY < 0 && diffX > 0) {
			atan -= 180;
		}

		this.setRotation(atan);
	}

	setRotation(deg) {
		this.element.style.transform = `rotate(${deg}deg)`;
	}

	/**
	 * Conclude the dragging behavior when the mouse is release, setting the final position and removing listeners
	 * @private
	 */
	_onRotateMouseUp(event) {
		event.preventDefault();
		window.removeEventListener(...this.handlers.rotateMove);
		window.removeEventListener(...this.handlers.rotateUp);
		//this.app._onRotate(event);
	}

	removeListeners() {
		this.element.removeEventListener(...this.handlers.click);
		this.handle.removeEventListener(...this.handlers.dragDown);
		this.handle.classList.remove('draggable');
		if (this.handle.classList.contains('resizable')) {
			this.handle.removeEventListener(...this.handlers.resizeDown);
			this.handle.classList.remove('resizable');
			this.handle.querySelector('.window-resizable-handle').remove();
		}
		if (this.handle.classList.contains('rotatable')) {
			this.handle.removeEventListener(...this.handlers.rotateDown);
			this.handle.classList.remove('rotatable');
			this.handle.querySelector('.window-rotation-handle').remove();
		}
	}

	setPosition({ width, height, top, left }) {
		const el = this.element;

		if (height !== undefined) el.style.height = height ? height + 'px' : '';
		if (width !== undefined) el.style.width = width ? width + 'px' : '';
		if (left !== undefined) el.style.left = left ? left + 'px' : '';
		if (top !== undefined) el.style.top = top ? top + 'px' : '';
	}

	/**
	 * Handle the initial mouse click which activates dragging behavior for the application
	 * @private
	 */
	_onDragMouseDown(event) {
		event.preventDefault();
		if (event.target.tagName === 'I') return;

		const el = this.element;

		// Record initial position
		this.position = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
		this._initial = { x: event.clientX, y: event.clientY };

		// Add temporary handlers
		window.addEventListener(...this.handlers.dragMove);
		window.addEventListener(...this.handlers.dragUp);
	}

	/**
	 * Move the window with the mouse, bounding the movement to ensure the window stays within bounds of the viewport
	 * @private
	 */
	_onDragMouseMove(event) {
		event.preventDefault();

		// Limit dragging to 60 updates per second
		const now = Date.now();
		if (now - this._moveTime < 1000 / 60) return;
		this._moveTime = now;

		// Update application position
		this.setPosition({
			left: this.position.left + (event.clientX - this._initial.x),
			top: this.position.top + (event.clientY - this._initial.y),
		});
	}

	/**
	 * Handle the initial mouse click which activates dragging behavior for the application
	 * @private
	 */
	_onResizeMouseDown(event) {
		event.preventDefault();

		// Limit dragging to 60 updates per second
		const now = Date.now();
		if (now - this._moveTime < 1000 / 60) return;
		this._moveTime = now;

		const el = this.handle;

		// Record initial position
		this.position = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
		this.position.height = el.clientHeight;
		this.position.width = el.clientWidth;
		this._initial = { x: event.clientX, y: event.clientY };

		// Add temporary handlers
		window.addEventListener(...this.handlers.resizeMove);
		window.addEventListener(...this.handlers.resizeUp);
	}

	/**
	 * Move the window with the mouse, bounding the movement to ensure the window stays within bounds of the viewport
	 * @private
	 */
	_onResizeMouseMove(event) {
		event.preventDefault();
		this.setPosition({
			width: this.position.width + (event.clientX - this._initial.x),
			height: this.position.height + (event.clientY - this._initial.y),
		});
	}
}
