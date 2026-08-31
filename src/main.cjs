
// I don't want to touch the originally scaffolded "if (require('electron-squirrel-startup'))" at the moment.
// thus this file is staying common js.

const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const fs = require('fs');
const AppDatabase = require('./Database/database').default;
const { spawn } = require('node:child_process');
const { URI } = require('vscode-uri');
const os = require('os');
const lspTypes = require('./lspTypes');

if (!app.isPackaged) {
	app.setPath('userData', path.join(app.getPath('appData'), 'my-app-Debug'));
}

let database;

/** openedDirectory | openedWorkspace; TODO: consider making single object with bool 'isWorkspace' */
let openedDirectory = null;
/** openedDirectory | openedWorkspace; TODO: consider making single object with bool 'isWorkspace'  */
let openedWorkspace = null;
let workspaceDirectories = null;

/** Relates to LSP, simple and naive implementation for "open text document" this tracks most recent */
let openedDocumentUri = null;
/**
 * @type {ChildProcessWithoutNullStreams}
 */
let languageServer;
let languageServerHandshakeSuccess = false;

/** You probably ought to do something more optimal than holding each chunk in memory until you get the entirety. */
let stdoutChunkObjects = [];
/** The first entry is partially unread so you at minimum will need to store the index that starts the unread content or some such index */
let stdoutChunkFirstEntryMetadata = { substringIndexStart: 0, contentLengthNumber: 0 };

let remainingStdoutFromPartiallyReadEvent = null;

// I probably need something like this eventually:
//let pendingRequests = [];

let mostRecentRequest = null;

/**
 * TODO: Is it problematic to bring mainWindow into this scope? It is created within `const createWindow`...
 * ...and until now has only been accessible from that arrow function.
 * ...
 * The change is desirable because upon a stdout event from an lsp,
 * the BrowserWindow needs to be accessible in order to send a message
 * from the main-process to the renderer-process in this scenario.
 * ...
 * I specifically put the assignment that brings a reference to mainWindow into this scope
 * as the final line within `const createWindow`.
 * ...
 * It is expected that if an issue were possible, that electron's "initialization code"
 * can run in its entirety prior to this reference being exposed in the global scope.
 * 
 * @type {BrowserWindow}
 */
let mainWindowCapture = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	app.quit();
}

/**
 * @param {*} absolutePath 
 * @returns {boolean} to indicate whether the invoker is permitted to continue execution with the given absolutePath
 */
function isValidAbsolutePath(absolutePath) {
    // The provided absolute file path is validated.
    // If the absolute file path is NOT recognized, then an empty enumeration is returned.
    if (absolutePath !== openedDirectory && !database.contains(absolutePath)) return false;

	return true;
}

const createWindow = () => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: true, // this might already be the default value
			preload: path.join(__dirname, 'preload.js'),
		},
		autoHideMenuBar: true,
	});

	// and load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'index.html'));

	mainWindow.isMenuBarVisible(false);

	// Handle the request from the renderer process
	ipcMain.handle('choose-directory', chooseDirectory);
	ipcMain.handle('choose-workspace', chooseWorkspace);
	ipcMain.handle('did-change-text-document-notification', didChangeTextDocumentNotification);
	ipcMain.handle('get-filesystem-entries', getFilesystemEntries);
	ipcMain.handle('get-filesystem-entry-by-id', getFilesystemEntryById);
	ipcMain.handle('get-filesystem-entry-by-id-array', getFilesystemEntryById_ARRAY);
	ipcMain.handle('read-all-text', readAllText);
	ipcMain.handle('editor-read-all-text', editorReadAllText);
	ipcMain.handle('editor-document-symbols-request', editorDocumentSymbolsRequest);
	ipcMain.handle('editor-go-to-definition-request', editorGoToDefinitionRequest);
	ipcMain.handle('editor-hover-request', editorHoverRequest);
	ipcMain.handle('editor-completion-request', editorCompletionRequest);
	// I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
	ipcMain.handle('editor-completion-request-slice', editorCompletionRequest_slice);
	ipcMain.handle('set-clipboard', setClipboard);
	ipcMain.handle('editor-set-clipboard', editorSetClipboard);
	ipcMain.handle('read-clipboard', readClipboard);
	ipcMain.handle('find-all', findAll);
	ipcMain.handle('find-all-getPositions', findAllGetPositions);
	ipcMain.handle('new-file', newFile);
	ipcMain.handle('delete-file', deleteFile);
	ipcMain.handle('rename-file', renameFile);
	ipcMain.handle('save-file', saveFile);
	ipcMain.handle('editor-save-file', editorSaveFile);
	ipcMain.handle('copy-clipboard-absolute-path-to-directory', copyClipboardAbsolutePathToDirectory);

	mainWindowCapture = mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	database = new AppDatabase();
	createWindow();

	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (languageServer) {
		languageServer.kill();
	}
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

/**
 * TODO: Store the path more optimally to avoid doing this each time?
 * TODO: capital 'c' or lowercase, encoded ':' and etc... or not?
 */
