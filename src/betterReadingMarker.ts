import { App } from "obsidian";
import { BetterReadingSettings } from "./betterReadingIndex";

interface HighlightRule {
    regexPattern: string;
    creator: ReplacementElementCreator;
}

type ReplacementElementCreator = (matchedText: string) => HTMLElement;

function createHighlightSpan(
    word: string, index: number
) {
    const parentEl = createEl("span");
    const boldEl = parentEl.createEl("strong");
    boldEl.toggleClass("better-reading-highlight", true);
    boldEl.setText(word.slice(0, index));
    const restPart = word.slice(index);
    const restEl = document.createTextNode(restPart);
    parentEl.appendChild(restEl);

    return parentEl;
}

export const rules: HighlightRule[] = [
    {
        regexPattern: '\\b[a-zA-Z\\u0400-\\u04FF]+\\b', // 正则表达式，匹配单词
        creator: (word) => {
            let boldLength = 0;
            const wordLength = word.trim().length;

            if (wordLength < 3) {
                boldLength = 1;
            } else if (wordLength === 4) {
                boldLength = 2;
            } else {
                boldLength = Math.ceil(wordLength * 0.50);
            }

            if (!boldLength) return createSpan("strong");

            return createHighlightSpan(word.trim(), boldLength);
        }
    },
];


export function highlightTextInElement({
                                           app, element, rules, settings
                                       }: {
    app: App, element: HTMLElement, rules: HighlightRule[], settings: BetterReadingSettings
}) {
    if (!settings.betterReadingMode) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;

    const nodesToProcess: Node[] = [];
    while ((node = walker.nextNode())) {
        nodesToProcess.push(node);
    }

    nodesToProcess.forEach((node) => {
        replaceTextWithElements(app, node, rules);
    });
}

function replaceTextWithElements(app: App, node: Node, rules: HighlightRule[]) {
    if (node.nodeType === Node.TEXT_NODE) {
        let textContent = node.textContent || "";

        rules.forEach((rule) => {
            let newTextContent = "";
            let match;
            const regex = new RegExp(rule.regexPattern, "g");
            let lastIndex = 0;

            while ((match = regex.exec(textContent)) !== null) {
                const part = match[0];

                const precedingText = textContent.substring(lastIndex, match.index);
                newTextContent += precedingText;

                const replacementElement = rule.creator(part);
                newTextContent += `<span data-replace>${replacementElement.outerHTML}</span>`;
                lastIndex = regex.lastIndex;
            }

            newTextContent += textContent.substring(lastIndex);
            textContent = newTextContent;
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(textContent, "text/html");
        console.log(doc.body.childNodes);
        Array.from(doc.body.childNodes).forEach((newNode) => {
            if (newNode.nodeName === "#text") {
                node.parentNode?.insertBefore(newNode.cloneNode(true), node);
                return;
            }

            if (newNode.nodeName === "SPAN" && (newNode as Element).getAttribute("data-replace") === "") {
                Array.from(newNode.childNodes).forEach((child) => {
                    node.parentNode?.insertBefore(child.cloneNode(true), node);
                });
            } else {
                node.parentNode?.insertBefore(newNode.cloneNode(true), node);
            }
        });

        node.parentNode?.removeChild(node);
    }
}
