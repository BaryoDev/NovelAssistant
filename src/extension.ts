import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Views and Providers
import { NovelTreeDataProvider } from './views/NovelTreeDataProvider';
import { NovelEditorProvider } from './editor/NovelEditorProvider';
import { WordCounter } from './stats/WordCounter';
import { GitContentProvider } from './services/GitContentProvider';

// Panels
import { CharacterPanelProvider } from './panels/CharacterPanelProvider';
import { OutlineViewProvider } from './panels/OutlineViewProvider';
import { ProgressDashboardProvider } from './panels/ProgressDashboardProvider';
import { WelcomeViewProvider } from './panels/WelcomeViewProvider';

// Services
import { GitService } from './services/GitService';
import { WritingStatsService } from './services/WritingStatsService';
import { SprintTimerService } from './services/SprintTimerService';
import { ExportService } from './services/ExportService';
import { AutoBackupService } from './services/AutoBackupService';
import { WordAnalysisService } from './services/WordAnalysisService';
import { ProjectSearchService } from './services/ProjectSearchService';

export function activate(context: vscode.ExtensionContext) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Initialize services
    const gitService = new GitService();
    const statsService = new WritingStatsService();
    const sprintTimer = new SprintTimerService();
    const exportService = new ExportService();
    const autoBackupService = new AutoBackupService(gitService);
    const analysisService = new WordAnalysisService();
    const searchService = new ProjectSearchService();
    const wordCounter = new WordCounter();

    // Initialize tree view
    const novelProvider = new NovelTreeDataProvider(rootPath);
    vscode.window.registerTreeDataProvider('novel-structure', novelProvider);

    // Initialize panels
    const characterPanel = new CharacterPanelProvider(context);
    const outlinePanel = new OutlineViewProvider(context);
    const progressDashboard = new ProgressDashboardProvider(context, statsService, novelProvider);
    const welcomeView = new WelcomeViewProvider(context);

    // Register webview providers
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(CharacterPanelProvider.viewType, characterPanel),
        vscode.window.registerWebviewViewProvider(OutlineViewProvider.viewType, outlinePanel)
    );

    // Connect sprint timer to word counter
    sprintTimer.setWordCountProvider(() => wordCounter.getCurrentDocumentWordCount());

    // Start auto-backup service
    autoBackupService.start();

    // Start stats session
    statsService.startSession(wordCounter.getCurrentDocumentWordCount());

    // Register custom editor
    context.subscriptions.push(NovelEditorProvider.register(context));

    // Register Git content provider
    const gitContentProvider = new GitContentProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(GitContentProvider.scheme, gitContentProvider)
    );

    // ============================================
    // COMMANDS
    // ============================================

    // New Project
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.newProject', async () => {
            const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            if (!currentRoot) {
                vscode.window.showErrorMessage("Please open a folder/workspace first.");
                return;
            }

            const folders = ['Manuscript', 'Characters', 'Locations', 'Research', 'Timeline', 'Notes'];
            const userGuidePath = path.join(currentRoot, 'USER_GUIDE.md');

            try {
                for (const folder of folders) {
                    const folderPath = path.join(currentRoot, folder);
                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath);
                    }
                }

                // Create User Guide
                const userGuideContent = getUserGuideContent();
                fs.writeFileSync(userGuidePath, userGuideContent);

                // Initialize Git silently
                await gitService.init();

                // Refresh views
                novelProvider.refresh();
                characterPanel.refresh();
                outlinePanel.refresh();

                // Open User Guide
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(userGuidePath));
                await vscode.window.showTextDocument(doc);

                vscode.window.showInformationMessage('Novel project created successfully!');
            } catch {
                // Silent fail - project may already exist
            }
        })
    );

    // Refresh
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.refreshEntry', () => {
            novelProvider.refresh();
            characterPanel.refresh();
            outlinePanel.refresh();
        })
    );

    // Show Stats (detailed)
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.showStats', () => {
            progressDashboard.show();
        })
    );

    // Compare with HEAD
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.compareHead', async (item: vscode.TreeItem) => {
            if (!item?.resourceUri) { return; }

            try {
                const docUri = item.resourceUri;
                const headUri = vscode.Uri.file(docUri.fsPath).with({
                    scheme: GitContentProvider.scheme,
                    query: JSON.stringify({ ref: 'HEAD' })
                });

                const title = `${path.basename(docUri.fsPath)} (Saved) ↔ (Current)`;
                await vscode.commands.executeCommand('vscode.diff', headUri, docUri, title);
            } catch {
                // Silent fail
            }
        })
    );

    // View History
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.viewHistory', async (item: vscode.TreeItem) => {
            if (!item?.resourceUri) { return; }

            try {
                await vscode.commands.executeCommand('vscode.open', item.resourceUri);
                await vscode.commands.executeCommand('timeline.focus');
            } catch {
                // Silent fail
            }
        })
    );

    // Writing Sprint Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.startSprint', () => {
            sprintTimer.promptAndStart();
        }),
        vscode.commands.registerCommand('novel-assistant.stopSprint', () => {
            sprintTimer.stopSprint(false);
        }),
        vscode.commands.registerCommand('novel-assistant.toggleSprint', () => {
            sprintTimer.toggle();
        })
    );

    // Export Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.export', () => {
            exportService.promptExport();
        })
    );

    // Backup Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.backup', async () => {
            await autoBackupService.manualBackup();
        })
    );

    // Analysis Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.analyzeWriting', () => {
            analysisService.showAnalysisReport();
        })
    );

    // Search Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.searchProject', () => {
            searchService.showSearchPanel();
        }),
        vscode.commands.registerCommand('novel-assistant.searchAndReplace', () => {
            searchService.showSearchAndReplace();
        })
    );

    // New Chapter Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.newChapter', async () => {
            if (!rootPath) { return; }

            const name = await vscode.window.showInputBox({
                prompt: 'Enter chapter name',
                placeHolder: 'e.g., Chapter 1 - The Beginning',
            });

            if (!name) { return; }

            try {
                const manuscriptPath = path.join(rootPath, 'Manuscript');
                if (!fs.existsSync(manuscriptPath)) {
                    fs.mkdirSync(manuscriptPath, { recursive: true });
                }

                const chapterPath = path.join(manuscriptPath, name);
                if (!fs.existsSync(chapterPath)) {
                    fs.mkdirSync(chapterPath);
                }

                novelProvider.refresh();
                outlinePanel.refresh();
                vscode.window.showInformationMessage(`Created chapter: ${name}`);
            } catch {
                // Silent fail
            }
        })
    );

    // New Scene Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.newScene', async () => {
            if (!rootPath) { return; }

            const manuscriptPath = path.join(rootPath, 'Manuscript');

            try {
                if (!fs.existsSync(manuscriptPath)) {
                    fs.mkdirSync(manuscriptPath, { recursive: true });
                }

                const chapters = fs.readdirSync(manuscriptPath)
                    .filter(f => {
                        try {
                            return fs.statSync(path.join(manuscriptPath, f)).isDirectory();
                        } catch {
                            return false;
                        }
                    });

                if (chapters.length === 0) {
                    vscode.window.showWarningMessage('Please create a chapter first.');
                    return;
                }

                const selected = await vscode.window.showQuickPick(chapters, {
                    placeHolder: 'Select chapter for new scene',
                });

                if (!selected) { return; }

                const sceneName = await vscode.window.showInputBox({
                    prompt: 'Enter scene name',
                    placeHolder: 'e.g., Scene 1 - Opening',
                });

                if (!sceneName) { return; }

                const filePath = path.join(manuscriptPath, selected, `${sceneName}.md`);
                const template = getSceneTemplate(sceneName);
                fs.writeFileSync(filePath, template);

                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);

                novelProvider.refresh();
                outlinePanel.refresh();
            } catch {
                // Silent fail
            }
        })
    );

    // New Character Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.newCharacter', async () => {
            if (!rootPath) { return; }

            const name = await vscode.window.showInputBox({
                prompt: 'Enter character name',
                placeHolder: 'e.g., John Smith',
            });

            if (!name) { return; }

            try {
                const charactersPath = path.join(rootPath, 'Characters');
                if (!fs.existsSync(charactersPath)) {
                    fs.mkdirSync(charactersPath, { recursive: true });
                }

                const filePath = path.join(charactersPath, `${name}.md`);
                const template = getCharacterTemplate(name);
                fs.writeFileSync(filePath, template);

                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);

                characterPanel.refresh();
            } catch {
                // Silent fail
            }
        })
    );

    // Toggle Editor Settings Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.toggleTypewriterMode', () => {
            const config = vscode.workspace.getConfiguration('novel-assistant');
            const current = config.get<boolean>('editor.typewriterMode', false);
            config.update('editor.typewriterMode', !current, vscode.ConfigurationTarget.Global);
        }),
        vscode.commands.registerCommand('novel-assistant.toggleFocusMode', () => {
            const config = vscode.workspace.getConfiguration('novel-assistant');
            const current = config.get<boolean>('editor.focusMode', false);
            config.update('editor.focusMode', !current, vscode.ConfigurationTarget.Global);
        }),
        vscode.commands.registerCommand('novel-assistant.setTheme', async () => {
            const themes = [
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'Sepia', value: 'sepia' },
                { label: 'High Contrast', value: 'highContrast' },
                { label: 'Auto (follow VS Code)', value: 'auto' },
            ];

            const selected = await vscode.window.showQuickPick(themes, {
                placeHolder: 'Select editor theme',
            });

            if (selected) {
                const config = vscode.workspace.getConfiguration('novel-assistant');
                config.update('editor.theme', selected.value, vscode.ConfigurationTarget.Global);
            }
        })
    );

    // Welcome/Onboarding Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.showWelcome', () => {
            welcomeView.show();
        })
    );

    // Show welcome view on first run
    welcomeView.showIfFirstRun();

    // Set Goals Command
    context.subscriptions.push(
        vscode.commands.registerCommand('novel-assistant.setGoals', async () => {
            const goals = statsService.getGoals();

            const dailyGoal = await vscode.window.showInputBox({
                prompt: 'Daily word goal',
                value: goals.dailyWordGoal.toString(),
                validateInput: (v) => isNaN(parseInt(v)) ? 'Enter a number' : null,
            });

            if (dailyGoal) {
                const projectGoal = await vscode.window.showInputBox({
                    prompt: 'Project word goal',
                    value: goals.projectWordGoal.toString(),
                    validateInput: (v) => isNaN(parseInt(v)) ? 'Enter a number' : null,
                });

                if (projectGoal) {
                    statsService.setGoals({
                        dailyWordGoal: parseInt(dailyGoal),
                        projectWordGoal: parseInt(projectGoal),
                    });
                    vscode.window.showInformationMessage('Goals updated!');
                }
            }
        })
    );

    // ============================================
    // EVENT HANDLERS
    // ============================================

    // Word counter updates
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => wordCounter.update()),
        vscode.workspace.onDidChangeTextDocument(() => wordCounter.update())
    );

    // Initial word counter update
    wordCounter.update();

    // Track writing stats on document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.languageId === 'markdown') {
                statsService.recordWords(wordCounter.getCurrentDocumentWordCount());
            }
        })
    );

    // File watcher for tree view refresh
    if (rootPath) {
        const manuscriptPath = path.join(rootPath, 'Manuscript');
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(manuscriptPath, '**/*')
        );

        watcher.onDidCreate(() => {
            novelProvider.refresh();
            outlinePanel.refresh();
        });
        watcher.onDidDelete(() => {
            novelProvider.refresh();
            outlinePanel.refresh();
        });
        watcher.onDidChange(() => {
            novelProvider.refresh();
        });

        context.subscriptions.push(watcher);
    }

    // ============================================
    // CLEANUP
    // ============================================

    context.subscriptions.push({
        dispose: () => {
            statsService.endSession(wordCounter.getCurrentDocumentWordCount());
            wordCounter.dispose();
            sprintTimer.dispose();
            autoBackupService.dispose();
            gitService.dispose();
            statsService.dispose();
            analysisService.dispose();
            searchService.dispose();
            exportService.dispose();
            progressDashboard.dispose();
            characterPanel.dispose();
            outlinePanel.dispose();
        }
    });
}

