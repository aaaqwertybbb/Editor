/*
#################
# Goal of file: #
#################

(Perhaps I'll rename the file to bundler.cjs)

This file takes all of the Electron app's renderer process javascript files
and combines them into a single file named '__PREPROCESSEDbundle__.js'

This file is ran as a prebuild step in package.json.

The generated file named '__PREPROCESSEDbundle__.js'
is then given to babel as the build step
in order to apply the compiler configuration.

# Notes:
- Perhaps I'll rename the file to bundler.cjs
- Preprocessor text token (see "marker details comment" at end of this file) is used to strip out text from a javascript file.
    - in essence: I found that vscode wasn't showing me lsp cross file even if the files were in the same directory, and that directory was part of the workspace.
    - So, I needed to add an import to the top of each file that indicated to vscode what each file was dependent on.
    - This gave me cross file lsp.
    - (note: you probably can put a setting in package.json to do this but I thought it was an interesting problem nevertheless
             so I went about this way cause I'm not writing this code as a "job" I just wanted to do the more interesting thing
             than google for a package.json setting, in a job environment I'd never do most of the things you see me do)
    - But, you don't need the import statements after you've combined them all into a single file.
    - Thus the preprocessor text token wraps the imports so that I can remove them when I combine it all into a single file
*/

const fs = require('fs');
const path = require('path');

const args = process.argv;

let inputFolder;
let outputFile;

let filePriorityOrder;

/** this number is currently entirely arbitrary and has no understanding, measurements, or reasoning behind it. */
const writeBufferCapacity = 8192;
let writeBuffer = new Uint8Array(writeBufferCapacity);
let writeBufferCount = 0;

let emptyLineCount = 0;

let sourceBuffer;
let sourceBufferCount;

let textEncoder = new TextEncoder();

// TODO: Perhaps moving writeBuilder to a "string builder (per character) esque" implementation rather than the writeBuilder being an array of substrings would be more efficient...
// ...especially given that as I add more features to this, the frequency of substrings will likely increase drastically.
// - short term memory allocation indeed can sometimes be sufficient enough.
// - but depending on how large the threshold is for me to flush the content to the file, and how fragmented the substrings are...
//   ...there might be a very large count of allocations sitting in the writeBuilder. I'm not sure one way or another yet.
//   And if there is a large count of allocations sitting in the writeBuilder then they aren't quite as short term.
//   (and yes short term allocations matter too that isn't what I'm trying to say)

try {
    readyFileState();

    let files = getFiles();
    if (files.length === 0) {
        console.log(`No JavaScript files found in ${inputFolder}`);
        process.exitCode = 0;
        return;
    }

    doAllBundleFiles(files);

    console.log(`emptyLineCount: ${emptyLineCount}`);
    console.log(`Successfully bundled ${files.length} files in prioritized order into ${outputFile}`);
}
catch (err) {
    console.error('Bundling failed:', err.message);
    process.exitCode = 1;
}

function doAllBundleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        bundleFile(files[i]);
    }
    flushAppendToFile();
}