function formatAbsolutePath(absolutePath) {
	return 'file:///' + absolutePath.replaceAll('\\', '/');
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function MAIN_encodeMessageObject(messageObject) {
	let content = JSON.stringify(messageObject);
	let spacing = '\r\n\r\n';
	return `Content-Length: ${content.length}${spacing}${content}\n`;
}

/**
 * @param {string} json 
 * @returns {object | null}
 * 
 * // So the seemingly non-deterministic nature of what gets read from stdout is something to note.
 * 
 * // TODO: Preferably neither of these would allocate a "substring" But they both will for the time being because I'm using JSON.parse and at the moment I know not of any other way than providing this a string.
 * // TODO: Don't toString() this, work with the bytes directly until the end (does JSON.parse take bytes as input? If so never have to do a toString()?).
 * // TODO: You could determine the necessary length of the NEXT chunk that will cause the necessary length requirement to be met then avoid an 'n complexity' and just have 'constant'.
 * // TODO: Further commenting about determining the necessary length of the NEXT chunk, that is what the original 'if' block is doing on the first message. Perhaps these two conditional branches are equivalent when following a "necessary length" implementation.
 * // TODO: Don't return here, the header/content separating token is likely in the next to come chunk... TODO: look at all the return statements not just this one
 * // TODO: Don't create strings for JSON.parse, is there an API that would stream spans of the strings rather than allocating a string to represent the 'content itself'?
*/
function MAIN_decodeMessage(jsonBytes) {
	let json;

	if (remainingStdoutFromPartiallyReadEvent) {
		json = remainingStdoutFromPartiallyReadEvent;
		remainingStdoutFromPartiallyReadEvent = null;
		jsonBytes = null;
	}
	else {
		json = jsonBytes.toString();
	}

	if (stdoutChunkObjects.length === 0) {
		// # Get content length
		let indexOfContentLengthToken = json.indexOf('Content-Length: ');
		if (indexOfContentLengthToken === -1) return null;
		let substringIndexStart = indexOfContentLengthToken + 16; /* 16 === 'Content-Length: '.length */
		let substringIndexEnd = substringIndexStart;
		outerForLoop: for (; substringIndexEnd < json.length; substringIndexEnd++) {
			switch (json[substringIndexEnd]) {
				case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
					break;
				default:
					break outerForLoop;
			}
		}
		if (substringIndexEnd === substringIndexStart) return null;
		let contentLengthString = json.substring(substringIndexStart, substringIndexEnd);
		let contentLengthNumber = parseInt(contentLengthString, 10);
		if (!contentLengthNumber) return null;
		// # Find where the content itself begins
		let indexOfSearchTerm = json.indexOf("\r\n\r\n");
		if (indexOfSearchTerm === -1) return null;
		substringIndexStart = indexOfSearchTerm + 4; /* 4 === "\r\n\r\n".length */
		// # JSON parse the 'content itself', or delay reading stdout if you don't yet have the entire 'content itself' as was stated by the 'content length'.
		if (substringIndexStart + contentLengthNumber <= json.length) {
			if (substringIndexStart + contentLengthNumber < json.length) {
				// TODO: Need to handle where '<', there is more stdout that needs to be read so make 'remainingStdoutFromPartiallyReadEvent'?
				return JSON.parse(json.substring(substringIndexStart, substringIndexStart + contentLengthNumber));
			}
			else {
				// TODO: This is when the length is equal so you don't need to even substring?
				return JSON.parse(json.substring(substringIndexStart, substringIndexStart + contentLengthNumber));
			}
		}
		else {
			stdoutChunkObjects.push({ bytesRaw: jsonBytes, bytesDecoded: json });
			stdoutChunkFirstEntryMetadata.substringIndexStart = substringIndexStart;
			stdoutChunkFirstEntryMetadata.contentLengthNumber = contentLengthNumber;
			return null;
		}
	}
	else {
		// # Determine if you now have all of the 'content itself' as was stated by the 'content length'
		let sumUnreadStdout = stdoutChunkObjects[0].bytesDecoded.length - stdoutChunkFirstEntryMetadata.substringIndexStart; // # stdoutChunkObjects[0]
		for (let i = 1; i < stdoutChunkObjects.length; i++) { // # stdoutChunkObjects[1] ... stdoutChunkObjects[length - 1]
			sumUnreadStdout += stdoutChunkObjects[i].bytesDecoded.length;
		}
		sumUnreadStdout += json.length; // # the current stdout chunk was never pushed into 'stdoutChunkObjects' so you need to handle it here

		if (stdoutChunkFirstEntryMetadata.contentLengthNumber <= sumUnreadStdout) {
			// # If you now have the entire 'content itself', create a string that contains the entirety of the 'content itself' and then JSON.parse it.
			// # If there is any remaining stdout you need to set 'remainingStdoutFromPartiallyReadEvent'
			let builder = [];
			let len = 0;
			
			let lenZeroth = stdoutChunkObjects[0].bytesDecoded.length - stdoutChunkFirstEntryMetadata.substringIndexStart; // # stdoutChunkObjects[0]
			if (lenZeroth) {
				let zerothSubstring = stdoutChunkObjects[0].bytesDecoded.slice(stdoutChunkFirstEntryMetadata.substringIndexStart, stdoutChunkObjects[0].bytesDecoded.length);
				builder.push(zerothSubstring);
				len += zerothSubstring.length;
			}
			
			for (let i = 1; i < stdoutChunkObjects.length; i++) { // # stdoutChunkObjects[1] ... stdoutChunkObjects[length - 1]
				builder.push(stdoutChunkObjects[i].bytesDecoded);
				len += stdoutChunkObjects[i].bytesDecoded.length;
			}
			
			// # the current stdout chunk was never pushed into 'stdoutChunkObjects' so you need to handle it here
			if (len + json.length === stdoutChunkFirstEntryMetadata.contentLengthNumber) {
				builder.push(json);
			}
			else { // # If there is any remaining stdout from the 'current stdout chunk' you need to set 'remainingStdoutFromPartiallyReadEvent'
				let fromCurrent = stdoutChunkFirstEntryMetadata.contentLengthNumber - len;
				builder.push(json.substring(0, fromCurrent));
				remainingStdoutFromPartiallyReadEvent = json.substring(fromCurrent);
			}

			stdoutChunkObjects.length = 0; // TODO: clear the array entries to permit garbage collection (since stdoutChunkObjects is always in the app's scope any entries would as well never be collected)
			return JSON.parse(builder.join(''));
		}
		else {
			stdoutChunkObjects.push({ bytesRaw: jsonBytes, bytesDecoded: json }); 
		}
	}
}

function MAIN_initializeLanguageServer() {

	if (os.homedir() !== 'C:\\Users\\hunte') {
		console.log("MAIN_initializeLanguageServer(): os.homedir() !== 'C:\\Users\\hunte'");
		return;
	}

	let initializeMessageObject = lspTypes.MAIN_constructMessageObject(
		'initialize',
		lspTypes.MAIN_message_construct_initializeParams(openedDirectory/*formatAbsolutePath(openedDirectory)*/, workspaceDirectories));
// "file:///C:/Users/hunte/Repos/JavaScript" file:///C%3A/project/readme.md
	let InitializeMessageEncoded = MAIN_encodeMessageObject(initializeMessageObject);

	//languageServer = spawn('node', [
	//	'C:\\Users\\hunte\\AppData\\Roaming\\npm\\node_modules\\typescript-language-server\\lib\\cli.mjs',
	//	'--stdio']);
	languageServer = spawn('C:\\Users\\hunte\\Repos\\New folder (6)\\LanguageServer\\JSLSApp\\bin\\Release\\net10.0\\publish\\JSLSApp.exe');

	/*
	interface RequestMessage extends Message {
		id: integer | string; // The request id.
		method: string; // The method to be invoked.
		params?: array | object; // The method's params.
	}
	*/

	/*
	interface ResponseMessage extends Message {		
		id: integer | string | null; // The request id.		
		result?: LSPAny; // The result of a request. This member is REQUIRED on success.* This member MUST NOT exist if there was an error invoking the method.		
		error?: ResponseError; // The error object in case a request fails.
	}
	*/

	// typescript-language-server is the command you would run in the terminal
	// windows search bar finds something if you type 'typescript-language-server'
	// right click > 'open file location'
	// 'C:\\Users\\hunte\\AppData\\Roaming\\npm\\typescript-language-server'
	//
	// Open the file itself in a text editor
	// It is a script that in the end essentially runs 'node ... ...'
	// hence the spawn arguments above replicate the "end essentially runs" step of the script that gets ran from the terminal command
	
	languageServer.stdout.on('data', (data) => {
		while (data || remainingStdoutFromPartiallyReadEvent) {
			let messageObject;
			if (!remainingStdoutFromPartiallyReadEvent) {
				messageObject = MAIN_decodeMessage(data);
				data = null;
			}
			else {
				messageObject = MAIN_decodeMessage(null);
			}
			
			if (!messageObject) return;

			if (messageObject.id && mostRecentRequest && messageObject.id === mostRecentRequest.id && mostRecentRequest.method) {
				switch (mostRecentRequest.method) {
					case 'textDocument/documentSymbol':
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
						break;
					case 'textDocument/CustomFullFileLexRequest':
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
						break;
					case 'textDocument/hover':
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
						break;
					case 'textDocument/definition':
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
					case 'textDocument/completion':
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
						break;
					case 'textDocument/completion_slice':
						// I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
						mainWindowCapture.webContents.send('from-main', { method:mostRecentRequest.method, result:messageObject.result });
						break;
				}
			}
	
			if (messageObject.result) {
				if (messageObject.result.capabilities) {   // initialize response
					languageServerHandshakeSuccess = true;
				}
				else {
					let aaaDebugBreakpoint = 2;
				}
			}
			else {
				let bbbDebugBreakpoint = 2;
			}
		}
	});

	languageServer.on('close', (code) => {
		console.log(`Child exited with code ${code}`);
	});

	languageServer.stdin.write(InitializeMessageEncoded);
}

/**
 * TODO: This is copy, pasted, and modified from editor.js
 * 
 * TODO: SPECULATION: If passing the byte array requires a copy to be made then you perhaps might as well make the string in the renderer process? I'm trying to consider...
 * ...whether gc would incur reduce renderer process if this is done in the main process.
 * 
 * Tabs are stored as '\t\0\0\0', all line feeds converted to '\n'.
 * 
 * textonly is in reference to conversion of the raw storage of the text editor such that a tab of '\t\0\0\0' is returned as just '\t', and all line feeds as EDI_lineEndString
 * 
 * @returns {string}
 */
function MAIN_decode_experimental_textonly(bytes, start, length, EDI_lineEndString, EDI_fileStartsWithBom) {

	// TODO: consider the garbage collection overhead of saving out a large file, and whether chunking would be preferable

	let EDI_decode_pooled_stringBuilder_array;
	
	// TODO: if you push the string does it bork any optimizations that the runtime can make for storage of single character strings or something is this a thing?

	if (EDI_fileStartsWithBom) {
		EDI_decode_pooled_stringBuilder_array = new Array(length + 1);
		EDI_decode_pooled_stringBuilder_array.push("\uFEFF");
	}
	else {
		EDI_decode_pooled_stringBuilder_array = new Array(length);
	}

	let EDI_decoder = new TextDecoder();

    let end = start + length;
	
	if (length <= 0) {
		return '';
	}
    
	for (let i = start; i < end; i++) {
		switch (bytes[i]) {
			case 0: // NUL
				break;
			case 9: // TAB
				EDI_decode_pooled_stringBuilder_array.push('\t');
				break;
			case 10: // LF
				EDI_decode_pooled_stringBuilder_array.push(EDI_lineEndString);
				break;
			case 32: // Space
				EDI_decode_pooled_stringBuilder_array.push(' ');
				break;
			case 33: // !
				EDI_decode_pooled_stringBuilder_array.push('!');
				break;
			case 34: // "
				EDI_decode_pooled_stringBuilder_array.push('"');
				break;
			case 35: // #
				EDI_decode_pooled_stringBuilder_array.push('#');
				break;
			case 36: // $ (I think???)
				EDI_decode_pooled_stringBuilder_array.push('$');
				break;
			case 37: // %
				EDI_decode_pooled_stringBuilder_array.push('%');
				break;
			case 38: // & (I think???)
				EDI_decode_pooled_stringBuilder_array.push('&');
				break;
			case 39: // ' (I think???)
				EDI_decode_pooled_stringBuilder_array.push('\'');
				break;
			case 40: // (
				EDI_decode_pooled_stringBuilder_array.push('(');
				break;
			case 41: // )
				EDI_decode_pooled_stringBuilder_array.push(')');
				break;
			case 42: // *
				EDI_decode_pooled_stringBuilder_array.push('*');
				break;
			case 43: // +
				EDI_decode_pooled_stringBuilder_array.push('+');
				break;
			case 44: // , (I think???)
				EDI_decode_pooled_stringBuilder_array.push(',');
				break;
			case 45: // -
				EDI_decode_pooled_stringBuilder_array.push('-');
				break;
			case 46: // .
				EDI_decode_pooled_stringBuilder_array.push('.');
				break;
			case 47: // /
				EDI_decode_pooled_stringBuilder_array.push('/');
				break;
			case 48: // 0
				EDI_decode_pooled_stringBuilder_array.push('0');
				break;
			case 49: // 1
				EDI_decode_pooled_stringBuilder_array.push('1');
				break;
			case 50: // 2
				EDI_decode_pooled_stringBuilder_array.push('2');
				break;
			case 51: // 3
				EDI_decode_pooled_stringBuilder_array.push('3');
				break;
			case 52: // 4
				EDI_decode_pooled_stringBuilder_array.push('4');
				break;
			case 53: // 5
				EDI_decode_pooled_stringBuilder_array.push('5');
				break;
			case 54: // 6
				EDI_decode_pooled_stringBuilder_array.push('6');
				break;
			case 55: // 7
				EDI_decode_pooled_stringBuilder_array.push('7');
				break;
			case 56: // 8
				EDI_decode_pooled_stringBuilder_array.push('8');
				break;
			case 57: // 9
				EDI_decode_pooled_stringBuilder_array.push('9');
				break;
			case 58: // :
				EDI_decode_pooled_stringBuilder_array.push(':');
				break;
			case 59: // ;
				EDI_decode_pooled_stringBuilder_array.push(';');
				break;
			case 60: // <
				EDI_decode_pooled_stringBuilder_array.push('<');
				break;
			case 61: // =
				EDI_decode_pooled_stringBuilder_array.push('=');
				break;
			case 62: // >
				EDI_decode_pooled_stringBuilder_array.push('>');
				break;
			case 63: // ?
				EDI_decode_pooled_stringBuilder_array.push('?');
				break;
			case 64: // @
				EDI_decode_pooled_stringBuilder_array.push('@');
				break;
			case 65: // A
				EDI_decode_pooled_stringBuilder_array.push('A');
				break;
			case 66: // B
				EDI_decode_pooled_stringBuilder_array.push('B');
				break;
			case 67: // C
				EDI_decode_pooled_stringBuilder_array.push('C');
				break;
			case 68: // D
				EDI_decode_pooled_stringBuilder_array.push('D');
				break;
			case 69: // E
				EDI_decode_pooled_stringBuilder_array.push('E');
				break;
			case 70: // F
				EDI_decode_pooled_stringBuilder_array.push('F');
				break;
			case 71: // G
				EDI_decode_pooled_stringBuilder_array.push('G');
				break;
			case 72: // H
				EDI_decode_pooled_stringBuilder_array.push('H');
				break;
			case 73: // I
				EDI_decode_pooled_stringBuilder_array.push('I');
				break;
			case 74: // J
				EDI_decode_pooled_stringBuilder_array.push('J');
				break;
			case 75: // K
				EDI_decode_pooled_stringBuilder_array.push('K');
				break;
			case 76: // L
				EDI_decode_pooled_stringBuilder_array.push('L');
				break;
			case 77: // M
				EDI_decode_pooled_stringBuilder_array.push('M');
				break;
			case 78: // N
				EDI_decode_pooled_stringBuilder_array.push('N');
				break;
			case 79: // O
				EDI_decode_pooled_stringBuilder_array.push('O');
				break;
			case 80: // P
				EDI_decode_pooled_stringBuilder_array.push('P');
				break;
			case 81: // Q
				EDI_decode_pooled_stringBuilder_array.push('Q');
				break;
			case 82: // R
				EDI_decode_pooled_stringBuilder_array.push('R');
				break;
			case 83: // S
				EDI_decode_pooled_stringBuilder_array.push('S');
				break;
			case 84: // T
				EDI_decode_pooled_stringBuilder_array.push('T');
				break;
			case 85: // U
				EDI_decode_pooled_stringBuilder_array.push('U');
				break;
			case 86: // V
				EDI_decode_pooled_stringBuilder_array.push('V');
				break;
			case 87: // W
				EDI_decode_pooled_stringBuilder_array.push('W');
				break;
			case 88: // X
				EDI_decode_pooled_stringBuilder_array.push('X');
				break;
			case 89: // Y
				EDI_decode_pooled_stringBuilder_array.push('Y');
				break;
			case 90: // Z
				EDI_decode_pooled_stringBuilder_array.push('Z');
				break;
			case 91: // [
				EDI_decode_pooled_stringBuilder_array.push('[');
				break;
			case 92: // \
				EDI_decode_pooled_stringBuilder_array.push('\\');
				break;
			case 93: // ]
				EDI_decode_pooled_stringBuilder_array.push(']');
				break;
			case 94: // ^
				EDI_decode_pooled_stringBuilder_array.push('^');
				break;
			case 95: // _
				EDI_decode_pooled_stringBuilder_array.push('_');
				break;
			case 96: // `
				EDI_decode_pooled_stringBuilder_array.push('`');
				break;
			case 97: // a
				EDI_decode_pooled_stringBuilder_array.push('a');
				break;
			case 98: // b
				EDI_decode_pooled_stringBuilder_array.push('b');
				break;
			case 99: // c
				EDI_decode_pooled_stringBuilder_array.push('c');
				break;
			case 100: // d
				EDI_decode_pooled_stringBuilder_array.push('d');
				break;
			case 101: // e
				EDI_decode_pooled_stringBuilder_array.push('e');
				break;
			case 102: // f
				EDI_decode_pooled_stringBuilder_array.push('f');
				break;
			case 103: // g
				EDI_decode_pooled_stringBuilder_array.push('g');
				break;
			case 104: // h
				EDI_decode_pooled_stringBuilder_array.push('h');
				break;
			case 105: // i
				EDI_decode_pooled_stringBuilder_array.push('i');
				break;
			case 106: // j
				EDI_decode_pooled_stringBuilder_array.push('j');
				break;
			case 107: // k
				EDI_decode_pooled_stringBuilder_array.push('k');
				break;
			case 108: // l
				EDI_decode_pooled_stringBuilder_array.push('l');
				break;
			case 109: // m
				EDI_decode_pooled_stringBuilder_array.push('m');
				break;
			case 110: // n
				EDI_decode_pooled_stringBuilder_array.push('n');
				break;
			case 111: // o
				EDI_decode_pooled_stringBuilder_array.push('o');
				break;
			case 112: // p
				EDI_decode_pooled_stringBuilder_array.push('p');
				break;
			case 113: // q
				EDI_decode_pooled_stringBuilder_array.push('q');
				break;
			case 114: // r
				EDI_decode_pooled_stringBuilder_array.push('r');
				break;
			case 115: // s
				EDI_decode_pooled_stringBuilder_array.push('s');
				break;
			case 116: // t
				EDI_decode_pooled_stringBuilder_array.push('t');
				break;
			case 117: // u
				EDI_decode_pooled_stringBuilder_array.push('u');
				break;
			case 118: // v
				EDI_decode_pooled_stringBuilder_array.push('v');
				break;
			case 119: // w
				EDI_decode_pooled_stringBuilder_array.push('w');
				break;
			case 120: // x
				EDI_decode_pooled_stringBuilder_array.push('x');
				break;
			case 121: // y
				EDI_decode_pooled_stringBuilder_array.push('y');
				break;
			case 122: // z
				EDI_decode_pooled_stringBuilder_array.push('z');
				break;
			case 123: // {
				EDI_decode_pooled_stringBuilder_array.push('{');
				break;
			case 124: // |
				EDI_decode_pooled_stringBuilder_array.push('|');
				break;
			case 125: // }
				EDI_decode_pooled_stringBuilder_array.push('}');
				break;
			case 126: // ~
				EDI_decode_pooled_stringBuilder_array.push('~');
				break;
			default:
				EDI_decode_pooled_stringBuilder_array.push(
					EDI_decoder.decode(bytes.subarray(i, i + 1)));
				break;
		}
	}
	
	return EDI_decode_pooled_stringBuilder_array.join('');
}

/**
 * Extracts more data per entry { basename, absolutePath, isDirectory, id }
 * and applies a common sorting prior to returning results.
 * */
function wrap_readdirSync_getChildList(parentAbsolutePath) {
	let childList = fs.readdirSync(parentAbsolutePath, { withFileTypes: true });
	for (var i = 0; i < childList.length; i++) {
		let filename = childList[i].name;
		let isDirectory = childList[i].isDirectory();
		let childAbsolutePath = path.join(parentAbsolutePath, filename);
		let id = database.addAbsolutePath(childAbsolutePath, filename);
		childList[i] = {
			basename: filename,
			absolutePath: childAbsolutePath,
			isDirectory: isDirectory,
			id: id
		};
	}

	childList.sort((a, b) => {
		if (a.isDirectory && !b.isDirectory) {
			return -1;
		}

		if (!a.isDirectory && b.isDirectory) {
			return 1;
		}

		return a.basename.localeCompare(b.basename);
	});

	return childList;
}

/**
 * Applies a common sorting prior to finding the indexOf
 * 
 * (does NOT internally extract any extra data than what is used for determining the indexOf)
 * 
 * TODO: This could still be faster. You shouldn't need to have an initial loop over the array to rewrite each index as { basename, isDirectory } to do this.
 * TODO: As well I believe checking the filename alone (not checking the childIsDirectory) is sufficient.
 */
function wrap_readdirSync_indexOf(parentAbsolutePath, childFilename, childIsDirectory) {
	let childList = fs.readdirSync(parentAbsolutePath, { withFileTypes: true });
	for (var i = 0; i < childList.length; i++) {
		let filename = childList[i].name;
		let isDirectory = childList[i].isDirectory();
		childList[i] = {
			basename: filename,
			isDirectory: isDirectory,
		};
	}

	childList.sort((a, b) => {
		if (a.isDirectory && !b.isDirectory) {
			return -1;
		}

		if (!a.isDirectory && b.isDirectory) {
			return 1;
		}

		return a.basename.localeCompare(b.basename);
	});

	for (let i = 0; i < childList.length; i++) {
		if (childList[i].basename === childFilename && childList[i].isDirectory === childIsDirectory) {
			return i;
		}
	}

	return -1;
}

/**
 * started off with code snippet from Google AI Overview for "node fs determine if file has bom":
 */
function hasBOM(filePath) {
	// Use a small buffer to read just the first 3-4 bytes
	const buffer = Buffer.alloc(4);
	const fd = fs.openSync(filePath, 'r');
	fs.readSync(fd, buffer, 0, 4, 0);

	let stat = fs.statSync(filePath);

	// Check for common BOM signatures
	// UTF-8: EF BB BF
	if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
		const bufferaaa = Buffer.alloc(stat.size - 4);
		fs.readSync(fd, bufferaaa, 0, bufferaaa.length, 3);
		fs.closeSync(fd);
		return {
			text: bufferaaa.toString(),
			fileStartsWithBom: true
		};
	}
	else {
		const bufferaaa = Buffer.alloc(stat.size);
		fs.readSync(fd, bufferaaa, 0, bufferaaa.length, 0);
		fs.closeSync(fd);
		return {
			text: bufferaaa.toString(),
			fileStartsWithBom: false
		};
	}

	/*
	// UTF-16 Little Endian: FF FE
	if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
		return 'UTF-16LE';
	}
	// UTF-16 Big Endian: FE FF
	if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
		return 'UTF-16BE';
	}
	*/
}

