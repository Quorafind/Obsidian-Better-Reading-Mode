import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType, } from '@codemirror/view';
import { SearchCursor } from "@codemirror/search";
import { App, MarkdownView } from 'obsidian';
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { RegExpCursor } from "./regexp-cursor";
import bionicReadingPlugin from "./bionicReadingIndex";

class BionicReadingWidget extends WidgetType {
	constructor(
		readonly plugin: bionicReadingPlugin,
		readonly view: EditorView,
		readonly from: number,
		readonly to: number,
	) {
		super();
	}

	eq(other: BionicReadingWidget) {
		const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			return;
		}

		const editor = markdownView.editor;
		const offset = editor.offsetToPos(this.from);
		const originalOffset = editor.offsetToPos(other.from);
		if (offset.line === originalOffset.line) {
			return true;
		}
		return other.view === this.view && other.from === this.from && other.to === this.to;
	}

	toDOM() {
		return createSpan('cm-bionic-reading');
		// return document.createElement("b");
	}

	ignoreEvent() {
		return true;
	}
}

export function bionicReadingExtension(app: App, plugin: bionicReadingPlugin) {
	return ViewPlugin.fromClass(
		class {
			bionicReadingDecorations: DecorationSet = Decoration.none;

			constructor(public view: EditorView) {
				let { bionic } = this.getDeco(view);
				this.bionicReadingDecorations = bionic;
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					let { bionic } = this.getDeco(update.view);
					this.bionicReadingDecorations = bionic;
				}
			}

			getDeco(view: EditorView): {
				bionic: DecorationSet;
			} {
				let { state } = view,
					// @ts-ignore
					bionicReadingDecos: Range<Decoration>[] = [];
				if(!plugin?.settings.bionicReadingMode) {
					return {
						bionic: Decoration.set(bionicReadingDecos),
					};
				}
				for (let part of view.visibleRanges) {
					let bionicReadingCursor: RegExpCursor | SearchCursor;
					try {
						bionicReadingCursor = new RegExpCursor(state.doc, "[a-zA-Z]+", {}, part.from, part.to);
					} catch (err) {
						console.debug(err);
						continue;
					}
					while (!bionicReadingCursor.next().done) {
						let { from, to } = bionicReadingCursor.value;
						const linePos = view.state.doc.lineAt(from)?.from;
						let syntaxNode = syntaxTree(view.state).resolveInner(linePos + 1),
							nodeProps: string = syntaxNode.type.prop(tokenClassNodeProp),
							excludedSection = ["hmd-codeblock", "hmd-frontmatter", "cm-inline-code", "comment"].find(token =>
								nodeProps?.split(" ").includes(token)
							);
						if (excludedSection) continue;

						const markDeco = Decoration.mark({ class: "cm-bionic-reading" });
						let wordLength = to - from;

						if (wordLength <= 3) {
							bionicReadingDecos.push(markDeco.range(from, from +1));
						} else if (wordLength === 4) {
							bionicReadingDecos.push(markDeco.range(from, from + 2));
						} else if (wordLength > 4) {
							bionicReadingDecos.push(markDeco.range(from, from + Math.ceil(wordLength * 0.50)));
						}
					}
				}
				return {
					bionic: Decoration.set(bionicReadingDecos.sort((a, b) => a.from - b.from)),
				};
			}
		},
		{
			provide: plugin => [
				// these are separated out so that we can set decoration priority
				// it's also much easier to sort the decorations when they're grouped
				EditorView.decorations.of(v => v.plugin(plugin)?.bionicReadingDecorations || Decoration.none),
			],
		}
	);
}
