/*
TODO: I'm pretty sure there's a package that contains all the lsp type definitions.
*/

export let messageId = 0;

/**
 * @param {string} method 
 * @returns 
 */
export function MAIN_constructMessageObject(method, params) {
    return {
        "method": method,
        "id": messageId++,
        "params": params
    };
}

/** 
 * @param {string} uri @param {string} languageId @param {number} version @param {string} text @returns
 */
export function MAIN_message_construct_textDocumentItem(uri, languageId, version, text) {
    /*interface TextDocumentItem {...}*/
    return {
        uri: uri,
        languageId: languageId,
        version: version,
        text: text,
    };
}

export function MAIN_message_construct_textDocumentIdentifier(documentUri) {
    /*interface TextDocumentIdentifier {...}*/
    return {
        uri: documentUri
    };
}

/**
 * @param {*} textDocumentIdentifier MAIN_message_construct_textDocumentIdentifier(...)
 */
export function MAIN_message_construct_didCloseTextDocumentNotification(textDocumentIdentifier) {
    return {
        method: 'textDocument/didClose',
        params: { textDocument: textDocumentIdentifier },
    }
}

export function MAIN_message_construct_didChangeTextDocumentNotification_Params(versionedTextDocumentIdentifier, textDocumentContentChangeEventArray) {
    /*interface DidCloseTextDocumentParams {...}*/
    return {
        textDocument: versionedTextDocumentIdentifier,
        contentChanges: textDocumentContentChangeEventArray,
    }
}

export function MAIN_message_construct_didChangeTextDocumentNotification(didChangeTextDocumentParams) {
    // TODO: Consider: TextDocumentChangeRegistrationOptions
    // -----------------------------------------------
    return {
        method: 'textDocument/didChange',
        params: didChangeTextDocumentParams,
    }
}

/**
 * 
 * @param {*} textDocumentItem MAIN_message_construct_textDocumentItem(...)
 */
export function MAIN_message_construct_didOpenTextDocumentNotification(textDocumentItem) {
    /* RELATED: interface DidOpenTextDocumentParams {...} */
    return {
        method: 'textDocument/didOpen',
        params: { textDocument: textDocumentItem },
    };
}

export function MAIN_message_construct_DocumentSymbolsRequest(textDocumentIdentifier) {
    return {
        id: messageId++,
        method: 'textDocument/documentSymbol',
        params: { textDocument: textDocumentIdentifier },
    };
}

export function MAIN_message_construct_GoToDefinitionRequest(textDocumentIdentifier, position) {
    return {
        id: messageId++,
        method: 'textDocument/definition',
        params: {
            textDocument: textDocumentIdentifier,
            position: position
        },
    };
}

export function MAIN_message_construct_HoverRequest(textDocumentIdentifier, position) {
/*
interface HoverParams {
    textDocument: string; // The text document's URI in string form
    position: { line: uinteger; character: uinteger; };
}
*/
    return {
        id: messageId++,
        method: 'textDocument/hover',
        params: {
            textDocument: textDocumentIdentifier,
            position: position
        },
    };
}

export function MAIN_message_construct_CompletionRequest(textDocumentIdentifier, position) {
    return {
        id: messageId++,
        method: 'textDocument/completion',
        params: {
            textDocument: textDocumentIdentifier,
            position: position
        },
    };
}

export function MAIN_message_construct_CompletionRequest_slice(textDocumentIdentifier, indexStart, indexEnd) {
    return {
        id: messageId++,
        method: 'textDocument/completion_slice',
        params: {
            textDocument: textDocumentIdentifier,
            indexStart: indexStart,
            indexEnd: indexEnd,
        },
    };
}

export function MAIN_message_construct_CustomFullFileLexRequest(textDocumentIdentifier) {
    return {
        id: messageId++,
        // TODO: What are the rules for creating custom methods in LSP?
        method: 'textDocument/CustomFullFileLexRequest',
        params: { textDocument: textDocumentIdentifier },
    };
}

export function MAIN_message_construct_versionedTextDocumentIdentifier(uri, version)  {
    /*interface VersionedTextDocumentIdentifier {...}*/
    return {
        uri: uri,
        version: version,
    };
}

export function MAIN_message_construct_position(line, character)  {
    /*interface Position {...}*/
    return {
        line: line,
        character: character,
    };
}

export function MAIN_message_construct_range(startPosition, endPosition)  {
    /*interface Range {...}*/
    return {
        start: startPosition,
        end: endPosition,
    }
}

export function MAIN_message_construct_textDocumentContentChangeEvent(range, text)  {
    /*export type TextDocumentContentChangeEvent = {...} | { text: string; };*/
    if (range) {
        return {
            range: range,
            text: text
        }
    }
    else {
        return {
            text: text
        };
    }
}