async function chooseDirectory (event) {
	const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
	if (result.canceled) {
		return { basename: '', openedDirectory: '', canceled: result.canceled };
	}

	openedDirectory = result.filePaths[0];
	openedWorkspace = null;
	workspaceDirectories = null;

	let filename = path.basename(openedDirectory);
	let id = database.addAbsolutePath(openedDirectory, filename);

	if (!languageServer) {
		MAIN_initializeLanguageServer();
	}

	return { basename: filename, openedDirectory: openedDirectory, id: id, canceled: result.canceled };
}

async function chooseWorkspace(event) {
	const result = await dialog.showOpenDialog({ properties: ['openFile'] });
	if (result.canceled) {
		return {
			workspaceFileAbsolutePath: null,
			workspaceFileNameWithoutExtension: null,
			directories: [],
			canceled: result.canceled };
	}

	openedDirectory = null;
	openedWorkspace = result.filePaths[0];
	workspaceDirectories = null;

	let filename = path.basename(openedWorkspace);
	let id = database.addAbsolutePath(openedWorkspace, filename);

	let fileContent = fs.readFileSync(openedWorkspace, 'utf8');
	let jsonObject = JSON.parse(fileContent);

	if (!jsonObject.folders) {
		throw new Error('if (!jsonObject.folders)');
	}

	let parentDirectoryAbsolutePath = path.dirname(openedWorkspace);

	let directories = [];
	  
	for (let i = 0; i < jsonObject.folders.length; i++) {
		let folderEntry = jsonObject.folders[i];
		let absolutePath = path.join(parentDirectoryAbsolutePath, folderEntry.path);
		let filename = path.basename(absolutePath);
		let id = database.addAbsolutePath(absolutePath, filename);
		directories.push({
			basename: filename,
			absolutePath: absolutePath,
			id: id,
		});
	}

	workspaceDirectories = directories;

	if (!languageServer) {
		MAIN_initializeLanguageServer();
	}

	return {
		workspaceFileAbsolutePath: openedWorkspace,
		workspaceFileNameWithoutExtension: path.parse(openedWorkspace).name,
		directories: directories,
		canceled: result.canceled
	};
}

