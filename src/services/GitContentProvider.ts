import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { buildGitShowArgs } from '../util/security';

export class GitContentProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'novel-git';

    onDidChange?: vscode.Event<vscode.Uri> | undefined;

    provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
        // format: novel-git:/absolute/path/to/file.md?{"ref":"HEAD"}
        const fsPath = uri.fsPath;
        let ref = 'HEAD';
        try {
            ref = JSON.parse(uri.query).ref || 'HEAD';
        } catch {
            return '(Invalid compare request)';
        }

        return new Promise((resolve, _reject) => {
            const cwd = path.dirname(fsPath);
            const fileName = path.basename(fsPath);

            // git show HEAD:./filename, run without a shell so the file name is one argument
            let args: string[];
            try {
                args = buildGitShowArgs(ref, fileName);
            } catch {
                resolve('(Invalid git ref)');
                return;
            }

            cp.execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
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
