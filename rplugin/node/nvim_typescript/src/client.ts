import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { EOL, platform } from 'os';
import { normalize } from 'path';
import { createInterface } from 'readline';
import protocol from 'typescript/lib/protocol';
import { trim } from './utils';

export class Client extends EventEmitter {
  public serverHandle: ChildProcess = null;
  public _rl: any;
  public _seqNumber = 0;
  public _seqToPromises = {};
  public _cwd = process.cwd();
  public _env = process.env;
  public serverPath = 'tsserver';
  public serverOptions: string[] = [];
  public logFunc: Function = null;
  public completionCommand = 'completionInfo';
  public tsConfigVersion: {
    major: number;
    minor: number;
    patch: number;
  } = null;
  private getErrRes = [];
  // Get server, set server
  getServerPath() {
    return this.serverPath;
  }
  setServerPath(val: string) {
    const normalizedPath = normalize(val);
    if (existsSync(normalizedPath)) {
      this.serverPath = normalizedPath;
    }
  }

  // Start the Proc
  startServer(): Promise<void> {
    return new Promise((res) => {
      // _env['TSS_LOG'] = "-logToFile true -file ./server.log"
      let args = [...this.serverOptions, '--disableAutomaticTypingAcquisition']
      let options: SpawnOptions = {
        stdio: 'pipe',
        cwd: this._cwd,
        env: this._env,
        detached: true,
        shell: false
      }
      let cmd = this.serverPath;
      if (platform() === 'win32') {
        // detached must be false for windows to avoid child window
        // https://nodejs.org/api/child_process.html#child_process_options_detached
        options.detached = false;
        args = ['/c', this.serverPath, ...args];
        cmd = 'cmd';
      }

      this.serverHandle = spawn(cmd, args, options);

      this._rl = createInterface({
        input: this.serverHandle.stdout,
        output: this.serverHandle.stdin,
        terminal: false
      });

      this.serverHandle.stderr.on('data', (_data: string, _err: any) => {
        // console.error('Error from tss: ' + data);
      });

      this.serverHandle.on('error', _data => {
        // console.log(`ERROR Event: ${data}`);
      });

      this.serverHandle.on('exit', _data => {
        // console.log(`exit Event: ${data}`);
      });

      this.serverHandle.on('close', _data => {
        // console.log(`Close Event: ${data}`);
      });

      this._rl.on('line', (msg: string) => {
        if (msg.indexOf('{') === 0) {
          this.parseResponse(msg);
        }
      });
      return res();

    })

  }
  stopServer() {
    this.serverHandle.kill('SIGINT');
    this.serverHandle = null
  }
  setTSConfigVersion() {
    const command = this.serverPath.replace('tsserver', 'tsc');
    const rawOutput = execSync(`${command} --version`).toString();
    const [major, minor, patch] = trim(rawOutput)
      .split(' ')
      .pop()
      .split('-')[0]
      .split('.');
    this.tsConfigVersion = {
      major: parseInt(major),
      minor: parseInt(minor),
      patch: parseInt(patch)
    };

    this.completionCommand = this.isCurrentVersionHighter(300) ? 'completionInfo' : 'completions';

  }
  isCurrentVersionHighter(val: number) {
    const local =
      this.tsConfigVersion.major * 100 +
      this.tsConfigVersion.minor * 10 +
      this.tsConfigVersion.patch;
    return local >= val;
  }

  // LangServer Commands
  openFile(args: protocol.OpenRequestArgs) { this._makeNoResponseRequest('open', args); }
  closeFile(args: protocol.FileRequestArgs) { this._makeNoResponseRequest('close', args); }
  reloadProject() { this._makeNoResponseRequest('reloadProjects', null); }

