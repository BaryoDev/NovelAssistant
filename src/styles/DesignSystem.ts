/**
 * DesignSystem - Centralized CSS variable system for consistent theming
 *
 * Provides theme-adaptive CSS variables, animations, typography, and utility classes
 * that work across all webview panels in the extension.
 */
export class DesignSystem {
    /**
     * Core theme variables that adapt to VS Code's current theme
     */
    static getThemeVariables(): string {
        return `
        :root {
            /* Semantic Colors - Light/Dark adaptive */
            --color-primary: var(--vscode-textLink-foreground, #569cd6);
            --color-primary-hover: var(--vscode-textLink-activeForeground, #4080d0);
            --color-secondary: var(--vscode-symbolIcon-classForeground, #4ec9b0);
            --color-accent: var(--vscode-symbolIcon-stringForeground, #ce9178);
            --color-success: var(--vscode-testing-iconPassed, #34a853);
            --color-warning: var(--vscode-editorWarning-foreground, #fbbc04);
            --color-error: var(--vscode-editorError-foreground, #d93025);

            /* Status Colors - Semi-transparent backgrounds */
            --status-complete-bg: color-mix(in srgb, var(--color-success) 15%, transparent);
            --status-complete-text: var(--color-success);
            --status-revision-bg: color-mix(in srgb, var(--color-warning) 15%, transparent);
            --status-revision-text: var(--color-warning);
            --status-draft-bg: color-mix(in srgb, var(--color-primary) 15%, transparent);
            --status-draft-text: var(--color-primary);

            /* Background Colors */
            --bg-primary: var(--vscode-editor-background, #1e1e1e);
            --bg-secondary: var(--vscode-editorWidget-background, #252526);
            --bg-tertiary: var(--vscode-sideBar-background, #252526);
            --bg-hover: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.1));
            --bg-active: var(--vscode-list-activeSelectionBackground, rgba(255, 255, 255, 0.15));

            /* Text Colors */
            --text-primary: var(--vscode-editor-foreground, #d4d4d4);
            --text-secondary: var(--vscode-descriptionForeground, #888);
            --text-muted: var(--vscode-disabledForeground, #656565);

            /* Border Colors */
            --border-primary: var(--vscode-widget-border, #333);
            --border-focus: var(--vscode-focusBorder, #007acc);

            /* Gradients */
            --gradient-primary: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            --gradient-accent: linear-gradient(135deg, var(--color-accent), var(--color-error));
            --gradient-success: linear-gradient(90deg, var(--color-success), var(--color-secondary));

            /* Spacing Scale */
            --space-xs: 4px;
            --space-sm: 8px;
            --space-md: 12px;
            --space-lg: 16px;
            --space-xl: 24px;
            --space-2xl: 32px;

            /* Border Radius */
            --radius-sm: 4px;
            --radius-md: 6px;
            --radius-lg: 8px;
            --radius-xl: 12px;
            --radius-full: 9999px;

            /* Shadows */
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);

            /* Animation Timings */
            --duration-fast: 150ms;
            --duration-normal: 250ms;
            --duration-slow: 350ms;
            --easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
            --easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
            --easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);
        }
        `;
    }

    /**
     * Typography system with standardized font scale
     */
    static getTypography(): string {
        return `
        /* Typography System */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            font-size: 13px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Heading Scale */
        .text-h1 {
            font-size: 24px;
            font-weight: 600;
            line-height: 1.3;
            letter-spacing: -0.01em;
        }

        .text-h2 {
            font-size: 18px;
            font-weight: 600;
            line-height: 1.4;
        }

        .text-h3 {
            font-size: 16px;
            font-weight: 600;
            line-height: 1.4;
        }

        /* Body Text */
        .text-body {
            font-size: 13px;
            line-height: 1.5;
        }

        .text-small {
            font-size: 11px;
            line-height: 1.4;
        }

        .text-tiny {
            font-size: 10px;
            line-height: 1.3;
        }

        /* Weight Utilities */
        .font-normal { font-weight: 400; }
        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }

        /* Text Colors */
        .text-primary-color { color: var(--text-primary); }
        .text-secondary-color { color: var(--text-secondary); }
        .text-muted-color { color: var(--text-muted); }

        /* Letter Spacing */
        .tracking-tight { letter-spacing: -0.01em; }
        .tracking-normal { letter-spacing: 0; }
        .tracking-wide { letter-spacing: 0.025em; }
        .tracking-wider { letter-spacing: 0.05em; }
        `;
    }