export function deactivate() { }

// ============================================
// TEMPLATES
// ============================================

function getUserGuideContent(): string {
    return `# Welcome to Novel Assistant!

This guide will help you get started with writing your masterpiece.

## Project Structure

Your project is organized to keep your writing flow uninterrupted:

- **Manuscript**: This is where your story lives.
  - Create folders for **Chapters**.
  - Create \`.md\` files inside them for **Scenes**.
- **Characters**: Keep your character sheets and profiles here.
- **Locations**: Detailed descriptions of your settings.
- **Timeline**: Track your plot points and chronology.
- **Research**: Store reference materials and links.
- **Notes**: Brainstorming and rough ideas.

## Writing Features

### Editor Modes
- **Typewriter Mode**: Keeps cursor centered as you type
- **Focus Mode**: Dims non-active paragraphs
- **Themes**: Light, Dark, Sepia, and High Contrast

### Writing Sprints
Use \`Ctrl+Shift+P\` → "Start Writing Sprint" for focused writing sessions.

### Progress Tracking
- Daily word goals
- Writing streaks
- Project progress

## Keyboard Shortcuts

- **Ctrl+S / Cmd+S**: Save
- **Ctrl+B / Cmd+B**: Bold
- **Ctrl+I / Cmd+I**: Italic

## Commands (Ctrl+Shift+P)

- \`Novel Assistant: New Chapter\` - Create a new chapter
- \`Novel Assistant: New Scene\` - Create a new scene
- \`Novel Assistant: Export\` - Export to PDF, DOCX, EPUB
- \`Novel Assistant: Analyze Writing\` - Check writing style
- \`Novel Assistant: Start Sprint\` - Begin a writing sprint
- \`Novel Assistant: Show Stats\` - View progress dashboard

Happy Writing!
`;
}

function getSceneTemplate(name: string): string {
    return `# ${name}

## Synopsis
[Brief scene summary]

---

[Start writing your scene here...]
`;
}

function getCharacterTemplate(name: string): string {
    return `# ${name}

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
}
