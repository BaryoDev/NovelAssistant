import * as vscode from 'vscode';
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';

export class GitService {
    private git: SimpleGit | null = null;
    private rootPath: string | undefined;
    private isGitAvailable: boolean = false;

    constructor() {
        this.rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.initializeGit();
    }

    private async initializeGit(): Promise<void> {
        if (!this.rootPath) {
            return;
        }

        try {
            const options: Partial<SimpleGitOptions> = {
                baseDir: this.rootPath,
                binary: 'git',
                maxConcurrentProcesses: 6,
                trimmed: false,
            };

            this.git = simpleGit(options);

            // Check if git is available
            await this.git.version();
            this.isGitAvailable = true;
        } catch {
            this.isGitAvailable = false;
            this.git = null;
        }
    }

    public async isAvailable(): Promise<boolean> {
        return this.isGitAvailable;
    }

    public async init(): Promise<boolean> {
        if (!this.git || !this.rootPath) {
            return false;
        }

        try {
            await this.git.init();
            return true;
        } catch {
            return false;
        }
    }

    public async isRepo(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            return await this.git.checkIsRepo();
        } catch {
            return false;
        }
    }

    public async add(files: string | string[]): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.add(files);
            return true;
        } catch {
            return false;
        }
    }

    public async commit(message: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            await this.git.commit(message);
            return true;
        } catch {
            return false;
        }
    }

    public async getFileContent(filePath: string, ref: string = 'HEAD'): Promise<string | null> {
        if (!this.git || !this.rootPath) {
            return null;
        }

        try {
            const relativePath = path.relative(this.rootPath, filePath);
            const content = await this.git.show([`${ref}:${relativePath}`]);
            return content;
        } catch {
            return null;
        }
    }

    public async getFileHistory(filePath: string, maxCount: number = 50): Promise<Array<{hash: string, date: string, message: string, author: string}>> {
        if (!this.git || !this.rootPath) {
            return [];
        }

        try {
            const relativePath = path.relative(this.rootPath, filePath);
            const log = await this.git.log({
                file: relativePath,
                maxCount,
            });

            return log.all.map(entry => ({
                hash: entry.hash,
                date: entry.date,
                message: entry.message,
                author: entry.author_name,
            }));
        } catch {
            return [];
        }
    }

    public async getDiff(filePath?: string): Promise<string> {
        if (!this.git) {
            return '';
        }

        try {
            if (filePath && this.rootPath) {
                const relativePath = path.relative(this.rootPath, filePath);
                return await this.git.diff([relativePath]);
            }
            return await this.git.diff();
        } catch {
            return '';
        }
    }

    public async getStatus(): Promise<{staged: string[], unstaged: string[], untracked: string[]}> {
        if (!this.git) {
            return { staged: [], unstaged: [], untracked: [] };
        }

        try {
            const status = await this.git.status();
            return {
                staged: status.staged,
                unstaged: status.modified,
                untracked: status.not_added,
            };
        } catch {
            return { staged: [], unstaged: [], untracked: [] };
        }
    }

    public async autoBackup(message?: string): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            const status = await this.git.status();

            if (status.files.length === 0) {
                return true; // Nothing to commit
            }

            await this.git.add('.');

            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const commitMessage = message || `Auto-backup: ${timestamp}`;

            await this.git.commit(commitMessage);
            return true;
        } catch {
            return false;
        }
    }

    public dispose(): void {
        this.git = null;
    }
}
