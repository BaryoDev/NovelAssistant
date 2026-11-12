import { escapeHtml } from './security';

// Pure HTML fragment builders for the webviews. Every value from a user's
// files goes through escapeHtml; paths travel in data attributes and are read
// by a delegated listener in the webview script, never in inline handlers.

export function renderTopWordRows(words: { word: string; count: number; percentage: number }[]): string {
    return words
        .map(w => `<tr><td>${escapeHtml(w.word)}</td><td>${Number(w.count)}</td><td>${Number(w.percentage)}%</td></tr>`)
        .join('');
}

export function renderOverusedWords(words: { word: string; count: number }[]): string {
    return words.length > 0
        ? words.map(w => `<span class="tag warning">${escapeHtml(w.word)} (${Number(w.count)}x)</span>`).join(' ')
        : '<span class="tag success">No overused words detected</span>';
}

export function renderPassiveVoice(sentences: string[]): string {
    return sentences.length > 0
        ? sentences.map(s => `<li>"${escapeHtml(s)}"</li>`).join('')
        : '<li>No passive voice instances detected</li>';
}

export function renderCharacterCard(c: { name: string; filePath: string; role?: string }): string {
    return `
                <div class="character-card"
                     role="button"
                     tabindex="0"
                     aria-label="Open character: ${escapeHtml(c.name)}"
                     data-path="${escapeHtml(c.filePath)}">
                    <div class="character-avatar">${escapeHtml(c.name.charAt(0).toUpperCase())}</div>
                    <div class="character-info">
                        <div class="character-name">${escapeHtml(c.name)}</div>
                        ${c.role ? `<div class="character-role">${escapeHtml(c.role)}</div>` : ''}
                    </div>
                </div>
            `;
}

export interface OutlineNode {
    title: string;
    type: 'chapter' | 'scene';
    filePath?: string;
    children: OutlineNode[];
    wordCount: number;
    status: string;
}

export function renderOutlineItem(item: OutlineNode, statusIcon: (status: string) => string, depth = 0): string {
    const indent = depth * 20;
    const icon = escapeHtml(statusIcon(item.status));
    const statusClass = escapeHtml(item.status);
    const title = escapeHtml(item.title);
    const words = item.wordCount.toLocaleString();

    if (item.type === 'chapter') {
        const childrenHtml = item.children.map(c => renderOutlineItem(c, statusIcon, depth + 1)).join('');
        return `
                    <div class="outline-item chapter" style="padding-left: ${indent}px;">
                        <div class="item-header"
                             role="button"
                             tabindex="0"
                             aria-expanded="true"
                             aria-label="Chapter: ${title}, ${words} words">
                            <span class="expand-icon">▼</span>
                            <span class="item-icon">📁</span>
                            <span class="item-title">${title}</span>
                            <span class="item-meta">${words} words</span>
                            <span class="status-badge ${statusClass}">${icon}</span>
                        </div>
                        <div class="chapter-children" role="group">${childrenHtml}</div>
                    </div>
                `;
    }
    return `
                    <div class="outline-item scene"
                         style="padding-left: ${indent}px;"
                         role="button"
                         tabindex="0"
                         data-path="${escapeHtml(item.filePath ?? '')}"
                         aria-label="Scene: ${title}, ${words} words">
                        <span class="item-icon">📄</span>
                        <span class="item-title">${title}</span>
                        <span class="item-meta">${words}</span>
                        <span class="status-badge ${statusClass}">${icon}</span>
                    </div>
                `;
}
