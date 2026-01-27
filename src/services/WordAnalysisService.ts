import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DesignSystem } from '../styles/DesignSystem';

interface WordFrequency {
    word: string;
    count: number;
    percentage: number;
}

interface AnalysisResult {
    totalWords: number;
    uniqueWords: number;
    averageSentenceLength: number;
    averageWordLength: number;
    readabilityScore: number;
    topWords: WordFrequency[];
    overusedWords: WordFrequency[];
    passiveVoiceInstances: string[];
    adverbCount: number;
    dialoguePercentage: number;
}

export class WordAnalysisService {
    // Common words to exclude from frequency analysis
    private readonly stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
        'she', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why',
        'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
        'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
        'than', 'too', 'very', 'just', 'into', 'over', 'after', 'before',
        'between', 'under', 'again', 'then', 'once', 'here', 'there', 'about',
        'up', 'down', 'out', 'off', 'if', 'because', 'until', 'while', 'him',
        'her', 'his', 'them', 'their', 'my', 'your', 'our', 'me', 'us',
    ]);

    // Common -ly adverbs to flag
    private readonly commonAdverbs = [
        'really', 'very', 'actually', 'basically', 'literally', 'definitely',
        'absolutely', 'completely', 'totally', 'extremely', 'incredibly',
        'suddenly', 'quickly', 'slowly', 'quietly', 'loudly', 'softly',
        'gently', 'carefully', 'finally', 'immediately', 'eventually',
    ];

    // Passive voice indicators
    private readonly passiveIndicators = [
        'was', 'were', 'is', 'are', 'been', 'being', 'be',
    ];

    public analyzeText(text: string): AnalysisResult {
        const words = this.getWords(text);
        const sentences = this.getSentences(text);
        const wordFrequencies = this.getWordFrequencies(words);

        const totalWords = words.length;
        const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;

        const averageSentenceLength = sentences.length > 0
            ? Math.round(totalWords / sentences.length)
            : 0;

        const averageWordLength = totalWords > 0
            ? Math.round((words.reduce((sum, w) => sum + w.length, 0) / totalWords) * 10) / 10
            : 0;

        const topWords = wordFrequencies.slice(0, 20);
        const overusedWords = this.findOverusedWords(wordFrequencies, totalWords);
        const passiveVoiceInstances = this.findPassiveVoice(sentences);
        const adverbCount = this.countAdverbs(words);
        const dialoguePercentage = this.calculateDialoguePercentage(text);
        const readabilityScore = this.calculateReadability(words, sentences);

        return {
            totalWords,
            uniqueWords,
            averageSentenceLength,
            averageWordLength,
            readabilityScore,
            topWords,
            overusedWords,
            passiveVoiceInstances,
            adverbCount,
            dialoguePercentage,
        };
    }

    private getWords(text: string): string[] {
        return text
            .replace(/[^\w\s'-]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    private getSentences(text: string): string[] {
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    private getWordFrequencies(words: string[]): WordFrequency[] {
        const counts = new Map<string, number>();
        const totalWords = words.length;

        for (const word of words) {
            const lower = word.toLowerCase();
            if (!this.stopWords.has(lower) && lower.length > 2) {
                counts.set(lower, (counts.get(lower) || 0) + 1);
            }
        }

        return Array.from(counts.entries())
            .map(([word, count]) => ({
                word,
                count,
                percentage: Math.round((count / totalWords) * 10000) / 100,
            }))
            .sort((a, b) => b.count - a.count);
    }

    private findOverusedWords(frequencies: WordFrequency[], totalWords: number): WordFrequency[] {
        // Words that appear more than 1% of the time (excluding stop words) may be overused
        const threshold = totalWords * 0.01;
        return frequencies.filter(f => f.count > threshold && f.count > 5);
    }

    private findPassiveVoice(sentences: string[]): string[] {
        const passivePatterns = [
            /\b(was|were|is|are|been|being|be)\s+\w+ed\b/gi,
            /\b(was|were|is|are|been|being|be)\s+\w+en\b/gi,
        ];

        const results: string[] = [];

        for (const sentence of sentences) {
            for (const pattern of passivePatterns) {
                if (pattern.test(sentence) && results.length < 10) {
                    results.push(sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''));
                    break;
                }
            }
        }

        return results;
    }

    private countAdverbs(words: string[]): number {
        let count = 0;
        for (const word of words) {
            const lower = word.toLowerCase();
            if (lower.endsWith('ly') || this.commonAdverbs.includes(lower)) {
                count++;
            }
        }
        return count;
    }

    private calculateDialoguePercentage(text: string): number {
        // Match text within quotes
        const dialogueMatches = text.match(/"[^"]*"|'[^']*'|"[^"]*"|'[^']*'/g) || [];
        const dialogueLength = dialogueMatches.reduce((sum, match) => sum + match.length, 0);
        const totalLength = text.length;

        return totalLength > 0
            ? Math.round((dialogueLength / totalLength) * 100)
            : 0;
    }

    private calculateReadability(words: string[], sentences: string[]): number {
        // Flesch-Kincaid Reading Ease approximation
        if (words.length === 0 || sentences.length === 0) {
            return 0;
        }

        const avgSentenceLength = words.length / sentences.length;
        const avgSyllables = this.estimateAverageSyllables(words);

        // Flesch Reading Ease formula
        const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables);
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    private estimateAverageSyllables(words: string[]): number {
        let totalSyllables = 0;
        for (const word of words) {
            totalSyllables += this.countSyllables(word);
        }
        return words.length > 0 ? totalSyllables / words.length : 0;
    }

    private countSyllables(word: string): number {
        word = word.toLowerCase();
        if (word.length <= 3) { return 1; }

        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');

        const matches = word.match(/[aeiouy]{1,2}/g);
        return matches ? matches.length : 1;
    }

    public async analyzeFile(filePath: string): Promise<AnalysisResult | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this.analyzeText(content);
        } catch {
            return null;
        }
    }

    public async analyzeProject(): Promise<AnalysisResult | null> {
        const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!rootPath) {
            return null;
        }

        const manuscriptPath = path.join(rootPath, 'Manuscript');
        const files = await this.getMarkdownFiles(manuscriptPath);

        let allText = '';
        for (const file of files) {
            try {
                allText += fs.readFileSync(file, 'utf-8') + '\n\n';
            } catch {
                // Skip unreadable files
            }
        }

        return this.analyzeText(allText);
    }

    private async getMarkdownFiles(dir: string): Promise<string[]> {
        const files: string[] = [];

        try {
            if (!fs.existsSync(dir)) {
                return files;
            }

            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await this.getMarkdownFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.name.endsWith('.md')) {
                    files.push(fullPath);
                }
            }
        } catch {
            // Silent fail
        }

        return files;
    }

    public async showAnalysisReport(): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        const choice = await vscode.window.showQuickPick(
            ['Analyze Current File', 'Analyze Entire Project'],
            { placeHolder: 'What would you like to analyze?' }
        );

        let result: AnalysisResult | null = null;

        if (choice === 'Analyze Current File' && editor) {
            result = this.analyzeText(editor.document.getText());
        } else if (choice === 'Analyze Entire Project') {
            result = await this.analyzeProject();
        }

        if (!result) {
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'novelAnalysis',
            'Writing Analysis',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        panel.webview.html = this.getAnalysisHtml(result);
    }

    private getAnalysisHtml(result: AnalysisResult): string {
        const topWordsHtml = result.topWords
            .slice(0, 15)
            .map(w => `<tr><td>${w.word}</td><td>${w.count}</td><td>${w.percentage}%</td></tr>`)
            .join('');

        const overusedHtml = result.overusedWords.length > 0
            ? result.overusedWords.map(w => `<span class="tag warning">${w.word} (${w.count}x)</span>`).join(' ')
            : '<span class="tag success">No overused words detected</span>';

        const passiveHtml = result.passiveVoiceInstances.length > 0
            ? result.passiveVoiceInstances.map(s => `<li>"${s}"</li>`).join('')
            : '<li>No passive voice instances detected</li>';

        const readabilityLabel = result.readabilityScore >= 60 ? 'Easy' :
            result.readabilityScore >= 30 ? 'Moderate' : 'Difficult';

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        ${DesignSystem.getCompleteStylesheet()}

        body {
            padding: var(--space-xl);
            background: var(--bg-primary);
            color: var(--text-primary);
        }

        h1 {
            color: var(--color-primary);
            border-bottom: 1px solid var(--border-primary);
            padding-bottom: var(--space-md);
            margin-bottom: var(--space-lg);
            animation: slideDown var(--duration-normal) var(--easing-decelerate);
        }

        h2 {
            color: var(--color-secondary);
            margin-top: var(--space-xl);
            font-size: 16px;
            animation: slideDown var(--duration-normal) var(--easing-decelerate);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: var(--space-lg);
            margin: var(--space-xl) 0;
        }

        .stat-card {
            background: var(--bg-secondary);
            padding: var(--space-lg);
            border-radius: var(--radius-lg);
            text-align: center;
            transition: transform var(--duration-normal) var(--easing-standard),
                        box-shadow var(--duration-normal) var(--easing-standard);
            animation: scaleIn var(--duration-normal) var(--easing-decelerate);
        }

        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-md);
        }

        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--color-primary);
            letter-spacing: -0.01em;
        }

        .stat-label {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: var(--space-sm);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: var(--space-lg) 0;
            animation: fadeIn var(--duration-slow) var(--easing-standard);
        }

        th, td {
            padding: var(--space-sm) var(--space-md);
            text-align: left;
            border-bottom: 1px solid var(--border-primary);
            transition: background-color var(--duration-fast) var(--easing-standard);
        }

        tr:hover td {
            background: var(--bg-hover);
        }

        th {
            background: var(--bg-secondary);
            color: var(--color-secondary);
            font-weight: 600;
            position: sticky;
            top: 0;
        }

        .tag {
            display: inline-block;
            padding: var(--space-xs) var(--space-sm);
            border-radius: var(--radius-sm);
            margin: 2px;
            font-size: 11px;
            font-weight: 500;
            transition: all var(--duration-fast) var(--easing-standard);
        }

        .tag:hover {
            transform: scale(1.05);
        }

        .tag.warning {
            background: var(--status-revision-bg);
            color: var(--status-revision-text);
        }

        .tag.success {
            background: var(--status-complete-bg);
            color: var(--status-complete-text);
        }

        ul {
            padding-left: var(--space-xl);
            animation: fadeIn var(--duration-slow) var(--easing-standard);
        }

        li {
            margin: var(--space-sm) 0;
            font-style: italic;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .progress-bar {
            height: 10px;
            background: var(--border-primary);
            border-radius: var(--radius-sm);
            overflow: hidden;
            margin-top: var(--space-md);
        }

        .progress-fill {
            height: 100%;
            background: var(--gradient-success);
            transition: width var(--duration-slow) var(--easing-decelerate);
            position: relative;
            overflow: hidden;
        }

        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.2),
                transparent
            );
            animation: shimmer 2s infinite;
        }
    </style>
