import * as vscode from 'vscode';

export class WordCounter {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBarItem.command = 'novel-assistant.showStats'; // detailed stats could be a command
    }

    public update() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        const doc = editor.document;
        // Only count markdown or plain text files in the project
        if (doc.languageId === 'markdown' || doc.languageId === 'plaintext') {
            const text = doc.getText();
            const wordCount = this.countWords(text);

            // Reading time approximation (200 wpm)
            const readingTime = Math.ceil(wordCount / 200);

            this.statusBarItem.text = `$(book) ${wordCount} words | ${readingTime} min read`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private countWords(text: string): number {
        // Simple regex-based word count
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