function bundleFile(fileName) {

    // # Goals:
    //
    // - [ ] Remove empty lines
    //     - [ ] Remove resulting empty lines
    //         - [ ] "resulting empty lines": If a line contains a single line comment, then due to comments being removed, the resuling line will be empty.
    //     - [ ] Remove lines that only contain whitespace (this includes resulting empty lines that only contain whitespace)
    // - [ ] If the tab size is >2, reduce tab size to 2.
    // - [ ] If the line ending kind is '\r\n', replace it with '\n' (specifically for the goal of halving the size of each line ending kind, so '\r' is fine).
    //     - [ ] some edge case clarification: This is expected to occur within single and multiline comments but NOT strings.
    //     - [ ] Although I suppose a string would be using the escaped character.
    //     - [ ] Short of verbatim multiline strings...
    //     - [ ] TODO: I'm not sure, make a decision on this...
    // 
    // I'm trying to think about how I'd swap the line endings.
    // I think the only sensible answer is to work with the bytes of the text directly.
    // Otherwise if I continue the current pattern I'd be substringing every line of text in order to strip off the line ending
    // With a uint8array I could move the bytes en mass to a buffer and then to string the buffer.

    appendToWriteBuilder_string(`\n\n// ${fileName}\n\n`);

    const filePath = path.join(inputFolder, fileName);
    readTextNoBOM_intoGlobalVariable_sourceBuffer(filePath);
    let pos = 0;

    lexPreprocessorMarker();

    let chunkStart = pos;

    // When you find a line end:
    //     if (lineEndRecent_posExclusive === pos) then you found an empty line.
    //
    // '_posExclusive' permits easy maintaining of the lineEndRecent.
    // 
    // Example:
    // ```
    // apple\r\n
    // \n
    // EOF
    // ```
    // If for some reason you had a file with mixed line endings, and you wanted to maintain that.
    // I would argue that maintenance conventionally ought to be for two characters that were side by side, to remain side by side after the removal of an empty line.
    //
    // Result 1 (correct and conventional):
    // ```
    // apple\r\n
    // EOF
    // ```
    //
    // Result 2 ("correct" but not-conventional):
    // ```
    // apple\n
    // EOF
    // ```
    //
    // Result 3 (flat out erroneous):
    // ```
    // apple\n
    // \n
    // EOF
    // ```
    //

    let seenMeaningfulByteSinceLastLineEnd = false;

    /** pos start lets me easily replace line endings by taking the text up until the start then just manually "inserting" '\n' specifically. */
    let lineEndRecent_posStart = 0;
    /** This not only represents the recent line end. But also the last pos that was exclusively written out because comments need to "clear" the 'lineEndRecent_posEnd'. */
    let lineEndRecent_posEnd = 0;
    //let nonLineEnd_causedEndChunk = false;

    // most recent change undesirably removes indentation, but remains code semantics, if a multiline comment exists as the first instance of text on a line, and meaningful bytes appear on that same line after the multiline comments ends where both the start and end delimiters of the multiline comment were only spanning that single line.
    // You should check whether the destination has a newline to the left of where you're gonna insert to remove the consecutive newlines of the resulting empty lines?


    // I'm scrolling through the entire diff of the previous output and the new output
    // on line 9641 it says a line was added, (and there's more added after that 9642 has a line added, 9643 doesn't then 9644 does and other such changes that don't quite have a pattern) but all in all... why was a line added here?

    while (pos < sourceBufferCount) {
        switch (sourceBuffer[pos]) {
            case 47 /* / */:
                warnPreprocessorTag(" warning: preprocessor mark was found after the first non-whitespace character as a token itself.");
                if (pos <= sourceBufferCount - 2) {
                    if (sourceBuffer[pos + 1] === 47 /* / */) {
                        if (seenMeaningfulByteSinceLastLineEnd) {
                            endChunk();
                        }
                        else {
                            endChunk(lineEndRecent_posStart);
                        }
                        let leftCharacter;
                        if (pos === 0) {
                            leftCharacter = '\n';
                        }
                        else {
                            leftCharacter = sourceBuffer[pos - 1];
                        }
                        lexSingleLineComment();
                        commentEndsInLineEndForceWrite(leftCharacter);
                        startChunk();
                        continue;
                    }
                    else if (sourceBuffer[pos + 1] === 42 /*  * */) {
                        if (seenMeaningfulByteSinceLastLineEnd) {
                            endChunk();
                        }
                        else {
                            endChunk(lineEndRecent_posStart);
                        }
                        let leftCharacter;
                        if (pos === 0) {
                            leftCharacter = '\n';
                        }
                        else {
                            leftCharacter = sourceBuffer[pos - 1];
                        }
                        lexMultiLineComment();
                        commentEndsInLineEndForceWrite(leftCharacter);
                        startChunk();
                        continue;
                    }
                }
                break;
            case 39 /* \' */:
            case 34 /*  " */:
            case 96 /*  ` */:
                seenMeaningfulByteSinceLastLineEnd = true;
                lexString();
                continue;
            case 13 /* \r */:

                let needsToStartChunk = false;
                let aaaShouldSetChunkStart = false;

                if (lineEndRecent_posEnd === pos) {
                    aaaShouldSetChunkStart = handleEmptyLineIfApplicable();
                }
                else {
                    endChunk();
                    appendToWriteBuilder_string('\n');
                    needsToStartChunk = true;
                }

                seenMeaningfulByteSinceLastLineEnd = false;
                lineEndRecent_posStart = pos;
                
                pos++;
                if (pos <= sourceBufferCount - 1 && sourceBuffer[pos] === 10 /* \n */)
                    pos++;

                lineEndRecent_posEnd = pos;
                if (needsToStartChunk) {
                    startChunk();
                }
                else if (aaaShouldSetChunkStart) {
                    chunkStart = lineEndRecent_posEnd;
                }
                continue;
            case 10 /* \n */:
                let bbbShouldSetChunkStart = handleEmptyLineIfApplicable();

                seenMeaningfulByteSinceLastLineEnd = false;
                lineEndRecent_posStart = pos;

                pos++;

                lineEndRecent_posEnd = pos;
                if (bbbShouldSetChunkStart) {
                    chunkStart = lineEndRecent_posEnd;
                }
                continue;
            case 32 /*    */:
            case 9  /* \t */:
                pos++;
                continue;
            default:
                seenMeaningfulByteSinceLastLineEnd = true;
                pos++;
                continue;
        }
        pos++;
    }
    endChunk();

    function startChunk() {
        if (chunkStart !== -1) {
            endChunk();
        }

        chunkStart = pos;
        // Anyone that isn't a line end which invokes endChunk (or downstream causes an invocation) needs to "clear" the 'lineEndRecent_posStart' and 'lineEndRecent_posEnd'.
        seenMeaningfulByteSinceLastLineEnd = false;
        lineEndRecent_posStart = chunkStart;
        lineEndRecent_posEnd = chunkStart;
    }

    function endChunk(overridePos) {
        let localPos;
        if (!overridePos && overridePos !== 0) {
            localPos = pos;
        }
        else {
            localPos = overridePos;
        }

        if (chunkStart < localPos) {
            //// Anyone that isn't a line end which invokes endChunk (or downstream causes an invocation) needs to "clear" the 'lineEndRecent_posEnd'.
            //lineEndRecent_posEnd = localPos;
            appendToWriteBuilder_byteSpan_fromSource(chunkStart, localPos);
        }
        chunkStart = -1;
    }

    /**
     * message should start with a space character and be something of the pattern
     * " warning: preprocessor mark was found after the first non-whitespace character as a token itself."
     */
    function warnPreprocessorTag(message) {
        if (sourceBuffer[pos] === 47 /* / */ && pos <= sourceBufferCount - 7 && sourceBuffer[pos + 1] === 47 /* / */ && sourceBuffer[pos + 2] === 95 /* _ */ && sourceBuffer[pos + 3] === 95 /* _ */ && sourceBuffer[pos + 4] === 35 /* # */ && sourceBuffer[pos + 5] === 95 /* _ */ && sourceBuffer[pos + 6] === 95 /* _ */) {
            console.log(filePath + message);
        }
    }

    function lexString() {
        let terminator = sourceBuffer[pos];
        pos++;
        stringWhile: while (pos < sourceBufferCount) {
            switch (sourceBuffer[pos]) {
                case 92 /* \\ */:
                    pos++;
                    if (pos <= sourceBufferCount - 1) {
                        pos++;
                    }
                    continue;
                case 47 /* / */:
                    warnPreprocessorTag(`warning: preprocessor mark was found after the first non-whitespace character within a string which has the terminator ${terminator}.`);
                    pos++;
                    continue;
                case 13 /* \r */:
                    endChunk();
                    appendToWriteBuilder_string('\n');
                    pos++;
                    if (pos <= sourceBufferCount - 1 && sourceBuffer[pos + 1 === 10 /* \n */]) {
                        pos++;
                    }
                    startChunk();
                    continue;
                case 10 /* \n */:
                    pos++;
                    continue;
                case 39 /* \' */:
                    pos++;
                    if (39 /* \' */ === terminator) break stringWhile;
                    else continue;
                case 34 /*  " */:
                    pos++;
                    if (34 /*  " */ === terminator) break stringWhile;
                    else continue;
                case 96 /*  ` */:
                    pos++;
                    if (96 /*  ` */ === terminator) break stringWhile;
                    else continue;
                default:
                    pos++;
                    continue;
            }
        }
    }

    function lexSingleLineComment() {
        pos += 2;
        singleLineCommentWhile: while (pos < sourceBufferCount) {
            switch (sourceBuffer[pos]) {
                case 47 /* / */:
                    warnPreprocessorTag(" warning: preprocessor mark was found after the first non-whitespace character within a single line comment.");
                    break;
                // Single line comments cannot delete their ending newline character(s) otherwise a line ending of just '\n' or just '\r' would result in:
                // ```
                // let x = 2; // set x to 2
                // return x + 1;
                // ```
                //
                // Would become:
                // ```
                // let x = 2; return x + 1;
                // ```
                case 13 /* \r */:
                case 10 /* \n */:
                    break singleLineCommentWhile;
            }
            pos++;
        }
    }

    function lexMultiLineComment() {
        pos += 2;
        multiLineCommentWhile: while (pos < sourceBufferCount) {
            switch (sourceBuffer[pos]) {
                case 47 /*  / */:
                    warnPreprocessorTag(" warning: preprocessor mark was found after the first non-whitespace character within a multi line comment.");
                    break;
                case 42 /*  * */:
                    if (pos <= sourceBufferCount - 2) {
                        if (sourceBuffer[pos + 1] === 47 /* / */) {
                            pos += 2;
                            break multiLineCommentWhile;
                        }
                    }
                    break;
            }
            pos++;
        }

        if (pos <= sourceBufferCount - 1 &&
            (sourceBuffer[pos] !== 32 /*    */ &&
             sourceBuffer[pos] !== 9  /* \t */ &&
             sourceBuffer[pos] !== 13 /* \r */ &&
             sourceBuffer[pos] !== 10 /* \n */ &&
             sourceBuffer[pos] !== 41 /*  ) */ &&
             sourceBuffer[pos] !== 58 /*  : */)) {
                // TODO: '/*y*//*x*/' becomes two spaces...
                // ...most optimally this would be only 1 space.
                appendToWriteBuilder_string(' ');
        }
    }

    /** return 'true' if invoker should update 'chunkstart' to be the end position of the newline. */
    function handleEmptyLineIfApplicable() {
        if (lineEndRecent_posEnd === pos) {
            emptyLineCount++;
            if (chunkStart < lineEndRecent_posEnd)
            {
                endChunk(lineEndRecent_posStart);
                appendToWriteBuilder_string('\n');
                // bad code yikes: start chunk with an active chunk therefore isn't an equivalent operation as endChunk into startChunk... now that you've added lineEndRecent_posEnd override... ugh...
                startChunk(); 
            }
            else
            {
                return true;
            }
            // else chunkstart = the new one the new end
        }
        return false;
    }

    /**
     * If a comment ends with a lineEnd you have to write it because it at times might be a necessary whitespace that separates two identifiers.
     * Without this the code sees an empty line.
     */
    function commentEndsInLineEndForceWrite(leftByte) {
        if (pos <= sourceBufferCount - 1) {
            if (sourceBuffer[pos] === 13 /* \r */) {
                pos++;
                if (pos <= sourceBufferCount - 1 && sourceBuffer[pos] === 10 /* \n */) {
                    pos++;
                    if (leftByte !== 10 /* \n */ && leftByte !== 13 /* \r */) {
                        appendToWriteBuilder_string('\n'); // 10 /* \n */
                    }
                }
                else {
                    if (leftByte !== 10 /* \n */ && leftByte !== 13 /* \r */) {
                        appendToWriteBuilder_string('\n'); // 10 /* \n */
                    }
                }
            }
            else if (sourceBuffer[pos] === 10 /* \n */) {
                pos++;
                if (leftByte !== 10 /* \n */ && leftByte !== 13 /* \r */) {
                    appendToWriteBuilder_string('\n'); // 10 /* \n */
                }
            }
        }
    }

    function lexPreprocessorMarker() {
        // 0 => None
        // 1 => StartFound
        // 2 => EndFound
        let preprocessorMarkerContext = 0;

        markerWhileLoop: while (pos < sourceBufferCount) {
            switch (sourceBuffer[pos]) {
                /* see "marker details comment" at end of this file */
                case 47 /* / */:
                    /** @type {boolean} */
                    let meetsNewLineRequirement;
                    if (pos > 0) {
                        meetsNewLineRequirement = sourceBuffer[pos - 1] === 13 /* \r */ || sourceBuffer[pos - 1] === 10 /* \n */;
                    }
                    else {
                        meetsNewLineRequirement = true;
                    }

                    if (pos <= sourceBufferCount - 7 &&
                        sourceBuffer[pos + 1] === 47 /* / */ &&
                        sourceBuffer[pos + 2] === 95 /* _ */ &&
                        sourceBuffer[pos + 3] === 95 /* _ */ &&
                        sourceBuffer[pos + 4] === 35 /* # */ &&
                        sourceBuffer[pos + 5] === 95 /* _ */ &&
                        sourceBuffer[pos + 6] === 95 /* _ */) {
                        if (preprocessorMarkerContext === 0) {
                            if (meetsNewLineRequirement) {
                                pos += 7;
                                preprocessorMarkerContext = 1; // StartFound
                                continue;
                            }
                            else {
                                console.log('warning failed newline requirement => break markerWhileLoop;');
                                break markerWhileLoop;
                            }
                        }
                        else {
                            if (meetsNewLineRequirement) {
                                pos += 7;
                                preprocessorMarkerContext = 2; // EndFound
                                break markerWhileLoop;
                            }
                            else {
                                console.log('warning failed newline requirement => skipped this match because it did not start at a newline.');
                                pos += 7;
                                break;
                            }
                        }
                    }
                    else {
                        if (preprocessorMarkerContext === 0) {
                            break markerWhileLoop;
                        }
                        else {
                            pos++;
                            break;
                        }
                    }
                    break;
                case ' ':
                case 9  /* \t */:
                case 13 /* \r */:
                case 10 /* \n */:
                    pos++;
                    break;
                default:
                    if (preprocessorMarkerContext === 0) {
                        break markerWhileLoop;
                    }
                    else {
                        pos++;
                        break;
                    }
            }
        }

        if (preprocessorMarkerContext === 0) {
            pos = 0;
        }
        else if (preprocessorMarkerContext === 1 /*StartFound*/) {
            // Then the end was never found
            //
            // This is an Error because it is very specific, for some reason the file started with '//__#__'.
            // And it was inside my 'RendererFiles' folder, so what's going on?
            //
            // When it comes to '//__#__' being lexed after the first non-whitespace character
            // that feels far too vague to permit it being an error.
            //
            throw new Error(`${filePath} => if (preprocessorMarkerContext === 1 /*StartFound*/)`);
        }
    }
}

