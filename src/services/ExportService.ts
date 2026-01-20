import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface ExportOptions {
    title?: string;
    author?: string;
    includeTableOfContents?: boolean;
    fontSize?: number;
    lineSpacing?: number;
}

export class ExportService {
    private rootPath: string | undefined;

    constructor() {
        this.rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    public async exportToPDF(files: string[], outputPath: string, options: ExportOptions = {}): Promise<boolean> {
        try {
            const content = await this.gatherContent(files);
            // Dynamic require for pdfkit to avoid module issues
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 72, bottom: 72, left: 72, right: 72 },
            });

            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Title page
            if (options.title) {
                doc.fontSize(28).font('Helvetica-Bold').text(options.title, { align: 'center' });
                doc.moveDown(2);
                if (options.author) {
                    doc.fontSize(16).font('Helvetica').text(`by ${options.author}`, { align: 'center' });
                }
                doc.addPage();
            }

            // Content
            const fontSize = options.fontSize || 12;
            const lineSpacing = options.lineSpacing || 1.5;

            for (const section of content) {
                if (section.isHeading) {
                    doc.fontSize(fontSize + 4).font('Helvetica-Bold').text(section.text);
                    doc.moveDown(0.5);
                } else {
                    doc.fontSize(fontSize).font('Helvetica').text(section.text, {
                        align: 'left',
                        lineGap: fontSize * (lineSpacing - 1),
                        paragraphGap: fontSize,
                    });
                }
            }

            doc.end();

