import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DesignSystem } from '../styles/DesignSystem';

interface Character {
    name: string;
    filePath: string;
    role?: string;
    description?: string;
}

export class CharacterPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'novel-assistant.characterPanel';
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
                case 'openCharacter':
                    this.openCharacter(message.filePath);
                    break;
                case 'newCharacter':
                    this.createNewCharacter();
                    break;
                case 'refresh':
                    this.refresh();
                    break;
            }
        });
    }

    public refresh(): void {
        if (this._view) {
            this._view.webview.html = this.getHtml();
        }
    }

    private getCharacters(): Character[] {
        if (!this.rootPath) {
            return [];
        }

        const charactersPath = path.join(this.rootPath, 'Characters');

        try {
            if (!fs.existsSync(charactersPath)) {
                return [];
            }

            const files = fs.readdirSync(charactersPath).filter(f => f.endsWith('.md'));

            return files.map(file => {
                const filePath = path.join(charactersPath, file);
                const content = this.safeReadFile(filePath);
                const parsed = this.parseCharacterFile(content);

                return {
                    name: file.replace('.md', ''),
                    filePath,
                    role: parsed.role,
                    description: parsed.description,
                };
            });
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

    private parseCharacterFile(content: string): { role?: string; description?: string } {
        const result: { role?: string; description?: string } = {};

        // Try to extract role from markdown
        const roleMatch = content.match(/^##?\s*Role:?\s*(.+)$/im);
        if (roleMatch) {
            result.role = roleMatch[1].trim();
        }

        // Try to extract first paragraph as description
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        if (lines.length > 0) {
            result.description = lines[0].substring(0, 100) + (lines[0].length > 100 ? '...' : '');
        }

        return result;
    }

    private async openCharacter(filePath: string): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open character file: ${error instanceof Error ? error.message : 'File not found'}`);
        }
    }

    private async createNewCharacter(): Promise<void> {
        if (!this.rootPath) {
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter character name',
            placeHolder: 'e.g., John Smith',
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return 'Character name cannot be empty';
                }
                if (/[<>:"/\\|?*]/.test(value)) {
                    return 'Character name contains invalid characters: < > : " / \\ | ? *';
                }
                return null;
            },
        });

        if (!name) {
            return;
        }

        const charactersPath = path.join(this.rootPath, 'Characters');

        try {
            if (!fs.existsSync(charactersPath)) {
                fs.mkdirSync(charactersPath, { recursive: true });
            }

            const filePath = path.join(charactersPath, `${name}.md`);

            const template = `# ${name}

## Role
[Main character / Supporting / Antagonist / etc.]

## Physical Description
- Age:
- Appearance:
- Distinguishing features:

## Personality
- Traits:
- Strengths:
- Weaknesses:

## Background
[Brief backstory]

## Goals & Motivations
[What does this character want?]

## Relationships
[Connections to other characters]

## Notes
[Additional notes]
`;

            fs.writeFileSync(filePath, template);

            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);

            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Could not create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getHtml(): string {
        const characters = this.getCharacters();

        const characterCards = characters.length > 0
            ? characters.map(c => `
                <div class="character-card"
                     role="button"
                     tabindex="0"
                     aria-label="Open character: ${c.name}"
                     onclick="openCharacter('${c.filePath.replace(/\\/g, '\\\\')}')"
                     onkeydown="handleCardKeydown(event, '${c.filePath.replace(/\\/g, '\\\\')}')">
                    <div class="character-avatar">${c.name.charAt(0).toUpperCase()}</div>
                    <div class="character-info">
                        <div class="character-name">${c.name}</div>
                        ${c.role ? `<div class="character-role">${c.role}</div>` : ''}
                    </div>
                </div>
            `).join('')
            : `<div class="empty-state">
                <div class="empty-icon">👤</div>
                <div class="empty-title">No characters yet</div>
                <div class="empty-hint">Click the + button above to create your first character and bring your story to life.</div>
            </div>`;

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        ${DesignSystem.getCompleteStylesheet()}

        body {
            padding: var(--space-md);
            margin: 0;
            background: transparent;
            color: var(--text-primary);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-lg);
            padding-bottom: var(--space-md);
            border-bottom: 1px solid var(--border-primary);
        }

        .title {
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            opacity: 0.8;
        }

        .actions button {
            background: transparent;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            padding: var(--space-xs) var(--space-sm);
            font-size: 16px;
            opacity: 0.7;
            transition: all var(--duration-fast) var(--easing-standard);
            border-radius: var(--radius-sm);
        }

        .actions button:hover {
            opacity: 1;
            background: var(--bg-hover);
            transform: scale(1.1);
        }

        .character-card {
            display: flex;
            align-items: center;
            gap: var(--space-md);
            padding: var(--space-md);
            margin-bottom: var(--space-sm);
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--duration-normal) var(--easing-standard);
            animation: slideUp var(--duration-normal) var(--easing-decelerate);
        }

        .character-card:hover {
            background: var(--bg-hover);
            transform: translateY(-2px) translateX(4px);
            box-shadow: var(--shadow-md);
        }

        .character-avatar {
            width: 40px;
            height: 40px;
            border-radius: var(--radius-full);
            background: var(--gradient-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 16px;
            color: white;
            flex-shrink: 0;
            transition: all var(--duration-normal) var(--easing-standard);
            box-shadow: var(--shadow-sm);
        }

        .character-card:hover .character-avatar {
            transform: scale(1.15) rotate(5deg);
            box-shadow: var(--shadow-md);
        }

        .character-info {
            flex: 1;
            min-width: 0;
        }

        .character-name {
            font-weight: 500;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: color var(--duration-fast) var(--easing-standard);
        }

        .character-card:hover .character-name {
            color: var(--color-primary);
        }

        .character-role {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 2px;
        }

        .empty-state {
            text-align: center;
            padding: var(--space-2xl) var(--space-md);
            opacity: 0.8;
            font-size: 12px;
            animation: fadeIn var(--duration-slow) var(--easing-standard);
        }

        .empty-icon {
            font-size: 48px;
            margin-bottom: var(--space-md);
            opacity: 0.5;
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .empty-title {
            font-weight: 500;
            margin-bottom: var(--space-sm);
            font-size: 14px;
        }

        .empty-hint {
            opacity: 0.6;
            line-height: 1.6;
        }

        .character-card:focus {
            outline: 2px solid var(--border-focus);
            outline-offset: 2px;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="title">Characters</span>
        <div class="actions">
            <button onclick="refresh()" title="Refresh" aria-label="Refresh character list">↻</button>
            <button onclick="newCharacter()" title="New Character" aria-label="Create new character">+</button>
        </div>
    </div>
    <div class="character-list">
        ${characterCards}
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function openCharacter(filePath) {
            vscode.postMessage({ command: 'openCharacter', filePath });
        }
        function newCharacter() {
            vscode.postMessage({ command: 'newCharacter' });
        }
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        function handleCardKeydown(event, filePath) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCharacter(filePath);
            }
        }
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        // Cleanup if needed
    }
}