function appendToWriteBuilder_string(str) {
    let len = str.length;
    if (len > writeBufferCapacity) {
        throw new Error('TODO: set over more than one invocation because the string to insert is larger than the buffer.');
    }
    if (writeBufferCount + len > writeBufferCapacity) {
        flushAppendToFile();
    }
    textEncoder.encodeInto(str, writeBuffer.subarray(writeBufferCount, writeBufferCount + len));
    writeBufferCount += len;
}

function appendToWriteBuilder_byteSpan_fromSource(sourceStart, sourceEnd, destinationOffset) {
    //try {
        let len = sourceEnd - sourceStart;
        if (len > writeBufferCapacity) {
            throw new Error('TODO: set over more than one invocation because the string to insert is larger than the buffer.');
        }
        if (writeBufferCount + len > writeBufferCapacity) {
            flushAppendToFile();
        }
        writeBuffer.set(sourceBuffer.subarray(sourceStart, sourceEnd), writeBufferCount);
        writeBufferCount += len;
    //}
    //catch (error) {
    //    let a = 2;
    //    //throw;
    //}
}

function flushAppendToFile() {
    fs.appendFileSync(outputFile, writeBuffer.subarray(0, writeBufferCount), 'utf8');
    writeBufferCount = 0;
}

/**
 * started off with code snippet from Google AI Overview for "node fs determine if file has bom":
 * 
 * Copy, pasted, modified; from main.csj originally named 'hasBOM(...)'
 */