</head>
<body>
    <h1>📊 Writing Analysis Report</h1>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">${result.totalWords.toLocaleString()}</div>
            <div class="stat-label">Total Words</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.uniqueWords.toLocaleString()}</div>
            <div class="stat-label">Unique Words</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.averageSentenceLength}</div>
            <div class="stat-label">Avg Sentence Length</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.averageWordLength}</div>
            <div class="stat-label">Avg Word Length</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.dialoguePercentage}%</div>
            <div class="stat-label">Dialogue</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${result.adverbCount}</div>
            <div class="stat-label">Adverbs</div>
        </div>
    </div>

    <h2>📖 Readability Score</h2>
    <div class="stat-card">
        <div class="stat-value">${result.readabilityScore} - ${readabilityLabel}</div>
        <div class="progress-bar" style="margin-top: 10px;">
            <div class="progress-fill" style="width: ${result.readabilityScore}%;"></div>
        </div>
        <div class="stat-label">Flesch Reading Ease (0-100, higher = easier)</div>
    </div>

    <h2>🔤 Top Words</h2>
    <table>
        <tr><th>Word</th><th>Count</th><th>Frequency</th></tr>
        ${topWordsHtml}
    </table>

    <h2>⚠️ Potentially Overused Words</h2>
    <div>${overusedHtml}</div>

    <h2>🔍 Passive Voice Examples</h2>
    <ul>${passiveHtml}</ul>
</body>
</html>`;
    }

    public dispose(): void {
        // Cleanup if needed
    }
}
