import * as path from 'path';
import * as crypto from 'crypto';

export function escapeHtml(value: unknown): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getNonce(): string {
    return crypto.randomBytes(16).toString('hex');
}

/** True when target is root or inside it. Both must be absolute. */
export function isInsideDir(root: string, target: unknown): boolean {
    if (typeof target !== 'string' || !path.isAbsolute(target)) {
        return false;
    }
    const rel = path.relative(root, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/~^-]*$/;

export function isSafeGitRef(ref: unknown): ref is string {
    return typeof ref === 'string' && SAFE_REF.test(ref) && !ref.includes('..');
}

/** Argument array for `git show <ref>:./<fileName>`. Never joined into a shell string. */
export function buildGitShowArgs(ref: string, fileName: string): string[] {
    if (!isSafeGitRef(ref)) {
        throw new Error('Invalid git ref');
    }
    return ['show', `${ref}:./${fileName}`];
}
