import * as vscode from 'vscode';
import { GitService } from './GitService';

export class AutoBackupService {
    private timer: NodeJS.Timeout | null = null;
    private gitService: GitService;
    private lastBackupTime: Date | null = null;
    private backupCount: number = 0;

    constructor(gitService: GitService) {
        this.gitService = gitService;
    }

    public async start(): Promise<void> {
        const config = vscode.workspace.getConfiguration('novel-assistant');
        const enabled = config.get<boolean>('autoBackup.enabled', true);
        const intervalMinutes = config.get<number>('autoBackup.intervalMinutes', 30);

        if (!enabled) {
            return;
        }

        // Check if git is available
        const isGitAvailable = await this.gitService.isAvailable();
        if (!isGitAvailable) {
            return;
        }

        // Check if we're in a git repo
        const isRepo = await this.gitService.isRepo();
        if (!isRepo) {
            // Try to initialize
            await this.gitService.init();
        }

        this.scheduleBackup(intervalMinutes);
    }

    private scheduleBackup(intervalMinutes: number): void {
        if (this.timer) {
            clearInterval(this.timer);
        }

        const intervalMs = intervalMinutes * 60 * 1000;

        this.timer = setInterval(async () => {
            await this.performBackup();
        }, intervalMs);
    }

    public async performBackup(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('novel-assistant');
            const includeTimestamp = config.get<boolean>('autoBackup.includeTimestamp', true);

            let message = 'Auto-backup';
            if (includeTimestamp) {
                const timestamp = new Date().toLocaleString();
                message = `Auto-backup: ${timestamp}`;
            }

            const success = await this.gitService.autoBackup(message);

            if (success) {
                this.lastBackupTime = new Date();
                this.backupCount++;
            }

            return success;
        } catch {
            return false;
        }
    }

    public async manualBackup(message?: string): Promise<boolean> {
        const customMessage = message || `Manual backup: ${new Date().toLocaleString()}`;
        const success = await this.gitService.autoBackup(customMessage);

        if (success) {
            this.lastBackupTime = new Date();
            this.backupCount++;
            vscode.window.showInformationMessage('Backup created successfully!');
        }

        return success;
    }

    public getLastBackupTime(): Date | null {
        return this.lastBackupTime;
    }

    public getBackupCount(): number {
        return this.backupCount;
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    public dispose(): void {
        this.stop();
    }
}