function readTextNoBOM_intoGlobalVariable_sourceBuffer(filePath) {
    // Use a small buffer to read just the first 3-4 bytes
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);

    let stat = fs.statSync(filePath);

    // Check for common BOM signatures
    // UTF-8: EF BB BF
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        sourceBufferCount = stat.size - 4;
        sourceBuffer = Buffer.alloc(sourceBufferCount);
        fs.readSync(fd, sourceBuffer, 0, sourceBuffer.length, 3);
        fs.closeSync(fd);
    }
    else {
        sourceBufferCount = stat.size;
        sourceBuffer = Buffer.alloc(sourceBufferCount);
        fs.readSync(fd, sourceBuffer, 0, sourceBuffer.length, 0);
        fs.closeSync(fd);
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

/**
 * These functions are at the bottom, as opposed to the order that the functions are invoked (which would place these as some of the first function definitions)
 * due to their extremely unimportant nature beyond initialization. Thus I don't want to have to constantly scroll past them.
 */
function readyFileState() {
    if (args[2] === 'test') {
        inputFolder = './src/Test';
        outputFile = './preprocessor/testPREPROCESSEDbundletest.js';
    }
    else {
        inputFolder = './src/RendererFiles';
        outputFile = './preprocessor/__PREPROCESSEDbundle__.js';
    }

    // 1. Define the exact loading priority order
    filePriorityOrder = [
        "fieldBuffer.js",
        "header_editorGlobal_header.js",
        "widgetGlobal.js",
        "menuGlobal.js",
        "dialogGlobal.js",
        "trackedSyntaxTypes.js",
        "treeViewComponent.js",
        "dialogImplementationsGlobal.js",
        "listComponent.js",
        "listTypes.js",
        "editorGlobal.js",
        "javascriptFeatures.js",
        "explorerGlobal.js",
        "applicationRendererRoot.js"
    ];

    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, '');
}

