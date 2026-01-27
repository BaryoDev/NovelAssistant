import * as vscode from 'vscode';

const ONBOARDING_COMPLETE_KEY = 'novel-assistant.onboardingComplete';
const ONBOARDING_VERSION_KEY = 'novel-assistant.onboardingVersion';
const CURRENT_ONBOARDING_VERSION = 1;

export class OnboardingService {
    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Check if this is the first run of the extension
     */
    public isFirstRun(): boolean {
        const completedVersion = this.context.globalState.get<number>(ONBOARDING_VERSION_KEY, 0);
        return completedVersion < CURRENT_ONBOARDING_VERSION;
    }

    /**
     * Mark onboarding as complete
     */
    public async markOnboardingComplete(): Promise<void> {
        await this.context.globalState.update(ONBOARDING_COMPLETE_KEY, true);
        await this.context.globalState.update(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION);
    }

    /**
     * Reset onboarding state (for testing or re-showing)
     */
    public async resetOnboarding(): Promise<void> {
        await this.context.globalState.update(ONBOARDING_COMPLETE_KEY, false);
        await this.context.globalState.update(ONBOARDING_VERSION_KEY, 0);
    }

    /**
     * Get quick start suggestions based on workspace state
     */
    public getQuickStartSuggestions(): QuickStartSuggestion[] {
        const suggestions: QuickStartSuggestion[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            suggestions.push({
                icon: '📁',
                title: 'Open a folder',
                description: 'Start by opening a folder to store your manuscript',
                command: 'workbench.action.files.openFolder',
            });
        } else {
            suggestions.push(
                {
                    icon: '📝',
                    title: 'Create your first chapter',
                    description: 'Start writing by creating a new manuscript file',
                    command: 'novel-assistant.createChapter',
                },
                {
                    icon: '👤',
                    title: 'Add a character',
                    description: 'Build your cast by creating character profiles',
                    command: 'novel-assistant.createCharacter',
                },
                {
                    icon: '📊',
                    title: 'Set a writing goal',
                    description: 'Stay motivated with daily word count targets',
                    command: 'workbench.action.openSettings',
                    args: ['novel-assistant.writing'],
                }
            );
        }

        return suggestions;
    }
}

export interface QuickStartSuggestion {
    icon: string;
    title: string;
    description: string;
    command: string;
    args?: unknown[];
}
