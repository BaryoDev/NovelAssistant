import * as assert from 'assert';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildGitShowArgs, escapeHtml, isInsideDir, isSafeGitRef } from '../util/security';
import { renderCharacterCard, renderOutlineItem, renderPassiveVoice, renderTopWordRows } from '../util/render';

const hostileNames = ['a$(touch PWNED).md', 'a`touch PWNED`.md', 'a;touch PWNED.md', "a'b\".md"];

describe('git show arguments', () => {
    it('keeps a hostile file name as a single argument', () => {
        for (const name of hostileNames) {
            assert.deepStrictEqual(buildGitShowArgs('HEAD', name), ['show', `HEAD:./${name}`]);
        }
    });

    it('rejects unsafe refs', () => {
        for (const ref of ['', '--output=x', '-x', 'HEAD; touch x', '$(id)', 'a b', 'a..b', 'x`y`']) {
            assert.strictEqual(isSafeGitRef(ref), false, ref);
            assert.throws(() => buildGitShowArgs(ref, 'a.md'));
        }
        for (const ref of ['HEAD', 'HEAD~1', 'origin/main', 'v1.2.3', 'abc123']) {
            assert.strictEqual(isSafeGitRef(ref), true, ref);
        }
    });

    it('does not run a command from a file name when passed to git via execFile', (done) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-git-'));
        const name = 'a$(touch PWNED).md';
        fs.writeFileSync(path.join(dir, name), 'hello');
        const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
        cp.execFileSync('git', ['init', '-q'], { cwd: dir });
        cp.execFileSync('git', ['add', '-A'], { cwd: dir });
        cp.execFileSync('git', ['commit', '-q', '-m', 'x'], { cwd: dir, env });
        cp.execFile('git', buildGitShowArgs('HEAD', name), { cwd: dir }, (err, stdout) => {
            try {
                assert.ifError(err);
                assert.strictEqual(stdout, 'hello');
                assert.strictEqual(fs.existsSync(path.join(dir, 'PWNED')), false);
                done();
            } catch (e) {
                done(e);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });
});

describe('isInsideDir', () => {
    const root = path.resolve('/work/Manuscript');
    it('accepts paths inside the root', () => {
        assert.strictEqual(isInsideDir(root, path.join(root, 'ch1', 'a.md')), true);
        assert.strictEqual(isInsideDir(root, root), true);
    });
    it('rejects paths outside, relative paths and non-strings', () => {
        assert.strictEqual(isInsideDir(root, path.resolve('/etc/passwd')), false);
        assert.strictEqual(isInsideDir(root, path.join(root, '..', 'x.md')), false);
        assert.strictEqual(isInsideDir(root, path.resolve('/work/Manuscript-evil/a.md')), false);
        assert.strictEqual(isInsideDir(root, 'ch1/a.md'), false);
        assert.strictEqual(isInsideDir(root, undefined), false);
        assert.strictEqual(isInsideDir(root, { a: 1 }), false);
    });
});

describe('webview HTML escaping', () => {
    it('escapeHtml neutralises markup and quotes', () => {
        assert.strictEqual(escapeHtml('<img src=x onerror="a">\'&'), '&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;');
    });

    it('character card has no raw tag from a hostile name, role or path', () => {
        const html = renderCharacterCard({ name: 'a"><img onerror=x>', role: '<img src=x onerror=y>', filePath: "/w/x');alert(1);('.md" });
        assert.ok(!html.includes('<img'), html);
        assert.ok(!html.includes('onclick'), html);
        assert.ok(html.includes('data-path="/w/x&#39;);alert(1);(&#39;.md"'), html);
    });

    it('outline items escape titles and paths and use no inline handlers', () => {
        const scene = { title: '<script>x</script>', type: 'scene' as const, filePath: "/w/'\"><b>.md", children: [], wordCount: 3, status: 'draft' };
        const chapter = { title: '<i>c</i>', type: 'chapter' as const, filePath: '/w/c', children: [scene], wordCount: 3, status: 'draft' };
        const html = renderOutlineItem(chapter, () => '<b>');
        assert.ok(!/<script|<i>|<b>/.test(html), html);
        assert.ok(!html.includes('onclick'), html);
    });

    it('analysis rows escape manuscript text', () => {
        assert.ok(!renderPassiveVoice(['was opened <img src=x onerror=y>']).includes('<img'));
        assert.ok(!renderTopWordRows([{ word: '<b>', count: 1, percentage: 1 }]).includes('<b>'));
    });
});
