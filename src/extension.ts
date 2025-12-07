import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { NovelTreeDataProvider } from './views/NovelTreeDataProvider';
import { NovelEditorProvider } from './editor/NovelEditorProvider';
import { WordCounter } from './stats/WordCounter';
import { GitContentProvider } from './services/GitContentProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "novel-assistant" is now active!');

    const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
        ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

    const novelProvider = new NovelTreeDataProvider(rootPath);
    vscode.window.registerTreeDataProvider('novel-structure', novelProvider);

    // Command: New Project
    let dispNewProject = vscode.commands.registerCommand('novel-assistant.newProject', async () => {
        console.log('Novel Assistant: New Project command triggered');

        // Fetch rootPath dynamically in case it changed or wasn't set at activation
        const currentRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
            ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

        if (!currentRoot) {
            vscode.window.showErrorMessage("Novel Assistant: Please open a folder/workspace first.");
            return;
        }

        const manuscriptPath = path.join(currentRoot, 'Manuscript');
        const charactersPath = path.join(currentRoot, 'Characters');
        const locationsPath = path.join(currentRoot, 'Locations');
        const researchPath = path.join(currentRoot, 'Research');
        const timelinePath = path.join(currentRoot, 'Timeline');
        const notesPath = path.join(currentRoot, 'Notes');
        const userGuidePath = path.join(currentRoot, 'USER_GUIDE.md');

        try {
            if (!fs.existsSync(manuscriptPath)) { fs.mkdirSync(manuscriptPath); }
            if (!fs.existsSync(charactersPath)) { fs.mkdirSync(charactersPath); }
            if (!fs.existsSync(locationsPath)) { fs.mkdirSync(locationsPath); }
            if (!fs.existsSync(researchPath)) { fs.mkdirSync(researchPath); }
            if (!fs.existsSync(timelinePath)) { fs.mkdirSync(timelinePath); }
            if (!fs.existsSync(notesPath)) { fs.mkdirSync(notesPath); }

            // Create User Guide
            const userGuideContent = `# Welcome to Novel Assistant! 🖋️

This guide will help you get started with writing your masterpiece.

## 📂 Project Structure

Your project is organized to keep your writing flow uninterrupted:

- **Manuscript**: This is where your story lives.
  - Create folders for **Chapters**.
  - Create \`.md\` files inside them for **Scenes**.
- **Characters**: Keep your character sheets and profiles here.
- **Locations**: detailed descriptions of your settings.
- **Timeline**: Track your plot points and chronology.
- **Research**: Store reference materials and links.
- **Notes**: Brainstorming and rough ideas.

## 📝 Writing

Double-click any \`.md\` file in the **Novel Structure** sidebar to open the **Writer's Editor**.
- **Distraction-Free**: Clean interface focused on text.
- **Auto-Save**: Changes are saved to disk automatically.
- **Word Count**: Track your progress in real-time.

## 🔢 Structure View

Use the SIDEBAR view titled "Novel Assistant" to navigate your manuscript.
- Typically, you should organize by **Chapter > Scene**.
- You can drag and drop to reorder (if supported by your file system).

## 🚀 Shortcuts

- **Ctrl+S / Cmd+S**: Save manually (though we auto-sync).
- **Compare with Saved**: Right-click a file in the list to see what changed since your last commit.

Happy Writing!
`;
            fs.writeFileSync(userGuidePath, userGuideContent);

            // Auto-initialize Git
            cp.exec('git init', { cwd: currentRoot }, (err, stdout, stderr) => {
                if (err) {
                    console.error('Failed to initialize git:', stderr);
                    vscode.window.showWarningMessage('Project folders created, but failed to initialize Git.');
                } else {
                    console.log('Git initialized:', stdout);
                }
            });

            // Force refresh of the tree view
            novelProvider.refresh();

            // Open the User Guide
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(userGuidePath));
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage('Novel project structure created and Git initialized!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error creating project: ${error}`);
            console.error(error);
        }
    });

    // Command: Refresh
    let dispRefresh = vscode.commands.registerCommand('novel-assistant.refreshEntry', () => novelProvider.refresh());

    context.subscriptions.push(dispNewProject);
    context.subscriptions.push(dispRefresh);
    context.subscriptions.push(NovelEditorProvider.register(context));

    // Git Provider
    const gitProvider = new GitContentProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(GitContentProvider.scheme, gitProvider));

    // Command: Compare with Saved (HEAD)
    let dispCompare = vscode.commands.registerCommand('novel-assistant.compareHead', async (item: vscode.TreeItem) => {
        if (!item.resourceUri) { return; }

        const docUri = item.resourceUri;
        const headUri = vscode.Uri.file(docUri.fsPath).with({
            scheme: GitContentProvider.scheme,
            query: JSON.stringify({ ref: 'HEAD' })
        });

        const title = `${path.basename(docUri.fsPath)} (Saved) ↔ (Current)`;

        await vscode.commands.executeCommand('vscode.diff', headUri, docUri, title);
    });
    context.subscriptions.push(dispCompare);

    // Command: View History (Timeline)
    let dispHistory = vscode.commands.registerCommand('novel-assistant.viewHistory', async (item: vscode.TreeItem) => {
        if (!item.resourceUri) { return; }
        // Focus the files sidebar and select it? 
        // Actually, vscode has a command to open timeline. 
        // 'files.openTimeline' might not be public API. 
        // Alternative: standard 'git.viewFileHistory' if available, otherwise just open file and user sees timeline.
        await vscode.commands.executeCommand('vscode.open', item.resourceUri);
        await vscode.commands.executeCommand('timeline.focus');
    });
    context.subscriptions.push(dispHistory);

    // Stats
    const wordCounter = new WordCounter();
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => wordCounter.update()));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => wordCounter.update()));

    // Initial update
    wordCounter.update();

    context.subscriptions.push({ dispose: () => wordCounter.dispose() });
}

export function deactivate() { }
