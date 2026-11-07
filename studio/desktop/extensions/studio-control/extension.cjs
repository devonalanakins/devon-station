'use strict';
const { realpathSync } = require('node:fs');
const { runLocalVerify, listApprovedWorktrees } = require('./verification.cjs');

function activate(context) {
  const vscode = require('vscode');
  const output = vscode.window.createOutputChannel('DevonStation Verify — private');
  const mode = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  mode.text = '$(code) Studio / Focus';
  mode.tooltip = 'Switch between local Studio modes. No public activity reporting.';
  mode.command = 'devonstation.studio.orbit';
  mode.show();
  const verify = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  verify.text = '$(checklist) Verify Local';
  verify.tooltip = 'Run real focused local checks. Not CI or release verification.';
  verify.command = 'devonstation.studio.verify';
  verify.show();
  context.subscriptions.push(mode, verify, output);

  function contextRoot() {
    if (vscode.workspace.isTrusted !== true) throw new Error('Trust the Git workspace before running Studio commands');
    const root = process.env.DEVONSTATION_STUDIO_ROOT;
    const projectId = process.env.DEVONSTATION_STUDIO_PROJECT;
    if (!root || !projectId || !(vscode.workspace.workspaceFolders ?? []).some(folder =>
      folder.uri.scheme === 'file' && realpathSync(folder.uri.fsPath) === root)) {
      throw new Error('Studio workspace is not the explicitly approved local checkout');
    }
    return { workspaceRoot: root, projectId };
  }
  async function focus() {
    try {
      contextRoot();
      const available = new Set(await vscode.commands.getCommands(true));
      let applied = 0;
      for (const command of ['workbench.action.closeSidebar', 'workbench.action.closePanel',
        'workbench.action.focusActiveEditorGroup']) {
        if (available.has(command)) {
          await vscode.commands.executeCommand(command);
          applied++;
        }
      }
      if (!applied) {
        vscode.window.showWarningMessage('Focus layout commands are not supported by this IDE build');
        return;
      }
      mode.text = '$(code) Studio / Focus';
      await context.globalState.update('mode', 'focus');
    } catch (error) { vscode.window.showErrorMessage('Studio Focus: ' + error.message); }
  }
  async function orbit() {
    try {
      const ctx = contextRoot();
      const trees = await listApprovedWorktrees(ctx);
      if (!trees.length) { vscode.window.showInformationMessage('No approved Git worktrees available'); return; }
      const choice = await vscode.window.showQuickPick(
        trees.map(tree => ({
          label: tree.branch,
          description: tree.head.slice(0, 12),
          detail: tree.root,
          tree,
        })),
        { placeHolder: 'Actual approved Git worktrees — select one to copy its local path' }
      );
      if (choice) await vscode.env.clipboard.writeText(choice.tree.root);
      mode.text = '$(list-tree) Studio / Orbit';
      await context.globalState.update('mode', 'orbit');
    } catch (error) { vscode.window.showErrorMessage('Studio Orbit: ' + error.message); }
  }
  let running = false;
  async function verifyLocal() {
    if (running) { vscode.window.showWarningMessage('Studio verification already running'); return; }
    try {
      const ctx = contextRoot();
      running = true;
      verify.text = '$(sync~spin) Running local checks';
      output.clear();
      output.appendLine('Private local Studio verification — not GitHub CI and not a deployment check.');
      output.show(true);
      const receipt = await runLocalVerify({
        ...ctx, onOutput: (stream, value) => output.append(value),
      });
      await context.globalState.update('lastLocalVerify', receipt);
      verify.text = receipt.result === 'passed' ? '$(check) Local checks passed'
        : '$(error) Local checks ' + receipt.result;
      mode.text = '$(shield) Studio / Verify';
      await context.globalState.update('mode', 'verify');
      output.appendLine('\nObserved local result: ' + receipt.result);
      output.appendLine('Git head stable: ' + receipt.headUnchanged + '; tests: ' +
        receipt.steps.map(step => step.label + '=' + step.exitCode).join(', '));
      output.appendLine('This record does not prove CI success or production release.');
    } catch (error) {
      verify.text = '$(error) Local checks unavailable';
      output.appendLine('\nStudio Verify refused: ' + error.message);
      vscode.window.showErrorMessage('Studio Verify: ' + error.message);
    } finally { running = false; }
  }
  context.subscriptions.push(vscode.commands.registerCommand('devonstation.studio.focus', focus));
  context.subscriptions.push(vscode.commands.registerCommand('devonstation.studio.orbit', orbit));
  context.subscriptions.push(vscode.commands.registerCommand('devonstation.studio.verify', verifyLocal));
}
function deactivate() {}
module.exports = { activate, deactivate };