async function didChangeTextDocumentNotification(event, absolutePath, version, startLine, startCharacter, endLine, endCharacter, text) {
	// renderer now gives the formatted path
	//absolutePath = formatAbsolutePath(absolutePath);
	
	if (openedDocumentUri !== absolutePath) return;

	try {
		if (languageServerHandshakeSuccess && languageServer) {
			let versionedTextDocumentIdentifier = lspTypes.MAIN_message_construct_versionedTextDocumentIdentifier(absolutePath, version);
			let startPosition = lspTypes.MAIN_message_construct_position(startLine, startCharacter);
			let endPosition = lspTypes.MAIN_message_construct_position(endLine, endCharacter);
			let range = lspTypes.MAIN_message_construct_range(startPosition, endPosition);
			let change = lspTypes.MAIN_message_construct_textDocumentContentChangeEvent(range, text);
			let params = lspTypes.MAIN_message_construct_didChangeTextDocumentNotification_Params(versionedTextDocumentIdentifier, [change]);
			let messageObject = lspTypes.MAIN_message_construct_didChangeTextDocumentNotification(params);
			let messageJson = MAIN_encodeMessageObject(messageObject);
			languageServer.stdin.write(messageJson);
		}
	}
	catch (err) {
		console.error("Error did-change-text-document-notification:", err);
		return [];
	}
}