  updateFile(args: protocol.ReloadRequestArgs): Promise<protocol.ReloadResponse> { return this._makeTssRequest('reload', args); }
  quickInfo(args: protocol.FileLocationRequestArgs): Promise<protocol.QuickInfoResponseBody> { return this._makeTssRequest('quickinfo', args); }
  getDef(args: protocol.FileLocationRequestArgs): Promise<protocol.DefinitionResponse['body']> { return this._makeTssRequest('definition', args); }
  getCompletions(args: protocol.CompletionsRequestArgs): Promise<protocol.CompletionInfoResponse['body']> { return this._makeTssRequest(this.completionCommand, args); }
  getCompletionDetails(args: protocol.CompletionDetailsRequestArgs): Promise<protocol.CompletionDetailsResponse['body']> { return this._makeTssRequest('completionEntryDetails', args); }
  getProjectInfo(args: protocol.ProjectInfoRequestArgs): Promise<protocol.ProjectInfo> { return this._makeTssRequest('projectInfo', args); }
  getSymbolRefs(args: protocol.FileLocationRequestArgs): Promise<protocol.ReferencesResponse['body']> { return this._makeTssRequest('references', args); }
  getSignature(args: protocol.FileLocationRequestArgs): Promise<protocol.SignatureHelpResponse['body']> { return this._makeTssRequest('signatureHelp', args); }
  renameSymbol(args: protocol.RenameRequestArgs): Promise<protocol.RenameResponseBody> { return this._makeTssRequest('rename', args); }
  getTypeDef(args: protocol.FileLocationRequestArgs): Promise<protocol.TypeDefinitionResponse['body']> { return this._makeTssRequest('typeDefinition', args); }
  getDocumentSymbols(args: protocol.FileRequestArgs): Promise<protocol.NavTreeResponse['body']> { return this._makeTssRequest('navtree', args); }
  getWorkspaceSymbols(args: protocol.NavtoRequestArgs): Promise<protocol.NavtoResponse['body']> { return this._makeTssRequest('navto', args); }
  getSemanticDiagnosticsSync(args: protocol.SemanticDiagnosticsSyncRequestArgs): Promise<protocol.Diagnostic[]> { return this._makeTssRequest('semanticDiagnosticsSync', args); }
  getSyntacticDiagnosticsSync(args: protocol.SyntacticDiagnosticsSyncRequestArgs): Promise<protocol.Diagnostic[]> { return this._makeTssRequest('syntacticDiagnosticsSync', args); }
  getSuggestionDiagnosticsSync(args: protocol.SuggestionDiagnosticsSyncRequestArgs): Promise<protocol.Diagnostic[]> { return this._makeTssRequest('suggestionDiagnosticsSync', args); }
  getCodeFixes(args: protocol.CodeFixRequestArgs): Promise<protocol.GetCodeFixesResponse['body']> { return this._makeTssRequest('getCodeFixes', args); }
  getApplicableRefactors(args: protocol.GetApplicableRefactorsRequestArgs): Promise<protocol.GetApplicableRefactorsResponse['body']> { return this._makeTssRequest('getApplicableRefactors', args); }
  getSupportedCodeFixes(): Promise<protocol.GetSupportedCodeFixesResponse['body']> { return this._makeTssRequest('getSupportedCodeFixes', null); }
  getCombinedCodeFix(args: protocol.GetCombinedCodeFixRequestArgs): Promise<protocol.GetCombinedCodeFixResponse['body']> { return this._makeTssRequest('getCombinedCodeFix', args); }
  getOrganizedImports(args: protocol.OrganizeImportsRequestArgs): Promise<protocol.OrganizeImportsResponse['body']> { return this._makeTssRequest('organizeImports', args); }
  getProjectError(args: protocol.GeterrForProjectRequestArgs): void { this._makeTssRequest('geterrForProject', args) }
  getEditsForFileRename(args: protocol.GetEditsForFileRenameRequestArgs): Promise<protocol.GetEditsForFileRenameResponse['body']> { return this._makeTssRequest('getEditsForFileRename', args) }

  // Server communication
  _makeTssRequest<T>(commandName: string, args?: any): Promise<T> {
    const seq = this._seqNumber++;
    const payload = {
      seq,
      type: 'request',
      arguments: args,
      command: commandName
    };
    const ret = this.createDeferredPromise();
    this._seqToPromises[seq] = ret;
    this.serverHandle.stdin.write(JSON.stringify(payload) + EOL);
    return ret.promise;
  }
  _makeNoResponseRequest(commandName?: string, args?: any) {
    const seq = this._seqNumber++;
    const payload = {
      seq,
      type: 'request',
      arguments: args
    };
    if (commandName) {
      payload['command'] = commandName;
    }
    this.serverHandle.stdin.write(JSON.stringify(payload) + EOL);
  }
  parseResponse(returnedData: string): void {
    const response = JSON.parse(returnedData);
    // console.warn(returnedData)
    const seq = response.request_seq;
    const success = response.success;
    if (typeof seq === 'number') {
      if (success) {
        // console.warn(JSON.stringify(response))
        this._seqToPromises[seq].resolve(response.body);
      } else {
        this._seqToPromises[seq].reject(response.message);
      }
    } else {
      // If a sequence wasn't specified, it might be a call that returns multiple results
      // Like 'geterr' - returns both semanticDiag and syntaxDiag
      if (response.type && response.type === 'event') {
        if (response.event && response.event === 'telemetry') {
        }
        if (response.event && response.event === 'projectsUpdatedInBackground') {
          // console.warn('projectsUpdatedInBackground: ', JSON.stringify(response.body))
        }
        if (response.event && response.event === 'projectLoadingFinish') {
          this.emit('projectLoadingFinish')
        }
        if (response.event && (response.event === 'semanticDiag' || response.event === 'syntaxDiag' || response.event === 'suggestionDiag')) {
          this.getErrRes.push(response.body);
        }
        if (response.event && response.event === 'requestCompleted') {
          this.getErrCompleted()
        }
      }
    }
  }
  getErrCompleted() {
    this.emit('getErrCompleted', this.getErrRes)
    this.getErrRes = [];
  }
  createDeferredPromise(): any {
    let resolve: Function;
    let reject: Function;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      resolve,
      reject,
      promise
    };
  }
}

export const TSServer = new Client();
