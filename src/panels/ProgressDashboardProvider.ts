import * as vscode from 'vscode';
import { WritingStatsService } from '../services/WritingStatsService';
import { NovelTreeDataProvider } from '../views/NovelTreeDataProvider';

export class ProgressDashboardProvider {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly statsService: WritingStatsService,
        private readonly treeProvider: NovelTreeDataProvider
    ) { }

    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            this.updateContent();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'novelProgressDashboard',
            'Writing Progress',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.updateContent();
    }

    private updateContent(): void {
        if (!this.panel) {
            return;
        }

        const goals = this.statsService.getGoals();
        const todayProgress = this.statsService.getTodayProgress();
        const weekStats = this.statsService.getWeekStats();
        const streak = this.statsService.getStreak();
        const totalStats = this.statsService.getTotalStats();
        const projectWordCount = this.treeProvider.getTotalWordCount();

        // Calculate project progress
        const projectProgress = Math.min(100, Math.round((projectWordCount / goals.projectWordGoal) * 100));

        // Generate week chart data
        const weekLabels = weekStats.map(s => {
            const date = new Date(s.date);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        const weekData = weekStats.map(s => s.wordsWritten);
        const maxWeekWords = Math.max(...weekData, goals.dailyWordGoal);

        this.panel.webview.html = this.getHtml(
            goals,
            todayProgress,
            weekLabels,
            weekData,
            maxWeekWords,
            streak,
            totalStats,
            projectWordCount,
            projectProgress
        );
    }

    private getHtml(
        goals: { dailyWordGoal: number; sessionWordGoal: number; projectWordGoal: number },
        todayProgress: { words: number; goal: number; percentage: number },
        weekLabels: string[],
        weekData: number[],
        maxWeekWords: number,
        streak: { current: number; longest: number },
        totalStats: { totalWords: number; projectStart: string; daysActive: number },
        projectWordCount: number,
        projectProgress: number
    ): string {
        const weekBars = weekData.map((words, i) => {
            const height = maxWeekWords > 0 ? Math.round((words / maxWeekWords) * 150) : 0;
            const isGoalMet = words >= goals.dailyWordGoal;
            const barClass = isGoalMet ? 'bar goal-met' : 'bar';
            return `
                <div class="bar-container">
                    <div class="${barClass}" style="height: ${height}px;">
                        <span class="bar-value">${words > 0 ? words.toLocaleString() : ''}</span>
                    </div>
                    <span class="bar-label">${weekLabels[i]}</span>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        :root {
            --success-color: var(--vscode-testing-iconPassed, #34a853);
            --warning-color: var(--vscode-editorWarning-foreground, #fbbc04);
            --primary-color: var(--vscode-textLink-foreground, #569cd6);
            --secondary-color: var(--vscode-symbolIcon-classForeground, #4ec9b0);
            --accent-color: var(--vscode-symbolIcon-stringForeground, #ce9178);
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --text-color: var(--vscode-editor-foreground, #d4d4d4);
            --card-bg: var(--vscode-editorWidget-background, #252526);
            --muted-text: var(--vscode-descriptionForeground, #888);
            --border-color: var(--vscode-widget-border, #333);
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: var(--bg-color);
            color: var(--text-color);
            margin: 0;
        }
        h1 { color: var(--primary-color); margin-bottom: 5px; }
        h2 { color: var(--secondary-color); margin-top: 30px; font-size: 16px; }
        .subtitle { color: var(--muted-text); margin-bottom: 25px; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: var(--primary-color);
        }
        .stat-label {
            font-size: 12px;
            color: var(--muted-text);
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-card.highlight .stat-value { color: var(--success-color); }
        .stat-card.warning .stat-value { color: var(--warning-color); }
        .stat-card.accent .stat-value { color: var(--accent-color); }

        .progress-section {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .progress-title { font-weight: 500; }
        .progress-value { color: var(--muted-text); font-size: 14px; }
        .progress-bar {
            height: 12px;
            background: var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            border-radius: 6px;
            transition: width 0.5s ease;
        }
        .progress-fill.daily { background: linear-gradient(90deg, var(--primary-color), var(--secondary-color)); }
        .progress-fill.project { background: linear-gradient(90deg, var(--accent-color), var(--vscode-editorError-foreground, #d93025)); }

        .week-chart {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }
        .chart-container {
            display: flex;
            justify-content: space-around;
            align-items: flex-end;
            height: 180px;
            padding-top: 30px;
        }
        .bar-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
        }
        .bar {
            width: 30px;
            border-radius: 4px 4px 0 0;
            position: relative;
            min-height: 2px;
            transition: height 0.3s;
            background: var(--primary-color);
        }
        .bar.goal-met {
            background: var(--success-color);
        }
        .bar-value {
            position: absolute;
            top: -22px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            color: var(--muted-text);
            white-space: nowrap;
        }
        .bar-label {
            margin-top: 8px;
            font-size: 11px;
            color: var(--muted-text);
        }
        .goal-line {
            position: absolute;
            left: 0;
            right: 0;
            border-top: 2px dashed rgba(251, 188, 4, 0.5);
        }

        .streak-section {
            display: flex;
            gap: 20px;
            margin: 20px 0;
        }
        .streak-card {
            flex: 1;
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .streak-icon { font-size: 32px; margin-bottom: 10px; }
        .streak-value { font-size: 36px; font-weight: bold; color: var(--warning-color); }
        .streak-label { font-size: 12px; color: var(--muted-text); margin-top: 5px; }

        .tips-section {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
        }
        .tip {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border-color);
        }
        .tip:last-child { border-bottom: none; }
        .tip-icon { font-size: 18px; }
        .tip-text { color: var(--muted-text); font-size: 14px; }
    </style>
</head>
<body>
    <h1>📊 Writing Progress</h1>
    <p class="subtitle">Track your writing journey</p>

    <div class="stats-grid">
        <div class="stat-card highlight">
            <div class="stat-value">${todayProgress.words.toLocaleString()}</div>
            <div class="stat-label">Words Today</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${projectWordCount.toLocaleString()}</div>
            <div class="stat-label">Project Total</div>
        </div>
        <div class="stat-card accent">
            <div class="stat-value">${totalStats.totalWords.toLocaleString()}</div>
            <div class="stat-label">Lifetime Words</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalStats.daysActive}</div>
            <div class="stat-label">Days Active</div>
        </div>
    </div>

    <div class="progress-section">
        <div class="progress-header">
            <span class="progress-title">📝 Daily Goal</span>
            <span class="progress-value">${todayProgress.words.toLocaleString()} / ${todayProgress.goal.toLocaleString()} words (${todayProgress.percentage}%)</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill daily" style="width: ${todayProgress.percentage}%;"></div>
        </div>
    </div>

    <div class="progress-section">
        <div class="progress-header">
            <span class="progress-title">📚 Project Goal</span>
            <span class="progress-value">${projectWordCount.toLocaleString()} / ${goals.projectWordGoal.toLocaleString()} words (${projectProgress}%)</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill project" style="width: ${projectProgress}%;"></div>
        </div>
    </div>

    <div class="streak-section">
        <div class="streak-card">
            <div class="streak-icon">🔥</div>
            <div class="streak-value">${streak.current}</div>
            <div class="streak-label">Current Streak</div>
        </div>
        <div class="streak-card">
            <div class="streak-icon">🏆</div>
            <div class="streak-value">${streak.longest}</div>
            <div class="streak-label">Best Streak</div>
        </div>
    </div>

    <h2>📈 This Week</h2>
    <div class="week-chart">
        <div class="chart-container" style="position: relative;">
            ${weekBars}
        </div>
    </div>

    <h2>💡 Writing Tips</h2>
    <div class="tips-section">
        <div class="tip">
            <span class="tip-icon">⏱️</span>
            <span class="tip-text">Try a writing sprint! Use <code>Ctrl+Shift+P</code> → "Start Writing Sprint" for focused sessions.</span>
        </div>
        <div class="tip">
            <span class="tip-icon">🎯</span>
            <span class="tip-text">Set achievable daily goals. Consistency beats intensity for long-term progress.</span>
        </div>
        <div class="tip">
            <span class="tip-icon">📖</span>
            <span class="tip-text">Use "Analyze Writing" to check for overused words and passive voice.</span>
        </div>
    </div>
</body>
</html>`;
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}