async function getFilesystemEntries(event, argument, argumentIsId) {

	let parentAbsolutePath;

	if (argumentIsId) {
		let entry = database.getBy_id(argument);
		if (!entry) return;

		parentAbsolutePath = entry.value;
	}
	else {
		parentAbsolutePath = argument;
		if (!isValidAbsolutePath(parentAbsolutePath)) return;
	}

	try {
		return wrap_readdirSync_getChildList(parentAbsolutePath);
	}
	catch (err) {
		console.error("Error reading directory:", err);
		return [];
	}
}

async function getFilesystemEntryById(event, id) {
	try {
		let entry = database.getBy_id(id);
		if (!entry) {
			return null;
		}
		else {
			return {
				basename: entry.displayName,
				absolutePath: entry.value,
				isDirectory: fs.statSync(entry.value)?.isDirectory() ?? false
			};
		}
	}
	catch (err) {
		console.error("Error during get-filesystem-entry-by-id:", err);
		return [];
	}
}

async function getFilesystemEntryById_ARRAY(event, arrayKeys) {
	try {
		const KEY_BITS = 12;
        const KEY_MASK = (1 << KEY_BITS) - 1; // Binary: 00000000000000000000111111111111 (0xFFF)

		let arrayEntries = new Array(arrayKeys.length);
		for (let i = 0; i < arrayKeys.length; i++) {
			let packedInteger = arrayKeys[i];
			const key = packedInteger & KEY_MASK;
			let entry = database.getBy_id(key);
			if (!entry) {
				//arrayEntries[i] = null;
				arrayEntries[i] =  {
					basename: 'basenameUndefined',
					absolutePath: 'absolutePathUndefined',
					// TODO: return 'null' not 'true'. And then the UI should interpret this as "whatever you currently have just keep it that way cause nobody knows what the file even is anymore"...
					// ...because presumably a render happened between the time that the FS deleted the file, but before the UI removed it from the node list... this is only speculation but it probably is what is happening.
					// thus the next render should correctly remove the node from the UI anyways.					
					isDirectory: true//fs.statSync(entry.value)?.isDirectory() ?? false
				};
			}
			else {

				let fsStatSyncResult;
				
				try {
					fsStatSyncResult = fs.statSync(entry.value);
				}
				catch (err) {
					fsStatSyncResult = null;
				}

				// Oddly if the node is expanded this works entirely but if collapsed the node visually never gets removed.

				arrayEntries[i] =  {
					basename: entry.displayName,
					absolutePath: entry.value,
					// TODO: return 'null' not 'true'. And then the UI should interpret this as "whatever you currently have just keep it that way cause nobody knows what the file even is anymore"...
					// ...because presumably a render happened between the time that the FS deleted the file, but before the UI removed it from the node list... this is only speculation but it probably is what is happening.
					// thus the next render should correctly remove the node from the UI anyways.
					isDirectory: fsStatSyncResult?.isDirectory() ?? true
				};
			}
		}
		return arrayEntries;
	}
	catch (err) {
		console.error("Error during get-filesystem-entry-by-id:", err);
		return [];
	}
}

async function readAllText(event, absolutePath) {
	if(!isValidAbsolutePath(absolutePath)) return;

	try {
		return fs.readFileSync(absolutePath, 'utf8');
	}
	catch (err) {
		//console.error("Error reading file:", err);
		return null;
	}
}

async function editorReadAllText(event, absolutePath) {
	if(!isValidAbsolutePath(absolutePath)) return;

	try {
		let basename = path.basename(absolutePath);
		let extension = path.extname(absolutePath);

		let itHasBom = hasBOM(absolutePath);

		absolutePath = formatAbsolutePath(absolutePath);
		itHasBom.formattedAbsolutePath = absolutePath;
		itHasBom.extension = extension;

		let pathId = database.addAbsolutePath(itHasBom.formattedAbsolutePath, basename);

		if (openedDocumentUri) {
			let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(absolutePath);
			if (languageServerHandshakeSuccess && languageServer) {
				languageServer.stdin.write(
					MAIN_encodeMessageObject(lspTypes.MAIN_message_construct_didCloseTextDocumentNotification(tdIdentifier)));
			}
			openedDocumentUri = null; // Should be set null regardless of language server existence to ensure it gets cleared if language server was running then stopped
		}

		let tdi = lspTypes.MAIN_message_construct_textDocumentItem(
			absolutePath,   // uri
			'javascript',   // languageId
			0,              // version
			itHasBom.text); // text
		let messageObject = lspTypes.MAIN_message_construct_didOpenTextDocumentNotification(tdi);
		let messageJson = MAIN_encodeMessageObject(messageObject);
		if (languageServerHandshakeSuccess && languageServer) {
			languageServer.stdin.write(messageJson);
			openedDocumentUri = absolutePath;

			// TODO: Somewhat nonsensical to check 'openedDocumentUri' but I'm not sure if it was ever validated and I don't wanna deal with it right now...
			// ...
			// More so, I don't want this new logic to ever have a possibility of crashing the old logic (which simply wanted to read the text.)
			// So until I guarantee that 'openedDocumentUri' is validated, I don't want to take any risks with it. (and maybe it is validated I just don't know either which way)
			//
			if (openedDocumentUri) {
				let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
				let customFullFileLexRequest = lspTypes.MAIN_message_construct_CustomFullFileLexRequest(tdIdentifier);
				mostRecentRequest = customFullFileLexRequest;
				languageServer.stdin.write(MAIN_encodeMessageObject(customFullFileLexRequest));
			}
		}
		
		return itHasBom;
	}
	catch (err) {
		return null;
	}
}