    /**
     * Animation keyframes and utility classes
     */
    static getAnimations(): string {
        return `
        /* Animation Keyframes */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        /* Animation Utilities */
        .animate-fade-in {
            animation: fadeIn var(--duration-normal) var(--easing-standard);
        }

        .animate-slide-down {
            animation: slideDown var(--duration-normal) var(--easing-decelerate);
        }

        .animate-slide-up {
            animation: slideUp var(--duration-normal) var(--easing-decelerate);
        }

        .animate-scale-in {
            animation: scaleIn var(--duration-normal) var(--easing-decelerate);
        }

        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-spin {
            animation: spin 1s linear infinite;
        }

        /* Transition Utilities */
        .transition-all {
            transition: all var(--duration-normal) var(--easing-standard);
        }

        .transition-colors {
            transition: background-color var(--duration-fast) var(--easing-standard),
                        color var(--duration-fast) var(--easing-standard),
                        border-color var(--duration-fast) var(--easing-standard);
        }

        .transition-transform {
            transition: transform var(--duration-normal) var(--easing-standard);
        }

        .transition-opacity {
            transition: opacity var(--duration-fast) var(--easing-standard);
        }

        /* Hover Effects */
        .hover-lift {
            transition: transform var(--duration-normal) var(--easing-standard),
                        box-shadow var(--duration-normal) var(--easing-standard);
        }

        .hover-lift:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        .hover-scale {
            transition: transform var(--duration-fast) var(--easing-standard);
        }

        .hover-scale:hover {
            transform: scale(1.05);
        }

        .hover-brightness {
            transition: filter var(--duration-fast) var(--easing-standard);
        }

        .hover-brightness:hover {
            filter: brightness(1.1);
        }

        /* Loading States */
        .loading {
            position: relative;
            pointer-events: none;
            opacity: 0.6;
        }

        .loading::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            margin: -10px 0 0 -10px;
            border: 2px solid var(--color-primary);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        `;
    }

    /**
     * Reusable utility classes for common UI patterns
     */
    static getUtilities(): string {
        return `
        /* Utility Classes */
        .card {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            padding: var(--space-lg);
        }

        .card-hover {
            background: var(--bg-secondary);
            border-radius: var(--radius-lg);
            padding: var(--space-lg);
            transition: all var(--duration-normal) var(--easing-standard);
            cursor: pointer;
        }

        .card-hover:hover {
            background: var(--bg-hover);
            transform: translateY(-2px);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 2px var(--space-sm);
            border-radius: var(--radius-sm);
            font-size: 10px;
            font-weight: 500;
            letter-spacing: 0.025em;
            text-transform: uppercase;
        }

        .badge-success {
            background: var(--status-complete-bg);
            color: var(--status-complete-text);
        }

        .badge-warning {
            background: var(--status-revision-bg);
            color: var(--status-revision-text);
        }

        .badge-primary {
            background: var(--status-draft-bg);
            color: var(--status-draft-text);
        }

        /* Focus Styles */
        .focus-ring:focus {
            outline: 2px solid var(--border-focus);
            outline-offset: 2px;
        }

        /* Progress Bar */
        .progress-bar {
            height: 8px;
            background: var(--border-primary);
            border-radius: var(--radius-sm);
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            border-radius: var(--radius-sm);
            transition: width var(--duration-slow) var(--easing-decelerate);
        }
        `;
    }

    /**
     * Get the complete stylesheet combining all sections
     */
    static getCompleteStylesheet(): string {
        return `
        ${this.getThemeVariables()}
        ${this.getTypography()}
        ${this.getAnimations()}
        ${this.getUtilities()}
        `;
    }
}
