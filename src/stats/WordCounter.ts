import * as vscode from 'vscode';

export class WordCounter {
    private statusBarItem: vscode.StatusBarItem;
    private lastWordCount: number = 0;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'novel-assistant.showStats';
    }

    public update(): void {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        const doc = editor.document;

        // Only count for markdown and plaintext
        if (doc.languageId !== 'markdown' && doc.languageId !== 'plaintext') {
            this.statusBarItem.hide();
            return;
        }

        const text = doc.getText();
        const wordCount = this.countWords(text);
        const readingTime = this.calculateReadingTime(wordCount);
        const charCount = text.length;

        this.lastWordCount = wordCount;

        // Format display
        const wordLabel = wordCount === 1 ? 'word' : 'words';
        const minLabel = readingTime === 1 ? 'min' : 'mins';

        this.statusBarItem.text = `$(book) ${wordCount.toLocaleString()} ${wordLabel} | ${readingTime} ${minLabel}`;
        this.statusBarItem.tooltip = this.getTooltip(wordCount, charCount, readingTime, text);
        this.statusBarItem.show();
    }

    private countWords(text: string): number {
        // Strip markdown formatting for accurate count
        const cleanText = this.stripMarkdown(text);

        // Handle edge cases
        if (!cleanText || cleanText.trim().length === 0) {
            return 0;
        }

        // Split on whitespace and filter empty strings
        const words = cleanText
            .split(/\s+/)
            .filter(word => {
                // Must contain at least one letter or number
                return /[\p{L}\p{N}]/u.test(word);
            });

        return words.length;
    }

    private stripMarkdown(text: string): string {
        return text
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            // Remove headers markers
            .replace(/^#{1,6}\s*/gm, '')
            // Remove emphasis markers but keep text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/__(.+?)__/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            // Remove links but keep text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove images
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
            // Remove blockquote markers
            .replace(/^>\s*/gm, '')
            // Remove list markers
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            // Remove horizontal rules
            .replace(/^[-*_]{3,}\s*$/gm, '')
            // Remove HTML tags
            .replace(/<[^>]+>/g, '');
    }

    private calculateReadingTime(wordCount: number): number {
        const config = vscode.workspace.getConfiguration('novel-assistant');
        const wordsPerMinute = config.get<number>('wordsPerMinute', 200);
        return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
    }

    private getTooltip(wordCount: number, charCount: number, readingTime: number, text: string): string {
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const lines = text.split('\n').length;

        const config = vscode.workspace.getConfiguration('novel-assistant');
        const dailyGoal = config.get<number>('dailyWordGoal', 1000);
        const progress = Math.min(100, Math.round((wordCount / dailyGoal) * 100));

        return [
            `📊 Document Statistics`,
            `━━━━━━━━━━━━━━━━━━━━━`,
            `Words: ${wordCount.toLocaleString()}`,
            `Characters: ${charCount.toLocaleString()}`,
            `Paragraphs: ${paragraphs.toLocaleString()}`,
            `Sentences: ${sentences.toLocaleString()}`,
            `Lines: ${lines.toLocaleString()}`,
            ``,
            `📖 Reading Time: ~${readingTime} min`,
            ``,
            `🎯 Daily Goal: ${progress}% (${wordCount}/${dailyGoal})`,
            ``,
            `Click for detailed statistics`,
        ].join('\n');
    }

    public getWordCount(): number {
        return this.lastWordCount;
    }

    public getCurrentDocumentWordCount(): number {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return 0;
        }
        return this.countWords(editor.document.getText());
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
