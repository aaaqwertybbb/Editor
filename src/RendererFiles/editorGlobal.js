//__#__
// preprocessor.cjs
import "./fieldBuffer"
import "./javascriptFeatures"
//__#__

// Extremely important softlock possibility: see documentation comment for 'EDI_finalizeEdit()'.
// Retrospectively I'd say... I imagine there'd be more than one scenario of this I have a lot of 'critical booleans'.
// i.e.: if you enter the 'critical boolean guarded code path' then throw an exception in the middle of that code path with bad state for the 'critical boolean guarded code path' you might never be able to enter it again.
// i.e.: I don't see this happen myself unless I'm messing with new code and running the code that I am in progress of writing. But I don't have a try catch so if an error were to occur it'd completely softlock things.

/*
###################################
# Wording related to "indexLine": #
###################################

- indexLine        // The line number of '1' corresponds to the '0' indexLine; The end position of this line is located at index '0' within 'EDI_lineEndPositionList'.
- virtualIndexLine // If you map the indexLine to an index that exists from virtualIndex to (virtualIndex + virtualCount - 1); both sides are inclusive;
                   // Then you could imagine that the UI has HTML divs available to be rendered into.
                   // And that this 'virtualIndexLine' says: "given my indexLine, is this being shown in the UI?"
                   // BUT there is more to this, you next have to consider the position of the ringBuffer.

Why is it not a 'lineIndex' wording pattern?

It tends to be the case that you are working with an 'index'
so the inclusion of that word is rather unimportant when reading over the code.

I actually think 'lineIndex' "rolls off the tongue" a little easier.
But if you apply the pattern it hides the word 'line'.
And the importance when reading the code lies with the words 'line' and 'column'.

- [ ] When getting the ringBufferIndex of anything that follows this pattern you don't check whether the underlying data has a large enough count, it is solely related to whether the itemHeight and height of the element can fit "that many divs".
    - [ ] TreeView
    - [ ] List
- [ ] When creating divs for the viewport you follow up by drawing the viewport afterwards.
    - [ ] Thus the creation of divs ought to be fully ignoring any excessive calculations because its style is just overriden immediately afterwards.
*/

/*
###################################################################
# Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex': #
###################################################################

// TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'...
// ...the initial declaration of 'let ringBufferIndex' is assigned what I refer to as the "virtualIndex"
// but 'ringBufferIndex' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
// for the calculation. So by storing the 'virtualIndex' in 'ringBufferIndex' at the start I skip a variable declaration.
|
(retrospective comment): I see what I was doing.
It isn't just the single variable declaration.
You can't do the modulo logic UNLESS the virtual index is valid (that the line of text is actually being drawn in the UI).
BUT I think this was an assumption on my end.
I wonder if the modulo math would work out such that I could...
well I guess I'd need to add an if to verify that the modulo math went correctly
thus the same thing happens but now I can't just re-use that I'm virtual index first then you're safe thus the if else part...
*/

const EDI_trackedSyntaxList = new TrackedSyntaxList(32);

/**
 * @type {UInt32List}
 */
let EDI_findOverlay_searchResultPositionList = null;

let EDI_textByteList_capacity = 1024;
let EDI_textByteList_bytes = new Uint8Array(EDI_textByteList_capacity);
let EDI_textByteList_count = 0;
/**
 * Does not clear the information, only sets 'EDI_textByteList_count' to '0'.
 */
function EDI_textByteList_clear() {
    EDI_textByteList_count = 0;
}
/**
 * TODO: ensure all the parameters are encoded, especially because I'm noticing myself forgetting.
 */
function EDI_textByteList_insert(index, byte) {
    EDI_textByteList_ensureCapacityForInsertion(index, 1);

    if (index !== EDI_textByteList_count) {
        EDI_textByteList_copyTo(EDI_textByteList_bytes, index, EDI_textByteList_bytes, index + 1, EDI_textByteList_count - index);
    }

    EDI_textByteList_bytes[index] = byte;

    EDI_textByteList_count++;
}
function EDI_textByteList_insertString(index, string, encoder) {
    EDI_textByteList_ensureCapacityForInsertion(index, string.length);

    if (index !== EDI_textByteList_count) {
        EDI_textByteList_copyTo(EDI_textByteList_bytes, index, EDI_textByteList_bytes, index + string.length, EDI_textByteList_count - index);
    }

    for (var i = 0; i < string.length; i++) {
        EDI_textByteList_bytes[index + i] = encoder.encode(string[i]);
    }

    EDI_textByteList_count += string.length;
}
/**
 * @param {number} index 
 * @param {Uint8Array} incomingBs the incoming bytes, name avoids confusion with EDI_textByteList_bytes
 * @param {number} offset the offset to begin reading from
 * @param {number} length the amount of bytes to read
 */
function EDI_textByteList_insertBytes(index, incomingBs, offset, length) {
    EDI_textByteList_ensureCapacityForInsertion(index, length);

    if (index !== EDI_textByteList_count) {
        EDI_textByteList_copyTo(EDI_textByteList_bytes, index, EDI_textByteList_bytes, index + length, EDI_textByteList_count - index);
    }

    // TODO: this is wrong use set
    for (var i = 0; i < length; i++) {
        EDI_textByteList_bytes[index + i] = incomingBs[offset + i];
    }

    EDI_textByteList_count += length;
}
/**
 * Does not clear trailing information.
 * 
 * count === 0 immediately returns
 */
function EDI_textByteList_removeAt(index, count) {
    if (index > EDI_textByteList_count) { throw new Error('removeAt(...): index > EDI_textByteList_count'); }
    if (index + count > EDI_textByteList_count) { throw new Error('removeAt(...): index + count > EDI_textByteList_count'); }
    if (count === 0) { return; }

    if (index + count === EDI_textByteList_count) {
        let shiftableCount = EDI_textByteList_count - (index + count);
        if (shiftableCount > 0) {
            EDI_textByteList_copyTo(
                EDI_textByteList_bytes,
                index + count,
                EDI_textByteList_bytes,
                index,
                shiftableCount);
        }
    }
    else {
        EDI_textByteList_copyTo(
            EDI_textByteList_bytes,
            index + count,
            EDI_textByteList_bytes,
            index,
            EDI_textByteList_count - (index + count));
    }

    EDI_textByteList_count -= count;
}
/**
 * 
 * @param {number} sourceStart 
 * @param {number} destinationStart 
 * @param {number} length 
 */
function EDI_textByteList_duplicateWithin(sourceStart, destinationStart, length) {
    if (sourceStart + length > destinationStart) {
        // TODO: This perhaps could result in the initial 'copyTo' step that creates space within the array, having clobbered the source.
        //
        // TODO: I'm gonna throw an error if 'sourceStart + length > destinationStart' that should let me do the simple duplicate case and then go from there.
        //
        // TODO: When copying text you only need to remember the positions maybe, and then if the user loses focus of the app...
        // ...only then would you need to create text from their selection in case they intend to paste to an external app...
        // ...otherwise paste could just be a copyWithin if copy and paste only occurs within the app itself?
        //
        throw new Error('TODO: sourceStart + length > destinationStart');
    }

    EDI_textByteList_ensureCapacityForInsertion(destinationStart, length);

    if (destinationStart !== EDI_textByteList_count) {
        EDI_textByteList_copyTo(EDI_textByteList_bytes, destinationStart, EDI_textByteList_bytes, destinationStart + length, EDI_textByteList_count - destinationStart);
    }

    EDI_textByteList_copyTo(EDI_textByteList_bytes, sourceStart, EDI_textByteList_bytes, destinationStart, length);

    EDI_textByteList_count += length;
}
/**
 * - If the size asked for cannot be allocated, an exception will be thrown. (presumably the wording "thrown by the runtime" is involved.)
 * - JavaScript numbers do not wrap around to negative values when the value is very large.
 *       They instead approach infinity and lose precision.
 *       - There still is a check for whether the new, expected to be larger, capacity is smaller for whatever reason.
 *         Since this ought to be a negligible check for this method to perform.
 *         And failure to catch that case if it happens is an infinite loop.
 */
//function EDI_textByteList_ensureCapacityForInsertion(index, count) {
//    let capacityPrevious = EDI_textByteList_capacity;
//    while (true) {
//        if (EDI_textByteList_count + count > EDI_textByteList_capacity) {
//            EDI_textByteList_doubleCapacity();
//        }
//        else if (index >= EDI_textByteList_capacity) {
//            EDI_textByteList_doubleCapacity();
//        }
//        else {
//            break;
//        }
//
//        if (EDI_textByteList_capacity === capacityPrevious) {
//            break;
//        }
//        if (EDI_textByteList_capacity < capacityPrevious) {
//            throw new Error('ensureCapacityForInsertion(...): EDI_textByteList_capacity < capacityPrevious');
//        }
//
//        capacityPrevious = EDI_textByteList_capacity;
//    }
//}
//function EDI_textByteList_doubleCapacity() {
//    let capacityNew = EDI_textByteList_capacity * 2;
//    let bytesNew = new Uint8Array(capacityNew);
//    EDI_textByteList_copyTo(EDI_textByteList_bytes, 0, bytesNew, 0, EDI_textByteList_count);
//    EDI_textByteList_bytes = bytesNew;
//    EDI_textByteList_capacity = capacityNew;
//}
function EDI_textByteList_ensureCapacityForInsertion(index, count) {
    // TODO: sparse insertions?
    const requiredCapacity = Math.max(EDI_textByteList_count + count, index);
    
    // If we already have enough capacity, do absolutely nothing
    if (requiredCapacity <= EDI_textByteList_capacity) {
        return;
    }

    // Calculate the new capacity by doubling until it fits
    let capacityNew = EDI_textByteList_capacity || 1; // Prevent infinite loops if capacity is 0
    while (capacityNew < requiredCapacity) {
        capacityNew *= 2;
    }

    // Safety check against integer overflow / negative bounds
    if (capacityNew < EDI_textByteList_capacity) {
        throw new Error('ensureCapacityForInsertion(...): Capacity overflowed or went negative');
    }

    // Allocate and copy EXACTLY ONCE
    let bytesNew = new Uint8Array(capacityNew);
    EDI_textByteList_copyTo(EDI_textByteList_bytes, 0, bytesNew, 0, EDI_textByteList_count);
    
    // Commit the changes to your global/module state
    EDI_textByteList_bytes = bytesNew;
    EDI_textByteList_capacity = capacityNew;
}
/**
 * inclusive/exclusive
 */
function EDI_textByteList_copyTo(bytesSource, sourceStart, bytesDestination, destinationStart, length) {
    if (bytesSource === bytesDestination) {
        if (bytesSource !== EDI_textByteList_bytes) {
            throw new Error('bytesSource === bytesDestination ; but bytesSource !== EDI_textByteList_bytes');
        }

        EDI_textByteList_bytes.copyWithin(destinationStart, sourceStart, sourceStart + length);
    }
    else {
        // TODO: use 'set' method here and other such locations
        for (var i = 0; i < length; i++) {
            bytesDestination[destinationStart + i] = bytesSource[sourceStart + i];
        }
    }
}

const EDI_encoder = new TextEncoder();
const EDI_decoder = new TextDecoder();

let gutterWidthTotal_withPxUnits = '';

/** This is likely a decimal value once it gets measured for real, do not try to put it in an int container. */
let EDI_characterWidth = 8;

/**
 * When this is cleared the information is not removed, only 'gapBufferCount' is set to 0.
 */
const EDI_cursor_gapBuffer = new Uint8Array(CONST_EDI_cursor_GAP_BUFFER_CAPACITY);

let EDI_cursor_gapBufferWriteToSpanElement = null;

const EDI_cursor_caretRow = document.createElement('div');
EDI_cursor_caretRow.id = "EDI_caretRow-1";
EDI_cursor_caretRow.className = "EDI_caretRow";
EDI_cursor_caretRow.style.left = gutterWidthTotal_withPxUnits;
if (EDI_horizontal_scrollbar_virtualization_boundary) {
    EDI_cursor_caretRow.style.width = EDI_horizontal_scrollbar_virtualization_boundary.style.width;
}

const EDI_cursor_cursorElement = document.createElement('div');
EDI_cursor_cursorElement.id = "EDI_cursor-1";
EDI_cursor_cursorElement.className = "EDI_cursor";

EDI_cursor_caretRow.appendChild(EDI_cursor_cursorElement);

/**
 * Upon an enter keystroke this is inserted onto the newly added line.
 * 
 * The value is stored here to avoid high overhead from indentation matching when holding down the Enter key.
 * 
 * TODO: ^ that being said, you preferably wouldn't store this string allocation long term. If a more "localized" caching can be implemented, that would be preferable. (or the timing upon which this is set to null)
 * 
 * TODO: Don't null this just change the count to 0 and use a separate bool to indicate "nullness". UNLESS if clearing cache and this is for some reason MASSIVE idk maybe > 256 then maybe clear it idk
 * 
 * TODO: clear these when setting text, if not already? My code isn't working so I can't give a better TODO than this
 * 
 * @type {ByteList | null}
 */
let EDI_cursor_enterKey_newLinePlusIndentation_byteList = null;

let EDI_cursor_cached_indentation_string = null;

/**
 * This purposefully avoids the wording "edit length" in order to avoid accident / confusing / hard to read code
 * but in simplest terms this variable is the resulting 'editLength' that existed after a delete or backspace removed a line end.
 * 
 * This way you can always just check whether the "sub length" which is relative to the edit_flagLineChanged has removed all the
 * text that other line that you landed on without having yet finalized.
 */
let EDI_cursor_edit_flagLineChanged = -1;

/**
 * TODO: Consider putting this at the editor level and then delay setting it to null until all cursors have made use of it?...
 * ...an NRE is thrown with this at the editor level so I'm moving it per cursor but...
 * Then again it is only multiple references, not multiple separate objects...
 */
let EDI_cursor_EDI_paste_clipboardContent = null;

const EDI_debug = document.getElementById('EDI_debug');
const EDI_findOverlay = document.getElementById('EDI_findOverlay');
EDI_findOverlay.style.visibility = 'hidden';

const EDI_gutterBackgroundColor = document.getElementById('EDI_gutter_background_color');

/**
 * TODO: This used to be const so make sure you check all the references that they weren't relying on that for either behavior or optimization.
 * TODO: Prior to this changing you need to finalize the edits
 */
let EDI_on_tab_bytes = new Uint8Array(1);
EDI_on_tab_bytes[0] = CONST_EDI_ASCII_TAB;
INTS[fEDI_ontab_visualWidth_perCharacter] = 4;

/**
 * When a cursor removes a line end the position of the line end is stored in this list until the edit is finalized.
 */
const EDI_lineEndPositionList_PENDING = new UInt32List(128);

let EDI_lineEndPositionList_capacity = 128;
/**
 * IMPORTANT: use EDI_readLineEndPositionList(...) rather than indexing into this directly...
 * ...due to the possibility of pending edits.
 */
let EDI_lineEndPositionList_data = new Uint32Array(EDI_lineEndPositionList_capacity);
let EDI_lineEndPositionList_count = 0;
/**
 * Does not clear the information, only sets 'EDI_lineEndPositionList_count' to '0'.
 */
function EDI_lineEndPositionList_clear() {
    EDI_lineEndPositionList_count = 0;
}
/**
 * TODO: ensure all the parameters are encoded, especially because I'm noticing myself forgetting.
 */
function EDI_lineEndPositionList_insert(index, int32Value) {
    EDI_lineEndPositionList_ensureCapacityForInsertion(index, 1);

    if (index !== EDI_lineEndPositionList_count) {
        EDI_lineEndPositionList_copyTo(EDI_lineEndPositionList_data, index, EDI_lineEndPositionList_data, index + 1, EDI_lineEndPositionList_count - index);
    }

    EDI_lineEndPositionList_data[index] = int32Value;

    EDI_lineEndPositionList_count++;
}
/**
 * Does not clear trailing information.
 * 
 * count === 0 immediately returns
 */
function EDI_lineEndPositionList_removeAt(index, count) {
    if (index > EDI_lineEndPositionList_count) { throw new Error('removeAt(...): index > EDI_lineEndPositionList_count'); }
    if (index + count > EDI_lineEndPositionList_count) { throw new Error('removeAt(...): index + count > EDI_lineEndPositionList_count'); }
    if (count === 0) { return; }

    if (index + count === EDI_lineEndPositionList_count) {
        let shiftableCount = EDI_lineEndPositionList_count - (index + count);
        if (shiftableCount > 0) {
            EDI_lineEndPositionList_copyTo(
                EDI_lineEndPositionList_data,
                index + count,
                EDI_lineEndPositionList_data,
                index,
                shiftableCount);
        }
    }
    else {
        EDI_lineEndPositionList_copyTo(
            EDI_lineEndPositionList_data,
            index + count,
            EDI_lineEndPositionList_data,
            index,
            EDI_lineEndPositionList_count - (index + count));
    }

    EDI_lineEndPositionList_count -= count;
}
/**
 * - If the size asked for cannot be allocated, an exception will be thrown. (presumably the wording "thrown by the runtime" is involved.)
 * - JavaScript numbers do not wrap around to negative values when the value is very large.
 *       They instead approach infinity and lose precision.
 *       - There still is a check for whether the new, expected to be larger, capacity is smaller for whatever reason.
 *         Since this ought to be a negligible check for this method to perform.
 *         And failure to catch that case if it happens is an infinite loop.
 */
//function EDI_lineEndPositionList_ensureCapacityForInsertion(index, count) {
//    let capacityPrevious = EDI_lineEndPositionList_capacity;
//    // TODO: what??? do you have to allocate and copy over and over like this? can you make a variable and check if the variable hits > and only then you allocate and copy?
//    while (true) {
//        if (EDI_lineEndPositionList_count + count > EDI_lineEndPositionList_capacity) {
//            EDI_lineEndPositionList_doubleCapacity();
//        }
//        else if (index >= EDI_lineEndPositionList_capacity) {
//            EDI_lineEndPositionList_doubleCapacity();
//        }
//        else {
//            break;
//        }
//
//        if (EDI_lineEndPositionList_capacity === capacityPrevious) {
//            break;
//        }
//        if (EDI_lineEndPositionList_capacity < capacityPrevious) {
//            throw new Error('ensureCapacityForInsertion(...): EDI_lineEndPositionList_capacity < capacityPrevious');
//        }
//
//        capacityPrevious = EDI_lineEndPositionList_capacity;
//    }
//}
//function EDI_lineEndPositionList_doubleCapacity() {
//    let capacityNew = EDI_lineEndPositionList_capacity * 2;
//    let bytesNew = new Uint32Array(capacityNew);
//    EDI_lineEndPositionList_copyTo(EDI_lineEndPositionList_data, 0, bytesNew, 0, EDI_lineEndPositionList_count);
//    EDI_lineEndPositionList_data = bytesNew;
//    EDI_lineEndPositionList_capacity = capacityNew;
//}
function EDI_lineEndPositionList_ensureCapacityForInsertion(index, count) {
    // TODO: sparse insertions?
    const requiredCapacity = Math.max(EDI_lineEndPositionList_count + count, index);
    
    // If we already have enough capacity, do absolutely nothing
    if (requiredCapacity <= EDI_lineEndPositionList_capacity) {
        return;
    }

    // Calculate the new capacity by doubling until it fits
    let capacityNew = EDI_lineEndPositionList_capacity || 1; // Prevent infinite loops if capacity is 0
    while (capacityNew < requiredCapacity) {
        capacityNew *= 2;
    }

    // Safety check against integer overflow / negative bounds
    if (capacityNew < EDI_lineEndPositionList_capacity) {
        throw new Error('ensureCapacityForInsertion(...): Capacity overflowed or went negative');
    }

    // Allocate and copy EXACTLY ONCE
    let dataNew = new Uint32Array(capacityNew);
    EDI_lineEndPositionList_copyTo(EDI_lineEndPositionList_data, 0, dataNew, 0, EDI_lineEndPositionList_count);
    
    // Commit the changes to your global/module state
    EDI_lineEndPositionList_data = dataNew;
    EDI_lineEndPositionList_capacity = capacityNew;
}
/**
 * inclusive/exclusive
 */
function EDI_lineEndPositionList_copyTo(bytesSource, sourceStart, bytesDestination, destinationStart, length) {
    if (bytesSource === bytesDestination) {
        if (bytesSource !== EDI_lineEndPositionList_data) {
            throw new Error('bytesSource === bytesDestination ; but bytesSource !== EDI_lineEndPositionList_data');
        }

        EDI_lineEndPositionList_data.copyWithin(destinationStart, sourceStart, sourceStart + length);
    }
    else {
        // TODO: use 'set' method here and other such locations
        for (var i = 0; i < length; i++) {
            bytesDestination[destinationStart + i] = bytesSource[sourceStart + i];
        }
    }
}

let EDI_textSourceIdentifier = '';
let EDI_FORMATTED_textSourceIdentifier = '';

let EDI_lineEndString = null;

let EDI_documentSymbolResult = null;
/**
 * @type {ListComponent}
 */
let EDI_listComponent = null;

let w_span = null;
let w_div = null;

/**
 * This queueing is currently a complete copy and paste of what Google AI generated.
 * I looked it over and it appears correct.
 */
const lspQueue = [];

const EDI_renderKindArray = [];

// Persistent, flat JS arrays that stay alive forever in memory
let EDI_ringBuffer_gutter = [];
let EDI_ringBuffer_text = [];

let EDI_language_line_lex = null;

function EDI_cursor_hasSelection() {
    return INTS[fEDI_cursor_selectionAnchor] >= 0 &&
            INTS[fEDI_cursor_selectionEnd] >= 0 &&
            INTS[fEDI_cursor_selectionAnchor] != INTS[fEDI_cursor_selectionEnd];
}

/**
 * The code that clears the editor is dependent on this method NOT clearing 'BYTES[byteEDI_cursor_selectionDivExists]'
 * 
 * Somewhat duplicated code: This messes with the language features if I invoke clear() in the constructor, it puts "| undefined" on all the types.
 */
function EDI_cursor_clear() {
    INTS[fEDI_cursor_indexLine] = 0;
    INTS[fEDI_cursor_indexColumn] = 0;
    INTS[fEDI_cursorVisualColumnIndex] = 0;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = 0;
    INTS[fEDI_cursor_STORED_indexColumn] = 0;
    INTS[fEDI_cursor_cursorTranslateYValue] = 0;
    INTS[fEDI_cursor_cursorTranslateXValue] = 0;
    INTS[fEDI_cursor_selectionAnchor] = 0;
    INTS[fEDI_cursor_selectionEnd] = 0;
    INTS[fEDI_cursor_DRAWN_selectionAnchor] = 0;
    INTS[fEDI_cursor_DRAWN_selectionEnd] = 0;
    INTS[fEDI_cursor_DRAWN_selection_virtualIndexLine] = 0;
    INTS[fEDI_cursor_DRAWN_selection_virtualCount] = 0;
    INTS[fEDI_cursor_editKind] = EditKind_None;
    INTS[fEDI_cursor_editLength] = 0;
    INTS[fEDI_cursor_editPosition] = 0;
    INTS[fEDI_cursor_editIndexLine] = 0;
    INTS[fEDI_cursor_editIndexColumn] = 0;
    INTS[fEDI_cursor_editRenderedDisplacement] = 0;
    INTS[fEDI_cursor_editRenderedDisplacement_INDEX_LINE_OFFSET] = 0;
    INTS[fEDI_cursor_END_editIndexLine] = 0;
    INTS[fEDI_cursor_END_editIndexColumn] = 0;

    INTS[fEDI_cursor_gapBufferCount] = 0;

    EDI_cursor_enterKey_newLinePlusIndentation_byteList = null;
    EDI_cursor_cached_indentation_string = null;
    BYTES[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_None;

    INTS[fEDI_cursor_editLineFeedCount] = 0;
    EDI_cursor_edit_flagLineChanged = -1;

    EDI_cursor_EDI_paste_clipboardContent = null;

    INTS[fEDI_cursor_EDI_duplicate_small] = 0;
    INTS[fEDI_cursor_EDI_duplicate_length] = 0;
}

function EDI_init() {
    EDI_horizontal_scrollbar.style.left = '0px';
    INTS[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] = 0;

    EDI_cursorListElement.appendChild(EDI_cursor_caretRow);

    EDI_measureLineHeightAndCharacterWidth();
    EDI_measureBaseElement();

    const gutterPaddingLeft = CONST_EDI_gutterPaddingLeft + 'px';
    const gutterPaddingRight = CONST_EDI_gutterPaddingRight + 'px';

    EDI_gutter.style.paddingLeft = gutterPaddingLeft;
    EDI_gutter.style.paddingRight = gutterPaddingRight;

    EDI_gutterBackgroundColor.style.paddingLeft = gutterPaddingLeft;
    EDI_gutterBackgroundColor.style.paddingRight = gutterPaddingRight;

    INTS[fEDI_gutterWidthStyleValue] = EDI_characterWidth;

    EDI_drawGutter_Width();

    INTS[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar] = 1; // necessary for the first render, otherwise the if statement sees 0 !== 0.
    EDI_drawHorizontalScrollbar();
    EDI_render_request(RenderKind_Cursor_n);

    EDI_registerHandlers();
}

/**
 * All DOM manipulation needs to be done through this function.
 * 
 * You should not invoke this function directly, but instead use 'EDI_render_request()'.
 * 
 * You need to have each switch statement invoke a corresponding function in order to keep the stack frame as small as possible.
 */
function EDI_render_do(timestamp) {
    let renderKind = 0;

    // TODO: Could combining the low frequency RenderKinds somehow such that they invoke another intermediate function that then does a switch within it...
    // ...as a means of reducing the stackframe size of the function, be performance impactful?
    //
    // TODO: (Google AI) Would you like to look at replacing the .shift() loop with an O(1) ring buffer/pointer implementation
    while (renderKind = EDI_renderKindArray.shift()) {
        switch (renderKind) {
            case RenderKind_Scroll:
                EDI_render_do_Scroll(timestamp);
                break;
            case RenderKind_Resize:
                EDI_render_do_Resize(timestamp);
                break;
            case RenderKind_InsertLtr:
                EDI_render_do_InsertLtr();
                break;
            case RenderKind_TabKey:
                EDI_render_do_TabKey();
                break;
            case RenderKind_IndentMore:
                EDI_render_do_IndentMore();
                break;
            case RenderKind_IndentLess:
                EDI_render_do_IndentLess();
                break;
            case RenderKind_BackspaceRtl:
                EDI_render_do_Backspace();
                break;
            case RenderKind_DeleteLtr:
                EDI_render_do_Delete();
                break;
            case RenderKind_RemoveSelection:
                EDI_render_do_RemoveSelection();
                break;
            case RenderKind_Enter:
                EDI_render_do_EnterKey();
                break;
            case RenderKind_DuplicateOrPaste:
                EDI_render_do_DuplicateOrPaste();
                break;
            case RenderKind_Clear:
                EDI_render_do_Clear();
                break;
            case RenderKind_SetText:
                EDI_render_do_SetText(timestamp);
                break;
            case RenderKind_CreateViewport:
                EDI_render_do_CreateViewport();
                break;
            case RenderKind_SyntaxHighlighting:
                EDI_render_do_SyntaxHighlighting();
                break;
            case RenderKind_Cursor_flag_scrollIntoViewExplicit:
                EDI_render_do_cursor_flag_scrollIntoViewExplicit(timestamp);
                break;
            case RenderKind_Cursor_flag_doNotScrollIntoView:
                EDI_render_do_cursor_flag_doNotScrollIntoView(timestamp);
                break;
            case RenderKind_Cursor_n:
                EDI_render_do_cursor(timestamp);
                break;
        }
    }
    
    BYTES[byteEDI_isRenderPending] = 0;
}

function EDI_render_do_cursor(timestamp) {
    INTS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
    EDI_drawCursor();
}

/** obsolete-ish */
function EDI_render_do_cursor_flag_scrollIntoViewExplicit(timestamp) {
    INTS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
    let notShouldScrollIntoView = false;
    let flag_scrollIntoViewExplicit = false;

    flag_scrollIntoViewExplicit = true;

    if (flag_scrollIntoViewExplicit) {
        // TODO: consider setting 'notShouldScrollIntoView' to false to avoid two scroll into views redundantly?
        EDI_scrollCursorIntoView();
    }
    EDI_drawCursor(notShouldScrollIntoView);
}

function EDI_render_do_cursor_flag_doNotScrollIntoView(timestamp) {
    INTS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
    EDI_drawCursor(true);
}

function EDI_render_do_InsertLtr() {
    if (INTS[fEDI_cursor_editKind] !== EditKind_InsertLtr) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        if (EDI_cursor_gapBufferWriteToSpanElement) {

            EDI_cursor_gapBufferWriteToSpanElement.textContent = 
                EDI_cursor_gapBufferWriteToSpanElement.textContent.slice(0, (INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex]) + INTS[fEDI_cursor_editRenderedDisplacement]) +
                EDI_decoder.decode(EDI_cursor_gapBuffer.subarray(INTS[fEDI_cursor_editRenderedDisplacement], INTS[fEDI_cursor_editLength])) +
                EDI_cursor_gapBufferWriteToSpanElement.textContent.slice((INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex]) + INTS[fEDI_cursor_editRenderedDisplacement]);

            INTS[fEDI_cursor_editRenderedDisplacement] = INTS[fEDI_cursor_editLength];
        }
    }
}

function EDI_render_do_Clear() {
    EDI_drawCursor();
    EDI_clearSelectionStyle();
    EDI_textElement.innerHTML = '';
    EDI_gutter.innerHTML = '';
    // TODO: Clear the ring buffer state?

    // Force case 3
    INTS[fEDI_prevVli] = 0;
    INTS[fEDI_currVli] = INTS[fEDI_virtualCount];
    // TODO: Duplicated setting of scrolltop; this case and just baseline everytime vertical scrolls it is done in this method elsewhere
    INTS[fEDI_ONSCROLLscrollTop] = INTS[fEDI_lastReadNumber_scrollTop];
    EDI_render_do_CreateViewport();
}

function EDI_render_do_SetText(timestamp) {
    EDI_render_do_Clear();
    update_VirtualIndexLine();
    EDI_render_do_Scroll(timestamp);

    // TODO: what is paragraph this doing?
    INTS[fEDI_prevVli] = INTS[fEDI_ONSCROLLvirtualIndexLine];
    INTS[fEDI_currVli] = INTS[fEDI_virtualIndexLine];
    INTS[fEDI_ONSCROLLvirtualIndexLine] = INTS[fEDI_virtualIndexLine];

    INTS[fEDI_scrollEndDeadline] = timestamp + 1000;
    if (!BYTES[byteisCheckingTrailingEdge]) {
        BYTES[byteisCheckingTrailingEdge] = 1;
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
    }
}

/** All DOM manipulation needs to be done through this function. */
function EDI_render_request(renderKind) {
    if (EDI_renderKindArray[EDI_renderKindArray.length - 1] !== renderKind) {
        EDI_renderKindArray.push(renderKind);
    }
    
    if (!BYTES[byteEDI_isRenderPending]) {
        BYTES[byteEDI_isRenderPending] = 1;
        requestAnimationFrame(EDI_render_do);
    }
}

function EDI_render_do_CreateViewport() {
    const remember_scrollTop = INTS[fEDI_lastReadNumber_scrollTop];
    const remember_scrollLeft = INTS[fEDI_lastReadNumber_scrollLeft];

    EDI_baseElement.scrollTop = 0;
    EDI_baseElement.scrollLeft = 0;
    INTS[fEDI_lastReadNumber_scrollLeft] = 0;

    INTS[fEDI_ONSCROLLvirtualCount] = INTS[fEDI_virtualCount];

    EDI_gutter.innerHTML = '';
    EDI_textElement.innerHTML = '';

    INTS[fEDI_ringBuffer_indexZero] = 0;
    const translateY = `translateY(0px)`;
    const left = gutterWidthTotal_withPxUnits;
    const gutterWidth = `${INTS[fEDI_gutterWidthStyleValue]}px`;

    for (var i = 0; i < INTS[fEDI_virtualCount]; i++) {

        // TODO: Move this to the for loop initializer
        const indexLine = i + INTS[fEDI_virtualIndexLine];

        const gutterLineElement = document.createElement('div');
        if (indexLine >= EDI_lineEndPositionList_count) {
            gutterLineElement.textContent = '~';
        }
        else {
            gutterLineElement.textContent = indexLine + 1;
        }
        gutterLineElement.className = 'eG';
        EDI_gutter.appendChild(gutterLineElement);
        gutterLineElement.style.top = top;
        gutterLineElement.style.width = gutterWidth;

        const div = document.createElement('div');
        div.className = 'eT';
        EDI_textElement.appendChild(div);
        div.style.transform = translateY;
        div.style.left = left;
        div.style.width = EDI_horizontal_scrollbar_virtualization_boundary.style.width;

        div.appendChild(document.createElement('span'));
    }

    EDI_ringBuffer_gutter = Array.from(EDI_gutter.children);
    EDI_ringBuffer_text = Array.from(EDI_textElement.children);
    INTS[fEDI_ArrayFrom_textElement_children_length] = EDI_ringBuffer_text.length;

    EDI_drawHorizontalScrollbar(); // TODO: The 'setting EDI_baseElement.scrollLeft' line appearing after 'EDI_drawHorizontalScrollbar();' in this function strikes me as odd when skimming the code. (1 of 2)

    EDI_baseElement.scrollTop = remember_scrollTop;
    EDI_baseElement.scrollLeft = remember_scrollLeft; // TODO: The 'setting EDI_baseElement.scrollLeft' line appearing after 'EDI_drawHorizontalScrollbar();' in this function strikes me as odd when skimming the code. (1 of 2)
}

function EDI_createViewport() {
    EDI_render_request(RenderKind_CreateViewport);
}

/**
 * TODO: This logic is very unfortunate.
 * ...
 * I want to move essentially all of it to be rAF.
 * 
 * Specifically my concern is with a mouse down event.
 * 
 * If you scroll, the scrollTop immediately is modified of the container.
 * 
 * Then a scroll event is queued.
 * 
 * This function is the resulting code that gets ran from the event.
 * 
 * This code does some things.
 * 
 * Then rAF.
 * 
 * If I scroll, then mouse down.
 * 
 * If the scroll and mouse down events are handled prior to my rAF
 * 
 * and I've moved all the INTS[fEDI_virtualIndexLine] logic from here to the rAF
 * then the user will "click the wrong line".
 * 
 * "I don't want to limit the speed of editing to that of the screen's refresh rate"
 * 
 * Thus the event handling code does some things immediately pertaining to the edit.
 * And only afterwards does the rAF to show the changes on the UI.
 * 
 * But if I move all this scroll logic then I've essentially forced myself to do that.
 * Unless I have logic that checks for a pending scroll in the rAF and then forces it to complete or something.
 * 
 * You have to think in two states:
 * - raw layout
 * - paint
 * 
 * I'm not sure what words I want for these states but that's what comes to mind.
 * When you scroll the scrollTop immediately is changed. Mousedown needs the "raw layout" scrolltop.
 * 
 * When you draw the resulting UI of a keypress that inserts a character however you want the "paint"
 * you want the last thing that you drew to the screen whether the text being edited appears on screen if so edit the UI accordingly
 * to reflect the edit.
 */
function EDI_onScroll_WRAPIT() {
    // TODO: This code paragraph will run when scrolling horizontally at the moment, this is unfortunate because it relates to scrolling vertically.
    // ==== start explicit inline (duplication) of 'update_VirtualIndexLine()';
    // ====
    // If scrollTop were to cause synchronous layout calculation, then scrollLeft wouldn't have one because it'd already be calculated.
    // and vice versa.
    // thus it is thought you might as well touch scrollLeft too here, if you're going down this path.
    //
    INTS[fEDI_lastReadNumber_scrollLeft] = EDI_baseElement.scrollLeft;
    INTS[fEDI_lastReadNumber_scrollTop] = EDI_baseElement.scrollTop;

    EDI_render_request(RenderKind_Scroll);
}

function EDI_render_do_Scroll(timestamp) {
    const local_lineHeight = INTS[fEDI_lineHeight];

    // TODO: This floor logic seems very odd. Because given the previous and the current you can determine it without dividing maybe I think?
    INTS[fEDI_virtualIndexLine] = Math.floor(INTS[fEDI_lastReadNumber_scrollTop] / local_lineHeight);
    
    let local_prevVli = INTS[fEDI_ONSCROLLvirtualIndexLine];
    const local_currVli = INTS[fEDI_virtualIndexLine];
    INTS[fEDI_ONSCROLLvirtualIndexLine] = local_currVli;

    INTS[fEDI_scrollEndDeadline] = timestamp + 1000;

    if (INTS[fEDI_intFalsey_isScrolling] === 0) {
        // (Comment group ID: 'do_Scroll/LeadingEdge')...and here the locals are passed to the LeadingEdge because only when performing the LeadingEdge do you need to use the global versions. (part 1 of 3)
        if (EDI_onScroll_LeadingEdge(local_prevVli, local_currVli)) return; // This if statement reads poorly. You return for a reason that isn't gleaned by reading the function name alone.
        // (Comment group ID: 'do_Scroll/LeadingEdge')...and here the locals assigned the same value as the "globals" in case 'EDI_onScroll_LeadingEdge' modified the globals. (part 3 of 3)
        local_prevVli = INTS[fEDI_prevVli];
    }

    INTS[fEDI_ONSCROLLscrollTop] = INTS[fEDI_lastReadNumber_scrollTop];

    // TODO: Move this to the leading edge? (maybe)
    if (INTS[fEDI_cursor_editKind] !== EditKind_None) {
        // (the comment at the end of this line is not applicable while this is in EDI_render_do_Scroll, only applicable when moved to leading edge) TODO: Timing issue, someone typing while they scroll
        EDI_finalizeEdit();
    }

    // TODO: Consider moving the 0 diff case to the soonest possible line to skip as much code as possible.
    let diff = local_currVli - local_prevVli;
    if (diff === 0) return;

    let lowerBound = 0;
    let upperBound = 0;
    let ringBufferIndex = 0; // The 0th loop will increment somewhat awkwardly. see the: "This decrement avoids that." comments for each case.

    const local_ArrayFrom_textElement_children_length = INTS[fEDI_ArrayFrom_textElement_children_length];
    // TODO: consider 'const virtualCount = INTS[fEDI_virtualCount];'

    // TODO: This if elseif else can probably be optimized
    if (diff > 0 && diff < INTS[fEDI_virtualCount]) {
        INTS[fEDI_sum_diffPositive] += diff;
        // Note: (TODO: retrospectively reading this comment I'm thinking "what is this talking about?" To be fair I only glanced at it but because it is far too "verbose" I just don't feel like reading this right now to determine whether the comment is worthwhile or not.) this case has 'vertical = (INTS[fEDI_prevVli] + INTS[fEDI_virtualCount]) * local_lineHeight;' I believe 'INTS[fEDI_virtualCount]' === 'INTS[fEDI_ONSCROLLvirtualCount]' in this case, thus all vertical calculations can be moved after the if statements to be lowerBound * ... All cases other than this one were exact 1 to 1 matches.
        lowerBound = local_prevVli + INTS[fEDI_ONSCROLLvirtualCount];
        upperBound = lowerBound + diff;
        ringBufferIndex = INTS[fEDI_ringBuffer_indexZero] - 1 /*This decrement avoids that.*/;
        INTS[fEDI_ringBuffer_indexZero] = (ringBufferIndex + 1/*This decrement avoids that... but here you need to undo it for a moment*/ + diff) % local_ArrayFrom_textElement_children_length;
    }
    else if (diff < 0 && (diff *= -1) < INTS[fEDI_virtualCount]) {
        INTS[fEDI_sum_diffNegative] += diff;
        lowerBound = local_currVli;
        upperBound = lowerBound + diff;

        INTS[fEDI_ringBuffer_indexZero] = (
            (/*let lastIndex = */(INTS[fEDI_ringBuffer_indexZero] - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length) -
            (diff - 1) + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;

        ringBufferIndex = INTS[fEDI_ringBuffer_indexZero] - 1/*This decrement avoids that.*/;
    }
    else {
        INTS[fEDI_sum_diffPositive] += INTS[fEDI_virtualCount];
        lowerBound = local_currVli;
        upperBound = lowerBound + INTS[fEDI_virtualCount];
        ringBufferIndex = INTS[fEDI_ringBuffer_indexZero] - 1/*This decrement avoids that.*/;
    }

    const local_EDI_lineEndPositionList_data = EDI_lineEndPositionList_data;
    const local_EDI_lineEndPositionList_count = EDI_lineEndPositionList_count;

    // If you intend to use the variables 'lineStart' or 'lineEnd': Important detail to consider: the lines that are >= EDI_lineEndPositionList_count will continually increment lineStart by 1 So if you expect this to accurately represent the EOF position when it is in view, it probably does NOT.
    let lineStart = 0;
    let lineEnd = -1;
    if (lowerBound < local_EDI_lineEndPositionList_count && lowerBound !== 0) {
        lineEnd = local_EDI_lineEndPositionList_data[lowerBound - 1];
    }

    const bytes = EDI_textByteList_bytes;
    const local_EDI_ringBuffer_gutter = EDI_ringBuffer_gutter;
    const local_EDI_ringBuffer_text = EDI_ringBuffer_text;
    
    let vertical = lowerBound * local_lineHeight;

    // TODO: I've looked a lot at this 'var' usage versus 'let'... TODO: finalize a thought on this.
    for (var indexLine = lowerBound; indexLine < upperBound; indexLine++) {
        
        // I'm realizing this might be called 'Circular buffer layout indexing' TODO: is it? and if so rename everything.
        ringBufferIndex = (ringBufferIndex + 1) % local_ArrayFrom_textElement_children_length;

        const gutter = local_EDI_ringBuffer_gutter[ringBufferIndex];
        const div = local_EDI_ringBuffer_text[ringBufferIndex];

        lineStart = lineEnd + 1;
        if (indexLine < local_EDI_lineEndPositionList_count) {
            gutter.textContent = indexLine + 1;
            lineEnd = local_EDI_lineEndPositionList_data[indexLine];
        }
        else {
            gutter.textContent = '~';
            lineEnd = lineStart;
        }

        // Corrupt state if assumption is not met: - All lines of text are to contain at least 1 span at all times even if that span is just an empty one.
        const span = div.firstChild;
        span.className = 'eN';
        span.textContent = lineStart === lineEnd ? '' : EDI_decoder.decode(bytes.subarray(lineStart, lineEnd));

        while (div.lastChild && div.lastChild !== div.firstChild) {
            div.removeChild(div.lastChild);
        }

        const translateY = `translateY(${vertical}px)`;
        gutter.style.transform = translateY;
        div.style.transform = translateY;

        vertical += local_lineHeight;
    }
}

/**
 * @returns true if scrollTop (and a few other details) have not changed, thus indicating the invoker should immediately return from their own rather than continuing with scroll logic.
 */
function EDI_onScroll_LeadingEdge(local_prevVli, local_currVli) {
    
    // (Comment group ID: 'do_Scroll/LeadingEdge')...and here the locals are moved to the global scope. (part 2 of 3)
    INTS[fEDI_prevVli] = local_prevVli;
    INTS[fEDI_currVli] = local_currVli;

    INTS[fEDI_intFalsey_isScrolling] = 1;

    // TODO: If you can prove that the leading edge or 'INTS[fEDI_intFalsey_isScrolling]' is "equivalent" to 'BYTES[byteisCheckingTrailingEdge]' then you can reduce the code here.
    if (!BYTES[byteisCheckingTrailingEdge]) {
        BYTES[byteisCheckingTrailingEdge] = 1;
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
    }

    EDI_finalizeEdit();

    if (INTS[fEDI_ONSCROLLscrollTop] === INTS[fEDI_lastReadNumber_scrollTop] &&
        INTS[fEDI_prevVli] === INTS[fEDI_virtualIndexLine] &&
        INTS[fEDI_ONSCROLLvirtualCount] === INTS[fEDI_virtualCount]) {
            // TODO: this is directly tied to a scroll event on EDI_baseElement so handle it from there perhaps?
            // TODO: this code is duplicated inside EDI_drawHorizontalScrollbar, reduce duplication?
            if (EDI_horizontal_scrollbar.scrollLeft !== INTS[fEDI_lastReadNumber_scrollLeft]) {
                EDI_horizontal_scrollbar.scrollLeft = INTS[fEDI_lastReadNumber_scrollLeft];
            }
            return true;
    }

    if (INTS[fEDI_ONSCROLLvirtualCount] !== INTS[fEDI_virtualCount]) {
            // Force case 3
            //
            // An overflow will wrap around and still give you a diff of 'INTS[fEDI_virtualCount]'.
            // You cannot modify 'INTS[fEDI_currVli]' because the value is used by case '3' itself.
            //
            // This is very awkward because all other UI that has this sliding window logic just uses 'INTS[fEDI_currVli]'.
            //
            // The reason is because they're also re-evaluating their equivalent of 'INTS[fEDI_virtualIndexLine]'.
            //
            // The editor has a local variable 'let local_currVli = INTS[fEDI_virtualIndexLine];'
            // 
            // If you scroll enough to get a case 3 (full screen "draw") rather than doing some hacky forcing of case 3
            // you'll find that 'INTS[fEDI_virtualIndexLine]' within case 3 is
            // equal to 'local_currVli'.
            //
            // But 'INTS[fEDI_virtualIndexLine]' was being used within case 3
            // due to this awkward setting of the 'INTS[fEDI_currVli]' when doing a hack to force case 3.
            //
            // This meant case 3 was incurring an extra global variable lookup (global variable lookup of 'INTS')
            // - (or with 'ints' you are incurring a read of the array only, but still this is presumed to be more than just using the local variable).
            //
            // Wait I'm wrong with that explanation...
            // 'EDI_render_do_Clear()' does the hack too.
            // But it works maybe?
            //
            // If it does work for 'EDI_render_do_Clear()' it probably has to do with having set the state
            // prior to invoking the scroll function. Versus this leading edge case which changes the values out from under the scroll function.
            //
            // I don't know I'm tired and confused.
            //
            // TODO: Look into all the usages of 'INTS[fEDI_prevVli] and INTS[fEDI_currVli]' or like hacks to force cases
            //
            // TODO: What happens when you overflow 'INTS[fEDI_prevVli]' does it overflow such that you're the correct diff?
            //
            INTS[fEDI_prevVli] = INTS[fEDI_currVli] + INTS[fEDI_virtualCount];

            EDI_render_do_CreateViewport();
            return false;
    }

    return false;
}

function EDI_render_do_ScrollTrailingEdgeCheck(timestamp) {
    if (timestamp < INTS[fEDI_scrollEndDeadline]) {
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
        return;
    }

    EDI_onScroll_TrailingEdge();
}

/**
 * must set 'INTS[fEDI_intFalsey_isScrolling] = 0;' within this function.
 */
function EDI_onScroll_TrailingEdge() {
    INTS[fEDI_intFalsey_isScrolling] = 0;
    BYTES[byteisCheckingTrailingEdge] = 0;
    EDI_render_request(RenderKind_SyntaxHighlighting);
}

/**
 * TODO: for this function, you need to determine whether you will lex the
 * - [ ] textContent on the span,
 * - [ ] or if you will decode from the bytes again.
 * 
 * I'm going to do
 * - [ ] textContent on the span,
 * 
 * but there is 0 reasoning, understanding, or measurements behind my decision.
 * 
 * ===
 * 
 * TODO: Instead of having two counters 'fEDI_sum_diffNegative' and 'fEDI_sum_diffPositive' could you do this with just one counter?
 * TODO: Avoid checking for the CSS class that indicates whether a line is not syntax highlighted.
 * This comment of mine refers to one of the previously listed TODO's but I don't know which one. Furthermore I need to decide whether what I'm saying in this comment is even worth while keeping but that's a TODO for another day.
 * "it's wrong wait I see what's going on. You can't just sum them because overlap cancels out sometimes. If you have both but no full the larger side is cancelled out by the smaller amount I think... I'm gonna rain check that one... I'm thinking about more than 1 instance of an overlap breaking that math"
 * 
 * TODO: I believe that the 'EDI_drawViewPort_FindTrackedSyntax_StartingIndex' is actually wrong when you have a multiline comment that spans multiple lines and, after the closing of that syntax you on the same line start typing anything that isn't supposed to receive the comment syntax highlighting, you'll find that it erroneously receives the comment syntax highlighting.
 * 
 * ===
 * 
 * TODO: My concern is with a scroll to a larger scrollY, then a scroll to a smaller scrollY
 * such that either scrollY are not equal, and that there is at least a difference of 1 lineHeight between both scrollY to ensure the changes aren't cancelling out.
 * |
 * I think then you'd need to edge check 'INTS[fEDI_ringBuffer_indexZero]' find a hit, loop until you no longer see the not syntax highlighted css class
 * then this tells you to edge check PREVIOUS('INTS[fEDI_ringBuffer_indexZero]') and the remainder of your 'diff' to loop is in reverse.
 * |
 * I'm trying to think about whether the scroll function could leave behind data that indicates to this function
 * whether it is a 'INTS[fEDI_ringBuffer_indexZero]', PREVIOUS('INTS[fEDI_ringBuffer_indexZero]'), or both case without checking the edge divs whether they have the not syntax highlighted css class.
 * 
 * ===
 * 
 * - [ ] TODO: There is something in this method that is decently pointless overhead relating to...:
 *     - An empty line, a line only consisting of whitespace, or a line that is indented.
 *         - ...this one is perhaps less obvious from a non-branching perspective. And perhaps even just adding a conditional branch that avoids invoking 'JS_line_lex_newVersion' in this case is worthwhile.
 *     - A line that is out of bounds of 'indexLine < EDI_lineEndPositionList_count'
 *         - ...consider separating the loop bounds in some way to remove conditional branches related to 'if (indexLine < EDI_lineEndPositionList_count)'
 * 
 * ===
*/
function EDI_render_do_SyntaxHighlighting() {
    const local_sum_diffNegative = INTS[fEDI_sum_diffNegative];
    const local_sum_diffPositive = INTS[fEDI_sum_diffPositive];
    let total_diff = local_sum_diffNegative + local_sum_diffPositive;
    
    INTS[fEDI_sum_diffNegative] = 0;
    INTS[fEDI_sum_diffPositive] = 0;

    if (total_diff === 0) return;

    let i = 0;
    
    let ringBufferIndexCurrent = INTS[fEDI_ringBuffer_indexZero];
    let indexLine = INTS[fEDI_virtualIndexLine];

    let i_bounded = 0;

    let bothButNotFull = false;

    if (total_diff >= INTS[fEDI_virtualCount]) {
        total_diff = INTS[fEDI_virtualCount];
        i_bounded = total_diff;
    }
    else {
        bothButNotFull = local_sum_diffPositive > 0 && local_sum_diffNegative > 0;

        if (bothButNotFull || local_sum_diffNegative > 0) {
            i_bounded = local_sum_diffNegative;
        }
        else if (local_sum_diffPositive > 0) {
            let originalI = i;
            let local_sum_diffPositive_MINUS_ONE = local_sum_diffPositive - 1; // I want to end on the inclusive lower bound dom element.

            ringBufferIndexCurrent = (ringBufferIndexCurrent - 1 + INTS[fEDI_ArrayFrom_textElement_children_length]) % INTS[fEDI_ArrayFrom_textElement_children_length];
            indexLine = indexLine + INTS[fEDI_virtualCount] - 1;
            
            for (; i < local_sum_diffPositive_MINUS_ONE; i++) {
                ringBufferIndexCurrent = (ringBufferIndexCurrent - 1 + INTS[fEDI_ArrayFrom_textElement_children_length]) % INTS[fEDI_ArrayFrom_textElement_children_length];
                indexLine--;
            }

            i = originalI;
            i_bounded = local_sum_diffPositive;
        }
    }

    const local_EDI_lineEndPositionList_data = EDI_lineEndPositionList_data;
    const local_EDI_lineEndPositionList_count = EDI_lineEndPositionList_count;

    // If you intend to use the variables 'lineStart' or 'lineEnd': Important detail to consider: the lines that are >= EDI_lineEndPositionList_count will continually increment lineStart by 1 So if you expect this to accurately represent the EOF position when it is in view, it probably does NOT.
    let lineStart = 0;
    let lineEnd = -1;
    // TODO: 'let lineEnd = -1; if (lowerBound < count && lowerBound !== 0) { lineEnd = data[lowerBound - 1]; }
    if (indexLine < local_EDI_lineEndPositionList_count && indexLine !== 0) {
        lineEnd = local_EDI_lineEndPositionList_data[indexLine - 1];
    }

    let trackedSyntax_I = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLine);
    if (trackedSyntax_I === NaN || trackedSyntax_I === -1)
        trackedSyntax_I = EDI_trackedSyntaxList.count_abstract;
    
    for (; i < i_bounded; i++) {
        //
        // TODO: Would in some way reading 'EDI_ringBuffer_text[ringBufferIndexCurrent].children[0]' into a variable be beneficial to avoid the double read.
        //
        // short circuit avoid double dipping of c++ internals, only the 'bothButNotFull' is inaccurate at the moment.
        if (!bothButNotFull || EDI_ringBuffer_text[ringBufferIndexCurrent].children[0].className === 'eN') {
            EDI_ringBuffer_text[ringBufferIndexCurrent].children[0].className = '';
    
            lineStart = lineEnd + 1;
            if (indexLine < local_EDI_lineEndPositionList_count) {
                lineEnd = local_EDI_lineEndPositionList_data[indexLine];
            }
            else {
                lineEnd = lineStart;
            }
    
            trackedSyntax_I = JS_line_lex_newVersion(EDI_ringBuffer_text[ringBufferIndexCurrent], ringBufferIndexCurrent, trackedSyntax_I, lineStart);
        }

        ringBufferIndexCurrent = (ringBufferIndexCurrent + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];

        indexLine++;
    }

    if (bothButNotFull) {
        INTS[fEDI_sum_diffPositive] = local_sum_diffPositive;
        EDI_render_do_SyntaxHighlighting();
    }
}

function EDI_state_clear() {
    EDI_finalizeEdit();
    EDI_cursor_clear();
    set_EDI_recentBoundingClientRect_isNull_intFalsey(1);
    EDI_textSourceIdentifier = '';
    EDI_FORMATTED_textSourceIdentifier = '';
    BYTES[byteEDI_extensionKind] = ExtensionKind_None;
    set_EDI_fileStartsWithBom(false);
    EDI_lineEndString = null;
    EDI_lineEndPositionList_clear();
    EDI_textByteList_clear();
    INTS[fEDI_longestLine_indexLine] = 0;
    INTS[fEDI_longestLine_length] = 0;
    
    EDI_trackedSyntaxList.clear();
}

function EDI_clear() {
    EDI_state_clear();
    EDI_render_request(RenderKind_Clear);
}

function EDI_state_setText(text, fileStartsWithBom, textSourceIdentifier, FORMATTED_textSourceIdentifier, extensionKind, lineEndString) {
    EDI_baseElement.scrollTop = 0;
    INTS[fEDI_lastReadNumber_scrollTop] = 0;
    EDI_baseElement.scrollLeft = 0;
    INTS[fEDI_lastReadNumber_scrollLeft] = 0;
    
    EDI_state_clear();

    set_EDI_fileStartsWithBom(fileStartsWithBom);

    EDI_textSourceIdentifier = textSourceIdentifier;
    EDI_FORMATTED_textSourceIdentifier = FORMATTED_textSourceIdentifier;
    BYTES[byteEDI_extensionKind] = extensionKind;
    EDI_language_line_lex_SET(BYTES[byteEDI_extensionKind]);

    EDI_lineEndString = lineEndString;
    if (!EDI_lineEndString) {
        const firstNewlineMatch = text.match(/\r?\n/);
        EDI_lineEndString = firstNewlineMatch ? firstNewlineMatch[0] : '\n';
    }

    let local_EDI_lineEndPositionList_count = EDI_lineEndPositionList_count;

    let lineLength = 0; /** TODO: Track the linePosition last seen when making a line or something you don't have to increment this per character, you just need the difference of the last line drawn to the current or something. */
    const normalizedText = text.replaceAll('\r\n', '\n');
    const finalUint8Array = EDI_encoder.encode(normalizedText); /** how do I 'encodeInto' when a character might actually be multi-byte thus I don't ever truly know the size ahead of time? */
    EDI_textByteList_ensureCapacityForInsertion(0, finalUint8Array.length);
    EDI_textByteList_bytes.set(finalUint8Array, 0);
    EDI_textByteList_count = finalUint8Array.length;

    const local_EDI_textByteList_bytes = EDI_textByteList_bytes;
    const local_EDI_textByteList_count = EDI_textByteList_count;

    for (var sourceI = 0; sourceI < local_EDI_textByteList_count; sourceI++) {
        lineLength++; // avoid branching by eager counting the lineLength and then excluding the lineEnding later
        if (local_EDI_textByteList_bytes[sourceI] === CONST_EDI_ASCII_LINE_FEED) {
            if (lineLength - 1 > INTS[fEDI_longestLine_length]) { // avoid branching by eager counting the lineLength and then excluding the lineEnding later
                INTS[fEDI_longestLine_length] = lineLength - 1; // avoid branching by eager counting the lineLength and then excluding the lineEnding later
                INTS[fEDI_longestLine_indexLine] = local_EDI_lineEndPositionList_count;
            }
            lineLength = 0;
            EDI_lineEndPositionList_insert(local_EDI_lineEndPositionList_count++, sourceI);
        }
    }

    // TODO: The ++ here "isn't needed" but it makes the code consistent and less prone to future mistakes should another access of 'EDI_lineEndPositionList_count' be made after this point in the future.
    EDI_lineEndPositionList_insert(local_EDI_lineEndPositionList_count++, local_EDI_textByteList_count);

    update_VirtualIndexLine();
    update_virtualCount();

    update_verticalVirtualizationBoundary();

    EDI_drawGutter_Width();
    EDI_render_request(RenderKind_Cursor_n);
    EDI_drawHorizontalScrollbar();
    // Force 'case 3' within 'EDI_onScroll_WRAPIT();' downstream
    // TODO: (this comment is being made sometime after this solution was written but from memory...)...
    // ...I believe this works because when you change the text you guarantee a virtual index line of '0' because the scrollTop gets moved to 0...
    // ...the partial solution is to set it to anything other than '0' so the editor detects that a line of text needs to be drawn...
    // ...but this isn't enough because you want the editor to draw every line, thus you make the difference...
    // ...in the virtual index line equal to the count of lines being displayed, i.e.: set virtual index line to 'INTS[fEDI_virtualCount]'...
    // ...then it sees the new value for virtual index line is 0...
    // ...the difference between the previous and new value is 'INTS[fEDI_virtualCount]'...
    // ...thus 'INTS[fEDI_virtualCount]' amount of lines get redrawn...
    // ...i.e.: the entire viewport is redrawn with the new file's text.
    INTS[fEDI_ONSCROLLvirtualIndexLine] = INTS[fEDI_virtualCount];
}

/**
 * 
 * @param {string} text 
 * @param {string} textSourceIdentifier I intend to have this be an absolute path. Then when the app saves a file, it can verify against the database that this absolute path is "safe" and then write to the file.
 * @param {string} lineEndString pass null (or do not include the parameter) to have line endings set to the first encountered kind in the text. Otherwise specify here. The string is used EXACTLY AS PROVIDED if non-falsey.
 */
function EDI_setText(text, fileStartsWithBom, textSourceIdentifier, FORMATTED_textSourceIdentifier, extensionKind, lineEndString) {
    EDI_state_setText(text, fileStartsWithBom, textSourceIdentifier, FORMATTED_textSourceIdentifier, extensionKind, lineEndString);
    EDI_render_request(RenderKind_SetText);
}

/**
 * You may want to update the vertical virtualization boundary prior to actually updating the EDI_lineEndPositionList_
 * Thus this function takes a 'lineCount' which defaults to EDI_lineEndPositionList_count if falsey.
 * @param {number | null | undefined} lineCount In order to permit arbitrarily updating the vertical virtualization boundary, this takes a lineCount. If falsey, then EDI_lineEndPositionList_count is used.
 */
function update_verticalVirtualizationBoundary(lineCount) {
    if (!lineCount) lineCount = EDI_lineEndPositionList_count;
    EDI_virtualization_vertical.style.height = ((lineCount + INTS[fEDI_virtualCount] - 1) * INTS[fEDI_lineHeight]) + 'px';
}

/**
 * EDI_render_do_Scroll() has this function explicitly inlined (duplicated) within the source code.
 */
function update_VirtualIndexLine() {
    // If scrollTop were to cause synchronous layout calculation, then scrollLeft wouldn't have one because it'd already be calculated.
    // and vice versa.
    // thus it is thought you might as well touch scrollLeft too here, if you're going down this path.
    //
    INTS[fEDI_lastReadNumber_scrollLeft] = EDI_baseElement.scrollLeft;
    INTS[fEDI_lastReadNumber_scrollTop] = EDI_baseElement.scrollTop;
    // TODO: This floor logic seems very odd. Because given the previous and the current you can determine it without dividing maybe I think?
    INTS[fEDI_virtualIndexLine] = Math.floor(INTS[fEDI_lastReadNumber_scrollTop] / INTS[fEDI_lineHeight]);
}

function update_virtualCount() {
    INTS[fEDI_virtualCount] = Math.ceil(INTS[fEDI_lastReadNumber_offsetHeight] / INTS[fEDI_lineHeight]);
}

/**
 * If the 'INTS[fEDI_drawn_count_of_digits_longest_line_number] === positiveNumbersOnly_countDigitsLoop(EDI_lineEndPositionList_count)'
 * then the function does nothing.
 * 
 * TODO: Track the min and max until length changes and then only 2 operations at worst case than while
 * 
 * @returns a bool indicating whether the gutter was drawn (if 'INTS[fEDI_drawn_count_of_digits_longest_line_number]' has not changed then false is returned because the gutter didn't need to be "re-" drawn)
 * 
 * Dependent UI: EDI_render_request(RenderKind_Cursor_n); EDI_drawHorizontalScrollbar();
 * 
 * You either guarantee the dependent UI to run by invoking them regardless of this function's result 'EDI_drawGutter_Width(); EDI_render_request(RenderKind_Cursor_n); EDI_drawHorizontalScrollbar();'
 * Or you capture the return value to know whether the gutter was "re-" drawn, because if so, you need to invoke 'EDI_render_request(RenderKind_Cursor_n); EDI_drawHorizontalScrollbar();'
 * for the dependent UI.
 * The confusion, if there is any, comes from the dependent UI in some scenarios being required independently of whether drawGutter changes. And at other times they're solely dependent on whether drawGutter changes.
 */
function EDI_drawGutter_Width() {
    let count = EDI_lineEndPositionList_count;
    if (BYTES[byteEDI_cursor_enterKeyEventKind] !== EnterKeyEventKind_None) {
        count += 1;
    }
    let digitCountOfLargestLineNumber = positiveNumbersOnly_countDigitsLoop(count);
    if (INTS[fEDI_drawn_count_of_digits_longest_line_number] === digitCountOfLargestLineNumber) return false;

    INTS[fEDI_drawn_count_of_digits_longest_line_number] = digitCountOfLargestLineNumber;

    INTS[fEDI_gutterWidthStyleValue] = Math.ceil(digitCountOfLargestLineNumber * EDI_characterWidth);
    INTS[fEDI_gutterWidthTotal] = INTS[fEDI_gutterWidthStyleValue] + CONST_EDI_gutterPaddingLeft + CONST_EDI_gutterPaddingRight;
    gutterWidthTotal_withPxUnits = `${INTS[fEDI_gutterWidthTotal]}px`;

    let gutterWidth = INTS[fEDI_gutterWidthStyleValue] + 'px';
    EDI_gutter.style.width = gutterWidth;
    EDI_gutterBackgroundColor.style.width = gutterWidth;

    for (let i = 0; i < INTS[fEDI_ArrayFrom_textElement_children_length]/*a 'ArrayFrom_gutter_children_length' would always be equal to the textElement equivalent*/; i++) {
        EDI_ringBuffer_gutter[i].style.width = gutterWidth;
    }
    
    for (let i = 0; i < INTS[fEDI_ArrayFrom_textElement_children_length]; i++) {
        EDI_ringBuffer_text[i].style.left = gutterWidthTotal_withPxUnits;
    }

    EDI_cursor_caretRow.style.left = gutterWidthTotal_withPxUnits;

    return true;
}

/**
 * You need to change this logic to know the longest line.
 * Then when the longest line changes or some such likely related to finalization of an edit (not pending edits).
 * then at that point you redraw this.
 */
function EDI_drawHorizontalScrollbar() {
    if (INTS[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] !== INTS[fEDI_gutterWidthTotal]) {
        EDI_horizontal_scrollbar.style.left = gutterWidthTotal_withPxUnits;
        INTS[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] = INTS[fEDI_gutterWidthTotal];
    }

    if (INTS[fEDI_EDI_horizontal_scrollbar_widthValue] !== (EDI_baseElement.clientWidth - INTS[fEDI_gutterWidthTotal])) {
        INTS[fEDI_EDI_horizontal_scrollbar_widthValue] = EDI_baseElement.clientWidth - INTS[fEDI_gutterWidthTotal];
        EDI_horizontal_scrollbar.style.width = INTS[fEDI_EDI_horizontal_scrollbar_widthValue] + 'px';
    }

    if (INTS[fEDI_longestLine_length] !== INTS[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar]) {
        
        INTS[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar] = INTS[fEDI_longestLine_length];

        INTS[fEDI_contentWidth] = Math.ceil(INTS[fEDI_longestLine_length] * EDI_characterWidth);

        if ((INTS[fEDI_contentWidth] < (EDI_baseElement.clientWidth - INTS[fEDI_gutterWidthTotal])) && (EDI_baseElement.clientWidth - INTS[fEDI_gutterWidthTotal] > 0)) {
            INTS[fEDI_contentWidth] = Math.floor(EDI_baseElement.clientWidth - INTS[fEDI_gutterWidthTotal]);
        }

        let local_EDI_horizontal_scrollbar_virtualization_boundary_style_width = INTS[fEDI_contentWidth] + 'px';

        EDI_horizontal_scrollbar_virtualization_boundary.style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
        EDI_virtualization_horizontal.style.width = INTS[fEDI_contentWidth] + INTS[fEDI_gutterWidthTotal] + 'px';

        for (let i = 0; i < INTS[fEDI_ArrayFrom_textElement_children_length]; i++) {
            EDI_ringBuffer_text[i].style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
        }

        EDI_cursor_caretRow.style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
    }
    
    // TODO: this is directly tied to a scroll event on EDI_baseElement so handle it from there perhaps?
    // TODO: this code is duplicated inside EDI_onScroll_WRAPIT when it returns early due to nothing vertically having changed, reduce duplication?
    // TODO: 'INTS[fEDI_lastReadNumber_scrollLeft]' here?
    if (EDI_horizontal_scrollbar.scrollLeft !== EDI_baseElement.scrollLeft) {
        EDI_horizontal_scrollbar.scrollLeft = EDI_baseElement.scrollLeft;
    }
}

/**
 * TODO: Exception during finalize softlocks the editor because you can't even clear to reset the state: 'Uncaught (in promise) Error: removeAt(...): index > this.count'
 * 
 * Retrospectively I'd say... I imagine there'd be more than one scenario of this I have a lot of 'critical booleans'.
 * i.e.: if you enter the 'critical boolean guarded code path' then throw an exception in the middle of that code path with bad state for the 'critical boolean guarded code path' you might never be able to enter it again.
 * i.e.: I don't see this happen myself unless I'm messing with new code and running the code that I am in progress of writing. But I don't have a try catch so if an error were to occur it'd completely softlock things.
 */
function EDI_finalizeEdit() {
    /**
     * Later code needs to know the line index that the removal occurred on.
     * In a naive approach, presume every edit only spans a single line.
     * Then reversing backwards gets you the first line index that "fits" the edit and thus the line index the edit occurred on.
     * 
     * If for whatever reason the first time around this loop fails, then you never decremented so you wouldn't increment to restore
     * the iteration variable to the previous loop's state.
     */
    let indexLine_editOccurredOn = -1;

    switch (INTS[fEDI_cursor_editKind]) {
        case EditKind_InsertLtr:
            indexLine_editOccurredOn = EDI_finalizeEdit_InsertLtr(indexLine_editOccurredOn);
            break;
        case EditKind_Enter:
            indexLine_editOccurredOn = EDI_finalizeEdit_Enter(indexLine_editOccurredOn);
            return;
        case EditKind_Tab:
            indexLine_editOccurredOn = EDI_finalizeEdit_Tab(indexLine_editOccurredOn);
            return;
        case EditKind_IndentMore:
            indexLine_editOccurredOn = EDI_finalizeEdit_IndentMore(indexLine_editOccurredOn);
            return;
        case EditKind_IndentLess:
            indexLine_editOccurredOn = EDI_finalizeEdit_IndentLess(indexLine_editOccurredOn);
            break;
        case EditKind_Paste:
            indexLine_editOccurredOn = EDI_finalizeEdit_Paste(indexLine_editOccurredOn);
            return;
        case EditKind_Duplicate:
            indexLine_editOccurredOn = EDI_finalizeEdit_Duplicate(indexLine_editOccurredOn);
            return;
        case EditKind_DeleteLtr:
        case EditKind_BackspaceRtl:
        case EditKind_RemoveTextNoBatching:
            indexLine_editOccurredOn = EDI_finalizeEdit_DeleteLtr_BackspaceRtl_RemoveTextNoBatching(indexLine_editOccurredOn);
            break;
    }

    // indexLine_editOccurredOn is initialized to -1
    //
    // When gap buffer is finalized editor tries to redraw the line in order to lex it again.
    // You need to NOT do this when you are working with multiple cursors however, because it bugs everything out.
    // 
    if (indexLine_editOccurredOn >= 0 && indexLine_editOccurredOn < EDI_lineEndPositionList_count) {
        if (EDI_gutter.children.length === INTS[fEDI_virtualCount] &&
            EDI_textElement.children.length === INTS[fEDI_virtualCount]) {
                
                // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
                let ringBufferIndex = indexLine_editOccurredOn - INTS[fEDI_virtualIndexLine];
                if (ringBufferIndex >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex < 0) ringBufferIndex = -1;
                else ringBufferIndex = (ringBufferIndex + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

                if (ringBufferIndex >= 0) {
                    let gutterLineElement = EDI_gutter.children[ringBufferIndex];
                    gutterLineElement.innerHTML = '';
                    let textLineElement = EDI_textElement.children[ringBufferIndex];
                    textLineElement.innerHTML = '';
                    EDI_drawLine(indexLine_editOccurredOn, gutterLineElement, textLineElement);
                }
                else {
                    // TODO: Consider what to do in this case.
                }
        }
        else {
            // TODO: Consider what to do in this case.
        }
    }
}

function EDI_finalizeEdit_InsertLtr(indexLine_editOccurredOn) {
    for (let i = EDI_lineEndPositionList_count - 1; i >= 0; i--) {
        if (INTS[fEDI_cursor_editPosition] <= EDI_lineEndPositionList_data[i]) {
            EDI_lineEndPositionList_data[i] += INTS[fEDI_cursor_editLength];
        }
        else {
            if (i === EDI_lineEndPositionList_count - 1) {
                indexLine_editOccurredOn = i;
            }
            else {
                indexLine_editOccurredOn = i + 1;
            }
            break;
        }
    }
    for (var i = 0; i < EDI_trackedSyntaxList.count_abstract; i++) {
        EDI_trackedSyntaxList.getElementAt(i);
        if (INTS[fEDI_cursor_editPosition] <= INTS[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_cursor_editLength]);
        }
        else if (BYTES[byteEDI_pooledTrackedSyntax_trackedSyntaxKind] === TrackedSyntaxKind_Comment &&
                INTS[fEDI_cursor_editPosition] === INTS[fEDI_pooledTrackedSyntax_start] + 1) {

            // TODO: Insertion of '*' probably shouldn't remove.
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (INTS[fEDI_cursor_editPosition] > INTS[fEDI_pooledTrackedSyntax_start] && INTS[fEDI_cursor_editPosition] < INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, INTS[fEDI_pooledTrackedSyntax_length] + INTS[fEDI_cursor_editLength]);
        }
    }
    EDI_textByteList_insertBytes(INTS[fEDI_cursor_editPosition], EDI_cursor_gapBuffer, /*offset*/ 0, /*length*/ INTS[fEDI_cursor_gapBufferCount]);

    let textSourceIdentifier = EDI_FORMATTED_textSourceIdentifier;
    EDI_getLineAndColumnIndices(INTS[fEDI_cursor_editPosition]);
    let lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    let lineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    let text = EDI_decoder.decode(EDI_cursor_gapBuffer.subarray(0, INTS[fEDI_cursor_gapBufferCount]));
    INTS[F_didChangeTextDocument_version] = INTS[F_didChangeTextDocument_version] + 1;
    let version = INTS[F_didChangeTextDocument_version];

    // --- CLEAN INTEGRATION ---
    enqueueLSPNotification({
        absolutePath: textSourceIdentifier,
        version: version,
        startLine: lineAndColumnIndices_indexLine,
        startCharacter: lineAndColumnIndices_indexColumn,
        endLine: lineAndColumnIndices_indexLine,
        endCharacter: lineAndColumnIndices_indexColumn,
        text: text
    });
    // -------------------------

    if (indexLine_editOccurredOn === INTS[fEDI_longestLine_indexLine]) {
        INTS[fEDI_longestLine_length] = INTS[fEDI_longestLine_length] + INTS[fEDI_cursor_editLength];
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Enter(indexLine_editOccurredOn) {
    if (INTS[fEDI_cursor_editRenderedDisplacement] !== INTS[fEDI_cursor_editLength]) {
        EDI_render_do_EnterKey();
    }

    // TODO: A notification needs to sent to the LSP here

    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(INTS[fEDI_cursor_editPosition], INTS[fEDI_cursor_editLength]);

    // throws an exception if 'EnterKeyEventKind_None' (...or falsey).
    if (!BYTES[byteEDI_cursor_enterKeyEventKind] || BYTES[byteEDI_cursor_enterKeyEventKind] === EnterKeyEventKind_None) { EDI_finalizeEdit_ClearEditState(); throw new Error('if (!enterKeyEventKind...)'); }

    EDI_textByteList_insertBytes(INTS[fEDI_cursor_editPosition], EDI_cursor_enterKey_newLinePlusIndentation_byteList.bytes, /*offset*/ 0, EDI_cursor_enterKey_newLinePlusIndentation_byteList.count);

    for (var i = INTS[fEDI_cursor_editIndexLine]; i < EDI_lineEndPositionList_count; i++) {
        EDI_lineEndPositionList_data[i] += INTS[fEDI_cursor_editLength];
    }

    // You need to consider if the longest line gets split
    if (INTS[fEDI_cursor_editIndexLine] <= INTS[fEDI_longestLine_indexLine])
        INTS[fEDI_longestLine_indexLine] = INTS[fEDI_longestLine_indexLine] + 1;

    EDI_lineEndPositionList_insert(INTS[fEDI_cursor_editIndexLine], INTS[fEDI_cursor_editPosition]);

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Tab(indexLine_editOccurredOn) {
    let bytes = EDI_on_tab_bytes;
    const per_edit_length = bytes.length;
    let length = per_edit_length;

    if (INTS[fEDI_cursor_editLength] > 1) {
        length *= INTS[fEDI_cursor_editLength];
        const src_bytes = bytes;
        bytes = new Uint8Array(length);
        // TODO: typed array function usage
        for (let i = 0; i < length; i += per_edit_length) {
            for (let k = 0; k < per_edit_length; k++) {
                bytes[i + k] = src_bytes[k];
            }
        }
    }

    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(INTS[fEDI_cursor_editPosition], length);

    EDI_textByteList_insertBytes(INTS[fEDI_cursor_editPosition], bytes, /*offset*/ 0, /*length*/ length);

    for (var i = INTS[fEDI_cursor_editIndexLine]; i < EDI_lineEndPositionList_count; i++) {
        EDI_lineEndPositionList_data[i] += length;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_IndentMore(indexLine_editOccurredOn) {
    let startingIndex = INTS[fEDI_indent_startingIndex];
    INTS[fEDI_indent_startingIndex] = 0;
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];
    INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = 0;

    let bytes = EDI_on_tab_bytes;
    const per_edit_length = bytes.length;

    let ORIGINAL_incrementBy = (startingIndex + 1 - SMALL_lineAndColumnIndices_indexLine) * per_edit_length;
    let incrementBy = ORIGINAL_incrementBy;

    //let ORIGINAL_incrementBy = INTS[fEDI_indent_ORIGINAL_indentBy];
    //let incrementBy = INTS[fEDI_indent_ORIGINAL_indentBy];
    //INTS[fEDI_indent_ORIGINAL_indentBy] = 0;

    
    let bytesLength = per_edit_length;

    if (INTS[fEDI_cursor_editLength] > 1) {
        ORIGINAL_incrementBy *= INTS[fEDI_cursor_editLength];
        incrementBy *= INTS[fEDI_cursor_editLength];
        bytesLength *= INTS[fEDI_cursor_editLength];
        const src_bytes = bytes;
        bytes = new Uint8Array(bytesLength);
        // TODO: typed array function usage
        for (let i = 0; i < bytesLength; i += per_edit_length) {
            for (let k = 0; k < per_edit_length; k++) {
                bytes[i + k] = src_bytes[k];
            }
        }
    }

    let startingLinePos_end = INTS[fEDI_EDI_indentLess_startingLinePos_end];
    INTS[fEDI_EDI_indentLess_startingLinePos_end] = 0;

    // # Determine the total count of text that will be inserted, prior to actually beginning the edit.
    // ...

    // # Update the 'START POSITIONS specifically' of the tracked syntax list by the total count of text that will be inserted.
    let trackedSyntaxReposition_i = EDI_trackedSyntaxReposition_find(startingLinePos_end + 1);
    if (trackedSyntaxReposition_i === NaN || trackedSyntaxReposition_i === -1) {
        trackedSyntaxReposition_i = EDI_trackedSyntaxList.count_abstract;
    }
    for (var i = trackedSyntaxReposition_i; i < EDI_trackedSyntaxList.count_abstract; i++) {
        EDI_trackedSyntaxList.setStart(
            i,
            EDI_trackedSyntaxList.getStart(i) + ORIGINAL_incrementBy);
    }
    trackedSyntaxReposition_i--;

    // # Descending indexLine loop:
    //     # Insert the text on the respective line.
    //     # Increment the entry in 'EDI_lineEndPositionList' for the respective line
    //     # There's a second (relative to this entire function) modification to the start positions of the tracked syntax list
    //     # Then, you immediately know the trackedSyntax that encompasses the insertion (if it exists), so you increment its length by the text inserted on that respective line.
    //     # Each loop you reduce incrementBy, because you're initial starting the loop knowing you will eventually insert 4 characters on every line.
    //         # thus, the first iteration of the loop you're increasing that line's end position by the length of text inserted per line by the amount of lines.
    //         # The next iteration is a smaller indexLine so you decrement because you have the insertion of one less line to consider.
    for (var lineI = startingIndex; lineI >= SMALL_lineAndColumnIndices_indexLine; lineI--) {
        EDI_getLineBoundaryPositions(lineI);
        const line_start = INTS[fEDI_getLineBoundaryPositions_start];

        for (; trackedSyntaxReposition_i >= 0; trackedSyntaxReposition_i--) {
            let start = EDI_trackedSyntaxList.getStart(trackedSyntaxReposition_i);
            if (line_start <= start) {
                // # There's a second (relative to this entire function) modification to the start positions of the tracked syntax list
                EDI_trackedSyntaxList.setStart(trackedSyntaxReposition_i, start + incrementBy);
            }
            else {
                break;
            }
        }
        EDI_trackedSyntaxList.getElementAt(trackedSyntaxReposition_i);
        if (line_start > INTS[fEDI_pooledTrackedSyntax_start] && line_start < INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length]) {
            // # Then, you immediately know the trackedSyntax that encompasses the insertion (if it exists), so you increment its length by the text inserted on that respective line.
            EDI_trackedSyntaxList.setLength(trackedSyntaxReposition_i, INTS[fEDI_pooledTrackedSyntax_length] + bytesLength);
        }

        // # Insert the text on the respective line.
        EDI_textByteList_insertBytes(line_start, bytes, 0 /*offset*/, bytesLength /*length*/);
        
        // # Increment the entry in 'EDI_lineEndPositionList' for the respective line
        EDI_lineEndPositionList_data[lineI] += incrementBy;

        // # Each loop you reduce incrementBy, because you're initial starting the loop knowing you will eventually insert 4 characters on every line.
        //     # thus, the first iteration of the loop you're increasing that line's end position by the length of text inserted per line by the amount of lines.
        //     # The next iteration is a smaller indexLine so you decrement because you have the insertion of one less line to consider.
        incrementBy -= bytesLength;
    }

    // # Any line that is not part of the selected set of lines, and is at a greater indexLine, needs to have their line end position entry updated.
    for (var lineI = startingIndex + 1; lineI < EDI_lineEndPositionList_count; lineI++) {
        EDI_lineEndPositionList_data[lineI] += ORIGINAL_incrementBy;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_IndentLess(indexLine_editOccurredOn) {
    // Both indentMore and indentLess have logic in the initial event that needs to be moved here.
    // Nevertheless there is a difference between indentLess and indentMore in that you cannot simply
    // multiply by n to get the decrement because it deals with the existence of whitespace to be removed so you need to actually sum this as you handle each event
    // so that when you get to the finalize you have it all sum'd up (although yes this logic probably doesn't even belong in the event but it is there and 1 thing at a time).

    //let ORIGINAL_decrementBy = INTS[fEDI_indent_ORIGINAL_indentBy];
    //let decrementBy = INTS[fEDI_indent_ORIGINAL_indentBy];
    //INTS[fEDI_indent_ORIGINAL_indentBy] = 0;

    let startingIndex = INTS[fEDI_indent_startingIndex];
    INTS[fEDI_indent_startingIndex] = 0;
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];
    INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = 0;

    // !!!!!! watch out for the big breaks when hitting a tab presuming that_four is 4
    // If I could go back in time I'd go back to the day I thought it a good idea to name this variable 'that_four'
    let maxVirtualColumnIndex = 4;
    maxVirtualColumnIndex *= INTS[fEDI_cursor_editLength];
    let largestRank = INTS[fEDI_cursor_editLength];

    // loop over the lines to sum the "amount" of whitespace being removed
    let DETERMINE_decrementBy = 0;
    for (var lineI = SMALL_lineAndColumnIndices_indexLine; lineI <= startingIndex; lineI++) {
        EDI_getLineBoundaryPositions(lineI);
        const line_start = INTS[fEDI_getLineBoundaryPositions_start];
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(lineI);
        let upperLimitIndexColumn;
        if (lastValidIndexColumn > maxVirtualColumnIndex) {
            upperLimitIndexColumn = maxVirtualColumnIndex;
        }
        else {
            upperLimitIndexColumn = lastValidIndexColumn;
        }
        let seenSpaceCount = 0;
        let rank = 0;
        outer: for (var i = 0; i < upperLimitIndexColumn; i++) {

            if (rank >= largestRank) break outer; // "case '\t':" has this as well.

            // if you walked the text without hitting the maximum rank it isn't an issue.
            // rank is just a means of short circuiting any weird combinations of spaces and tabs.
            // (TODO: maybe I should believe in tab stops.)

            let c = getCharacter(line_start + i);
            switch (c) {
                case ' ':
                    seenSpaceCount++;
                    DETERMINE_decrementBy++;
                    if (seenSpaceCount % 4 === 0) {
                        // avoid a number that could approach infinity because I don't understand how machines compute division/modulo
                        // and I assume that it is easier to keep 'seenSpaceCount' at [0, 4] than compute division/modulo on very large numbers.
                        seenSpaceCount = 0;
                        rank++;
                    }
                    break;
                case '\t':
                    if (seenSpaceCount > 0) {
                        rank++;
                        seenSpaceCount = 0;
                    }
                    if (rank >= largestRank) break outer;
                    DETERMINE_decrementBy++;
                    rank++;
                    break;
                default:
                    break outer;
            }
        }
    }

    // Remember the total whitespace removed
    let ORIGINAL_decrementBy = DETERMINE_decrementBy;
    //INTS[fEDI_indent_ORIGINAL_indentBy] = ORIGINAL_decrementBy;
    let decrementBy = ORIGINAL_decrementBy;

    //// TODO: use better formatting
    //// TODO: This handles the line that the small-selection-position resides on?
    //{
    //    let linePos = EDI_getLineBoundaryPositions(SMALL_lineAndColumnIndices_indexLine);
    //    let line = linePos;
    //    let lastValidIndexColumn = EDI_getLastValidIndexColumn(SMALL_lineAndColumnIndices_indexLine);
    //    let upperLimitIndexColumn;
    //    if (lastValidIndexColumn > 4) {
    //        upperLimitIndexColumn = 4;
    //    }
    //    else {
    //        upperLimitIndexColumn = lastValidIndexColumn;
    //    }
    //    let seenSpace = false;
    //    let count = 0;
    //    outer: for (var i = 0; i < upperLimitIndexColumn; i++) {
    //        let c = getCharacter(line.start + i);
    //        switch (c) {
    //            case ' ':
    //                seenSpace = true;
    //                count++;
    //                break;
    //            case '\t':
    //                if (!seenSpace) {
    //                    count+= 4;
    //                }
    //                break outer;
    //            default:
    //                break outer;
    //        }
    //    }
//
    //    let smallLinePos = EDI_getLineBoundaryPositions(SMALL_lineAndColumnIndices_indexLine);
    //    if (SMALL_pos > smallLinePos.start) {
    //        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
    //            INTS[fEDI_cursor_selectionAnchor] -= count;
    //        }
    //        else {
    //            INTS[fEDI_cursor_selectionEnd] -= count;
    //        }
    //    }
//
    //    if (INTS[fEDI_cursor_indexLine] === SMALL_lineAndColumnIndices_indexLine) {
    //        INTS[fEDI_cursor_indexColumn] -= count;
    //    }
    //}

    // TODO: This at a glance seems to not account for when the cursor is small-position-ended and large-position-anchored...
    // ...this is moving the cursor actually, maybe it is fine? but maybe it is logic that could've been done during a loop but instead you made a new one to separately do this?
    // Also, this entire function is terribly written. You seemingly hacked something together; the code doesn't feel self explanatory. Furthermore there are both a lack of comments (given the confusing nature of how this is written), and dead comments.
    //if (INTS[fEDI_cursor_indexLine] !== SMALL_lineAndColumnIndices_indexLine) {
    //    let linePos = EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
    //    let line = linePos;
    //    let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
    //    let upperLimitIndexColumn;
    //    if (lastValidIndexColumn > that_four) {
    //        upperLimitIndexColumn = that_four;
    //    }
    //    else {
    //        upperLimitIndexColumn = lastValidIndexColumn;
    //    }
    //    let seenSpace = false;
    //    let count = 0;
    //    outer: for (var i = 0; i < upperLimitIndexColumn; i++) {
    //        let c = getCharacter(line.start + i);
    //        switch (c) {
    //            case ' ':
    //                seenSpace = true;
    //                count++;
    //                break;
    //            case '\t':
    //                if (!seenSpace) {
    //                    count+= 4;
    //                }
    //                break outer;
    //            default:
    //                break outer;
    //        }
    //    }
    //    //let c = EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
    //    // TODO: git blame the below todo and remind them to delete the dead code
    //    // TODO: Delete this dead code / use better formatting
    //    /*if (SMALL_pos > smallLinePos.start) {
    //        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
    //            INTS[fEDI_cursor_selectionAnchor] -= count;
    //        }
    //        else {
    //            INTS[fEDI_cursor_selectionEnd] -= count;
    //        }
    //    }*/
    //    //if (INTS[fEDI_cursor_indexLine] === LARGE_lineAndColumnIndices.indexLine) {
    //    //    INTS[fEDI_cursor_indexColumn] -= count;
    //    //}
    //}

    let trackedSyntaxReposition_i = EDI_trackedSyntaxReposition_find(INTS[fEDI_EDI_indentLess_startingLinePos_end] + 1);
    if (trackedSyntaxReposition_i === NaN || trackedSyntaxReposition_i === -1) {
        trackedSyntaxReposition_i = EDI_trackedSyntaxList.count_abstract;
    }
    for (var i = trackedSyntaxReposition_i; i < EDI_trackedSyntaxList.count_abstract; i++) {
        EDI_trackedSyntaxList.setStart(
            i,
            EDI_trackedSyntaxList.getStart(i) - ORIGINAL_decrementBy);
    }
    trackedSyntaxReposition_i--;

    for (var lineI = startingIndex; lineI >= SMALL_lineAndColumnIndices_indexLine; lineI--) {
        let innerRemoveCount = 0;
        EDI_getLineBoundaryPositions(lineI);
        const line_start = INTS[fEDI_getLineBoundaryPositions_start];
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(lineI);
        let upperLimitIndexColumn;
        if (lastValidIndexColumn > maxVirtualColumnIndex) {
            upperLimitIndexColumn = maxVirtualColumnIndex;
        }
        else {
            upperLimitIndexColumn = lastValidIndexColumn;
        }

        let seenSpaceCount = 0;
        let rank = 0;
        outer: for (var i = 0; i < upperLimitIndexColumn; i++) {

            if (rank >= largestRank) break outer; // "case '\t':" has this as well.

            // if you walked the text without hitting the maximum rank it isn't an issue.
            // rank is just a means of short circuiting any weird combinations of spaces and tabs.
            // (TODO: maybe I should believe in tab stops.)

            let c = getCharacter(line_start + i);
            switch (c) {
                case ' ':
                    seenSpaceCount++;
                    innerRemoveCount++;
                    if (seenSpaceCount % 4 === 0) {
                        // avoid a number that could approach infinity because I don't understand how machines compute division/modulo
                        // and I assume that it is easier to keep 'seenSpaceCount' at [0, 4] than compute division/modulo on very large numbers.
                        seenSpaceCount = 0;
                        rank++;
                    }
                    break;
                case '\t':
                    if (seenSpaceCount > 0) {
                        rank++;
                        seenSpaceCount = 0;
                    }
                    if (rank >= largestRank) break outer;
                    innerRemoveCount++;
                    rank++;
                    break;
                default:
                    break outer;
            }
        }

        for (; trackedSyntaxReposition_i >= 0; trackedSyntaxReposition_i--) {
            let start = EDI_trackedSyntaxList.getStart(trackedSyntaxReposition_i);
            if (line_start <= start) {
                EDI_trackedSyntaxList.setStart(trackedSyntaxReposition_i, start - decrementBy);
            }
            else {
                break;
            }
        }
        EDI_trackedSyntaxList.getElementAt(trackedSyntaxReposition_i);
        if (line_start > INTS[fEDI_pooledTrackedSyntax_start] && line_start < INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(trackedSyntaxReposition_i, INTS[fEDI_pooledTrackedSyntax_length] - innerRemoveCount);
        }

        EDI_textByteList_removeAt(line_start, innerRemoveCount);
	    EDI_lineEndPositionList_data[lineI] -= decrementBy;

        decrementBy -= innerRemoveCount;
    }

    for (var lineI = startingIndex + 1; lineI < EDI_lineEndPositionList_count; lineI++) {
        EDI_lineEndPositionList_data[lineI] -= ORIGINAL_decrementBy;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Paste(indexLine_editOccurredOn) {
    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(INTS[fEDI_cursor_editPosition], INTS[fEDI_cursor_editLength]);
    
    let content = EDI_cursor_EDI_paste_clipboardContent;
    EDI_cursor_EDI_paste_clipboardContent = null;

    let linesInsertedCount = 0;
    let insertionLength = 0;

    for (var sourceI = 0; sourceI < content.length; sourceI++) {
        const code = content.charCodeAt(sourceI);
        switch (code) {
            case CONST_EDI_ASCII_TAB:
                EDI_textByteList_insertBytes(INTS[fEDI_cursor_editPosition] + insertionLength, EDI_tab_tabsbytes, /*offset*/ 0, /*length*/ 4);
                insertionLength += 4;
                break;
            case CONST_EDI_ASCII_LINE_FEED:
                EDI_textByteList_insert(INTS[fEDI_cursor_editPosition] + insertionLength, CONST_EDI_ASCII_LINE_FEED);
                EDI_lineEndPositionList_insert(INTS[fEDI_cursor_editIndexLine] + linesInsertedCount, INTS[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            case 13 /* carriage return '\r' */:
                if (sourceI < content.length - 1 && content.charCodeAt(sourceI + 1) === CONST_EDI_ASCII_LINE_FEED) {
                    sourceI++;
                }
                EDI_textByteList_insert(INTS[fEDI_cursor_editPosition] + insertionLength, CONST_EDI_ASCII_LINE_FEED);
                EDI_lineEndPositionList_insert(INTS[fEDI_cursor_editIndexLine] + linesInsertedCount, INTS[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            default:
                EDI_textByteList_insert(INTS[fEDI_cursor_editPosition] + insertionLength, code);
                insertionLength++;
                break;
        }
    }

    for (var i = INTS[fEDI_cursor_editIndexLine] + linesInsertedCount; i < EDI_lineEndPositionList_count; i++) {
        EDI_lineEndPositionList_data[i] += insertionLength;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Duplicate(indexLine_editOccurredOn) {
    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(INTS[fEDI_cursor_editPosition], INTS[fEDI_cursor_editLength]);

    let small = INTS[fEDI_cursor_EDI_duplicate_small];
    let length = INTS[fEDI_cursor_EDI_duplicate_length];

    INTS[fEDI_cursor_EDI_duplicate_small] = 0;
    INTS[fEDI_cursor_EDI_duplicate_length] = 0;

    let linesInsertedCount = 0;
    let insertionLength = 0;

    EDI_textByteList_duplicateWithin(small, INTS[fEDI_cursor_editPosition], length);

    // TODO: You should be able to do this much faster than looping over the selected bytes since you know the line end positions that exist and would know whether the selection will insert line endings.

    for (let offset = 0; offset < length; offset++) {
        switch (EDI_textByteList_bytes[small + offset]) {
            case CONST_EDI_ASCII_TAB:
                insertionLength += 4;
                break;
            case CONST_EDI_ASCII_LINE_FEED:
                EDI_lineEndPositionList_insert(INTS[fEDI_cursor_editIndexLine] + linesInsertedCount, INTS[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            default:
                insertionLength++;
                break;
        }
    }

    for (var i = INTS[fEDI_cursor_editIndexLine] + linesInsertedCount; i < EDI_lineEndPositionList_count; i++) {
        EDI_lineEndPositionList_data[i] += insertionLength;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_DeleteLtr_BackspaceRtl_RemoveTextNoBatching(indexLine_editOccurredOn) {
    // TODO: surely u'd get this before doing the edit?
    let startLineAndColumnIndices_indexLine;
    let startLineAndColumnIndices_indexColumn;
    if (INTS[fEDI_cursor_editKind] === EditKind_RemoveTextNoBatching) {
        startLineAndColumnIndices_indexLine = INTS[fEDI_cursor_editIndexLine];
        startLineAndColumnIndices_indexColumn = INTS[fEDI_cursor_editIndexColumn];
    }
    else {
        EDI_getLineAndColumnIndices_raw(INTS[fEDI_cursor_editPosition]);
        startLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        startLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    }
    let endLineAndColumnIndices_indexLine;
    let endLineAndColumnIndices_indexColumn;
    if (INTS[fEDI_cursor_editKind] === EditKind_RemoveTextNoBatching) {
        endLineAndColumnIndices_indexLine = INTS[fEDI_cursor_END_editIndexLine];
        endLineAndColumnIndices_indexColumn = INTS[fEDI_cursor_END_editIndexColumn];
    }
    else {
        EDI_getLineAndColumnIndices_raw(INTS[fEDI_cursor_editPosition] + INTS[fEDI_cursor_editLength]);
        endLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        endLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    }

    if (INTS[fEDI_cursor_editLineFeedCount] > 0) {
        let count = 0;
        let lastMatchedIndexLine = 0;
        for (let i = EDI_lineEndPositionList_PENDING.count - 1; i >= 0; i--) {
            let lineEndPos = EDI_lineEndPositionList_PENDING.data[i];
            if (INTS[fEDI_cursor_editPosition] <= lineEndPos && INTS[fEDI_cursor_editPosition] + INTS[fEDI_cursor_editLength] > lineEndPos) {
                EDI_getLineAndColumnIndices_raw(lineEndPos);
                lastMatchedIndexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
                count++;
                EDI_lineEndPositionList_PENDING.removeAt(i, 1);
            }
            else if (INTS[fEDI_cursor_editPosition] > lineEndPos) {
                break;
            }
        }
        if (count > 0) {
            EDI_lineEndPositionList_removeAt(lastMatchedIndexLine, count);
        }
    }
    for (let i = EDI_lineEndPositionList_count - 1; i >= 0; i--) {
        if (INTS[fEDI_cursor_editPosition] < EDI_lineEndPositionList_data[i]) {
            EDI_lineEndPositionList_data[i] -= INTS[fEDI_cursor_editLength];
        }
        else {
            if (i === EDI_lineEndPositionList_count - 1) {
                indexLine_editOccurredOn = i;
            }
            else {
                indexLine_editOccurredOn = i + 1;
            }
            break;
        }
    }
    for (var i = EDI_trackedSyntaxList.count_abstract - 1; i >= 0; i--) {
        EDI_trackedSyntaxList.getElementAt(i);
        if (INTS[fEDI_cursor_editPosition] < INTS[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, INTS[fEDI_pooledTrackedSyntax_start] - INTS[fEDI_cursor_editLength]);
        }
        else if (INTS[fEDI_pooledTrackedSyntax_start] >= INTS[fEDI_cursor_editPosition] && INTS[fEDI_pooledTrackedSyntax_start] < INTS[fEDI_cursor_editPosition] + INTS[fEDI_cursor_editLength]) {
            // TODO: This needs to remove more than 1 at a time
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (BYTES[byteEDI_pooledTrackedSyntax_trackedSyntaxKind] === TrackedSyntaxKind_Comment &&
                (INTS[fEDI_pooledTrackedSyntax_start] + 1) >= INTS[fEDI_cursor_editPosition] && (INTS[fEDI_pooledTrackedSyntax_start] + 1) < INTS[fEDI_cursor_editPosition] + INTS[fEDI_cursor_editLength]) {
            // TODO: You can invalidate a >1 char long by removing beyond just the first unless a character afterwards falls into place that is valid by chance
            //
            // only multi-line-comments that span multiple lines are stored in EDI_trackedSyntaxList with the 'TrackedSyntaxKind_Comment'
            //
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (INTS[fEDI_cursor_editPosition] > INTS[fEDI_pooledTrackedSyntax_start] && INTS[fEDI_cursor_editPosition] < INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, INTS[fEDI_pooledTrackedSyntax_length] - INTS[fEDI_cursor_editLength]);
        }
    }

    EDI_textByteList_removeAt(INTS[fEDI_cursor_editPosition], INTS[fEDI_cursor_editLength]);

    let textSourceIdentifier = EDI_FORMATTED_textSourceIdentifier;
    let text = '';
    INTS[F_didChangeTextDocument_version] = INTS[F_didChangeTextDocument_version] + 1;
    let version = INTS[F_didChangeTextDocument_version];

    // --- CLEAN INTEGRATION ---
    enqueueLSPNotification({
        absolutePath: textSourceIdentifier,
        version: version,
        startLine: startLineAndColumnIndices_indexLine,
        startCharacter: startLineAndColumnIndices_indexColumn,
        endLine: endLineAndColumnIndices_indexLine,
        endCharacter: endLineAndColumnIndices_indexColumn,
        text: text
    });
    // -------------------------

    if (indexLine_editOccurredOn === INTS[fEDI_longestLine_indexLine]) {
        INTS[fEDI_longestLine_length] = INTS[fEDI_longestLine_length] - INTS[fEDI_cursor_editLength];
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;

    /*
    - Syntax is fully encompassed by the removed text  => remove
    - Syntax's open is encompassed by the removed text => invalidate

    invalidate => remove

    Are these the same thing then?

    If the open is removed then yeah
    strings are possibly more complex than the multi-line-comment because the same open as close

    TODO: If the open is > 1 characters long then an insertions among those characters is a break too.
    */
}

function EDI_finalizeEdit_ClearEditState() {
    INTS[fEDI_cursor_editKind] = EditKind_None;
    INTS[fEDI_cursor_editLength] = 0;
    INTS[fEDI_cursor_editPosition] = 0;
    INTS[fEDI_cursor_editIndexLine] = 0;
    INTS[fEDI_cursor_editIndexColumn] = 0;
    INTS[fEDI_cursor_editRenderedDisplacement] = 0;
    INTS[fEDI_cursor_END_editIndexLine] = 0;
    INTS[fEDI_cursor_END_editIndexColumn] = 0;
    INTS[fEDI_cursor_gapBufferCount] = 0;
    EDI_cursor_gapBufferWriteToSpanElement = null;
    INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
    INTS[fEDI_cursor_editLineFeedCount] = 0;
    EDI_lineEndPositionList_PENDING.clear();
}

function enqueueLSPNotification(payload) {
    lspQueue.push(payload);
    processLspQueue(); // Fire-and-forget processing loop
}

async function processLspQueue() {
    if (BYTES[byteisProcessingLspQueue]) return;
    BYTES[byteisProcessingLspQueue] = 1;

    while (lspQueue.length > 0) {
        const item = lspQueue.shift(); // Guarantees strict FIFO order
        
        try {
            // Await the Electron IPC and LSP stdin write
            await window.myAPI.didChangeTextDocumentNotification(
                item.absolutePath,
                item.version,
                item.startLine,
                item.startCharacter,
                item.endLine,
                item.endCharacter,
                item.text
            );
        } catch (error) {
            console.error("LSP IPC notification failed:", error);
        }
    }

    BYTES[byteisProcessingLspQueue] = 0;
}

/**
 * Returns the underlying uint8array that contains the encoded characters for the text.
 * The uint8array's capacity (i.e.: length) is not what should be saved out.
 * Instead only save the countOfBytesInUse.
 * 
 * The editor stores all line endings as '\n'.
 * When saving the bytes, swap out any '\n' for the 'lineEndString' which may or may not be '\n' (i.e.: it could be '\r\n' or '\r').
 * 
 * A '\0' character does NOT terminate the subarray's bytes that are in use.
 * You need to iterate specifically for 'countOfBytesInUse'.
 * 
 * @param {*} NOTfinalizePendingEdits if there is a pending edit, it needs to be finalized in order to see the updated text. The default behavior is to finalize the pending edits. To use default behavior, do NOT provide the parameter, or provide a falsey expression like 'null'.
 * @returns
 */
function EDI_getFinalizedEditsAndRawSaveFileData(NOTfinalizePendingEdits) {
    if (!NOTfinalizePendingEdits) {
        EDI_finalizeEdit();
    }
    return {
        uint8arrayTextBytes: EDI_textByteList_bytes,
        countOfBytesInUse: EDI_textByteList_count,
        lineEndString: EDI_lineEndString,
        fileStartsWithBom: Boolean(get_EDI_fileStartsWithBom())
    };
}

/**
 * @param {*} indexLine
 * @returns {number} the last valid POSITION index on the line, but with respect to any pending edits.
 */
function EDI_readLineEndPositionList(indexLine) {
    let lineEndPositionIndex = EDI_lineEndPositionList_data[indexLine];

    // If you need to determine the text without finalizing an edit, you DO have to loop forwards right?
    if (INTS[fEDI_cursor_editLength] > 0 && INTS[fEDI_cursor_editPosition] <= lineEndPositionIndex) {
        switch (INTS[fEDI_cursor_editKind]) {
            case EditKind_InsertLtr:
                lineEndPositionIndex += INTS[fEDI_cursor_editLength];
                break;
            case EditKind_DeleteLtr:
            case EditKind_BackspaceRtl:
            case EditKind_RemoveTextNoBatching:
                lineEndPositionIndex -= INTS[fEDI_cursor_editLength];
                break;
        }
    }

    return lineEndPositionIndex;
}

/**
 * If you were to make a function for this logic, it presumably would look like this.
 * I'm not sure if I like the idea of having a function for this though, given it is inside a loop, I'd want to investigate whether it has any performance impacts.
 * TODO: make a decision
 * 
 * @returns trackedSyntax_I the index that was left off on
 */
function EDI_createSpansForLineOfText(div, lineStart, lineEnd, trackedSyntax_I) {
	let childIndex = 0;

    if (lineStart === lineEnd) {
    	if (childIndex < div.children.length) {
            let span = div.children[childIndex++];
			span.textContent = '';
            span.className = '';
		}
		else {
			div.appendChild(document.createElement('span'));
            childIndex++;
		}
    }
    else {
        let substart = lineStart;
        for (; trackedSyntax_I < EDI_trackedSyntaxList.count_abstract;) {
            EDI_trackedSyntaxList.getElementAt(trackedSyntax_I);
    
            if (substart >= lineEnd) {
                break;
            }
    
            if (INTS[fEDI_pooledTrackedSyntax_start] >= lineEnd) {
                break;
            }
    
            if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] < lineStart) {
                trackedSyntax_I++;
                continue;
            }
    
            if (INTS[fEDI_pooledTrackedSyntax_start] > substart) {
                let subend = INTS[fEDI_pooledTrackedSyntax_start] > lineEnd ? lineEnd : INTS[fEDI_pooledTrackedSyntax_start]; // probably a nonsense line of code given the previous if statements
                childIndex = EDI_language_line_lex(div, substart, subend, childIndex);
                substart += (subend - substart);
            }
    
            {
                let span;
                if (childIndex < div.children.length) {
					span = div.children[childIndex++];
                    //span.className = ''; className is guaranteed to be set in this specific case
				}
				else {
					span = document.createElement('span');
                    div.appendChild(span);
                    childIndex++;
				}
                let trackedSyntaxEnd = INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length];
                let subend = trackedSyntaxEnd > lineEnd ? lineEnd : trackedSyntaxEnd;
                span.textContent = EDI_decoder.decode(EDI_textByteList_bytes.subarray(substart, subend));
                substart += (subend - substart);
                switch (BYTES[byteEDI_pooledTrackedSyntax_trackedSyntaxKind]) {
                    case TrackedSyntaxKind_Comment:
                        span.className = 'eCM';
                        break;
                    case TrackedSyntaxKind_String:
                        span.className = 'eSM';
                        break;
                    default:
                        span.className = '';
                        break;
                }
            }
    
            if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] <= lineEnd) {
                trackedSyntax_I++;
                continue;
            }
    
            break;
        }
    
        if (substart < lineEnd) {
            childIndex = EDI_language_line_lex(div, substart, lineEnd, childIndex);
        }
    }

    let aaa = div.children.length - childIndex;
    for (let i = 0; i < aaa; i++) {
        div.removeChild(div.children[childIndex]);
    }

    return trackedSyntax_I;
}

function walkLineUntilIndexColumn() {
    // TODO: delete key until you delete a linefeed and join the next line onto your own then press backspace everything breaks.

    // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
    INTS[fEDI_w_ringBufferIndex] = INTS[fEDI_cursor_indexLine] - INTS[fEDI_virtualIndexLine];
    if (INTS[fEDI_w_ringBufferIndex] >= INTS[fEDI_ArrayFrom_textElement_children_length] || INTS[fEDI_w_ringBufferIndex] < 0) INTS[fEDI_w_ringBufferIndex] = -1;
    else INTS[fEDI_w_ringBufferIndex] = (INTS[fEDI_w_ringBufferIndex] + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];
    
    if (INTS[fEDI_w_ringBufferIndex] < 0) {
        INTS[fEDI_w_indexColumn_Goal] = 0;
        INTS[fEDI_w_indexColumn_Sum] = 0;
        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
        INTS[fEDI_w_indexSpan] = 0;
        w_span = null;
        w_div = null;
        INTS[fEDI_w_ringBufferIndex] = INTS[fEDI_w_ringBufferIndex]; // double assignment but not all that pressing of a matter at the moment I think it reads better to just set it / avoid the temporary 'let' local variable each invocation.
        return;
    }
    
    let div = EDI_ringBuffer_text[INTS[fEDI_w_ringBufferIndex]];
    let indexColumn_Goal = INTS[fEDI_cursor_indexColumn];
    let indexColumn_Sum = 0;

    for (var indexSpan = 0; indexSpan < div.children.length; indexSpan++) {
        let span = div.children[indexSpan];
        if (indexColumn_Goal <= indexColumn_Sum + span.textContent.length) {
            // '<=' because end-of-line text insertion (end of line but prior to the line ending itself).
            // The line ending isn't written to the span, it is represented by the encompassing div itself.
            INTS[fEDI_w_indexColumn_Goal] = indexColumn_Goal;
            INTS[fEDI_w_indexColumn_Sum] = indexColumn_Sum;
            INTS[fEDI_w_indexColumn_SpanTextContentRelative] = indexColumn_Goal - indexColumn_Sum;
            INTS[fEDI_w_indexSpan] = indexSpan;
            w_span = span;
            w_div = div;
            INTS[fEDI_w_ringBufferIndex] = INTS[fEDI_w_ringBufferIndex];
            return;
        }
        else {
            indexColumn_Sum += span.textContent.length;
        }
    }

    // TODO: When the column index is too large, how should this be handled?
    INTS[fEDI_w_indexColumn_Goal] = 0;
    INTS[fEDI_w_indexColumn_Sum] = 0;
    INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
    INTS[fEDI_w_indexSpan] = 0;
    w_span = null;
    w_div = null;
    INTS[fEDI_w_ringBufferIndex] = INTS[fEDI_w_ringBufferIndex];
    return;
}

/**
 * Use case: HTML was previously rendered, but the content of the line was modified
 * and logic to more efficiently manipulate the existing HTML is not yet written.
 * 
 * Example modifications:
 * - The same line index had its contents modified.
 * - Visually the line index that virtually appears as that child element is not the same as it previously was
 *   due to various reasons, perhaps a change in scroll position.
 * 
 * Prior to invoking this function ensure the provided elements's innerHTML is empty:
 * - "gutterLineElement.innerHTML = '';"
 * - "divElement.innerHTML = '';"
 * @param {number} indexLine 
 * @param {HTMLElement} gutterLineElement 
 * @param {HTMLElement} divElement 
 */
function EDI_drawLine(indexLine, gutterLineElement, textLineElement) {
    if (indexLine >= EDI_lineEndPositionList_count) {
        gutterLineElement.textContent = '~';
    }
    else {
        gutterLineElement.textContent = indexLine + 1;
    }

    let trackedSyntax_StartingIndex = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLine);
    if (trackedSyntax_StartingIndex === NaN || trackedSyntax_StartingIndex === -1) {
        trackedSyntax_StartingIndex = EDI_trackedSyntaxList.count_abstract;
    }
    EDI_getLineBoundaryPositions(indexLine);
    EDI_createSpansForLineOfText(textLineElement, INTS[fEDI_getLineBoundaryPositions_start], INTS[fEDI_getLineBoundaryPositions_end], trackedSyntax_StartingIndex);
}

/**
 * if (trackedSyntax_StartingIndex === NaN || trackedSyntax_StartingIndex === -1) { trackedSyntax_StartingIndex = EDI_trackedSyntaxList.count_abstract; }
 * @param {*} indexLineAaa 
 * @returns 
 */
function EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLineAaa) {

    // TODO: 'indexLineAaa' and 'indexLineBbb'; babel compiler error when both were named indexLine.

    let local_EDI_trackedSyntaxList = EDI_trackedSyntaxList;

    EDI_getLineBoundaryPositions(indexLineAaa);
    const positionIndex = INTS[fEDI_getLineBoundaryPositions_start];

    let left = 0;
    let right = local_EDI_trackedSyntaxList.count_abstract - 1;

    let indexLineBbb = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);

        local_EDI_trackedSyntaxList.getElementAt(mid);
        
        if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > positionIndex) {
            indexLineBbb = mid;

            if (INTS[fEDI_pooledTrackedSyntax_start] === positionIndex) {
                break;
            }
            
            right = mid - 1;
        }
        else if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] <= positionIndex) {
            left = mid + 1;
        }
        else {
            return; // NaN
        }
    }

    return indexLineBbb;
}

/**
 * if (trackedSyntax_StartingIndex === NaN || trackedSyntax_StartingIndex === -1) { trackedSyntax_StartingIndex = EDI_trackedSyntaxList.count_abstract; }
 * Probably should make 1 of these and accept a predicate.
 */
function EDI_trackedSyntaxReposition_find(positionIndex) {

    let local_EDI_trackedSyntaxList = EDI_trackedSyntaxList;

    let left = 0;
    let right = local_EDI_trackedSyntaxList.count_abstract - 1;

    let indexLine = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);

        let start = local_EDI_trackedSyntaxList.getStart(mid);
        
        if (positionIndex <= start) {
            indexLine = mid;

            if (positionIndex === start) {
                break;
            }
            
            right = mid - 1;
        }
        else if (positionIndex > start) {
            left = mid + 1;
        }
        else {
            return; // NaN
        }
    }

    return indexLine;
}

/** modification of Google AI Overview "javascript count of digits" */
function positiveNumbersOnly_countDigitsLoop(number) {
  if (number <= 0) return 1;
  let count = 0;

  while (number > 0) {
    number = Math.floor(number / 10); // Remove the last digit
    count++;
  }

  return count;
}

/**
 * This method will NOT "put a cursor on screen". You need to ensure
 * your cursor exists as a child by appendChild'ing to EDTIOR_cursorListElement.
 * This method instead only moves a cursor that ALREADY is being shown on screen.
 * 
 * If the 'cursor' is not EDI_primaryCursor, then the 'NOTscrollCursorIntoView' parameter has no effect.
 * i.e.: only the EDI_primaryCursor will ever be scrolled into view via this method.
 * 
 * @param {boolean} NOTscrollCursorIntoView 
 */
function EDI_drawCursor(NOTscrollCursorIntoView) {
    INTS[fEDI_cursor_cursorTranslateYValue] = INTS[fEDI_cursor_indexLine] * INTS[fEDI_lineHeight];



// cursor should store visual column then
// and relative to line index



/*
TODO:
INTS[fEDI_cursor_indexLine]

- [ ] Resets:
    - [ ] ArrowDown
    - [ ] ArrowUp
    - [ ] MouseDown where 'cursorVisualColumnIndex_relativeToThisLineIndex' !== the line index mouse down-ed on.
    - [ ] MouseMove where 'cursorVisualColumnIndex_relativeToThisLineIndex' !== the line index mouse move-ed on.
- [ ] Updates:
    - [ ] All edits where 'cursorVisualColumnIndex_relativeToThisLineIndex' === the line index edited, and the edit comes at or a lower column index than that of the cursor need to update the cursorVisualColumnIndex
    - [ ] MouseDown where 'cursorVisualColumnIndex_relativeToThisLineIndex' === the same line index that the cursor is on, determine the 'characters traveled' to go from initial position to mouse down position and modify by how many chars/tabs etc... you traveled over
    - [ ] ArrowLeft where 'cursorVisualColumnIndex_relativeToThisLineIndex' === the same line index that the cursor is on, determine the 'characters traveled' to go from initial position to ending position and modify by how many chars/tabs etc... you traveled over
        - [ ] No modifiers
        - [ ] CtrlKey
        - [ ] When NOT holding shift, but you have an active selection
    - [ ] ArrowRight where 'cursorVisualColumnIndex_relativeToThisLineIndex' === the same line index that the cursor is on, determine the 'characters traveled' to go from initial position to ending position and modify by how many chars/tabs etc... you traveled over
        - [ ] No modifiers
        - [ ] CtrlKey
        - [ ] When NOT holding shift, but you have an active selection
- [ ] Further necessary details:
    - [ ] I... does MouseDown need to finalize the edits?
    - [ ] Do other things need to finalize the edits?
    - [ ] ArrowLeft/ArrowRight?
    - [ ] Preferably if you insert text, then remove text, but the removed text is part of the text that you inserted
          that you'd just modify the "gap buffer" and avoid:
          - insert
          - remove triggers finalize of insert
          - start remove
          - eventually finalize remove
          ============================
          versus
          - insert
          - remove just modifies the inserted text
          - eventually finalize insert
        - [ ] But from an order of implementations I don't necessarily know if it is a good idea for me to concern myself with these details or not.
        - [ ] (i.e.: not yet?)
        - [ ] Thus you get the simple batching of edits 100% correct first
        - [ ] And do the other complex batching later.
- [ ] A thought for checking the answer:
    - [ ] Ctrl+Shift+F for 'INTS[fEDI_cursor_indexColumn]' and make sure any modifications to it (eventually) result in a modification to 'fEDI_cursorVisualColumnIndex'.
        - [ ] I say eventually because maybe you'd in some cases save the 'fEDI_cursorVisualColumnIndex' part until the end I'm not sure I just consider that maybe there'd be a case where that's done.
    - [ ] Ctrl+Shift+F for 'INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]' and make sure any modifications to it (eventually) result in a modification to 'fEDI_cursorVisualColumnIndex_relativeToThisLineIndex' and then if this changes update 'fEDI_cursor_indexColumn' accordingly.
*/


    ////getXFromIndex(lineText, targetIndex, charWidth, paddingLeft = 0)
    //let visualColumns = 0;
    ////// Clamp target index to string boundaries
    ////const end = Math.min(targetIndex, lineText.length);
    //const end = INTS[fEDI_cursor_indexColumn];
    //for (let i = 0; i < end; i++) {
    //    if (lineText[i] === '\t') {
    //        // Calculate spaces to next tab stop
    //        visualColumns += 4 - (visualColumns % 4);
    //    } else {
    //        visualColumns += 1;
    //    }
    //}
    //return paddingLeft + (visualColumns * charWidth);









    INTS[fEDI_cursor_cursorTranslateXValue] = INTS[fEDI_cursorVisualColumnIndex] * EDI_characterWidth;

    EDI_cursor_caretRow.style.transform = `translateY(${INTS[fEDI_cursor_cursorTranslateYValue]}px)`;
    EDI_cursor_cursorElement.style.transform = `translateX(${INTS[fEDI_cursor_cursorTranslateXValue]}px)`;

    EDI_createStyleForSelection();

    // TODO: This logic has way too much overhead to be in this function.
    let text = '';

    text += '(' + INTS[fEDI_cursor_indexLine] + ', ' + INTS[fEDI_cursor_indexColumn] + ')';
    
    if (BYTES[byteDIALOG_Settings_editorDebugShowAdjacentCharacters]) {
        let previous = EDI_getCharacterPrevious(INTS[fEDI_cursor_indexColumn], EDI_getPositionIndex_cursor());
        if (previous === '\n') previous = '\\n';
        else if (previous === '\t') previous = '\\t';
        let current = EDI_getCharacterCurrent(INTS[fEDI_cursor_indexColumn], EDI_getPositionIndex_cursor(), EDI_getLineEnd_pos(INTS[fEDI_cursor_indexLine]));
        if (current === '\n') current = '\\n';
        else if (current === '\t') current = '\\t';
        text += ' | (' + previous + ', ' + current + ')';
    }
    
    text += ' | (' + INTS[fEDI_cursor_editLength] + ')';

    text += ' | (' + INTS[fEDI_longestLine_indexLine] + ', ' + INTS[fEDI_longestLine_length] + ')';

    EDI_debug.replaceChildren(text);

    if (!NOTscrollCursorIntoView) {
        EDI_scrollCursorIntoView();
    }
}

/**
 * Returns 'true' if success otherwise 'false' the "return" values are indexLine, and indexColumn; which are stored in 'fieldBuffer.js'
 * as 'INTS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;' and 'INTS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;'.
 * 
 * TODO: Local variables for this looping logic?
 */
function EDI_getLineAndColumnIndices_raw(positionIndex) {
    let left = 0;
    let right = EDI_lineEndPositionList_count - 1;

    let indexLine = -1;
    let indexColumn = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (EDI_lineEndPositionList_data[mid] >= positionIndex) {
            indexLine = mid;

            if (EDI_lineEndPositionList_data[mid] === positionIndex) {
                break;
            }
            
            right = mid - 1;
        }
        else if (EDI_lineEndPositionList_data[mid] < positionIndex) {
            left = mid + 1;
        }
        else {
            return false; // NaN
        }
    }

    if (indexLine === -1) {
        return false;
        //return {
        //  indexLine: 0,
        //  indexColumn: 0,  
        //};
    }

    if (indexLine === 0) {
        indexColumn = positionIndex;
    }
    else {
        indexColumn = positionIndex - (EDI_lineEndPositionList_data[indexLine - 1] + 1);
    }

    INTS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;
    INTS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;
    return true;
}

/**
 * Returns 'true' if success otherwise 'false' the "return" values are indexLine, and indexColumn; which are stored in 'fieldBuffer.js'
 * as 'INTS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;' and 'INTS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;'.
 * 
 * TODO: Local variables for this looping logic?
 */
function EDI_getLineAndColumnIndices(positionIndex) {
    let left = 0;
    let right = EDI_lineEndPositionList_count - 1;

    let indexLine = -1;
    let indexColumn = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (EDI_readLineEndPositionList(mid) >= positionIndex) {
            indexLine = mid;

            if (EDI_readLineEndPositionList(mid) === positionIndex) {
                break;
            }
            
            right = mid - 1;
        }
        else if (EDI_readLineEndPositionList(mid) < positionIndex) {
            left = mid + 1;
        }
        else {
            return false; // NaN
        }
    }

    if (indexLine === -1) {
        return false;
        //return {
        //  indexLine: 0,
        //  indexColumn: 0,  
        //};
    }

    if (indexLine === 0) {
        indexColumn = positionIndex;
    }
    else {
        indexColumn = positionIndex - (EDI_readLineEndPositionList(indexLine - 1) + 1);
    }

    INTS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;
    INTS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;
    return true;
}

/**
 * This function only clears both the 'BYTES[byteEDI_cursor_selectionDivExists]' and the HTML associated with the selection NOT the actual selection position properties of the cursor.
 */
function EDI_clearSelectionStyle() {
    let shouldExistSelectionDiv = false;
    if (BYTES[byteEDI_cursor_selectionDivExists]) {
        for (var i = 0; i < EDI_presentation.children.length; i++) {
            if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                let textSelectionDiv = EDI_presentation.children[i];
                if (!shouldExistSelectionDiv) {
                    EDI_presentation.removeChild(textSelectionDiv);
                    BYTES[byteEDI_cursor_selectionDivExists] = 0;
                }
                break;
            }
        }
    }
}

function EDI_createStyleForSelection() {
    if (INTS[fEDI_cursor_DRAWN_selectionAnchor] !== INTS[fEDI_cursor_selectionAnchor] ||
        INTS[fEDI_cursor_DRAWN_selectionEnd] !== INTS[fEDI_cursor_selectionEnd] ||
        INTS[fEDI_cursor_DRAWN_selection_virtualCount] !== INTS[fEDI_virtualCount] ||
        INTS[fEDI_cursor_DRAWN_selection_virtualIndexLine] !== INTS[fEDI_virtualIndexLine]) {

        INTS[fEDI_cursor_DRAWN_selectionAnchor] = INTS[fEDI_cursor_selectionAnchor];
        INTS[fEDI_cursor_DRAWN_selectionEnd] = INTS[fEDI_cursor_selectionEnd];
        INTS[fEDI_cursor_DRAWN_selection_virtualCount] = INTS[fEDI_virtualCount];
        INTS[fEDI_cursor_DRAWN_selection_virtualIndexLine] = INTS[fEDI_virtualIndexLine];

        let shouldExistSelectionDiv = false;
        if (INTS[fEDI_cursor_DRAWN_selectionAnchor] === INTS[fEDI_cursor_DRAWN_selectionEnd]) {
            shouldExistSelectionDiv = false;
        }
        else {
            shouldExistSelectionDiv = true;
        }

        let textSelectionDiv;

        if (BYTES[byteEDI_cursor_selectionDivExists]) {
            for (var i = 0; i < EDI_presentation.children.length; i++) {
                if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                    textSelectionDiv = EDI_presentation.children[i];
                    if (!shouldExistSelectionDiv) {
                        EDI_presentation.removeChild(textSelectionDiv);
                        BYTES[byteEDI_cursor_selectionDivExists] = 0;
                    }
                    break;
                }
            }
        }
        else if (shouldExistSelectionDiv) {
            textSelectionDiv = document.createElement('div');
            textSelectionDiv.id = CONST_EDI_cursor_htmlId;
            textSelectionDiv.style.display = 'contents';
            EDI_presentation.appendChild(textSelectionDiv);
            BYTES[byteEDI_cursor_selectionDivExists] = 1;
        }

        if (!BYTES[byteEDI_cursor_selectionDivExists]) return;

        // TODO: only somewhat simple viewport based virtualization is implemented from what I remember. i.e.: I think the divs are re-used, but every div is redrawn for the viewport, rather than only recalculating the css for the divs that came or left the viewport.

        let start = INTS[fEDI_cursor_selectionAnchor];
        EDI_getLineAndColumnIndices(start);
        let startLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        let startLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
        let startLine = startLineAndColumnIndices_indexLine;
        let startColumn = startLineAndColumnIndices_indexColumn;

        let end = INTS[fEDI_cursor_selectionEnd];
        EDI_getLineAndColumnIndices(end);
        let endLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        let endLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
        let INCLUSIVEendLine = endLineAndColumnIndices_indexLine;
        let INCLUSIVEendColumn = endLineAndColumnIndices_indexColumn;

        // # Virtualization
        if (startLine < INTS[fEDI_virtualIndexLine]) {
            startLine = INTS[fEDI_virtualIndexLine];
            startColumn = 0;
        }
        let lastIndexLineBeingShown = INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1;
        if (INCLUSIVEendLine > lastIndexLineBeingShown) {
            INCLUSIVEendLine = lastIndexLineBeingShown;
            INCLUSIVEendColumn = EDI_getLastValidIndexColumn(INCLUSIVEendLine);
        }

        if (start > end) {
            let temp = end;
            let tempLine = INCLUSIVEendLine;
            let tempColumn = INCLUSIVEendColumn;
            end = start;
            INCLUSIVEendLine = startLine;
            INCLUSIVEendColumn = startColumn;
            start = temp;
            startLine = tempLine;
            startColumn = tempColumn;
        }
        //
        // I do not want to fill the screen with display:none divs for when there is a selection to be shown there (I do it all the time but it doesn't seem sensible here).
        // Thus the first step is to ensure there are a matching amount of divs for the selections to apply their style to.
        //
        let selectedLineCount = INCLUSIVEendLine - startLine + 1;
        if (textSelectionDiv.children.length < selectedLineCount) {
            for (let i = textSelectionDiv.children.length; i < selectedLineCount; i++) {
                textSelectionDiv.appendChild(document.createElement('div'));
            }
        }
        else if (textSelectionDiv.children.length > selectedLineCount) {
            for (let i = selectedLineCount; i < textSelectionDiv.children.length; i++) {
                textSelectionDiv.removeChild(textSelectionDiv.children[i]);
            }
        }

        let lineSelectionDiv;
        let childDivIndex = 0;

        // everything static-ly will "fall at a left of gutterWidthTotal_withPxUnits"...
        // ...but you cannot rely on that as it causes layout shifting, you need to make it clear to the renderering engine.

        if (startLine == INCLUSIVEendLine) {
            lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
            lineSelectionDiv.className = 'EDI_selection';
            lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
            lineSelectionDiv.style.transform = `translate(${startColumn * EDI_characterWidth}px, ${INTS[fEDI_lineHeight] * startLine}px)`;
            lineSelectionDiv.style.width = (INCLUSIVEendColumn - startColumn) * EDI_characterWidth + 'px';
        }
        else {
            // start line
            lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
            lineSelectionDiv.className = 'EDI_selection';
            lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
            lineSelectionDiv.style.transform = `translate(${startColumn * EDI_characterWidth}px, ${INTS[fEDI_lineHeight] * startLine}px)`;
            EDI_getLineBoundaryPositions(startLine);
            let lineLength = INTS[fEDI_getLineBoundaryPositions_end] - INTS[fEDI_getLineBoundaryPositions_start];
            lineSelectionDiv.style.width = (lineLength + 1 - startColumn) * EDI_characterWidth + 'px';

            // between lines
            for (var lineI = startLine + 1; lineI < INCLUSIVEendLine; lineI++) {
                lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
                lineSelectionDiv.className = 'EDI_selection';
                lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
                lineSelectionDiv.style.transform = `translateY(${INTS[fEDI_lineHeight] * lineI}px)`;
                EDI_getLineBoundaryPositions(lineI);
                let lineLength = INTS[fEDI_getLineBoundaryPositions_end] - INTS[fEDI_getLineBoundaryPositions_start];
                lineSelectionDiv.style.width = (lineLength + 1) * EDI_characterWidth + 'px';
            }

            // end line
            lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
            lineSelectionDiv.className = 'EDI_selection';
            lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
            lineSelectionDiv.style.transform = `translateY(${INTS[fEDI_lineHeight] * INCLUSIVEendLine}px)`;
            lineSelectionDiv.style.width = INCLUSIVEendColumn * EDI_characterWidth + 'px';
        }
    }
}

function EDI_createStyleForSelection_indentMore() {
    let textSelectionDiv;
    if (BYTES[byteEDI_cursor_selectionDivExists]) {
        for (var i = 0; i < EDI_presentation.children.length; i++) {
            if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                textSelectionDiv = EDI_presentation.children[i];
                break;
            }
        }
    }
    else {
        // TODO: Silent error confusing bad idea
        return;
    }

    let extraWidth = 4 * EDI_characterWidth;
    for (let i = 0; i < textSelectionDiv.children.length; i++) {
        let lineSelectionDiv = textSelectionDiv.children[i];
        let widthNumberValue = parseFloat(lineSelectionDiv.style.width, 10);
        widthNumberValue += extraWidth;
        lineSelectionDiv.style.width = widthNumberValue + 'px';
    }

    INTS[fEDI_cursor_DRAWN_selectionAnchor] = INTS[fEDI_cursor_selectionAnchor];
    INTS[fEDI_cursor_DRAWN_selectionEnd] = INTS[fEDI_cursor_selectionEnd];
}

function EDI_getLastValidIndexColumn(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return EDI_readLineEndPositionList(indexLine) - 0;
        }
        else {
            return EDI_readLineEndPositionList(indexLine) - (EDI_readLineEndPositionList(indexLine - 1) + 1);
        }
    }
    return 0;
}

function EDI_getLastValidIndexColumn_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return EDI_lineEndPositionList_data[indexLine] - 0;
        }
        else {
            return EDI_lineEndPositionList_data[indexLine] - (EDI_lineEndPositionList_data[indexLine - 1] + 1);
        }
    }
    return 0;
}

/**
 * 'INTS[fEDI_getLineBoundaryPositions_start]' is the position of the first character on that line.
 * 
 * 'INTS[fEDI_getLineBoundaryPositions_end]' is the position of the "line end" (i.e.: ascii code for '\n' or EOF).
 * 
 * The inclusivity/exclusivity is in reference to whether the position
 * points to non-line-end-text that exists on the line
 * 
 * NOTE: In performance critical sections this code is explicitly inlined and modified to be as performant as it seemingly can get for that specific section of code.
 * 
 * @returns nothing: the results are stored in 'INTS[fEDI_getLineBoundaryPositions_start]' inclusive and 'INTS[fEDI_getLineBoundaryPositions_end]' exclusive.
 */
function EDI_getLineBoundaryPositions(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            INTS[fEDI_getLineBoundaryPositions_start] = 0;
            INTS[fEDI_getLineBoundaryPositions_end] = EDI_readLineEndPositionList(indexLine) - 0;
            return;
        }
        else {
            INTS[fEDI_getLineBoundaryPositions_start] = EDI_readLineEndPositionList(indexLine - 1) + 1;
            INTS[fEDI_getLineBoundaryPositions_end] = EDI_readLineEndPositionList(indexLine);
            return;
        }
    }
    INTS[fEDI_getLineBoundaryPositions_start] = 0;
    INTS[fEDI_getLineBoundaryPositions_end] = 0;
}

function EDI_getLineStart_pos(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return 0;
        }
        else {
            return (EDI_readLineEndPositionList(indexLine - 1) + 1);
        }
    }
    return 0;
}

function EDI_getLineEnd_pos(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return EDI_readLineEndPositionList(indexLine) - 0;
        }
        else {
            return EDI_readLineEndPositionList(indexLine);
        }
    }
    return 0;
}

/**
 * 'INTS[fEDI_getLineBoundaryPositions_start]' is the position of the first character on that line.
 * 
 * 'INTS[fEDI_getLineBoundaryPositions_end]' is the position of the "line end" (i.e.: ascii code for '\n' or EOF).
 * 
 * The inclusivity/exclusivity is in reference to whether the position
 * points to non-line-end-text that exists on the line
 * 
 * NOTE: In performance critical sections this code is explicitly inlined and modified to be as performant as it seemingly can get for that specific section of code.
 * 
 * @returns nothing: the results are stored in 'INTS[fEDI_getLineBoundaryPositions_start]' inclusive and 'INTS[fEDI_getLineBoundaryPositions_end]' exclusive.
 */
function EDI_getLineBoundaryPositions_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            INTS[fEDI_getLineBoundaryPositions_start] = 0;
            INTS[fEDI_getLineBoundaryPositions_end] = EDI_lineEndPositionList_data[indexLine] - 0;
            return;
        }
        else {
            INTS[fEDI_getLineBoundaryPositions_start] = EDI_lineEndPositionList_data[indexLine - 1] + 1;
            INTS[fEDI_getLineBoundaryPositions_end] = EDI_lineEndPositionList_data[indexLine];
            return;
        }
    }
    INTS[fEDI_getLineBoundaryPositions_start] = 0;
    INTS[fEDI_getLineBoundaryPositions_end] = 0;
}

function EDI_getLineStart_pos_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return 0;
        }
        else {
            return (EDI_lineEndPositionList_data[indexLine - 1] + 1);
        }
    }
    return 0;
}

function EDI_getLineEnd_pos_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList_count) {
        if (indexLine === 0) {
            return EDI_lineEndPositionList_data[indexLine] - 0;
        }
        else {
            return EDI_lineEndPositionList_data[indexLine];
        }
    }
    return 0;
}

function EDI_onMouseMove_WRAPIT(event) {
    if ((event.buttons & 1) && !get_EDI_recentBoundingClientRect_isNull_intFalsey()) {
        // TODO: Consider short circuiting at via event.clientX and clientY by tracking the necessary thresholds for the cursor position to pass rather than the previous and current indices. (you can possibly thereby skip the calculation of the indices entirely for the redundant events).
        // TODO: Is it correct to use the cursor's indexLine and indexColumn directly as a means of determining redundancy? I worry about odd interactions, but I have no proof that such an odd interaction could exist.

        let rX = event.clientX - INTS[fEDI_recentBoundingClientRect_left] - INTS[fEDI_gutterWidthTotal] + INTS[fEDI_lastReadNumber_scrollLeft];
        let rY = event.clientY - INTS[fEDI_recentBoundingClientRect_top] + INTS[fEDI_lastReadNumber_scrollTop];

        let indexColumn = Math.round(rX / EDI_characterWidth);
        let indexLine = Math.floor(rY / INTS[fEDI_lineHeight]);

        if (indexColumn < 0) {
            indexColumn = 0;
        }
        
        if (indexLine < 0) {
            indexLine = 0;
        }

        if (indexLine >= EDI_lineEndPositionList_count) {
            indexLine = EDI_lineEndPositionList_count - 1;
        }

        let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);
        if (indexColumn > lastValidIndexColumn) {
            indexColumn = lastValidIndexColumn;
        }

        if (INTS[fEDI_cursor_indexLine] === indexLine && INTS[fEDI_cursor_indexColumn] === indexColumn) {
            return;
        }
        
        INTS[fEDI_cursor_indexLine] = indexLine;
        INTS[fEDI_cursor_indexColumn] = indexColumn;
        INTS[fEDI_cursorVisualColumnIndex] = indexColumn;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLine;

        if (get_EDI_detailRank() === 3) {
            EDI_onMouseMoveDetailRankThree(indexLine, indexColumn);
        }
        else if (get_EDI_detailRank() === 2) {
            EDI_onMouseMoveDetailRankTwo(indexLine, indexColumn);
        }
        else if (get_EDI_detailRank() === 1) {
            EDI_onMouseMoveDetailRankOne(indexLine, indexColumn);
        }

        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
    else {
        BYTES[byteEDI_mousemove_eventListener_isActive] = 0;
        EDI_baseElement.removeEventListener('mousemove', EDI_onMouseMove_WRAPIT);
    }
}

function EDI_onMouseMoveDetailRankOne(indexLineClicked, indexColumnClicked) {
    // TODO: These two sets the ones to line and column seem redundant weren't these just done by the original EDI_onMouseMove_WRAPIT?
    INTS[fEDI_cursor_indexLine] = indexLineClicked;
    INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;

    INTS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();

    EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
}

function getCharacter_raw(positionIndex) {
    return String.fromCharCode(EDI_textByteList_bytes[positionIndex]);
}

function getCharacter_kind_raw(positionIndex) {
    return EDI_getCharacterKind(getCharacter_raw(positionIndex));
}

function getCharacter(positionIndex) {

    // in this getCharacter function, you'd actually already know the total shift if you just looped forwards.
    // Also this currently is EXTREMELY unoptimized given that it resets the totalShift each time it gets invoked rather than remembering the previous result.

    // maybe when hitting ArrowRight you'd want to finalize the edits?
    // because if you have multicursor with two cursors on the same line
    // you type some letters
    // then ctrl arrow right
    // how would this interact with the line end positions?
    //
    // I think if it were something like this, that it'd relate to whether the user moved they're cursor outisde the range of that cursor's pending "gap buffer" insertion text.
    //
    // additionally this function feels "random access", you need to consider a consecutive approach where you accumulate this state.
    // and that's what the plan was... but it doesn't quite feel like it would go here. Or that there'd be a second function in which you agree to using contextual information to determine the result much faster.

    // Cursors overlapping missed cases:
    // =================================
    // two cursors same line hit home
    // two cursors same line hit end

    // The problem with ctrl+backspace / ctrl+delete is 'getCharacter(positionIndex)'

    // this only gets 1 character why is it using the ..._decode_... functions.

    let totalShift = 0;
    // If you need to determine the text without finalizing an edit, you DO have to loop forwards right?
    switch (INTS[fEDI_cursor_editKind]) {
        case EditKind_InsertLtr:
            if (positionIndex >= INTS[fEDI_cursor_editPosition] && positionIndex < INTS[fEDI_cursor_editPosition] + INTS[fEDI_cursor_editLength]) {
                // TODO: I hear fromCharCode is faster than 'String.fromCodePoint(...)' thus I'm seeing if it is sufficient for my current personal usage...
                // ...long term it presumably fails for characters that I don't tend to type, but until then this is working so I'll just use fromCharCode.
                //
                // TODO: This takes a spread/array; if I give it a single byte does it allocate a length of 1 array every invocation?
                return String.fromCharCode(EDI_cursor_gapBuffer[positionIndex - INTS[fEDI_cursor_editPosition]]);
            }
            else if (INTS[fEDI_cursor_editPosition] <= positionIndex) {
                totalShift += INTS[fEDI_cursor_editLength];
            }
            break;
        case EditKind_DeleteLtr:
        case EditKind_BackspaceRtl:
        case EditKind_RemoveTextNoBatching:
            totalShift -= INTS[fEDI_cursor_editLength];
            break;
    }
    // TODO: I hear fromCharCode is faster than 'String.fromCodePoint(...)' thus I'm seeing if it is sufficient for my current personal usage...
    // ...long term it presumably fails for characters that I don't tend to type, but until then this is working so I'll just use fromCharCode.
    //
    // TODO: This takes a spread/array; if I give it a single byte does it allocate a length of 1 array every invocation?
    return String.fromCharCode(EDI_textByteList_bytes[positionIndex - totalShift]);
}

/**
 * 'positionIndex' is a calculated value that is commonly calculated.
 * It tends to be the case that you already are using a variable to store the positionIndex.
 * Thus providing that positionIndex is ideal.
 * 
 * @param {*} positionIndex 
 */
function EDI_getCharacterPrevious(indexColumn, positionIndex) {
    // TODO: Make a 'getCharacter(...) method so the gap buffer logic can be in one location.
    if (indexColumn !== 0) {
        return getCharacter(positionIndex - 1);
    }
    else {
        return '\0';
    }
}

/**
  * 'positionIndex' is a calculated value that is commonly calculated.
 * It tends to be the case that you already are using a variable to store the positionIndex.
 * Thus providing that positionIndex is ideal.
 * 
 * @param {*} indexColumn 
 * @param {*} positionIndex 
 * @param {*} line 
 */
function EDI_getCharacterCurrent(indexColumn, positionIndex, lineEnd) {
    if (indexColumn < lineEnd) {
        return getCharacter(positionIndex);
    }
    else {
        return '\0';
    }
}

function EDI_getCharacterPrevious_KIND(indexColumn, positionIndex) {
    if (indexColumn !== 0) {
        return EDI_getCharacterKind(EDI_getCharacterPrevious(indexColumn, positionIndex));
    }
    else {
        return CharacterKind_None;
    }
}

function EDI_getCharacterCurrent_KIND(indexColumn, positionIndex, lineEnd) {
    if (indexColumn < lineEnd) {
        return EDI_getCharacterKind(EDI_getCharacterCurrent(indexColumn, positionIndex, lineEnd));
    }
    else {
        return CharacterKind_None;
    }
}

function EDI_onMouseMoveDetailRankTwo(indexLineClicked, indexColumnClicked) {
    let nextPositionIndex = EDI_getPositionIndex_Overload(indexLineClicked, indexColumnClicked);

    if (nextPositionIndex <= INTS[fEDI_detail_smallPosition]) {
        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_detail_largePosition];
        }

        INTS[fEDI_cursor_indexLine] = indexLineClicked;
        INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
        INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
        let positionIndex = nextPositionIndex;

        INTS[fEDI_cursor_selectionEnd] = positionIndex;

        if (nextPositionIndex < INTS[fEDI_detail_smallPosition]) {
            let goalCharacterKind = EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], positionIndex, EDI_getLineEnd_pos(INTS[fEDI_cursor_indexLine]));

            let leftWasFound = false;

            let tempPositionIndex = positionIndex;

            while (INTS[fEDI_cursor_indexColumn] > 0) {
                let leftCharacterKind = EDI_getCharacterPrevious_KIND(INTS[fEDI_cursor_indexColumn], tempPositionIndex);
                if (leftCharacterKind !== goalCharacterKind) {
                    INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
                    leftWasFound = true;
                    break;
                }
                tempPositionIndex--;
                INTS[fEDI_cursor_indexColumn]--;
                INTS[fEDI_cursorVisualColumnIndex]--;
            }

            if (!leftWasFound) {
                INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
            }
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else {
        if (INTS[fEDI_cursor_selectionAnchor] > INTS[fEDI_cursor_selectionEnd]) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_detail_smallPosition];
        }

        if (nextPositionIndex >= INTS[fEDI_detail_largePosition]) {
            INTS[fEDI_cursor_indexLine] = indexLineClicked;
            INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
            INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
            let positionIndex = nextPositionIndex;

            INTS[fEDI_cursor_selectionEnd] = positionIndex;

            let leftCharacterKind = EDI_getCharacterPrevious_KIND(INTS[fEDI_cursor_indexColumn], positionIndex);
            let goalCharacterKind = leftCharacterKind;

            EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
            const line_end = INTS[fEDI_getLineBoundaryPositions_end];
            let lineLength = line_end - INTS[fEDI_getLineBoundaryPositions_start];
            let rightWasFound = false;

            let tempPositionIndex = positionIndex;
            while (INTS[fEDI_cursor_indexColumn] < lineLength) {
                let rightCharacterKind = EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], tempPositionIndex, line_end);
                if (rightCharacterKind !== goalCharacterKind) {
                    INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
                    rightWasFound = true;
                    break;
                }
                tempPositionIndex++;
                INTS[fEDI_cursor_indexColumn]++;
                INTS[fEDI_cursorVisualColumnIndex]++;
            }

            if (!rightWasFound) {
                // end of line
                INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
            }
        }
        else {
            EDI_getLineAndColumnIndices(INTS[fEDI_detail_largePosition]);
            let largeLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
            let largeLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
            INTS[fEDI_cursor_indexLine] = largeLineAndColumnIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = largeLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = largeLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = largeLineAndColumnIndices_indexLine;
            INTS[fEDI_cursor_selectionEnd] = INTS[fEDI_detail_largePosition];
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
}

function EDI_onMouseMoveDetailRankThree(indexLineClicked, indexColumnClicked) {
    // TODO: I remember this being bugged I think it makes sense why. You're checking if the cursor is exactly at the threshold rather than determining if the distance from previous event to this one puts you past the threshold.
    if (indexLineClicked === INTS[fEDI_detailRank3OriginLine]) {
        // TODO: 'cursor.positionIndex' is incorrect there is no such field, but was this referring to the clicked position or the position that the cursor currently is at...
        // ...it is presumed to be the position that the cursor is currently at because it would explain the bug where if you move the cursor somewhere that the mouse move events don't get
        // sent then bring your mouse back into a place where they do you'll snap ahead by some indices and skip the threshold and it visually bugs.
        // You could attach to I think it is window? but then I'm wondering if a race condition could ever occur.
        // so you'd probably want to do both attach to window and protect against large movements that skip the exact threshold when transitioning.
        //
        if (EDI_getPositionIndex_raw_cursor() !== INTS[fEDI_detail_smallPosition]) {
            EDI_getLineAndColumnIndices(INTS[fEDI_detail_smallPosition]);
            let smallLineAndColumnPositionIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
            let smallLineAndColumnPositionIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
            INTS[fEDI_cursor_indexLine] = smallLineAndColumnPositionIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = smallLineAndColumnPositionIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnPositionIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnPositionIndices_indexLine;
        }

        if (INTS[fEDI_cursor_selectionEnd] !== INTS[fEDI_detail_smallPosition]) {
            INTS[fEDI_cursor_selectionEnd] = INTS[fEDI_detail_smallPosition];
        }

        if (INTS[fEDI_cursor_selectionAnchor] !== INTS[fEDI_detail_largePosition]) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_detail_largePosition];
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else if (indexLineClicked < INTS[fEDI_detailRank3OriginLine]) {
        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
            EDI_getLineAndColumnIndices(INTS[fEDI_detail_smallPosition]);
            let smallLineAndColumnPositionIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
            let smallLineAndColumnPositionIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];

            INTS[fEDI_cursor_indexLine] = smallLineAndColumnPositionIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = smallLineAndColumnPositionIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnPositionIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnPositionIndices_indexLine;

            INTS[fEDI_cursor_selectionEnd] = INTS[fEDI_detail_smallPosition];

            EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
        }

        INTS[fEDI_cursor_indexLine] = indexLineClicked;
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;

        INTS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_Overload(indexLineClicked, 0);

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else if (indexLineClicked > INTS[fEDI_detailRank3OriginLine]) {

        if (INTS[fEDI_cursor_selectionAnchor] !== INTS[fEDI_detail_smallPosition]) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_detail_smallPosition];
        }

        INTS[fEDI_cursor_indexLine] = indexLineClicked;
        INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
        INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
        let positionIndex = EDI_getPositionIndex_Overload(indexLineClicked, indexColumnClicked);

        // move to end of line...
        EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
        let lineLength = INTS[fEDI_getLineBoundaryPositions_end] - INTS[fEDI_getLineBoundaryPositions_start];
        positionIndex += lineLength - INTS[fEDI_cursor_indexColumn];

        if (INTS[fEDI_cursor_indexLine] === EDI_lineEndPositionList_count - 1) {
            INTS[fEDI_cursor_indexColumn] = lineLength;
            INTS[fEDI_cursorVisualColumnIndex] = lineLength;
            INTS[fEDI_cursor_selectionEnd] = positionIndex;
        }
        else {
            // wrap to the next line
            INTS[fEDI_cursor_indexLine]++;
            INTS[fEDI_cursor_indexColumn] = 0;
            INTS[fEDI_cursorVisualColumnIndex] = 0;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;
            positionIndex++;

            INTS[fEDI_cursor_selectionEnd] = positionIndex;
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
}

/**
 * @returns 
 */
function EDI_getPositionIndex_cursor() {
    return EDI_getLineStart_pos(INTS[fEDI_cursor_indexLine]) + INTS[fEDI_cursor_indexColumn];
}

function EDI_getPositionIndex_Overload(indexLine, indexColumn) {
    return EDI_getLineStart_pos(indexLine) + indexColumn;
}

/**
 * @returns 
 */
function EDI_getPositionIndex_raw_cursor() {
    return EDI_getLineStart_pos_raw(INTS[fEDI_cursor_indexLine]) + INTS[fEDI_cursor_indexColumn];
}

function EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked, indexColumnVisual) {

    let selectionPlusContextMenuCase = event_button === 2 && EDI_cursor_hasSelection();

    if (event_shiftKey && !selectionPlusContextMenuCase) {
        if (!EDI_cursor_hasSelection()) {
            INTS[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_cursor();
        }
    }

    if (!selectionPlusContextMenuCase) {
        INTS[fEDI_cursor_indexLine] = indexLineClicked;
        INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
        INTS[fEDI_cursorVisualColumnIndex] = indexColumnVisual;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
        INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    
        INTS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();

        if (!event_shiftKey) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
        }
    }

    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_onMouseDownDetailRankTwo(event_button, event_shiftKey, indexLineClicked, indexColumnClicked) {
    if (event_shiftKey) {
        EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked);
        return;
    }

    INTS[fEDI_cursor_indexLine] = indexLineClicked;
    INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
    let positionIndex = EDI_getPositionIndex_cursor();
    
    EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
    const line_start = INTS[fEDI_getLineBoundaryPositions_start];
    const line_end = INTS[fEDI_getLineBoundaryPositions_end];

    let leftCharacterKind = EDI_getCharacterPrevious_KIND(INTS[fEDI_cursor_indexColumn], positionIndex);
    let rightCharacterKind = EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], positionIndex, line_end);

    if (leftCharacterKind === rightCharacterKind) {
        let goalCharacterKind = rightCharacterKind;

        let tempIndexColumn = INTS[fEDI_cursor_indexColumn];
        let tempPositionIndex = EDI_getPositionIndex_Overload(INTS[fEDI_cursor_indexLine], tempIndexColumn);
        while (tempIndexColumn > 0) {
            tempIndexColumn--;
            tempPositionIndex--;
            leftCharacterKind = EDI_getCharacterPrevious_KIND(tempIndexColumn, tempPositionIndex);
            if (leftCharacterKind !== goalCharacterKind) {
                INTS[fEDI_cursor_selectionAnchor] = tempPositionIndex;
                break;
            }
        }

        let lineLength = line_end - line_start;
        let rightWasFound = false;
        tempIndexColumn = INTS[fEDI_cursor_indexColumn];
        tempPositionIndex = EDI_getPositionIndex_Overload(INTS[fEDI_cursor_indexLine], tempIndexColumn);
        while (tempIndexColumn < lineLength) {
            tempIndexColumn++;
            tempPositionIndex++;
            rightCharacterKind = EDI_getCharacterCurrent_KIND(tempIndexColumn, tempPositionIndex, line_end);
            if (rightCharacterKind !== goalCharacterKind) {
                INTS[fEDI_cursor_indexColumn] = tempIndexColumn;
                INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
                INTS[fEDI_cursorVisualColumnIndex] = tempIndexColumn;
                rightWasFound = true;
                break;
            }
        }

        if (!rightWasFound) {
            // end of line
            INTS[fEDI_cursor_indexColumn] = tempIndexColumn;
            INTS[fEDI_cursor_selectionEnd] = tempPositionIndex;
            INTS[fEDI_cursorVisualColumnIndex] = tempIndexColumn;
        }

        EDI_render_request(RenderKind_Cursor_n);
    }
    else if (leftCharacterKind > rightCharacterKind) {
        let goalCharacterKind = leftCharacterKind;

        let tempIndexColumn = INTS[fEDI_cursor_indexColumn];
        let originalPositionIndex = EDI_getPositionIndex_Overload(INTS[fEDI_cursor_indexLine], tempIndexColumn);
        let tempPositionIndex = originalPositionIndex;

        while (INTS[fEDI_cursor_indexColumn] > 0) {
            tempIndexColumn--;
            tempPositionIndex--;
            leftCharacterKind = EDI_getCharacterPrevious_KIND(tempIndexColumn, tempPositionIndex);
            if (leftCharacterKind !== goalCharacterKind) {
                INTS[fEDI_cursor_selectionAnchor] = tempPositionIndex;
                break;
            }
        }

        INTS[fEDI_cursor_selectionEnd] = originalPositionIndex;

        EDI_render_request(RenderKind_Cursor_n);
    }
    else {
        let goalCharacterKind = rightCharacterKind;

        let positionIndex = EDI_getPositionIndex_Overload(INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
        INTS[fEDI_cursor_selectionAnchor] = positionIndex;

        let lineLength = line_end - line_start;
        let rightWasFound = false;

        while (INTS[fEDI_cursor_indexColumn] < lineLength) {
            INTS[fEDI_cursor_indexColumn]++;
            INTS[fEDI_cursorVisualColumnIndex]++;
            positionIndex++;
            rightCharacterKind = EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], positionIndex, line_end);
            if (rightCharacterKind !== goalCharacterKind) {
                INTS[fEDI_cursor_selectionEnd] = positionIndex;
                rightWasFound = true;
                break;
            }
        }

        if (!rightWasFound) {
            // end of line
            INTS[fEDI_cursor_selectionEnd] = positionIndex;
        }

        EDI_render_request(RenderKind_Cursor_n);
    }

    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        INTS[fEDI_detail_smallPosition] = INTS[fEDI_cursor_selectionAnchor];
        INTS[fEDI_detail_largePosition] = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        INTS[fEDI_detail_smallPosition] = INTS[fEDI_cursor_selectionEnd];
        INTS[fEDI_detail_largePosition] = INTS[fEDI_cursor_selectionAnchor];
    }
}

function EDI_onMouseDownDetailRankThree(event_button, event_shiftKey, indexLineClicked, indexColumnClicked) {
    if (event_shiftKey) {
        EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked);
        return;
    }

    INTS[fEDI_cursor_indexLine] = indexLineClicked;
    INTS[fEDI_cursor_indexColumn] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex] = indexColumnClicked;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = indexLineClicked;
    
    INTS[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_Overload(INTS[fEDI_cursor_indexLine], 0);
    
    INTS[fEDI_detailRank3OriginLine] = INTS[fEDI_cursor_indexLine];

    if (INTS[fEDI_cursor_indexLine] === EDI_lineEndPositionList_count - 1) {
        EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
        INTS[fEDI_cursor_selectionEnd] = INTS[fEDI_getLineBoundaryPositions_end];
        EDI_render_request(RenderKind_Cursor_n);
    }
    else {
        INTS[fEDI_cursor_indexLine]++;
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;
        EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
        INTS[fEDI_cursor_selectionEnd] = INTS[fEDI_getLineBoundaryPositions_start];
        EDI_render_request(RenderKind_Cursor_n);
    }

    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        INTS[fEDI_detail_smallPosition] = INTS[fEDI_cursor_selectionAnchor];
        INTS[fEDI_detail_largePosition] = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        INTS[fEDI_detail_smallPosition] = INTS[fEDI_cursor_selectionEnd];
        INTS[fEDI_detail_largePosition] = INTS[fEDI_cursor_selectionAnchor];
    }
}

/**
 * @returns 
 */
function EDI_insertGapBufferSpan() {
    walkLineUntilIndexColumn();
    if (!w_span || !w_div) {
        EDI_cursor_gapBufferWriteToSpanElement = null;
        INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
        return;
    }

    if (INTS[fEDI_w_indexColumn_Goal] == 0) {
        // TODO: Ensure 'w_div.children[0]' is equal to the 'w_span' and then change this line to use 'w_span'
        EDI_cursor_gapBufferWriteToSpanElement = w_span;
        INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
    }
    else {
        EDI_cursor_gapBufferWriteToSpanElement = w_div.children[INTS[fEDI_w_indexSpan]];

        if (INTS[fEDI_w_indexColumn_Goal] === INTS[fEDI_w_indexColumn_Sum] + EDI_cursor_gapBufferWriteToSpanElement.textContent.length) {
            INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = EDI_cursor_gapBufferWriteToSpanElement.textContent.length;
        }
        else {
            INTS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = INTS[fEDI_w_indexColumn_SpanTextContentRelative];
        }
    }
}

/**
 * @param {*} editKind 
 * @param {*} editPosition 
 * @param {*} editLength 
 */
function EDI_startEdit(editKind, editPosition, editLength) {
    INTS[fEDI_cursor_editKind] = editKind;
    INTS[fEDI_cursor_editPosition] = editPosition;
    INTS[fEDI_cursor_editIndexLine] = INTS[fEDI_cursor_indexLine];
    INTS[fEDI_cursor_editIndexColumn] = INTS[fEDI_cursor_indexColumn];
    INTS[fEDI_cursor_editLength] = editLength;

    switch (editKind) {
        case EditKind_InsertLtr:
            EDI_insertGapBufferSpan();
            break;
    }
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_insert() {
    return INTS[fEDI_cursor_editKind] != EditKind_InsertLtr ||
           INTS[fEDI_cursor_indexLine] !== INTS[fEDI_cursor_editIndexLine] ||
           INTS[fEDI_cursor_indexColumn] !== INTS[fEDI_cursor_editIndexColumn] + INTS[fEDI_cursor_editLength] ||
           INTS[fEDI_cursor_editLength] >= CONST_EDI_cursor_GAP_BUFFER_CAPACITY ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_enter() {
    return true || // turn off batching until it works. The initial enter event is what matters everything else can be recreated based on the amount of lineFeeds that were inserted.
           INTS[fEDI_cursor_editKind] != EditKind_Enter ||
           INTS[fEDI_cursor_indexLine] !== INTS[fEDI_cursor_END_editIndexLine] ||
           INTS[fEDI_cursor_indexColumn] !== INTS[fEDI_cursor_END_editIndexColumn] ||
           INTS[fEDI_cursor_editLength] >= CONST_EDI_cursor_GAP_BUFFER_CAPACITY ||
           !EDI_cursor_enterKey_newLinePlusIndentation_byteList ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_backspace() {
    return INTS[fEDI_cursor_editKind] != EditKind_BackspaceRtl ||
           INTS[fEDI_cursor_indexLine] !== INTS[fEDI_cursor_editIndexLine] ||
           INTS[fEDI_cursor_indexColumn] !== INTS[fEDI_cursor_editIndexColumn] ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_delete() {
    return INTS[fEDI_cursor_editKind] != EditKind_DeleteLtr ||
           INTS[fEDI_cursor_indexLine] !== INTS[fEDI_cursor_editIndexLine] ||
           INTS[fEDI_cursor_indexColumn] !== INTS[fEDI_cursor_editIndexColumn] ||
           EDI_cursor_hasSelection();
}

/**
 * @param {*} shiftKey 
 */
function EDI_preKeyboardMovementSelectionLogic(shiftKey) {
    if (shiftKey) {
        if (!EDI_cursor_hasSelection()) {
            INTS[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_cursor();
            INTS[fEDI_cursor_selectionIndexAnchorLine] = INTS[fEDI_cursor_indexLine];
            INTS[fEDI_cursor_selectionIndexAnchorColumn] = INTS[fEDI_cursor_indexColumn];
        }
    }
    else {
        if (EDI_cursor_hasSelection()) {
            INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
            INTS[fEDI_cursor_selectionIndexAnchorLine] = INTS[fEDI_cursor_selectionIndexEndLine];
            INTS[fEDI_cursor_selectionIndexAnchorColumn] = INTS[fEDI_cursor_selectionIndexEndColumn];
        }
    }
}

/**
 * @param {*} shiftKey 
 */
function EDI_postKeyboardMovementSelectionLogic(shiftKey) {
    if (shiftKey) {
        INTS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();
        INTS[fEDI_cursor_selectionIndexEndLine] = INTS[fEDI_cursor_indexLine];
        INTS[fEDI_cursor_selectionIndexEndColumn] = INTS[fEDI_cursor_indexColumn];
    }
}

/**
 * @param {*} shiftKey 
 */
function EDI_arrowDown(shiftKey) {
    EDI_movementBasedCacheInvalidation();
    EDI_preKeyboardMovementSelectionLogic(shiftKey);
    if (INTS[fEDI_cursor_indexLine] < EDI_lineEndPositionList_count - 1) {
        INTS[fEDI_cursor_indexLine]++;
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
        if (INTS[fEDI_cursor_STORED_indexColumn] > lastValidIndexColumn) {
            INTS[fEDI_cursor_indexColumn] = lastValidIndexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = lastValidIndexColumn;
        }
        else {
            INTS[fEDI_cursor_indexColumn] = INTS[fEDI_cursor_STORED_indexColumn];
            INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_STORED_indexColumn];
        }
    }
    EDI_postKeyboardMovementSelectionLogic(shiftKey);
}

/**
 * This function is expected to be used for a variety of scenarios,
 * but the initial use-case is caching the indentation when holding the 'enter' key, so that each consecutive event can know what the indentation was on the previous
 * event and not have to re-calculate it.
 * 
 * Then, the idea is that when the cursor moves you invoke this to invalidate that indentation cache so it gets recalculated.
 * 
 * TODO: I am quite certain that there are cases where this should be invoked but it isn't currently.
 * 
 * TODO: I believe this function to be an unoptimized solution, just that there are more pressing matters to attend to.
 */
function EDI_movementBasedCacheInvalidation() {
    if (INTS[fEDI_cursor_editKind] === EditKind_Enter) {
        //
        // this only happens once even if you have many cursors because the next cursor that enters this function would be and editKind of None.
        //
        // The main concern is when a user holds down the Enter key, so while this change causes any cursor movement to finalize a pending Enter edit, it won't be nearly as detrimental as if holding down the Enter key were to not be optimized.
        //
        // TODO: Permit more than one Enter key edit event to batch
        // TODO: Cap the amount of enter key edit events that can batch as was done with the insertion.
        // TODO: Having Enter be an insertion, instead of its own EditKind, sounds like the better long term goal but it is believed that this change is trainsitionally helpful in getting to that final best solution.
        //
        EDI_finalizeEdit();
    }
    EDI_cursor_enterKey_newLinePlusIndentation_byteList = null;
    EDI_cursor_cached_indentation_string = null;
    set_EDI_findOverlay_isBeingShownDueToMultiCursorMatching(false);
}

/**
 * @param {*} clipboardContent This is a temporary hack to help in transitioning paste to an edit.
 */
function EDI_editEvent(editKind, event, clipboardContent) {
    // check for pending => selection
    // if so then finalize all current pending
    // ...this actually is checking for selection, then presuming at least 1 cursor has a pending...
    let shouldFinalizeAllCursors = false;
    let atLeastOneCursorHasASelection = false;
    if (EDI_cursor_hasSelection()) {
        shouldFinalizeAllCursors = true;
        atLeastOneCursorHasASelection = true;
    }
    if (shouldFinalizeAllCursors) {

        shouldFinalizeAllCursors = false;
        
        if ((editKind === EditKind_Tab && INTS[fEDI_cursor_editKind] === EditKind_IndentMore) ||
            (editKind === EditKind_Tab && INTS[fEDI_cursor_editKind] === EditKind_IndentLess && event.shiftKey)) {

                // TODO: IndentLess when no selection however shiftTab then it does indentLess even still but I haven't gone out of the way to handle that hack...
                // ...maybe it'll be covered maybe it won't.

                // TODO: Rewrite this if statement (it is a hack for the moment while I get indent more of a single cursor to batch)
        }
        else {
            EDI_finalizeEdit();
        }
    }

    // If you have delete/backspace you need to ONLY remove the selection if it exists not remove selection then delete/backspace
    // but insert needs to remove selection AND insert.
    if (editKind === EditKind_InsertLtr || editKind === EditKind_Enter || editKind === EditKind_Paste) {
        // check for EditKind_None => selection
        // if so then attempt to remove selection foreach cursor
        // then finalize all those newly made selection removal edits
        if (atLeastOneCursorHasASelection) {
            shouldFinalizeAllCursors = true;
            if (EDI_cursor_hasSelection()) {
                EDI_removeSelection();
            }
        }
        if (shouldFinalizeAllCursors) {
            shouldFinalizeAllCursors = false;
            EDI_finalizeEdit();
        }
    }

    // check for NOTcanBatch... I don't want the switch in the for loop... if you have a selection then you have a not can batch?
    switch (editKind) {
        case EditKind_InsertLtr:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_InsertLtr();
            break;
        case EditKind_DeleteLtr:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_DeleteLtr();
            break;
        case EditKind_BackspaceRtl:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_BackspaceRtl();
            break;
        case EditKind_Tab:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_Tab(event);
            break;
        case EditKind_IndentMore:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_IndentMore();
            break;
        case EditKind_IndentLess:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_IndentLess();
            break;
        case EditKind_Enter:
            shouldFinalizeAllCursors = EDI_editEvent_checkFor_NOTcanBatch_Enter(event);
            break;
        case EditKind_Paste:
            shouldFinalizeAllCursors = true;
            break;
        case EditKind_Duplicate:
            shouldFinalizeAllCursors = true;
            break;
        default:
            throw new Error(`The EditKind:${editKind} was not recognized.`);
    }
    if (shouldFinalizeAllCursors) {
        shouldFinalizeAllCursors = false;
        EDI_finalizeEdit();
    }

    // start/continue edit... I don't want the switch in the for loop
    switch (editKind) {
        case EditKind_InsertLtr:
            EDI_editEvent_theEditIself_InsertLtr(event);
            break;
        case EditKind_DeleteLtr:
            EDI_editEvent_theEditIself_DeleteLtr(event);
            break;
        case EditKind_BackspaceRtl:
            EDI_editEvent_theEditIself_BackspaceRtl(event);
            break;
        case EditKind_Tab:
            EDI_editEvent_theEditIself_Tab(event);
            break;
        case EditKind_Enter:
            EDI_editEvent_theEditIself_Enter(event);
            break;
        case EditKind_Paste:
            EDI_editEvent_theEditIself_Paste(clipboardContent);
            break;
        case EditKind_Duplicate:
            EDI_editEvent_theEditIself_Duplicate();
            break;
        default:
            throw new Error(`The EditKind:${editKind} was not recognized.`);
    }

    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
}

function EDI_editEvent_theEditIself_InsertLtr(event) {
    EDI_movementBasedCacheInvalidation();
    // You can do this because the function 'EDI_NOTcanBatch_insert' was already checked for all the cursors, if it is possible to batch, the editKind will stay InsertLtr otherwise it is finalized and set to None.
    // TODO: Use if === EditKind_None for copy and paste safety / it might just even be more readable
    if (INTS[fEDI_cursor_editKind] !== EditKind_InsertLtr) {
        EDI_startEdit(EditKind_InsertLtr, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_insertDo(event.key);
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    EDI_render_request(RenderKind_InsertLtr);
}

function EDI_editEvent_theEditIself_DeleteLtr(event) {
    EDI_movementBasedCacheInvalidation();
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
    }
    else {
        if (INTS[fEDI_cursor_editKind] !== EditKind_DeleteLtr) {
            EDI_startEdit(EditKind_DeleteLtr, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
        }
        EDI_deleteDo(event);
    }
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_BackspaceRtl(event) {
    EDI_movementBasedCacheInvalidation();
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
    }
    else {
        if (INTS[fEDI_cursor_editKind] !== EditKind_BackspaceRtl) {
            EDI_startEdit(EditKind_BackspaceRtl, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
        }
        EDI_backspaceDo(event);
        INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    }
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Tab(event) {
    EDI_movementBasedCacheInvalidation();
    if (EDI_cursor_hasSelection()) {
        if (event.shiftKey) {
            if (INTS[fEDI_cursor_editKind] !== EditKind_IndentLess) {
                EDI_startEdit(EditKind_IndentLess, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_indentLess();
        }
        else {
            if (INTS[fEDI_cursor_editKind] !== EditKind_IndentMore) {
                EDI_startEdit(EditKind_IndentMore, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_indentMore();
        }
    }
    else {
        if (event.shiftKey) {
            // TODO: This code has a bug and doesn't work with multicursor... EDI_onMouseDownDetailRankThree needs to accept a cursor rather than acting on EDI_primaryCursor...
            // ...multi-cursor in and of itself is buggy that's why I'm not overly concerned with adding this in a bugged state...
            // ...everything is buggy and it is very anxiety inducing and for the time being I guess it just has to be that way as I transition
            // towards a useable editor all the features are coming together but there's this awkward phase of "I can start using it but also not really" or something I just idk.
            EDI_onMouseDownDetailRankThree(0, false, INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
            if (INTS[fEDI_cursor_editKind] !== EditKind_IndentLess) {
                EDI_startEdit(EditKind_IndentLess, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_indentLess();
        }
        else {
            if (INTS[fEDI_cursor_editKind] !== EditKind_Tab) {
                EDI_startEdit(EditKind_Tab, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_tabKey();
        }
    }
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Enter(event) {
    if (INTS[fEDI_cursor_editKind] !== EditKind_Enter) {
        EDI_startEdit(EditKind_Enter, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_EnterKey(event.ctrlKey, event.shiftKey);
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Paste(clipboardContent) {
    if (INTS[fEDI_cursor_editKind] !== EditKind_Enter) {
        EDI_startEdit(EditKind_Paste, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_paste(clipboardContent);
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Duplicate() {
    if (INTS[fEDI_cursor_editKind] !== EditKind_Duplicate) {
        EDI_startEdit(EditKind_Duplicate, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_duplicateSelection();
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
}

/** @returns {boolean} 'shouldFinalizeAllCursors' */
function EDI_editEvent_checkFor_NOTcanBatch_InsertLtr() {
    if (EDI_NOTcanBatch_insert()) {
        return true;
    }
    return false;
}

/** @returns {boolean} 'shouldFinalizeAllCursors' */
function EDI_editEvent_checkFor_NOTcanBatch_DeleteLtr() {
    if (EDI_NOTcanBatch_delete()) {
        return true;
    }
    return false;
}

/** @returns {boolean} 'shouldFinalizeAllCursors' */
function EDI_editEvent_checkFor_NOTcanBatch_BackspaceRtl() {
    if (EDI_NOTcanBatch_backspace()) {
        return true;
    }
    return false;
}

/** @returns {boolean} 'shouldFinalizeAllCursors' */
function EDI_editEvent_checkFor_NOTcanBatch_Tab(event) {
    if (EDI_cursor_hasSelection() && !event.shiftKey) {
        return EDI_editEvent_checkFor_NOTcanBatch_IndentMore();
    }
    else if (EDI_cursor_hasSelection() && event.shiftKey) {
        // TODO: write 'if (EDI_cursor_hasSelection())' then nest these in the same wrapping if statement.
        return EDI_editEvent_checkFor_NOTcanBatch_IndentLess();
    }
    else if (!EDI_cursor_hasSelection()) {
        if (event.shiftKey) {
            return EDI_editEvent_checkFor_NOTcanBatch_IndentLess();
        }
        else {
            if (INTS[fEDI_cursor_editIndexLine] === INTS[fEDI_cursor_indexLine] &&
                INTS[fEDI_cursor_editIndexColumn] + (EDI_on_tab_bytes.length * INTS[fEDI_cursor_editLength]) === INTS[fEDI_cursor_indexColumn]) {
                    return false;
            }
        }
    }

    return true;
}

/**
 * @returns {boolean} 'shouldFinalizeAllCursors'
 * 
 * TODO: This function never is "naturally" invoked because all tab keypresses start with a 'Tab' edit event and only convert to indentMore downstream
 * 
 */
function EDI_editEvent_checkFor_NOTcanBatch_IndentMore() {
    // TODO: Should this be: 'INTS[fEDI_cursor_editKind] !== EditKind_IndentMore'?
    if (INTS[fEDI_cursor_editKind] === EditKind_IndentLess) {
        return true;
    }
    
    let SMALL_pos;
    let LARGE_pos;
    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = INTS[fEDI_cursor_selectionAnchor];
        LARGE_pos = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = INTS[fEDI_cursor_selectionEnd];
        LARGE_pos = INTS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    EDI_getLineAndColumnIndices(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    // start at the LARGE position
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    EDI_getLineBoundaryPositions(startingIndex);
    let startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start];
    if (startingLinePos_start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) { // TODO: This if statement is NOT used in this specific case. It was copy and pasted from somewhere that it IS used, i.e.: TODO: remove it from this function?
            EDI_getLineBoundaryPositions(startingIndex);
            startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start]
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return true;
    }

    if (INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] === SMALL_lineAndColumnIndices_indexLine &&
        INTS[fEDI_indent_startingIndex] === startingIndex) {
            return false;
    }

    return true;
}

/**
 * @returns {boolean} 'shouldFinalizeAllCursors'
 * 
 * TODO: This function never is "naturally" invoked because all tab keypresses start with a 'Tab' edit event and only convert to indentLess downstream
 * 
 */
function EDI_editEvent_checkFor_NOTcanBatch_IndentLess() {
    // TODO: Should this be: 'INTS[fEDI_cursor_editKind] !== EditKind_IndentLess'?
    if (INTS[fEDI_cursor_editKind] === EditKind_IndentMore) {
        return true;
    }
    
    let SMALL_pos;
    let LARGE_pos;
    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = INTS[fEDI_cursor_selectionAnchor];
        LARGE_pos = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = INTS[fEDI_cursor_selectionEnd];
        LARGE_pos = INTS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices_raw(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    EDI_getLineAndColumnIndices_raw(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    // start at the LARGE position
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    EDI_getLineBoundaryPositions_raw(startingIndex);
    let startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start];
    if (startingLinePos_start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) { // TODO: This if statement is NOT used in this specific case. It was copy and pasted from somewhere that it IS used, i.e.: TODO: remove it from this function?
            EDI_getLineBoundaryPositions_raw(startingIndex);
            startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start];
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    if (INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] === SMALL_lineAndColumnIndices_indexLine &&
        INTS[fEDI_indent_startingIndex] === startingIndex) {
            return false;
    }

    return true;
}

/** @returns {boolean} 'shouldFinalizeAllCursors' */
function EDI_editEvent_checkFor_NOTcanBatch_Enter(event) {
    if (event.shiftKey || event.ctrlKey) {
        return true;
    }
    else {
        if (EDI_NOTcanBatch_enter()) {
            return true;
        }
    }
    return false;
}

/**
 * Any code that wants to stop then start the cursor blinking again needs to:
 * - enqueue rAF for drawing the cursor
 * - *optional* check if statement for 'BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]' to avoid redundant invocations of 'EDI_cursorBlink_startChecking'
 * - invoke 'EDI_cursorBlink_startChecking'
 * - downstream trigger the rAF for drawing the cursor wherein 'INTS[fEDI_EDI_cursorBlinkLastTimestamp]' gets set to the rAF timestamp.
 *     - or, modify some other part of the rAF pipeline (only if necessary) / etc...
 * 
 * NOTE: the draw cursor rAF needs to be enqueued prior to the 'EDI_cursorBlink_startChecking' invocation.
 */
function EDI_cursorBlink_trailingEdge(timestamp) {
    const time = timestamp - INTS[fEDI_EDI_cursorBlinkLastTimestamp];
    if (time >= 500) {
        BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge] = 0;
        // TODO: This is a timing issue of the rAF vs you losing focus on the editor.
        EDI_cursor_cursorElement.classList.add('EDI_cursor_focus');
        INTS[fEDI_EDI_cursorBlinkLastTimestamp] = 0;
    }
    else {
        requestAnimationFrame(EDI_cursorBlink_trailingEdge);
    }
}

function EDI_cursorBlink_startChecking() {
    BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge] = 1;
    EDI_cursor_cursorElement.classList.remove('EDI_cursor_focus');
    requestAnimationFrame(EDI_cursorBlink_trailingEdge);
}

/**
 * < The browser's event listener engine ignores the return value of event handlers.
 * < If you return a Promise, the browser treats it exactly like returning undefined, true, or a string. It drops the return value on the floor.
 * 
 * TODO: timing issue of async paste and copy
 */
function EDI_onKeyDown(event) {
    switch (event.key) {
        case 'ArrowLeft':
            EDI_onKeyDown_ArrowLeft(event);
            break;
        case 'ArrowDown':
            if (EDI_onKeyDown_ArrowDown(event)) {
                return; // 'EDI_onKeyDown_ArrowDown' returns {boolean} whether invoking function ought to return
            }
            break;
        case 'ArrowUp':
            if (EDI_onKeyDown_ArrowUp(event)) {
                return; // 'EDI_onKeyDown_ArrowUp' returns {boolean} whether invoking function ought to return
            }
            break;
        case 'ArrowRight':
            EDI_onKeyDown_ArrowRight(event);
            break;
        case 'Home':
            if (EDI_onKeyDown_Home(event)) {
                return; // 'EDI_onKeyDown_Home' returns {boolean} whether invoking function ought to return
            }
            break;
        case 'End':
            if (EDI_onKeyDown_End(event)) {
                return; // 'EDI_onKeyDown_End' returns {boolean} whether invoking function ought to return
            }
            break;
        case 'PageDown':
            EDI_onKeyDown_PageDown(event);
            break;
        case 'PageUp':
            EDI_onKeyDown_PageUp(event);
            break;
        case 'Delete':
            EDI_editEvent(EditKind_DeleteLtr, event);
            break;
        case 'Backspace':
            EDI_editEvent(EditKind_BackspaceRtl, event);
            break;
        case 'Escape':
            EDI_finalizeEdit();
            break;
        case 'Tab':
            event.preventDefault();
            EDI_editEvent(EditKind_Tab, event);
            break;
        case 'Enter':
            // Enter key relies on cached data that would be cleared, pattern doesn't match on purpose
            EDI_editEvent(EditKind_Enter, event);
            break;
        case 'F12':
            EDI_doEditorGoToDefinitionRequest();
            break;
        default:
            // TODO: Checking for a length of 1 is probably wrong but it'll let me start writing some code
            if (event.key.length === 1) {
                if (event.ctrlKey) {
                    return EDI_onKeyDown_keyLengthEqualsOne_ctrlKey(event);
                }
                else if (event.altKey) {
                    EDI_onKeyDown_keyLengthEqualsOne_altKey(event);
                }
                else {
                    event.preventDefault();
                    EDI_editEvent(EditKind_InsertLtr, event);
                }
            }
            break;
    }
}

function EDI_onKeyDown_ArrowLeft(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();

    if (EDI_cursor_hasSelection() && !event.shiftKey) {
        let small;
        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
            small = INTS[fEDI_cursor_selectionAnchor];
        }
        else {
            small = INTS[fEDI_cursor_selectionEnd];
        }
        EDI_getLineAndColumnIndices(small); // TODO: Check all of these whether they can be inlined (remove the single stage middle-man variable)
        let lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        let lineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
        INTS[fEDI_cursor_indexLine] = lineAndColumnIndices_indexLine;
        INTS[fEDI_cursor_indexColumn] = lineAndColumnIndices_indexColumn;
        INTS[fEDI_cursorVisualColumnIndex] = lineAndColumnIndices_indexColumn;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = lineAndColumnIndices_indexLine;
        INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
        INTS[fEDI_cursor_selectionIndexAnchorLine] = INTS[fEDI_cursor_selectionIndexEndLine];
        INTS[fEDI_cursor_selectionIndexAnchorColumn] = INTS[fEDI_cursor_selectionIndexEndColumn];
    }
    else {
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        if (event.ctrlKey && INTS[fEDI_cursor_indexColumn] > 0) {
            EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
            let indexPosition = INTS[fEDI_getLineBoundaryPositions_start] + INTS[fEDI_cursor_indexColumn];
            let originalCharacterKind = EDI_getCharacterPrevious_KIND(INTS[fEDI_cursor_indexColumn], indexPosition);
            INTS[fEDI_cursor_indexColumn]--;
            if (originalCharacterKind === CharacterKind_Whitespace && getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                INTS[fEDI_cursorVisualColumnIndex] -= (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
            }
            else {
                INTS[fEDI_cursorVisualColumnIndex]--;
            }
            indexPosition--;

            while (INTS[fEDI_cursor_indexColumn] > 0) {
                if (EDI_getCharacterPrevious_KIND(INTS[fEDI_cursor_indexColumn], indexPosition) === originalCharacterKind) {
                    INTS[fEDI_cursor_indexColumn]--;
                    if (originalCharacterKind === CharacterKind_Whitespace && getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                        INTS[fEDI_cursorVisualColumnIndex] -= (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
                    }
                    else {
                        INTS[fEDI_cursorVisualColumnIndex]--;
                    }
                    indexPosition--;
                }
                else {
                    break;
                }
            }
        }
        else {
            if (INTS[fEDI_cursor_indexColumn] > 0) {
                INTS[fEDI_cursor_indexColumn]--;
                if (getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                    INTS[fEDI_cursorVisualColumnIndex] -= (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
                }
                else {
                    INTS[fEDI_cursorVisualColumnIndex]--;
                }
            }
            else if (INTS[fEDI_cursor_indexLine] > 0) {
                INTS[fEDI_cursor_indexLine]--;
                INTS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
                INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_indexColumn];
                INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]--;
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    }
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_ArrowDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey) {
        // TODO: raf or something this scrollBy?
        EDI_baseElement.scrollBy(0, INTS[fEDI_lineHeight]);
    }
    else {
        EDI_arrowDown(/*shiftKey*/ event.shiftKey);
        EDI_render_request(RenderKind_Cursor_n);
        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
    return false;
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_ArrowUp(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey) {
        // TODO: raf or something this scrollBy?
        EDI_baseElement.scrollBy(0, -1 * INTS[fEDI_lineHeight]);
    }
    else {
        EDI_movementBasedCacheInvalidation();
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        if (INTS[fEDI_cursor_indexLine] > 0) {
            INTS[fEDI_cursor_indexLine]--;
            let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
            if (INTS[fEDI_cursor_STORED_indexColumn] > lastValidIndexColumn) {
                INTS[fEDI_cursor_indexColumn] = lastValidIndexColumn;
                INTS[fEDI_cursorVisualColumnIndex] = lastValidIndexColumn;
            }
            else {
                INTS[fEDI_cursor_indexColumn] = INTS[fEDI_cursor_STORED_indexColumn];
                INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_STORED_indexColumn];
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
        EDI_render_request(RenderKind_Cursor_n);
        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
    return false;
}

function EDI_onKeyDown_ArrowRight(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();

    if (EDI_cursor_hasSelection() && !event.shiftKey) {
        let large;
        if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
            large = INTS[fEDI_cursor_selectionEnd];
        }
        else {
            large = INTS[fEDI_cursor_selectionAnchor];
        }
        EDI_getLineAndColumnIndices(large);
        let lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
        let lineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
        INTS[fEDI_cursor_indexLine] = lineAndColumnIndices_indexLine;
        INTS[fEDI_cursor_indexColumn] = lineAndColumnIndices_indexColumn;
        INTS[fEDI_cursorVisualColumnIndex] = lineAndColumnIndices_indexColumn;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = lineAndColumnIndices_indexLine;
        INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
        INTS[fEDI_cursor_selectionIndexAnchorLine] = INTS[fEDI_cursor_selectionIndexEndLine];
        INTS[fEDI_cursor_selectionIndexAnchorColumn] = INTS[fEDI_cursor_selectionIndexEndColumn];
    }
    else {
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
        if (event.ctrlKey && INTS[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
            EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
            const line_end = INTS[fEDI_getLineBoundaryPositions_end];
            let indexPosition = INTS[fEDI_getLineBoundaryPositions_start] + INTS[fEDI_cursor_indexColumn];
            let originalCharacterKind = EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], indexPosition, line_end);
            if (originalCharacterKind === CharacterKind_Whitespace && getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                INTS[fEDI_cursorVisualColumnIndex] += (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
            }
            else {
                INTS[fEDI_cursorVisualColumnIndex]++;
            }
            INTS[fEDI_cursor_indexColumn]++;
            indexPosition++;

            while (INTS[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
                if (EDI_getCharacterCurrent_KIND(INTS[fEDI_cursor_indexColumn], indexPosition, line_end) === originalCharacterKind) {
                    if (originalCharacterKind === CharacterKind_Whitespace && getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                        INTS[fEDI_cursorVisualColumnIndex] += (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
                    }
                    else {
                        INTS[fEDI_cursorVisualColumnIndex]++;
                    }
                    INTS[fEDI_cursor_indexColumn]++;
                    indexPosition++;
                }
                else {
                    break;
                }
            }
        }
        else {
            if (INTS[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
                if (getCharacter(EDI_getPositionIndex_cursor()) === '\t') {
                    INTS[fEDI_cursorVisualColumnIndex] += (4 - (INTS[fEDI_cursor_indexColumn] % 4)); // (tabLength)
                }
                else {
                    INTS[fEDI_cursorVisualColumnIndex]++;
                }
                INTS[fEDI_cursor_indexColumn]++;
            }
            else if (INTS[fEDI_cursor_indexLine] < EDI_lineEndPositionList_count - 1) {
                INTS[fEDI_cursor_indexColumn] = 0;
                INTS[fEDI_cursor_indexLine]++;
                INTS[fEDI_cursorVisualColumnIndex] = 0;
                INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    }
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_Home(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();
    EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
    if (event.ctrlKey) {
        INTS[fEDI_cursor_indexLine] = 0;
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = 0;
    }
    else {
        let endExclusiveIndentationIndexColumn = EDI_findEndExclusiveIndentationIndexColumn();
        if (INTS[fEDI_cursor_indexColumn] == endExclusiveIndentationIndexColumn) {
            INTS[fEDI_cursor_indexColumn] = 0;
            INTS[fEDI_cursorVisualColumnIndex] = 0;
        }
        else {
            INTS[fEDI_cursor_indexColumn] = endExclusiveIndentationIndexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = endExclusiveIndentationIndexColumn;
        }
    }
    EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
    return false;
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_End(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();
    EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
    if (event.ctrlKey) {
        INTS[fEDI_cursor_indexLine] = EDI_lineEndPositionList_count - 1;
    }
    INTS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
    INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_indexColumn];
    EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
    return false;
}

function EDI_onKeyDown_PageDown(event) {
    event.stopPropagation();

    if (event.ctrlKey) {
        INTS[fEDI_cursor_indexLine] = INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount];
        if (INTS[fEDI_virtualCount] > 1) {
            // this seems to more commonly have the cursor staying within the viewport rather than overlapping outside.
            INTS[fEDI_cursor_indexLine]--;
        }
        if (INTS[fEDI_cursor_indexLine] >= EDI_lineEndPositionList_count) {
            // TODO: You can't delete EOF can you? i.e.: cursor final position of file then delete?
            INTS[fEDI_cursor_indexLine] = EDI_lineEndPositionList_count - 1;
        }
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
        // TODO: allow someone to select via this keybind, but for now it causes a bad selection if you { 'Ctrl' + 'a' } then use it so I'm clearing any active selection here for now.
        INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
        EDI_render_request(RenderKind_Cursor_n);
        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
}

function EDI_onKeyDown_PageUp(event) {
    event.stopPropagation();

    if (event.ctrlKey) {        
        INTS[fEDI_cursor_indexLine] = INTS[fEDI_virtualIndexLine];
        if (INTS[fEDI_virtualCount] > 1) {
            // this seems to more commonly have the cursor staying within the viewport rather than overlapping outside.
            INTS[fEDI_cursor_indexLine]++;
        }
        if (INTS[fEDI_cursor_indexLine] >= EDI_lineEndPositionList_count) {
            // TODO: You can't delete EOF can you? i.e.: cursor final position of file then delete?
            INTS[fEDI_cursor_indexLine] = EDI_lineEndPositionList_count - 1;
        }
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
        // TODO: allow someone to select via this keybind, but for now it causes a bad selection if you { 'Ctrl' + 'a' } then use it so I'm clearing any active selection here for now.
        INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
        EDI_render_request(RenderKind_Cursor_n);
        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
}

/**
 * Make a list of the reasons why this "is async":
 * - case 'c': (EDI_copySelection)
 * - case 'x': (EDI_copySelection)
 * - case 'v': (window.myAPI.readClipboard)
 * 
 * In otherwords:
 * 
 * TODO:
 * - the tiny details of the ipc calls i.e.: what lines run synchronously
 * - is it enough lines that run synchronously before an await that it "just works"
 * 
 * - EDI_copySelection
 *     - synchronous copy with textarea and 'success = document.execCommand('copy');'
 *     - async copy logic
 *         - you could determine the text to copy immediately I wonder?
 *         - problematic is that you'd need to copy the bytes otherwise you'd be getting a subarray that points at the same data
 *         - so you'd either have to copy the data to another "array"
 *         - or lock the editor UI while the copy is being completed.
 * - window.myAPI.readClipboard
 *     - Solutions:
 *         - The synchronous paste event
 *             - side note you always wondered why they focused a textarea, in part it is from what I understand so you can paste into it and synchronously get the pasted text.
 *             - problematic case is that you can't rebind paste event
 *         - async paste logic
 *             - problematic case is that you need to lock the editor UI while the paste is being completed.
*/
async function EDI_onKeyDown_keyLengthEqualsOne_ctrlKey(event) {
    EDI_movementBasedCacheInvalidation();
    switch (event.key) {
        case 'c':
            
            event.preventDefault();
            event.stopPropagation();

            EDI_finalizeEdit();
            await EDI_copySelection();
            break;
        case 'x':

            event.preventDefault();
            event.stopPropagation();

            EDI_finalizeEdit();
            await EDI_copySelection();
            EDI_removeSelection(); // TODO: Multicursor bad
            EDI_render_request(RenderKind_Cursor_n);
            if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
                EDI_cursorBlink_startChecking(); // TODO: this one is especially questionable since it invoked 'EDI_removeSelection' prior to the draw cursor?
            }
            break;
        case 'v':

            event.preventDefault();
            event.stopPropagation();

            let clipboard = await window.myAPI.readClipboard();
            EDI_editEvent(EditKind_Paste, event, clipboard);
            break;
        case 'd':

            event.preventDefault();
            event.stopPropagation();

            EDI_editEvent(EditKind_Duplicate, event);
            break;
        case 'a':

            event.preventDefault();
            event.stopPropagation();

            EDI_finalizeEdit();
            INTS[fEDI_cursor_selectionAnchor] = 0;
            INTS[fEDI_cursor_selectionEnd] = EDI_textByteList_count;
            EDI_getLineAndColumnIndices(INTS[fEDI_cursor_selectionEnd]);
            let selectionEndLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
            let selectionEndLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
            INTS[fEDI_cursor_indexLine] = selectionEndLineAndColumnIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = selectionEndLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex] = selectionEndLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = selectionEndLineAndColumnIndices_indexLine;
            EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
            break;
        case 'f':

            event.preventDefault();
            event.stopPropagation();

            EDI_findOverlay_showSetter(!get_EDI_findOverlay_show());
            break;
        case 'z':
            //alert('undo');
            break;
        case 'y':
            //alert('redo');
            break;
        case ' ':
            event.preventDefault();
            event.stopPropagation();
            EDI_requestLspComplete();
            break;
    }
}

function EDI_onKeyDown_keyLengthEqualsOne_altKey(event) {
    
}

/**
 * 'INTS[fEDI_getIndexFromX_indexColumn]'
 * 
 * 'INTS[fEDI_getIndexFromX_visualColumns]'
 * 
 * @returns nothing: the results are stored in 'INTS[fEDI_getIndexFromX_indexColumn]' and 'INTS[fEDI_getIndexFromX_visualColumns]'.
 */
function getIndexFromX(localX, indexLine, lineStart, lineEnd, lastValidIndexColumn) {
    let visualColumns = 0;
    let positionIndex = lineStart;
    let indexColumn = 0;
    let charWidth = EDI_characterWidth;

    while (positionIndex < lineEnd) {
        let charLength = 1;
        
        if (getCharacter(positionIndex) === '\t') {
            charLength = 4 - (visualColumns % 4);
        }

        // Calculate pixel boundaries for the current character
        const charLeftX = visualColumns * charWidth;
        const charRightX = (visualColumns + charLength) * charWidth;
        const charMidpointX = charLeftX + (charRightX - charLeftX) / 2;

        // If the click is before the midpoint of this character/tab, target this index
        if (localX < charMidpointX) {
            INTS[fEDI_getIndexFromX_indexColumn] = indexColumn;
            INTS[fEDI_getIndexFromX_visualColumns] = visualColumns;
            return;
        }

        visualColumns += charLength;
        positionIndex++;
        indexColumn++;
    }

    // If clicked past the end of the line text
    INTS[fEDI_getIndexFromX_indexColumn] = indexColumn;
    INTS[fEDI_getIndexFromX_visualColumns] = visualColumns;
}

function EDI_onMouseDown(event) {
    EDI_movementBasedCacheInvalidation();

    if (get_EDI_recentBoundingClientRect_isNull_intFalsey()) {
        let boundingClientRect = EDI_baseElement.getBoundingClientRect();
        INTS[fEDI_recentBoundingClientRect_left] = boundingClientRect.left;
        INTS[fEDI_recentBoundingClientRect_top] = boundingClientRect.top;
        set_EDI_recentBoundingClientRect_isNull_intFalsey(0);
    }

    if (event.button === 0) {
        BYTES[byteEDI_mousemove_eventListener_isActive] = 1;
        EDI_baseElement.addEventListener('mousemove', EDI_onMouseMove_WRAPIT);
    }

    let rY = event.clientY - INTS[fEDI_recentBoundingClientRect_top] + INTS[fEDI_lastReadNumber_scrollTop];
    let rX = event.clientX - INTS[fEDI_recentBoundingClientRect_left] - INTS[fEDI_gutterWidthTotal] + INTS[fEDI_lastReadNumber_scrollLeft];
    
    let indexLine = Math.floor(rY / INTS[fEDI_lineHeight]);
    let indexColumn = Math.round(rX / EDI_characterWidth);
    let indexColumnVisual = indexColumn;

    if (indexLine < 0) {
        indexLine = 0;
    }

    if (indexColumn < 0) {
        indexColumn = 0;
        indexColumnVisual = indexColumn;
    }

    if (indexLine >= EDI_lineEndPositionList_count) {
        indexLine = EDI_lineEndPositionList_count - 1;
    }

    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);

    EDI_getLineBoundaryPositions_raw(indexLine);
    getIndexFromX(rX, indexLine, INTS[fEDI_getLineBoundaryPositions_start], INTS[fEDI_getLineBoundaryPositions_end], lastValidIndexColumn);
    indexColumn = INTS[fEDI_getIndexFromX_indexColumn];
    indexColumnVisual = INTS[fEDI_getIndexFromX_visualColumns];

    if (indexColumn > lastValidIndexColumn) {
        indexColumn = lastValidIndexColumn;
        indexColumnVisual = indexColumn;
    }

    if (rX < -1 * CONST_EDI_gutterPaddingRight) {
        set_EDI_detailRank(3);
        EDI_onMouseDownDetailRankThree(event.button, event.shiftKey, indexLine, indexColumn);
        if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
        return;
    }

    if (event.detail % 3 === 0) {
        set_EDI_detailRank(3);
        EDI_onMouseDownDetailRankThree(event.button, event.shiftKey, indexLine, indexColumn);
    }
    else if (event.detail % 2 === 0) {
        set_EDI_detailRank(2);
        EDI_onMouseDownDetailRankTwo(event.button, event.shiftKey, indexLine, indexColumn);
    }
    else {
        set_EDI_detailRank(1);
        EDI_onMouseDownDetailRankOne(event.button, event.shiftKey, indexLine, indexColumn, indexColumnVisual);
    }

    if (!BYTES[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
}

function EDI_onContextMenu() {
    let optionList = [
        new MenuOption(CommandKind_Cut, 'Cut', null),
        new MenuOption(CommandKind_Copy, 'Copy', null),
        new MenuOption(CommandKind_Paste, 'Paste', null),
        new MenuOption(CommandKind_Find, 'Find', null),
    ];

    let menuLeft = INTS[fEDI_recentBoundingClientRect_left] + INTS[fEDI_gutterWidthTotal] + INTS[fEDI_cursor_cursorTranslateXValue] - INTS[fEDI_lastReadNumber_scrollLeft];
    let menuTop = INTS[fEDI_recentBoundingClientRect_top] + INTS[fEDI_cursor_cursorTranslateYValue] + INTS[fEDI_lineHeight] - INTS[fEDI_lastReadNumber_scrollTop];

    return menuSet('EDITOR', null, optionList, menuLeft, menuTop);
}

function EDI_onWheel(event) {
    if (event.shiftKey) {
        EDI_baseElement.scrollBy(event.deltaY, 0);
        // TODO: 'INTS[fEDI_lastReadNumber_scrollLeft]' here?
        EDI_horizontal_scrollbar.scrollLeft = EDI_baseElement.scrollLeft;
    }
}

function EDI_horizontal_scrollbar_onScroll() {
    EDI_baseElement.scrollLeft = EDI_horizontal_scrollbar.scrollLeft;
}

function EDI_findOverlay_doSearch() {
	let input = document.getElementById('EDI_findOverlay_input_elementId');
    if (!input || !input.value) return;
    
    let spanCurrent = document.getElementById('EDI_findOverlay_current');
	if (!spanCurrent) return;
	
	let spanTotal = document.getElementById('EDI_findOverlay_total');
	if (!spanTotal) return;
    
    set_EDI_findOverlay_wasSearched(true);

    let searchEncoded = EDI_encoder.encode(input.value);

    EDI_finalizeEdit();

    EDI_findOverlay_searchResultPositionList.clear();

    let offset = 0;
    let posStartOfMatch = 0;

    /** Given the current EDI_primaryCursor position, which match comes next. */
    let nextMatchNumber = -1;
    let nextMatchPos;

    if (EDI_cursor_hasSelection()) {
        let small = INTS[fEDI_cursor_selectionAnchor];
        let large = INTS[fEDI_cursor_selectionEnd];
        if (INTS[fEDI_cursor_selectionAnchor] > INTS[fEDI_cursor_selectionEnd]) {
            small = INTS[fEDI_cursor_selectionEnd];
            large = INTS[fEDI_cursor_selectionAnchor];
        }
        nextMatchPos = small;
    }
    else {
        nextMatchPos = EDI_getPositionIndex_cursor();
    }
    
    if (get_EDI_findOverlay_options_matchWord() && ((searchEncoded[0] >= 97 && searchEncoded[0] <= 122) || (searchEncoded[0] >= 65 && searchEncoded[0] <= 90) || (searchEncoded[0] >= 48 && searchEncoded[0] <= 57) || (searchEncoded[0] === 95))) {
		for (let i = 0; i < EDI_textByteList_count; i++) {
			if ((EDI_textByteList_bytes[i] >= 97 && EDI_textByteList_bytes[i] <= 122) || (EDI_textByteList_bytes[i] >= 65 && EDI_textByteList_bytes[i] <= 90) || (EDI_textByteList_bytes[i] >= 48 && EDI_textByteList_bytes[i] <= 57) || (EDI_textByteList_bytes[i] === 95)) {
				if (EDI_textByteList_bytes[i] === searchEncoded[0]) {
    				while (i < EDI_textByteList_count) { // context switch to checking match
    					if (EDI_textByteList_bytes[i] === searchEncoded[offset]) {
				            if (offset === 0) {
				                posStartOfMatch = i;
				            }
				            offset++;
				            if (offset === searchEncoded.length) { // found "possible match"
				            	if (i + 1 >= EDI_textByteList_count ||
				            		!((EDI_textByteList_bytes[i + 1] >= 97 && EDI_textByteList_bytes[i + 1] <= 122) || (EDI_textByteList_bytes[i + 1] >= 65 && EDI_textByteList_bytes[i + 1] <= 90) || (EDI_textByteList_bytes[i + 1] >= 48 && EDI_textByteList_bytes[i + 1] <= 57) || (EDI_textByteList_bytes[i + 1] === 95))) { // ends on a word, therefore take match
					            		EDI_findOverlay_searchResultPositionList.insert(EDI_findOverlay_searchResultPositionList.count, posStartOfMatch);
                                        if (nextMatchNumber === -1 && posStartOfMatch >= nextMatchPos) {
                                            nextMatchNumber = EDI_findOverlay_searchResultPositionList.count;
                                            nextMatchPos = posStartOfMatch;
                                        }
				                		offset = 0;
				                		break;
				            	}
				            	else { // does NOT end on a word, therefore ignore match
				            		offset = 0;
				            		while (i < EDI_textByteList_count) { // move pos to next NON(letterOrDigit) or EOF
				            			if (!((EDI_textByteList_bytes[i] >= 97 && EDI_textByteList_bytes[i] <= 122) || (EDI_textByteList_bytes[i] >= 65 && EDI_textByteList_bytes[i] <= 90) || (EDI_textByteList_bytes[i] >= 48 && EDI_textByteList_bytes[i] <= 57) || (EDI_textByteList_bytes[i] === 95))) {
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
				            while (i < EDI_textByteList_count) { // move pos to next NON(letterOrDigit) or EOF
		            			if (!((EDI_textByteList_bytes[i] >= 97 && EDI_textByteList_bytes[i] <= 122) || (EDI_textByteList_bytes[i] >= 65 && EDI_textByteList_bytes[i] <= 90) || (EDI_textByteList_bytes[i] >= 48 && EDI_textByteList_bytes[i] <= 57) || (EDI_textByteList_bytes[i] === 95))) {
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
					while (i < EDI_textByteList_count) { // move pos to next NON(letterOrDigit) or EOF
            			if (!((EDI_textByteList_bytes[i] >= 97 && EDI_textByteList_bytes[i] <= 122) || (EDI_textByteList_bytes[i] >= 65 && EDI_textByteList_bytes[i] <= 90) || (EDI_textByteList_bytes[i] >= 48 && EDI_textByteList_bytes[i] <= 57) || (EDI_textByteList_bytes[i] === 95))) {
            				i--; // backtrack by one due to outer for loop's incrementation step
            				break;
            			}
        				i++;
            		}
				}
			}
			else {
				while (i < EDI_textByteList_count) { // move pos to next letterOrDigit or EOF
        			if ((EDI_textByteList_bytes[i] >= 97 && EDI_textByteList_bytes[i] <= 122) || (EDI_textByteList_bytes[i] >= 65 && EDI_textByteList_bytes[i] <= 90) || (EDI_textByteList_bytes[i] >= 48 && EDI_textByteList_bytes[i] <= 57) || (EDI_textByteList_bytes[i] === 95)) {
        				i--; // backtrack by one due to outer for loop's incrementation step
        				break;
        			}
    				i++;
        		}
			}
	    }
    }
    else {
    	for (let i = 0; i < EDI_textByteList_count; i++) {
	        if (EDI_textByteList_bytes[i] === searchEncoded[offset]) {
	            if (offset === 0) {
	                posStartOfMatch = i;
	            }
	            offset++;
	            if (offset === searchEncoded.length) {
	                EDI_findOverlay_searchResultPositionList.insert(EDI_findOverlay_searchResultPositionList.count, posStartOfMatch);
                    if (nextMatchNumber === -1 && posStartOfMatch >= nextMatchPos) {
                        nextMatchNumber = EDI_findOverlay_searchResultPositionList.count;
                        nextMatchPos = posStartOfMatch;
                    }
	                offset = 0;
	            }
	        }
	        else {
	            // I'm not sure how I like this. It feels wasteful to set this to 0.
	            // But if I check to see if it is 0, that feels even more wasteful.
	            offset = 0;
	        }
	    }
    }

    if (nextMatchNumber === -1) {
        nextMatchNumber = 1;
    }
    spanCurrent.textContent = nextMatchNumber;
    spanTotal.textContent = EDI_findOverlay_searchResultPositionList.count;
}

function EDI_findOverlay_input_onkeydown(event) {
    switch (event.key) {
        case 'Enter':
            EDI_findOverlay_doSearch();
            break;
        case 'Escape':
        	set_EDI_findOverlay_wasSearched(false);
            EDI_findOverlay_showSetter(false);
            EDI_baseElement.focus();
            break;
    }
}

function EDI_findOverlay_input_onblur() {
	if (!get_EDI_findOverlay_wasSearched()) {
		EDI_findOverlay_doSearch();
	}
}

function EDI_findOverlay_input_onchange() {
	set_EDI_findOverlay_wasSearched(false);
}

function EDI_findOverlay_checkboxMatchWord_onchange() {
	// for an onchange event, event.target might always be precise?
	let checkboxMatchWord = document.getElementById('EDI_findOverlay_checkboxMatchWord');
    if (checkboxMatchWord) {
    	set_EDI_findOverlay_options_matchWord(checkboxMatchWord.checked);
    	EDI_findOverlay_doSearch();
    }
}

function EDI_findOverlay_showSetter(showValue) {
    EDI_finalizeEdit();

    if (!get_EDI_findOverlay_show() && showValue) {
        EDI_findOverlay.style.visibility = '';
        EDI_findOverlay_searchResultPositionList = new UInt32List(256);
        
        let input = document.createElement('input');
        input.id = 'EDI_findOverlay_input_elementId';
        // 'change' needs to be the first event added so the 'Enter' keydown happens with proper timing
        input.addEventListener('change', EDI_findOverlay_input_onchange);
        input.addEventListener('keydown', EDI_findOverlay_input_onkeydown);
        input.addEventListener('blur', EDI_findOverlay_input_onblur);
        EDI_findOverlay.appendChild(input);
        if (!get_EDI_findOverlay_isBeingShownDueToMultiCursorMatching()) {
            input.focus();
        }
        
        let divCurrentOfTotal = document.createElement('div');
        let spanBlank = document.createElement('span');
        spanBlank.textContent = '1';
        spanBlank.id = 'EDI_findOverlay_current';
        divCurrentOfTotal.appendChild(spanBlank);
        let spanBlankOf = document.createElement('span');
        spanBlankOf.textContent = ' of ';
        divCurrentOfTotal.appendChild(spanBlankOf);
        let spanBlankOfBlank = document.createElement('span');
        spanBlankOfBlank.textContent = '10';
        spanBlankOfBlank.id = 'EDI_findOverlay_total';
        divCurrentOfTotal.appendChild(spanBlankOfBlank);
        EDI_findOverlay.appendChild(divCurrentOfTotal);
        
        let divPrevNext = document.createElement('div');
        let btnPrev = document.createElement('button');
        btnPrev.textContent = 'prev';
        btnPrev.id = 'EDI_findOverlay_prev';
        btnPrev.style.marginRight = '5px';
        let btnNext = document.createElement('button');
        btnNext.textContent = 'next';
        btnNext.id = 'EDI_findOverlay_next';
        btnPrev.addEventListener('click', EDI_btnPrev_onclick);
        btnNext.addEventListener('click', EDI_btnNext_onclick); 
        divPrevNext.appendChild(btnPrev);
        divPrevNext.appendChild(btnNext);
        EDI_findOverlay.appendChild(divPrevNext);
        
        let divOptions = document.createElement('div');
        let checkboxMatchWord = document.createElement('input');
	    checkboxMatchWord.type = 'checkbox';
	    checkboxMatchWord.id = 'EDI_findOverlay_checkboxMatchWord';
	    checkboxMatchWord.checked = Boolean(get_EDI_findOverlay_options_matchWord());
	    checkboxMatchWord.addEventListener('change', EDI_findOverlay_checkboxMatchWord_onchange);
	    divOptions.appendChild(checkboxMatchWord);
	    let label_for_checkboxMatchWord = document.createElement('label');
	    label_for_checkboxMatchWord.htmlFor = 'EDI_findOverlay_checkboxMatchWord';
	    label_for_checkboxMatchWord.textContent = 'matchWord';
	    divOptions.appendChild(label_for_checkboxMatchWord);
	    EDI_findOverlay.appendChild(divOptions);
        
        if (EDI_cursor_hasSelection()) {
        	EDI_finalizeEdit();
            let selectionAnchor = INTS[fEDI_cursor_selectionAnchor];
            let selectionEnd = INTS[fEDI_cursor_selectionEnd];
            let small;
            let large;
            if (selectionAnchor < selectionEnd) {
                small = selectionAnchor;
                large = selectionEnd;
            }
            else {
                small = selectionEnd;
                large = selectionAnchor;
            }
            let offset = small;
            let length = large - small;
            if (length <= 256) {
                input.value = EDI_decode_textonly(offset, length);
                EDI_findOverlay_doSearch();
            }
        }
    }
    else if (get_EDI_findOverlay_show() && !showValue) {
        EDI_findOverlay.style.visibility = 'hidden';
        EDI_findOverlay_searchResultPositionList = null;
        let input = document.getElementById('EDI_findOverlay_input_elementId');
        if (input && input.parentElement === EDI_findOverlay) {
        	input.removeEventListener('change', EDI_findOverlay_input_onchange);
            input.removeEventListener('keydown', EDI_findOverlay_input_onkeydown);
            input.removeEventListener('blur', EDI_findOverlay_input_onblur);
            EDI_findOverlay.removeChild(input);
        }
        let btnPrev = document.getElementById('EDI_findOverlay_prev');
        if (btnPrev) {
        	btnPrev.removeEventListener('click', EDI_btnPrev_onclick);
        }
        let btnNext = document.getElementById('EDI_findOverlay_next');
        if (btnNext) {
        	btnNext.removeEventListener('click', EDI_btnNext_onclick);
        }
        let checkboxMatchWord = document.getElementById('EDI_findOverlay_checkboxMatchWord');
        if (checkboxMatchWord) {
        	checkboxMatchWord.removeEventListener('change', EDI_findOverlay_checkboxMatchWord_onchange);
        }
        EDI_findOverlay.innerHTML = '';
        set_EDI_findOverlay_isBeingShownDueToMultiCursorMatching(false);
    }

    set_EDI_findOverlay_show(showValue);
}

function EDI_btnPrev_onclick(/*event*/) {
	let spanCurrent = document.getElementById('EDI_findOverlay_current');
	if (!spanCurrent) return;
	
	let spanTotal = document.getElementById('EDI_findOverlay_total');
	if (!spanTotal) return;
	
	let current = parseInt(spanCurrent.textContent, 10);
	let total = parseInt(spanTotal.textContent, 10);
	
	if (current && total) {
		current--;
		if (current < 1 || current >= total) {
			if (total > 1) {
				current = total;
			}
			else {
				current = 1;
			}
		}
		spanCurrent.textContent = current;
	}
	else {
		spanCurrent.textContent = 'parseInt not successful?';
	}

    let index = current - 1;
    if (index >= 0 && index < total && index < EDI_findOverlay_searchResultPositionList.count) {
        let pos = EDI_findOverlay_searchResultPositionList.data[index];
        if (pos <= EDI_textByteList_count) {
            EDI_moveCursor_position(pos);
        }
    }
}

function EDI_btnNext_onclick() {
	let spanCurrent = document.getElementById('EDI_findOverlay_current');
	if (!spanCurrent) return;
	
	let spanTotal = document.getElementById('EDI_findOverlay_total');
	if (!spanTotal) return;
	
	let current = parseInt(spanCurrent.textContent, 10);
	let total = parseInt(spanTotal.textContent, 10);
	
	if (current && total) {
		current++;
		if (current > total || current < 1) {
			current = 1;
		}
		spanCurrent.textContent = current;
	}
	else {
		spanCurrent.textContent = 'parseInt not successful?';
	}

    let index = current - 1;
    if (index >= 0 && index < total && index < EDI_findOverlay_searchResultPositionList.count) {
        let pos = EDI_findOverlay_searchResultPositionList.data[index];
        if (pos <= EDI_textByteList_count) {
            EDI_moveCursor_position(pos);
        }
    }
}

function EDI_render_do_IndentMore() {
    // When you're done with IndentLess batch editing correctly.
    // You still need to come back to the render for
    // - [ ] IndentMore and
    // - [ ] IndentLess
    //
    // and ensure that they render properly. This currently if two edits get done in a single "rAF" the second is cancelled for redundancy yet each one only handles 1 editDisplacement so you missed 1 displacement.

    let startingIndex = INTS[fEDI_indent_startingIndex];
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];

    // TODO: Consider having this string available rather than making it everytime this function is invoked.
    let EDI_on_tab_string = '';
    for (let i = 0; i < EDI_on_tab_bytes.length; i++) {
        EDI_on_tab_string += String.fromCharCode(EDI_on_tab_bytes[i]);
    }

    if (INTS[fEDI_cursor_editKind] !== EditKind_IndentMore) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        INTS[fEDI_cursor_editRenderedDisplacement]++;
        for (var lineI = startingIndex; lineI >= SMALL_lineAndColumnIndices_indexLine; lineI--) {
            // Draw the line to reflect the edit, if it is being currently shown on screen.
            // TODO: Use NEXT if the lines are one after another?
            
            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
            let ringBufferIndex = lineI - INTS[fEDI_virtualIndexLine];
            if (ringBufferIndex >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex < 0) ringBufferIndex = -1;
            else ringBufferIndex = (ringBufferIndex + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

            if (ringBufferIndex >= 0) {
                    let div = EDI_textElement.children[ringBufferIndex];
                    let span;
                    if (div.children[0].className === '') {
                        span = div.children[0];
                    }
                    else {
                        span = document.createElement('span');
                        div.insertBefore(span, div.children[0]);
                    }
                    if (span.textContent.length > 0 &&
                        (span.textContent[0] === ' ' || span.textContent[0] === '\t') &&
                        (span.textContent[span.textContent.length - 1] === ' ' || span.textContent[span.textContent.length - 1] === '\t')) {
                            span.textContent += EDI_on_tab_string;
                    }
                    else {
                        span.textContent = EDI_on_tab_string + span.textContent;
                    }
            }
        }

        // # Draw the cursor
        EDI_createStyleForSelection_indentMore();
    }
}

function EDI_indentMore() {

    // TODO: You need to move the logic that moves the tracked syntax to the finalize edit.

    // You need to batch these edits so that if they hold down the tab key, you don't modify the underlying bytes of the text until the edit is finalized.
    // This function (and the 'less' version) are somewhat spahetti-code-y.
    // So make a "TOC", where you list out the main ideas, each main idea being a single line comment that starts with '#'
    // Do not overthink each individual main idea, you can easily change them as needed as you go, just start trying to make sense of things.

    // I think "TOC" has 18 lines of text I tried counting it
    // TOC:
    // ====
    // # Small and large selection positions
    // # Determine the starting indexLine (the start is the large position, this confused me for a moment)
    // # Determine the total count of text that will be inserted, prior to actually beginning the edit.
    // # Update the 'START POSITIONS specifically' of the tracked syntax list by the total count of text that will be inserted.
    // # Descending indexLine loop:
    //     # Insert the text on the respective line.
    //     # Increment the entry in 'EDI_lineEndPositionList' for the respective line
    //     # There's a second modification to the start positions of the tracked syntax list
    //     # Then, you immediately know the trackedSyntax that encompasses the insertion (if it exists), so you increment its length by the text inserted on that respective line.
    //     # Each loop you reduce incrementBy, because you're initial starting the loop knowing you will eventually insert 4 characters on every line.
    //         # thus, the first iteration of the loop you're increasing that line's end position by the length of text inserted per line by the amount of lines.
    //         # The next iteration is a smaller indexLine so you decrement because you have the insertion of one less line to consider.
    // # Any line that is not part of the selected set of lines, and is at a greater indexLine, needs to have their line end position entry updated.
    // # Update the cursor's selection to reflect the inserted text
    // # Update the cursor's indexColumn to reflect the inserted text
    // # Update the cursor's selection to reflect the inserted text
    // # Draw the cursor
    // # Redraw the entire viewport (I didn't even think about this... this should change)

    // Some of the ideas that I listed are vague.
    // Likely I have that wording because even I can't remember what was going on.
    //
    // For example "you immediately know the trackedSyntax that encompasses the insertion (if it exists)"
    // I can't remember why this works but I remember that it does.
    // So I need to figure out why it works.

    // all I gotta do is this one to move it all to the finalize other than modifying the UI I gotta go to the bathroom.

    // # Small and large selection positions
    let SMALL_pos;
    let LARGE_pos;
    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = INTS[fEDI_cursor_selectionAnchor];
        LARGE_pos = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = INTS[fEDI_cursor_selectionEnd];
        LARGE_pos = INTS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices_raw(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    EDI_getLineAndColumnIndices_raw(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    // start at the LARGE position
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    EDI_getLineBoundaryPositions_raw(startingIndex);
    let startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start];
    let startingLinePos_end = INTS[fEDI_getLineBoundaryPositions_end];
    if (startingLinePos_start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            EDI_getLineBoundaryPositions_raw(startingIndex);
            startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start]; // TODO: This updated start value isn't actually used. Keep it for symmetry with 'startingLinePos_end'?
            startingLinePos_end = INTS[fEDI_getLineBoundaryPositions_end]; // TODO: Well actually this end value is used but you could move the if statement for 'INTS[fEDI_cursor_editLength] === 0' and just immediately set 'INTS[fEDI_EDI_indentLess_startingLinePos_end]' here...
                                                                           // ...This would avoid the symmetry issue because you updated a different value than the "end" so both values are still outdated rather than just 1.
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = SMALL_lineAndColumnIndices_indexLine;
    INTS[fEDI_indent_startingIndex] = startingIndex;

    if (INTS[fEDI_cursor_editLength] === 0) {
        INTS[fEDI_EDI_indentLess_startingLinePos_end] = startingLinePos_end;
    } 

    //// # Update the cursor's selection to reflect the inserted text
    //if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
    //    INTS[fEDI_cursor_selectionEnd] += ORIGINAL_incrementBy;
    //}
    //else {
    //    INTS[fEDI_cursor_selectionAnchor] += ORIGINAL_incrementBy;
    //}

    // # Update the cursor's indexColumn to reflect the inserted text
    INTS[fEDI_cursor_indexColumn] += EDI_on_tab_bytes.length;
    INTS[fEDI_cursorVisualColumnIndex] += EDI_on_tab_bytes.length;

    //// # Update the cursor's selection to reflect the inserted text
    //let smallLinePos = EDI_getLineBoundaryPositions(SMALL_lineAndColumnIndices.indexLine);
    //if (SMALL_pos > smallLinePos.start) {
    //    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
    //        INTS[fEDI_cursor_selectionAnchor] += 4;
    //    }
    //    else {
    //        INTS[fEDI_cursor_selectionEnd] += 4;
    //    }
    //}

    INTS[fEDI_cursor_editLength]++;
    EDI_render_request(RenderKind_IndentMore);
}

function EDI_render_do_IndentLess() {
    let startingIndex = INTS[fEDI_indent_startingIndex];
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];

    if (INTS[fEDI_cursor_editKind] !== EditKind_IndentLess) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        
        INTS[fEDI_cursor_editRenderedDisplacement]++;

        /////////////////////// P_1
        let textSelectionDiv;
        if (BYTES[byteEDI_cursor_selectionDivExists]) {
            for (var i = 0; i < EDI_presentation.children.length; i++) {
                if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                    textSelectionDiv = EDI_presentation.children[i];
                    break;
                }
            }
        }
        else {
            // TODO: Silent error confusing bad idea
        }
        let lesstraWidth_1 = 1 * EDI_characterWidth;
        let lesstraWidth_2 = 2 * EDI_characterWidth;
        let lesstraWidth_3 = 3 * EDI_characterWidth;
        let lesstraWidth_4 = 4 * EDI_characterWidth;
        /////////////////////// P_1

        let selectionLineDivIndex = 0;
        if (textSelectionDiv) {
            selectionLineDivIndex = textSelectionDiv.children.length - 1;
        }

        for (var lineI = startingIndex; lineI >= SMALL_lineAndColumnIndices_indexLine; lineI--) {
            let innerRemoveCount = 0;
            EDI_getLineBoundaryPositions(lineI);
            const line_start = INTS[fEDI_getLineBoundaryPositions_start];
            let lastValidIndexColumn = EDI_getLastValidIndexColumn(lineI);
            let upperLimitIndexColumn;
            if (lastValidIndexColumn > 4) {
                upperLimitIndexColumn = 4;
            }
            else {
                upperLimitIndexColumn = lastValidIndexColumn;
            }
            let seenSpace = false;
            outer: for (var i = 0; i < upperLimitIndexColumn; i++) {
                let c = getCharacter(line_start + i);
                switch (c) {
                    case ' ':
                        seenSpace = true;
                        innerRemoveCount++;
                        break;
                    case '\t':
                        if (!seenSpace) {
                            innerRemoveCount++;
                        }
                        break outer;
                    default:
                        break outer;
                }
            }

            /////////////////////// P_2
            // TODO: This is not entirely correct. Presumably most specifically I am referring to the first line that is selected.
            if (textSelectionDiv && innerRemoveCount >= 1 && innerRemoveCount <= 4) {
                let lineSelectionDiv = textSelectionDiv.children[selectionLineDivIndex--];
                let widthNumberValue = parseFloat(lineSelectionDiv.style.width, 10);
                let lesstraWidth;
                switch (innerRemoveCount) {
                    case 1:
                        lesstraWidth = lesstraWidth_1;
                        break;
                    case 2:
                        lesstraWidth = lesstraWidth_2;
                        break;
                    case 3:
                        lesstraWidth = lesstraWidth_3;
                        break;
                    case 4:
                        lesstraWidth = lesstraWidth_4;
                        break;
                }
                widthNumberValue -= lesstraWidth;
                lineSelectionDiv.style.width = widthNumberValue + 'px';
            }
            /////////////////////// P_2

            // Draw the line to reflect the edit, if it is being currently shown on screen.
            // TODO: Use NEXT if the lines are one after another?

            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
            let ringBufferIndex = lineI - INTS[fEDI_virtualIndexLine];
            if (ringBufferIndex >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex < 0) ringBufferIndex = -1;
            else ringBufferIndex = (ringBufferIndex + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

            if (ringBufferIndex >= 0) {
                    let div = EDI_textElement.children[ringBufferIndex];
                    let span = div.children[0];
                    span.textContent = span.textContent.slice(innerRemoveCount);
            }
        }

        /////////////////////// P_3
        INTS[fEDI_cursor_DRAWN_selectionAnchor] = INTS[fEDI_cursor_selectionAnchor];
        INTS[fEDI_cursor_DRAWN_selectionEnd] = INTS[fEDI_cursor_selectionEnd];
        /////////////////////// P_3
    }
}

function EDI_indentLess() {

    // everything in indentMore / indentLess likely needs to use the '_raw' variants for each function.
    // as for indentLess, it likely HAS to be written correctly.
    // i.e.: you HAVE to move all of the logic to the finalize otherwise it will be impossible (or each event will have to re-determine what was removed by the previous event and that is a terrible solution.)

    // selection positions
    let SMALL_pos;
    let LARGE_pos;
    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = INTS[fEDI_cursor_selectionAnchor];
        LARGE_pos = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = INTS[fEDI_cursor_selectionEnd];
        LARGE_pos = INTS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    
    EDI_getLineAndColumnIndices(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];

    // starting index
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    EDI_getLineBoundaryPositions(startingIndex);
    let startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start];
    let startingLinePos_end = INTS[fEDI_getLineBoundaryPositions_end];
    if (startingLinePos_start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            EDI_getLineBoundaryPositions(startingIndex);
            startingLinePos_start = INTS[fEDI_getLineBoundaryPositions_start]; // TODO: This updated start value isn't actually used. Keep it for symmetry with 'startingLinePos_end'?
            startingLinePos_end = INTS[fEDI_getLineBoundaryPositions_end]; // TODO: Well actually this end value is used but you could move the if statement for 'INTS[fEDI_cursor_editLength] === 0' and just immediately set 'INTS[fEDI_EDI_indentLess_startingLinePos_end]' here...
                                                                           // ...This would avoid the symmetry issue because you updated a different value than the "end" so both values are still outdated rather than just 1.
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    INTS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = SMALL_lineAndColumnIndices_indexLine;
    INTS[fEDI_indent_startingIndex] = startingIndex;

    if (INTS[fEDI_cursor_editLength] === 0) {
        INTS[fEDI_EDI_indentLess_startingLinePos_end] = startingLinePos_end;
    }

    // TODO: Some kind of "fake" selection somehow because you really only need to modify the top-left most selection and the bottom-right most selection.
    // Then when you perhaps hit 'ctrl + c' to copy. You'd need to finalize the edit then and there so you copy the text correctly.
    //
    //if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
    //    INTS[fEDI_cursor_selectionEnd] -= ORIGINAL_decrementBy;
    //}
    //else {
    //    INTS[fEDI_cursor_selectionAnchor] -= ORIGINAL_decrementBy;
    //}

    INTS[fEDI_cursor_editLength]++;
    EDI_render_request(RenderKind_IndentLess);
}

/**
 * Invoking 'EDI_finalizeEdit()' is a good idea prior to invoking this. Long term perhaps this won't be so important.
 */
async function EDI_copySelection() {
	if (!EDI_cursor_hasSelection()) {
		// TODO: This code has a bug and doesn't work with multicursor... EDI_onMouseDownDetailRankThree needs to accept a cursor rather than acting on EDI_primaryCursor
    	EDI_onMouseDownDetailRankThree(0, false, INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
	}
	let selectionAnchor = INTS[fEDI_cursor_selectionAnchor];
    let selectionEnd = INTS[fEDI_cursor_selectionEnd];
    let small;
    let large;
    if (selectionAnchor < selectionEnd) {
        small = selectionAnchor;
        large = selectionEnd;
    }
    else {
        small = selectionEnd;
        large = selectionAnchor;
    }
    return window.myAPI.editorSetClipboard(EDI_textByteList_bytes, small, large - small, EDI_lineEndString);
}

/**
 * Invoking 'EDI_finalizeEdit()' is a good idea prior to invoking this. Long term perhaps this won't be so important.
 */
async function EDI_duplicateSelection() {
	if (!EDI_cursor_hasSelection()) {
		// TODO: This code has a bug and doesn't work with multicursor... EDI_onMouseDownDetailRankThree needs to accept a cursor rather than acting on EDI_primaryCursor...
        // ...these days the todo is somewhat incorrect, it takes cursor now, but you'd need to check whether this causes the selection of two cursors to overlap.
    	EDI_onMouseDownDetailRankThree(0, false, INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
	}

	let selectionAnchor = INTS[fEDI_cursor_selectionAnchor];
    let selectionEnd = INTS[fEDI_cursor_selectionEnd];
    let small;
    let large;
    if (selectionAnchor < selectionEnd) {
        small = selectionAnchor;
        large = selectionEnd;
    }
    else {
        small = selectionEnd;
        large = selectionAnchor;
    }

    let length = large - small;

    INTS[fEDI_cursor_editPosition] = large;
    EDI_getLineAndColumnIndices(large);
    let large_lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    let large_lineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    INTS[fEDI_cursor_editIndexLine] = large_lineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_editIndexColumn] = large_lineAndColumnIndices_indexColumn;
    INTS[fEDI_cursor_editLength] = length;

    INTS[fEDI_cursor_indexLine] = large_lineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_indexColumn] = large_lineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex] = large_lineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = large_lineAndColumnIndices_indexLine;

    INTS[fEDI_cursor_EDI_duplicate_small] = small;
    INTS[fEDI_cursor_EDI_duplicate_length] = length;

    INTS[fEDI_cursor_selectionAnchor] = large;
    INTS[fEDI_cursor_selectionEnd] = large + length;

    // TODO: The previous render logic was actually moving the cursor as well. Just something to keep in mind, you might see a bug related to this.
    EDI_render_request(RenderKind_DuplicateOrPaste);
}

function EDI_render_do_DuplicateOrPaste() {
    let hasSeenLinefeed = false;

    if (INTS[fEDI_cursor_editKind] !== EditKind_Duplicate && INTS[fEDI_cursor_editKind] !== EditKind_Paste) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength] || INTS[fEDI_cursor_editKind] === EditKind_Paste /* Paste has an editLength of 0 currently */) {

        let small = INTS[fEDI_cursor_EDI_duplicate_small];
        let length = INTS[fEDI_cursor_EDI_duplicate_length];
        let large = small + length;
        
        // TODO: update the 'INTS[fEDI_cursor_editRenderedDisplacement]'

        let byteArray;

        // TODO: re-use the paste byte array
        if (INTS[fEDI_cursor_editKind] === EditKind_Duplicate) {
            byteArray = EDI_textByteList_bytes.subarray(small, large);
        }
        else if (INTS[fEDI_cursor_editKind] === EditKind_Paste) {
            large = EDI_getPositionIndex_raw_cursor();
            let clipboardContent = EDI_cursor_EDI_paste_clipboardContent;
            let clipboardContentLength = clipboardContent.length;

            let lengthBytes = 0;
            let pos = 0;

            while (pos < clipboardContentLength) {
                switch (clipboardContent.charCodeAt(pos)) {
                    case 13 /* carriage return '\r' */:
                        lengthBytes++;
                        if (pos < clipboardContentLength - 1 && clipboardContent.charCodeAt(pos + 1) === CONST_EDI_ASCII_LINE_FEED) {
                            pos += 2;
                        }
                        else {
                            pos++;
                        }
                        break;
                    case CONST_EDI_ASCII_TAB:
                        // '\t\0\0\0' was likely a bad idea and should "TODO: be changed", but nevertheless it is how the editor works at the moment.
                        //
                        lengthBytes += 4;
                        pos++;
                        break;
                    default:
                        lengthBytes++;
                        pos++;
                        break;
                }
            }

            byteArray = new Uint8Array(lengthBytes);
            length = lengthBytes;
            // TODO: You need 'INTS[fEDI_cursor_editLength]' when finalizing the cursor right? It isn't set until this point for Paste edits.
            INTS[fEDI_cursor_editLength] = lengthBytes;

            // I'm gonna re-use lengthBytes to populate the array to avoid messing something up just to get a different variable with the name of maybe 'offsetBytes' or some such.
            lengthBytes = 0;
            pos = 0;

            while (pos < clipboardContentLength) {
                const code = clipboardContent.charCodeAt(pos);
                switch (code) {
                    case 13 /* carriage return '\r' */:
                        byteArray[lengthBytes++] = 10; // char code for '\n' is 10
                        if (pos < clipboardContentLength - 1 && clipboardContent.charCodeAt(pos + 1) === CONST_EDI_ASCII_LINE_FEED) { // Editor tracks all linefeeds as '\n', then when saving out the file swaps the '\n' for whatever the originally first encountered line end kind was (perhaps '\r', '\n' or '\r\n').
                            pos += 2;
                        }
                        else {
                            pos++;
                        }
                        break;
                    case CONST_EDI_ASCII_TAB:
                        // '\t\0\0\0' was likely a bad idea and should "TODO: be changed", but nevertheless it is how the editor works at the moment.
                        //
                        byteArray[lengthBytes++] = 9; // char code for '\t' is 9
                        byteArray[lengthBytes++] = 0; // char code for '·' is 0
                        byteArray[lengthBytes++] = 0; // char code for '·' is 0
                        byteArray[lengthBytes++] = 0; // char code for '·' is 0
                        pos++;
                        break;
                    default:
                        byteArray[lengthBytes++] = code;
                        pos++;
                        break;
                }
            }
        }
        else {
            throw Error();
        }

        walkLineUntilIndexColumn();
        if (!w_span || !w_div) {
            // TODO: silent error bad
            alert('// EDI_paste TODO: silent error bad');
            return;
        }

        let positionIndex = large;

        let linesInsertedCount = 0;
        let insertionLength = 0;

        /** is a 0 based index, inclusive */
        let wordStart = 0;
        let wordLength = 0;

        // No need to consider '\r\n' and etc... only '\n'
        let linefeedLength = 0;

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_current = INTS[fEDI_cursor_indexLine] - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_current >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_current < 0) ringBufferIndex_current = -1;
        else ringBufferIndex_current = (ringBufferIndex_current + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_first = INTS[fEDI_virtualIndexLine] - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_first >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_first < 0) ringBufferIndex_first = -1;
        else ringBufferIndex_first = (ringBufferIndex_first + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        // TODO: Use PREVIOUS here from 'ringBufferIndex_first'

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
        else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];


        let last_valid_indexColumn_currentLine = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);

        // TODO: An optimization to check whether you even need to redraw any lines perhaps is possible but it would add too much complexity at the moment and so it isn't being considered...
        // ...i.e.: if you're inserting so many lines that you know you'll scroll or that only a small amount of lines need to be redrawn due to predicting a scroll event.

        let shouldPreserveCssClassWhenSplittingAmongLine = false;
        let hasSeenLinefeed = false;

        let original_indexColumn_SpanTextContentRelative = INTS[fEDI_w_indexColumn_SpanTextContentRelative];
        let original_span_textContent_length = w_span.textContent.length;
        let original_tracked_syntax_start = positionIndex - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum];

        let offset = 0;

        /**
         * 0 => None,
         * 1 => '\n',
         * 2 => wordLetterOrDigit
         */
        let characterKindNumber_NEEDS_WRITTEN = 0;

        if (offset < length) {
            while (true) {

                characterKindNumber_NEEDS_WRITTEN = 0;

                if (offset >= length) {
                    if (wordLength > 0) characterKindNumber_NEEDS_WRITTEN = 2/*wordLetterOrDigit*/;
                    else if (linefeedLength > 0) characterKindNumber_NEEDS_WRITTEN = 1/*'\n'*/;
                }
                else {
                    switch (byteArray[offset]) {
                        //case '\n':
                        case 10:
                            if (wordLength > 0) characterKindNumber_NEEDS_WRITTEN = 2/*wordLetterOrDigit*/;
                            break;
                        default:
                            if (linefeedLength > 0) characterKindNumber_NEEDS_WRITTEN = 1/*'\n'*/;
                            break;
                    }
                }
                switch (characterKindNumber_NEEDS_WRITTEN) {
                    case 1/*'\n'*/:
                        DUPLICATE_writeLinefeed();
                        break;
                    case 2/*wordLetterOrDigit*/:
                        EDI_duplicate_and_paste_writeWord(wordLength, EDI_decoder.decode(byteArray.subarray(wordStart, wordStart + wordLength)));
                        last_valid_indexColumn_currentLine += wordLength;
                        wordStart = 0;
                        wordLength = 0;
                        break;
                }

                if (offset >= length) {
                    break;
                }
                else {
                    switch (byteArray[offset]) {
                        //case '\n':
                        case 10:
                            insertionLength++;
                            linesInsertedCount++;
                            //
                            linefeedLength++;
                            break;
                        default:
                            // TODO: Extremely important next line but it doesn't fully pattern with every case so it is somewhat out of nowhere
                            // TODO: This is nonsensical you cannot numerically compare a ringBuffer index because the zeroth index isn't necessarily 0
                            if (ringBufferIndex_current > ringBufferIndex_last) return;
                            //
                            insertionLength++;
                            //
                            if (wordLength === 0) {
                                wordStart = offset;
                            }
                            wordLength++;
                            break;
                    }
                }
        
                ++offset;
            }
        }

        INTS[fEDI_cursor_editLength] = insertionLength;
        INTS[fEDI_cursor_editPosition] = large;

        if (linesInsertedCount > 0) {
            update_verticalVirtualizationBoundary(EDI_lineEndPositionList_count + linesInsertedCount);
            // I uncommented this, it isn't doing what I want it to. I'm just gonna be done for now.
            // TODO: draw gutter?
        }

        /**
         * TODO: If this ends up working don't duplicate this code, this is the 'EDI_EnterKey' function; copy, paste, and probably modified.
         */
        function DUPLICATE_writeLinefeed() {
            if (!hasSeenLinefeed) {
                hasSeenLinefeed = true;
                shouldPreserveCssClassWhenSplittingAmongLine = EDI_duplicate_and_paste_handleNotHasSeenLinefeed(hasSeenLinefeed, original_indexColumn_SpanTextContentRelative, original_span_textContent_length, positionIndex);
            }

            // TODO: this is a very lazy solution to the problem, likely a more optimal way is available. Also name the variable?
            for (let handleLineCounter = 0; handleLineCounter < linefeedLength; handleLineCounter++) {
                // TODO: This is nonsensical you cannot numerically compare a ringBuffer index because the zeroth index isn't necessarily 0
                if (ringBufferIndex_current > ringBufferIndex_last) {
                    // A scroll should take place and handle the rest
                    // Note: any lines indices that don't change between the current scrollTop and what is shown with the new scrollTop...
                    // ...won't redraw so you still need to run this code for some of the lines.
                    // you could probably predict which lines in particular overlap or some such but it isn't being done here currently.
                    break;
                }

                if (INTS[fEDI_cursor_indexColumn] === 0 && last_valid_indexColumn_currentLine !== 0) { // start of line
                    
                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, ringBufferIndex_current);
                    EDI_textElement.children[ringBufferIndex_current].appendChild(document.createElement('span'));

                    ringBufferIndex_current = (ringBufferIndex_current + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];
                    let lineDiv = EDI_textElement.children[ringBufferIndex_current];
                    w_div = lineDiv;
                    INTS[fEDI_w_indexSpan] = 0;
                    w_span = lineDiv.children[INTS[fEDI_w_indexSpan]];
                    INTS[fEDI_w_indexColumn_Goal] = 0;
                    INTS[fEDI_w_indexColumn_Sum] = 0;
                    INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    INTS[fEDI_cursor_indexLine]++;
                    INTS[fEDI_cursor_indexColumn] = 0;
                    INTS[fEDI_cursorVisualColumnIndex] = 0;
                    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;

                    continue;
                }
                else {
                    // ensure this conditional branch continues if handled, otherwise it will execute the fallback case erroneously
                    if (last_valid_indexColumn_currentLine === INTS[fEDI_cursor_indexColumn]) { // end of line

                        ringBufferIndex_current = (ringBufferIndex_current + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];
                        
                        EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, ringBufferIndex_current);
                        let span = document.createElement('span');
                        EDI_textElement.children[ringBufferIndex_current].appendChild(span);

                        let lineDiv = EDI_textElement.children[ringBufferIndex_current];
                        w_div = lineDiv;
                        INTS[fEDI_w_indexSpan] = 0;
                        w_span = lineDiv.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_Goal] = 0;
                        INTS[fEDI_w_indexColumn_Sum] = 0;
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                        INTS[fEDI_cursor_indexLine]++;
                        INTS[fEDI_cursor_indexColumn] = 0;
                        INTS[fEDI_cursorVisualColumnIndex] = 0;
                        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;
                        last_valid_indexColumn_currentLine = 0;
                        

                        continue;
                    }
                    else { // among a line
                        // This case can only happen once at the start of the edit

                        let spanClassName = '';
                        let spanText = '';

                        if (INTS[fEDI_w_indexColumn_Goal] > 0) {
                            if (INTS[fEDI_w_indexColumn_Goal] !== INTS[fEDI_w_indexColumn_Sum] + w_span.textContent.length) {
                                let firstText = w_span.textContent.substring(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]);
                                let lastText = w_span.textContent.substring(INTS[fEDI_w_indexColumn_SpanTextContentRelative]);
                                last_valid_indexColumn_currentLine = lastText.length;
                                w_span.textContent = firstText;
                                spanText += lastText; // This might NOT have to be +=, but it is due to the enter key method having needed += and this continues the pattern.
                                if (shouldPreserveCssClassWhenSplittingAmongLine) {
                                    spanClassName = w_span.className;
                                }
                            }
                        }

                        ringBufferIndex_current = (ringBufferIndex_current + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];

                        EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, ringBufferIndex_current);

                        let aaa = EDI_textElement.children[ringBufferIndex_current];
                        let span = document.createElement('span');
                        span.className = spanClassName;
                        span.textContent = spanText;
                        aaa.appendChild(span);

                        let rememberIndex = INTS[fEDI_w_indexSpan] + 1;
                        let rememberLength = w_div.children.length;
                        for (let i = rememberIndex; i < rememberLength; i++) {
                            aaa.appendChild(w_div.children[rememberIndex]);
                        }

                        let lineDiv = EDI_textElement.children[ringBufferIndex_current];
                        w_div = lineDiv;
                        INTS[fEDI_w_indexSpan] = 0;
                        w_span = lineDiv.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_Goal] = 0;
                        INTS[fEDI_w_indexColumn_Sum] = 0;
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                        INTS[fEDI_cursor_indexLine]++;
                        INTS[fEDI_cursor_indexColumn] = 0;
                        INTS[fEDI_cursorVisualColumnIndex] = 0;
                        INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]++;
                        // last_valid_indexColumn_currentLine is being set when splitting the text.

                        continue;
                    }
                }
            }

            linefeedLength = 0;
        }

        function EDI_duplicate_and_paste_writeWord(wordLength, word) {
            w_span.textContent = 
                w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) +
                word +
                w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative]);

            INTS[fEDI_cursor_indexColumn] += wordLength;
            INTS[fEDI_cursorVisualColumnIndex] += wordLength;
            INTS[fEDI_w_indexColumn_SpanTextContentRelative] += wordLength;
        }
    }
}

/**
 * @param {*} content 
 */
function EDI_paste(content) {
    let positionIndex = EDI_getPositionIndex_cursor();

    INTS[fEDI_cursor_editPosition] = positionIndex;
    INTS[fEDI_cursor_editIndexLine] = INTS[fEDI_cursor_indexLine];
    INTS[fEDI_cursor_editIndexColumn] = INTS[fEDI_cursor_indexColumn];

    EDI_cursor_EDI_paste_clipboardContent = content;

    // TODO: Consider having this string available rather than making it everytime this function is invoked.
    let EDI_on_tab_string = '';
    for (let i = 0; i < EDI_on_tab_bytes.length; i++) {
        EDI_on_tab_string += String.fromCharCode(EDI_on_tab_bytes[i]);
    }

    // for generating tabs of some count
    let stringBuilderArray = [];

    let linesInsertedCount = 0;
    let insertionLength = 0;

    /** is a 0 based index, inclusive */
    let wordStart = 0;
    let wordLength = 0;

    // Consider '\t\0\0\0'
    let tabLength = 0;
    let previouslyGeneratedTabString_value = null;
    let previouslyGeneratedTabString_tabLengthThatWasUsed = 0;

    // Consider '\r\n' and etc...
    let linefeedLength = 0;

    // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
    let ringBufferIndex_current = INTS[fEDI_cursor_indexLine] - INTS[fEDI_virtualIndexLine];
    if (ringBufferIndex_current >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_current < 0) ringBufferIndex_current = -1;
    else ringBufferIndex_current = (ringBufferIndex_current + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

    // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
    let ringBufferIndex_first = INTS[fEDI_virtualIndexLine] - INTS[fEDI_virtualIndexLine];
    if (ringBufferIndex_first >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_first < 0) ringBufferIndex_first = -1;
    else ringBufferIndex_first = (ringBufferIndex_first + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

    // TODO: Use PREVIOUS here from 'ringBufferIndex_first'
    
    // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
    let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
    if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
    else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

    let last_valid_indexColumn_currentLine = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);

    // TODO: An optimization to check whether you even need to redraw any lines perhaps is possible but it would add too much complexity at the moment and so it isn't being considered...
    // ...i.e.: if you're inserting so many lines that you know you'll scroll or that only a small amount of lines need to be redrawn due to predicting a scroll event.

    let shouldPreserveCssClassWhenSplittingAmongLine = false;
    let hasSeenLinefeed = false;

    //let original_indexColumn_SpanTextContentRelative = INTS[fEDI_w_indexColumn_SpanTextContentRelative];
    //let original_span_textContent_length = w_span.textContent.length;
    //let original_tracked_syntax_start = positionIndex - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum];

    for (var sourceI = 0; sourceI < content.length; sourceI++) {
        switch (content.charCodeAt(sourceI)) {
            case CONST_EDI_ASCII_LINE_FEED:
                //
                if (wordLength > 0) {
                    //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
                    last_valid_indexColumn_currentLine += wordLength;
                    wordStart = 0;
                    wordLength = 0;
                }
                //else if (tabLength > 0) writeTab();
                //
                insertionLength++;
                linesInsertedCount++;
                //
                linefeedLength++;
                break;
            case 13 /* carriage return '\r' */:
                //
                if (wordLength > 0) {
                    //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
                    last_valid_indexColumn_currentLine += wordLength;
                    wordStart = 0;
                    wordLength = 0;
                }
                //else if (tabLength > 0) writeTab();
                //
                if (sourceI < content.length - 1 && content.charCodeAt(sourceI + 1) === CONST_EDI_ASCII_LINE_FEED) {
                    sourceI++;
                }
                insertionLength++;
                linesInsertedCount++;
                //
                linefeedLength++;
                break;
            case CONST_EDI_ASCII_TAB:
                //
                if (wordLength > 0) {
                    //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
                    last_valid_indexColumn_currentLine += wordLength;
                    wordStart = 0;
                    wordLength = 0;
                }
                //else if (linefeedLength > 0) writeLinefeed();
                // TODO: Extremely important next line but it doesn't fully pattern with every case so it is somewhat out of nowhere
                // TODO: This is nonsensical you cannot numerically compare a ringBuffer index because the zeroth index isn't necessarily 0
                if (ringBufferIndex_current > ringBufferIndex_last) return;
                //
                insertionLength += 4;
                //
                tabLength++;
                break;
            default:
                //
                //if (tabLength > 0) writeTab();
                //else if (linefeedLength > 0) writeLinefeed();
                // TODO: Extremely important next line but it doesn't fully pattern with every case so it is somewhat out of nowhere
                // TODO: This is nonsensical you cannot numerically compare a ringBuffer index because the zeroth index isn't necessarily 0
                if (ringBufferIndex_current > ringBufferIndex_last) return;
                //
                insertionLength++;
                //
                if (wordLength === 0) {
                    wordStart = sourceI;
                }
                wordLength++;
                break;
        }
    }

    if (wordLength > 0) {
        //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
        last_valid_indexColumn_currentLine += wordLength;
        wordStart = 0;
        wordLength = 0;
    }
    //else if (tabLength > 0) writeTab();
    //else if (linefeedLength > 0) writeLinefeed();

    if (linesInsertedCount > 0) {
        update_verticalVirtualizationBoundary(EDI_lineEndPositionList_count + linesInsertedCount);
        // I uncommented this, it isn't doing what I want it to.
        // I'm just gonna be done for now.
        // TODO: draw gutter?
    }

    // TODO: The previous render logic was actually moving the cursor as well. Just something to keep in mind, you might see a bug related to this.
    EDI_render_request(RenderKind_DuplicateOrPaste);
}

/**
 * @returns {boolean} 'shouldPreserveCssClassWhenSplittingAmongLine'
 */
function EDI_duplicate_and_paste_handleNotHasSeenLinefeed(hasSeenLinefeed, original_indexColumn_SpanTextContentRelative, original_span_textContent_length, indexPosition) {
    // The only way to invoke this is if you encountered a linefeed for the first time,
    // therefore 'w_span' is the original span and no variable for the original needs to be made.
    // (unless in the future you don't end up using the w_span in some way or etc...)
    //
    hasSeenLinefeed = true;
    switch (w_span.className) {
        case 'eCm':
            if (original_indexColumn_SpanTextContentRelative >= 2 && (original_indexColumn_SpanTextContentRelative <= original_span_textContent_length - 2)) {
                w_span.className = 'eCM';
                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_Comment, indexPosition - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum], original_span_textContent_length);
                return true;
            }
            return false;
        case 'eCM':
            return true;
        case 'eSm':
            if (original_indexColumn_SpanTextContentRelative >= 1 && (original_indexColumn_SpanTextContentRelative <= original_span_textContent_length - 1)) {
                w_span.className = 'eSM';
                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_String, indexPosition - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum], original_span_textContent_length);
                return true;
            }
            return false;
        case 'eSM':
            return true;
        default:
            return false;
    }
}

function EDI_render_do_TabKey() {
    if (INTS[fEDI_cursor_editKind] !== EditKind_Tab) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength] || INTS[fEDI_cursor_editKind] === EditKind_Tab) {

        // TODO: 'fEDI_cursor_editRenderedDisplacement' here and check other render_do's

        INTS[fEDI_cursor_indexColumn] -= EDI_on_tab_bytes.length; // awkward thing to have 'walkLineUntilIndexColumn' invocation work then at end of block I '+= EDI_on_tab_bytes.length'.

        walkLineUntilIndexColumn();

        if (!w_span || !w_div) {
            // TODO: silent error bad
            return;
        }

        // TODO: Consider having this string available rather than making it everytime this function is invoked.
        // TODO: This is bad (there's many other ways to get this as a string: decoder, caching of a hardcoded string?, ???)
        //
        let EDI_on_tab_string = '';
        for (let i = 0; i < EDI_on_tab_bytes.length; i++) {
            EDI_on_tab_string += String.fromCharCode(EDI_on_tab_bytes[i]);
        }

        w_span.textContent = 
            w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) +
            EDI_on_tab_string +
            w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative]);

        INTS[fEDI_cursor_indexColumn] += EDI_on_tab_bytes.length; // awkward thing to have 'walkLineUntilIndexColumn' invocation work then at end of block I '+= EDI_on_tab_bytes.length'.
    }
}

function EDI_tabKey() {

    if (INTS[fEDI_cursor_editLength] === 0) {
        INTS[fEDI_cursor_editPosition] = EDI_getPositionIndex_cursor();
        INTS[fEDI_cursor_editIndexLine] = INTS[fEDI_cursor_indexLine];
        INTS[fEDI_cursor_editIndexColumn] = INTS[fEDI_cursor_indexColumn];
    }

    INTS[fEDI_cursor_editLength]++;

    // TODO: I probably don't want these if else statements in here long term.
    if (EDI_on_tab_bytes.length === 4) {
        // 4 space characters are being inserted.
        INTS[fEDI_cursorVisualColumnIndex] += EDI_on_tab_bytes.length;
    }
    else {
        // 1 tab character ('\t') is being inserted
        // thus match visual width of the insertion to the next tab-stop.

        // Tab Length (L) = 4 - (col (mod 4));
        let tabLengthL = 4 - (INTS[fEDI_cursor_indexColumn] % 4);
        INTS[fEDI_cursorVisualColumnIndex] += tabLengthL;
    }

    INTS[fEDI_cursor_indexColumn] += EDI_on_tab_bytes.length; // this has to come after the 'walkLineUntilIndexColumn' invocation.
    //INTS[fEDI_cursorVisualColumnIndex] += EDI_on_tab_bytes.length * INTS[fEDI_ontab_visualWidth_perCharacter];
    // I say 'uhhhh' cause I'm trying to get an obvious case to work and it isn't working entirely and I'm so tired so just like "uhhhhhhhhh"
    // oh wait lol tab-stops

    EDI_render_request(RenderKind_TabKey);
}

/**
 * @returns the COLUMN index that exclusively ends the indentation.
 */
function EDI_findEndExclusiveIndentationIndexColumn() {
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
    EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
    const line_start = INTS[fEDI_getLineBoundaryPositions_start];

    for (var i = 0; i < lastValidIndexColumn; i++) {
        let c = getCharacter(line_start + i);
        switch (c) {
            case ' ':
            case '\t':
                break;
            default:
                return i;
        }
    }

    return 0;
}

/**
 * If a line has an indentation of 4 space characters, but the user's cursor is positioned after the second space character,
 * then only the first 2 space characters will be used as indentation.
 * 
 * This is intentional, it seems like the more expected behavior in my mind.
 *
 * @returns 
 */
function EDI_cacheIndentation() {
    EDI_cursor_enterKey_newLinePlusIndentation_byteList = new ByteList(32);
    EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, CONST_EDI_ASCII_LINE_FEED);
    let indentationBuilder = [];
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
    EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
    const line_start = INTS[fEDI_getLineBoundaryPositions_start];

    let upperLimitIndexColumn;

    if (lastValidIndexColumn > INTS[fEDI_cursor_indexColumn]) {
        upperLimitIndexColumn = INTS[fEDI_cursor_indexColumn];
    }
    else {
        upperLimitIndexColumn = lastValidIndexColumn;
    }

    outer: for (var i = 0; i < upperLimitIndexColumn; i++) {
        let c = getCharacter(line_start + i);
        switch (c) {
            case ' ':
                EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, CONST_EDI_ASCII_SPACE);
                indentationBuilder.push(c);
                break;
            case '\t':
                EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, CONST_EDI_ASCII_TAB);
                indentationBuilder.push(c);
                break;
            default:
                break outer;
        }
    }

    EDI_cursor_cached_indentation_string = indentationBuilder.join('');
}

function EDI_lineWasInsertedValidateGutter() {
    if (EDI_drawGutter_Width()) {
        // If true then you need to also draw the dependent UI
        EDI_render_request(RenderKind_Cursor_n);
        EDI_drawHorizontalScrollbar();
    }
}

/**
 * TODO: This uses a linear search and likely can be optimized.
 * 
 * @param {*} indexPosition 
 * @param {*} insertionCount 
 */
function EDI_trackedSyntaxList_inefficientUpdateStartAndLength(indexPosition, insertionCount) {
    for (var i = 0; i < EDI_trackedSyntaxList.count_abstract; i++) {
        EDI_trackedSyntaxList.getElementAt(i);
        if (indexPosition <= INTS[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, INTS[fEDI_pooledTrackedSyntax_start] + insertionCount);
        }
        else if (indexPosition > INTS[fEDI_pooledTrackedSyntax_start] && indexPosition < INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, INTS[fEDI_pooledTrackedSyntax_length] + insertionCount);
        }
    }
}

function EDI_render_do_EnterKey() {
    update_verticalVirtualizationBoundary();

    if (INTS[fEDI_cursor_editKind] !== EditKind_Enter) {
        return;
    }

    // you're missing either a:
    // - for loop
    // - or preferably a shift by some count other than just one
    //
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLineFeedCount]) {

        // TODO: This is missing a loop or etc... as was also stated elsewhere.
        // ...
        // Thus 'INTS[fEDI_cursor_editRenderedDisplacement]' is being incremented by 1 only.
        // i.e.: This is wrong because if more than one enter key event was rendered as an edit length > 1 there's probably gonna be a rendering issue
        // and the invocation of 'EDI_render_do_EnterKey' from finalize edit will cause confusion because a length of 2 could pass given certain timing of events.
        //
        INTS[fEDI_cursor_editRenderedDisplacement]++;

        // TODO: You're gonna have to tighten the virtualization logic?

        // TODO: This 'ringBufferIndex_firstTilde' is maybe correct I don't know but it's been a long time since I wrote this line of code, and glancing at it, it looks like you need to subtract 1?

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_firstTilde = EDI_lineEndPositionList_count - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_firstTilde >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_firstTilde < 0) ringBufferIndex_firstTilde = -1;
        else ringBufferIndex_firstTilde = (ringBufferIndex_firstTilde + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        if (ringBufferIndex_firstTilde >= 0) {
            EDI_gutter.children[ringBufferIndex_firstTilde].textContent = EDI_lineEndPositionList_count + 1;
        }
        
        let shouldRenderEntireViewport = false;

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_current = INTS[fEDI_cursor_editIndexLine] - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_current >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_current < 0) ringBufferIndex_current = -1;
        else ringBufferIndex_current = (ringBufferIndex_current + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        if (ringBufferIndex_current < 0)
            shouldRenderEntireViewport = true;

        // There are some cases that I don't feel like thinking about at the moment, this if statement singles them out.
        if (INTS[fEDI_virtualCount] <= 1 || EDI_textElement.children.length !== INTS[fEDI_virtualCount])
            shouldRenderEntireViewport = true;

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_first = INTS[fEDI_virtualIndexLine] - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_first >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_first < 0) ringBufferIndex_first = -1;
        else ringBufferIndex_first = (ringBufferIndex_first + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        // TODO: Use PREVIOUS here from 'ringBufferIndex_first'

        // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
        let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
        if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
        else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

        // TODO: reminder for when virtualization padding is improved, this function might need to be looked at.
        // TODO: Track the enter keystroke the same as any other insertion edit and have it pending until it needs to be finalized.

        // 4 cases:
        // - "start of line":
        // - "end of line":
        // - "among a line":
        // - "fallback case": this last case is a fallback case and redraws the entire viewport in the case that the UI is in an "unpredictable state" and cannot be optimally redrawn in a smaller more specific redraw.

        // consider using 'BYTES[byteEDI_cursor_enterKeyEventKind]' for the 'render'?

        // Is holding down ctrl+enter / shift+enter batchable?

        if (!shouldRenderEntireViewport && INTS[fEDI_cursor_editIndexColumn] === 0) { // start of line
            EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, ringBufferIndex_current);
            EDI_textElement.children[ringBufferIndex_current].appendChild(document.createElement('span'));

            EDI_lineWasInsertedValidateGutter();
            return;
        }
        else {
            if (!shouldRenderEntireViewport) {
                // ensure this conditional branch returns if handled, otherwise it will execute the fallback case erroneously
                let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_editIndexLine]);

                if (lastValidIndexColumn === INTS[fEDI_cursor_editIndexColumn]) { // end of line
                    
                    let next_ringBufferIndex = (ringBufferIndex_current + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];

                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, next_ringBufferIndex);
                    let span = document.createElement('span');
                    span.textContent = EDI_cursor_cached_indentation_string;
                    EDI_textElement.children[next_ringBufferIndex].appendChild(span);

                    EDI_lineWasInsertedValidateGutter();
                    return;
                }
                else { // among a line


                    // among a line uses 'walkLineUntilIndexColumn', this function takes a cursor and accesses the fields: 'indexLine', and 'indexColumn'.
                    // This is problematic because one needs to use INTS[fEDI_cursor_editIndexColumn] for this renderKind.
                    // Since only this case needs the logic I'm going to isolate it to here.
                    //
                    // Remember 'indexLine', and 'indexColumn'.
                    // Set them to the edit respective fields.
                    // Prior to returning from this function restore the original 'indexLine', and 'indexColumn'.

                    let remember_cursorIndexLine = INTS[fEDI_cursor_indexLine];
                    let remember_cursorIndexColumn = INTS[fEDI_cursor_indexColumn];

                    INTS[fEDI_cursor_indexLine] = INTS[fEDI_cursor_editIndexLine];
                    INTS[fEDI_cursor_indexColumn] = INTS[fEDI_cursor_editIndexColumn];

                    let spanClassName = '';
                    let spanText = EDI_cursor_cached_indentation_string;

                    walkLineUntilIndexColumn();

                    let shouldPreserveCssClassWhenSplittingAmongLine = false;
                    
                    switch (w_span.className) {
                        case 'eCm':
                            if (INTS[fEDI_w_indexColumn_SpanTextContentRelative] >= 2 && (INTS[fEDI_w_indexColumn_SpanTextContentRelative] <= w_span.textContent.length - 2)) {
                                w_span.className = 'eCM';
                                let indexPosition = EDI_getPositionIndex_raw_cursor();
                                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_Comment, indexPosition - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum], w_span.textContent.length);
                                shouldPreserveCssClassWhenSplittingAmongLine = true;
                            }
                            break;
                        case 'eCM':
                            shouldPreserveCssClassWhenSplittingAmongLine = true;
                            break;
                        case 'eSm':
                            if (INTS[fEDI_w_indexColumn_SpanTextContentRelative] >= 1 && (INTS[fEDI_w_indexColumn_SpanTextContentRelative] <= w_span.textContent.length - 1)) {
                                w_span.className = 'eSM';
                                let indexPosition = EDI_getPositionIndex_raw_cursor();
                                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_String, indexPosition - INTS[fEDI_cursor_indexColumn] + INTS[fEDI_w_indexColumn_Sum], w_span.textContent.length);
                                shouldPreserveCssClassWhenSplittingAmongLine = true;
                            }
                            break;
                        case 'eSM':
                            shouldPreserveCssClassWhenSplittingAmongLine = true;
                            break;
                    }
                    
                    if (INTS[fEDI_w_indexColumn_Goal] > 0) {
                        if (INTS[fEDI_w_indexColumn_Goal] !== INTS[fEDI_w_indexColumn_Sum] + w_span.textContent.length) {
                            let firstText = w_span.textContent.substring(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]);
                            let lastText = w_span.textContent.substring(INTS[fEDI_w_indexColumn_SpanTextContentRelative]);
                            w_span.textContent = firstText;
                            spanText += lastText; // += due to the possibility of indentation
                            if (shouldPreserveCssClassWhenSplittingAmongLine) {
                                spanClassName = w_span.className;
                            }
                        }
                    }

                    let next_ringBufferIndex = (INTS[fEDI_w_ringBufferIndex] + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];

                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, next_ringBufferIndex);

                    let aaa = EDI_textElement.children[next_ringBufferIndex];
                    let span = document.createElement('span');
                    span.className = spanClassName;
                    span.textContent = spanText;
                    aaa.appendChild(span);

                    let rememberIndex = INTS[fEDI_w_indexSpan] + 1;
                    let rememberLength = w_div.children.length;
                    for (let i = rememberIndex; i < rememberLength; i++) {
                        aaa.appendChild(w_div.children[rememberIndex]);
                    }

                    EDI_lineWasInsertedValidateGutter();

                    INTS[fEDI_cursor_indexLine] = remember_cursorIndexLine;
                    INTS[fEDI_cursor_indexColumn] = remember_cursorIndexColumn;
                    return;
                }
            }
        }

        // fallback case : implicit fallback case; TODO: why did I have to add a comment for this? ("implicit fallback case;" wasn't originally here I just wrote it myself)
    }
}

/**
 * @param {boolean} ctrlKey 
 * @param {boolean} shiftKey 
 * @returns 
 * 
 * The batching logic is a pattern of (for this function):
 *     if (INTS[fEDI_cursor_editLength] === 0) {...}
 * 
 * 3 cases:
 * - "start of line":
 * - "end of line":
 * - "among a line":
 */
function EDI_EnterKey(ctrlKey, shiftKey) {
    if (!EDI_cursor_enterKey_newLinePlusIndentation_byteList)
        EDI_cacheIndentation();

    if (ctrlKey) {
        INTS[fEDI_cursor_indexColumn] = 0;
        INTS[fEDI_cursorVisualColumnIndex] = 0;
    }
    else if (shiftKey) {
        INTS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
        INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_indexColumn];
    }

    if (INTS[fEDI_cursor_editLength] === 0) {

        BYTES[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_None;

        INTS[fEDI_cursor_editPosition] = EDI_getPositionIndex_raw_cursor();
        INTS[fEDI_cursor_editIndexLine] = INTS[fEDI_cursor_indexLine];
        INTS[fEDI_cursor_editIndexColumn] = INTS[fEDI_cursor_indexColumn];
    }

    let insertionCount = EDI_cursor_enterKey_newLinePlusIndentation_byteList.count;
    
    if (INTS[fEDI_cursor_indexColumn] === 0) { // start of line
        if (BYTES[byteEDI_cursor_enterKeyEventKind] === 0) {
            BYTES[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_StartOfLine;
        }

        if (!ctrlKey)
            INTS[fEDI_cursor_indexLine]++;
    }
    else {
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);

        if (BYTES[byteEDI_cursor_enterKeyEventKind] === 0) {
            BYTES[byteEDI_cursor_enterKeyEventKind] = lastValidIndexColumn === INTS[fEDI_cursor_indexColumn]
                ? EnterKeyEventKind_EndOfLine
                : EnterKeyEventKind_AmongALine;
        }
        
        INTS[fEDI_cursor_indexLine]++;
    }

    INTS[fEDI_cursor_indexColumn] = insertionCount - 1;
    INTS[fEDI_cursorVisualColumnIndex] = insertionCount - 1;
    INTS[fEDI_cursor_editLength] += insertionCount;
    INTS[fEDI_cursor_editLineFeedCount]++;

    INTS[fEDI_cursor_END_editIndexLine] = INTS[fEDI_cursor_indexLine];
    INTS[fEDI_cursor_END_editIndexColumn] = INTS[fEDI_cursor_indexColumn];

    EDI_render_request(RenderKind_Enter);
}

/**
 * CORRUPT_STATE: The invoker needs to ensure there is at least one empty span on the 'inclusiveSmallestRingBufferIndexToShift' after they invoke this function.
 * 
 * TODO: implement this but by an arbitrary distance
 */
function EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(ringBufferIndex_last, inclusiveSmallestRingBufferIndexToShift) {
    // TODO: This remove logic for the last line wasn't written with the correct understanding...
    // ...
    // It appears that this logic for 99% of cases is NOT needed.
    // But that if you:
    // - "Were at ringBuffer index zero" (I'm not sure what I'm thinking by this I need to focus on my task at hand but this edge case is being slightly-considered in my mind while typing this)
    //     - I think the correct wording is if you were at 'PREVIOUS(ringBuffer_indexZero)' then you'd be the last line
    //     - i.e.: if 'ringBufferIndex_last === inclusiveSmallestRingBufferIndexToShift'
    // - for some reason only had a virtualization count of '1',
    // you might need to run this logic otherwise an enter key at column index 0 of a line wouldn't show any changes.
    // 
    let local_ArrayFrom_textElement_children_length = INTS[fEDI_ArrayFrom_textElement_children_length];

    let lastDiv = EDI_textElement.children[ringBufferIndex_last];
    for (let i = lastDiv.children.length - 1; i >= 0; i--) {
        lastDiv.removeChild(lastDiv.children[i]);
    }

    for (let i = ringBufferIndex_last; i !== inclusiveSmallestRingBufferIndexToShift;) {
        let destinationDiv = EDI_textElement.children[i];
        i = (i - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;
        let sourceDiv = EDI_textElement.children[i];
        destinationDiv.replaceChildren(...sourceDiv.childNodes);
    }
}

/**
 * 'smallestRingBufferIndexToReceive' somewhat 'exclusive' in that it doesn't get shifted. It is the smallest line that receives the shift of the next line, and thus all content on this line is lost in the process.
 * 
 * TODO: an idea that you might be able to short circuit if you start shifting 'out of bounds lines of text' into 'out of bounds lines of text'?
 * */
function EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(ringBufferIndex_last, smallestRingBufferIndexToReceive, distance, local_virtualIndexLine, local_virtualCount) {

    // TODO: Does 'coalesce assignment' exist, and is it equivalent?
    if (!local_virtualIndexLine) local_virtualIndexLine = INTS[fEDI_virtualIndexLine];
    if (!local_virtualCount) local_virtualCount = INTS[fEDI_virtualCount];

    // TODO: if smallestRingBufferIndexToReceive < 0 throw an error?

    let local_ArrayFrom_textElement_children_length = INTS[fEDI_ArrayFrom_textElement_children_length];

    let breakingPoint = ringBufferIndex_last;
    for (let i = 1 /*starts at one*/; i < distance; i++) {
        breakingPoint = (breakingPoint - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;
    }

    for (let destinationIndex = smallestRingBufferIndexToReceive; destinationIndex !== breakingPoint;) {
        let destinationDiv = EDI_textElement.children[destinationIndex];
        let sourceIndex = destinationIndex;
        for (let i = 0; i < distance; i++) {
            sourceIndex = (sourceIndex + 1) % local_ArrayFrom_textElement_children_length;
        }
        destinationDiv.replaceChildren(...EDI_textElement.children[sourceIndex].childNodes);
        if (EDI_gutter.children[sourceIndex].textContent === '~') {
            EDI_gutter.children[destinationIndex].textContent = '~';
        }
        destinationIndex = (destinationIndex + 1) % local_ArrayFrom_textElement_children_length;
    }

    let ringBufferIndex = breakingPoint;
    for (let i = 0; ; i++) {
        EDI_drawLine(local_virtualIndexLine + local_virtualCount - (distance - i), EDI_gutter.children[ringBufferIndex], EDI_textElement.children[ringBufferIndex]);
        if (ringBufferIndex === ringBufferIndex_last) break; // awkward positioning of this break, it seems somewhat necessary but need to take time to read the code further and try to have it moved somewhere more sensible.
        ringBufferIndex = (ringBufferIndex + 1) % local_ArrayFrom_textElement_children_length;
    }
}

function EDI_render_do_Resize(timestamp) {
    EDI_baseElement.style.width = '';
    EDI_baseElement.style.height = '';
    EDI_baseElement.style.contain = '';

    EDI_measureBaseElement();

    let remember_virtualCount = INTS[fEDI_virtualCount];
    update_virtualCount();
    if (INTS[fEDI_virtualCount] !== remember_virtualCount) {
        // why 'update_verticalVirtualizationBoundary' here???
        update_verticalVirtualizationBoundary(EDI_lineEndPositionList_count + 1);

        INTS[fEDI_intFalsey_isScrolling] = 0;

        INTS[fEDI_scrollEndDeadline] = timestamp + 1000;

        EDI_render_do_Scroll(timestamp); //EDI_onScroll_WRAPIT();
        // # Redraw cursor selection virtualization
        // Code Duplication: # Redraw cursor selection virtualization... TODO: This is using 'EDI_primaryCursor' rather than 'EDI_cursorList[i]' so it is surely incorrect?
        EDI_createStyleForSelection();
    }

    set_EDI_recentBoundingClientRect_isNull_intFalsey(1);

    EDI_drawHorizontalScrollbar();
}

function EDI_onResize() {
    EDI_render_request(RenderKind_Resize);
}

// 1. The Entry Point (Replaces WRAPIT)
function EDI_onResize_WRAPIT() {
    // If timer is running, just note that a trailing call is needed
    if (INTS[fEDI_onResize_timer]) {
        BYTES[byteEDI_onResize_hasTrailingCall] = 1;
        return;
    }

    // Leading edge: Execute immediately
    EDI_onResize();

    // Start the throttle window
    EDI_onResize_startThrottleTimeout();
}

// 2. The Gatekeeper
function EDI_onResize_startThrottleTimeout() {
    INTS[fEDI_onResize_timer] = setTimeout(() => {
        if (BYTES[byteEDI_onResize_hasTrailingCall]) {
            BYTES[byteEDI_onResize_hasTrailingCall] = 0;
            EDI_onResize();
            
            EDI_onResize_startThrottleTimeout();
        } else {
            INTS[fEDI_onResize_timer] = 0;
        }
    }, 500);
}

/**
 * See comment above 'EXPLORER_measureBaseElement'
 * for explanation why this code is a bad idea.
 * 
 * I can't get rid of it because I don't fully understand my mistake yet.
 * When I get around to it I'm gonna end up looking into this more.
 */
function EDI_measureBaseElement() {
    INTS[fEDI_lastReadNumber_offsetWidth] = Math.floor(EDI_baseElement.offsetWidth);
    INTS[fEDI_lastReadNumber_offsetHeight] = Math.floor(EDI_baseElement.offsetHeight);
    
    EDI_baseElement.style.width = INTS[fEDI_lastReadNumber_offsetWidth] + 'px';
    EDI_baseElement.style.height = INTS[fEDI_lastReadNumber_offsetHeight] + 'px';

    EDI_baseElement.style.contain = 'layout';

    INTS[fEDI_lastReadNumber_offsetWidth] = EDI_baseElement.offsetWidth;
    INTS[fEDI_lastReadNumber_offsetHeight] = EDI_baseElement.offsetHeight;

/*
> what does css "contain = 'layout'" do

< ...
< The CSS declaration contain: layout isolates the internal layout of an element from the rest of the web page, ensuring that changes inside the element do not trigger layout calculations outside of it, and vice versa
< ...

< ...
< Independent Layout Trees: The browser treats the element as an isolated layout island. If JavaScript alters content or styles inside this element, the browser only recalculates the layout for this specific subtree rather than reflowing the entire document
< ...
< New Stacking Context: A new stacking context is generated. Any z-index properties used on child elements are completely scoped to this element and will not interact with elements outside of it.
< ...

I think I agree with this all... That's why I added it originally.
I'm modifying the content and stacking context is good for all the absolute positioning I can ensure to the browser that nothing will happen?
The AI code drops it so I gotta watch out perhaps not to just paste that over.

But if I truly added it for these reasons, why did I not add it to the TreeView which is similar.
And if the answer to that is just "lots of things to do".
Then, "would you add it now?"
"are you really sure that this is useful?"

and I don't know...


< function EDI_measureBaseElement() {
<     // 1. Read once, accurately capturing subpixels
<     const rect = EDI_baseElement.getBoundingClientRect();
<     
<     INTS[fEDI_lastReadNumber_offsetWidth] = rect.width;
<     INTS[fEDI_lastReadNumber_offsetHeight] = rect.height;
< 
<     // 2. Calculate lines safely without modifying the DOM
<     const rawLineCount = INTS[fEDI_lastReadNumber_offsetHeight] / KNOWN_LINE_HEIGHT;
<     
<     // Math.floor gives you ONLY fully visible lines
<     const fullyVisibleLines = Math.floor(rawLineCount); 
<     
<     // Math.ceil includes a line even if it is partially cut off at the bottom
<     const totalRenderedLines = Math.ceil(rawLineCount); 
< }

> When it comes to the 'Floor Trap'.
> 
> What if I had my current code, but I just didn't read after setting the floored values.
> 
> The reason I did the read was because I feared that "some boogieman" might cause my setting of the attribute value to 500px,
> that this would be ignored for some reason that I'm not aware of and perhaps be taken as 501px due to some obscure piece of information that
> I don't understand. It is just superstitious reading of the value.

< no response

:( I can probably reword that lol

wtf is going on

I said

> When it comes to the 'Floor Trap'.
> 
> What if I had my current code, but I just didn't read after setting the floored values.

which was 2/3rd of the previous prompt.

And then I got response of

< If you keep your current code but completely remove that second read, you successfully eliminate the second layout calculation. That is a great performance win!
< 
< However, your superstitious fear about the "boogieman" changing 500px to 501px is actually technically justified—though not for the reason you think. The real boogieman isn't a browser bug; it is display scaling (like a 125% zoom on a laptop, or a high-DPI Retina screen).
<
< ...
<
< The Scaling Boogieman is Real
< ...

*/
}

/**
 * TODO: This function uses 'EDI_getLineAndColumnIndices' but it needs to be raw.
 * 
 * @returns 
 */
function EDI_removeSelection() {
    if (INTS[fEDI_cursor_editKind] != EditKind_None) {
        // TODO: multicursor confusion scenario is likely to happy due to this code, but the code isn't related enough for me to change it yet.
        EDI_finalizeEdit();
    }

    let smallPosition;
    let largePosition;
    if (INTS[fEDI_cursor_selectionAnchor] < INTS[fEDI_cursor_selectionEnd]) {
        smallPosition = INTS[fEDI_cursor_selectionAnchor];
        largePosition = INTS[fEDI_cursor_selectionEnd];
    }
    else {
        smallPosition = INTS[fEDI_cursor_selectionEnd];
        largePosition = INTS[fEDI_cursor_selectionAnchor];
    }

    INTS[fEDI_EDI_RemoveSelection_smallPosition] = smallPosition;
    INTS[fEDI_EDI_RemoveSelection_largePosition] = largePosition;

    INTS[fEDI_cursor_selectionAnchor] = 0;
    INTS[fEDI_cursor_selectionEnd] = 0;

    let editLength = largePosition - smallPosition;
    // editLength is 0 in this ...startEdit invocation intentionally, you cannot set the editLength until the end (TODO: remember what the exact reason was and put it here... I think it was because 'EDI_readLineEndPositionList' function is used rather than reading directly)
    EDI_startEdit(EditKind_RemoveTextNoBatching, smallPosition, /*editLength*/ 0);

    EDI_getLineAndColumnIndices(smallPosition);
    let smallLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    let smallLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    INTS[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine] = smallLineAndColumnIndices_indexLine;
    INTS[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn] = smallLineAndColumnIndices_indexColumn;
    // TODO: Why is this set twice (seemingly redundantly) #EDI_removeSelection() (1 of 2)
    INTS[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_editIndexLine] = smallLineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_editIndexColumn] = smallLineAndColumnIndices_indexColumn;

    EDI_getLineAndColumnIndices(largePosition);
    let largeLineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    let largeLineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    INTS[fEDI_cursor_END_editIndexLine] = largeLineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_END_editIndexColumn] = largeLineAndColumnIndices_indexColumn;

    // TODO: Why is this set twice (seemingly redundantly) #EDI_removeSelection() (2 of 2)
    INTS[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
    INTS[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnIndices_indexColumn;
    INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnIndices_indexLine;

    INTS[fEDI_cursor_editLength] = editLength;
    
    INTS[fEDI_cursor_STORED_indexColumn] = INTS[fEDI_cursor_indexColumn];

    EDI_render_request(RenderKind_RemoveSelection);
}

function EDI_render_do_RemoveSelection() {
    let smallPosition = INTS[fEDI_EDI_RemoveSelection_smallPosition];
    let largePosition = INTS[fEDI_EDI_RemoveSelection_largePosition];

    let editLength = largePosition - smallPosition;

    let smallLineAndColumnIndices_indexLine = INTS[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine];
    let smallLineAndColumnIndices_indexColumn = INTS[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn];

    ///////////
    ///////////

    if (INTS[fEDI_cursor_editKind] !== EditKind_RemoveTextNoBatching) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        let original_edit_length = INTS[fEDI_cursor_editLength];
        INTS[fEDI_cursor_editLength] = 0;

        let indexTrackedSyntax = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(INTS[fEDI_cursor_indexLine]);
        if (indexTrackedSyntax === NaN || indexTrackedSyntax === -1) {
            indexTrackedSyntax = EDI_trackedSyntaxList.count_abstract;
        }
        let possibleTrackedSyntaxToSpanSingleLine = false;
        if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
            EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
            if (INTS[fEDI_pooledTrackedSyntax_start] < EDI_lineEndPositionList_data[INTS[fEDI_cursor_indexLine]]) {
                possibleTrackedSyntaxToSpanSingleLine = true;
            }
            // TODO: This has no reason to be a for loop
            for (let i = INTS[fEDI_cursor_indexLine] - 1; i >= 0; i--) {
                let lineEndPosition = EDI_lineEndPositionList_data[i];
                if (INTS[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                    INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
                        possibleTrackedSyntaxToSpanSingleLine = false;
                        break;
                }
                else {
                    break;
                }
            }
        }

        let linesRemovedCount = 0;
        // -1 since you can't remove EOF
        for (var iVarDependent = INTS[fEDI_cursor_indexLine]; iVarDependent < EDI_lineEndPositionList_count - 1; iVarDependent++) {
            // TODO: all of these reads need to be raw for this work with multicursor just remember that for tomorrow don't worry about this right now just focus on the one task but remember this for tomorrow.
            let lineEnding = EDI_readLineEndPositionList(iVarDependent);
            if (lineEnding >= INTS[fEDI_cursor_editPosition] && lineEnding < INTS[fEDI_cursor_editPosition] + editLength) {
                linesRemovedCount++;
                INTS[fEDI_cursor_editLineFeedCount]++;
                EDI_lineEndPositionList_PENDING.insert(EDI_lineEndPositionList_PENDING.count, lineEnding);

                if (possibleTrackedSyntaxToSpanSingleLine) {
                    let NOTlineEndBelongsToSyntax;
                    if (iVarDependent >= EDI_lineEndPositionList_count)
                        NOTlineEndBelongsToSyntax = true;
                    else if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] <= EDI_lineEndPositionList_data[iVarDependent])
                        NOTlineEndBelongsToSyntax = true;
                    
                    if (NOTlineEndBelongsToSyntax) {
                        EDI_trackedSyntaxList.removeAt(indexTrackedSyntax, 1);

                        // do not increment because removed
                        possibleTrackedSyntaxToSpanSingleLine = false;
                        if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
                            EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
                            if (INTS[fEDI_pooledTrackedSyntax_start] < lineEnding &&
                                INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > lineEnding) {
                                    possibleTrackedSyntaxToSpanSingleLine = true;
                            }
                        }
                    }
                }
            }
            else {
                break;
            }
        }

        if (linesRemovedCount > 0 && possibleTrackedSyntaxToSpanSingleLine) {
            // The next line end will NOT be removed, so you need to check whether it was encompassed by the possible syntax.
            //
            // Inside the for loop you need to do this when you exhaust the encompassed line ends for a given syntax and move to the next one too.
            //
            let NOTlineEndBelongsToSyntax;
            if (iVarDependent >= EDI_lineEndPositionList_count)
                NOTlineEndBelongsToSyntax = true;
            else if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] <= EDI_lineEndPositionList_data[iVarDependent])
                NOTlineEndBelongsToSyntax = true;
            
            if (NOTlineEndBelongsToSyntax)
                EDI_trackedSyntaxList.removeAt(indexTrackedSyntax, 1);
        }

        let finalLineEndPosition = EDI_readLineEndPositionList(INTS[fEDI_cursor_indexLine] + linesRemovedCount);
        let largestDrawnIndexLine = INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1;
        let visibleLinesRemovedCount = 0;

        // 5 stages
        // ========
        // - Remove selection on large position line
        // - Remove selection on small position line
        // - Visually merge the small position line and large position line (if applicable)
        // - Remove middle line(s)
        // - 'Draw lines that came into view' / 'clear text for any lines > text length and use a '~' in the gutter'

        // Remove selection on small position line
        let smallLineDiv = null;
        {
            INTS[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;
            // TODO: this cursorVisualColumnIndex... logic here seems like it can be skipped here so long as you do it once by the end of the function to the correct indices.
            INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnIndices_indexLine;

            walkLineUntilIndexColumn();

            EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
            const line_end = INTS[fEDI_getLineBoundaryPositions_end];
            let remaining;
            if (largePosition > line_end) {
                remaining = line_end - smallPosition;
            }
            else {
                remaining = largePosition - smallPosition;
            }

            if (w_span && INTS[fEDI_w_indexColumn_SpanTextContentRelative] >= 0) {
                smallLineDiv = w_div;
                while (remaining > 0) {
                    let available = w_span.textContent.length - INTS[fEDI_w_indexColumn_SpanTextContentRelative];
                    let count = remaining > available ? available : remaining;
                    remaining -= count;    
                    
                    if (count > 0) {
                        w_span.textContent = w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                    }

                    if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                        w_div.removeChild(w_span);
                    }
                    else {
                        INTS[fEDI_w_indexSpan]++;
                    }
        
                    if (remaining > 0) {
                        if (INTS[fEDI_w_indexSpan] >= w_div.children.length) break;
                        w_span = w_div.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    }
                }
            }
        }

        // Remove selection on large position line
        let largeLineDiv = null;
        if (linesRemovedCount > 0) {
            INTS[fEDI_cursor_indexLine] = INTS[fEDI_cursor_indexLine] + linesRemovedCount;
            INTS[fEDI_cursor_indexColumn] = 0;
            // TODO: this cursorVisualColumnIndex... logic here seems like it can be skipped here so long as you do it once by the end of the function to the correct indices.
            INTS[fEDI_cursorVisualColumnIndex] = 0;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = INTS[fEDI_cursor_indexLine];

            EDI_getLineBoundaryPositions(INTS[fEDI_cursor_indexLine]);
            let remaining = largePosition - INTS[fEDI_getLineBoundaryPositions_start];

            walkLineUntilIndexColumn();

            if (w_span && INTS[fEDI_w_indexColumn_SpanTextContentRelative] >= 0) {
                largeLineDiv = w_div;
                while (remaining > 0) {
                    let available = w_span.textContent.length - INTS[fEDI_w_indexColumn_SpanTextContentRelative];
                    let count = remaining > available ? available : remaining;
                    remaining -= count;

                    if (count > 0)
                        w_span.textContent = w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative] + count);

                    if (w_div.children.length > 1 && w_span.textContent.length === 0)
                        w_div.removeChild(w_span);
                    else
                        INTS[fEDI_w_indexSpan]++;
        
                    if (remaining > 0) {
                        if (INTS[fEDI_w_indexSpan] >= w_div.children.length) break;
                        w_span = w_div.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    }
                }
            }
        }

        // Merge the first and last lines (if applicable)
        //
        // Four cases of existence (!... implies it does NOT exist, i.e.: it is not rendered on the UI)
        // =======================
        // - [ ] keeping, removing
        // - [ ] keeping, !removing
        // - [ ] !keeping, removing
        // - [ ] !keeping, !removing
        //
        // - [ ] Ensure all 4 cases of existence handle 'EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine(cursor);'
        //
        if (linesRemovedCount > 0) {
            INTS[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
            INTS[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;
            // TODO: this cursorVisualColumnIndex... logic here seems like it can be skipped here so long as you do it once by the end of the function to the correct indices.
            INTS[fEDI_cursorVisualColumnIndex] = smallLineAndColumnIndices_indexColumn;
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex] = smallLineAndColumnIndices_indexLine;

            if (smallLineDiv) {
                if (largeLineDiv) { // - [x] keeping, removing
                    let rememberLargeLineDivLength = largeLineDiv.children.length;
                    for (var i = 0; i < rememberLargeLineDivLength; i++) {
                        if (largeLineDiv.children[0].textContent.length > 0) {
                            smallLineDiv.appendChild(largeLineDiv.children[0]);
                        }
                        else {
                            largeLineDiv.removeChild(largeLineDiv.children[0]);
                        }
                    }
                    visibleLinesRemovedCount++;
                    //largeLineDiv.innerHTML = '';
                    //EDI_textElement.appendChild(largeLineDiv);
                }
                else { // - [ ] keeping, !removing

                }
            }
            else {
                if (largeLineDiv) { // - [ ] !keeping, removing
                    
                }
                else { // - [ ] !keeping, !removing
                    
                }
            }
        }

        // Remove middle line(s)
        if (linesRemovedCount > 0) {

            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
            let ringBufferIndex_current = (smallLineAndColumnIndices_indexLine + 1) - INTS[fEDI_virtualIndexLine];
            if (ringBufferIndex_current >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_current < 0) ringBufferIndex_current = -1;
            else ringBufferIndex_current = (ringBufferIndex_current + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
            let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
            if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
            else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

            // TODO: This will be wrong because you'd need to explicitly redraw the large selection line index.
            EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(ringBufferIndex_last, ringBufferIndex_current, linesRemovedCount);

            if (EDI_drawGutter_Width()) {
                // If true then you need to also draw the dependent UI
                EDI_render_request(RenderKind_Cursor_n);
                EDI_drawHorizontalScrollbar();
            }
        }

        INTS[fEDI_cursor_editLength] = original_edit_length;
    }
}

/** TODO: this is nearly identical to backspace, the difference is the check 'if (INTS[fEDI_cursor_editKind] !== EditKind_DeleteLtr)', thus dedupe the logic or no? */
function EDI_render_do_Delete() {
    if (INTS[fEDI_cursor_editKind] !== EditKind_DeleteLtr) {
        return;
    }
    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        walkLineUntilIndexColumn();

        if (!w_span) {
            // TODO: this
        }
        else {
            let remaining = INTS[fEDI_cursor_editLength] - INTS[fEDI_cursor_editRenderedDisplacement];
            INTS[fEDI_cursor_editRenderedDisplacement] = INTS[fEDI_cursor_editLength];
            while (remaining > 0) {
                // When the cursor is at the end of a span, there is no text to delete, because the text starts in the next span.
                let available = w_span.textContent.length - INTS[fEDI_w_indexColumn_SpanTextContentRelative];
                let count = remaining > available ? available : remaining;
                remaining -= count;

                if (count > 0) {
                    w_span.textContent = w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                }

                if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                    w_div.removeChild(w_span);
                }
                else {
                    INTS[fEDI_w_indexSpan]++;
                }

                if (remaining > 0) {
                    if (INTS[fEDI_w_indexSpan] >= w_div.children.length) {

                        // This is a pain I'm not sure if the finalizeEdit will bug it all out timing wise
                        // but I'll presume for now that it won't and then everything should become clear in time (not always but in this scenario I feel it is the case).
                        // 
                        // Extreme cancellation logic whenever finalizeEdit runs, if there were any pending specific draws, skip them and force full screen redraw
                        // would permit a bridge of having the code work as I narrow down the edge cases more and more maybe.
                        //
                        if (INTS[fEDI_cursor_indexLine] < EDI_lineEndPositionList_count - 1) {

                            remaining--;

                            if (w_span.className === 'eCM') {
                                EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine();
                            }

                            // Merge the lines if both are visible.
                            // TODO: Use NEXT here (... + 1)

                            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
                            let ringBufferIndex_next = (INTS[fEDI_cursor_indexLine] + 1) - INTS[fEDI_virtualIndexLine];
                            if (ringBufferIndex_next >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_next < 0) ringBufferIndex_next = -1;
                            else ringBufferIndex_next = (ringBufferIndex_next + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

                            if (ringBufferIndex_next >= 0) {
                                let keepingDiv = w_div;
                                let removingDiv = EDI_textElement.children[ringBufferIndex_next];

                                let rememberRemovingDivLength = removingDiv.children.length;
                                for (let k = 0; k < rememberRemovingDivLength; k++) {
                                    if (removingDiv.children[0].textContent.length > 0) {
                                        keepingDiv.appendChild(removingDiv.children[0]);
                                    }
                                    else {
                                        removingDiv.removeChild(removingDiv.children[0]);
                                    }
                                }

                                // TODO: This is NOT an optimal solution to removing the empty span after joining the lines
                                if (keepingDiv.children.length > 1 && keepingDiv.children[0].textContent.length === 0) {
                                    keepingDiv.removeChild(keepingDiv.children[0]);
                                }

                                // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
                                let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
                                if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
                                else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

                                EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(ringBufferIndex_last, ringBufferIndex_next, 1);
                            }
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        w_span = w_div.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    }
                }
            }
        }
    }
}

function EDI_state_do_Delete(event) {
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
        return;
    }

    let virtual_cursorIndexLine = INTS[fEDI_cursor_indexLine] + INTS[fEDI_cursor_editLineFeedCount];

    let virtual_cursorIndexColumn;
    if (EDI_cursor_edit_flagLineChanged === -1) {
        virtual_cursorIndexColumn = INTS[fEDI_cursor_indexColumn];
    }
    else {
        virtual_cursorIndexColumn = INTS[fEDI_cursor_editLength] - EDI_cursor_edit_flagLineChanged;
    }

    let lineEnd = EDI_getLineEnd_pos_raw(virtual_cursorIndexLine);
    let lastValidIndexColumn = EDI_getLastValidIndexColumn_raw(virtual_cursorIndexLine);

    // You might have to finalize when moving the cursor from this scenario though with ArrowAaa or mousedown
    // not necessarily impossible long term but short term you're gonna make a mess with this...
    // but it worth it?

    if (virtual_cursorIndexColumn === lastValidIndexColumn) {
        if (virtual_cursorIndexLine < EDI_lineEndPositionList_count - 1) {

            // flag the current editlength whenever u change lines so you can check the editlength relative to the line

            INTS[fEDI_cursor_editLength]++;
            INTS[fEDI_cursor_editLineFeedCount]++;
            EDI_lineEndPositionList_PENDING.insert(EDI_lineEndPositionList_PENDING.count, lineEnd);

            EDI_cursor_edit_flagLineChanged = INTS[fEDI_cursor_editLength];

            EDI_render_request(RenderKind_DeleteLtr);
        }
        else {
            // Start of file
            // nothing?
        }
    }
    else {
        if (event.ctrlKey) {
            // INTS[fEDI_cursor_editPosition] is intended to be equal due to the batch requirements / a new edit would also be equal.
            let tempIndexColumn = INTS[fEDI_cursor_indexColumn];
            let tempPosition = INTS[fEDI_cursor_editPosition];


            let originalCharacterKind;
            if (tempIndexColumn < lineEnd) {
                originalCharacterKind = getCharacter_kind_raw(tempPosition);
            }
            else {
                originalCharacterKind = CharacterKind_None;
            }

            let thisCharacterKind = CharacterKind_None;
            
            tempIndexColumn++;
            tempPosition++;
            INTS[fEDI_cursor_editLength]++;
            
            while (INTS[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
                if (tempIndexColumn < lineEnd) {
                    thisCharacterKind = getCharacter_kind_raw(tempPosition);
                }
                else {
                    thisCharacterKind = CharacterKind_None;
                }
                if (thisCharacterKind !== originalCharacterKind) {
                    break;
                }
                tempIndexColumn++;
                tempPosition++;
                INTS[fEDI_cursor_editLength]++;
            }
        }
        else {
            INTS[fEDI_cursor_editLength]++;
        }

        EDI_render_request(RenderKind_DeleteLtr);
    }
}

/**
 * @param {*} event 
 * @returns 
 */
function EDI_deleteDo(event) {
    EDI_state_do_Delete(event);
}

function EDI_render_do_Backspace() {
    if (INTS[fEDI_cursor_editKind] !== EditKind_BackspaceRtl) {
        return;
    }

    if (INTS[fEDI_cursor_editRenderedDisplacement] < INTS[fEDI_cursor_editLength]) {
        walkLineUntilIndexColumn();

        if (!w_span) {
            // TODO: this
        }
        else {
            let remaining = INTS[fEDI_cursor_editLength] - INTS[fEDI_cursor_editRenderedDisplacement];
            INTS[fEDI_cursor_editRenderedDisplacement] = INTS[fEDI_cursor_editLength];
            while (remaining > 0) {
                let available = w_span.textContent.length - INTS[fEDI_w_indexColumn_SpanTextContentRelative];
                let count = remaining > available ? available : remaining;
                remaining -= count;
    
                // When the cursor is at the end of a span, there is no text to delete, because the text starts in the next span.
                if (count > 0) {
                    w_span.textContent = w_span.textContent.slice(0, INTS[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(INTS[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                }

                if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                    w_div.removeChild(w_span);
                }
                else {
                    INTS[fEDI_w_indexSpan]++;
                }
    
                if (remaining > 0) {
                    if (INTS[fEDI_w_indexSpan] >= w_div.children.length) {
                        if (INTS[fEDI_cursor_indexLine] < EDI_lineEndPositionList_count - 1) {

                            remaining--;

                            if (w_span.className === 'eCM') {
                                EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine();
                            }

                            // Merge the lines if both are visible.
                            // TODO: Use NEXT here (... + 1)
                            
                            // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
                            let ringBufferIndex_next = (INTS[fEDI_cursor_indexLine] + 1) - INTS[fEDI_virtualIndexLine];
                            if (ringBufferIndex_next >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_next < 0) ringBufferIndex_next = -1;
                            else ringBufferIndex_next = (ringBufferIndex_next + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

                            if (ringBufferIndex_next >= 0) {
                                let keepingDiv = w_div;
                                let removingDiv = EDI_textElement.children[ringBufferIndex_next];

                                let rememberRemovingDivLength = removingDiv.children.length;
                                for (let k = 0; k < rememberRemovingDivLength; k++) {
                                    if (removingDiv.children[0].textContent.length > 0) {
                                        keepingDiv.appendChild(removingDiv.children[0]);
                                    }
                                    else {
                                        removingDiv.removeChild(removingDiv.children[0]);
                                    }
                                }

                                // TODO: This is NOT an optimal solution to removing the empty span after joining the lines
                                if (keepingDiv.children.length > 1 && keepingDiv.children[0].textContent.length === 0) {
                                    keepingDiv.removeChild(keepingDiv.children[0]);
                                }

                                // See comment "Awkward explicit inlining of 'EDI_indexLineTo_ringBufferIndex'" for more information.
                                let ringBufferIndex_last = (INTS[fEDI_virtualIndexLine] + INTS[fEDI_virtualCount] - 1) - INTS[fEDI_virtualIndexLine];
                                if (ringBufferIndex_last >= INTS[fEDI_ArrayFrom_textElement_children_length] || ringBufferIndex_last < 0) ringBufferIndex_last = -1;
                                else ringBufferIndex_last = (ringBufferIndex_last + INTS[fEDI_ringBuffer_indexZero]) % INTS[fEDI_virtualCount];

                                EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(ringBufferIndex_last, ringBufferIndex_next, 1);
                            }
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        w_span = w_div.children[INTS[fEDI_w_indexSpan]];
                        INTS[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    }
                }
            }
        }
    }
}

function EDI_state_do_Backspace(event) {
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
        return;
    }
    
    if (INTS[fEDI_cursor_indexColumn] === 0) {
        if (INTS[fEDI_cursor_indexLine] > 0) {

            // TODO: multicursor bugs are more likely to occur with this logic:
            // TODO: this logic is extremely suspect given editIndexLine and editIndexColumn...
            // ...as well if you move the cursor during a pending edit then finalize does it edit the correct positions?
            //
            // wrap to previous line
            INTS[fEDI_cursor_indexLine]--;
            INTS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(INTS[fEDI_cursor_indexLine]);
            INTS[fEDI_cursorVisualColumnIndex] = INTS[fEDI_cursor_indexColumn];
            INTS[fEDI_cursorVisualColumnIndex_relativeToThisLineIndex]--;
            INTS[fEDI_cursor_editPosition]--;
            INTS[fEDI_cursor_editLength]++;
            INTS[fEDI_cursor_editIndexLine] = INTS[fEDI_cursor_indexLine];
            INTS[fEDI_cursor_editIndexColumn] = INTS[fEDI_cursor_indexColumn];

            INTS[fEDI_cursor_editLineFeedCount]++;
            EDI_lineEndPositionList_PENDING.insert(0, INTS[fEDI_cursor_editPosition]);
        }
        else {
            return;
        }
    }
    else {
        if (event.ctrlKey) {
            // INTS[fEDI_cursor_editPosition] is intended to be equal due to the batch requirements / a new edit would also be equal.

            let originalCharacterKind = getCharacter_kind_raw(INTS[fEDI_cursor_editPosition] - 1);
            INTS[fEDI_cursor_indexColumn]--;
            INTS[fEDI_cursorVisualColumnIndex]--;
            INTS[fEDI_cursor_editPosition]--;
            INTS[fEDI_cursor_editIndexColumn]--;
            INTS[fEDI_cursor_editLength]++;

            while (INTS[fEDI_cursor_indexColumn] > 0) {
                if (getCharacter_kind_raw(INTS[fEDI_cursor_editPosition] - 1) !== originalCharacterKind) {
                    break;
                }
                INTS[fEDI_cursor_indexColumn]--;
                INTS[fEDI_cursorVisualColumnIndex]--;
                INTS[fEDI_cursor_editPosition]--;
                INTS[fEDI_cursor_editIndexColumn]--;
                INTS[fEDI_cursor_editLength]++;
            }
        }
        else {
            INTS[fEDI_cursor_indexColumn] -= 1;
            INTS[fEDI_cursorVisualColumnIndex] -= 1;
            INTS[fEDI_cursor_editPosition] -= 1;
            INTS[fEDI_cursor_editIndexColumn] -= 1;
            INTS[fEDI_cursor_editLength]++;
        }
    }

    EDI_render_request(RenderKind_BackspaceRtl);
}

/**
 * @param {*} event 
 * @returns 
 */
function EDI_backspaceDo(event) {
    EDI_state_do_Backspace(event);

    // EDI_render_request(RenderKind_BackspaceRtl);
    //
    // This is too confusing for me to read given my current mood / energy levels. (I tell myself it is just my current mood / energy levels to cope with my incompetence)
    // I'm just gonna isolate the code that doesn't remove a lineEnd and get that part working with 'EDI_render_request(RenderKind_BackspaceRtl);'
    // first.

    // I'm exhausted I'll probably do non-lineEnd delete key then be done
}

/**
 * @param {string} character 
 */
function EDI_insertDo(character) {
    /*
    TODO: (optimization idea) if you are inserting at the 0th or length position it might be worthwhile
    to have a conditional branch make the textContent with 1 less slice invocation.

    TODO: (optimization idea) I'm going to get this less optimized version to work, but you might want to
    make a copy of the span so you only have to "insert" text to the end of the span.
    And then this removes 1 of the slice invocations, rather than inserting "possibly" among the existing textContent.
    */

    EDI_cursor_gapBuffer[INTS[fEDI_cursor_gapBufferCount]] = character.charCodeAt(0);
    INTS[fEDI_cursor_gapBufferCount]++;

    INTS[fEDI_cursor_editLength]++;
    INTS[fEDI_cursor_indexColumn]++;
    INTS[fEDI_cursorVisualColumnIndex]++;
}

function EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine() {
    // binary search for 'if (INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > positionIndex)'
    let indexTrackedSyntax = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(INTS[fEDI_cursor_indexLine]);
    if (indexTrackedSyntax === NaN || indexTrackedSyntax === -1) {
        indexTrackedSyntax = EDI_trackedSyntaxList.count_abstract;
    }
    if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
        EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
        if (INTS[fEDI_pooledTrackedSyntax_start] < INTS[fEDI_cursor_editPosition]) {
            let moreThanOneLineEndPositionIsEncompassed = false;

            // TODO: This has no reason to be a for loop
            for (let i = INTS[fEDI_cursor_indexLine] - 1; i >= 0; i--) {
                let lineEndPosition = EDI_lineEndPositionList_data[i];
                if (INTS[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                    INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
                        moreThanOneLineEndPositionIsEncompassed = true;
                        break;
                }
                else {
                    break;
                }
            }
            
            if (!moreThanOneLineEndPositionIsEncompassed) {
                // TODO: This has no reason to be a for loop
                for (let i = INTS[fEDI_cursor_indexLine] + 1; i < EDI_lineEndPositionList_count; i++) {
                    let lineEndPosition = EDI_lineEndPositionList_data[i];
                    if (INTS[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                        INTS[fEDI_pooledTrackedSyntax_start] + INTS[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
                            moreThanOneLineEndPositionIsEncompassed = true;
                            break;
                    }
                    else {
                        break;
                    }
                }

                if (!moreThanOneLineEndPositionIsEncompassed) {
                    EDI_trackedSyntaxList.removeAt(indexTrackedSyntax, 1);
                }
            }
        }
    }
}

function EDI_scrollCursorIntoView() {
    let scrollX = 0;
    let scrollY = 0;

    let local_lastReadNumber_scrollTop = INTS[fEDI_lastReadNumber_scrollTop];

    if (INTS[fEDI_cursor_cursorTranslateYValue] < local_lastReadNumber_scrollTop) {
        scrollY = INTS[fEDI_cursor_cursorTranslateYValue] - local_lastReadNumber_scrollTop;
    }
    else if (INTS[fEDI_cursor_cursorTranslateYValue] >= local_lastReadNumber_scrollTop + INTS[fEDI_lastReadNumber_offsetHeight]) {
        // I want to use clientHeight but I don't have any logic for no scrollbar thus single page fitting text might bug out and trigger
        // scrollBy over and over.

        // make the bottom touch then add lineHeight is probably the algorithm to get a perfect fill maybe do lineHeight * 2 skip an event when spamming arrowDown?
        let currentBottom = local_lastReadNumber_scrollTop + INTS[fEDI_lastReadNumber_offsetHeight];
        let changeToMakeBottomTouch = INTS[fEDI_cursor_cursorTranslateYValue] - currentBottom;
        scrollY = changeToMakeBottomTouch + (2 * INTS[fEDI_lineHeight]);
    }

    if (INTS[fEDI_cursor_cursorTranslateXValue] < INTS[fEDI_lastReadNumber_scrollLeft]) {
        scrollX = INTS[fEDI_cursor_cursorTranslateXValue] - INTS[fEDI_lastReadNumber_scrollLeft];
    }
    else if (INTS[fEDI_cursor_cursorTranslateXValue] >= INTS[fEDI_lastReadNumber_scrollLeft] + INTS[fEDI_lastReadNumber_offsetWidth]) {
        // I want to use clientWidth but I don't have any logic for no scrollbar thus single page fitting text might bug out and trigger
        // scrollBy over and over.

        // make the right touch then add characterWidth is probably the algorithm to get a perfect fill maybe do characterWidth * 2 skip an event when spamming arrowRight?
        let currentRight = INTS[fEDI_lastReadNumber_scrollLeft] + INTS[fEDI_lastReadNumber_offsetWidth];
        let changeToMakeRightTouch = INTS[fEDI_cursor_cursorTranslateXValue] - currentRight;
        scrollX = changeToMakeRightTouch + (4 * EDI_characterWidth);
    }

    // This is asynchronous, this is the bug cause
    // (SPECIFICALLY: the scroll event is async)
    if (scrollX !== 0 || scrollY !== 0) {
        EDI_baseElement.scrollBy(scrollX, scrollY);
    }
}

function EDI_getCharacterKind(character) {
    switch (character) {
        case 'a':
        case 'b':
        case 'c':
        case 'd':
        case 'e':
        case 'f':
        case 'g':
        case 'h':
        case 'i':
        case 'j':
        case 'k':
        case 'l':
        case 'm':
        case 'n':
        case 'o':
        case 'p':
        case 'q':
        case 'r':
        case 's':
        case 't':
        case 'u':
        case 'v':
        case 'w':
        case 'x':
        case 'y':
        case 'z':
        case 'A':
        case 'B':
        case 'C':
        case 'D':
        case 'E':
        case 'F':
        case 'G':
        case 'H':
        case 'I':
        case 'J':
        case 'K':
        case 'L':
        case 'M':
        case 'N':
        case 'O':
        case 'P':
        case 'Q':
        case 'R':
        case 'S':
        case 'T':
        case 'U':
        case 'V':
        case 'W':
        case 'X':
        case 'Y':
        case 'Z':
        case '_':
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            return CharacterKind_LetterOrDigit;
        case ' ':
        case '\t':
        case '\r':
        case '\n':
            return CharacterKind_Whitespace;
        default:
            return CharacterKind_Punctuation;
    }
}

async function EDI_MenuOnClick(indexClicked, elementClicked) {
    const commandKind = parseInt(elementClicked.dataset.commandKind, 10);
    if (!commandKind) {
        return;
    }

    switch (commandKind) {
        case CommandKind_Cut:
            EDI_finalizeEdit();
            await EDI_copySelection();
            EDI_removeSelection();
            EDI_render_request(RenderKind_Cursor_n);
            return;
        case CommandKind_Copy:
            EDI_finalizeEdit();
            return EDI_copySelection();
        case CommandKind_Paste:
            EDI_finalizeEdit();
            let clipboard = await window.myAPI.readClipboard();
            EDI_paste(clipboard);
            EDI_render_request(RenderKind_Cursor_n);
            return;
        case CommandKind_Find:
            EDI_findOverlay_showSetter(!get_EDI_findOverlay_show());
            return;
    }
}

/**
 * This clears the cursor's selection.
 */
function EDI_moveCursor_position(intValue) {
    EDI_getLineAndColumnIndices(intValue);
    let lineAndColumnIndices_indexLine = INTS[fEDI_getLineAndColumnIndices_indexLine];
    let lineAndColumnIndices_indexColumn = INTS[fEDI_getLineAndColumnIndices_indexColumn];
    EDI_moveCursor_indexLine_indexColumn(lineAndColumnIndices_indexLine, lineAndColumnIndices_indexColumn);
}

/**
 * This clears the cursor's selection.
 */
function EDI_moveCursor_indexLine_indexColumn(indexLine, indexColumn) {
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);

    if (indexColumn > lastValidIndexColumn) {
        INTS[fEDI_cursor_indexColumn] = lastValidIndexColumn;
        INTS[fEDI_cursorVisualColumnIndex] = lastValidIndexColumn;
    }
    else {
        INTS[fEDI_cursor_indexColumn] = indexColumn;
        INTS[fEDI_cursorVisualColumnIndex] = indexColumn;
    }

    INTS[fEDI_cursor_indexLine] = indexLine;
    
    // TODO: selectionAnchor = selectionEnd; EDI_drawCursor(); # being the way to clear a selection should be documented / wrapped by a method for ease of use / readability?
    INTS[fEDI_cursor_selectionAnchor] = INTS[fEDI_cursor_selectionEnd];
    EDI_render_request(RenderKind_Cursor_n);
}

/**
 * TODO: repeated duplications of the same extremely large selection might benefit from temporary caching of this functions result.
 * 
 * textonly is in reference to conversion of the raw storage of the text editor such that all line feeds get returned as as EDI_lineEndString rather than the internal representation of '\n'.
 * 
 * @returns {string}
 */
function EDI_decode_textonly(start, length) {
    if (length <= 0) {
		return '';
	}

	let end = start + length;

	let decodedText = EDI_decoder.decode(EDI_textByteList_bytes.subarray(start, end));
	if (!EDI_lineEndString) {
		EDI_lineEndString = '\n';
	}
	if (EDI_lineEndString !== '\n') {
		decodedText = decodedText.replaceAll('\n', EDI_lineEndString);
	}
	
	return decodedText;
}

function EDI_toExtensionKind(extensionWithPeriod) {
    switch (extensionWithPeriod) {
        case '.js':
        case '.cjs':
            return ExtensionKind_JavaScript;
        default:
            return ExtensionKind_None;
    }
}

function EDI_language_line_lex_SET(extensionKind) {
    switch (extensionKind) {
        case ExtensionKind_JavaScript:
            EDI_language_line_lex = JS_line_lex;
            break;
        default:
            EDI_language_line_lex = PLAINTEXT_line_lex;
            break;
    }
}

/**
 * TODO: this can be way faster all I did was take JS_line_lex and then strip away all the details...
 * ...I'm more concerned with tightening the difference between best and worst case...
 * ...by reducing worst case.
 * This makes line lexing JS faster so it is preferable even if I don't write this plaintext implementation perfectly.
 * "maybe" it's faster I didn't measure anything but I swear I know what I'm doing
 * not only did I not measure it but I went back and forth between vscode I actually have no idea if this faster I can't remember anything I'm super tired.
 * I'm tired and I still have to write more of the multicursor logic so I'm just vibing out the optimizations for a bit I'll get measurements later when the app works more.
 */
function PLAINTEXT_line_lex(div, substart, lineEnd, childIndex) {
    let length = 0;
    let pos = substart;

    const bytes = EDI_textByteList_bytes;

    while (pos < lineEnd) {
        length++;
        pos++;
    }

    if (length > 0) {
        let span;
        if (childIndex < div.children.length) {
            span = div.children[childIndex++];
            span.className = '';
        }
        else {
            span = document.createElement('span');
            div.appendChild(span);
            childIndex++;
        }
        span.textContent = EDI_decoder.decode(bytes.subarray(substart, substart + length));
    }

    return childIndex;
}

function EDI_measureLineHeightAndCharacterWidth() {
    let measureElement = document.createElement('div');
    measureElement.style.width = "fit-content";
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.padding = '0';
    measureElement.style.border = 'none';
    measureElement.style.left = '0';
    measureElement.style.top = '0';

    // AI is saying "// The foolproof way to prevent ALL scrollbars during measurement" is this paragraph of code.
    // The foolproof way to prevent ALL scrollbars during measurement
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed'; // Removes it from the normal page layout flow
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '0';        // Forces a tiny container footprint
    wrapper.style.height = '0';       // Forces a tiny container footprint
    wrapper.style.overflow = 'hidden'; // Prevents any layout leaking out or causing scrollbars
    wrapper.style.visibility = 'hidden'; // Keeps it completely invisible to the user

    wrapper.appendChild(measureElement);
    EDI_textElement.appendChild(wrapper);

    let len = 396;
    measureElement.innerHTML = 'A'.repeat(len);
    let measureElementBoundingClientRect = measureElement.getBoundingClientRect();
    EDI_characterWidth = measureElementBoundingClientRect.width / len; // 7.146002258917298
    INTS[fEDI_lineHeight] = Math.ceil(measureElementBoundingClientRect.height); // 15

    wrapper.removeChild(measureElement);
    EDI_textElement.removeChild(wrapper);

    const root = document.documentElement;
    const computedStyles = window.getComputedStyle(root);
    let teLineHeight = INTS[fEDI_lineHeight] + 'px';
    let propertyName = '--EDITOR-line-height';
    if (computedStyles.getPropertyValue(propertyName) !== teLineHeight) {
        // avoid layout with if statement
        root.style.setProperty(propertyName, teLineHeight);
    }
}

function EDI_registerHandlers() {
    EDI_baseElement.addEventListener('keydown', EDI_onKeyDown);
    EDI_baseElement.addEventListener('mousedown', EDI_onMouseDown);
    EDI_baseElement.addEventListener('scroll', EDI_onScroll_WRAPIT, { passive: true });

    EDI_baseElement.addEventListener('wheel', EDI_onWheel, { passive: true });

    EDI_baseElement.addEventListener('contextmenu', EDI_onContextMenu);
    window.addEventListener('resize', EDI_onResize_WRAPIT);
    EDI_horizontal_scrollbar.addEventListener('scroll', EDI_horizontal_scrollbar_onScroll, { passive: true });

    // Attach a single listener to your text container (Event Delegation)
    EDI_baseElement.addEventListener('mouseover', EDI_mouseOver);
    EDI_baseElement.addEventListener('mouseleave', EDI_mouseLeave);
    
    EDI_baseElement.addEventListener('focus', EDI_onfocus);
    EDI_baseElement.addEventListener('blur', EDI_onblur);
}

/**
 * < Thanks to a browser feature called Event Bubbling, when the mouse enters a tiny token span, the event bubbles up to the parent container
 */
function EDI_mouseOver(e) {
    INTS[fEDI_EDI_mouseOver_event_clientY] = e.clientY;
    INTS[fEDI_EDI_mouseOver_event_clientX] = e.clientX;

    clearTimeout(INTS[fEDI_hoverTimeout]);
    INTS[fEDI_hoverTimeout] = setTimeout(EDI_requestLspHover, 1000);
}

function EDI_mouseLeave() {
    clearTimeout(INTS[fEDI_hoverTimeout]);
    INTS[fEDI_hoverTimeout] = 0;
    EDI_hideTooltip();
}

function EDI_requestLspComplete() {
    window.myAPI.editorCompletionRequest(INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
}

function EDI_doEditorGoToDefinitionRequest() {
    window.myAPI.editorGoToDefinitionRequest(INTS[fEDI_cursor_indexLine], INTS[fEDI_cursor_indexColumn]);
}

function EDI_requestLspHover() {
    let event_clientY = INTS[fEDI_EDI_mouseOver_event_clientY];
    let event_clientX = INTS[fEDI_EDI_mouseOver_event_clientX];

    ///////////
    ///////////
    // # GET INDICES
    ///////////
    ///////////
    if (get_EDI_recentBoundingClientRect_isNull_intFalsey()) {
        let boundingClientRect = EDI_baseElement.getBoundingClientRect();
        INTS[fEDI_recentBoundingClientRect_left] = boundingClientRect.left;
        INTS[fEDI_recentBoundingClientRect_top] = boundingClientRect.top;
        set_EDI_recentBoundingClientRect_isNull_intFalsey(0);
    }

    let rY = event_clientY - INTS[fEDI_recentBoundingClientRect_top] + INTS[fEDI_lastReadNumber_scrollTop];
    let rX = event_clientX - INTS[fEDI_recentBoundingClientRect_left] - INTS[fEDI_gutterWidthTotal] + INTS[fEDI_lastReadNumber_scrollLeft];
    
    let indexLine = Math.floor(rY / INTS[fEDI_lineHeight]);
    let indexColumn = Math.round(rX / EDI_characterWidth);

    if (indexLine < 0) return;
    if (indexColumn < 0) return;
    if (indexLine >= EDI_lineEndPositionList_count) return;
    // ----
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);
    if (indexColumn > lastValidIndexColumn) return;
    
    ///////////
    ///////////
    // # GET INDICES
    ///////////
    ///////////

    // Indices are wrong... they're likely outdated
    if (!BYTES[byteEDI_mousemove_eventListener_isActive]) {
        window.myAPI.editorHoverRequest(indexLine, indexColumn);
    }
}

function EDI_hideTooltip() {
    TOOLTIP_hide();
}

function EDI_onfocus() {
    EDI_cursor_cursorElement.classList.add('EDI_cursor_focus');
}

function EDI_onblur() {
    EDI_cursor_cursorElement.classList.remove('EDI_cursor_focus');
}

/*
Each edit needs to keep the lsp up to date.
i.e.:
- Get when the edits finalize that the lsp is always in sync at that point
    (minus the whole "tab as '\t\0\0\0' scenario, that's for another time).

When is renderer -> ipc serialized is this part synchronous? you can pool the DTOs

==========

- [ ] Move booleans where the use of it from boolean field buffer, that the scope already has a reference to a local of the int field buffer.
    - [ ] ONLY if it is a hot path / meaningful for some reason.
- [ ] Move all Editor related state so that it is contiguous within the field buffers.
- [ ] Look into array caching and whether you could put hot path data a certain way that it reads fastest due to caching

====

//> Do you have any thoughts on the most optimal way to perform this calculation?
//> 
//> I have the code 'ringBufferIndexCurrent = EDI_ringBufferIndex_NEXT(ringBufferIndexCurrent);'.
//> 
//> This runs very often within a loop. The 'EDI_ringBufferIndex_NEXT' function is:
//> return ++ringBufferIndex >= INTS[fEDI_ArrayFrom_textElement_children_length] ? ringBufferIndex -= INTS[fEDI_ArrayFrom_textElement_children_length] : ringBufferIndex;
//
//< To optimize this operation, the most effective approach is to replace the function call and conditional branch with a
//< bitwise AND mask or a direct modulo operation, while inlining the logic to eliminate function call overhead.
//< ...
//< 1. The Fastest Approach (Power of 2)
//< ...
//< ringBufferIndexCurrent = (ringBufferIndexCurrent + 1) & (ARRAY_LENGTH - 1);
//<
//< 2. The Cleanest Micro-Optimization (Dynamic Length)
//< ringBufferIndexCurrent = (ringBufferIndexCurrent + 1) % INTS[fEDI_ArrayFrom_textElement_children_length];
//<

============

- [ ] rendering '\t' as tab-size of 4
    - [ ] whitespace collapsing?
    - [ ] tab-stop messing with tab-size?
    - [ ] Mouse events

- [ ] TODO: I saw at least 1 case where the HTML element's children were being read when it should've used the ArrayFrom so go through them all and fix this and possibly any other cases.

TODO: a circular buffer is how you implement optimized enter key events

TODO: < Would you like to look at replacing the 'renderKind = EDI_renderKindArray.shift()' loop with an O(1) ring buffer/pointer implementation, or should we look at how V8 function inlining thresholds apply to the rest of your monolith?

TODO: let vs var for loops

TODO: span jitter

TODO: Reminder to myself: Ensure this doesn't break hidden classes before you do this tomorrow.
< ```js
// Do this when your viewport rows are first created
for (let i = 0; i < local_ArrayFrom_textElement_children_length; i++) {
    const gutter = EDI_ringBuffer_gutter[i];
    const div = EDI_ringBuffer_text[i];

    // Create the mutable scale/translate objects once
    gutter._transformValue = new CSSTranslate(CSS.px(0), CSS.px(0));
    div._transformValue = new CSSTranslate(CSS.px(0), CSS.px(0));

    // Wrap them in the expected transform structure
    gutter._cssTransform = new CSSTransformValue([gutter._transformValue]);
    div._cssTransform = new CSSTransformValue([div._transformValue]);
}
< ```
< ```js
// ... top of your loop ...

const gutter = gutterChildren[ringBufferIndex];
const div = textChildren[ringBufferIndex];

// ... line text parsing and span slicing logic ...

// 1. Mutate the raw numeric pixel value (Zero allocation!)
gutter._transformValue.y.value = vertical;
div._transformValue.y.value = vertical;

// 2. Commit the numbers straight to the browser's C++ layer
gutter.attributeStyleMap.set('transform', gutter._cssTransform);
div.attributeStyleMap.set('transform', div._cssTransform);

vertical += lineHeight;
< ```
< # One Small API Correction for Modern Chromium
<
< When implementing this in Electron, the layout engine expects the CSSTransformValue components to be read-only if you pull them via .get().
< To update them without re-instantiating wrappers inside the loop, the cleanest approach is to keep a small parallel array of reference objects, or use the direct fast-path setter.

Mandatories:
- [ ] mouse down, but for the same line index (i.e: not a full reset, only check for tabs in the space "traveled")
    - [ ] to a smaller column index
    - [ ] to a larger column index


*/