async function editorDocumentSymbolsRequest(event) {
	try {
		if (!languageServerHandshakeSuccess || !languageServer || !openedDocumentUri) return;

		let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
		let documentSymbolsRequest = lspTypes.MAIN_message_construct_DocumentSymbolsRequest(tdIdentifier);
		mostRecentRequest = documentSymbolsRequest;
		languageServer.stdin.write(MAIN_encodeMessageObject(documentSymbolsRequest));
	}
	catch (err) {
		console.error("Error during editor-document-symbols-request:", err);
		return [];
	}
}

async function editorGoToDefinitionRequest(event, indexLine, indexColumn) {
	try {
		if (!languageServerHandshakeSuccess || !languageServer || !openedDocumentUri) return;

		let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
		let position = lspTypes.MAIN_message_construct_position(indexLine, indexColumn);
		let goToDefinitionRequest = lspTypes.MAIN_message_construct_GoToDefinitionRequest(tdIdentifier, position);
		mostRecentRequest = goToDefinitionRequest;
		languageServer.stdin.write(MAIN_encodeMessageObject(goToDefinitionRequest));
	}
	catch (err) {
		console.error("Error during editor-document-symbols-request:", err);
		return [];
	}
}

async function editorHoverRequest(event, indexLine, indexColumn) {
	try {
		if (!languageServerHandshakeSuccess || !languageServer || !openedDocumentUri) return;

		let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
		let position = lspTypes.MAIN_message_construct_position(indexLine, indexColumn);
		let hoverRequest = lspTypes.MAIN_message_construct_HoverRequest(tdIdentifier, position);
		mostRecentRequest = hoverRequest;
		languageServer.stdin.write(MAIN_encodeMessageObject(hoverRequest));
	}
	catch (err) {
		console.error("Error during editor-document-symbols-request:", err);
		return [];
	}
}

async function editorCompletionRequest(event, indexLine, indexColumn) {
	try {
		if (!languageServerHandshakeSuccess || !languageServer || !openedDocumentUri) return;

		let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
		let position = lspTypes.MAIN_message_construct_position(indexLine, indexColumn);
		let completionRequest = lspTypes.MAIN_message_construct_CompletionRequest(tdIdentifier, position);
		mostRecentRequest = completionRequest;
		languageServer.stdin.write(MAIN_encodeMessageObject(completionRequest));
	}
	catch (err) {
		console.error("Error during editor-document-symbols-request:", err);
		return [];
	}
}

// I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
async function editorCompletionRequest_slice(event, indexStart, indexEnd) {
	try {
		if (!languageServerHandshakeSuccess || !languageServer || !openedDocumentUri) return;

		let tdIdentifier = lspTypes.MAIN_message_construct_textDocumentIdentifier(openedDocumentUri);
		//let position = lspTypes.MAIN_message_construct_position(indexLine, indexColumn);
		let completionRequest_slice = lspTypes.MAIN_message_construct_CompletionRequest_slice(tdIdentifier, indexStart, indexEnd);
		mostRecentRequest = completionRequest_slice;
		languageServer.stdin.write(MAIN_encodeMessageObject(completionRequest_slice));
	}
	catch (err) {
		console.error("Error during editor-document-symbols-request:", err);
		return [];
	}
}

async function setClipboard(event, text) {
	try {
		clipboard.writeText(text);
	}
	catch (err) {
		console.error("Error setting clipboard:", err);
		return [];
	}
}

async function editorSetClipboard(event, uint8Array, offset, length, EDI_lineEndString) {
	try {
		if (!EDI_lineEndString)
			EDI_lineEndString = '\n';

		clipboard.writeText(MAIN_decode_experimental_textonly(uint8Array, offset, length, EDI_lineEndString));
	}
	catch (err) {
		console.error("Error setting clipboard:", err);
		return [];
	}
}

async function readClipboard(event) {
	try {
		return clipboard.readText();
	}
	catch (err) {
		console.error("Error reading clipboard:", err);
		return [];
	}
}

async function findAll(event, search, matchWord) {
	try {
		// TODO: I need a quickfix list when I { 'Ctrl' + 'Shift' + 'f' }.
		// TODO: I need to be able to convert my { 'Ctrl' + 'f' } to a quickfix list.
		if (!openedDirectory && !workspaceDirectories) return;

		let results = [];

		async function searchRecursive(absolutePath) {
			// TODO: need to enumerate the children rather than getting an array allocated.
              
			let childList = fs.readdirSync(absolutePath, { withFileTypes: true });
			for (var i = 0; i < childList.length; i++) {
				if (childList[i].isDirectory()) {
					if (childList[i].name === 'node_modules') {
						console.log('do not recurse into node_modules');
					}
					else if (childList[i].name === '.git') {
						console.log('do not recurse into .git');
					}
					else if (childList[i].name === '.vscode') {
						console.log('do not recurse into .vscode');
					}
					else if (childList[i].name === 'out') {
						console.log('do not recurse into out');
					}
					else {
						// TODO: Presumably there is an API that would provide this more optimally
						let absolutePathOfChild = path.join(childList[i].parentPath, childList[i].name);
						await searchRecursive(absolutePathOfChild);
					}
				}
				else {
					// TODO: Presumably there is an API that would provide this more optimally
					let absolutePathOfChild = path.join(childList[i].parentPath, childList[i].name);

					const readableStream = fs.createReadStream(absolutePathOfChild, { encoding: 'utf8' });

					// TODO: Is it possible to allocate a Promise 'one time' and re-use it?...
					// ...this is being done within a loop over all text files and recursively descends from the "workspace directory".
					let promise = new Promise((resolve, reject) => {
						let count = 0;
						let offset = 0;
						// TODO: Come up with a case that verifies this code works...
						let previousChunkNeedsWordVerification = false;

						readableStream.on('data', (chunk) => {
							if (matchWord && ((search[0] >= 'a' && search[0] <= 'z') || (search[0] >= 'A' && search[0] <= 'Z') || (search[0] >= '0' && search[0] <= '9') || (search[0] === '_'))) { // if is letter or digit ('a' to 'z') || ('A' to 'Z') || ('0' to '9') || ('_') all bounds inclusive)
								if (previousChunkNeedsWordVerification) {
									previousChunkNeedsWordVerification = false;
									if (chunk.length > 0 && ((chunk[0] >= 'a' && chunk[0] <= 'z') || (chunk[0] >= 'A' && chunk[0] <= 'Z') || (chunk[0] >= '0' && chunk[0] <= '9') || (chunk[0] === '_'))) {
										count--;
									}
								}
								for (let i = 0; i < chunk.length; i++) {
									if ((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_')) {
										if (chunk[i] === search[0]) {
											while (i < chunk.length) { // context switch to checking match
												if (chunk[i] === search[offset]) {
													if (offset === 0) {
														posStartOfMatch = i;
													}
													offset++;
													if (offset === search.length) { // found "possible match"
														if (i + 1 >= chunk.length ||
															!((chunk[i + 1] >= 'a' && chunk[i + 1] <= 'z') || (chunk[i + 1] >= 'A' && chunk[i + 1] <= 'Z') || (chunk[i + 1] >= '0' && chunk[i + 1] <= '9') || (chunk[i + 1] === '_'))) { // ends on a word, therefore take match
																if (i + 1 >= chunk.length) {
																	previousChunkNeedsWordVerification = true;
																}
																count++;
																offset = 0;
																break;
															}
															else { // does NOT end on a word, therefore ignore match
																offset = 0;
																while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
																	if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
																		i--; // backtrack by one due to outer for loop's incrementation step
																		break;
																	}
																	i++;
																}
																break;
															}
														}
													i++;
												}
												else {
													offset = 0;
													while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
														if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
															i--; // backtrack by one due to outer for loop's incrementation step
															break;
														}
														i++;
													}
													break;
												}
											}
										}
										else {
											while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
												if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
													i--; // backtrack by one due to outer for loop's incrementation step
													break;
												}
												i++;
											}
										}
									}
									else {
										while (i < chunk.length) { // move pos to next letterOrDigit or EOF
											if ((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_')) {
												i--; // backtrack by one due to outer for loop's incrementation step
												break;
											}
											i++;
										}
									}
								}
							}
							else {
								for (let i = 0; i < chunk.length; i++) {
									if (chunk[i] === search[offset]) {
										offset++;
										if (offset === search.length) {
											count++;
											offset = 0;
										}
									}
									else {
										offset = 0;
									}
								}
							}
						});
						readableStream.on('end', () => {
							resolve(count);
						});
						readableStream.on('error', (error) => {
							reject(error);
						});
					});
					let count = await promise;

					if (count > 0) {
						database.addAbsolutePath(absolutePathOfChild, childList[i].name);
						results.push({
							filename: childList[i].name,
							absolutePath: absolutePathOfChild,
							count: count
						});
					}
				}
			}
		}

		if (openedDirectory) {
			await searchRecursive(openedDirectory);
			return results;
		}
		else if (workspaceDirectories) {
			for (let i = 0; i < workspaceDirectories.length; i++) {
				await searchRecursive(workspaceDirectories[i].absolutePath);
			}
			return results;
		}
	}
	catch (err) {
		console.error("Error during find-all:", err);
		return [];
	}
}

