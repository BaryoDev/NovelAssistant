import * as vscode from 'vscode';
import { OnboardingService, QuickStartSuggestion } from '../services/OnboardingService';
import { DesignSystem } from '../styles/DesignSystem';

export class WelcomeViewProvider {
    public static readonly viewType = 'novel-assistant.welcomeView';
    private panel?: vscode.WebviewPanel;
    private onboardingService: OnboardingService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.onboardingService = new OnboardingService(context);
    }

    /**
     * Show the welcome panel
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            WelcomeViewProvider.viewType,
            'Welcome to Novel Assistant',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri],
            }
        );

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'runCommand':
                    if (message.args) {
                        await vscode.commands.executeCommand(message.commandId, ...message.args);
                    } else {
                        await vscode.commands.executeCommand(message.commandId);
                    }
                    break;
                case 'markComplete':
                    await this.onboardingService.markOnboardingComplete();
                    break;
                case 'openDocs':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/novel-assistant#readme'));
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /**
     * Show if first run
     */
    public async showIfFirstRun(): Promise<void> {
        if (this.onboardingService.isFirstRun()) {
            this.show();
        }
    }

    private getHtml(): string {
        const suggestions = this.onboardingService.getQuickStartSuggestions();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Novel Assistant</title>
    <style>
        ${DesignSystem.getCompleteStylesheet()}

        body {
            padding: 0;
            margin: 0;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
        }

        .welcome-container {
            max-width: 800px;
            margin: 0 auto;
            padding: var(--space-2xl);
            animation: fadeIn var(--duration-slow) var(--easing-standard);
        }

        .hero {
            text-align: center;
            margin-bottom: var(--space-2xl);
            padding-bottom: var(--space-xl);
            border-bottom: 1px solid var(--border-primary);
        }

        .hero-icon {
            font-size: 64px;
            margin-bottom: var(--space-lg);
            animation: scaleIn var(--duration-slow) var(--easing-decelerate);
        }

        .hero h1 {
            font-size: 28px;
            font-weight: 600;
            margin: 0 0 var(--space-md);
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .hero p {
            font-size: 16px;
            color: var(--text-secondary);
            margin: 0;
            line-height: 1.6;
        }

        .section {
            margin-bottom: var(--space-2xl);
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            margin-bottom: var(--space-lg);
        }

        .quick-start-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: var(--space-md);
        }

        .quick-start-card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            padding: var(--space-lg);
            cursor: pointer;
            transition: all var(--duration-normal) var(--easing-standard);
            border: 1px solid transparent;
            animation: slideUp var(--duration-normal) var(--easing-decelerate);
            animation-fill-mode: both;
        }

        .quick-start-card:nth-child(1) { animation-delay: 0.1s; }
        .quick-start-card:nth-child(2) { animation-delay: 0.2s; }
        .quick-start-card:nth-child(3) { animation-delay: 0.3s; }

        .quick-start-card:hover {
            background: var(--bg-hover);
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
            border-color: var(--color-primary);
        }

        .quick-start-card:active {
            transform: translateY(0);
        }

        .card-icon {
            font-size: 28px;
            margin-bottom: var(--space-md);
        }

        .card-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: var(--space-xs);
        }

        .card-description {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: var(--space-lg);
        }

        .feature {
            display: flex;
            align-items: flex-start;
            gap: var(--space-md);
        }

        .feature-icon {
            font-size: 20px;
            flex-shrink: 0;
        }

        .feature-text {
            font-size: 13px;
            line-height: 1.5;
        }

        .feature-text strong {
            display: block;
            margin-bottom: 2px;
        }

        .feature-text span {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .tips {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            padding: var(--space-lg);
        }

        .tips h3 {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 var(--space-md);
            display: flex;
            align-items: center;
            gap: var(--space-sm);
        }

        .tips ul {
            margin: 0;
            padding-left: var(--space-lg);
            color: var(--text-secondary);
            font-size: 13px;
            line-height: 1.8;
        }

        .footer {
            text-align: center;
            margin-top: var(--space-2xl);
            padding-top: var(--space-xl);
            border-top: 1px solid var(--border-primary);
        }

        .footer-links {
            display: flex;
            justify-content: center;
            gap: var(--space-xl);
            margin-bottom: var(--space-lg);
        }

        .footer-link {
            color: var(--color-primary);
            font-size: 13px;
            cursor: pointer;
            transition: opacity var(--duration-fast);
        }

        .footer-link:hover {
            opacity: 0.8;
        }

        .dismiss-btn {
            background: var(--gradient-primary);
            color: white;
            border: none;
            padding: var(--space-sm) var(--space-xl);
            border-radius: var(--radius-md);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all var(--duration-fast) var(--easing-standard);
        }

        .dismiss-btn:hover {
            transform: scale(1.02);
            box-shadow: var(--shadow-md);
        }

        .dismiss-btn:active {
            transform: scale(0.98);
        }

        .keyboard-shortcuts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--space-sm);
        }

        .shortcut {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-sm) var(--space-md);
            background: var(--bg-secondary);
            border-radius: var(--radius-sm);
            font-size: 12px;
        }

        .shortcut kbd {
            background: var(--bg-hover);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="welcome-container">
        <div class="hero">
            <div class="hero-icon">📖</div>
            <h1>Welcome to Novel Assistant</h1>
            <p>Your distraction-free writing environment for crafting novels, stories, and long-form content.</p>
        </div>

        <div class="section">
            <div class="section-title">Quick Start</div>
            <div class="quick-start-grid">
                ${this.renderQuickStartCards(suggestions)}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Key Features</div>
            <div class="features">
                <div class="feature">
                    <span class="feature-icon">✍️</span>
                    <div class="feature-text">
                        <strong>WYSIWYG Editor</strong>
                        <span>Write in a beautiful distraction-free markdown editor</span>
                    </div>
                </div>
                <div class="feature">
                    <span class="feature-icon">📊</span>
                    <div class="feature-text">
                        <strong>Progress Tracking</strong>
                        <span>Set daily goals and track your word counts</span>
                    </div>
                </div>
                <div class="feature">
                    <span class="feature-icon">👤</span>
                    <div class="feature-text">
                        <strong>Character Management</strong>
                        <span>Keep track of your cast with character profiles</span>
                    </div>
                </div>
                <div class="feature">
                    <span class="feature-icon">🗂️</span>
                    <div class="feature-text">
                        <strong>Manuscript Organization</strong>
                        <span>Organize chapters with drag-and-drop</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Keyboard Shortcuts</div>
            <div class="keyboard-shortcuts">
                <div class="shortcut">
                    <span>Bold</span>
                    <kbd>⌘ B</kbd>
                </div>
                <div class="shortcut">
                    <span>Italic</span>
                    <kbd>⌘ I</kbd>
                </div>
                <div class="shortcut">
                    <span>Quote</span>
                    <kbd>⌘ '</kbd>
                </div>
                <div class="shortcut">
                    <span>Bullet List</span>
                    <kbd>⌘ L</kbd>
                </div>
                <div class="shortcut">
                    <span>Numbered List</span>
                    <kbd>⌘ ⇧ L</kbd>
                </div>
                <div class="shortcut">
                    <span>Insert Link</span>
                    <kbd>⌘ K</kbd>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="tips">
                <h3>💡 Tips for Getting Started</h3>
                <ul>
                    <li>Create a "Manuscript" folder in your project to organize chapters</li>
                    <li>Use the sidebar panels to manage characters and track progress</li>
                    <li>Enable <strong>Typewriter Mode</strong> in settings for focused writing</li>
                    <li>Right-click on files to access export and compare options</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <div class="footer-links">
                <span class="footer-link" onclick="openDocs()">📚 Documentation</span>
                <span class="footer-link" onclick="runCommand('workbench.action.openSettings', ['novel-assistant'])">⚙️ Settings</span>
                <span class="footer-link" onclick="runCommand('novel-assistant.showKeyboardShortcuts')">⌨️ All Shortcuts</span>
            </div>
            <button class="dismiss-btn" onclick="getStarted()">Get Started</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function runCommand(commandId, args) {
            vscode.postMessage({ command: 'runCommand', commandId, args });
        }

        function openDocs() {
            vscode.postMessage({ command: 'openDocs' });
        }

        function getStarted() {
            vscode.postMessage({ command: 'markComplete' });
            // Close the tab
            runCommand('workbench.action.closeActiveEditor');
        }
    </script>
</body>
</html>`;
    }

    private renderQuickStartCards(suggestions: QuickStartSuggestion[]): string {
        return suggestions.map(s => `
            <div class="quick-start-card"
                 onclick="runCommand('${s.command}'${s.args ? `, ${JSON.stringify(s.args)}` : ''})"
                 role="button"
                 tabindex="0"
                 aria-label="${s.title}">
                <div class="card-icon">${s.icon}</div>
                <div class="card-title">${s.title}</div>
                <div class="card-description">${s.description}</div>
            </div>
        `).join('');
    }
}
