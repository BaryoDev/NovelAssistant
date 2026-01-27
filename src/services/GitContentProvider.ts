import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'novel-git';

    onDidChange?: vscode.Event<vscode.Uri> | undefined;

    provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        // format: novel-git:/absolute/path/to/file.md?{"ref":"HEAD"}
        const fsPath = uri.fsPath;
        const query = JSON.parse(uri.query);
        const ref = query.ref || 'HEAD';

        return new Promise((resolve, _reject) => {
            const cwd = path.dirname(fsPath);
            const fileName = path.basename(fsPath);

            // git show HEAD:./filename
            // We use relative path ./filename to ensure git understands it relative to cwd
            const command = `git show ${ref}:./${fileName}`;

            cp.exec(command, { cwd }, (error, stdout, stderr) => {
                if (error) {
                    // If file is new and doesn't exist in HEAD, show empty
                    if (stderr.includes('does not exist in')) {
                        resolve("");
                        return;
                    }
                    console.error(`Git error: ${stderr}`);
                    resolve(`(Error fetching Git content: ${stderr})`);
                    return;
                }
                resolve(stdout);
            });
        });
    }
}