async function findAllGetPositions(event, absolutePath, search, matchWord) {
	if(!isValidAbsolutePath(absolutePath)) return;

	try {
		let results = [];

		const readableStream = fs.createReadStream(absolutePath, { encoding: 'utf8' });
                    
		let aaa = new Promise((resolve, reject) => {
			let offset = 0;
			let posStartOfMatch = 0;
			// TODO: Come up with a case that verifies this code works...
			let previousChunkNeedsWordVerification = false;
			
			let indexLine = 0;
			let hasDecidedLineEndKind = false;
			/** I don't want to deal with '\r\n' where '\r' ends a chunk and then '\n' immediately starts the next chunk. If I consistently only track either '\r' or '\n' then I can avoid this. */
			let trueCarriageReturn_falseLineFeed = true;
  
			readableStream.on('data', (chunk) => {
				if (matchWord && ((search[0] >= 'a' && search[0] <= 'z') || (search[0] >= 'A' && search[0] <= 'Z') || (search[0] >= '0' && search[0] <= '9') || (search[0] === '_'))) { // if is letter or digit ('a' to 'z') || ('A' to 'Z') || ('0' to '9') || ('_') all bounds inclusive)
					if (previousChunkNeedsWordVerification) {
						previousChunkNeedsWordVerification = false;
						if (chunk.length > 0 && ((chunk[0] >= 'a' && chunk[0] <= 'z') || (chunk[0] >= 'A' && chunk[0] <= 'Z') || (chunk[0] >= '0' && chunk[0] <= '9') || (chunk[0] === '_'))) {
							results.length--;
						}
					}
					for (let i = 0; i < chunk.length; i++) {
						if ((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_')) {
							if (chunk[i] === search[0]) {
								while (i < chunk.length) { // context switch to checking match
									if (chunk[i] === search[offset]) {
										if (offset === 0) {
											posStartOfMatch = i;
										}
										offset++;
										if (offset === search.length) { // found "possible match"
											if (i + 1 >= chunk.length ||
												!((chunk[i + 1] >= 'a' && chunk[i + 1] <= 'z') || (chunk[i + 1] >= 'A' && chunk[i + 1] <= 'Z') || (chunk[i + 1] >= '0' && chunk[i + 1] <= '9') || (chunk[i + 1] === '_'))) { // ends on a word, therefore take match
													if (i + 1 >= chunk.length) {
														previousChunkNeedsWordVerification = true;
													}
													//results.push(posStartOfMatch);
													results.push(indexLine);
													offset = 0;
													break;
											}
											else { // does NOT end on a word, therefore ignore match
												offset = 0;
												while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
													if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
														i--; // backtrack by one due to outer for loop's incrementation step
														break;
													}
													i++;
												}
												break;
											}
										}
										i++;
									}
									else {
										offset = 0;
										while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
											if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
												i--; // backtrack by one due to outer for loop's incrementation step
												break;
											}
											i++;
										}
										break;
									}
								}
							}
							else {
								while (i < chunk.length) { // move pos to next NON(letterOrDigit) or EOF
									if (!((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_'))) {
										i--; // backtrack by one due to outer for loop's incrementation step
										break;
									}
									i++;
								}
							}
						}
						else {
							while (i < chunk.length) { // move pos to next letterOrDigit or EOF
								if ((chunk[i] >= 'a' && chunk[i] <= 'z') || (chunk[i] >= 'A' && chunk[i] <= 'Z') || (chunk[i] >= '0' && chunk[i] <= '9') || (chunk[i] === '_')) {
									i--; // backtrack by one due to outer for loop's incrementation step
									break;
								}
								switch (chunk[i]) {
									case '\r':
										if (!hasDecidedLineEndKind) {
											hasDecidedLineEndKind = true;
											trueCarriageReturn_falseLineFeed = true;
										}
										if (trueCarriageReturn_falseLineFeed) {
											indexLine++;
										}
										break;
									case '\n':
										if (!hasDecidedLineEndKind) {
											hasDecidedLineEndKind = true;
											trueCarriageReturn_falseLineFeed = false;
										}
										if (!trueCarriageReturn_falseLineFeed) {
											indexLine++;
										}
										break;
								}
								i++;
							}
						}
					}
				}
				else {
					for (let i = 0; i < chunk.length; i++) {
						
						switch (chunk[i]) {
							case '\r':
								if (!hasDecidedLineEndKind) {
									hasDecidedLineEndKind = true;
									trueCarriageReturn_falseLineFeed = true;
								}
								if (trueCarriageReturn_falseLineFeed) {
									indexLine++;
								}
								break;
							case '\n':
								if (!hasDecidedLineEndKind) {
									hasDecidedLineEndKind = true;
									trueCarriageReturn_falseLineFeed = false;
								}
								if (!trueCarriageReturn_falseLineFeed) {
									indexLine++;
								}
								break;
						}

						if (chunk[i] === search[offset]) {
							if (offset === 0) {
								posStartOfMatch = i;
							}
							offset++;
							if (offset === search.length) {
								//results.push(posStartOfMatch);
								results.push(indexLine);
								offset = 0;
							}
						}
						else {
							offset = 0;
						}
					}
				}
			});
			readableStream.on('end', () => {
				resolve(results);
			});
			readableStream.on('error', (error) => {
				reject(error);
			});
		});
		return await aaa;
	}
	catch (err) {
		console.error("Error during find-all-getPositions:", err);
		return [];
	}
}

/** 
 * Returns an object with property 'success' equal to 'true' if success, otherwise the property is equal to 'false'...
 * ...and other properties as well.
 */
