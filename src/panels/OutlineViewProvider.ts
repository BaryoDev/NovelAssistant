import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DesignSystem } from '../styles/DesignSystem';
import { renderOutlineItem } from '../util/render';
import { getNonce, isInsideDir } from '../util/security';

interface OutlineItem {
    id: string;
    title: string;
    type: 'chapter' | 'scene';
    filePath?: string;
    children: OutlineItem[];
    wordCount: number;
    status: 'draft' | 'revision' | 'complete' | 'none';
    synopsis?: string;
}

export class OutlineViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'novel-assistant.outlineView';
    private _view?: vscode.WebviewView;
    private rootPath: string | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'openFile':
                    if (this.isInManuscript(message.filePath)) {
                        this.openFile(message.filePath);
                    }
                    break;
                case 'newChapter':
                    this.createNewChapter();
                    break;
                case 'newScene':
                    if (message.chapterPath === undefined || this.isInManuscript(message.chapterPath)) {
                        this.createNewScene(message.chapterPath);
                    }
                    break;
                case 'refresh':
                    this.refresh();
                    break;
            }
        });
    }

    private isInManuscript(target: unknown): boolean {
        return !!this.rootPath && isInsideDir(path.join(this.rootPath, 'Manuscript'), target);
    }

    public refresh(): void {
        if (this._view) {
            this._view.webview.html = this.getHtml();
        }
    }

    private getOutline(): OutlineItem[] {
        if (!this.rootPath) {
            return [];
        }

        const manuscriptPath = path.join(this.rootPath, 'Manuscript');

        try {
            if (!fs.existsSync(manuscriptPath)) {
                return [];
            }

            return this.buildOutline(manuscriptPath);
        } catch {
            return [];
        }
    }

    private buildOutline(dirPath: string): OutlineItem[] {
        try {
            const items = fs.readdirSync(dirPath);
            const result: OutlineItem[] = [];

            // Sort items
            items.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory()) {
                    const children = this.buildOutline(itemPath);
                    const wordCount = children.reduce((sum, c) => sum + c.wordCount, 0);

                    result.push({
                        id: itemPath,
                        title: item,
                        type: 'chapter',
                        filePath: itemPath,
                        children,
                        wordCount,
                        status: this.inferStatus(children),
                    });
                } else if (item.endsWith('.md')) {
                    const content = this.safeReadFile(itemPath);
                    const wordCount = this.countWords(content);
                    const synopsis = this.extractSynopsis(content);

                    result.push({
                        id: itemPath,
                        title: item.replace('.md', ''),
                        type: 'scene',
                        filePath: itemPath,
                        children: [],
                        wordCount,
                        status: this.detectSceneStatus(content),
                        synopsis,
                    });
                }
            }

            return result;
        } catch {
            return [];
        }
    }

    private safeReadFile(filePath: string): string {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return '';
        }
    }

    private countWords(text: string): number {
        const cleanText = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^#{1,6}\s*/gm, '');

        return cleanText
            .split(/\s+/)
            .filter(w => /[\p{L}\p{N}]/u.test(w))
            .length;
    }

    private extractSynopsis(content: string): string | undefined {
        // Look for a synopsis marker or first paragraph
        const synopsisMatch = content.match(/^##?\s*Synopsis:?\s*\n(.+?)(?=\n#|\n\n)/is);
        if (synopsisMatch) {
            return synopsisMatch[1].trim().substring(0, 150);
        }

        // Get first non-header paragraph
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        if (lines.length > 0) {
            return lines[0].substring(0, 150) + (lines[0].length > 150 ? '...' : '');
        }

        return undefined;
    }

    private detectSceneStatus(content: string): 'draft' | 'revision' | 'complete' | 'none' {
        const lower = content.toLowerCase();

        if (lower.includes('[complete]') || lower.includes('status: complete')) {
            return 'complete';
        }
        if (lower.includes('[revision]') || lower.includes('status: revision')) {
            return 'revision';
        }
        if (lower.includes('[draft]') || lower.includes('status: draft')) {
            return 'draft';
        }
        if (content.trim().length < 50) {
            return 'none';
        }

        return 'draft';
    }

    private inferStatus(children: OutlineItem[]): 'draft' | 'revision' | 'complete' | 'none' {
        if (children.length === 0) { return 'none'; }

        const statuses = children.map(c => c.status);
        if (statuses.every(s => s === 'complete')) { return 'complete'; }
        if (statuses.every(s => s === 'none')) { return 'none'; }
        if (statuses.some(s => s === 'revision')) { return 'revision'; }

        return 'draft';
    }

    private async openFile(filePath: string): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open file: ${error instanceof Error ? error.message : 'File not found'}`);
        }
    }

    private async createNewChapter(): Promise<void> {
        if (!this.rootPath) {
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter chapter name',
            placeHolder: 'e.g., Chapter 1 - The Beginning',
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'Chapter name cannot be empty';
                }
                if (/[<>:"/\\|?*]/.test(value)) {
                    return 'Chapter name contains invalid characters: < > : " / \\ | ? *';
                }
                return null;
            },
        });

        if (!name) {
            return;
        }

        const manuscriptPath = path.join(this.rootPath, 'Manuscript');
        const chapterPath = path.join(manuscriptPath, name);

        try {
            if (!fs.existsSync(manuscriptPath)) {
                fs.mkdirSync(manuscriptPath, { recursive: true });
            }
            if (!fs.existsSync(chapterPath)) {
                fs.mkdirSync(chapterPath);
            }

            this.refresh();
            vscode.window.showInformationMessage(`Created chapter: ${name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not create chapter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async createNewScene(chapterPath?: string): Promise<void> {
        if (!this.rootPath) {
            return;
        }

        // If no chapter path provided, ask user to select
        let targetPath = chapterPath;

        if (!targetPath) {
            const manuscriptPath = path.join(this.rootPath, 'Manuscript');
            try {
                if (!fs.existsSync(manuscriptPath)) {
                    fs.mkdirSync(manuscriptPath, { recursive: true });
                }

                const chapters = fs.readdirSync(manuscriptPath)
                    .filter(f => fs.statSync(path.join(manuscriptPath, f)).isDirectory());

                if (chapters.length === 0) {
                    vscode.window.showWarningMessage('Please create a chapter first.');
                    return;
                }

                const selected = await vscode.window.showQuickPick(chapters, {
                    placeHolder: 'Select chapter for new scene',
                });

                if (!selected) {
                    return;
                }

                targetPath = path.join(manuscriptPath, selected);
            } catch (error) {
                vscode.window.showErrorMessage(`Could not access manuscript folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
                return;
            }
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter scene name',
            placeHolder: 'e.g., Scene 1 - Opening',
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'Scene name cannot be empty';
                }
                if (/[<>:"/\\|?*]/.test(value)) {
                    return 'Scene name contains invalid characters: < > : " / \\ | ? *';
                }
                return null;
            },
        });

        if (!name || !targetPath) {
            return;
        }

        try {
            const filePath = path.join(targetPath, `${name}.md`);
            const template = `# ${name}

## Synopsis
[Brief scene summary]

---

[Start writing your scene here...]
`;

            fs.writeFileSync(filePath, template);

            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);

            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Could not create scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getHtml(): string {
        const outline = this.getOutline();
        const totalWords = outline.reduce((sum, item) => sum + item.wordCount, 0);

        const nonce = getNonce();
        const renderItem = (item: OutlineItem): string =>
            renderOutlineItem(item, status => this.getStatusIcon(status));

        const outlineHtml = outline.length > 0
            ? outline.map(item => renderItem(item)).join('')
            : '<div class="empty-state">No manuscript content yet.<br>Click + to add a chapter.</div>';

        return `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <style>
        ${DesignSystem.getCompleteStylesheet()}

        body {
            padding: var(--space-md);
            margin: 0;
            background: transparent;
            color: var(--text-primary);
            font-size: 13px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-md);
            padding-bottom: var(--space-sm);
            border-bottom: 1px solid var(--border-primary);
        }

        .title {
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.8;
            font-size: 11px;
        }

        .total-words {
            font-size: 11px;
            opacity: 0.7;
        }

        .actions button {
            background: transparent;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            padding: 2px var(--space-sm);
            font-size: 14px;
            opacity: 0.7;
            transition: all var(--duration-fast) var(--easing-standard);
            border-radius: var(--radius-sm);
        }

        .actions button:hover {
            opacity: 1;
            background: var(--bg-hover);
            transform: scale(1.1);
        }

        .outline-item {
            padding: var(--space-sm);
            border-radius: var(--radius-sm);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            transition: all var(--duration-fast) var(--easing-standard);
        }

        .outline-item:hover {
            background: var(--bg-hover);
            transform: translateX(2px);
        }

        .outline-item.chapter {
            flex-direction: column;
            align-items: stretch;
        }

        .item-header {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-xs) 0;
        }

        .expand-icon {
            font-size: 10px;
            opacity: 0.6;
            transition: transform var(--duration-normal) var(--easing-standard);
        }

        .expand-icon.collapsed {
            transform: rotate(-90deg);
        }

        .item-icon {
            font-size: 14px;
            transition: transform var(--duration-fast) var(--easing-standard);
        }

        .outline-item:hover .item-icon {
            transform: scale(1.15);
        }

        .item-title { flex: 1; }

        .item-meta {
            font-size: 10px;
            opacity: 0.5;
        }

        .chapter-children {
            margin-left: var(--space-md);
            overflow: hidden;
            transition: all var(--duration-normal) var(--easing-standard);
            max-height: 10000px;
            opacity: 1;
        }

        .chapter-children.collapsed {
            max-height: 0;
            opacity: 0;
            margin-top: 0;
        }

        .status-badge {
            font-size: 10px;
            padding: 2px var(--space-xs);
            border-radius: var(--radius-sm);
            font-weight: 500;
            transition: all var(--duration-fast) var(--easing-standard);
        }

        .status-badge.complete {
            background: var(--status-complete-bg);
            color: var(--status-complete-text);
        }

        .status-badge.revision {
            background: var(--status-revision-bg);
            color: var(--status-revision-text);
        }

        .status-badge.draft {
            background: var(--status-draft-bg);
            color: var(--status-draft-text);
        }

        .status-badge.none { opacity: 0.3; }

        .status-badge:hover {
            transform: scale(1.1);
            box-shadow: var(--shadow-sm);
        }

        .outline-item.scene:focus,
        .item-header:focus {
            outline: 2px solid var(--border-focus);
            outline-offset: 2px;
        }

        .empty-state {
            text-align: center;
            padding: var(--space-2xl) var(--space-md);
            opacity: 0.6;
            font-size: 12px;
            line-height: 1.6;
            animation: fadeIn var(--duration-slow) var(--easing-standard);
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="title">Outline</span>
        <span class="total-words">${totalWords.toLocaleString()} words</span>
        <div class="actions">
            <button id="refresh-btn" title="Refresh" aria-label="Refresh outline">↻</button>
            <button id="chapter-btn" title="New Chapter" aria-label="Create new chapter">📁+</button>
            <button id="scene-btn" title="New Scene" aria-label="Create new scene">📄+</button>
        </div>
    </div>
    <div class="outline-container">
        ${outlineHtml}
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function toggleChapter(header) {
            const icon = header.querySelector('.expand-icon');
            const children = header.nextElementSibling;
            const isCollapsed = icon.classList.toggle('collapsed');
            children.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', !isCollapsed);
        }
        function activate(target) {
            const header = target.closest('.item-header');
            if (header) { toggleChapter(header); return; }
            const scene = target.closest('.outline-item.scene');
            if (scene) { vscode.postMessage({ command: 'openFile', filePath: scene.dataset.path }); }
        }
        document.getElementById('refresh-btn').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
        document.getElementById('chapter-btn').addEventListener('click', () => vscode.postMessage({ command: 'newChapter' }));
        document.getElementById('scene-btn').addEventListener('click', () => vscode.postMessage({ command: 'newScene' }));
        const container = document.querySelector('.outline-container');
        container.addEventListener('click', (event) => activate(event.target));
        container.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate(event.target);
            }
        });
    </script>
</body>
</html>`;
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'complete': return '✓';
            case 'revision': return '↻';
            case 'draft': return '✎';
            default: return '○';
        }
    }

    public dispose(): void {
        // Cleanup if needed
    }
}