            return new Promise((resolve) => {
                stream.on('finish', () => resolve(true));
                stream.on('error', () => resolve(false));
            });
        } catch {
            return false;
        }
    }

    public async exportToDOCX(files: string[], outputPath: string, options: ExportOptions = {}): Promise<boolean> {
        try {
            const content = await this.gatherContent(files);
            const children: Paragraph[] = [];

            // Title
            if (options.title) {
                children.push(
                    new Paragraph({
                        text: options.title,
                        heading: HeadingLevel.TITLE,
                        alignment: AlignmentType.CENTER,
                    })
                );

                if (options.author) {
                    children.push(
                        new Paragraph({
                            text: `by ${options.author}`,
                            alignment: AlignmentType.CENTER,
                        })
                    );
                }

                children.push(new Paragraph({ text: '' })); // Spacer
            }

            // Content
            for (const section of content) {
                if (section.isHeading) {
                    children.push(
                        new Paragraph({
                            text: section.text,
                            heading: HeadingLevel.HEADING_1,
                        })
                    );
                } else {
                    // Split into paragraphs
                    const paragraphs = section.text.split('\n\n');
                    for (const para of paragraphs) {
                        if (para.trim()) {
                            children.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: para.trim(),
                                            size: (options.fontSize || 12) * 2, // Half-points
                                        }),
                                    ],
                                    spacing: {
                                        line: (options.lineSpacing || 1.5) * 240,
                                    },
                                })
                            );
                        }
                    }
                }
            }

            const doc = new Document({
                sections: [{ children }],
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(outputPath, buffer);

            return true;
        } catch {
            return false;
        }
    }

    public async exportToEPUB(files: string[], outputPath: string, options: ExportOptions = {}): Promise<boolean> {
        try {
            // Dynamic require for epub-gen-memory
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const epubGen = require('epub-gen-memory').default;
            const content = await this.gatherContentForEpub(files);

            const epubOptions = {
                title: options.title || 'Untitled',
                author: options.author || 'Unknown',
                content: content.map(ch => ({
                    title: ch.title,
                    data: ch.content,
                })),
            };

            const epub = await epubGen(epubOptions, false);

            // Write the buffer to file
            if (epub) {
                fs.writeFileSync(outputPath, epub);
            }

            return true;
        } catch {
            return false;
        }
    }

    public async exportToMarkdown(files: string[], outputPath: string, options: ExportOptions = {}): Promise<boolean> {
        try {
            let markdown = '';

            if (options.title) {
                markdown += `# ${options.title}\n\n`;
                if (options.author) {
                    markdown += `*by ${options.author}*\n\n`;
                }
                markdown += '---\n\n';
            }

            for (const file of files) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf-8');
                    const fileName = path.basename(file, '.md');
                    markdown += `## ${fileName}\n\n`;
                    markdown += content + '\n\n';
                }
            }

            fs.writeFileSync(outputPath, markdown);
            return true;
        } catch {
            return false;
        }
    }

    private async gatherContent(files: string[]): Promise<Array<{ text: string; isHeading: boolean }>> {
        const result: Array<{ text: string; isHeading: boolean }> = [];

        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    const fileName = path.basename(file, '.md');
                    result.push({ text: fileName, isHeading: true });

                    const content = fs.readFileSync(file, 'utf-8');
                    const cleanContent = this.stripMarkdown(content);
                    result.push({ text: cleanContent, isHeading: false });
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return result;
    }

    private async gatherContentForEpub(files: string[]): Promise<Array<{ title: string; content: string }>> {
        const result: Array<{ title: string; content: string }> = [];

        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    const fileName = path.basename(file, '.md');
                    const content = fs.readFileSync(file, 'utf-8');
                    const htmlContent = this.markdownToHtml(content);
                    result.push({ title: fileName, content: htmlContent });
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return result;
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/^#{1,6}\s+/gm, '') // Headers
            .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
            .replace(/\*(.+?)\*/g, '$1') // Italic
            .replace(/_(.+?)_/g, '$1') // Italic
            .replace(/`(.+?)`/g, '$1') // Inline code
            .replace(/^\s*[-*+]\s+/gm, '') // Lists
            .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
            .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
            .replace(/!\[.*?\]\(.+?\)/g, '') // Images
            .replace(/^>\s+/gm, '') // Blockquotes
            .trim();
    }

    private markdownToHtml(text: string): string {
        return text
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    public async promptExport(): Promise<void> {
        if (!this.rootPath) {
            return;
        }

        const format = await vscode.window.showQuickPick(
            ['PDF', 'DOCX', 'EPUB', 'Markdown'],
            { placeHolder: 'Select export format' }
        );

        if (!format) {
            return;
        }

        const manuscriptPath = path.join(this.rootPath, 'Manuscript');
        const files = await this.getManuscriptFiles(manuscriptPath);

        if (files.length === 0) {
            vscode.window.showWarningMessage('No manuscript files found to export.');
            return;
        }

        const title = await vscode.window.showInputBox({
            prompt: 'Enter the title of your work',
            value: 'My Novel',
        });

        const author = await vscode.window.showInputBox({
            prompt: 'Enter the author name',
        });

        const extension = format.toLowerCase() === 'markdown' ? 'md' : format.toLowerCase();
        const defaultPath = path.join(this.rootPath, `export.${extension}`);

        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultPath),
            filters: {
                [format]: [extension],
            },
        });

        if (!outputUri) {
            return;
        }

        const options: ExportOptions = { title, author };
        let success = false;

        switch (format) {
            case 'PDF':
                success = await this.exportToPDF(files, outputUri.fsPath, options);
                break;
            case 'DOCX':
                success = await this.exportToDOCX(files, outputUri.fsPath, options);
                break;
            case 'EPUB':
                success = await this.exportToEPUB(files, outputUri.fsPath, options);
                break;
            case 'Markdown':
                success = await this.exportToMarkdown(files, outputUri.fsPath, options);
                break;
        }

        if (success) {
            const openFile = await vscode.window.showInformationMessage(
                `Successfully exported to ${format}!`,
                'Open File',
                'Open Folder'
            );

            if (openFile === 'Open File') {
                vscode.commands.executeCommand('vscode.open', outputUri);
            } else if (openFile === 'Open Folder') {
                vscode.commands.executeCommand('revealFileInOS', outputUri);
            }
        }
    }

    private async getManuscriptFiles(dir: string): Promise<string[]> {
        const files: string[] = [];

        try {
            if (!fs.existsSync(dir)) {
                return files;
            }

            const entries = fs.readdirSync(dir, { withFileTypes: true });

            // Sort entries: directories first, then files
            const sorted = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) { return -1; }
                if (!a.isDirectory() && b.isDirectory()) { return 1; }
                return a.name.localeCompare(b.name);
            });

            for (const entry of sorted) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await this.getManuscriptFiles(fullPath);
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

    public dispose(): void {
        // Cleanup if needed
    }
}