async function newFile(event, parentDirectoryAbsolutePath, filename, isDirectory) {
	if (!isValidAbsolutePath(parentDirectoryAbsolutePath)) return;

	/*
	I'm duplicating the code for mkdirSync and writeFile because
	I only want to add the path to the database if the operating system operation was successful.
	I don't like the idea of creating some if statement that occurs after either conditional branch
	in order to put this logic in one place, I'd rather duplicate it.

	As well, neither the renderer process or the main process are storing the absolutepaths.
	So I need to re-interact with the OS file-system to determine what index the new UI will go in.

	Having the main process determine which index changed, and telling the renderer how to update its state accordingly,
	while feeling somewhat wasteful, is still much less expensive than if you were to have the main process
	re-collect all of the children of some directory and send that down to the UI and delete the current children
	from the flat-list and add in this updated list wherein most are equal to what previously was in the flat list that you just deleted.
	*/

	try {
		let pathToNewFile = path.join(parentDirectoryAbsolutePath, filename);
		if (isDirectory) {
			fs.mkdirSync(pathToNewFile);
			let pathId = database.addAbsolutePath(pathToNewFile, filename);
			let indexOf = wrap_readdirSync_indexOf(parentDirectoryAbsolutePath, filename, /*childIsDirectory*/ true);
			return {
				success: true,
				pathId: pathId,
				indexOf: indexOf,
			};
		}
		else {
			fs.writeFile(pathToNewFile, 'overwritten?', { flag: 'wx' }, () => {});
			let pathId = database.addAbsolutePath(pathToNewFile, filename);
			let indexOf = wrap_readdirSync_indexOf(parentDirectoryAbsolutePath, filename, /*childIsDirectory*/ false);
			return {
				success: true,
				pathId: pathId,
				indexOf: indexOf,
			};
		}
	}
	catch (err) {
		console.error("Error making new file:", err);
		return {
			success: false,
		};
	}
}

/**
 * Returns 'true' if success, otherwise 'false'
 * 
 * TODO: delete should remove a row from the DB of absolute paths?
 */
async function deleteFile(event, absolutePath, isDirectory) {
	if (!isValidAbsolutePath(absolutePath)) return false;

	try {
		if (isDirectory) {
			fs.rmSync(absolutePath, { recursive: true });
			return true;
		}
		else {
			fs.unlinkSync(absolutePath);
			return true;
		}
	}
	catch (err) {
		console.error("Error deleting file:", err);
		return false;
	}
}
  
/**
 * Returns an object with property named 'success' equal to 'true' if successful, otherwise the property is equal to'false'...
 * ...as well contains a property named 'pathId' for the "absolute path id" of the row in the database that represents the absolute path...
 * ...as well contains a property named 'absolutePath' for the resulting absolute path string.
 * 
 * TODO: rename should remove the previous named path (provided that a change actually occurred)?
 */
async function renameFile(event, absolutePath, filename, isDirectory) {
	if (!isValidAbsolutePath(absolutePath)) return;

	try {
		if (isDirectory) {
			let directory = path.dirname(absolutePath);
			let pathToNewFile = path.join(directory, filename);
			if (fs.existsSync(pathToNewFile)) {
				throw new Error("The desination path '" + pathToNewFile + "' already exists.");
			}
			fs.renameSync(absolutePath, pathToNewFile);
			let pathId = database.addAbsolutePath(pathToNewFile, filename);
			return {
				success: true,
				pathId: pathId,
				absolutePath: pathToNewFile
			};
		}
		else {
			let directory = path.dirname(absolutePath);
			let pathToNewFile = path.join(directory, filename);
			if (fs.existsSync(pathToNewFile)) {
				throw new Error("The desination path '" + pathToNewFile + "' already exists.");
			}
			fs.renameSync(absolutePath, pathToNewFile);
			let pathId = database.addAbsolutePath(pathToNewFile, filename);
			return {
				success: true,
				pathId: pathId,
				absolutePath: pathToNewFile
			};
		}
	}
	catch (err) {
		console.error("Error renaming file:", err);
		return {
			success: false,
			pathId: pathId
		};
	}
}

async function saveFile(event, absolutePath, text) {
	if (!isValidAbsolutePath(absolutePath)) return;

	try {
		// TODO: verify that 'fs.writeFile' won't already throw an exception if file is directory (i.e.: verify that this check is necessary).
		const stats = fs.statSync(absolutePath);
		if (stats.isDirectory()) {
			throw new Error('The destination path is a directory');
		}

		fs.writeFile(absolutePath, text, () => {});
	}
	catch (err) {
		console.error("Error saving file:", err);
		return [];
	}
}

async function editorSaveFile(event, absolutePath, uint8Array, count, EDI_lineEndString, EDI_fileStartsWithBom) {
	if (!isValidAbsolutePath(absolutePath)) return;

	try {
		const stats = fs.statSync(absolutePath);
		if (stats.isDirectory()) {
			throw new Error('The destination path is a directory');
		}

		if (!EDI_lineEndString)
			EDI_lineEndString = '\n';

		fs.writeFile(absolutePath, MAIN_decode_experimental_textonly(uint8Array, /*start*/ 0, count, EDI_lineEndString, EDI_fileStartsWithBom), () => {});
	}
	catch (err) {
		console.error("Error saving file:", err);
		return [];
	}
}

/**
 * Returns an object with property 'success' equal to 'true' if success, otherwise the property is equal to 'false'...
 * ...and other properties as well.
 */
async function copyClipboardAbsolutePathToDirectory(event, directory, menuOptionCut_id) {
	if (!isValidAbsolutePath(directory)) return;

	try {
		let sourceFile = clipboard.readText();
		if (!sourceFile.startsWith('file:///')) {
			throw new Error("The clipboard's text does not start with 'file:///'.");
		}
		let sourceWasMenuOptionCut = sourceFile === menuOptionCut_id;
		sourceFile = sourceFile.substring('file:///'.length);
		if (!fs.existsSync(sourceFile)) {
			throw new Error("The clipboard does not contain a path to a file.");
		}
		if (!isValidAbsolutePath(sourceFile)) return;
		const stats = fs.statSync(sourceFile);
		let filename = path.basename(sourceFile);
		let destinationFile = path.join(directory, filename);
		if (stats.isDirectory()) {
			fs.cpSync(sourceFile, destinationFile, { force: false, errorOnExist: true, recursive: true });
			let pathId = database.addAbsolutePath(destinationFile, filename);
			let sourceFileWasDeleted = false;
			if (sourceWasMenuOptionCut && fs.existsSync(destinationFile)) {
				fs.rmSync(sourceFile, { recursive: true });
				sourceFileWasDeleted = true;
			}
			let indexOf = wrap_readdirSync_indexOf(directory, filename, /*childIsDirectory*/ true);
			return {
				success: true,
				pathId: pathId,
				indexOf: indexOf,
				isDirectory: true,
				sourceFileWasDeleted: sourceFileWasDeleted,
			};
		}
		else {
			fs.copyFileSync(sourceFile, destinationFile, fs.constants.COPYFILE_EXCL);
			let pathId = database.addAbsolutePath(destinationFile, filename);
			let sourceFileWasDeleted = false;
			if (sourceWasMenuOptionCut && fs.existsSync(destinationFile)) {
				fs.unlinkSync(sourceFile);
				sourceFileWasDeleted = true;
			}
			let indexOf = wrap_readdirSync_indexOf(directory, filename, /*childIsDirectory*/ false);
			return {
				success: true,
				pathId: pathId,
				indexOf: indexOf,
				isDirectory: false,
				sourceFileWasDeleted: sourceFileWasDeleted,
			};
		}
	}
	catch (err) {
		console.error("Error copying file:", err);
		return {
			success: false
		};
	}
}

/*
- [ ] classes, if an instance will "always exist" compile two versions:
    - [ ] The baseline always existing will use fieldBuffer.js
	- [ ] Any instance created beyond that as necessary will use fields themselves.
- [ ] all strings can be moved to a fieldBuffer to be stored as the byte representation
    - [ ] If you do this you'd want to from the get-go never introduce the string to begin with unless necessary


TODO: DefinitionClientCapabilities

*/

/* sec0
//========
/*
	TODO: Every IPC from renderer to main should return a result type
	{
		Result: ...,
		State: { cancelled, completed, failed },
		Note: "some string",
	}

	if (aaa.failed) { showNotification(aaa.Note); }

	if (aaa.Result === undefined) {
		// void
	}

	if (aaa.Result === null) {
		// lack of a Result / nullable result
	}
*//*
//========
sec0*/