/**
 * These functions are at the bottom, as opposed to the order that the functions are invoked (which would place these as some of the first function definitions)
 * due to their extremely unimportant nature beyond initialization. Thus I don't want to have to constantly scroll past them.
 */
function getFiles() {
    let files = fs.readdirSync(inputFolder).filter(file => file.endsWith('.js'));

    files.sort((a, b) => {
        const indexA = filePriorityOrder.indexOf(a);
        const indexB = filePriorityOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return files;
}

/*
# marker details comment

- [x] The marker is specifically "//__#__" being the first non-whitespace found in a text file and at the start of a new line.
      - [ ] It doesn't have to start at character index 0, but it needs to appear prior to any other text and at the start of a new line.
      - [x] An error if "//__#__" was the first non-whitespace in a file, but an ending marker of the same text was never encountered.
      - [x] A warning message is written to the console if "//__#__" is found at any location other than what was just described.
          - [x] as a token itself
          - [x] as part of a single line comment
          - [x] as part of a multi line comment
          - [x] as part of a string
      - [ ] Only 1 of them per file is supported.
      - [ ] The main idea is to permit javascript header files.
      - [ ] I'm not getting lsp results in vscode unless I add an import, but I don't need the import when I smush it all into 1 file.
      - [ ] TODO: If this throws an error, bable shouldn't be ran; it currently is not working this way.
      - [ ] It needs to start the line

      //__#__
      // preprocessor.cjs
      import "./javascriptFeatures";
      //__#__
*/
