import { EOL } from 'os';
import { Breakpoint, DebugSession, ExtensionContext, Location, SourceBreakpoint, commands, debug, extensions, window, workspace } from 'vscode';

export async function activate(context: ExtensionContext) {
    let disposables = [
        commands.registerCommand('vscode-dap-inspector.sendDAPRequest', async () => {
            const session = debug.activeDebugSession;
            if (!session) {
                window.showErrorMessage("There's no active debug session.");
                return;
            }

            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }

            const bodyJSON = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
            const body = tryParseJSON(bodyJSON);

            if (!isDAPRequest(body)) {
                window.showErrorMessage(`Invalid DAP request. It should be of type: { command: string; args?: any }`);
                return;
            }
            let resolve: (value: unknown) => void;
            let resp = new Promise(res => {
                resolve = res;
            });
            try {
                session.customRequest(body.command, body.args).then(value => {
                    resolve(value);
                }, reason => {
                    resolve(reason);
                });
            } catch (e) {
                resolve!(e);
            }
            const content = [`//${body.command}`,JSON.stringify(await resp, undefined, 2)].join(EOL);
            await window.showTextDocument(
                await workspace.openTextDocument({ content, language: 'jsonc' }),
            );
        }),
        debug.onDidReceiveDebugSessionCustomEvent(e => {
            console.log(e);
        }),
    ];
    context.subscriptions.push(...disposables);
}

export function deactivate() { }

interface DAPRequest {
    command: string;
    args?: any;
}

function isDAPRequest(x: unknown): x is DAPRequest {
    if (!x || typeof x !== 'object') {
        return false;
    }
    const keys = Object.keys(x);
    return 'command' in x && typeof x.command === 'string'
        && (keys.length === 1 || keys.length === 2 && 'args' in x);
}

/**
 * Tries parsing a JSON string.
 * @returns `undefined` if the given string is not a valid JSON.
 */
function tryParseJSON(s: string) {
    try {
        return JSON.parse(s);
    } catch {
        return undefined;
    }
}