/**
 * TODO: This was fully commented out and I'm tired of scrolling past it so I'm moving it to the bottom
 */
export function MAIN_message_construct_clientCapabilities(rootPath) {

    /*interface ClientCapabilities {
        workspace?: { // * Workspace specific client capabilities.
            applyEdit?: boolean; // * The client supports applying batch edits * to the workspace by supporting the request * 'workspace/applyEdit'
            workspaceEdit?: WorkspaceEditClientCapabilities; // * Capabilities specific to `WorkspaceEdit`s
            didChangeConfiguration?: DidChangeConfigurationClientCapabilities; // * Capabilities specific to the `workspace/didChangeConfiguration` * notification.
            didChangeWatchedFiles?: DidChangeWatchedFilesClientCapabilities; // * Capabilities specific to the `workspace/didChangeWatchedFiles` * notification.
            symbol?: WorkspaceSymbolClientCapabilities; // * Capabilities specific to the `workspace/symbol` request.
            executeCommand?: ExecuteCommandClientCapabilities; // * Capabilities specific to the `workspace/executeCommand` request.
            workspaceFolders?: boolean; // * The client has support for workspace folders. * * @since 3.6.0
            configuration?: boolean; // * The client supports `workspace/configuration` requests. * * @since 3.6.0
            semanticTokens?: SemanticTokensWorkspaceClientCapabilities; // * Capabilities specific to the semantic token requests scoped to the * workspace. * * @since 3.16.0
            codeLens?: CodeLensWorkspaceClientCapabilities; // * Capabilities specific to the code lens requests scoped to the * workspace. * * @since 3.16.0
            
            fileOperations?: { // * The client has support for file requests/notifications. * * @since 3.16.0
                dynamicRegistration?: boolean; // * Whether the client supports dynamic registration for file * requests/notifications.
                didCreate?: boolean; // * The client has support for sending didCreateFiles notifications.
                willCreate?: boolean; // * The client has support for sending willCreateFiles requests.
                didRename?: boolean; // * The client has support for sending didRenameFiles notifications.
                willRename?: boolean; // * The client has support for sending willRenameFiles requests.
                didDelete?: boolean; // * The client has support for sending didDeleteFiles notifications.			
                willDelete?: boolean; // * The client has support for sending willDeleteFiles requests.
            };

            inlineValue?: InlineValueWorkspaceClientCapabilities; // * Client workspace capabilities specific to inline values. * * @since 3.17.0
            inlayHint?: InlayHintWorkspaceClientCapabilities; // * Client workspace capabilities specific to inlay hints. * * @since 3.17.0		
            diagnostics?: DiagnosticWorkspaceClientCapabilities; // * Client workspace capabilities specific to diagnostics. * * @since 3.17.0.
        };

        textDocument?: TextDocumentClientCapabilities; // * Text document specific client capabilities.
        notebookDocument?: NotebookDocumentClientCapabilities; // * Capabilities specific to the notebook document support. * * @since 3.17.0
        
        window?: { // * Window specific client capabilities.
            workDoneProgress?: boolean; // * It indicates whether the client supports server initiated * progress using the `window/workDoneProgress/create` request. * * The capability also controls Whether client supports handling * of progress notifications. If set servers are allowed to report a * `workDoneProgress` property in the request specific server * capabilities. * * @since 3.15.0
            showMessage?: ShowMessageRequestClientCapabilities; // * Capabilities specific to the showMessage request * * @since 3.16.0	
            showDocument?: ShowDocumentClientCapabilities; // * Client capabilities for the show document request. * * @since 3.16.0
        };
        
        general?: { // * General client capabilities. * * @since 3.16.0
            staleRequestSupport?: { // * Client capability that signals how the client * handles stale requests (e.g. a request * for which the client will not process the response * anymore since the information is outdated). * * @since 3.17.0
                cancel: boolean; // * The client will actively cancel the request.			
                retryOnContentModified: string[]; // * The list of requests for which the client * will retry the request if it receives a * response with error code `ContentModified``
            }

            regularExpressions?: RegularExpressionsClientCapabilities; // * Client capabilities specific to regular expressions. * * @since 3.16.0
            markdown?: MarkdownClientCapabilities; // * Client capabilities specific to the client's markdown parser. * * @since 3.16.0		
            positionEncodings?: PositionEncodingKind[]; // * The position encodings supported by the client. Client and server * have to agree on the same position encoding to ensure that offsets * (e.g. character position in a line) are interpreted the same on both * side. * * To keep the protocol backwards compatible the following applies: if * the value 'utf-16' is missing from the array of position encodings * servers can assume that the client supports UTF-16. UTF-16 is * therefore a mandatory encoding. * * If omitted it defaults to ['utf-16']. * * Implementation considerations: since the conversion from one encoding * into another requires the content of the file / line the conversion * is best done where the file is read which is usually on the server * side. * * @since 3.17.0
        };

        experimental?: LSPAny; // * Experimental client capabilities.
    }*/

    return {
            workspace: {
                //applyEdit: boolean,
                //workspaceEdit: WorkspaceEditClientCapabilities,
                //didChangeConfiguration: DidChangeConfigurationClientCapabilities,
                //didChangeWatchedFiles: DidChangeWatchedFilesClientCapabilities,
                //symbol: WorkspaceSymbolClientCapabilities,
                //executeCommand: ExecuteCommandClientCapabilities,
                //workspaceFolders: boolean,
                //configuration: boolean,
                //semanticTokens: SemanticTokensWorkspaceClientCapabilities,
                //codeLens: CodeLensWorkspaceClientCapabilities,
//
                //fileOperations: {
                //	dynamicRegistration: boolean,
                //	didCreate: boolean,
                //	willCreate: boolean,
                //	didRename: boolean,
                //	willRename: boolean,
                //	didDelete: boolean,
                //	willDelete: boolean,
                //}
//
                //inlineValue: InlineValueWorkspaceClientCapabilities,
                //inlayHint: InlayHintWorkspaceClientCapabilities,
                //diagnostics: DiagnosticWorkspaceClientCapabilities,
            }

            //textDocument: TextDocumentClientCapabilities,
            //notebookDocument: NotebookDocumentClientCapabilities,

            //window: {
            //	workDoneProgress: boolean,
            //	showMessage: ShowMessageRequestClientCapabilities,
            //	showDocument: ShowDocumentClientCapabilities,
            //}
            
            //general: {
            //	staleRequestSupport: {
            //		cancel: boolean,
            //		retryOnContentModified: string[],
            //	}
//
            //	regularExpressions: RegularExpressionsClientCapabilities,
            //	markdown: MarkdownClientCapabilities,
            //	positionEncodings: PositionEncodingKind[],
            //}

            //experimental: LSPAny,
        }
}

