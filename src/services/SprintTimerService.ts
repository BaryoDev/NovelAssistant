import * as vscode from 'vscode';

export interface SprintSession {
    startTime: Date;
    duration: number; // in minutes
    startWordCount: number;
    endWordCount: number;
    completed: boolean;
}

export class SprintTimerService {
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | null = null;
    private currentSprint: SprintSession | null = null;
    private onSprintEndCallback: ((session: SprintSession) => void) | null = null;
    private startWordCount: number = 0;
    private getWordCountFn: (() => number) | null = null;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            99
        );
        this.statusBarItem.command = 'novel-assistant.toggleSprint';
    }

    public setWordCountProvider(fn: () => number): void {
        this.getWordCountFn = fn;
    }

    public onSprintEnd(callback: (session: SprintSession) => void): void {
        this.onSprintEndCallback = callback;
    }

    public startSprint(durationMinutes: number = 25): void {
        if (this.timer) {
            this.stopSprint(false);
        }

        this.startWordCount = this.getWordCountFn?.() || 0;

        this.currentSprint = {
            startTime: new Date(),
            duration: durationMinutes,
            startWordCount: this.startWordCount,
            endWordCount: this.startWordCount,
            completed: false,
        };

        this.statusBarItem.show();
        this.updateDisplay(durationMinutes * 60);

        let remainingSeconds = durationMinutes * 60;

        this.timer = setInterval(() => {
            remainingSeconds--;
            this.updateDisplay(remainingSeconds);

            if (remainingSeconds <= 0) {
                this.stopSprint(true);
            }
        }, 1000);
    }

    private updateDisplay(remainingSeconds: number): void {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const currentWords = this.getWordCountFn?.() || 0;
        const wordsWritten = Math.max(0, currentWords - this.startWordCount);

        this.statusBarItem.text = `$(clock) ${timeStr} | +${wordsWritten} words`;
        this.statusBarItem.tooltip = `Writing Sprint in progress\nWords written: ${wordsWritten}\nClick to stop`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    public stopSprint(completed: boolean): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.currentSprint) {
            this.currentSprint.endWordCount = this.getWordCountFn?.() || 0;
            this.currentSprint.completed = completed;

            if (this.onSprintEndCallback) {
                this.onSprintEndCallback(this.currentSprint);
            }

            if (completed) {
                const wordsWritten = this.currentSprint.endWordCount - this.currentSprint.startWordCount;
                vscode.window.showInformationMessage(
                    `Sprint complete! You wrote ${wordsWritten} words in ${this.currentSprint.duration} minutes.`
                );
            }

            this.currentSprint = null;
        }

        this.statusBarItem.hide();
    }

    public isRunning(): boolean {
        return this.timer !== null;
    }

    public toggle(durationMinutes: number = 25): void {
        if (this.isRunning()) {
            this.stopSprint(false);
        } else {
            this.startSprint(durationMinutes);
        }
    }

    public async promptAndStart(): Promise<void> {
        const config = vscode.workspace.getConfiguration('novel-assistant');
        const defaultDuration = config.get<number>('sprintDuration', 25);

        const input = await vscode.window.showInputBox({
            prompt: 'Sprint duration in minutes',
            value: defaultDuration.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 180) {
                    return 'Please enter a number between 1 and 180';
                }
                return null;
            },
        });

        if (input) {
            this.startSprint(parseInt(input));
        }
    }

    public dispose(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.statusBarItem.dispose();
    }
}
