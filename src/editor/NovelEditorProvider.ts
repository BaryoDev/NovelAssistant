import * as vscode from 'vscode';

export class NovelEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'novel-assistant.wysiwyg';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new NovelEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(NovelEditorProvider.viewType, provider);
        return providerRegistration;
    }

    /**
     * Called when our custom editor is opened.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        }

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we must sync change in the document to our
        // editor and sync changes in the editor back to the document.
        // 
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'change':
                    this.updateTextDocument(document, e.text);
                    return;
            }
        });

        updateWebview();
    }

    /**
     * Get the static html used for the editor webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src https://fonts.gstatic.com https://use.fontawesome.com; style-src 'unsafe-inline' https://cdn.jsdelivr.net https://use.fontawesome.com https://fonts.googleapis.com; script-src 'unsafe-inline' https://cdn.jsdelivr.net;">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Novel Editor</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Roboto:wght@400;500&display=swap');

                    body {
                        padding: 0;
                        background-color: #fcfbf9; /* Warm paper tone */
                        font-family: 'Merriweather', serif;
                        color: #2c2925; /* Soft black */
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                    }

                    /* Scrollbar Styling */
                    ::-webkit-scrollbar {
                        width: 8px;
                        background-color: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background-color: rgba(0,0,0,0.1);
                        border-radius: 4px;
                    }
                    
                    /* Toolbar Container - Top Bar */
                    .editor-toolbar {
                        border: none !important;
                        background-color: transparent !important;
                        border-bottom: 1px solid rgba(0,0,0,0.05) !important;
                        padding: 10px 20px !important;
                        text-align: center; /* Center buttons */
                        flex-shrink: 0;
                        opacity: 0.7;
                        transition: opacity 0.3s;
                    }
                    .editor-toolbar:hover {
                        opacity: 1;
                    }

                    /* Buttons General */
                    .editor-toolbar button {
                        border: none !important;
                        background: transparent !important;
                        color: #888 !important;
                        margin: 0 4px !important;
                        transition: color 0.2s;
                        font-family: 'Roboto', sans-serif;
                    }

                    .editor-toolbar button:hover {
                        background-color: transparent !important;
                        color: #000 !important;
                    }

                    .editor-toolbar button.active {
                        background-color: transparent !important;
                        color: #d93025 !important; /* Subtle accent for active */
                    }

                    /* Editor Content Area */
                    .CodeMirror {
                        flex-grow: 1;
                        border: none !important;
                        background-color: transparent !important;
                        font-family: 'Merriweather', serif !important;
                        font-size: 18px !important;
                        line-height: 1.8 !important;
                        color: #2c2925 !important;
                        /* Centered Layout */
                        max-width: 720px;
                        margin: 0 auto;
                        padding: 40px 20px !important;
                    }
                    
                    /* Hide status bar */
                    .editor-statusbar {
                        display: none !important;
                    }
                    
                    /* Headings */
                    .cm-header {
                        font-family: 'Roboto', sans-serif;
                        color: #444;
                        font-weight: 500;
                    }
                    .cm-header-1 { font-size: 2.2em; line-height: 1.2; margin-bottom: 0.5em; }
                    .cm-header-2 { font-size: 1.8em; margin-bottom: 0.5em; }
                    .cm-header-3 { font-size: 1.4em; }

                    /* Quote */
                    .cm-quote {
                        font-style: italic;
                        color: #666;
                        font-family: 'Merriweather', serif;
                    }
                    
                    /* Selection */
                    .CodeMirror-selected {
                        background: rgba(0, 0, 0, 0.05) !important;
                    }

                    /* Dark Mode Overrides (if VS Code is dark) */
                    body.vscode-dark {
                        background-color: #1e1e1e;
                        color: #ccc;
                    }
                    body.vscode-dark .CodeMirror {
                        color: #e0e0e0 !important;
                    }
                    body.vscode-dark .editor-toolbar button {
                        color: #666 !important;
                    }
                    body.vscode-dark .editor-toolbar button:hover {
                        color: #fff !important;
                    }
                    body.vscode-dark ::-webkit-scrollbar-thumb {
                        background-color: rgba(255,255,255,0.1);
                    }
                </style>
            </head>
            <body>
                <textarea id="editor"></textarea>
                <script src="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js"></script>
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Dark mode detection
                    if (document.body.classList.contains('vscode-dark')) {
                        // Apply dark class
                    }

                    const easyMDE = new EasyMDE({
                        element: document.getElementById('editor'),
                        spellChecker: false,
                        status: false,
                        autosave: { enabled: false },
                        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "|", "preview", "guide"],
                        placeholder: "Start your story...",
                    });

                    // Handle messages sent from the extension to the webview
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                const text = message.text;
                                if (easyMDE.value() !== text) {
                                    easyMDE.value(text);
                                }
                                break;
                        }
                    });

                    // Send text changes back to the extension
                    easyMDE.codemirror.on("change", () => {
                         vscode.postMessage({
                            type: 'change',
                            text: easyMDE.value()
                        });
                    });
                </script>
            </body>
            </html>`;
    }

    /**
     * Write out the text to a file
     */
    private updateTextDocument(document: vscode.TextDocument, text: string) {
        const edit = new vscode.WorkspaceEdit();

        // Just replace the entire document every time for this simple example.
        // A more complete implementation would compute minimal edits.
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            text
        );

        return vscode.workspace.applyEdit(edit);
    }
}
