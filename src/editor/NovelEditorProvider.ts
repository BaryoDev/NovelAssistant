import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class NovelEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'novel-assistant.wysiwyg';
    private debounceTimer: NodeJS.Timeout | null = null;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new NovelEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(NovelEditorProvider.viewType, provider);
        return providerRegistration;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
            ],
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        const updateWebview = () => {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        };

        const updateSettings = () => {
            const config = vscode.workspace.getConfiguration('novel-assistant');
            webviewPanel.webview.postMessage({
                type: 'settings',
                settings: {
                    theme: config.get<string>('editor.theme', 'light'),
                    fontSize: config.get<number>('editor.fontSize', 18),
                    fontFamily: config.get<string>('editor.fontFamily', 'Merriweather'),
                    lineHeight: config.get<number>('editor.lineHeight', 1.8),
                    typewriterMode: config.get<boolean>('editor.typewriterMode', false),
                    focusMode: config.get<boolean>('editor.focusMode', false),
                    showToolbar: config.get<boolean>('editor.showToolbar', true),
                    maxWidth: config.get<number>('editor.maxWidth', 720),
                },
            });
        };

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('novel-assistant')) {
                updateSettings();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            configChangeSubscription.dispose();
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'change':
                    // Debounce updates to improve performance
                    if (this.debounceTimer) {
                        clearTimeout(this.debounceTimer);
                    }
                    this.debounceTimer = setTimeout(() => {
                        this.updateTextDocument(document, e.text);
                    }, 100);
                    return;
                case 'ready':
                    updateSettings();
                    updateWebview();
                    return;
            }
        });

        updateWebview();
        updateSettings();
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for local resources
        const vendorCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'vendor', 'css', 'easymde.min.css')
        );
        const vendorJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'vendor', 'js', 'easymde.min.js')
        );

        // Check if local files exist, otherwise use CDN
        const vendorPath = path.join(this.context.extensionPath, 'resources', 'vendor', 'js', 'easymde.min.js');
        const useLocalAssets = fs.existsSync(vendorPath);

        const cssLink = useLocalAssets
            ? `<link rel="stylesheet" href="${vendorCssUri}">`
            : `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">`;

        const jsScript = useLocalAssets
            ? `<script src="${vendorJsUri}"></script>`
            : `<script src="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js"></script>`;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src https://fonts.gstatic.com https://use.fontawesome.com ${webview.cspSource}; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://use.fontawesome.com https://fonts.googleapis.com ${webview.cspSource}; script-src 'unsafe-inline' https://cdn.jsdelivr.net ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Novel Editor</title>
                ${cssLink}
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Roboto:wght@400;500&family=Lora:ital,wght@0,400;0,700;1,400&family=Source+Serif+Pro:ital,wght@0,400;0,700;1,400&family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap');

                    :root {
                        --bg-color: #fcfbf9;
                        --text-color: #2c2925;
                        --toolbar-color: #888;
                        --toolbar-hover: #000;
                        --selection-color: rgba(0,0,0,0.05);
                        --scrollbar-color: rgba(0,0,0,0.1);
                        --border-color: rgba(0,0,0,0.05);
                        --font-family: 'Merriweather', serif;
                        --font-size: 18px;
                        --line-height: 1.8;
                        --max-width: 720px;
                    }

                    /* Theme: Sepia */
                    body.theme-sepia {
                        --bg-color: #f4ecd8;
                        --text-color: #5b4636;
                        --toolbar-color: #8b7355;
                        --toolbar-hover: #3d2914;
                        --selection-color: rgba(91, 70, 54, 0.1);
                    }

                    /* Theme: Dark */
                    body.theme-dark, body.vscode-dark {
                        --bg-color: #1e1e1e;
                        --text-color: #d4d4d4;
                        --toolbar-color: #666;
                        --toolbar-hover: #fff;
                        --selection-color: rgba(255,255,255,0.1);
                        --scrollbar-color: rgba(255,255,255,0.1);
                        --border-color: rgba(255,255,255,0.05);
                    }

                    /* Theme: High Contrast */
                    body.theme-highContrast {
                        --bg-color: #000000;
                        --text-color: #ffffff;
                        --toolbar-color: #00ff00;
                        --toolbar-hover: #ffff00;
                        --selection-color: rgba(255,255,0,0.3);
                        --scrollbar-color: rgba(0,255,0,0.3);
                        --border-color: rgba(0,255,0,0.3);
                    }

                    body {
                        padding: 0;
                        margin: 0;
                        background-color: var(--bg-color);
                        font-family: var(--font-family);
                        color: var(--text-color);
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                        transition: background-color 0.3s, color 0.3s;
                    }

                    /* Scrollbar Styling */
                    ::-webkit-scrollbar {
                        width: 8px;
                        background-color: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background-color: var(--scrollbar-color);
                        border-radius: 4px;
                    }

                    /* Toolbar Container */
                    .editor-toolbar {
                        border: none !important;
                        background-color: transparent !important;
                        border-bottom: 1px solid var(--border-color) !important;
                        padding: 10px 20px !important;
                        text-align: center;
                        flex-shrink: 0;
                        opacity: 0.7;
                        transition: opacity 0.3s, transform 0.3s;
                    }
                    .editor-toolbar:hover {
                        opacity: 1;
                    }

                    body.toolbar-hidden .editor-toolbar {
                        transform: translateY(-100%);
                        position: absolute;
                        width: 100%;
                        z-index: 100;
                        background-color: var(--bg-color) !important;
                    }
                    body.toolbar-hidden .editor-toolbar:hover {
                        transform: translateY(0);
                    }

                    /* Buttons */
                    .editor-toolbar button {
                        border: none !important;
                        background: transparent !important;
                        color: var(--toolbar-color) !important;
                        margin: 0 4px !important;
                        transition: color 0.2s;
                        font-family: 'Roboto', sans-serif;
                    }

                    .editor-toolbar button:hover {
                        background-color: transparent !important;
                        color: var(--toolbar-hover) !important;
                    }

                    .editor-toolbar button.active {
                        background-color: transparent !important;
                        color: #d93025 !important;
                    }

                    .editor-toolbar i.separator {
                        border-left-color: var(--border-color) !important;
                    }

                    /* Editor Content Area */
                    .EasyMDEContainer {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }

                    .CodeMirror {
                        flex-grow: 1;
                        border: none !important;
                        background-color: transparent !important;
                        font-family: var(--font-family) !important;
                        font-size: var(--font-size) !important;
                        line-height: var(--line-height) !important;
                        color: var(--text-color) !important;
                        max-width: var(--max-width);
                        margin: 0 auto;
                        padding: 40px 20px !important;
                        width: 100%;
                        box-sizing: border-box;
                    }

                    .CodeMirror-scroll {
                        overflow-y: auto !important;
                    }

                    /* Hide status bar */
                    .editor-statusbar {
                        display: none !important;
                    }

                    /* Headings */
                    .cm-header {
                        font-family: 'Roboto', sans-serif;
                        color: var(--text-color);
                        font-weight: 500;
                        opacity: 0.9;
                    }
                    .cm-header-1 { font-size: 2.2em; line-height: 1.2; margin-bottom: 0.5em; }
                    .cm-header-2 { font-size: 1.8em; margin-bottom: 0.5em; }
                    .cm-header-3 { font-size: 1.4em; }

                    /* Quote */
                    .cm-quote {
                        font-style: italic;
                        opacity: 0.8;
                        font-family: var(--font-family);
                    }

                    /* Selection */
                    .CodeMirror-selected {
                        background: var(--selection-color) !important;
                    }

                    /* Cursor */
                    .CodeMirror-cursor {
                        border-left-color: var(--text-color) !important;
                    }

                    /* Typewriter Mode */
                    body.typewriter-mode .CodeMirror-scroll {
                        padding-top: 45vh !important;
                        padding-bottom: 45vh !important;
                    }

                    body.typewriter-mode .CodeMirror-cursor {
                        border-left-width: 2px !important;
                    }

                    /* Focus Mode - dim non-current paragraphs */
                    body.focus-mode .CodeMirror-line:not(.CodeMirror-activeline) {
                        opacity: 0.3;
                        transition: opacity 0.3s;
                    }
                    body.focus-mode .CodeMirror-activeline {
                        opacity: 1;
                    }

                    /* Placeholder */
                    .CodeMirror-placeholder {
                        color: var(--toolbar-color) !important;
                        font-style: italic;
                    }

                    /* Preview mode */
                    .editor-preview {
                        background-color: var(--bg-color) !important;
                        color: var(--text-color) !important;
                        font-family: var(--font-family) !important;
                        max-width: var(--max-width);
                        margin: 0 auto;
                        padding: 40px 20px !important;
                    }

                    /* Toast Notification System */
                    .toast-container {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        z-index: 1000;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        pointer-events: none;
                    }

                    .toast {
                        background: var(--text-color);
                        color: var(--bg-color);
                        padding: 10px 16px;
                        border-radius: 6px;
                        font-size: 13px;
                        font-family: 'Roboto', sans-serif;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        opacity: 0;
                        transform: translateY(10px) scale(0.95);
                        animation: toastIn 0.3s ease forwards;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .toast.toast-out {
                        animation: toastOut 0.2s ease forwards;
                    }

                    .toast-icon {
                        font-size: 14px;
                    }

                    @keyframes toastIn {
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }

                    @keyframes toastOut {
                        to {
                            opacity: 0;
                            transform: translateY(-10px) scale(0.95);
                        }
                    }

                    /* Mode Indicators */
                    .mode-indicators {
                        position: fixed;
                        top: 12px;
                        right: 12px;
                        display: flex;
                        gap: 6px;
                        z-index: 50;
                        opacity: 0;
                        transform: translateY(-10px);
                        transition: opacity 0.3s, transform 0.3s;
                    }

                    .mode-indicators.visible {
                        opacity: 1;
                        transform: translateY(0);
                    }

                    .mode-badge {
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 10px;
                        font-family: 'Roboto', sans-serif;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        background: var(--selection-color);
                        color: var(--toolbar-hover);
                        backdrop-filter: blur(4px);
                        display: none;
                    }

                    .mode-badge.active {
                        display: block;
                    }

                    .mode-badge.typewriter {
                        background: rgba(86, 156, 214, 0.2);
                        color: #569cd6;
                    }

                    .mode-badge.focus {
                        background: rgba(78, 201, 176, 0.2);
                        color: #4ec9b0;
                    }

                    body.theme-dark .mode-badge.typewriter,
                    body.vscode-dark .mode-badge.typewriter {
                        background: rgba(86, 156, 214, 0.3);
                    }

                    body.theme-dark .mode-badge.focus,
                    body.vscode-dark .mode-badge.focus {
                        background: rgba(78, 201, 176, 0.3);
                    }
                </style>
            </head>
            <body>
                <!-- Mode Indicators -->
                <div class="mode-indicators" id="modeIndicators">
                    <span class="mode-badge typewriter" id="typewriterBadge">Typewriter</span>
                    <span class="mode-badge focus" id="focusBadge">Focus</span>
                </div>

                <!-- Toast Container -->
                <div class="toast-container" id="toastContainer"></div>

                <textarea id="editor"></textarea>
                ${jsScript}
                <script>
                    const vscode = acquireVsCodeApi();
                    let easyMDE = null;
                    let isUpdating = false;

                    function initEditor() {
                        easyMDE = new EasyMDE({
                            element: document.getElementById('editor'),
                            spellChecker: false,
                            status: false,
                            autosave: { enabled: false },
                            toolbar: [
                                {
                                    name: "bold",
                                    action: EasyMDE.toggleBold,
                                    className: "fa fa-bold",
                                    title: "Bold (Cmd-B)",
                                    attributes: { "aria-label": "Toggle bold formatting" }
                                },
                                {
                                    name: "italic",
                                    action: EasyMDE.toggleItalic,
                                    className: "fa fa-italic",
                                    title: "Italic (Cmd-I)",
                                    attributes: { "aria-label": "Toggle italic formatting" }
                                },
                                {
                                    name: "strikethrough",
                                    action: EasyMDE.toggleStrikethrough,
                                    className: "fa fa-strikethrough",
                                    title: "Strikethrough",
                                    attributes: { "aria-label": "Toggle strikethrough" }
                                },
                                "|",
                                {
                                    name: "heading-1",
                                    action: EasyMDE.toggleHeading1,
                                    className: "fa fa-header fa-header-x fa-header-1",
                                    title: "Heading 1",
                                    attributes: { "aria-label": "Insert heading level 1" }
                                },
                                {
                                    name: "heading-2",
                                    action: EasyMDE.toggleHeading2,
                                    className: "fa fa-header fa-header-x fa-header-2",
                                    title: "Heading 2",
                                    attributes: { "aria-label": "Insert heading level 2" }
                                },
                                {
                                    name: "heading-3",
                                    action: EasyMDE.toggleHeading3,
                                    className: "fa fa-header fa-header-x fa-header-3",
                                    title: "Heading 3",
                                    attributes: { "aria-label": "Insert heading level 3" }
                                },
                                "|",
                                {
                                    name: "quote",
                                    action: EasyMDE.toggleBlockquote,
                                    className: "fa fa-quote-left",
                                    title: "Quote (Cmd-')",
                                    attributes: { "aria-label": "Insert block quote" }
                                },
                                {
                                    name: "unordered-list",
                                    action: EasyMDE.toggleUnorderedList,
                                    className: "fa fa-list-ul",
                                    title: "Bullet List (Cmd-L)",
                                    attributes: { "aria-label": "Insert unordered list" }
                                },
                                {
                                    name: "ordered-list",
                                    action: EasyMDE.toggleOrderedList,
                                    className: "fa fa-list-ol",
                                    title: "Numbered List (Cmd-Shift-L)",
                                    attributes: { "aria-label": "Insert ordered list" }
                                },
                                "|",
                                {
                                    name: "link",
                                    action: EasyMDE.drawLink,
                                    className: "fa fa-link",
                                    title: "Link (Cmd-K)",
                                    attributes: { "aria-label": "Insert link" }
                                },
                                {
                                    name: "image",
                                    action: EasyMDE.drawImage,
                                    className: "fa fa-image",
                                    title: "Image",
                                    attributes: { "aria-label": "Insert image" }
                                },
                                "|",
                                {
                                    name: "preview",
                                    action: EasyMDE.togglePreview,
                                    className: "fa fa-eye",
                                    title: "Preview (Cmd-P)",
                                    attributes: { "aria-label": "Toggle preview mode" }
                                },
                                {
                                    name: "side-by-side",
                                    action: EasyMDE.toggleSideBySide,
                                    className: "fa fa-columns",
                                    title: "Side by Side",
                                    attributes: { "aria-label": "Toggle side by side view" }
                                },
                                {
                                    name: "fullscreen",
                                    action: EasyMDE.toggleFullScreen,
                                    className: "fa fa-arrows-alt",
                                    title: "Fullscreen (F11)",
                                    attributes: { "aria-label": "Toggle fullscreen mode" }
                                },
                                "|",
                                {
                                    name: "guide",
                                    action: "https://www.markdownguide.org/basic-syntax/",
                                    className: "fa fa-question-circle",
                                    title: "Markdown Guide",
                                    attributes: { "aria-label": "Open markdown guide" }
                                }
                            ],
                            placeholder: "Start your story...",
                            shortcuts: {
                                "toggleBold": "Cmd-B",
                                "toggleItalic": "Cmd-I",
                                "toggleHeadingSmaller": "Cmd-H",
                                "toggleBlockquote": "Cmd-'",
                                "toggleUnorderedList": "Cmd-L",
                                "toggleOrderedList": "Cmd-Shift-L",
                                "drawLink": "Cmd-K",
                                "togglePreview": "Cmd-P",
                            },
                        });

                        // Send text changes back to the extension with debouncing
                        let changeTimeout = null;
                        easyMDE.codemirror.on("change", () => {
                            if (isUpdating) return;

                            if (changeTimeout) clearTimeout(changeTimeout);
                            changeTimeout = setTimeout(() => {
                                vscode.postMessage({
                                    type: 'change',
                                    text: easyMDE.value()
                                });
                            }, 150);
                        });

                        // Typewriter mode scrolling
                        easyMDE.codemirror.on("cursorActivity", () => {
                            if (document.body.classList.contains('typewriter-mode')) {
                                const cursor = easyMDE.codemirror.getCursor();
                                const coords = easyMDE.codemirror.charCoords(cursor, "local");
                                const scrollInfo = easyMDE.codemirror.getScrollInfo();
                                const targetScroll = coords.top - scrollInfo.clientHeight / 2;
                                easyMDE.codemirror.scrollTo(null, targetScroll);
                            }
                        });

                        vscode.postMessage({ type: 'ready' });
                    }

                    // Handle messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                if (easyMDE && easyMDE.value() !== message.text) {
                                    isUpdating = true;
                                    const cursor = easyMDE.codemirror.getCursor();
                                    const scrollInfo = easyMDE.codemirror.getScrollInfo();
                                    easyMDE.value(message.text);
                                    easyMDE.codemirror.setCursor(cursor);
                                    easyMDE.codemirror.scrollTo(scrollInfo.left, scrollInfo.top);
                                    isUpdating = false;
                                }
                                break;
                            case 'settings':
                                applySettings(message.settings);
                                break;
                        }
                    });

                    // Track previous settings for detecting changes
                    let previousSettings = null;

                    function showToast(message, icon = '✓') {
                        const container = document.getElementById('toastContainer');
                        const toast = document.createElement('div');
                        toast.className = 'toast';
                        toast.innerHTML = '<span class="toast-icon">' + icon + '</span>' + message;
                        container.appendChild(toast);

                        // Auto-remove after delay
                        setTimeout(() => {
                            toast.classList.add('toast-out');
                            setTimeout(() => toast.remove(), 200);
                        }, 2000);
                    }

                    function updateModeIndicators(typewriter, focus) {
                        const container = document.getElementById('modeIndicators');
                        const typewriterBadge = document.getElementById('typewriterBadge');
                        const focusBadge = document.getElementById('focusBadge');

                        typewriterBadge.classList.toggle('active', typewriter);
                        focusBadge.classList.toggle('active', focus);

                        // Show container if any mode is active
                        container.classList.toggle('visible', typewriter || focus);
                    }

                    function applySettings(settings) {
                        const body = document.body;
                        const root = document.documentElement;

                        // Theme
                        body.classList.remove('theme-light', 'theme-dark', 'theme-sepia', 'theme-highContrast');
                        if (settings.theme && settings.theme !== 'auto') {
                            body.classList.add('theme-' + settings.theme);
                        }

                        // Font settings
                        root.style.setProperty('--font-family', "'" + settings.fontFamily + "', serif");
                        root.style.setProperty('--font-size', settings.fontSize + 'px');
                        root.style.setProperty('--line-height', settings.lineHeight);
                        root.style.setProperty('--max-width', settings.maxWidth + 'px');

                        // Typewriter mode with toast notification
                        const typewriterChanged = previousSettings && previousSettings.typewriterMode !== settings.typewriterMode;
                        body.classList.toggle('typewriter-mode', settings.typewriterMode);
                        if (typewriterChanged) {
                            showToast(settings.typewriterMode ? 'Typewriter mode enabled' : 'Typewriter mode disabled', settings.typewriterMode ? '⌨️' : '✓');
                        }

                        // Focus mode with toast notification
                        const focusChanged = previousSettings && previousSettings.focusMode !== settings.focusMode;
                        body.classList.toggle('focus-mode', settings.focusMode);
                        if (focusChanged) {
                            showToast(settings.focusMode ? 'Focus mode enabled' : 'Focus mode disabled', settings.focusMode ? '🎯' : '✓');
                        }

                        // Update mode indicators
                        updateModeIndicators(settings.typewriterMode, settings.focusMode);

                        // Toolbar visibility
                        body.classList.toggle('toolbar-hidden', !settings.showToolbar);

                        // Refresh CodeMirror to apply changes
                        if (easyMDE) {
                            easyMDE.codemirror.refresh();
                        }

                        // Store current settings for next comparison
                        previousSettings = { ...settings };
                    }

                    // Initialize
                    initEditor();
                </script>
            </body>
            </html>`;
    }

    private async updateTextDocument(document: vscode.TextDocument, text: string): Promise<boolean> {
        if (document.getText() === text) {
            return true;
        }

        const edit = new vscode.WorkspaceEdit();

        // Compute minimal edits for better undo support
        const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
        edit.replace(document.uri, fullRange, text);

        return vscode.workspace.applyEdit(edit);
    }
}
