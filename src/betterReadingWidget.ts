import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType, } from '@codemirror/view';
import { SearchCursor } from "@codemirror/search";
import { App, MarkdownView } from 'obsidian';
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { RegExpCursor } from "./regexp-cursor";
import betterReadingPlugin from "./betterReadingIndex";

class BetterReadingWidget extends WidgetType {
	constructor(
		readonly plugin: betterReadingPlugin,
		readonly view: EditorView,
		readonly from: number,
		readonly to: number,
	) {
		super();
	}

	eq(other: BetterReadingWidget) {
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
		return createSpan('cm-better-reading');
		// return document.createElement("b");
	}

	ignoreEvent() {
		return true;
	}
}

export function betterReadingExtension(app: App, plugin: betterReadingPlugin) {
	return ViewPlugin.fromClass(
		class {
			betterReadingDecorations: DecorationSet = Decoration.none;

			constructor(public view: EditorView) {
				let { textDeco } = this.getDeco(view);
				this.betterReadingDecorations = textDeco;
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					let { textDeco } = this.getDeco(update.view);
					this.betterReadingDecorations = textDeco;
				}
			}

			getDeco(view: EditorView): {
				textDeco: DecorationSet;
			} {
				let { state } = view,
					// @ts-ignore
					betterReadingDecos: Range<Decoration>[] = [];
				if(!plugin?.settings.betterReadingMode) {
					return {
						textDeco: Decoration.set(betterReadingDecos),
					};
				}
				for (let part of view.visibleRanges) {
					let betterReadingCursor: RegExpCursor | SearchCursor;
					try {
						betterReadingCursor = new RegExpCursor(state.doc, "[a-zA-Z\\u0400-\\u04FF]+", {}, part.from, part.to);
					} catch (err) {
						console.debug(err);
						continue;
					}
					while (!betterReadingCursor.next().done) {
						let { from, to } = betterReadingCursor.value;
						const linePos = view.state.doc.lineAt(from)?.from;
						let syntaxNode = syntaxTree(view.state).resolveInner(linePos + 1),
							nodeProps: string = syntaxNode.type.prop(tokenClassNodeProp),
							excludedSection = ["hmd-codeblock", "hmd-frontmatter", "cm-inline-code", "comment", "header"].find(token =>
								nodeProps?.split(" ").includes(token)
							);
						if (excludedSection) continue;

						const markDeco = Decoration.mark({ class: "cm-better-reading" });
						let wordLength = to - from;

						if (wordLength <= 3) {
							betterReadingDecos.push(markDeco.range(from, from +1));
						} else if (wordLength === 4) {
							betterReadingDecos.push(markDeco.range(from, from + 2));
						} else if (wordLength > 4) {
							betterReadingDecos.push(markDeco.range(from, from + Math.ceil(wordLength * 0.50)));
						}
					}
				}
				return {
					textDeco: Decoration.set(betterReadingDecos.sort((a, b) => a.from - b.from)),
				};
			}
		},
		{
			provide: plugin => [
				// these are separated out so that we can set decoration priority
				// it's also much easier to sort the decorations when they're grouped
				EditorView.decorations.of(v => v.plugin(plugin)?.betterReadingDecorations || Decoration.none),
			],
		}
	);
}