export function MAIN_message_construct_initializeParams(rootPath, workspaceDirectories) {

	if (workspaceDirectories) {
		rootPath = null;
	}

	/*
	export interface WorkspaceFolder {
		uri: URI; // The associated URI for this workspace folder.
		name: string; // The name of the workspace folder. Used to refer to this * workspace folder in the user interface.
	}
	*/

	let workspaceFolders = null;

	if (workspaceDirectories) {
		workspaceFolders = [];
		for (let i = 0; i < workspaceDirectories.length; i++) {
			let directory = workspaceDirectories[i];
			workspaceFolders.push({
				uri: directory.absolutePath,
				name: '' + directory.id, // id is of type Number
			});
		}
	}

	//rootPath = rootPath.replace(':', '%3A');

	/*processId: integer | null; // The process Id of the parent process that started the server. Is null if the process has not been started by another process. If the parent process is not alive then the server should exit (see exit notification) its process.
	clientInfo?: {...};
	locale?: string; // The locale the client is currently showing the user interface * in. This must not necessarily be the locale of the operating * system. * * Uses IETF language tags as the value's syntax * (See https://en.wikipedia.org/wiki/IETF_language_tag) * * @since 3.16.0
	rootPath?: string | null; // The rootPath of the workspace. Is null * if no folder is open. * * @deprecated in favour of `rootUri`.
	rootUri: DocumentUri | null; // The rootUri of the workspace. Is null if no * folder is open. If both `rootPath` and `rootUri` are set * `rootUri` wins. * * @deprecated in favour of `workspaceFolders`
	initializationOptions?: LSPAny; // User provided initialization options.
	capabilities: ClientCapabilities; // The capabilities provided by the client (editor or tool)
	trace?: TraceValue; // The initial trace setting. If omitted trace is disabled ('off').	
	workspaceFolders?: WorkspaceFolder[] | null; // The workspace folders configured in the client when the server starts. * This property is only available if the client supports workspace folders. * It can be `null` if the client supports workspace folders but none are * configured. * * @since 3.6.0*/

	return {
		processId: process.pid,
		clientInfo: {
			name: 'TextEditor123',
			version: '0.0.1',
		},
		//locale: ,//string,
		//rootPath: rootPath,//string | null,
		rootUri: rootPath,//DocumentUri | null, // DocumentUri is a string alias?
		//initializationOptions: ,//LSPAny,
		capabilities: MAIN_message_construct_clientCapabilities(),//ClientCapabilities,
		//trace: 'verbose',
		workspaceFolders: workspaceFolders//WorkspaceFolder[] | null,
	}
}
