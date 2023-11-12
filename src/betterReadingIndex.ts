import { App, debounce, Menu, Plugin, PluginSettingTab, Setting, ToggleComponent } from 'obsidian';
import { betterReadingExtension } from './betterReadingWidget';
import { highlightTextInElement, rules } from "./betterReadingMarker";

export interface BetterReadingSettings {
    betterReadingMode: boolean;
}

const DEFAULT_SETTINGS: BetterReadingSettings = {
    betterReadingMode: false,
};

const toogleMode = (app: App) => {
    const leaves = app.workspace.getLeavesOfType("markdown");
    leaves.forEach((leaf) => {

        // @ts-ignore expected-error-internal-method
        leaf.rebuildView();

    });
};

const initStatusBar = (plugin: BetterReadingPlugin) => {
    return () => {
        const statusBarRect =
            plugin.statusBarEl.parentElement.getBoundingClientRect();
        const statusBarIconRect = plugin.statusBarEl.getBoundingClientRect();

        const menu = new Menu().addItem((item) => {
            item.setTitle("Better Reading").setIcon("book");

            const itemDom = (item as any).dom as HTMLElement;
            const toggleComponent = new ToggleComponent(itemDom)
                .setValue(plugin.settings.betterReadingMode)
                .setDisabled(true);

            item.onClick((e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                plugin.toggle(() => {
                    toogleMode(plugin.app);
                    toggleComponent.setValue(plugin.settings.betterReadingMode);
                    plugin.statusBarEl.setText(plugin.settings.betterReadingMode ? 'BttRead Mode' : 'Normal Mode');
                });
            });
        });

        const menuDom = (menu as any).dom as HTMLElement;
        menuDom.addClass("br-statusbar-menu");

        menu.showAtPosition({
            x: statusBarIconRect.right + 5,
            y: statusBarRect.top - 5,
        });
    };
};

export default class BetterReadingPlugin extends Plugin {
    settings: BetterReadingSettings;
    statusBarEl: HTMLElement;

    async onload() {
        await this.loadSettings();

        this.initCommands();
        this.setupStatusBar();

        this.addSettingTab(new BetterReadingSettingTab(this.app, this));
        this.registerEditorExtension(betterReadingExtension(this.app, this));
        this.registerMarkdownPostProcessor((el, ctx) => {
            highlightTextInElement({
                app: this.app, element: el, rules, settings: this.settings
            });
        });
    }

    setupStatusBar() {
        this.statusBarEl = this.addStatusBarItem();
        this.statusBarEl.addClass("br-statusbar-button");
        this.statusBarEl.setText(this.settings.betterReadingMode ? 'BttRead Mode' : 'Normal Mode');

        this.registerDomEvent(this.statusBarEl, "click", () => initStatusBar(this)());
    }

    toggle = async (cb?: () => void) => {
        this.settings.betterReadingMode = !this.settings.betterReadingMode;
        await this.saveSettings();
        cb?.();
    };

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    initCommands() {
        this.addCommand({
            id: 'toggle-better-reading-mode',
            name: 'Toggle better reading mode',
            callback: async () => {
                await this.toggle(() => {
                    toogleMode(this.app);
                });
            }
        });
    }
}

class BetterReadingSettingTab extends PluginSettingTab {
    plugin: BetterReadingPlugin;

    constructor(app: App, plugin: BetterReadingPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async applySettingsUpdate() {
        await this.plugin.saveSettings();
    }

    updateSettings = debounce(this.applySettingsUpdate.bind(this), 100);

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: '📚 Better Reading'});

        new Setting(containerEl)
            .setName('Toggle better reading mode')
            .setDesc('Toggle this to enable better reading mode. You can also toggle this in status bar.')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.betterReadingMode).onChange(async (value) => {
                    this.plugin.settings.betterReadingMode = value;
                    this.updateSettings();
                    toogleMode(this.app);
                }));

        this.containerEl.createEl('h2', {text: 'Say Thank You'});

        new Setting(containerEl)
            .setName('Donate')
            .setDesc('If you like this plugin, consider donating to support continued development:')
            .addButton((bt) => {
                const aTagEL = bt.buttonEl.createEl('a', {
                    href: "https://www.buymeacoffee.com/boninall"
                });
                bt.buttonEl.addClass("br-donate-button");

                const favicon = document.createElement("img") as HTMLImageElement;
                favicon.src = "https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=boninall&button_colour=6495ED&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00";
                aTagEL.appendChild(favicon);
            });
    }
}
