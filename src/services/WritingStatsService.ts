import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface DailyStats {
    date: string;
    wordsWritten: number;
    timeSpentMinutes: number;
    sessionsCount: number;
}

interface WritingGoals {
    dailyWordGoal: number;
    sessionWordGoal: number;
    projectWordGoal: number;
}

interface StatsData {
    goals: WritingGoals;
    dailyStats: DailyStats[];
    currentStreak: number;
    longestStreak: number;
    totalWordsEver: number;
    projectStartDate: string;
}

export class WritingStatsService {
    private statsFilePath: string | undefined;
    private stats: StatsData;
    private sessionStartWords: number = 0;
    private sessionStartTime: Date | null = null;

    constructor() {
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (rootPath) {
            this.statsFilePath = path.join(rootPath, '.novel-assistant', 'stats.json');
        }
        this.stats = this.loadStats();
    }

    private loadStats(): StatsData {
        const defaultStats: StatsData = {
            goals: {
                dailyWordGoal: 1000,
                sessionWordGoal: 500,
                projectWordGoal: 50000,
            },
            dailyStats: [],
            currentStreak: 0,
            longestStreak: 0,
            totalWordsEver: 0,
            projectStartDate: new Date().toISOString().split('T')[0],
        };

        if (!this.statsFilePath) {
            return defaultStats;
        }

        try {
            if (fs.existsSync(this.statsFilePath)) {
                const data = fs.readFileSync(this.statsFilePath, 'utf-8');
                return { ...defaultStats, ...JSON.parse(data) };
            }
        } catch {
            // Silent fail, return defaults
        }

        return defaultStats;
    }

    private saveStats(): void {
        if (!this.statsFilePath) {
            return;
        }

        try {
            const dir = path.dirname(this.statsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.statsFilePath, JSON.stringify(this.stats, null, 2));
        } catch {
            // Silent fail
        }
    }

    public startSession(currentWordCount: number): void {
        this.sessionStartWords = currentWordCount;
        this.sessionStartTime = new Date();
    }

    public endSession(currentWordCount: number): void {
        if (this.sessionStartTime === null) {
            return;
        }

        const wordsWritten = Math.max(0, currentWordCount - this.sessionStartWords);
        const timeSpent = Math.round((Date.now() - this.sessionStartTime.getTime()) / 60000);
        const today = new Date().toISOString().split('T')[0];

        let todayStats = this.stats.dailyStats.find(s => s.date === today);
        if (!todayStats) {
            todayStats = {
                date: today,
                wordsWritten: 0,
                timeSpentMinutes: 0,
                sessionsCount: 0,
            };
            this.stats.dailyStats.push(todayStats);
        }

        todayStats.wordsWritten += wordsWritten;
        todayStats.timeSpentMinutes += timeSpent;
        todayStats.sessionsCount += 1;
        this.stats.totalWordsEver += wordsWritten;

        this.updateStreak();
        this.saveStats();

        this.sessionStartTime = null;
        this.sessionStartWords = 0;
    }

    private updateStreak(): void {
        const today = new Date();
        let streak = 0;

        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const dayStats = this.stats.dailyStats.find(s => s.date === dateStr);
            if (dayStats && dayStats.wordsWritten >= this.stats.goals.dailyWordGoal) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        this.stats.currentStreak = streak;
        if (streak > this.stats.longestStreak) {
            this.stats.longestStreak = streak;
        }
    }

    public getGoals(): WritingGoals {
        return { ...this.stats.goals };
    }

    public setGoals(goals: Partial<WritingGoals>): void {
        this.stats.goals = { ...this.stats.goals, ...goals };
        this.saveStats();
    }

    public getTodayStats(): DailyStats | null {
        const today = new Date().toISOString().split('T')[0];
        return this.stats.dailyStats.find(s => s.date === today) || null;
    }

    public getTodayProgress(): { words: number; goal: number; percentage: number } {
        const today = this.getTodayStats();
        const words = today?.wordsWritten || 0;
        const goal = this.stats.goals.dailyWordGoal;
        return {
            words,
            goal,
            percentage: Math.min(100, Math.round((words / goal) * 100)),
        };
    }

    public getWeekStats(): DailyStats[] {
        const result: DailyStats[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const dayStats = this.stats.dailyStats.find(s => s.date === dateStr);
            result.push(dayStats || {
                date: dateStr,
                wordsWritten: 0,
                timeSpentMinutes: 0,
                sessionsCount: 0,
            });
        }

        return result;
    }

    public getStreak(): { current: number; longest: number } {
        return {
            current: this.stats.currentStreak,
            longest: this.stats.longestStreak,
        };
    }

    public getTotalStats(): { totalWords: number; projectStart: string; daysActive: number } {
        const uniqueDays = new Set(this.stats.dailyStats.map(s => s.date)).size;
        return {
            totalWords: this.stats.totalWordsEver,
            projectStart: this.stats.projectStartDate,
            daysActive: uniqueDays,
        };
    }

    public recordWords(wordCount: number): void {
        const today = new Date().toISOString().split('T')[0];
        let todayStats = this.stats.dailyStats.find(s => s.date === today);

        if (!todayStats) {
            todayStats = {
                date: today,
                wordsWritten: 0,
                timeSpentMinutes: 0,
                sessionsCount: 0,
            };
            this.stats.dailyStats.push(todayStats);
        }

        const previousTotal = todayStats.wordsWritten;
        if (wordCount > previousTotal) {
            const diff = wordCount - previousTotal;
            todayStats.wordsWritten = wordCount;
            this.stats.totalWordsEver += diff;
            this.updateStreak();
            this.saveStats();
        }
    }

    public dispose(): void {
        if (this.sessionStartTime) {
            // Try to save session on dispose
            this.saveStats();
        }
    }
}
