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
            vscode.window.showInformationMessage('No novel project in empty workspace');
            return Promise.resolve([]);
        }

        const manuscriptPath = path.join(this.workspaceRoot, 'Manuscript');

        // If "Manuscript" folder doesn't exist, we might want to prompt or show empty
        if (!fs.existsSync(manuscriptPath)) {
            // Check if we act on root or just return empty
            return Promise.resolve([]);
        }

        const searchPath = element ? element.resourceUri!.fsPath : manuscriptPath;

        return Promise.resolve(this.getItems(searchPath));
    }

    private getItems(searchPath: string): NovelItem[] {
        if (!fs.existsSync(searchPath)) {
            return [];
        }

        const items = fs.readdirSync(searchPath);

        return items.map(itemName => {
            const itemPath = path.join(searchPath, itemName);
            const isDirectory = fs.statSync(itemPath).isDirectory();

            if (isDirectory) {
                return new NovelItem(
                    itemName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    vscode.Uri.file(itemPath),
                    'chapter'
                );
            } else if (itemName.endsWith('.md')) {
                return new NovelItem(
                    itemName,
                    vscode.TreeItemCollapsibleState.None,
                    vscode.Uri.file(itemPath),
                    'scene',
                    {
                        command: 'vscode.open',
                        title: "Open Scene",
                        arguments: [vscode.Uri.file(itemPath)]
                    }
                );
            }
            return null;
        }).filter(item => item !== null) as NovelItem[];
    }
}

export class NovelItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        public readonly contextValue: string, // 'chapter' or 'scene'
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}`;
        this.description = this.contextValue === 'scene' ? 'Scene' : 'Chapter';
    }
}
