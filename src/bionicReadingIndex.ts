import {
	App,
	debounce,
	Editor,
	Menu,
	Plugin,
	PluginSettingTab,
	Setting,
	SliderComponent,
	ToggleComponent
} from 'obsidian';
import { bionicReadingExtension } from './bionicReadingWidget';

// Remember to rename these classes and interfaces!

interface BionicReadingSettings {
	bionicReadingMode: boolean;
}

const DEFAULT_SETTINGS: BionicReadingSettings = {
	bionicReadingMode: false,
}

export default class BionicReadingPlugin extends Plugin {
	settings: BionicReadingSettings;
	statusBarEl: HTMLElement;

	async onload() {
		await this.loadSettings();

		this.setupStatusBar();
		this.addSettingTab(new BionicReadingSettingTab(this.app, this));
		this.registerEditorExtension(bionicReadingExtension(this.app, this));
	}

	setupStatusBar() {
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass("br-statusbar-button");
		this.statusBarEl.setText(this.settings.bionicReadingMode ? 'BioRead Mode' : 'Normal Mode');

		this.registerDomEvent(this.statusBarEl, "click", (e) => {
			const statusBarRect =
				this.statusBarEl.parentElement.getBoundingClientRect();
			const statusBarIconRect = this.statusBarEl.getBoundingClientRect();

			const menu = new Menu(this.app).addItem((item) => {
				item.setTitle("Bionic Reading");
				item.setIcon("book");

				const itemDom = (item as any).dom as HTMLElement;
				const toggleComponent = new ToggleComponent(itemDom)
					.setValue(this.settings.bionicReadingMode)
					.setDisabled(true);

				const toggle = async () => {
					this.settings.bionicReadingMode = !this.settings.bionicReadingMode;
					toggleComponent.setValue(this.settings.bionicReadingMode);
					this.statusBarEl.setText(this.settings.bionicReadingMode ? 'BioRead Mode' : 'Normal Mode');
					this.app.workspace.updateOptions();
					await this.saveSettings();
				};

				item.onClick((e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					toggle();
				});
			});

			const menuDom = (menu as any).dom as HTMLElement;
			menuDom.addClass("br-statusbar-menu");

			menu.showAtPosition({
				x: statusBarIconRect.right + 5,
				y: statusBarRect.top - 5,
			});
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BionicReadingSettingTab extends PluginSettingTab {
	plugin: BionicReadingPlugin;
	private applyDebounceTimer: number = 0;

	constructor(app: App, plugin: BionicReadingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	applySettingsUpdate() {
		clearTimeout(this.applyDebounceTimer);
		const plugin = this.plugin;
		this.applyDebounceTimer = window.setTimeout(() => {
			plugin.saveSettings();
		}, 100);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: '📚 Bionic Reading'});

		new Setting(containerEl)
			.setName('Toggle bionic reading mode')
			.setDesc('Toggle this to enable bionic reading mode. You can also toogle this in status bar.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.bionicReadingMode).onChange(async (value) => {
					this.plugin.settings.bionicReadingMode = value;
					this.applySettingsUpdate();
				}));

		this.containerEl.createEl('h2', { text: 'Say Thank You' });

		new Setting(containerEl)
			.setName('Donate')
			.setDesc('If you like this plugin, consider donating to support continued development:')
			.addButton((bt) => {
				bt.buttonEl.outerHTML = `<a href="https://www.buymeacoffee.com/boninall"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=boninall&button_colour=6495ED&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"></a>`;
			});
	}
}
