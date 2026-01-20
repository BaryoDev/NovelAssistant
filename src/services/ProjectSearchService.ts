import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface SearchResult {
    filePath: string;
    fileName: string;
    lineNumber: number;
    lineContent: string;
    matchStart: number;
    matchEnd: number;
}

export class ProjectSearchService {
    private rootPath: string | undefined;

    constructor() {
        this.rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    public async search(query: string, options: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean } = {}): Promise<SearchResult[]> {
        if (!this.rootPath || !query) {
            return [];
        }

        const results: SearchResult[] = [];
        const manuscriptPath = path.join(this.rootPath, 'Manuscript');
        const files = await this.getAllMarkdownFiles(manuscriptPath);

        let searchPattern: RegExp;
        try {
            if (options.regex) {
                searchPattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
                searchPattern = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
            }
        } catch {
            // Invalid regex, fall back to simple search
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            searchPattern = new RegExp(escapedQuery, 'gi');
        }

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    let match;

                    while ((match = searchPattern.exec(line)) !== null) {
                        results.push({
                            filePath: file,
                            fileName: path.basename(file),
                            lineNumber: i + 1,
                            lineContent: line.trim(),
                            matchStart: match.index,
                            matchEnd: match.index + match[0].length,
                        });

                        // Prevent infinite loop for zero-length matches
                        if (match[0].length === 0) {
                            searchPattern.lastIndex++;
                        }
                    }

                    // Reset regex for next line
                    searchPattern.lastIndex = 0;
                }
            } catch {
                // Skip unreadable files
            }
        }

        return results;
    }

    public async searchAndReplace(
        query: string,
        replacement: string,
        options: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean } = {}
    ): Promise<{ filesModified: number; replacements: number }> {
        if (!this.rootPath || !query) {
            return { filesModified: 0, replacements: 0 };
        }

        const manuscriptPath = path.join(this.rootPath, 'Manuscript');
        const files = await this.getAllMarkdownFiles(manuscriptPath);

        let searchPattern: RegExp;
        try {
            if (options.regex) {
                searchPattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
                searchPattern = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
            }
        } catch {
            return { filesModified: 0, replacements: 0 };
        }

        let filesModified = 0;
        let totalReplacements = 0;

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const matches = content.match(searchPattern);

                if (matches && matches.length > 0) {
                    const newContent = content.replace(searchPattern, replacement);
                    fs.writeFileSync(file, newContent, 'utf-8');
                    filesModified++;
                    totalReplacements += matches.length;
                }
            } catch {
                // Skip unreadable/unwritable files
            }
        }

        return { filesModified, replacements: totalReplacements };
    }

    private async getAllMarkdownFiles(dir: string): Promise<string[]> {
        const files: string[] = [];

        try {
            if (!fs.existsSync(dir)) {
                return files;
            }

            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await this.getAllMarkdownFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.name.endsWith('.md')) {
                    files.push(fullPath);
                }
            }
        } catch {
            // Silent fail
        }

        return files;
    }

    public async showSearchPanel(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Search in project',
            placeHolder: 'Enter search term...',
        });

        if (!query) {
            return;
        }

        const results = await this.search(query);

        if (results.length === 0) {
            vscode.window.showInformationMessage(`No results found for "${query}"`);
            return;
        }

        const items = results.map(r => ({
            label: `$(file) ${r.fileName}:${r.lineNumber}`,
            description: r.lineContent.substring(0, 80),
            result: r,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${results.length} results found`,
            matchOnDescription: true,
        });

        if (selected) {
            const doc = await vscode.workspace.openTextDocument(selected.result.filePath);
            const editor = await vscode.window.showTextDocument(doc);

            const position = new vscode.Position(selected.result.lineNumber - 1, selected.result.matchStart);
            const endPosition = new vscode.Position(selected.result.lineNumber - 1, selected.result.matchEnd);

            editor.selection = new vscode.Selection(position, endPosition);
            editor.revealRange(new vscode.Range(position, endPosition), vscode.TextEditorRevealType.InCenter);
        }
    }

    public async showSearchAndReplace(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Search for',
            placeHolder: 'Enter search term...',
        });

        if (!query) {
            return;
        }

        const results = await this.search(query);

        if (results.length === 0) {
            vscode.window.showInformationMessage(`No results found for "${query}"`);
            return;
        }

        const replacement = await vscode.window.showInputBox({
            prompt: `Replace "${query}" with`,
            placeHolder: 'Enter replacement text...',
        });

        if (replacement === undefined) {
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Replace ${results.length} occurrences of "${query}" with "${replacement}"?`,
            { modal: true },
            'Replace All'
        );

        if (confirm === 'Replace All') {
            const result = await this.searchAndReplace(query, replacement);
            vscode.window.showInformationMessage(
                `Replaced ${result.replacements} occurrences in ${result.filesModified} files.`
            );
        }
    }

    public dispose(): void {
        // Cleanup if needed
    }
}
