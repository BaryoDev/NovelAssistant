# Change Log

All notable changes to the "Novel Assistant" extension will be documented in this file.

Source code: https://github.com/BaryoDev/NovelAssistant

## [0.1.0] - 2025-01-20

### New Features

#### Editor Enhancements
- **Multiple Themes**: Light, Dark, Sepia, and High Contrast themes (+ auto mode that follows VS Code)
- **Typewriter Mode**: Keeps cursor vertically centered while typing (`Cmd/Ctrl+Shift+T`)
- **Focus Mode**: Dims non-active paragraphs for distraction-free writing (`Cmd/Ctrl+Alt+F`)
- **Font Customization**: Configurable font family, size, line height, and max content width
- **Toolbar Toggle**: Option to hide/show the formatting toolbar

#### Writing Tools
- **Writing Sprints**: Pomodoro-style timed writing sessions with word count tracking (`Cmd/Ctrl+Shift+S`)
- **Progress Dashboard**: Visual tracking of daily/project goals, writing streaks, and weekly statistics
- **Writing Analysis**: Detects overused words, passive voice, adverb usage, and calculates readability scores
- **Auto-Backup**: Automatic Git commits at configurable intervals with meaningful commit messages

#### Project Management
- **Outline View**: Visual manuscript structure with chapter/scene hierarchy and status indicators (draft/revision/complete)
- **Character Panel**: Quick-access sidebar for managing character profiles
- **Project Search**: Full-text search and replace across all manuscript files (`Cmd/Ctrl+Shift+H`)
- **New Chapter/Scene Commands**: Quick creation with templates (`Cmd/Ctrl+Shift+N` for new scene)

#### Export Options
- **PDF Export**: Export manuscript with customizable formatting
- **DOCX Export**: Microsoft Word compatible output
- **EPUB Export**: E-book format for digital readers
- **Markdown Export**: Combined markdown file

#### Tree View Improvements
- Word count displayed for each chapter and scene
- Scene count per chapter
- Custom icons (folder-library for chapters, file-text for scenes)
- Improved tooltips with reading time estimates
- Sorted display (directories first, then files alphabetically)

### Robustness Improvements
- **GitService**: Replaced shell commands with `simple-git` library for better cross-platform support
- **Silent Error Handling**: All operations fail silently without intrusive error messages
- **Improved Word Counter**: Proper word segmentation with markdown stripping
- **File Watcher**: Auto-refresh views on external file changes
- **Bundled Assets**: EasyMDE bundled locally for offline support

### Configuration Options
New settings available via VS Code settings (`novel-assistant.*`):
- `editor.theme`: Editor color theme (auto/light/dark/sepia/highContrast)
- `editor.fontSize`: Font size in pixels (12-32)
- `editor.fontFamily`: Font family (Merriweather, Lora, Source Serif Pro, PT Serif, Georgia)
- `editor.lineHeight`: Line height multiplier (1.2-3.0)
- `editor.maxWidth`: Maximum content width (400-1200px)
- `editor.typewriterMode`: Enable typewriter scrolling
- `editor.focusMode`: Enable focus mode
- `editor.showToolbar`: Show/hide formatting toolbar
- `dailyWordGoal`: Daily word count target
- `wordsPerMinute`: Reading speed for time estimates
- `sprintDuration`: Default sprint duration in minutes
- `autoBackup.enabled`: Enable/disable auto-backup
- `autoBackup.intervalMinutes`: Backup interval

### Keyboard Shortcuts
| Command | macOS | Windows/Linux |
|---------|-------|---------------|
| Start Writing Sprint | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| Toggle Typewriter Mode | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| Toggle Focus Mode | `Cmd+Alt+F` | `Ctrl+Alt+F` |
| Search in Project | `Cmd+Shift+H` | `Ctrl+Shift+H` |
| New Scene | `Cmd+Shift+N` | `Ctrl+Shift+N` |

### Bug Fixes
- Removed orphan `helloWorld` command
- Fixed dark mode detection in editor
- Improved document synchronization between editor and VS Code

---

## [0.0.1] - 2024-05-22
- Initial release
- Added WYSIWYG Editor with Merriweather font
- Added Project Structure (Manuscript, Characters, Locations, Research, Timeline, Notes)
- Added Word Counter
- Added Git Integration
