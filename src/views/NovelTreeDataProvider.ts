import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class NovelTreeDataProvider implements vscode.TreeDataProvider<NovelItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<NovelItem | undefined | null | void> = new vscode.EventEmitter<NovelItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<NovelItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string | undefined) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: NovelItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: NovelItem): Thenable<NovelItem[]> {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        const manuscriptPath = path.join(this.workspaceRoot, 'Manuscript');

        if (!fs.existsSync(manuscriptPath)) {
            return Promise.resolve([]);
        }

        const searchPath = element ? element.resourceUri!.fsPath : manuscriptPath;

        return Promise.resolve(this.getItems(searchPath));
    }

    private getItems(searchPath: string): NovelItem[] {
        try {
            if (!fs.existsSync(searchPath)) {
                return [];
            }

            const items = fs.readdirSync(searchPath);

            // Sort: directories first, then files, both alphabetically
            const sorted = items.sort((a, b) => {
                const aPath = path.join(searchPath, a);
                const bPath = path.join(searchPath, b);
                const aIsDir = fs.statSync(aPath).isDirectory();
                const bIsDir = fs.statSync(bPath).isDirectory();

                if (aIsDir && !bIsDir) { return -1; }
                if (!aIsDir && bIsDir) { return 1; }
                return a.localeCompare(b, undefined, { numeric: true });
            });

            return sorted.map(itemName => {
                try {
                    const itemPath = path.join(searchPath, itemName);
                    const stat = fs.statSync(itemPath);
                    const isDirectory = stat.isDirectory();

                    if (isDirectory) {
                        const wordCount = this.getDirectoryWordCount(itemPath);
                        const fileCount = this.getFileCount(itemPath);

                        return new NovelItem(
                            itemName,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            vscode.Uri.file(itemPath),
                            'chapter',
                            undefined,
                            wordCount,
                            fileCount
                        );
                    } else if (itemName.endsWith('.md')) {
                        const wordCount = this.getFileWordCount(itemPath);
                        const displayName = itemName.replace(/\.md$/, '');

                        return new NovelItem(
                            displayName,
                            vscode.TreeItemCollapsibleState.None,
                            vscode.Uri.file(itemPath),
                            'scene',
                            {
                                command: 'vscode.open',
                                title: "Open Scene",
                                arguments: [vscode.Uri.file(itemPath)]
                            },
                            wordCount
                        );
                    }
                    return null;
                } catch {
                    return null;
                }
            }).filter(item => item !== null) as NovelItem[];
        } catch {
            return [];
        }
    }

    private getFileWordCount(filePath: string): number {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this.countWords(content);
        } catch {
            return 0;
        }
    }

    private getDirectoryWordCount(dirPath: string): number {
        try {
            let total = 0;
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    total += this.getDirectoryWordCount(itemPath);
                } else if (item.endsWith('.md')) {
                    total += this.getFileWordCount(itemPath);
                }
            }

            return total;
        } catch {
            return 0;
        }
    }

    private getFileCount(dirPath: string): number {
        try {
            let count = 0;
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    count += this.getFileCount(itemPath);
                } else if (item.endsWith('.md')) {
                    count++;
                }
            }

            return count;
        } catch {
            return 0;
        }
    }

    private countWords(text: string): number {
        // Strip markdown and count words
        const cleanText = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            .replace(/^#{1,6}\s*/gm, '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '');

        if (!cleanText.trim()) {
            return 0;
        }

        return cleanText
            .split(/\s+/)
            .filter(word => /[\p{L}\p{N}]/u.test(word))
            .length;
    }

    public getTotalWordCount(): number {
        if (!this.workspaceRoot) {
            return 0;
        }

        const manuscriptPath = path.join(this.workspaceRoot, 'Manuscript');
        return this.getDirectoryWordCount(manuscriptPath);
    }
}

export class NovelItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        public readonly contextValue: string,
        public readonly command?: vscode.Command,
        public readonly wordCount?: number,
        public readonly fileCount?: number
    ) {
        super(label, collapsibleState);

        // Set icon based on type
        if (contextValue === 'chapter') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.tooltip = this.buildChapterTooltip();
            this.description = this.formatWordCount(wordCount) + (fileCount ? ` • ${fileCount} scenes` : '');
        } else {
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.tooltip = this.buildSceneTooltip();
            this.description = this.formatWordCount(wordCount);
        }
    }

    private formatWordCount(count?: number): string {
        if (count === undefined || count === 0) {
            return '';
        }
        return `${count.toLocaleString()} words`;
    }

    private buildChapterTooltip(): string {
        const lines = [`📁 ${this.label}`];
        if (this.wordCount) {
            lines.push(`Words: ${this.wordCount.toLocaleString()}`);
        }
        if (this.fileCount) {
            lines.push(`Scenes: ${this.fileCount}`);
        }
        return lines.join('\n');
    }

    private buildSceneTooltip(): string {
        const lines = [`📄 ${this.label}`];
        if (this.wordCount) {
            lines.push(`Words: ${this.wordCount.toLocaleString()}`);
            const readingTime = Math.ceil(this.wordCount / 200);
            lines.push(`Reading time: ~${readingTime} min`);
        }
        lines.push('', 'Click to open in editor');
        return lines.join('\n');
    }
}
