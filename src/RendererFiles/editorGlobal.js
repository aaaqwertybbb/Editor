//__#__
// preprocessor.cjs
import "./fieldBuffer"
import "./javascriptFeatures"
//__#__

/*
###################################
# Wording related to "indexLine": #
###################################

- indexLine        // The line number of '1' corresponds to the '0' indexLine; The end position of this line is located at index '0' within 'EDI_lineEndPositionList'.
- virtualIndexLine // If you map the indexLine to an index that exists from virtualIndex to (virtualIndex + virtualCount - 1); both sides are inclusive;
                   // Then you could imagine that the UI has HTML divs available to be rendered into.
                   // And that this 'virtualIndexLine' says: "given my indexLine, is this being shown in the UI?"
                   // BUT there is more to this, you next have to consider the position of the belt.
                   //
- beltIndexLine    // I'm not well versed in this topic.
                   // But I think of a belt and a pulley wheel.
                   // The belt wraps around the pulley wheel, and the belt has indices from 0 to (virtualCount - 1); both sides are inclusive.
                   // As you scroll this belt is constantly rotating around the pulley wheel and your zeroth index is constantly changing.
                   //
                   // This concept makes far more sense if you consider things from a 'cumulative layout shift' perspective.
                   // Because the simpler approach of moving the HTML elements around cannot be done in a performant manner given the intracicies of how HTML works.

Why is it not a 'lineIndex' wording pattern?

It tends to be the case that you are working with an 'index'
so the inclusion of that word is rather unimportant when reading over the code.

I actually think 'lineIndex' "rolls off the tongue" a little easier.
But if you apply the pattern it hides the word 'line'.
And the importance when reading the code lies with the words 'line' and 'column'.

- [ ] When getting the beltIndex of anything that follows this pattern you don't check whether the underlying data has a large enough count, it is solely related to whether the itemHeight and height of the element can fit "that many divs".
    - [ ] TreeView
    - [ ] List
- [ ] When creating divs for the viewport you follow up by drawing the viewport afterwards.
    - [ ] Thus the creation of divs ought to be fully ignoring any excessive calculations because its style is just overriden immediately afterwards.
*/

/*
#####################
# Handling of tabs: #
#####################

What I do with tabs is a terrible idea.
I convert them from '\t' to '\t\0\0\0'.
Then I set tab-size to 1 for '#EDI_text'.

This maps a tab width of 4 to 4 characters.
I save out the content by skipping over the '\0'.

And the editor itself ought to handle '\0' such that you are at the expected position
rather than ever being at or modifying a '\0' itself.
I haven't gotten to this part though.

Perhaps what I'm doing is working with font styling I don't know I need to find time to look into it.

But the issue is that tab is a control character and has extra processing than a normal character.
And it can introduce oddities involving tabstop or very tiny changes in horizontal positioning of surrounding text or something.

'\0' is a similar problem, it is a special character that might cause odd behavior.
*/

let EDI_trackedSyntaxList = new TrackedSyntaxList(32);

/**
 * @type {UInt32List}
 */
let EDI_findOverlay_searchResultPositionList;

let EDI_textByteList = new ByteList(1024);
const EDI_encoder = new TextEncoder();
const EDI_decoder = new TextDecoder();

let gutterWidthTotal_withPxUnits;

/** This is likely a decimal value once it gets measured for real, do not try to put it in an int container. */
let EDI_characterWidth = 8;
// EDI_characterWidth
// EDI_characterWidth

/**
 * When this is cleared the information is not removed, only 'gapBufferCount' is set to 0.
 */
let EDI_cursor_gapBuffer = new Uint8Array(CONST_EDI_cursor_GAP_BUFFER_CAPACITY);

let EDI_cursor_gapBufferWriteToSpanElement = null;

let EDI_cursor_caretRow = document.createElement('div');
EDI_cursor_caretRow.id = "EDI_caretRow-1";
EDI_cursor_caretRow.className = "EDI_caretRow";
EDI_cursor_caretRow.style.left = gutterWidthTotal_withPxUnits;
if (EDI_horizontal_scrollbar_virtualization_boundary) {
    EDI_cursor_caretRow.style.width = EDI_horizontal_scrollbar_virtualization_boundary.style.width;
}

let EDI_cursor_cursorElement = document.createElement('div');
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
 * Null characters provide visual width for proportional fonts. They do not get copied or saved out.
 */
const EDI_on_tab_bytes = new Uint8Array(4);
EDI_on_tab_bytes[0] = CONST_EDI_ASCII_TAB;
EDI_on_tab_bytes[1] = 0;
EDI_on_tab_bytes[2] = 0;
EDI_on_tab_bytes[3] = 0;

/**
 * When a cursor removes a line end the position of the line end is stored in this list until the edit is finalized.
 */
let EDI_lineEndPositionList_PENDING = new UInt32List(128);

/**
 * IMPORTANT: use EDI_readLineEndPositionList(...) rather than indexing into this directly...
 * ...due to the possibility of pending edits.
 */
let EDI_lineEndPositionList = new UInt32List(128);

let EDI_textSourceIdentifier = '';
let EDI_FORMATTED_textSourceIdentifier = '';

let EDI_lineEndString = null;

let EDI_documentSymbolResult;
/**
 * @type {ListComponent}
 */
let EDI_listComponent = null;

let EDI_offsetWithinSpan_withRespectToThisSpan = null;

let w_span = null;
let w_div = null;

/**
 * This queueing is currently a complete copy and paste of what Google AI generated.
 * I looked it over and it appears correct.
 */
const lspQueue = [];

let EDI_renderKindArray = [];

// Persistent, flat JS arrays that stay alive forever in memory
let ArrayFrom_gutter_children = [];
let ArrayFrom_textElement_children = [];

let EDI_language_line_lex;

function EDI_cursor_hasSelection() {
    const ints = gINT_FIELDS;
    return ints[fEDI_cursor_selectionAnchor] >= 0 &&
            ints[fEDI_cursor_selectionEnd] >= 0 &&
            ints[fEDI_cursor_selectionAnchor] != ints[fEDI_cursor_selectionEnd];
}

/**
 * The code that clears the editor is dependent on this method NOT clearing 'gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]'
 * 
 * Somewhat duplicated code: This messes with the language features if I invoke clear() in the constructor, it puts "| undefined" on all the types.
 */
function EDI_cursor_clear() {
    const ints = gINT_FIELDS;
    ints[fEDI_cursor_indexLine] = 0;
    ints[fEDI_cursor_indexColumn] = 0;
    ints[fEDI_cursor_STORED_indexColumn] = 0;
    ints[fEDI_cursor_cursorTranslateYValue] = 0;
    ints[fEDI_cursor_cursorTranslateXValue] = 0;
    ints[fEDI_cursor_selectionAnchor] = 0;
    ints[fEDI_cursor_selectionEnd] = 0;
    ints[fEDI_cursor_DRAWN_selectionAnchor] = 0;
    ints[fEDI_cursor_DRAWN_selectionEnd] = 0;
    ints[fEDI_cursor_DRAWN_selection_virtualIndexLine] = 0;
    ints[fEDI_cursor_DRAWN_selection_virtualCount] = 0;
    ints[fEDI_cursor_editKind] = EditKind_None;
    ints[fEDI_cursor_editLength] = 0;
    ints[fEDI_cursor_editPosition] = 0;
    ints[fEDI_cursor_editIndexLine] = 0;
    ints[fEDI_cursor_editIndexColumn] = 0;
    ints[fEDI_cursor_editRenderedDisplacement] = 0;
    ints[fEDI_cursor_editRenderedDisplacement_INDEX_LINE_OFFSET] = 0;
    ints[fEDI_cursor_END_editIndexLine] = 0;
    ints[fEDI_cursor_END_editIndexColumn] = 0;

    ints[fEDI_cursor_gapBufferCount] = 0;

    EDI_cursor_enterKey_newLinePlusIndentation_byteList = null;
    EDI_cursor_cached_indentation_string = null;
    gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_None;

    ints[fEDI_cursor_editLineFeedCount] = 0;
    EDI_cursor_edit_flagLineChanged = -1;

    EDI_cursor_EDI_paste_clipboardContent = null;

    ints[fEDI_cursor_EDI_duplicate_small] = 0;
    ints[fEDI_cursor_EDI_duplicate_length] = 0;
}

function EDI_init() {

    EDI_virtualization_horizontal = EDI_baseElement.children[0];
    EDI_virtualization_vertical = EDI_baseElement.children[1];
    EDI_gutter = EDI_baseElement.children[4];

    EDI_horizontal_scrollbar = EDI_baseElement.children[2].children[0];
    EDI_horizontal_scrollbar.style.left = '0px';
    gINT_FIELDS[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] = 0;

    EDI_horizontal_scrollbar_virtualization_boundary = EDI_baseElement.children[2].children[0].children[0];
    EDI_body = EDI_baseElement.children[5];
    EDI_presentation = EDI_baseElement.children[5].children[0];
    EDI_cursorListElement = EDI_baseElement.children[5].children[1];
    EDI_textElement = EDI_baseElement.children[5].children[2];

    EDI_cursorListElement.appendChild(EDI_cursor_caretRow);

    EDI_measureLineHeightAndCharacterWidth();
    EDI_measureBaseElement();

    let gutterPaddingLeft = CONST_EDI_gutterPaddingLeft + 'px';
    let gutterPaddingRight = CONST_EDI_gutterPaddingRight + 'px';

    EDI_gutter.style.paddingLeft = gutterPaddingLeft;
    EDI_gutter.style.paddingRight = gutterPaddingRight;

    EDI_gutterBackgroundColor.style.paddingLeft = gutterPaddingLeft;
    EDI_gutterBackgroundColor.style.paddingRight = gutterPaddingRight;

    gINT_FIELDS[fEDI_gutterWidthStyleValue] = EDI_characterWidth;

    EDI_drawGutter_Width();

    gINT_FIELDS[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar] = 1; // necessary for the first render, otherwise the if statement sees 0 !== 0.
    EDI_drawHorizontalScrollbar();
    EDI_draw_all_cursors();

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
    let renderKind;
    // Note the functions being invoked might internally invoke a shift() if they see that the next renderKind is a 'flag'.

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
            // Don't include these you're wasting stackframe space.
            // You could perhaps "debug mode" check for these
            //case RenderKind_None: // this is a duplicate case ???
            //case RenderKind_Cursor_flag_doNotScrollIntoView: // TODO: This is a silent error
            //case RenderKind_Cursor_flag_scrollIntoViewExplicit: // TODO: This is a silent error
            //    break;
            case RenderKind_Cursor_n:
                // the 'default case' is RenderKind_Cursor_n:
                EDI_render_do_cursor(timestamp);
                break;
            //default:
            //    break;
        }
    }
    
    gBYTE_FIELDS[byteEDI_isRenderPending] = false; // Reset the lock
}

function EDI_render_do_cursor(timestamp) {
    gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
    EDI_drawCursor();
}

function EDI_render_do_cursor_flag_scrollIntoViewExplicit(timestamp) {
    gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
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
    gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp] = timestamp;
    EDI_drawCursor(true);
}

function EDI_render_do_InsertLtr() {
    const ints = gINT_FIELDS;
    if (ints[fEDI_cursor_editKind] !== EditKind_InsertLtr) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        if (EDI_cursor_gapBufferWriteToSpanElement) {

            let x = EDI_decoder.decode(EDI_cursor_gapBuffer.subarray(ints[fEDI_cursor_editRenderedDisplacement], ints[fEDI_cursor_editLength]));

            EDI_cursor_gapBufferWriteToSpanElement.textContent = 
                EDI_cursor_gapBufferWriteToSpanElement.textContent.slice(0, (ints[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex]/* + ints[fEDI_offsetWithinSpan]*/) + ints[fEDI_cursor_editRenderedDisplacement]) +
                x +
                EDI_cursor_gapBufferWriteToSpanElement.textContent.slice((ints[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex]/* + ints[fEDI_offsetWithinSpan]*/) + ints[fEDI_cursor_editRenderedDisplacement]);

            ints[fEDI_cursor_editRenderedDisplacement] = ints[fEDI_cursor_editLength];
        }
    }
}

function EDI_render_do_Clear() {
    EDI_drawCursor();
    EDI_clearSelectionStyle();
    EDI_textElement.innerHTML = '';
    EDI_gutter.innerHTML = '';

    // Force case 3
    gINT_FIELDS[fEDI_prevVli] = 0;
    gINT_FIELDS[fEDI_currVli] = gINT_FIELDS[fEDI_virtualCount];
    // TODO: Duplicated setting of scrolltop; this case and just baseline everytime vertical scrolls it is done in this method elsewhere
    gINT_FIELDS[fEDI_ONSCROLLscrollTop] = gINT_FIELDS[fEDI_lastReadNumber_scrollTop];
    EDI_render_do_CreateViewport();
}

function EDI_render_do_SetText(timestamp) {
    EDI_render_do_Clear();

    // TODO: This code paragraph will run when scrolling horizontally at the moment, this is unfortunate because it relates to scrolling vertically.
    update_VirtualIndexLine();
    

    EDI_render_do_Scroll(timestamp)

    gINT_FIELDS[fEDI_prevVli] = gINT_FIELDS[fEDI_ONSCROLLvirtualIndexLine];
    gINT_FIELDS[fEDI_currVli] = gINT_FIELDS[fEDI_virtualIndexLine];
    gINT_FIELDS[fEDI_ONSCROLLvirtualIndexLine] = gINT_FIELDS[fEDI_virtualIndexLine];

    gINT_FIELDS[fEDI_scrollEndDeadline] = timestamp + 1000;
    if (!gBYTE_FIELDS[byteisCheckingTrailingEdge]) {
        gBYTE_FIELDS[byteisCheckingTrailingEdge] = true;
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
    }
}

/** All DOM manipulation needs to be done through this function. */
function EDI_render_request(renderKind) {
    if (EDI_renderKindArray[EDI_renderKindArray.length - 1] !== renderKind) {
        EDI_renderKindArray.push(renderKind);
    }
    
    if (!gBYTE_FIELDS[byteEDI_isRenderPending]) {
        gBYTE_FIELDS[byteEDI_isRenderPending] = true;
        requestAnimationFrame(EDI_render_do);
    }
}

function EDI_render_do_CreateViewport() {

    const ints = gINT_FIELDS;

    let remember_scrollTop = ints[fEDI_lastReadNumber_scrollTop];
    let remember_scrollLeft = ints[fEDI_lastReadNumber_scrollLeft];

    EDI_baseElement.scrollTop = 0;
    EDI_baseElement.scrollLeft = 0;
    ints[fEDI_lastReadNumber_scrollLeft] = 0;

    ints[fEDI_ONSCROLLvirtualCount] = ints[fEDI_virtualCount];

    EDI_gutter.innerHTML = '';
    EDI_textElement.innerHTML = '';

    ints[fEDI_EDI_beltIndexZero] = 0;
    let translateY = `translateY(0px)`;
    let left = gutterWidthTotal_withPxUnits;
    let gutterWidth = `${ints[fEDI_gutterWidthStyleValue]}px`;

    for (var i = 0; i < ints[fEDI_virtualCount]; i++) {

        let indexLine = i + ints[fEDI_virtualIndexLine];

        let gutterLineElement = document.createElement('div');
        if (indexLine >= EDI_lineEndPositionList.count) {
            gutterLineElement.textContent = '~';
        }
        else {
            gutterLineElement.textContent = indexLine + 1;
        }
        gutterLineElement.className = 'eG';
        EDI_gutter.appendChild(gutterLineElement);
        gutterLineElement.style.top = top;
        gutterLineElement.style.width = gutterWidth;

        let div = document.createElement('div');
        div.className = 'eT';
        EDI_textElement.appendChild(div);
        div.style.transform = translateY;
        div.style.left = left;
        div.style.width = EDI_horizontal_scrollbar_virtualization_boundary.style.width;

        div.appendChild(document.createElement('span'));
    }

    ArrayFrom_gutter_children = Array.from(EDI_gutter.children);
    ArrayFrom_textElement_children = Array.from(EDI_textElement.children);
    ints[fEDI_ArrayFrom_textElement_children_length] = ArrayFrom_textElement_children.length;

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
 * and I've moved all the gINT_FIELDS[fEDI_virtualIndexLine] logic from here to the rAF
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
    gINT_FIELDS[fEDI_lastReadNumber_scrollLeft] = EDI_baseElement.scrollLeft;
    gINT_FIELDS[fEDI_lastReadNumber_scrollTop] = EDI_baseElement.scrollTop;

    EDI_render_request(RenderKind_Scroll);
}

/**
 * I'm 99% certain that if I look at the heap snapshots I'll see a memory leak, but one thing at a time it is complicated and each task incurs varying degrees of stress and each moment to moment only has so much stress resilience.
 * 
 * "why did you remove 1 assignment lul"
 * 
 * This is my own side thing you ought to look at the heap snapshot but I'm doing what needs to be done to maintain consistency on my end.
 * 
 * - Run app
 * - Pick workspace
 * - scrolled the explorer a bit while I thought about what to do next but only like a second or a few
 * - open dev tools
 * - take heap snapshot 1
 * ## Heap snapshot 1 => 3.1 MB
 * - Open editorGlobal.js
 * - Let the syntax highlighting debounce run
 * - take heap snapshot 2
 * ## Heap snapshot 2 => 4.4 MB
 * - scroll wheel 30 times (each wheel stroke is like 60 lines of text scrolled)
 * - take heap snapshot 3
 * ## Heap snapshot 3 => 4.7 MB
 * 
 * ....
 * 
 * Snapshot 6 (5.2 MB)
 * - PerformanceEventTiming 4,985 instances sitting in heap
 * 
 * I've read that having the dev tools open confuses things because it'll hold onto them more than usual.
 * But I've done various things in the past like close and reopen dev tools and take a new snapshot and etc... and it never remedied in the past I gotta see
 * 
 * 
 * https://stackoverflow.com/questions/491527/javascript-event-handlers-always-increase-browser-memory-usage
 * Answered by 'Ben Blank':
 * Memory leaks related to event handlers are, generally speaking, related to enclosures.
 * In other words, attaching a function to an event handler which points back to its element can prevent browsers from garbage-collecting either.
 * (Thankfully, most newer browsers have "learned the trick" and no longer leak memory in this scenario, but there are a lot of older browsers floating around out there!)
 * 
 * I'm still looking.
 * 
 * The Explorer does it too
 * 
 * 
 * < 1. The Global "Event History" Loophole
 * < 
 * < When you bind an event listener to an element, Chromium creates a native event wrapper behind the scenes.
 * < If your text editor or tree-view code tracks actions via a history queue, undo/redo stack, or custom context menu,
 * < you might be pushing raw event arguments directly into an array.
 * <
 * < The Leak Pattern:
 * <
 * < ```js
 * < // An array tracking history, selections, or clicks
 * < const selectionHistory = []; 
 * < 
 * < editor.addEventListener('click', (e) => {
 * <   // Storing the RAW event object captures its internal performance counters!
 * <   selectionHistory.push(e); 
 * < });
 * < ```
 * <
 * < Why it traps PerformanceEventTiming: Native Event objects carry references to Chromium's internal event timing timelines.
 * < If you push the raw e (or an array of e objects) into a permanent or long-running array to track user history,
 * < you implicitly prevent every associated PerformanceEventTiming object from being cleared from the heap.
 * 
 * It happens with the hover logic.
 * All I need to do is move my mouse over the text editor and go either from line to line or mouse over from 1 syntax highlighted word to another
 * and do that for a few seconds then heap snapshot the PerformanceEventTiming goes up.
 * I don't even have to trigger the hover tooltip, just the debouncing itself.
 * 
 */
function EDI_render_do_Scroll(timestamp) {
    const ints = gINT_FIELDS;
    let local_lineHeight = ints[fEDI_lineHeight];

    // TODO: This floor logic seems very odd. Because given the previous and the current you can determine it without dividing maybe I think?
    ints[fEDI_virtualIndexLine] = (Math.floor(ints[fEDI_lastReadNumber_scrollTop] / local_lineHeight));
    
    // The render function needs to localize these variables to avoid accessing global scope variables which would take longer than a local. (part 1 of 4)
    let local_prevVli = ints[fEDI_ONSCROLLvirtualIndexLine];
    let local_currVli = ints[fEDI_virtualIndexLine];
    ints[fEDI_ONSCROLLvirtualIndexLine] = local_currVli;

    // TODO: Instead of adding 1000 here you should do it when you check the debounce
    ints[fEDI_scrollEndDeadline] = timestamp + 1000; // TODO: Move this to the scroll event handler (probably-maybe)

    // TODO: !... vs checking for 0 or 1... '===', then '!', then '=='
    // because '===' skips any check for type coercion
    if (ints[fEDI_intFalsey_isScrolling] === 0) {
        // The render function needs to localize these variables to avoid accessing global scope variables which would take longer than a local. (part 2 of 4)
        // ...and here the locals are passed to the LeadingEdge because only when performing the LeadingEdge do you need to use the global versions.

        if (EDI_onScroll_LeadingEdge(local_prevVli, local_currVli)) return; // This if statement reads poorly. You return for a reason that isn't gleaned by reading the function name alone.
        
        // The render function needs to localize these variables to avoid accessing global scope variables which would take longer than a local. (part 4 of 4)
        // ...and here the locals assigned the same value as the globals in case 'EDI_onScroll_LeadingEdge' modified the globals.
        local_prevVli = ints[fEDI_prevVli];
        local_currVli = ints[fEDI_currVli];
    }

    ints[fEDI_ONSCROLLscrollTop] = ints[fEDI_lastReadNumber_scrollTop]; // TODO: Move this to the scroll event handler (probably-maybe)

    // TODO: Move this to the leading edge? (maybe)
    if (ints[fEDI_cursor_editKind] !== EditKind_None) {
        // TODO: Timing issue, someone typing while they scroll
        // TODO: You need to finalize all the cursors not just the primary
        // TODO: You probably need to "check all the cursors" too not just the primary
        EDI_finalizeEdit();
    }

    // TODO: Consider moving the 0 diff case to the soonest possible line to skip as much code as possible.
    let diff = local_currVli - local_prevVli;
    if (diff === 0) return;

    let lowerBound;
    let upperBound;
    let beltIndexLine; // The 0th loop will increment somewhat awkwardly. see the: "This decrement avoids that." comments for each case.

    let local_ArrayFrom_textElement_children_length = ints[fEDI_ArrayFrom_textElement_children_length];
    let local_ArrayFrom_gutter_children = ArrayFrom_gutter_children;
    let local_ArrayFrom_textElement_children = ArrayFrom_textElement_children;
    let EDI_lineEndPositionList_data = EDI_lineEndPositionList.data;
    let EDI_lineEndPositionList_count = EDI_lineEndPositionList.count;
    let EDI_textByteList_bytes = EDI_textByteList.bytes;
    let local_EDI_decoder = EDI_decoder;

    if (diff > 0 && diff < ints[fEDI_virtualCount]) {

        ints[fEDI_sum_diffPositive] += diff;

        // Note: this case has 'vertical = (ints[fEDI_prevVli] + ints[fEDI_virtualCount]) * local_lineHeight;' I believe 'ints[fEDI_virtualCount]' === 'ints[fEDI_ONSCROLLvirtualCount]' in this case, thus all vertical calculations can be moved after the if statements to be lowerBound * ... All cases other than this one were exact 1 to 1 matches.
        lowerBound = local_prevVli + ints[fEDI_ONSCROLLvirtualCount];
        upperBound = lowerBound + diff;

        beltIndexLine = ints[fEDI_EDI_beltIndexZero] - 1 /*This decrement avoids that.*/;

        ints[fEDI_EDI_beltIndexZero] = (beltIndexLine + 1/*This decrement avoids that... but here you need to undo it for a moment*/ + diff) % local_ArrayFrom_textElement_children_length;
    }
    else if (diff < 0 && (diff *= -1) < ints[fEDI_virtualCount]) {

        ints[fEDI_sum_diffNegative] += diff;

        lowerBound = local_currVli;
        upperBound = lowerBound + diff;

        ints[fEDI_EDI_beltIndexZero] = (
            (/*let lastIndex = */(ints[fEDI_EDI_beltIndexZero] - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length) -
            (diff - 1) + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;

        beltIndexLine = ints[fEDI_EDI_beltIndexZero] - 1/*This decrement avoids that.*/;
    }
    else {
        lowerBound = local_currVli;
        upperBound = lowerBound + ints[fEDI_virtualCount];

        ints[fEDI_sum_diffPositive] += ints[fEDI_virtualCount];

        beltIndexLine = ints[fEDI_EDI_beltIndexZero] - 1/*This decrement avoids that.*/;
    }

    let vertical = lowerBound * local_lineHeight;

    // Important detail to consider: the lines that are >= EDI_lineEndPositionList_count will continually increment lineStart by 1 So if you expect this to accurately represent the EOF position when it is in view, it probably does NOT.
    // TODO: I think I saw how to do it in a way that is more sensible. There is no reason to not just put the lineStart = lineEnd + 1 inside the if that is immediately following I think? Then you'd avoid this 'note'... ugh for completeness I need to mention that this would be an issue now that I see it. You have lineEnd = -1 so then you'd need a note for that unless you changed the initial value to be 0 somehow or something, just idk.
    let lineStart = 0;
    let lineEnd;
    if (lowerBound < EDI_lineEndPositionList_count) {
        if (lowerBound === 0) {
            lineEnd = -1;
        }
        else {
            lineEnd = EDI_lineEndPositionList_data[lowerBound - 1];
        }
    }
    else {
        lineEnd = -1;
    }

    for (var indexLine = lowerBound; indexLine < upperBound; indexLine++) {
        
        beltIndexLine = (beltIndexLine + 1) % local_ArrayFrom_textElement_children_length;

        let gutter = local_ArrayFrom_gutter_children[beltIndexLine];
        let div = local_ArrayFrom_textElement_children[beltIndexLine];

        lineStart = lineEnd + 1;
        if (indexLine < EDI_lineEndPositionList_count) {
            gutter.textContent = indexLine + 1;
            lineEnd = EDI_lineEndPositionList_data[indexLine];
        }
        else {
            gutter.textContent = '~';
            lineEnd = lineStart;
        }

        // Corrupt state if assumption is not met: - All lines of text are to contain at least 1 span at all times even if that span is just an empty one.
        let span = div.children[0];
        span.className = 'eN';
        span.textContent = lineStart === lineEnd ? '' : local_EDI_decoder.decode(EDI_textByteList_bytes.subarray(lineStart, lineEnd));

        for (let i = div.children.length - 1; i >= 1; i--) {
            div.removeChild(div.children[i]);
        }

        let translateY = `translateY(${vertical}px)`;
        vertical += local_lineHeight; // TODO: Hoist this straight up the value that was in the array it is inside a loop

        gutter.style.transform = translateY;
        div.style.transform = translateY;
    }
}

/**
 * @returns true if scrollTop (and a few other details) have not changed, thus indicating the invoker should immediately return from their own rather than continuing with scroll logic.
 */
function EDI_onScroll_LeadingEdge(local_prevVli, local_currVli) {
    const ints = gINT_FIELDS;
    
    // The render function needs to localize these variables to avoid accessing global scope variables which would take longer than a local. (part 2 of 4)
    // ...and here the locals are moved to the global scope.
    ints[fEDI_prevVli] = local_prevVli;
    ints[fEDI_currVli] = local_currVli;

    ints[fEDI_intFalsey_isScrolling] = 1;

    // TODO: If you can prove that the leading edge or 'ints[fEDI_intFalsey_isScrolling]' is "equivalent" to 'gBYTE_FIELDS[byteisCheckingTrailingEdge]' then you can reduce the code here.
    //
    // If we aren't tracking the trailing edge yet, start the rAF countdown loop
    if (!gBYTE_FIELDS[byteisCheckingTrailingEdge]) {
        gBYTE_FIELDS[byteisCheckingTrailingEdge] = true;
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
    }

    EDI_finalizeAllCursors();

    if (ints[fEDI_ONSCROLLscrollTop] === ints[fEDI_lastReadNumber_scrollTop] &&
        ints[fEDI_prevVli] === ints[fEDI_virtualIndexLine] &&
        ints[fEDI_ONSCROLLvirtualCount] === ints[fEDI_virtualCount]) {
            // TODO: this is directly tied to a scroll event on EDI_baseElement so handle it from there perhaps?
            // TODO: this code is duplicated inside EDI_drawHorizontalScrollbar, reduce duplication?
            if (EDI_horizontal_scrollbar.scrollLeft !== ints[fEDI_lastReadNumber_scrollLeft]) {
                EDI_horizontal_scrollbar.scrollLeft = ints[fEDI_lastReadNumber_scrollLeft];
            }
            return true;
    }

    if (ints[fEDI_ONSCROLLvirtualCount] !== ints[fEDI_virtualCount]) {
            // Force case 3
            //
            // An overflow will wrap around and still give you a diff of 'ints[fEDI_virtualCount]'.
            // You cannot modify 'gINT_FIELDS[fEDI_currVli]' because the value is used by case '3' itself.
            //
            // This is very awkward because all other UI that has this sliding window logic just uses 'gINT_FIELDS[fEDI_currVli]'.
            //
            // The reason is because they're also re-evaluating their equivalent of 'ints[fEDI_virtualIndexLine]'.
            //
            // The editor has a local variable 'let local_currVli = ints[fEDI_virtualIndexLine];'
            // 
            // If you scroll enough to get a case 3 (full screen "draw") rather than doing some hacky forcing of case 3
            // you'll find that 'ints[fEDI_virtualIndexLine]' within case 3 is
            // equal to 'local_currVli'.
            //
            // But 'ints[fEDI_virtualIndexLine]' was being used within case 3
            // due to this awkward setting of the 'gINT_FIELDS[fEDI_currVli]' when doing a hack to force case 3.
            //
            // This meant case 3 was incurring an extra global variable lookup (global variable lookup of 'gINT_FIELDS')
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
            // TODO: Look into all the usages of 'gINT_FIELDS[fEDI_prevVli] and gINT_FIELDS[fEDI_currVli]' or like hacks to force cases
            //
            // TODO: What happens when you overflow 'gINT_FIELDS[fEDI_prevVli]' does it overflow such that you're the correct diff?
            //
            ints[fEDI_prevVli] = ints[fEDI_currVli] + ints[fEDI_virtualCount];
            //ints[fEDI_prevVli] = 0;
            //ints[fEDI_currVli] = ints[fEDI_virtualCount];

            EDI_render_do_CreateViewport();
            return false;
    }

    return false;
}

function EDI_render_do_ScrollTrailingEdgeCheck(timestamp) {
    // If the scroll deadline hasn't been met yet, keep checking on the next frame
    if (timestamp < gINT_FIELDS[fEDI_scrollEndDeadline]) {
        requestAnimationFrame(EDI_render_do_ScrollTrailingEdgeCheck);
        return;
    }

    // The 1,000ms has passed! Fire your trailing edge logic safely
    EDI_onScroll_TrailingEdge();
}

/**
 * must set 'gINT_FIELDS[fEDI_intFalsey_isScrolling] = 0;' within this function.
 */
function EDI_onScroll_TrailingEdge() {
    gINT_FIELDS[fEDI_intFalsey_isScrolling] = 0;
    gBYTE_FIELDS[byteisCheckingTrailingEdge] = false; // Reset the flag here
    EDI_render_request(RenderKind_SyntaxHighlighting);
}


// the scroll layout happens before the finalize???

/*
TODO: for function 2, you need to determine whether you will lex the
- [ ] textContent on the span,
- [ ] or if you will decode from the bytes again.

I'm going to do
- [ ] textContent on the span,

but there is 0 reasoning, understanding, or measurements behind my decision.
*/

function EDI_render_do_SyntaxHighlighting() {

    const ints = gINT_FIELDS;

    let local_sum_diffNegative = ints[fEDI_sum_diffNegative];
    let local_sum_diffPositive = ints[fEDI_sum_diffPositive];
    let total_diff = local_sum_diffNegative + local_sum_diffPositive;

    /*
    it's wrong wait
    I see what's going on

    You can't just sum them because overlap cancels out sometimes

    if you have both but no full the larger side is cancelled out by the smaller amount
    I think...

    I'm gonna rain check that one... I'm thinking about more than 1 instance of an overlap breaking that math
    */
    
    ints[fEDI_sum_diffNegative] = 0;
    ints[fEDI_sum_diffPositive] = 0;

    if (total_diff === 0) return;

    let i = 0;
    
    let beltIndexCurrent = ints[fEDI_EDI_beltIndexZero];
    let indexLine = ints[fEDI_virtualIndexLine];

    let i_bounded = 0;

    let bothButNotFull = false;

    if (total_diff >= ints[fEDI_virtualCount]) {
        total_diff = ints[fEDI_virtualCount];
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

            beltIndexCurrent = (beltIndexCurrent - 1 + ints[fEDI_ArrayFrom_textElement_children_length]) % ints[fEDI_ArrayFrom_textElement_children_length];
            indexLine = indexLine + ints[fEDI_virtualCount] - 1;
            
            for (; i < local_sum_diffPositive_MINUS_ONE; i++) {
                beltIndexCurrent = (beltIndexCurrent - 1 + ints[fEDI_ArrayFrom_textElement_children_length]) % ints[fEDI_ArrayFrom_textElement_children_length];
                indexLine--;
            }

            i = originalI;
            i_bounded = local_sum_diffPositive;
        }
    }

    let local_EDI_lineEndPositionList_data = EDI_lineEndPositionList.data;
    let local_EDI_lineEndPositionList_count = EDI_lineEndPositionList.count;

    // Important detail to consider: the lines that are >= EDI_lineEndPositionList_count will continually increment lineStart by 1 So if you expect this to accurately represent the EOF position when it is in view, it probably does NOT.
    // TODO: I think I saw how to do it in a way that is more sensible. There is no reason to not just put the lineStart = lineEnd + 1 inside the if that is immediately following I think? Then you'd avoid this 'note'... ugh for completeness I need to mention that this would be an issue now that I see it. You have lineEnd = -1 so then you'd need a note for that unless you changed the initial value to be 0 somehow or something, just idk.
    let lineStart = 0;
    let lineEnd;
    if (indexLine < local_EDI_lineEndPositionList_count) {
        if (indexLine === 0)
            lineEnd = -1;
        else
            lineEnd = local_EDI_lineEndPositionList_data[indexLine - 1];
    }
    else {
        lineEnd = -1;
    }

    let trackedSyntax_I = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLine);
    if (trackedSyntax_I === NaN || trackedSyntax_I === -1)
        trackedSyntax_I = EDI_trackedSyntaxList.count_abstract;
    
    for (; i < i_bounded; i++) {
        // short circuit avoid double dipping of c++ internals, only the 'bothButNotFull' is inaccurate at the moment.
        if (!bothButNotFull || ArrayFrom_textElement_children[beltIndexCurrent].children[0].className === 'eN') {
            ArrayFrom_textElement_children[beltIndexCurrent].children[0].className = '';
    
            lineStart = lineEnd + 1;
            if (indexLine < local_EDI_lineEndPositionList_count) {
                lineEnd = local_EDI_lineEndPositionList_data[indexLine];
            }
            else {
                lineEnd = lineStart;
            }
    
            trackedSyntax_I = JS_line_lex_newVersion(ArrayFrom_textElement_children[beltIndexCurrent], beltIndexCurrent, trackedSyntax_I, lineStart);
        }
        else {
            //console.log("(did nothing) if (ArrayFrom_textElement_children[beltIndexCurrent].children[0].className !== 'eN') {");
        }

        // The code would be written like this:
        // EDI_beltIndexLine_mutate_NEXT(beltIndexCurrent);
        //
        //
        // ++beltIndexCurrent >= ints[fEDI_ArrayFrom_textElement_children_length] ? beltIndexCurrent -= ints[fEDI_ArrayFrom_textElement_children_length] : beltIndexCurrent;
        //
        //
        // You might have to be careful though because it doesn't come with parenthesis. If you tried nesting it.
        //
        beltIndexCurrent = (beltIndexCurrent + 1) % ints[fEDI_ArrayFrom_textElement_children_length];

        indexLine++;
    }

    if (bothButNotFull) {
        ints[fEDI_sum_diffPositive] = local_sum_diffPositive;
        EDI_render_do_SyntaxHighlighting();
    }
}

/*
old comments from EDI_render_do_SyntaxHighlighting
that are taking up space and causing cognitive overhead
but I also don't have energy to read and determine whether they're valuable or not at the moment.
I'm only moving the ones that seem to NOT be valuable here.
More accurately the ones that seem to not have an importance of position, they don't have to be above a certain line of code in the function they just kinda "relate" to the function overall.



    - [x] I wonder if I can keep track of two variables
    the sum of negative diff
    the sum of positive diff

    then avoid the className check entirely

    ======

    - [ ] ^ but for the tree view

    - [ ] trackedSyntax_I = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLine);
        - [ ] passing this in would be nice (for the cases where it is contiguous or something)
        - [ ] Like the incrementing one after another can re-use
        - [ ] maybe the decrementing but maybe not
            - [ ] but you could just determine the ending position of the reverse loop and then reverse it so that it is forwards


// - [ ] TODO: lineStart, and lineEnd; these are currently being retrieved via "random access"...
    // ...But,  this logic currently goes from 1 indexLine to the very next indexLine by a difference of '1'.
    // Currently, there is not any logic for code folding.
    // I do not initially believe there is a benefit to leaving the code in the current state by some argument of
    // "optimizing that the next line is an indexLine of 1, rather than 'random access' would not work if code folding were ever added".
    // ...
    // I believe this in part because I don't believe the code in its current state would work if code folding were ever added.
    // And thus an argument of that kind ought to suggest that the current code is applicable when using a code folding feature.
    // But ultimately I believe these changes one way or the other are "extremely trivial" given that they're common patterns in the codebase
    // and can be changed to whatever well known manner is preferable at any moment within this "black box" of a function.
    // ... 
    // That felt kinda rambly... what I'm saying is:
    // "The lineStart of the next line is the lineEnd of the previous line + 1"
    // - [ ] TODO: in reference to the above TODO about "lineStart, and lineEnd;"...
    // ...'EDI_onScroll_WRAPIT()' actually has the same logic in it. And that is running synchronously ever scroll event, so you should 100% prioritize that today above anything.
    //
    // 
    // - [ ] TODO: get the initial trackedSyntax_i, then just keep re-using it, rather than doing the binary search for the trackedSyntax_i every line. (pass it in to / return from 'JS_line_lex_newVersion')
    //
    // - [ ] TODO: There is something in this method that is decently pointless overhead relating to...:
    //     - An empty line, a line only consisting of whitespace, or a line that is indented.
    //         - ...this one is perhaps less obvious from a non-branching perspective. And perhaps even just adding a conditional branch that avoids invoking 'JS_line_lex_newVersion' in this case is worthwhile.
    //     - A line that is out of bounds of 'indexLine < EDI_lineEndPositionList.count'
    //         - ...consider separating the loop bounds in some way to remove conditional branches related to 'if (indexLine < EDI_lineEndPositionList.count)'
    //
    // - [ ] TODO: The reverse case currently loops in reverse...
    // ...this means the above 'TODO' cases won't be applicable there, they'll only work for the initial forwards case. So:
    //     - [ ] determine the smallest index that will be handled by the reverse case and then start from there?
    //
    // - [x] TODO: Checking the length is 1 is probably not useful; short of there having been "corrupt state" from someone messing with developer tools or an exception having stopped code early, but it doesn't feel sensible to cover these cases here.
    //
    // - [ ] TODO: If you have nothing better to do with you time: give a moment of thought to the reference chasing that may or may not be occuring inside these loops...
    // ...it is hard to say:
    // 1. because the engine is gonna do optimizations that I don't necessarily understand completely
    // 2. the fully optimized "minimal reference chasing" solution might be only nominal
    // 3. ummm
    // 
    // 
    // - [ ] TODO: rename the 'trackedSyntaxExhausted' variable because it makes me anxious that I will manifest that state of being into reality whenever I read the variable name.
    //
    // - [ ] You really should do the logic to not include lines of text that are just whitespace in the preprocessor.cjs cause you now are getting the babel note:
    //     - [ ] [BABEL] Note: The code generator has deoptimised the styling of C:\Users\hunte\Repos\New folder (3)\Edit\preprocessor\__PREPROCESSEDbundle__.js as it exceeds the max of 500KB.
    //     - ... I don't actually know if they're counting whitespace as part of that 500KB, I'd presume they are so you should stop doing it. At least when it comes to the comments that are indented, and you include the indentation for no reason even though you removed the comment.

//if (diff > 0 && diff < gINT_FIELDS[fEDI_virtualCount]) {
    //    
    //}
    //else if (diff < 0 && (diff *= -1) < gINT_FIELDS[fEDI_virtualCount]) {
    //    
    //}
    //else {
    //    
    //}
//
    //for (var indexLine = lowerBound; indexLine < upperBound; indexLine++) {
    //    
    //}

    //You know there's diff many lines to syntax highlight.
    //You can guess that is diff < gINT_FIELDS[fEDI_virtualCount]
    //that you'll start at 'gINT_FIELDS[fEDI_EDI_beltIndexZero]'
    //and loop diff amount of times.
//
    //Then you maybe have to check the next div whether it has the not syntax highlighted css class
    //in case many scroll events occured and somehow if this results you lose information you have add a step if needed to check
    //and do it only at the edge instead of entire.
//
    //It's always either the first or last.
    //So your edges to check might be 'gINT_FIELDS[fEDI_EDI_beltIndexZero]' and PREVIOUS('gINT_FIELDS[fEDI_EDI_beltIndexZero]')
//
    //Then you can loop positive or negative depending on first or last.
//
    //My concern is with a scroll to a larger scrollY, then a scroll to a smaller scrollY
    //such that either scrollY are not equal, and that there is at least a difference of 1 lineHeight between both scrollY to ensure the changes aren't cancelling out.
//
    //I think then you'd need to edge check 'gINT_FIELDS[fEDI_EDI_beltIndexZero]' find a hit, loop until you no longer see the not syntax highlighted css class
    //then this tells you to edge check PREVIOUS('gINT_FIELDS[fEDI_EDI_beltIndexZero]') and the remainder of your 'diff' to loop is in reverse.
//
    //I'm trying to think about whether the scroll function could leave behind data that indicates to this function
    //whether it is a 'gINT_FIELDS[fEDI_EDI_beltIndexZero]', PREVIOUS('gINT_FIELDS[fEDI_EDI_beltIndexZero]'), or both case without checking the edge divs whether they have the not syntax highlighted css class.
*/

function EDI_state_clear() {

    const ints = gINT_FIELDS;

    // the smi would exist on the object instance all near one another if you just used a class
    // it is essentially the field buffer but you don't eat a global scope variable lookup at any point
    // and you have to incur 1 extra object at all times but that ought to be negligible.


    EDI_finalizeAllCursors_andClearNonPrimaryCursors();
    EDI_cursor_clear();
    set_EDI_recentBoundingClientRect_isNull_intFalsey(1);
    EDI_textSourceIdentifier = '';
    EDI_FORMATTED_textSourceIdentifier = '';
    gBYTE_FIELDS[byteEDI_extensionKind] = ExtensionKind_None;
    set_EDI_fileStartsWithBom(false);
    EDI_lineEndString = null;
    EDI_lineEndPositionList.clear();
    EDI_textByteList.clear();
    ints[fEDI_longestLine_indexLine] = 0;
    ints[fEDI_longestLine_length] = 0;
    
    // Explicitly inlining 'clearMulticursorState()' because it currently is and I just don't want to make a decision about this right now.
    // So what I can do is mark the code paragraph for later decision making.
    ints[fEDI_offsetLine] = 0;
    ints[fEDI_offsetColumn_withRespectToThisIndexLine] = 0;
    ints[fEDI_offsetColumn] = 0;
    ints[fEDI_totalShift] = 0;
    EDI_offsetWithinSpan_withRespectToThisSpan = null;
    ints[fEDI_offsetWithinSpan] = 0;
    
    EDI_trackedSyntaxList.clear();
}

function EDI_clear() {
    EDI_state_clear();
    EDI_render_request(RenderKind_Clear);
}

function EDI_state_setText(text, fileStartsWithBom, textSourceIdentifier, FORMATTED_textSourceIdentifier, extensionKind, lineEndString) {

    const ints = gINT_FIELDS;

    EDI_baseElement.scrollTop = 0;
    ints[fEDI_lastReadNumber_scrollTop] = 0;
    EDI_baseElement.scrollLeft = 0;
    ints[fEDI_lastReadNumber_scrollLeft] = 0;
    
    EDI_state_clear();

    set_EDI_fileStartsWithBom(fileStartsWithBom);

    EDI_textSourceIdentifier = textSourceIdentifier;
    EDI_FORMATTED_textSourceIdentifier = FORMATTED_textSourceIdentifier;
    gBYTE_FIELDS[byteEDI_extensionKind] = extensionKind;
    EDI_language_line_lex_SET(gBYTE_FIELDS[byteEDI_extensionKind]);
    EDI_lineEndString = lineEndString; // use 'lineEndString' for the within-loop checks of '!lineEndString' to avoid reading global scope during loop when 'lineEndString' is equivalent.

    let local_EDI_lineEndPositionList = EDI_lineEndPositionList;
    let local_EDI_textByteList = EDI_textByteList;

    /**
     * TODO: I don't know whether I should calculate this from the EDI_lineEndPositionList or some such...
     * ...But all in all this detail is nothing relative to me starting the code that tracks the longest line
     * so I stop drawing the horizontal scrollbar during some scroll events.
     * 
     * In terms of changing it after the fact it isn't a big deal is what I mean.
     */
    let lineLength = 0;

    // TODO: Insert multiple characters at the same time when you do this?

    for (var sourceI = 0; sourceI < text.length; sourceI++) {
        switch (text[sourceI]) {
            case '\r':
                if (sourceI < text.length - 1 & text[sourceI + 1] === '\n') {
                    if (!lineEndString) {
                        lineEndString = EDI_lineEndString = '\r\n';
                    }
                    sourceI++;
                }
                else {
                    if (!lineEndString) {
                        lineEndString = EDI_lineEndString = '\r';
                    }
                }
                if (lineLength > ints[fEDI_longestLine_length]) {
                    ints[fEDI_longestLine_length] = lineLength;
                    ints[fEDI_longestLine_indexLine] = local_EDI_lineEndPositionList.count;
                }
                lineLength = 0;
                local_EDI_lineEndPositionList.insert(local_EDI_lineEndPositionList.count, local_EDI_textByteList.count);
                local_EDI_textByteList.insert(local_EDI_textByteList.count, CONST_EDI_ASCII_LINE_FEED);
                break;
            case '\n':
                if (!lineEndString) {
                    lineEndString = EDI_lineEndString = '\n';
                }
                if (lineLength > ints[fEDI_longestLine_length]) {
                    ints[fEDI_longestLine_length] = lineLength;
                    ints[fEDI_longestLine_indexLine] = local_EDI_lineEndPositionList.count;
                }
                lineLength = 0;
                local_EDI_lineEndPositionList.insert(local_EDI_lineEndPositionList.count, local_EDI_textByteList.count);
                local_EDI_textByteList.insert(local_EDI_textByteList.count, CONST_EDI_ASCII_LINE_FEED);
                break;
            case '\t':
                lineLength += 4;
                local_EDI_textByteList.insertBytes(local_EDI_textByteList.count, EDI_tab_tabsbytes, /*offset*/ 0, /*length*/ 4);
                break;
            default:
                lineLength++;
                // TODO: add a function for '.add' and avoid the "pointless" passing of count in scenarios like this.
                //
                // tbh: TODO: 'charCodeAt' also might be more allocation expensive than you expect. It returns a JavaScript number. Switching and returning an index from byte array prehardcoded might avoid an allocation per number returned?
                // ... although I hear most engines store numbers such that the pointer represents the value and you avoid the allocation but even then where is the metadata that tells you how to read that pointer differently than the other ones etc...
                //
                local_EDI_textByteList.insert(local_EDI_textByteList.count, text.charCodeAt(sourceI));
                break;
        }
    }

    local_EDI_lineEndPositionList.insert(local_EDI_lineEndPositionList.count, local_EDI_textByteList.count);

    update_VirtualIndexLine();
    update_virtualCount();

    update_verticalVirtualizationBoundary();

    //switch (gBYTE_FIELDS[byteEDI_extensionKind]) {
    //    case ExtensionKind_JavaScript:
    //        // This 'JS_full_lex' only runs when you open a file for the first time.
    //        // The logic likely has some JIT overhead that is long term persistent in the GC. I have no proof of this but I need to look into it.
    //        // If so, moving this to be an LSP request to get the initial list of tracked syntax could be a massive improvement.
    //        EDI_trackedSyntaxList = JS_full_lex(EDI_textByteList.bytes, EDI_textByteList.count);
    //        let aaa = JSON.stringify(EDI_trackedSyntaxList);
    //        break;
    //}

    EDI_drawGutter_Width();
    EDI_draw_all_cursors();
    EDI_drawHorizontalScrollbar();
    // Force 'case 3' within 'EDI_onScroll_WRAPIT();' downstream
    // TODO: (this comment is being made sometime after this solution was written but from memory...)...
    // ...I believe this works because when you change the text you guarantee a virtual index line of '0' because the scrollTop gets moved to 0...
    // ...the partial solution is to set it to anything other than '0' so the editor detects that a line of text needs to be drawn...
    // ...but this isn't enough because you want the editor to draw every line, thus you make the difference...
    // ...in the virtual index line equal to the count of lines being displayed, i.e.: set virtual index line to 'gINT_FIELDS[fEDI_virtualCount]'...
    // ...then it sees the new value for virtual index line is 0...
    // ...the difference between the previous and new value is 'gINT_FIELDS[fEDI_virtualCount]'...
    // ...thus 'gINT_FIELDS[fEDI_virtualCount]' amount of lines get redrawn...
    // ...i.e.: the entire viewport is redrawn with the new file's text.
    ints[fEDI_ONSCROLLvirtualIndexLine] = ints[fEDI_virtualCount];
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
 * You may want to update the vertical virtualization boundary prior to actually updating the EDI_lineEndPositionList.
 * Thus this function takes a 'lineCount' which defaults to EDI_lineEndPositionList.count if falsey.
 * @param {number | null | undefined} lineCount In order to permit arbitrarily updating the vertical virtualization boundary, this takes a lineCount. If falsey, then EDI_lineEndPositionList.count is used.
 */
function update_verticalVirtualizationBoundary(lineCount) {
    if (!lineCount) lineCount = EDI_lineEndPositionList.count;
    EDI_virtualization_vertical.style.height = ((lineCount + gINT_FIELDS[fEDI_virtualCount] - 1) * gINT_FIELDS[fEDI_lineHeight]) + 'px';
}

/**
 * EDI_render_do_Scroll() has this function explicitly inlined (duplicated) within the source code.
 */
function update_VirtualIndexLine() {
    // If scrollTop were to cause synchronous layout calculation, then scrollLeft wouldn't have one because it'd already be calculated.
    // and vice versa.
    // thus it is thought you might as well touch scrollLeft too here, if you're going down this path.
    //
    gINT_FIELDS[fEDI_lastReadNumber_scrollLeft] = EDI_baseElement.scrollLeft;
    gINT_FIELDS[fEDI_lastReadNumber_scrollTop] = EDI_baseElement.scrollTop;
    // TODO: This floor logic seems very odd. Because given the previous and the current you can determine it without dividing maybe I think?
    gINT_FIELDS[fEDI_virtualIndexLine] = Math.floor(gINT_FIELDS[fEDI_lastReadNumber_scrollTop] / gINT_FIELDS[fEDI_lineHeight]);
}

function update_virtualCount() {
    gINT_FIELDS[fEDI_virtualCount] = Math.ceil(gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] / gINT_FIELDS[fEDI_lineHeight]);
}

/**
 * If the 'gINT_FIELDS[fEDI_drawn_count_of_digits_longest_line_number] === positiveNumbersOnly_countDigitsLoop(EDI_lineEndPositionList.count)'
 * then the function does nothing.
 * 
 * TODO: Track the min and max until length changes and then only 2 operations at worst case than while
 * 
 * @returns a bool indicating whether the gutter was drawn (if 'gINT_FIELDS[fEDI_drawn_count_of_digits_longest_line_number]' has not changed then false is returned because the gutter didn't need to be "re-" drawn)
 * 
 * Dependent UI: EDI_draw_all_cursors(); EDI_drawHorizontalScrollbar();
 * 
 * You either guarantee the dependent UI to run by invoking them regardless of this function's result 'EDI_drawGutter_Width(); EDI_draw_all_cursors(); EDI_drawHorizontalScrollbar();'
 * Or you capture the return value to know whether the gutter was "re-" drawn, because if so, you need to invoke 'EDI_draw_all_cursors(); EDI_drawHorizontalScrollbar();'
 * for the dependent UI.
 * The confusion, if there is any, comes from the dependent UI in some scenarios being required independently of whether drawGutter changes. And at other times they're solely dependent on whether drawGutter changes.
 */
function EDI_drawGutter_Width() {
    const ints = gINT_FIELDS;
    let count = EDI_lineEndPositionList.count;
    if (gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] !== EnterKeyEventKind_None) {
        count += 1;
    }
    let digitCountOfLargestLineNumber = positiveNumbersOnly_countDigitsLoop(count);
    if (ints[fEDI_drawn_count_of_digits_longest_line_number] === digitCountOfLargestLineNumber) return false;

    ints[fEDI_drawn_count_of_digits_longest_line_number] = digitCountOfLargestLineNumber;

    ints[fEDI_gutterWidthStyleValue] = Math.ceil(digitCountOfLargestLineNumber * EDI_characterWidth);
    ints[fEDI_gutterWidthTotal] = ints[fEDI_gutterWidthStyleValue] + CONST_EDI_gutterPaddingLeft + CONST_EDI_gutterPaddingRight;
    gutterWidthTotal_withPxUnits = `${ints[fEDI_gutterWidthTotal]}px`;

    let gutterWidth = ints[fEDI_gutterWidthStyleValue] + 'px';
    EDI_gutter.style.width = gutterWidth;
    EDI_gutterBackgroundColor.style.width = gutterWidth;

    for (let i = 0; i < ints[fEDI_ArrayFrom_textElement_children_length]/*a 'ArrayFrom_gutter_children_length' would always be equal to the textElement equivalent*/; i++) {
        ArrayFrom_gutter_children[i].style.width = gutterWidth;
    }
    
    for (let i = 0; i < ints[fEDI_ArrayFrom_textElement_children_length]; i++) {
        ArrayFrom_textElement_children[i].style.left = gutterWidthTotal_withPxUnits;
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
    const ints = gINT_FIELDS;
    if (ints[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] !== ints[fEDI_gutterWidthTotal]) {
        EDI_horizontal_scrollbar.style.left = gutterWidthTotal_withPxUnits;
        ints[fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left] = ints[fEDI_gutterWidthTotal];
    }

    if (ints[fEDI_EDI_horizontal_scrollbar_widthValue] !== (EDI_baseElement.clientWidth - ints[fEDI_gutterWidthTotal])) {
        ints[fEDI_EDI_horizontal_scrollbar_widthValue] = EDI_baseElement.clientWidth - ints[fEDI_gutterWidthTotal];
        EDI_horizontal_scrollbar.style.width = ints[fEDI_EDI_horizontal_scrollbar_widthValue] + 'px';
    }

    if (ints[fEDI_longestLine_length] !== ints[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar]) {
        
        ints[fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar] = ints[fEDI_longestLine_length];

        ints[fEDI_contentWidth] = Math.ceil(ints[fEDI_longestLine_length] * EDI_characterWidth);

        if ((ints[fEDI_contentWidth] < (EDI_baseElement.clientWidth - ints[fEDI_gutterWidthTotal])) && (EDI_baseElement.clientWidth - ints[fEDI_gutterWidthTotal] > 0)) {
            ints[fEDI_contentWidth] = Math.floor(EDI_baseElement.clientWidth - ints[fEDI_gutterWidthTotal]);
        }

        let local_EDI_horizontal_scrollbar_virtualization_boundary_style_width = ints[fEDI_contentWidth] + 'px';

        EDI_horizontal_scrollbar_virtualization_boundary.style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
        EDI_virtualization_horizontal.style.width = ints[fEDI_contentWidth] + ints[fEDI_gutterWidthTotal] + 'px';

        for (let i = 0; i < ints[fEDI_ArrayFrom_textElement_children_length]; i++) {
            ArrayFrom_textElement_children[i].style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
        }

        EDI_cursor_caretRow.style.width = local_EDI_horizontal_scrollbar_virtualization_boundary_style_width;
    }
    
    // TODO: this is directly tied to a scroll event on EDI_baseElement so handle it from there perhaps?
    // TODO: this code is duplicated inside EDI_onScroll_WRAPIT when it returns early due to nothing vertically having changed, reduce duplication?
    // TODO: 'ints[fEDI_lastReadNumber_scrollLeft]' here?
    if (EDI_horizontal_scrollbar.scrollLeft !== EDI_baseElement.scrollLeft) {
        EDI_horizontal_scrollbar.scrollLeft = EDI_baseElement.scrollLeft;
    }
}

/**
 * This function finalizes any pending edits foreach cursor in the EDI_cursorList.
 * 
 * Does NOT clear multicursors, only finalizes their respective edits;
 * 
 * see also: 'EDI_finalizeAllCursors_andClearNonPrimaryCursors'
 * 
 * TODO: many places where this is invoked, it is likely intended to actually invoke 'EDI_finalizeAllCursors_andClearNonPrimaryCursors'...
 * ...in order to permit slow 1 by 1 support for multicursor foreach scenario...
 * ...actually that's a good point...
 * ...you might wanna start by enabling multi-cursor insertion, but anything else invokes 'EDI_finalizeAllCursors_andClearNonPrimaryCursors'...
 * ...then you can slowly add in support without breaking things?...
 * ...so specifically what I'm saying here is, an upcoming task would be...
 * ...simply to ensure that nearly every event invokes 'EDI_finalizeAllCursors_andClearNonPrimaryCursors'...
 * ...and that the ones which can't i.e.: batch insertions; you could do a check if cursor count >1 then finalize only the non-primary or some such...
 * ...then you remove the safeguard for 1 feature at a time.
 */
function EDI_finalizeAllCursors() {
    EDI_finalizeEdit();
}

/**
 * This function finalizes pending edits foreach cursor in the EDI_cursorList
 * AND removes any non-EDI_primaryCursor from the EDI_cursorList.
 * 
 * see also: 'EDI_finalizeAllCursors'
 * 
 * TODO: a good name for this function
 */
function EDI_finalizeAllCursors_andClearNonPrimaryCursors() {
    EDI_finalizeEdit();
}

/**
 * TODO: Exception during finalize softlocks the editor because you can't even clear to reset the state: 'Uncaught (in promise) Error: removeAt(...): index > this.count'
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

    switch (gINT_FIELDS[fEDI_cursor_editKind]) {
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
    if (indexLine_editOccurredOn >= 0 && indexLine_editOccurredOn < EDI_lineEndPositionList.count) {
        if (EDI_gutter.children.length === gINT_FIELDS[fEDI_virtualCount] &&
            EDI_textElement.children.length === gINT_FIELDS[fEDI_virtualCount]) {

                // TODO: The 'awkward explicit inlining' for this case isn't seemingly working...
                // ...I need to type 'function' then more characters until I hit 32 and force a finalization of the edit due to the length being too long.
                // 'function' should've received a keyword syntax highlighting but it didn't...
                // - But I'm not sure if this code even was working prior.
                // - I've actually wanted to remove it for some time
                // - I debugged it and line by line as I step it all looks correct.
                // so I gotta try it in other places.
                
                // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
                // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                let beltIndexLine = (indexLine_editOccurredOn + gINT_FIELDS[fEDI_offsetLine]) - gINT_FIELDS[fEDI_virtualIndexLine];
                if (beltIndexLine >= gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine < 0) beltIndexLine = -1;
                else beltIndexLine = (beltIndexLine + gINT_FIELDS[fEDI_EDI_beltIndexZero]) % gINT_FIELDS[fEDI_virtualCount];

                if (beltIndexLine >= 0) {
                    let gutterLineElement = EDI_gutter.children[beltIndexLine];
                    gutterLineElement.innerHTML = '';
                    let textLineElement = EDI_textElement.children[beltIndexLine];
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
    const ints = gINT_FIELDS;

    for (let i = EDI_lineEndPositionList.count - 1; i >= 0; i--) {
        if (ints[fEDI_cursor_editPosition] <= EDI_lineEndPositionList.data[i]) {
            EDI_lineEndPositionList.data[i] += ints[fEDI_cursor_editLength];
        }
        else {
            if (i === EDI_lineEndPositionList.count - 1) {
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
        if (ints[fEDI_cursor_editPosition] <= ints[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_cursor_editLength]);
        }
        else if (gBYTE_FIELDS[byteEDI_pooledTrackedSyntax_trackedSyntaxKind] === TrackedSyntaxKind_Comment &&
                ints[fEDI_cursor_editPosition] === ints[fEDI_pooledTrackedSyntax_start] + 1) {

            // TODO: Insertion of '*' probably shouldn't remove.
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (ints[fEDI_cursor_editPosition] > ints[fEDI_pooledTrackedSyntax_start] && ints[fEDI_cursor_editPosition] < ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, ints[fEDI_pooledTrackedSyntax_length] + ints[fEDI_cursor_editLength]);
        }
    }
    EDI_textByteList.insertBytes(ints[fEDI_cursor_editPosition], EDI_cursor_gapBuffer, /*offset*/ 0, /*length*/ ints[fEDI_cursor_gapBufferCount]);

    let textSourceIdentifier = EDI_FORMATTED_textSourceIdentifier;
    EDI_getLineAndColumnIndices(ints[fEDI_cursor_editPosition]);
    let lineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
    let lineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    // TODO: Account for any '\t\0\0\0' that exist on the line
    let text = EDI_decoder.decode(EDI_cursor_gapBuffer.subarray(0, ints[fEDI_cursor_gapBufferCount]));
    ints[F_didChangeTextDocument_version] = ints[F_didChangeTextDocument_version] + 1;
    let version = ints[F_didChangeTextDocument_version];

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

    if (indexLine_editOccurredOn === ints[fEDI_longestLine_indexLine]) {
        ints[fEDI_longestLine_length] = ints[fEDI_longestLine_length] + ints[fEDI_cursor_editLength];
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Enter(indexLine_editOccurredOn) {
    const ints = gINT_FIELDS;

    if (ints[fEDI_cursor_editRenderedDisplacement] !== ints[fEDI_cursor_editLength]) {
        EDI_render_do_EnterKey();
    }

    // TODO: A notification needs to sent to the LSP here

    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(ints[fEDI_cursor_editPosition], ints[fEDI_cursor_editLength]);

    // throws an exception if 'EnterKeyEventKind_None' (...or falsey).
    if (!gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] || gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] === EnterKeyEventKind_None) { EDI_finalizeEdit_ClearEditState(); throw new Error('if (!enterKeyEventKind...)'); }

    EDI_textByteList.insertBytes(ints[fEDI_cursor_editPosition], EDI_cursor_enterKey_newLinePlusIndentation_byteList.bytes, /*offset*/ 0, EDI_cursor_enterKey_newLinePlusIndentation_byteList.count);

    for (var i = ints[fEDI_cursor_editIndexLine]; i < EDI_lineEndPositionList.count; i++) {
        EDI_lineEndPositionList.data[i] += ints[fEDI_cursor_editLength];
    }

    // You need to consider if the longest line gets split
    if (ints[fEDI_cursor_editIndexLine] <= ints[fEDI_longestLine_indexLine])
        ints[fEDI_longestLine_indexLine] = ints[fEDI_longestLine_indexLine] + 1;

    EDI_lineEndPositionList.insert(ints[fEDI_cursor_editIndexLine], ints[fEDI_cursor_editPosition]);

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Tab(indexLine_editOccurredOn) {

    let that_four = 4;

    let bytes = EDI_on_tab_bytes;

    if (gINT_FIELDS[fEDI_cursor_editLength] > 1) {
        that_four *= gINT_FIELDS[fEDI_cursor_editLength];
        bytes = new Uint8Array(that_four);
        let src_bytes = EDI_on_tab_bytes;
        // TODO: typed array function usage
        for (let i = 0; i < that_four; i += 4) {
            for (let k = 0; k < 4; k++) {
                bytes[i + k] = src_bytes[k];
            }
        }
    }

    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(gINT_FIELDS[fEDI_cursor_editPosition], that_four);

    EDI_textByteList.insertBytes(gINT_FIELDS[fEDI_cursor_editPosition], bytes, /*offset*/ 0, /*length*/ that_four);

    for (var i = gINT_FIELDS[fEDI_cursor_editIndexLine]; i < EDI_lineEndPositionList.count; i++) {
        EDI_lineEndPositionList.data[i] += that_four;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_IndentMore(indexLine_editOccurredOn) {

    const ints = gINT_FIELDS;

    let startingIndex = ints[fEDI_indent_startingIndex];
    ints[fEDI_indent_startingIndex] = 0;
    let SMALL_lineAndColumnIndices_indexLine = ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];
    ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = 0;

    let ORIGINAL_incrementBy = (startingIndex + 1 - SMALL_lineAndColumnIndices_indexLine) * 4;
    let incrementBy = ORIGINAL_incrementBy;

    //let ORIGINAL_incrementBy = ints[fEDI_indent_ORIGINAL_indentBy];
    //let incrementBy = ints[fEDI_indent_ORIGINAL_indentBy];
    //ints[fEDI_indent_ORIGINAL_indentBy] = 0;

    let bytes = EDI_on_tab_bytes;
    let bytesLength = 4;

    if (ints[fEDI_cursor_editLength] > 1) {
        ORIGINAL_incrementBy *= ints[fEDI_cursor_editLength];
        incrementBy *= ints[fEDI_cursor_editLength];

        bytesLength *= ints[fEDI_cursor_editLength];
        bytes = new Uint8Array(bytesLength);
        let src_bytes = EDI_on_tab_bytes;
        // TODO: typed array function usage
        for (let i = 0; i < bytesLength; i += 4) {
            for (let k = 0; k < 4; k++) {
                bytes[i + k] = src_bytes[k];
            }
        }
    }

    startingLinePos_end = ints[fEDI_EDI_indentLess_startingLinePos_end];
    ints[fEDI_EDI_indentLess_startingLinePos_end] = 0;

    

    ///////////
    ///////////
    ///////////
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
        let linePos = EDI_getLineBoundaryPositions(lineI);

        for (; trackedSyntaxReposition_i >= 0; trackedSyntaxReposition_i--) {
            let start = EDI_trackedSyntaxList.getStart(trackedSyntaxReposition_i);
            if (linePos.start <= start) {
                // # There's a second (relative to this entire function) modification to the start positions of the tracked syntax list
                EDI_trackedSyntaxList.setStart(trackedSyntaxReposition_i, start + incrementBy);
            }
            else {
                break;
            }
        }
        EDI_trackedSyntaxList.getElementAt(trackedSyntaxReposition_i);
        if (linePos.start > ints[fEDI_pooledTrackedSyntax_start] && linePos.start < ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length]) {
            // # Then, you immediately know the trackedSyntax that encompasses the insertion (if it exists), so you increment its length by the text inserted on that respective line.
            EDI_trackedSyntaxList.setLength(trackedSyntaxReposition_i, ints[fEDI_pooledTrackedSyntax_length] + 4);
        }

        // # Insert the text on the respective line.
        EDI_textByteList.insertBytes(linePos.start, bytes, 0 /*offset*/, bytesLength /*length*/);
        
        // # Increment the entry in 'EDI_lineEndPositionList' for the respective line
        EDI_lineEndPositionList.data[lineI] += incrementBy;

        // # Each loop you reduce incrementBy, because you're initial starting the loop knowing you will eventually insert 4 characters on every line.
        //     # thus, the first iteration of the loop you're increasing that line's end position by the length of text inserted per line by the amount of lines.
        //     # The next iteration is a smaller indexLine so you decrement because you have the insertion of one less line to consider.
        bytesLength -= 4;
    }
    ///////////
    ///////////
    ///////////

    // # Any line that is not part of the selected set of lines, and is at a greater indexLine, needs to have their line end position entry updated.
    for (var lineI = startingIndex + 1; lineI < EDI_lineEndPositionList.count; lineI++) {
        EDI_lineEndPositionList.data[lineI] += ORIGINAL_incrementBy;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_IndentLess(indexLine_editOccurredOn) {

    const ints = gINT_FIELDS;

    // Both indentMore and indentLess have logic in the initial event that needs to be moved here.
    // Nevertheless there is a difference between indentLess and indentMore in that you cannot simply
    // multiply by n to get the decrement because it deals with the existence of whitespace to be removed so you need to actually sum this as you handle each event
    // so that when you get to the finalize you have it all sum'd up (although yes this logic probably doesn't even belong in the event but it is there and 1 thing at a time).

    //let ORIGINAL_decrementBy = ints[fEDI_indent_ORIGINAL_indentBy];
    //let decrementBy = ints[fEDI_indent_ORIGINAL_indentBy];
    //ints[fEDI_indent_ORIGINAL_indentBy] = 0;

    let startingIndex = ints[fEDI_indent_startingIndex];
    ints[fEDI_indent_startingIndex] = 0;
    let SMALL_lineAndColumnIndices_indexLine = ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];
    ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = 0;

    // !!!!!! watch out for the big breaks when hitting a tab presuming that_four is 4
    let that_four = 4;
    that_four *= ints[fEDI_cursor_editLength];
    let largestRank = ints[fEDI_cursor_editLength];

    // loop over the lines to sum the "amount" of whitespace being removed
    let DETERMINE_decrementBy = 0;
    for (var lineI = SMALL_lineAndColumnIndices_indexLine; lineI <= startingIndex; lineI++) {
        let linePos = EDI_getLineBoundaryPositions(lineI);
        let line = linePos;
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(lineI);
        let upperLimitIndexColumn;
        if (lastValidIndexColumn > that_four) {
            upperLimitIndexColumn = that_four;
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

            let c = getCharacter(line.start + i);
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
                    DETERMINE_decrementBy += 4;
                    rank++;
                    break;
                case '\0':
                    break;
                default:
                    break outer;
            }
        }
    }

    // Remember the total whitespace removed
    let ORIGINAL_decrementBy = DETERMINE_decrementBy;
    //ints[fEDI_indent_ORIGINAL_indentBy] = ORIGINAL_decrementBy;
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
    //        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
    //            ints[fEDI_cursor_selectionAnchor] -= count;
    //        }
    //        else {
    //            ints[fEDI_cursor_selectionEnd] -= count;
    //        }
    //    }
//
    //    if (ints[fEDI_cursor_indexLine] === SMALL_lineAndColumnIndices_indexLine) {
    //        ints[fEDI_cursor_indexColumn] -= count;
    //    }
    //}

    // TODO: This at a glance seems to not account for when the cursor is small-position-ended and large-position-anchored...
    // ...this is moving the cursor actually, maybe it is fine? but maybe it is logic that could've been done during a loop but instead you made a new one to separately do this?
    // Also, this entire function is terribly written. You seemingly hacked something together; the code doesn't feel self explanatory. Furthermore there are both a lack of comments (given the confusing nature of how this is written), and dead comments.
    //if (ints[fEDI_cursor_indexLine] !== SMALL_lineAndColumnIndices_indexLine) {
    //    let linePos = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
    //    let line = linePos;
    //    let lastValidIndexColumn = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);
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
    //    //let c = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
    //    // TODO: git blame the below todo and remind them to delete the dead code
    //    // TODO: Delete this dead code / use better formatting
    //    /*if (SMALL_pos > smallLinePos.start) {
    //        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
    //            ints[fEDI_cursor_selectionAnchor] -= count;
    //        }
    //        else {
    //            ints[fEDI_cursor_selectionEnd] -= count;
    //        }
    //    }*/
    //    //if (ints[fEDI_cursor_indexLine] === LARGE_lineAndColumnIndices.indexLine) {
    //    //    ints[fEDI_cursor_indexColumn] -= count;
    //    //}
    //}

    let trackedSyntaxReposition_i = EDI_trackedSyntaxReposition_find(ints[fEDI_EDI_indentLess_startingLinePos_end] + 1);
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
        let linePos = EDI_getLineBoundaryPositions(lineI);
        let line = linePos;
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(lineI);
        let upperLimitIndexColumn;
        if (lastValidIndexColumn > that_four) {
            upperLimitIndexColumn = that_four;
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

            let c = getCharacter(line.start + i);
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
                    innerRemoveCount += 4;
                    rank++;
                    break;
                case '\0':
                    break;
                default:
                    break outer;
            }
        }

        for (; trackedSyntaxReposition_i >= 0; trackedSyntaxReposition_i--) {
            let start = EDI_trackedSyntaxList.getStart(trackedSyntaxReposition_i);
            if (linePos.start <= start) {
                EDI_trackedSyntaxList.setStart(trackedSyntaxReposition_i, start - decrementBy);
            }
            else {
                break;
            }
        }
        EDI_trackedSyntaxList.getElementAt(trackedSyntaxReposition_i);
        if (linePos.start > ints[fEDI_pooledTrackedSyntax_start] && linePos.start < ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(trackedSyntaxReposition_i, ints[fEDI_pooledTrackedSyntax_length] - innerRemoveCount);
        }

        EDI_textByteList.removeAt(linePos.start, innerRemoveCount);
	    EDI_lineEndPositionList.data[lineI] -= decrementBy;

        decrementBy -= innerRemoveCount;
    }

    for (var lineI = startingIndex + 1; lineI < EDI_lineEndPositionList.count; lineI++) {
        EDI_lineEndPositionList.data[lineI] -= ORIGINAL_decrementBy;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Paste(indexLine_editOccurredOn) {

    const ints = gINT_FIELDS;
    
    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(ints[fEDI_cursor_editPosition], ints[fEDI_cursor_editLength]);
    
    let content = EDI_cursor_EDI_paste_clipboardContent;
    EDI_cursor_EDI_paste_clipboardContent = null;

    let linesInsertedCount = 0;
    let insertionLength = 0;

    for (var sourceI = 0; sourceI < content.length; sourceI++) {
        switch (content[sourceI]) {
            case '\t':
                EDI_textByteList.insertBytes(ints[fEDI_cursor_editPosition] + insertionLength, EDI_tab_tabsbytes, /*offset*/ 0, /*length*/ 4);
                insertionLength += 4;
                break;
            case '\n':
                EDI_textByteList.insert(ints[fEDI_cursor_editPosition] + insertionLength, CONST_EDI_ASCII_LINE_FEED);
                EDI_lineEndPositionList.insert(ints[fEDI_cursor_editIndexLine] + linesInsertedCount, ints[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            case '\r':
                if (sourceI < content.length - 1 && content[sourceI + 1] === '\n') {
                    sourceI++;
                }
                EDI_textByteList.insert(ints[fEDI_cursor_editPosition] + insertionLength, CONST_EDI_ASCII_LINE_FEED);
                EDI_lineEndPositionList.insert(ints[fEDI_cursor_editIndexLine] + linesInsertedCount, ints[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            default:
                EDI_textByteList.insert(ints[fEDI_cursor_editPosition] + insertionLength, content.charCodeAt(sourceI));
                insertionLength++;
                break;
        }
    }

    for (var i = ints[fEDI_cursor_editIndexLine] + linesInsertedCount; i < EDI_lineEndPositionList.count; i++) {
        EDI_lineEndPositionList.data[i] += insertionLength;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_Duplicate(indexLine_editOccurredOn) {

    const ints = gINT_FIELDS;

    EDI_trackedSyntaxList_inefficientUpdateStartAndLength(ints[fEDI_cursor_editPosition], ints[fEDI_cursor_editLength]);

    let small = ints[fEDI_cursor_EDI_duplicate_small];
    let length = ints[fEDI_cursor_EDI_duplicate_length];

    ints[fEDI_cursor_EDI_duplicate_small] = 0;
    ints[fEDI_cursor_EDI_duplicate_length] = 0;

    let linesInsertedCount = 0;
    let insertionLength = 0;

    EDI_textByteList.duplicateWithin(small, ints[fEDI_cursor_editPosition], length);
    
    // TODO: cursor between '\t\0\0\0' is presumed to be the concern of the editor, duplication logic presumes correctness i.e.: that if the '\t' is selected that the '\0\0\0' that come after is selected too...
    // ...and that no partial selection over those characters could ever occur.

    // TODO: You should be able to do this much faster than looping over the selected bytes since you know the line end positions that exist and would know whether the selection will insert line endings.

    for (let offset = 0; offset < length; offset++) {
        switch (EDI_textByteList.bytes[small + offset]) {
            case CONST_EDI_ASCII_TAB:
                insertionLength += 4; // ??? I think this is copy pasted from 'paste' logic where the tab would change to 4 characters total, in the case of duplication you get what you select.
                break;
            case CONST_EDI_ASCII_LINE_FEED:
                EDI_lineEndPositionList.insert(ints[fEDI_cursor_editIndexLine] + linesInsertedCount, ints[fEDI_cursor_editPosition] + insertionLength);
                insertionLength++;
                linesInsertedCount++;
                break;
            default:
                insertionLength++;
                break;
        }
    }

    for (var i = ints[fEDI_cursor_editIndexLine] + linesInsertedCount; i < EDI_lineEndPositionList.count; i++) {
        EDI_lineEndPositionList.data[i] += insertionLength;
    }

    EDI_finalizeEdit_ClearEditState();

    return indexLine_editOccurredOn;
}

function EDI_finalizeEdit_DeleteLtr_BackspaceRtl_RemoveTextNoBatching(indexLine_editOccurredOn) {

    const ints = gINT_FIELDS;

    // TODO: surely u'd get this before doing the edit?
    let startLineAndColumnIndices_indexLine;
    let startLineAndColumnIndices_indexColumn;
    if (ints[fEDI_cursor_editKind] === EditKind_RemoveTextNoBatching) {
        startLineAndColumnIndices_indexLine = ints[fEDI_cursor_editIndexLine];
        startLineAndColumnIndices_indexColumn = ints[fEDI_cursor_editIndexColumn];
    }
    else {
        EDI_getLineAndColumnIndices_raw(ints[fEDI_cursor_editPosition]);
        startLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        startLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    }
    let endLineAndColumnIndices_indexLine;
    let endLineAndColumnIndices_indexColumn;
    if (ints[fEDI_cursor_editKind] === EditKind_RemoveTextNoBatching) {
        endLineAndColumnIndices_indexLine = ints[fEDI_cursor_END_editIndexLine];
        endLineAndColumnIndices_indexColumn = ints[fEDI_cursor_END_editIndexColumn];
    }
    else {
        EDI_getLineAndColumnIndices_raw(ints[fEDI_cursor_editPosition] + ints[fEDI_cursor_editLength]);
        endLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        endLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    }

    if (ints[fEDI_cursor_editLineFeedCount] > 0) {
        let count = 0;
        let lastMatchedIndexLine = 0;
        for (let i = EDI_lineEndPositionList_PENDING.count - 1; i >= 0; i--) {
            let lineEndPos = EDI_lineEndPositionList_PENDING.data[i];
            if (ints[fEDI_cursor_editPosition] <= lineEndPos && ints[fEDI_cursor_editPosition] + ints[fEDI_cursor_editLength] > lineEndPos) {
                EDI_getLineAndColumnIndices_raw(lineEndPos);
                lastMatchedIndexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
                count++;
                EDI_lineEndPositionList_PENDING.removeAt(i, 1);
            }
            else if (ints[fEDI_cursor_editPosition] > lineEndPos) {
                break;
            }
        }
        if (count > 0) {
            EDI_lineEndPositionList.removeAt(lastMatchedIndexLine, count);
        }
    }
    for (let i = EDI_lineEndPositionList.count - 1; i >= 0; i--) {
        if (ints[fEDI_cursor_editPosition] < EDI_lineEndPositionList.data[i]) {
            EDI_lineEndPositionList.data[i] -= ints[fEDI_cursor_editLength];
        }
        else {
            if (i === EDI_lineEndPositionList.count - 1) {
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
        if (ints[fEDI_cursor_editPosition] < ints[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, ints[fEDI_pooledTrackedSyntax_start] - ints[fEDI_cursor_editLength]);
        }
        else if (ints[fEDI_pooledTrackedSyntax_start] >= ints[fEDI_cursor_editPosition] && ints[fEDI_pooledTrackedSyntax_start] < ints[fEDI_cursor_editPosition] + ints[fEDI_cursor_editLength]) {
            // TODO: This needs to remove more than 1 at a time
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (gBYTE_FIELDS[byteEDI_pooledTrackedSyntax_trackedSyntaxKind] === TrackedSyntaxKind_Comment &&
                (ints[fEDI_pooledTrackedSyntax_start] + 1) >= ints[fEDI_cursor_editPosition] && (ints[fEDI_pooledTrackedSyntax_start] + 1) < ints[fEDI_cursor_editPosition] + ints[fEDI_cursor_editLength]) {
            // TODO: You can invalidate a >1 char long by removing beyond just the first unless a character afterwards falls into place that is valid by chance
            //
            // only multi-line-comments that span multiple lines are stored in EDI_trackedSyntaxList with the 'TrackedSyntaxKind_Comment'
            //
            EDI_trackedSyntaxList.removeAt(i, 1);
        }
        else if (ints[fEDI_cursor_editPosition] > ints[fEDI_pooledTrackedSyntax_start] && ints[fEDI_cursor_editPosition] < ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, ints[fEDI_pooledTrackedSyntax_length] - ints[fEDI_cursor_editLength]);
        }
    }

    EDI_textByteList.removeAt(ints[fEDI_cursor_editPosition], ints[fEDI_cursor_editLength]);

    let textSourceIdentifier = EDI_FORMATTED_textSourceIdentifier;
    // TODO: Account for any '\t\0\0\0' that exist on the line            
    let text = '';
    ints[F_didChangeTextDocument_version] = ints[F_didChangeTextDocument_version] + 1;
    let version = ints[F_didChangeTextDocument_version];

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

    if (indexLine_editOccurredOn === ints[fEDI_longestLine_indexLine]) {
        ints[fEDI_longestLine_length] = ints[fEDI_longestLine_length] - ints[fEDI_cursor_editLength];
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
    const ints = gINT_FIELDS;

    ints[fEDI_cursor_editKind] = EditKind_None;
    ints[fEDI_cursor_editLength] = 0;
    ints[fEDI_cursor_editPosition] = 0;
    ints[fEDI_cursor_editIndexLine] = 0;
    ints[fEDI_cursor_editIndexColumn] = 0;
    ints[fEDI_cursor_editRenderedDisplacement] = 0;
    ints[fEDI_cursor_END_editIndexLine] = 0;
    ints[fEDI_cursor_END_editIndexColumn] = 0;
    ints[fEDI_cursor_gapBufferCount] = 0;
    EDI_cursor_gapBufferWriteToSpanElement = null;
    ints[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
    ints[fEDI_cursor_editLineFeedCount] = 0;
    EDI_lineEndPositionList_PENDING.clear();
}

function enqueueLSPNotification(payload) {
    lspQueue.push(payload);
    processLspQueue(); // Fire-and-forget processing loop
}

async function processLspQueue() {
    if (gBYTE_FIELDS[byteisProcessingLspQueue]) return;
    gBYTE_FIELDS[byteisProcessingLspQueue] = true;

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

    gBYTE_FIELDS[byteisProcessingLspQueue] = false;
}

/**
 * Returns the underlying uint8array that contains the encoded characters for the text.
 * The uint8array's capacity (i.e.: length) is not what should be saved out.
 * Instead only save the countOfBytesInUse.
 * 
 * The editor stores all line endings as '\n'.
 * When saving the bytes, swap out any '\n' for the 'lineEndString' which may or may not be '\n' (i.e.: it could be '\r\n' or '\r').
 * 
 * Tab characters are stored as '\t\0\0\0'.
 * When saving out the bytes you need to skip over these '\0' characters.
 * 
 * A '\0' character does NOT terminate the subarray's bytes that are in use.
 * You need to iterate specifically for 'countOfBytesInUse'.
 * 
 * @param {*} NOTfinalizePendingEdits if there is a pending edit, it needs to be finalized in order to see the updated text. The default behavior is to finalize the pending edits. To use default behavior, do NOT provide the parameter, or provide a falsey expression like 'null'.
 * @returns
 */
function EDI_getFinalizedEditsAndRawSaveFileData(NOTfinalizePendingEdits) {
    if (!NOTfinalizePendingEdits) {
        EDI_finalizeAllCursors();
    }
    return {
        uint8arrayTextBytes: EDI_textByteList.bytes,
        countOfBytesInUse: EDI_textByteList.count,
        lineEndString: EDI_lineEndString,
        fileStartsWithBom: Boolean(get_EDI_fileStartsWithBom())
    };
}

/**
 * @param {*} indexLine
 * @returns {number} the last valid POSITION index on the line, but with respect to any pending edits.
 */
function EDI_readLineEndPositionList(indexLine) {
    let lineEndPositionIndex = EDI_lineEndPositionList.data[indexLine];

    // If you need to determine the text without finalizing an edit, you DO have to loop forwards right?
    if (gINT_FIELDS[fEDI_cursor_editLength] > 0 & gINT_FIELDS[fEDI_cursor_editPosition] <= lineEndPositionIndex) {
        switch (gINT_FIELDS[fEDI_cursor_editKind]) {
            case EditKind_InsertLtr:
                lineEndPositionIndex += gINT_FIELDS[fEDI_cursor_editLength];
                break;
            case EditKind_DeleteLtr:
            case EditKind_BackspaceRtl:
            case EditKind_RemoveTextNoBatching:
                lineEndPositionIndex -= gINT_FIELDS[fEDI_cursor_editLength];
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
 * @param line is the result from 'EDI_getLineBoundaryPositions(...)'
 * 
 * @returns trackedSyntax_I the index that was left off on
 */
function EDI_createSpansForLineOfText(div, lineStart, lineEnd, trackedSyntax_I) {

    const ints = gINT_FIELDS;

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
    
            if (ints[fEDI_pooledTrackedSyntax_start] >= lineEnd) {
                break;
            }
    
            if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] < lineStart) {
                trackedSyntax_I++;
                continue;
            }
    
            if (ints[fEDI_pooledTrackedSyntax_start] > substart) {
                let subend = ints[fEDI_pooledTrackedSyntax_start] > lineEnd ? lineEnd : ints[fEDI_pooledTrackedSyntax_start]; // probably a nonsense line of code given the previous if statements
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
                let trackedSyntaxEnd = ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length];
                let subend = trackedSyntaxEnd > lineEnd ? lineEnd : trackedSyntaxEnd;
                span.textContent = EDI_decoder.decode(EDI_textByteList.bytes.subarray(substart, subend));
                substart += (subend - substart);
                switch (gBYTE_FIELDS[byteEDI_pooledTrackedSyntax_trackedSyntaxKind]) {
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
    
            if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] <= lineEnd) {
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

    const ints = gINT_FIELDS;

    // TODO: delete key until you delete a linefeed and join the next line onto your own then press backspace everything breaks.

    // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
    ints[fEDI_w_beltIndexLine] = (ints[fEDI_cursor_indexLine] + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
    if (ints[fEDI_w_beltIndexLine] >= ints[fEDI_ArrayFrom_textElement_children_length] || ints[fEDI_w_beltIndexLine] < 0) ints[fEDI_w_beltIndexLine] = -1;
    else ints[fEDI_w_beltIndexLine] = (ints[fEDI_w_beltIndexLine] + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];
    
    if (ints[fEDI_w_beltIndexLine] < 0) {
        ints[fEDI_w_indexColumn_Goal] = 0;
        ints[fEDI_w_indexColumn_Sum] = 0;
        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
        ints[fEDI_w_indexSpan] = 0;
        w_span = null;
        w_div = null;
        ints[fEDI_w_beltIndexLine] = ints[fEDI_w_beltIndexLine]; // double assignment but not all that pressing of a matter at the moment I think it reads better to just set it / avoid the temporary 'let' local variable each invocation.
        return;
    }
    
    let div = ArrayFrom_textElement_children[ints[fEDI_w_beltIndexLine]];
    let indexColumn_Goal = ints[fEDI_cursor_indexColumn] + ints[fEDI_offsetColumn];
    let indexColumn_Sum = 0;

    for (var indexSpan = 0; indexSpan < div.children.length; indexSpan++) {
        let span = div.children[indexSpan];
        if (indexColumn_Goal <= indexColumn_Sum + span.textContent.length) {
            // '<=' because end-of-line text insertion (end of line but prior to the line ending itself).
            // The line ending isn't written to the span, it is represented by the encompassing div itself.
            ints[fEDI_w_indexColumn_Goal] = indexColumn_Goal;
            ints[fEDI_w_indexColumn_Sum] = indexColumn_Sum;
            ints[fEDI_w_indexColumn_SpanTextContentRelative] = indexColumn_Goal - indexColumn_Sum;
            ints[fEDI_w_indexSpan] = indexSpan;
            w_span = span;
            w_div = div;
            ints[fEDI_w_beltIndexLine] = ints[fEDI_w_beltIndexLine];
            return;
        }
        else {
            indexColumn_Sum += span.textContent.length;
        }
    }

    // TODO: When the column index is too large, how should this be handled?
    ints[fEDI_w_indexColumn_Goal] = 0;
    ints[fEDI_w_indexColumn_Sum] = 0;
    ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
    ints[fEDI_w_indexSpan] = 0;
    w_span = null;
    w_div = null;
    ints[fEDI_w_beltIndexLine] = ints[fEDI_w_beltIndexLine];
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
    if (indexLine >= EDI_lineEndPositionList.count) {
        gutterLineElement.textContent = '~';
    }
    else {
        gutterLineElement.textContent = indexLine + 1;
    }

    let trackedSyntax_StartingIndex = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLine);
    if (trackedSyntax_StartingIndex === NaN || trackedSyntax_StartingIndex === -1) {
        trackedSyntax_StartingIndex = EDI_trackedSyntaxList.count_abstract;
    }
    let line = EDI_getLineBoundaryPositions(indexLine);
    EDI_createSpansForLineOfText(textLineElement, line.start, line.end, trackedSyntax_StartingIndex);
}

/**
 * if (trackedSyntax_StartingIndex === NaN || trackedSyntax_StartingIndex === -1) { trackedSyntax_StartingIndex = EDI_trackedSyntaxList.count_abstract; }
 * @param {*} indexLineAaa 
 * @returns 
 */
function EDI_drawViewPort_FindTrackedSyntax_StartingIndex(indexLineAaa) {

    // TODO: 'indexLineAaa' and 'indexLineBbb'; babel compiler error when both were named indexLine.

    const ints = gINT_FIELDS;
    let local_EDI_trackedSyntaxList = EDI_trackedSyntaxList;

    let line = EDI_getLineBoundaryPositions(indexLineAaa);
    let positionIndex = line.start;

    let left = 0;
    let right = local_EDI_trackedSyntaxList.count_abstract - 1;

    let indexLineBbb = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);

        local_EDI_trackedSyntaxList.getElementAt(mid);
        
        if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > positionIndex) {
            indexLineBbb = mid;

            if (ints[fEDI_pooledTrackedSyntax_start] === positionIndex) {
                break;
            }
            
            right = mid - 1;
        }
        else if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] <= positionIndex) {
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

function EDI_draw_all_cursors() {
    EDI_render_request(RenderKind_Cursor_n);
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
    const ints = gINT_FIELDS;

    ints[fEDI_cursor_cursorTranslateYValue] = (ints[fEDI_cursor_indexLine] + ints[fEDI_offsetLine]) * ints[fEDI_lineHeight];
    ints[fEDI_cursor_cursorTranslateXValue] = (ints[fEDI_cursor_indexColumn] + ints[fEDI_offsetColumn]) * EDI_characterWidth;

    EDI_cursor_caretRow.style.transform = `translateY(${ints[fEDI_cursor_cursorTranslateYValue]}px)`;
    EDI_cursor_cursorElement.style.transform = `translateX(${ints[fEDI_cursor_cursorTranslateXValue]}px)`;

    EDI_createStyleForSelection();

    let text = '';

    text += '(' + ints[fEDI_cursor_indexLine] + ', ' + ints[fEDI_cursor_indexColumn] + ')';
    
    if (gBYTE_FIELDS[byteDIALOG_Settings_editorDebugShowAdjacentCharacters]) {
        let previous = EDI_getCharacterPrevious(ints[fEDI_cursor_indexColumn], EDI_getPositionIndex_cursor());
        if (previous === '\n') previous = '\\n';
        else if (previous === '\t') previous = '\\t';
        let current = EDI_getCharacterCurrent(ints[fEDI_cursor_indexColumn], EDI_getPositionIndex_cursor(), EDI_getLineEnd_pos(ints[fEDI_cursor_indexLine]));
        if (current === '\n') current = '\\n';
        else if (current === '\t') current = '\\t';
        text += ' | (' + previous + ', ' + current + ')';
    }
    
    text += ' | (' + ints[fEDI_cursor_editLength] + ')';

    text += ' | (' + ints[fEDI_longestLine_indexLine] + ', ' + ints[fEDI_longestLine_length] + ')';

    EDI_debug.replaceChildren(text);

    if (!NOTscrollCursorIntoView) {
        EDI_scrollCursorIntoView();
    }
}

/**
 * Returns 'true' if success otherwise 'false' the "return" values are indexLine, and indexColumn; which are stored in 'fieldBuffer.js'
 * as 'gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;' and 'gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;'.
 * 
 * TODO: Local variables for this looping logic?
 */
function EDI_getLineAndColumnIndices_raw(positionIndex) {
    let left = 0;
    let right = EDI_lineEndPositionList.count - 1;

    let indexLine = -1;
    let indexColumn = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (EDI_lineEndPositionList.data[mid] >= positionIndex) {
            indexLine = mid;

            if (EDI_lineEndPositionList.data[mid] === positionIndex) {
                break;
            }
            
            right = mid - 1;
        }
        else if (EDI_lineEndPositionList.data[mid] < positionIndex) {
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
        indexColumn = positionIndex - (EDI_lineEndPositionList.data[indexLine - 1] + 1);
    }

    gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;
    gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;
    return true;
}

/**
 * Returns 'true' if success otherwise 'false' the "return" values are indexLine, and indexColumn; which are stored in 'fieldBuffer.js'
 * as 'gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;' and 'gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;'.
 * 
 * TODO: Local variables for this looping logic?
 */
function EDI_getLineAndColumnIndices(positionIndex) {
    let left = 0;
    let right = EDI_lineEndPositionList.count - 1;

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

    gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine] = indexLine;
    gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn] = indexColumn;
    return true;
}

/**
 * This function only clears both the 'gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]' and the HTML associated with the selection NOT the actual selection position properties of the cursor.
 */
function EDI_clearSelectionStyle() {
    let shouldExistSelectionDiv = false;
    if (gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]) {
        for (var i = 0; i < EDI_presentation.children.length; i++) {
            if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                let textSelectionDiv = EDI_presentation.children[i];
                if (!shouldExistSelectionDiv) {
                    EDI_presentation.removeChild(textSelectionDiv);
                    gBYTE_FIELDS[byteEDI_cursor_selectionDivExists] = false;
                }
                break;
            }
        }
    }
}

function EDI_createStyleForSelection() {
    const ints = gINT_FIELDS;

    if (ints[fEDI_cursor_DRAWN_selectionAnchor] !== ints[fEDI_cursor_selectionAnchor] ||
        ints[fEDI_cursor_DRAWN_selectionEnd] !== ints[fEDI_cursor_selectionEnd] ||
        ints[fEDI_cursor_DRAWN_selection_virtualCount] !== ints[fEDI_virtualCount] ||
        ints[fEDI_cursor_DRAWN_selection_virtualIndexLine] !== ints[fEDI_virtualIndexLine]) {

        ints[fEDI_cursor_DRAWN_selectionAnchor] = ints[fEDI_cursor_selectionAnchor];
        ints[fEDI_cursor_DRAWN_selectionEnd] = ints[fEDI_cursor_selectionEnd];
        ints[fEDI_cursor_DRAWN_selection_virtualCount] = ints[fEDI_virtualCount];
        ints[fEDI_cursor_DRAWN_selection_virtualIndexLine] = ints[fEDI_virtualIndexLine];

        let shouldExistSelectionDiv;
        if (ints[fEDI_cursor_DRAWN_selectionAnchor] === ints[fEDI_cursor_DRAWN_selectionEnd]) {
            shouldExistSelectionDiv = false;
        }
        else {
            shouldExistSelectionDiv = true;
        }

        let textSelectionDiv;

        if (gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]) {
            for (var i = 0; i < EDI_presentation.children.length; i++) {
                if (EDI_presentation.children[i].id === CONST_EDI_cursor_htmlId) {
                    textSelectionDiv = EDI_presentation.children[i];
                    if (!shouldExistSelectionDiv) {
                        EDI_presentation.removeChild(textSelectionDiv);
                        gBYTE_FIELDS[byteEDI_cursor_selectionDivExists] = false;
                    }
                    break;
                }
            }
        }
        else if (shouldExistSelectionDiv) {
            textSelectionDiv = document.createElement('div')
            textSelectionDiv.id = CONST_EDI_cursor_htmlId;
            textSelectionDiv.style.display = 'contents';
            EDI_presentation.appendChild(textSelectionDiv);
            gBYTE_FIELDS[byteEDI_cursor_selectionDivExists] = true;
        }

        if (!gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]) return;

        // TODO: only somewhat simple viewport based virtualization is implemented from what I remember. i.e.: I think the divs are re-used, but every div is redrawn for the viewport, rather than only recalculating the css for the divs that came or left the viewport.

        let start = ints[fEDI_cursor_selectionAnchor];
        EDI_getLineAndColumnIndices(start);
        let startLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        let startLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
        let startLine = startLineAndColumnIndices_indexLine;
        let startColumn = startLineAndColumnIndices_indexColumn;

        let end = ints[fEDI_cursor_selectionEnd];
        EDI_getLineAndColumnIndices(end);
        let endLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        let endLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
        let INCLUSIVEendLine = endLineAndColumnIndices_indexLine;
        let INCLUSIVEendColumn = endLineAndColumnIndices_indexColumn;

        // # Virtualization
        if (startLine < ints[fEDI_virtualIndexLine]) {
            startLine = ints[fEDI_virtualIndexLine];
            startColumn = 0;
        }
        let lastIndexLineBeingShown = ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1;
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
            lineSelectionDiv.style.transform = `translate(${startColumn * EDI_characterWidth}px, ${ints[fEDI_lineHeight] * startLine}px)`;
            lineSelectionDiv.style.width = (INCLUSIVEendColumn - startColumn) * EDI_characterWidth + 'px';
        }
        else {
            // start line
            lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
            lineSelectionDiv.className = 'EDI_selection';
            lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
            lineSelectionDiv.style.transform = `translate(${startColumn * EDI_characterWidth}px, ${ints[fEDI_lineHeight] * startLine}px)`;
            let line = EDI_getLineBoundaryPositions(startLine);
            let lineLength = line.end - line.start;
            lineSelectionDiv.style.width = (lineLength + 1 - startColumn) * EDI_characterWidth + 'px';

            // between lines
            for (var lineI = startLine + 1; lineI < INCLUSIVEendLine; lineI++) {
                lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
                lineSelectionDiv.className = 'EDI_selection';
                lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
                lineSelectionDiv.style.transform = `translateY(${ints[fEDI_lineHeight] * lineI}px)`;
                let line = EDI_getLineBoundaryPositions(lineI);
                let lineLength = line.end - line.start;
                lineSelectionDiv.style.width = (lineLength + 1) * EDI_characterWidth + 'px';
            }

            // end line
            lineSelectionDiv = textSelectionDiv.children[childDivIndex++];
            lineSelectionDiv.className = 'EDI_selection';
            lineSelectionDiv.style.left = gutterWidthTotal_withPxUnits;
            lineSelectionDiv.style.transform = `translateY(${ints[fEDI_lineHeight] * INCLUSIVEendLine}px)`;
            lineSelectionDiv.style.width = INCLUSIVEendColumn * EDI_characterWidth + 'px';
        }
    }
}

function EDI_createStyleForSelection_indentMore() {
    let textSelectionDiv;
    if (gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]) {
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

    gINT_FIELDS[fEDI_cursor_DRAWN_selectionAnchor] = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    gINT_FIELDS[fEDI_cursor_DRAWN_selectionEnd] = gINT_FIELDS[fEDI_cursor_selectionEnd];
}

function EDI_getLastValidIndexColumn(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
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
    if (indexLine < EDI_lineEndPositionList.count) {
        if (indexLine === 0) {
            return EDI_lineEndPositionList.data[indexLine] - 0;
        }
        else {
            return EDI_lineEndPositionList.data[indexLine] - (EDI_lineEndPositionList.data[indexLine - 1] + 1);
        }
    }
    return 0;
}

/**
 * result.start is the position of the first character on that line.
 * 
 * result.end is the position of the "line end" (i.e.: ascii code for '\n' or EOF).
 * 
 * The inclusivity/exclusivity is in reference to whether the position
 * points to non-line-end-text that exists on the line
 * 
 * NOTE: In performance critical sections this code is explicitly inlined and modified to be as performant as it seemingly can get for that specific section of code.
 * 
 * @returns an object with properties 'start' inclusive, 'end' exclusive
 * 
 * TODO: Remove this function or move the output to two entries of 'gINT_FIELDS'
 */
function EDI_getLineBoundaryPositions(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
        if (indexLine === 0) {
            return {
                start: 0,
                end: EDI_readLineEndPositionList(indexLine) - 0
            }
        }
        else {
            return {
                start: (EDI_readLineEndPositionList(indexLine - 1) + 1),
                end: EDI_readLineEndPositionList(indexLine)
            }
        }
    }
    return {
        start: 0,
        end: 0
    }
}

function EDI_getLineStart_pos(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
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
    if (indexLine < EDI_lineEndPositionList.count) {
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
 * result.start is the position of the first character on that line.
 * 
 * result.end is the position of the "line end" (i.e.: ascii code for '\n' or EOF).
 * 
 * The inclusivity/exclusivity is in reference to whether the position
 * points to non-line-end-text that exists on the line
 * 
 * @returns an object with properties 'start' inclusive, 'end' exclusive
 */
function EDI_getLineBoundaryPositions_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
        if (indexLine === 0) {
            return {
                start: 0,
                end: EDI_lineEndPositionList.data[indexLine] - 0
            }
        }
        else {
            return {
                start: (EDI_lineEndPositionList.data[indexLine - 1] + 1),
                end: EDI_lineEndPositionList.data[indexLine]
            }
        }
    }
    return {
        start: 0,
        end: 0
    }
}

function EDI_getLineStart_pos_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
        if (indexLine === 0) {
            return 0;
        }
        else {
            return (EDI_lineEndPositionList.data[indexLine - 1] + 1);
        }
    }
    return 0;
}

function EDI_getLineEnd_pos_raw(indexLine) {
    if (indexLine < EDI_lineEndPositionList.count) {
        if (indexLine === 0) {
            return EDI_lineEndPositionList.data[indexLine] - 0;
        }
        else {
            return EDI_lineEndPositionList.data[indexLine];
        }
    }
    return 0;
}

function EDI_onMouseMove_WRAPIT(event) {
    if ((event.buttons & 1) && !get_EDI_recentBoundingClientRect_isNull_intFalsey()) {

        const ints = gINT_FIELDS;

        // TODO: Consider short circuiting at via event.clientX and clientY by tracking the necessary thresholds for the cursor position to pass rather than the previous and current indices. (you can possibly thereby skip the calculation of the indices entirely for the redundant events).
        // TODO: Is it correct to use the cursor's indexLine and indexColumn directly as a means of determining redundancy? I worry about odd interactions, but I have no proof that such an odd interaction could exist.

        let rX = event.clientX - ints[fEDI_recentBoundingClientRect_left] - ints[fEDI_gutterWidthTotal] + ints[fEDI_lastReadNumber_scrollLeft];
        let rY = event.clientY - ints[fEDI_recentBoundingClientRect_top] + ints[fEDI_lastReadNumber_scrollTop];

        let indexColumn = Math.round(rX / EDI_characterWidth);
        let indexLine = Math.floor(rY / ints[fEDI_lineHeight]);

        if (indexColumn < 0) {
            indexColumn = 0;
        }
        
        if (indexLine < 0) {
            indexLine = 0;
        }

        if (indexLine >= EDI_lineEndPositionList.count) {
            indexLine = EDI_lineEndPositionList.count - 1;
        }

        let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);
        if (indexColumn > lastValidIndexColumn) {
            indexColumn = lastValidIndexColumn;
        }

        if (ints[fEDI_cursor_indexLine] === indexLine && ints[fEDI_cursor_indexColumn] === indexColumn) {
            return;
        }
        
        ints[fEDI_cursor_indexLine] = indexLine;
        ints[fEDI_cursor_indexColumn] = indexColumn;

        if (get_EDI_detailRank() === 3) {
            EDI_onMouseMoveDetailRankThree(indexLine, indexColumn);
        }
        else if (get_EDI_detailRank() === 2) {
            EDI_onMouseMoveDetailRankTwo(indexLine, indexColumn);
        }
        else if (get_EDI_detailRank() === 1) {
            EDI_onMouseMoveDetailRankOne(indexLine, indexColumn);
        }

        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
    else {
        gBYTE_FIELDS[byteEDI_mousemove_eventListener_isActive] = false;
        EDI_baseElement.removeEventListener('mousemove', EDI_onMouseMove_WRAPIT);
    }
}

function EDI_onMouseMoveDetailRankOne(indexLineClicked, indexColumnClicked) {
    // TODO: These two sets the ones to line and column seem redundant weren't these just done by the original EDI_onMouseMove_WRAPIT?
    gINT_FIELDS[fEDI_cursor_indexLine] = indexLineClicked;
    gINT_FIELDS[fEDI_cursor_indexColumn] = indexColumnClicked;

    gINT_FIELDS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();

    EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
}

function getCharacter_raw(positionIndex) {
    return String.fromCharCode(EDI_textByteList.bytes[positionIndex]);
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
    switch (gINT_FIELDS[fEDI_cursor_editKind]) {
        case EditKind_InsertLtr:
            if (positionIndex >= gINT_FIELDS[fEDI_cursor_editPosition] & positionIndex < gINT_FIELDS[fEDI_cursor_editPosition] + gINT_FIELDS[fEDI_cursor_editLength]) {
                // TODO: I hear fromCharCode is faster than 'String.fromCodePoint(...)' thus I'm seeing if it is sufficient for my current personal usage...
                // ...long term it presumably fails for characters that I don't tend to type, but until then this is working so I'll just use fromCharCode.
                //
                // TODO: This takes a spread/array; if I give it a single byte does it allocate a length of 1 array every invocation?
                return String.fromCharCode(EDI_cursor_gapBuffer[positionIndex - gINT_FIELDS[fEDI_cursor_editPosition]]);
            }
            else if (gINT_FIELDS[fEDI_cursor_editPosition] <= positionIndex) {
                totalShift += gINT_FIELDS[fEDI_cursor_editLength];
            }
            break;
        case EditKind_DeleteLtr:
        case EditKind_BackspaceRtl:
        case EditKind_RemoveTextNoBatching:
            totalShift -= gINT_FIELDS[fEDI_cursor_editLength];
            break;
    }
    // TODO: I hear fromCharCode is faster than 'String.fromCodePoint(...)' thus I'm seeing if it is sufficient for my current personal usage...
    // ...long term it presumably fails for characters that I don't tend to type, but until then this is working so I'll just use fromCharCode.
    //
    // TODO: This takes a spread/array; if I give it a single byte does it allocate a length of 1 array every invocation?
    return String.fromCharCode(EDI_textByteList.bytes[positionIndex - totalShift]);
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

    const ints = gINT_FIELDS;

    let nextPositionIndex = EDI_getPositionIndex_Overload(indexLineClicked, indexColumnClicked);

    if (nextPositionIndex <= ints[fEDI_detail_smallPosition]) {
        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
            ints[fEDI_cursor_selectionAnchor] = ints[fEDI_detail_largePosition];
        }

        ints[fEDI_cursor_indexLine] = indexLineClicked;
        ints[fEDI_cursor_indexColumn] = indexColumnClicked;
        let positionIndex = nextPositionIndex;

        ints[fEDI_cursor_selectionEnd] = positionIndex;

        if (nextPositionIndex < ints[fEDI_detail_smallPosition]) {
            let goalCharacterKind = EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], positionIndex, EDI_getLineEnd_pos(ints[fEDI_cursor_indexLine]));

            let leftWasFound = false;

            let tempPositionIndex = positionIndex;

            while (ints[fEDI_cursor_indexColumn] > 0) {
                let leftCharacterKind = EDI_getCharacterPrevious_KIND(ints[fEDI_cursor_indexColumn], tempPositionIndex);
                if (leftCharacterKind !== goalCharacterKind) {
                    ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
                    leftWasFound = true;
                    break;
                }
                tempPositionIndex--;
                ints[fEDI_cursor_indexColumn]--;
            }

            if (!leftWasFound) {
                ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
            }
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else {
        if (ints[fEDI_cursor_selectionAnchor] > ints[fEDI_cursor_selectionEnd]) {
            ints[fEDI_cursor_selectionAnchor] = ints[fEDI_detail_smallPosition];
        }

        if (nextPositionIndex >= ints[fEDI_detail_largePosition]) {
            ints[fEDI_cursor_indexLine] = indexLineClicked;
            ints[fEDI_cursor_indexColumn] = indexColumnClicked;
            let positionIndex = nextPositionIndex;

            ints[fEDI_cursor_selectionEnd] = positionIndex;

            let leftCharacterKind = EDI_getCharacterPrevious_KIND(ints[fEDI_cursor_indexColumn], positionIndex);
            let goalCharacterKind = leftCharacterKind;

            let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
            let lineLength = line.end - line.start;
            let rightWasFound = false;

            let tempPositionIndex = positionIndex;
            while (ints[fEDI_cursor_indexColumn] < lineLength) {
                let rightCharacterKind = EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], tempPositionIndex, line.end);
                if (rightCharacterKind !== goalCharacterKind) {
                    ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
                    rightWasFound = true;
                    break;
                }
                tempPositionIndex++;
                ints[fEDI_cursor_indexColumn]++;
            }

            if (!rightWasFound) {
                // end of line
                ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
            }
        }
        else {
            EDI_getLineAndColumnIndices(ints[fEDI_detail_largePosition]);
            let largeLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
            let largeLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
            ints[fEDI_cursor_indexLine] = largeLineAndColumnIndices_indexLine;
            ints[fEDI_cursor_indexColumn] = largeLineAndColumnIndices_indexColumn;
            ints[fEDI_cursor_selectionEnd] = ints[fEDI_detail_largePosition];
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
}

function EDI_onMouseMoveDetailRankThree(indexLineClicked, indexColumnClicked) {

    const ints = gINT_FIELDS;

    // TODO: I remember this being bugged I think it makes sense why. You're checking if the cursor is exactly at the threshold rather than determining if the distance from previous event to this one puts you past the threshold.
    if (indexLineClicked === ints[fEDI_detailRank3OriginLine]) {
        // TODO: 'cursor.positionIndex' is incorrect there is no such field, but was this referring to the clicked position or the position that the cursor currently is at...
        // ...it is presumed to be the position that the cursor is currently at because it would explain the bug where if you move the cursor somewhere that the mouse move events don't get
        // sent then bring your mouse back into a place where they do you'll snap ahead by some indices and skip the threshold and it visually bugs.
        // You could attach to I think it is window? but then I'm wondering if a race condition could ever occur.
        // so you'd probably want to do both attach to window and protect against large movements that skip the exact threshold when transitioning.
        //
        if (EDI_getPositionIndex_raw_cursor() !== ints[fEDI_detail_smallPosition]) {
            EDI_getLineAndColumnIndices(ints[fEDI_detail_smallPosition]);
            let smallLineAndColumnPositionIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
            let smallLineAndColumnPositionIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
            ints[fEDI_cursor_indexLine] = smallLineAndColumnPositionIndices_indexLine;
            ints[fEDI_cursor_indexColumn] = smallLineAndColumnPositionIndices_indexColumn;
        }

        if (ints[fEDI_cursor_selectionEnd] !== ints[fEDI_detail_smallPosition]) {
            ints[fEDI_cursor_selectionEnd] = ints[fEDI_detail_smallPosition];
        }

        if (ints[fEDI_cursor_selectionAnchor] !== ints[fEDI_detail_largePosition]) {
            ints[fEDI_cursor_selectionAnchor] = ints[fEDI_detail_largePosition];
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else if (indexLineClicked < ints[fEDI_detailRank3OriginLine]) {
        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
            EDI_getLineAndColumnIndices(ints[fEDI_detail_smallPosition]);
            let smallLineAndColumnPositionIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
            let smallLineAndColumnPositionIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];

            ints[fEDI_cursor_indexLine] = smallLineAndColumnPositionIndices_indexLine;
            ints[fEDI_cursor_indexColumn] = smallLineAndColumnPositionIndices_indexColumn;

            ints[fEDI_cursor_selectionEnd] = ints[fEDI_detail_smallPosition];

            EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
        }

        ints[fEDI_cursor_indexLine] = indexLineClicked;
        ints[fEDI_cursor_indexColumn] = 0;

        ints[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_Overload(indexLineClicked, 0);

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
    else if (indexLineClicked > ints[fEDI_detailRank3OriginLine]) {

        if (ints[fEDI_cursor_selectionAnchor] !== ints[fEDI_detail_smallPosition]) {
            ints[fEDI_cursor_selectionAnchor] = ints[fEDI_detail_smallPosition];
        }

        ints[fEDI_cursor_indexLine] = indexLineClicked;
        ints[fEDI_cursor_indexColumn] = indexColumnClicked;
        let positionIndex = EDI_getPositionIndex_Overload(indexLineClicked, indexColumnClicked);

        // move to end of line...
        let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
        let lineLength = line.end - line.start;
        positionIndex += lineLength - ints[fEDI_cursor_indexColumn];

        if (ints[fEDI_cursor_indexLine] === EDI_lineEndPositionList.count - 1) {
            ints[fEDI_cursor_indexColumn] = lineLength;
            ints[fEDI_cursor_selectionEnd] = positionIndex;
        }
        else {
            // wrap to the next line
            ints[fEDI_cursor_indexLine]++;
            ints[fEDI_cursor_indexColumn] = 0;
            positionIndex++;

            ints[fEDI_cursor_selectionEnd] = positionIndex;
        }

        EDI_render_request(RenderKind_Cursor_flag_doNotScrollIntoView);
    }
}

/**
 * @returns 
 */
function EDI_getPositionIndex_cursor() {
    return EDI_getLineStart_pos(gINT_FIELDS[fEDI_cursor_indexLine]) + gINT_FIELDS[fEDI_cursor_indexColumn];
}

function EDI_getPositionIndex_Overload(indexLine, indexColumn) {
    return EDI_getLineStart_pos(indexLine) + indexColumn;
}

/**
 * @returns 
 */
function EDI_getPositionIndex_raw_cursor() {
    return EDI_getLineStart_pos_raw(gINT_FIELDS[fEDI_cursor_indexLine]) + gINT_FIELDS[fEDI_cursor_indexColumn];
}

function EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked) {

    let selectionPlusContextMenuCase = event_button === 2 && EDI_cursor_hasSelection();

    if (event_shiftKey && !selectionPlusContextMenuCase) {
        if (!EDI_cursor_hasSelection()) {
            gINT_FIELDS[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_cursor();
        }
    }

    if (!selectionPlusContextMenuCase) {
        gINT_FIELDS[fEDI_cursor_indexLine] = indexLineClicked;
        gINT_FIELDS[fEDI_cursor_indexColumn] = indexColumnClicked;
        gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    
        gINT_FIELDS[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();

        if (!event_shiftKey) {
            gINT_FIELDS[fEDI_cursor_selectionAnchor] = gINT_FIELDS[fEDI_cursor_selectionEnd];
        }
    }

    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_onMouseDownDetailRankTwo(event_button, event_shiftKey, indexLineClicked, indexColumnClicked) {
    if (event_shiftKey) {
        EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked);
        return;
    }

    const ints = gINT_FIELDS;

    ints[fEDI_cursor_indexLine] = indexLineClicked;
    ints[fEDI_cursor_indexColumn] = indexColumnClicked;
    let positionIndex = EDI_getPositionIndex_cursor();
    
    let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);

    let leftCharacterKind = EDI_getCharacterPrevious_KIND(ints[fEDI_cursor_indexColumn], positionIndex);
    let rightCharacterKind = EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], positionIndex, line.end);

    if (leftCharacterKind === rightCharacterKind) {
        let goalCharacterKind = rightCharacterKind;

        let tempIndexColumn = ints[fEDI_cursor_indexColumn];
        let tempPositionIndex = EDI_getPositionIndex_Overload(ints[fEDI_cursor_indexLine], tempIndexColumn);
        while (tempIndexColumn > 0) {
            tempIndexColumn--;
            tempPositionIndex--;
            leftCharacterKind = EDI_getCharacterPrevious_KIND(tempIndexColumn, tempPositionIndex);
            if (leftCharacterKind !== goalCharacterKind) {
                ints[fEDI_cursor_selectionAnchor] = tempPositionIndex;
                break;
            }
        }

        let lineLength = line.end - line.start;
        let rightWasFound = false;
        tempIndexColumn = ints[fEDI_cursor_indexColumn];
        tempPositionIndex = EDI_getPositionIndex_Overload(ints[fEDI_cursor_indexLine], tempIndexColumn);
        while (tempIndexColumn < lineLength) {
            tempIndexColumn++;
            tempPositionIndex++;
            rightCharacterKind = EDI_getCharacterCurrent_KIND(tempIndexColumn, tempPositionIndex, line.end);
            if (rightCharacterKind !== goalCharacterKind) {
                ints[fEDI_cursor_indexColumn] = tempIndexColumn;
                ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
                rightWasFound = true;
                break;
            }
        }

        if (!rightWasFound) {
            // end of line
            ints[fEDI_cursor_indexColumn] = tempIndexColumn;
            ints[fEDI_cursor_selectionEnd] = tempPositionIndex;
        }

        EDI_render_request(RenderKind_Cursor_n);
    }
    else if (leftCharacterKind > rightCharacterKind) {
        let goalCharacterKind = leftCharacterKind;

        let tempIndexColumn = ints[fEDI_cursor_indexColumn];
        let originalPositionIndex = EDI_getPositionIndex_Overload(ints[fEDI_cursor_indexLine], tempIndexColumn);
        let tempPositionIndex = originalPositionIndex;

        while (ints[fEDI_cursor_indexColumn] > 0) {
            tempIndexColumn--;
            tempPositionIndex--;
            leftCharacterKind = EDI_getCharacterPrevious_KIND(tempIndexColumn, tempPositionIndex);
            if (leftCharacterKind !== goalCharacterKind) {
                ints[fEDI_cursor_selectionAnchor] = tempPositionIndex;
                break;
            }
        }

        ints[fEDI_cursor_selectionEnd] = originalPositionIndex;

        EDI_render_request(RenderKind_Cursor_n);
    }
    else {
        let goalCharacterKind = rightCharacterKind;

        let positionIndex = EDI_getPositionIndex_Overload(ints[fEDI_cursor_indexLine], ints[fEDI_cursor_indexColumn]);
        ints[fEDI_cursor_selectionAnchor] = positionIndex;

        let lineLength = line.end - line.start;
        let rightWasFound = false;

        while (ints[fEDI_cursor_indexColumn] < lineLength) {
            ints[fEDI_cursor_indexColumn]++;
            positionIndex++;
            rightCharacterKind = EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], positionIndex, line.end);
            if (rightCharacterKind !== goalCharacterKind) {
                ints[fEDI_cursor_selectionEnd] = positionIndex;
                rightWasFound = true;
                break;
            }
        }

        if (!rightWasFound) {
            // end of line
            ints[fEDI_cursor_selectionEnd] = positionIndex;
        }

        EDI_render_request(RenderKind_Cursor_n);
    }

    if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
        ints[fEDI_detail_smallPosition] = ints[fEDI_cursor_selectionAnchor];
        ints[fEDI_detail_largePosition] = ints[fEDI_cursor_selectionEnd];
    }
    else {
        ints[fEDI_detail_smallPosition] = ints[fEDI_cursor_selectionEnd];
        ints[fEDI_detail_largePosition] = ints[fEDI_cursor_selectionAnchor];
    }
}

function EDI_onMouseDownDetailRankThree(event_button, event_shiftKey, indexLineClicked, indexColumnClicked) {
    if (event_shiftKey) {
        EDI_onMouseDownDetailRankOne(event_button, event_shiftKey, indexLineClicked, indexColumnClicked);
        return;
    }

    const ints = gINT_FIELDS;

    ints[fEDI_cursor_indexLine] = indexLineClicked;
    ints[fEDI_cursor_indexColumn] = indexColumnClicked;
    
    ints[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_Overload(ints[fEDI_cursor_indexLine], 0);
    
    ints[fEDI_detailRank3OriginLine] = ints[fEDI_cursor_indexLine];

    if (ints[fEDI_cursor_indexLine] === EDI_lineEndPositionList.count - 1) {
        let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
        ints[fEDI_cursor_selectionEnd] = line.end;
        EDI_render_request(RenderKind_Cursor_n);
    }
    else {
        ints[fEDI_cursor_indexLine]++;
        ints[fEDI_cursor_indexColumn] = 0;
        let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
        ints[fEDI_cursor_selectionEnd] = line.start;
        EDI_render_request(RenderKind_Cursor_n);
    }

    if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
        ints[fEDI_detail_smallPosition] = ints[fEDI_cursor_selectionAnchor];
        ints[fEDI_detail_largePosition] = ints[fEDI_cursor_selectionEnd];
    }
    else {
        ints[fEDI_detail_smallPosition] = ints[fEDI_cursor_selectionEnd];
        ints[fEDI_detail_largePosition] = ints[fEDI_cursor_selectionAnchor];
    }
}

/**
 * @returns 
 */
function EDI_insertGapBufferSpan() {
    walkLineUntilIndexColumn();
    if (!w_span || !w_div) {
        EDI_cursor_gapBufferWriteToSpanElement = null;
        gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
        return;
    }

    if (gINT_FIELDS[fEDI_w_indexColumn_Goal] == 0) {
        // TODO: Ensure 'w_div.children[0]' is equal to the 'w_span' and then change this line to use 'w_span'
        EDI_cursor_gapBufferWriteToSpanElement = w_span;
        gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = 0;
    }
    else {
        EDI_cursor_gapBufferWriteToSpanElement = w_div.children[gINT_FIELDS[fEDI_w_indexSpan]];

        if (gINT_FIELDS[fEDI_w_indexColumn_Goal] === gINT_FIELDS[fEDI_w_indexColumn_Sum] + EDI_cursor_gapBufferWriteToSpanElement.textContent.length) {
            gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = EDI_cursor_gapBufferWriteToSpanElement.textContent.length;
        }
        else {
            gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] = gINT_FIELDS[fEDI_w_indexColumn_SpanTextContentRelative];
        }
    }
}

/**
 * @param {*} editKind 
 * @param {*} editPosition 
 * @param {*} editLength 
 */
function EDI_startEdit(editKind, editPosition, editLength) {
    const ints = gINT_FIELDS;
    ints[fEDI_cursor_editKind] = editKind;
    ints[fEDI_cursor_editPosition] = editPosition;
    ints[fEDI_cursor_editIndexLine] = ints[fEDI_cursor_indexLine];
    ints[fEDI_cursor_editIndexColumn] = ints[fEDI_cursor_indexColumn];
    ints[fEDI_cursor_editLength] = editLength;

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
    const ints = gINT_FIELDS;
    return ints[fEDI_cursor_editKind] != EditKind_InsertLtr ||
           ints[fEDI_cursor_indexLine] !== ints[fEDI_cursor_editIndexLine] ||
           ints[fEDI_cursor_indexColumn] !== ints[fEDI_cursor_editIndexColumn] + ints[fEDI_cursor_editLength] ||
           ints[fEDI_cursor_editLength] >= CONST_EDI_cursor_GAP_BUFFER_CAPACITY ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_enter() {
    const ints = gINT_FIELDS;
    return true || // turn off batching until it works. The initial enter event is what matters everything else can be recreated based on the amount of lineFeeds that were inserted.
           ints[fEDI_cursor_editKind] != EditKind_Enter ||
           ints[fEDI_cursor_indexLine] !== ints[fEDI_cursor_END_editIndexLine] ||
           ints[fEDI_cursor_indexColumn] !== ints[fEDI_cursor_END_editIndexColumn] ||
           ints[fEDI_cursor_editLength] >= CONST_EDI_cursor_GAP_BUFFER_CAPACITY ||
           !EDI_cursor_enterKey_newLinePlusIndentation_byteList ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_backspace() {
    const ints = gINT_FIELDS;
    return ints[fEDI_cursor_editKind] != EditKind_BackspaceRtl ||
           ints[fEDI_cursor_indexLine] !== ints[fEDI_cursor_editIndexLine] ||
           ints[fEDI_cursor_indexColumn] !== ints[fEDI_cursor_editIndexColumn] ||
           EDI_cursor_hasSelection();
}

/**
 * @returns 
 */
function EDI_NOTcanBatch_delete() {
    const ints = gINT_FIELDS;
    return ints[fEDI_cursor_editKind] != EditKind_DeleteLtr ||
           ints[fEDI_cursor_indexLine] !== ints[fEDI_cursor_editIndexLine] ||
           ints[fEDI_cursor_indexColumn] !== ints[fEDI_cursor_editIndexColumn] ||
           EDI_cursor_hasSelection();
}

/**
 * @param {*} shiftKey 
 */
function EDI_preKeyboardMovementSelectionLogic(shiftKey) {
    if (shiftKey) {
        if (!EDI_cursor_hasSelection()) {
            const ints = gINT_FIELDS;
            ints[fEDI_cursor_selectionAnchor] = EDI_getPositionIndex_cursor();
            ints[fEDI_cursor_selectionIndexAnchorLine] = ints[fEDI_cursor_indexLine];
            ints[fEDI_cursor_selectionIndexAnchorColumn] = ints[fEDI_cursor_indexColumn];
        }
    }
    else {
        if (EDI_cursor_hasSelection()) {
            const ints = gINT_FIELDS;
            ints[fEDI_cursor_selectionAnchor] = ints[fEDI_cursor_selectionEnd];
            ints[fEDI_cursor_selectionIndexAnchorLine] = ints[fEDI_cursor_selectionIndexEndLine];
            ints[fEDI_cursor_selectionIndexAnchorColumn] = ints[fEDI_cursor_selectionIndexEndColumn];
        }
    }
}

/**
 * @param {*} shiftKey 
 */
function EDI_postKeyboardMovementSelectionLogic(shiftKey) {
    if (shiftKey) {
        const ints = gINT_FIELDS;
        ints[fEDI_cursor_selectionEnd] = EDI_getPositionIndex_cursor();
        ints[fEDI_cursor_selectionIndexEndLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_cursor_selectionIndexEndColumn] = ints[fEDI_cursor_indexColumn];
    }
}

/**
 * @param {*} shiftKey 
 */
function EDI_arrowDown(shiftKey) {
    const ints = gINT_FIELDS;
    EDI_movementBasedCacheInvalidation();
    EDI_preKeyboardMovementSelectionLogic(shiftKey);
    if (ints[fEDI_cursor_indexLine] < EDI_lineEndPositionList.count - 1) {
        ints[fEDI_cursor_indexLine]++;
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);
        if (ints[fEDI_cursor_STORED_indexColumn] > lastValidIndexColumn) {
            ints[fEDI_cursor_indexColumn] = lastValidIndexColumn;
        }
        else {
            ints[fEDI_cursor_indexColumn] = ints[fEDI_cursor_STORED_indexColumn];
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
    if (gINT_FIELDS[fEDI_cursor_editKind] === EditKind_Enter) {
        //
        // this only happens once even if you have many cursors because the next cursor that enters this function would be and editKind of None.
        //
        // The main concern is when a user holds down the Enter key, so while this change causes any cursor movement to finalize a pending Enter edit, it won't be nearly as detrimental as if holding down the Enter key were to not be optimized.
        //
        // TODO: Permit more than one Enter key edit event to batch
        // TODO: Cap the amount of enter key edit events that can batch as was done with the insertion.
        // TODO: Having Enter be an insertion, instead of its own EditKind, sounds like the better long term goal but it is believed that this change is trainsitionally helpful in getting to that final best solution.
        //
        EDI_finalizeAllCursors();
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
        
        if ((editKind === EditKind_Tab && gINT_FIELDS[fEDI_cursor_editKind] === EditKind_IndentMore) ||
            (editKind === EditKind_Tab && gINT_FIELDS[fEDI_cursor_editKind] === EditKind_IndentLess && event.shiftKey)) {

                // TODO: IndentLess when no selection however shiftTab then it does indentLess even still but I haven't gone out of the way to handle that hack...
                // ...maybe it'll be covered maybe it won't.

                // TODO: Rewrite this if statement (it is a hack for the moment while I get indent more of a single cursor to batch)
        }
        else {
            EDI_finalizeAllCursors();
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
            EDI_finalizeAllCursors();
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
        EDI_finalizeAllCursors();
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

    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
}

function EDI_editEvent_theEditIself_InsertLtr(event) {
    const ints = gINT_FIELDS;
    EDI_movementBasedCacheInvalidation();
    if (ints[fEDI_offsetColumn_withRespectToThisIndexLine] !== ints[fEDI_cursor_indexLine]) {
        ints[fEDI_offsetColumn_withRespectToThisIndexLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_offsetColumn] = 0;
    }
    // You can do this because the function 'EDI_NOTcanBatch_insert' was already checked for all the cursors, if it is possible to batch, the editKind will stay InsertLtr otherwise it is finalized and set to None.
    // TODO: Use if === EditKind_None for copy and paste safety / it might just even be more readable
    if (ints[fEDI_cursor_editKind] !== EditKind_InsertLtr) {
        EDI_startEdit(EditKind_InsertLtr, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_insertDo(event.key);
    ints[fEDI_cursor_STORED_indexColumn] = ints[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    //ints[fEDI_offsetColumn] = ints[fEDI_offsetColumn] + ints[fEDI_cursor_editLength];
    //ints[fEDI_totalShift] = get_EDI_totalShift() + ints[fEDI_cursor_editLength]; // this isn't needed here, but it is needed elsewhere so in order to create a pattern it was included here... TODO: maybe get rid of this or...?
    EDI_render_request(RenderKind_InsertLtr);
}

function EDI_editEvent_theEditIself_DeleteLtr(event) {
    const ints = gINT_FIELDS;
    EDI_movementBasedCacheInvalidation();
    if (ints[fEDI_offsetColumn_withRespectToThisIndexLine] !== ints[fEDI_cursor_indexLine]) {
        ints[fEDI_offsetColumn_withRespectToThisIndexLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_offsetColumn] = 0;
    }
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
    }
    else {
        if (ints[fEDI_cursor_editKind] !== EditKind_DeleteLtr) {
            EDI_startEdit(EditKind_DeleteLtr, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
        }
        EDI_deleteDo(event);
    }
    EDI_render_request(RenderKind_Cursor_n);
    //ints[fEDI_offsetColumn] = ints[fEDI_offsetColumn] - ints[fEDI_cursor_editLength];
    //ints[fEDI_totalShift] = get_EDI_totalShift() - ints[fEDI_cursor_editLength]; // this isn't needed here, but it is needed elsewhere so in order to create a pattern it was included here... TODO: maybe get rid of this or...?
}

function EDI_editEvent_theEditIself_BackspaceRtl(event) {
    const ints = gINT_FIELDS;
    EDI_movementBasedCacheInvalidation();
    if (ints[fEDI_offsetColumn_withRespectToThisIndexLine] !== ints[fEDI_cursor_indexLine]) {
        ints[fEDI_offsetColumn_withRespectToThisIndexLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_offsetColumn] = 0;
    }
    if (EDI_cursor_hasSelection()) {
        EDI_removeSelection();
    }
    else {
        if (ints[fEDI_cursor_editKind] !== EditKind_BackspaceRtl) {
            EDI_startEdit(EditKind_BackspaceRtl, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
        }
        EDI_backspaceDo(event);
        ints[fEDI_cursor_STORED_indexColumn] = ints[fEDI_cursor_indexColumn];
    }
    EDI_render_request(RenderKind_Cursor_n);
    //ints[fEDI_offsetColumn] = ints[fEDI_offsetColumn] - ints[fEDI_cursor_editLength];
    //ints[fEDI_totalShift] = get_EDI_totalShift() - ints[fEDI_cursor_editLength]; // this isn't needed here, but it is needed elsewhere so in order to create a pattern it was included here... TODO: maybe get rid of this or...?
}

function EDI_editEvent_theEditIself_Tab(event) {
    EDI_movementBasedCacheInvalidation();
    if (EDI_cursor_hasSelection()) {
        if (event.shiftKey) {
            if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_IndentLess) {
                EDI_startEdit(EditKind_IndentLess, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_indentLess();
        }
        else {
            if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_IndentMore) {
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
            EDI_onMouseDownDetailRankThree(0, false, gINT_FIELDS[fEDI_cursor_indexLine], gINT_FIELDS[fEDI_cursor_indexColumn]);
            if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_IndentLess) {
                EDI_startEdit(EditKind_IndentLess, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_indentLess();
        }
        else {
            if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_Tab) {
                EDI_startEdit(EditKind_Tab, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
            }
            EDI_tabKey();
        }
    }
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Enter(event) {
    if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_Enter) {
        EDI_startEdit(EditKind_Enter, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_EnterKey(event.ctrlKey, event.shiftKey);
    gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    //gINT_FIELDS[fEDI_offsetLine] = gINT_FIELDS[fEDI_offsetLine] + 1;
}

function EDI_editEvent_theEditIself_Paste(clipboardContent) {
    if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_Enter) {
        EDI_startEdit(EditKind_Paste, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_paste(clipboardContent);
    gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
}

function EDI_editEvent_theEditIself_Duplicate() {
    if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_Duplicate) {
        EDI_startEdit(EditKind_Duplicate, EDI_getPositionIndex_raw_cursor(), /*editLength*/ 0);
    }
    EDI_duplicateSelection();
    gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
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
            if (gINT_FIELDS[fEDI_cursor_editIndexLine] === gINT_FIELDS[fEDI_cursor_indexLine] &&
                gINT_FIELDS[fEDI_cursor_editIndexColumn] + (4 * gINT_FIELDS[fEDI_cursor_editLength]) === gINT_FIELDS[fEDI_cursor_indexColumn]) {
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
    if (gINT_FIELDS[fEDI_cursor_editKind] === EditKind_IndentLess) {
        return true;
    }
    
    /////
    let SMALL_pos;
    let LARGE_pos;
    if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let SMALL_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    EDI_getLineAndColumnIndices(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let LARGE_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    // # Determine the starting indexLine (the start is the large position, this confused me for a moment)
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    let startingLinePos = EDI_getLineBoundaryPositions(startingIndex);
    if (startingLinePos.start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            startingLinePos = EDI_getLineBoundaryPositions(startingIndex);
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return true;
    }

    // TODO: '..._EDI_indent_ORIGINAL_indentBy()' is no longer in use

    // # Determine the total count of text that will be inserted, prior to actually beginning the edit.
    if (gINT_FIELDS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] === SMALL_lineAndColumnIndices_indexLine &&
        gINT_FIELDS[fEDI_indent_startingIndex] === startingIndex) {

            return false;
    }
    /////

    return true;
}

/**
 * @returns {boolean} 'shouldFinalizeAllCursors'
 * 
 * TODO: This function never is "naturally" invoked because all tab keypresses start with a 'Tab' edit event and only convert to indentLess downstream
 * 
 */
function EDI_editEvent_checkFor_NOTcanBatch_IndentLess() {
    if (gINT_FIELDS[fEDI_cursor_editKind] === EditKind_IndentMore) {
        return true;
    }
    
    /////
    // selection positions
    let SMALL_pos;
    let LARGE_pos;
    if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices_raw(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let SMALL_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    EDI_getLineAndColumnIndices_raw(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let LARGE_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    // starting index
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    let startingLinePos = EDI_getLineBoundaryPositions_raw(startingIndex);
    if (startingLinePos.start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            startingLinePos = EDI_getLineBoundaryPositions_raw(startingIndex);
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    // # Determine the total count of text that will be inserted, prior to actually beginning the edit.
    if (gINT_FIELDS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] === SMALL_lineAndColumnIndices_indexLine &&
        gINT_FIELDS[fEDI_indent_startingIndex] === startingIndex) {

            return false;
    }
    /////

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
 * - *optional* check if statement for 'gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]' to avoid redundant invocations of 'EDI_cursorBlink_startChecking'
 * - invoke 'EDI_cursorBlink_startChecking'
 * - downstream trigger the rAF for drawing the cursor wherein 'gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp]' gets set to the rAF timestamp.
 *     - or, modify some other part of the rAF pipeline (only if necessary) / etc...
 * 
 * NOTE: the draw cursor rAF needs to be enqueued prior to the 'EDI_cursorBlink_startChecking' invocation.
 */
function EDI_cursorBlink_trailingEdge(timestamp) {
    const time = timestamp - gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp];
    if (time >= 500) {
        gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge] = false;
        // TODO: This is a timing issue of the rAF vs you losing focus on the editor.
        EDI_cursor_cursorElement.classList.add('EDI_cursor_focus');
        gINT_FIELDS[fEDI_EDI_cursorBlinkLastTimestamp] = 0;
    }
    else {
        requestAnimationFrame(EDI_cursorBlink_trailingEdge);
    }
}

function EDI_cursorBlink_startChecking() {
    gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge] = true;
    EDI_cursor_cursorElement.classList.remove('EDI_cursor_focus');
    requestAnimationFrame(EDI_cursorBlink_trailingEdge);
}

/*

> I've been thinking for a few hours in the back of my mind.
> I'm actually quite confused about the keydown logic...
> 
> I realize that:
> 'async function EDI_onKeyDown(event)'
> 
> can actually be changed to:
> 'function EDI_onKeyDown(event)'
> 
> Because the only "asynchronous code" is actually being returned from the function NOT awaited from the function itself.
> 
> And furthermore, this "asynchronous code" only exists in a few conditional branches (not all branches hit the "asynchronous code".
> 
> In this scenario the "asynchronous code" refers to an inner function which is marked with async and within that inner function there are awaits being used.


< You just had a major breakthrough, and your realization is 100% correct. You should feel great about this because you just solved the core architectural problem in your head without writing a single line of code.
<
< By extracting the async keyword and the await expressions into an inner helper function, your main EDI_onKeyDown function becomes a standard, synchronous function.
<
< Why Your Solution Works Perfectly
<
< When JavaScript executes a function, it doesn't care if there is an async function defined inside it. It only cares about the function currently running.
<
< Look at how your code behaves now with your new architecture:
< ...

hmmm is google AI just hyping me up... I need to clarify that those few conditional branches actually go on to return the promise.

*/

/**
 * When I change a sequence of synchronous calls to not take the event object but instead certain fields,
 * I don't think that it is as important / might not even cause an issue at all, but
 * nevertheless I can pass the direct fields to just reduce the overall surface area
 * that I need to track where the event is going in the future.
 * 
 * Why is this async?????
 * 
 * TODO:
 * - This needs to not be async as the number 1 next thing to do.
 * - To finish today though I don't wanna do this I wanna make sure I have a fresh day to look at it.
 *     - I'm thinking I wanna save out when doing the build for the js repo, each individual file's content
 *     - after the "preprocessor.cjs" runs on the file.
 *     - then somehow track whether the file changed the next time I build
 *     - and then I can re-use the previous build result for any files that haven't changed.
 * And yes I do believe that EDI_onKeyDown is 100x more important I just don't know if I'm feeling
 * up to it right now, and so I'm thinking I would just look at "preprocessor.cjs" today; I know I should make this not async asap I'm tired I don't know.
 * 
 * This doesn't even run any async logic it just returns it???
 * 
 * Well the problem was always there then... the timing issue?
 * Even with it async I wasn't actually doing anything.
 * 
 * < The browser's event listener engine ignores the return value of event handlers.
 * < If you return a Promise, the browser treats it exactly like returning undefined, true, or a string. It drops the return value on the floor.
 * 
 * TODO: timing issue of async paste and copy
 */
function EDI_onKeyDown(event) {

    const ints = gINT_FIELDS;

    // Explicitly inlining 'clearMulticursorState()' because it currently is and I just don't want to make a decision about this right now.
    // So what I can do is mark the code paragraph for later decision making.
    ints[fEDI_offsetLine] = 0;
    ints[fEDI_offsetColumn_withRespectToThisIndexLine] = 0;
    ints[fEDI_offsetColumn] = 0;
    ints[fEDI_totalShift] = 0;
    EDI_offsetWithinSpan_withRespectToThisSpan = null;
    ints[fEDI_offsetWithinSpan] = 0;

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
            EDI_finalizeAllCursors_andClearNonPrimaryCursors();
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

    const ints = gINT_FIELDS;

    if (ints[fEDI_offsetColumn_withRespectToThisIndexLine] !== ints[fEDI_cursor_indexLine]) {
        ints[fEDI_offsetColumn_withRespectToThisIndexLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_offsetColumn] = 0;
    }

    if (EDI_cursor_hasSelection() && !event.shiftKey) {
        let small;
        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
            small = ints[fEDI_cursor_selectionAnchor];
        }
        else {
            small = ints[fEDI_cursor_selectionEnd];
        }
        EDI_getLineAndColumnIndices(small); // TODO: Check all of these whether they can be inlined (remove the single stage middle-man variable)
        let lineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        let lineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
        ints[fEDI_cursor_indexLine] = lineAndColumnIndices_indexLine;
        ints[fEDI_cursor_indexColumn] = lineAndColumnIndices_indexColumn;
        ints[fEDI_cursor_selectionAnchor] = ints[fEDI_cursor_selectionEnd];
        ints[fEDI_cursor_selectionIndexAnchorLine] = ints[fEDI_cursor_selectionIndexEndLine];
        ints[fEDI_cursor_selectionIndexAnchorColumn] = ints[fEDI_cursor_selectionIndexEndColumn];
    }
    else {
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        if (event.ctrlKey & ints[fEDI_cursor_indexColumn] > 0) {
            let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
            let indexPosition = line.start + ints[fEDI_cursor_indexColumn];
            let originalCharacterKind = EDI_getCharacterPrevious_KIND(ints[fEDI_cursor_indexColumn], indexPosition);
            ints[fEDI_cursor_indexColumn]--;
            indexPosition--;

            while (ints[fEDI_cursor_indexColumn] > 0) {
                if (EDI_getCharacterPrevious_KIND(ints[fEDI_cursor_indexColumn], indexPosition) === originalCharacterKind) {
                    ints[fEDI_cursor_indexColumn]--;
                    indexPosition--;
                }
                else {
                    break;
                }
            }
        }
        else {
            if (ints[fEDI_cursor_indexColumn] > 0) {
                ints[fEDI_cursor_indexColumn]--;
            }
            else if (ints[fEDI_cursor_indexLine] > 0) {
                ints[fEDI_cursor_indexLine]--;
                ints[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    }
    ints[fEDI_cursor_STORED_indexColumn] = ints[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
    //ints[fEDI_offsetColumn] = ints[fEDI_offsetColumn] + ints[fEDI_cursor_editLength];
    //ints[fEDI_totalShift] = get_EDI_totalShift() + ints[fEDI_cursor_editLength];
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_ArrowDown(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey) {
        // TODO: raf or something this scrollBy?
        EDI_baseElement.scrollBy(0, gINT_FIELDS[fEDI_lineHeight]);
    }
    else {
        EDI_arrowDown(/*shiftKey*/ event.shiftKey);
        EDI_render_request(RenderKind_Cursor_n);
        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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
        EDI_baseElement.scrollBy(0, -1 * gINT_FIELDS[fEDI_lineHeight]);
    }
    else {
        EDI_movementBasedCacheInvalidation();
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        if (gINT_FIELDS[fEDI_cursor_indexLine] > 0) {
            gINT_FIELDS[fEDI_cursor_indexLine]--;
            let lastValidIndexColumn = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);
            if (gINT_FIELDS[fEDI_cursor_STORED_indexColumn] > lastValidIndexColumn) {
                gINT_FIELDS[fEDI_cursor_indexColumn] = lastValidIndexColumn;
            }
            else {
                gINT_FIELDS[fEDI_cursor_indexColumn] = gINT_FIELDS[fEDI_cursor_STORED_indexColumn];
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
        EDI_render_request(RenderKind_Cursor_n);
        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
    return false;
}

function EDI_onKeyDown_ArrowRight(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();

    const ints = gINT_FIELDS;

    if (ints[fEDI_offsetColumn_withRespectToThisIndexLine] !== ints[fEDI_cursor_indexLine]) {
        ints[fEDI_offsetColumn_withRespectToThisIndexLine] = ints[fEDI_cursor_indexLine];
        ints[fEDI_offsetColumn] = 0;
    }

    if (EDI_cursor_hasSelection() && !event.shiftKey) {
        let large;
        if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
            large = ints[fEDI_cursor_selectionEnd];
        }
        else {
            large = ints[fEDI_cursor_selectionAnchor];
        }
        EDI_getLineAndColumnIndices(large);
        let lineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
        let lineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
        ints[fEDI_cursor_indexLine] = lineAndColumnIndices_indexLine;
        ints[fEDI_cursor_indexColumn] = lineAndColumnIndices_indexColumn;
        ints[fEDI_cursor_selectionAnchor] = ints[fEDI_cursor_selectionEnd];
        ints[fEDI_cursor_selectionIndexAnchorLine] = ints[fEDI_cursor_selectionIndexEndLine];
        ints[fEDI_cursor_selectionIndexAnchorColumn] = ints[fEDI_cursor_selectionIndexEndColumn];
    }
    else {
        EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);
        if (event.ctrlKey & ints[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
            let line = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
            let indexPosition = line.start + ints[fEDI_cursor_indexColumn];
            let originalCharacterKind = EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], indexPosition, line.end);
            ints[fEDI_cursor_indexColumn]++;
            indexPosition++;

            while (ints[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
                if (EDI_getCharacterCurrent_KIND(ints[fEDI_cursor_indexColumn], indexPosition, line.end) === originalCharacterKind) {
                    ints[fEDI_cursor_indexColumn]++;
                    indexPosition++;
                }
                else {
                    break;
                }
            }
        }
        else {
            if (ints[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
                ints[fEDI_cursor_indexColumn]++;
            }
            else if (ints[fEDI_cursor_indexLine] < EDI_lineEndPositionList.count - 1) {
                ints[fEDI_cursor_indexColumn] = 0;
                ints[fEDI_cursor_indexLine]++;
            }
        }
        EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    }
    ints[fEDI_cursor_STORED_indexColumn] = ints[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
    //ints[fEDI_offsetColumn] = ints[fEDI_offsetColumn] + ints[fEDI_cursor_editLength];
    //ints[fEDI_totalShift] = get_EDI_totalShift() + ints[fEDI_cursor_editLength];
}

/** @returns {boolean} whether invoking function ought to return */
function EDI_onKeyDown_Home(event) {
    event.preventDefault();
    event.stopPropagation();

    EDI_movementBasedCacheInvalidation();
    EDI_preKeyboardMovementSelectionLogic(event.shiftKey);
    if (event.ctrlKey) {
        gINT_FIELDS[fEDI_cursor_indexLine] = 0;
        gINT_FIELDS[fEDI_cursor_indexColumn] = 0;
    }
    else {
        let endExclusiveIndentationIndexColumn = EDI_findEndExclusiveIndentationIndexColumn();
        if (gINT_FIELDS[fEDI_cursor_indexColumn] == endExclusiveIndentationIndexColumn) {
            gINT_FIELDS[fEDI_cursor_indexColumn] = 0;
        }
        else {
            gINT_FIELDS[fEDI_cursor_indexColumn] = endExclusiveIndentationIndexColumn;
        }
    }
    EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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
        gINT_FIELDS[fEDI_cursor_indexLine] = EDI_lineEndPositionList.count - 1;
    }
    gINT_FIELDS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);
    EDI_postKeyboardMovementSelectionLogic(event.shiftKey);
    gINT_FIELDS[fEDI_cursor_STORED_indexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    EDI_render_request(RenderKind_Cursor_n);
    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
        EDI_cursorBlink_startChecking();
    }
    return false;
}

function EDI_onKeyDown_PageDown(event) {
    event.stopPropagation();

    if (event.ctrlKey) {
        gINT_FIELDS[fEDI_cursor_indexLine] = gINT_FIELDS[fEDI_virtualIndexLine] + gINT_FIELDS[fEDI_virtualCount];
        if (gINT_FIELDS[fEDI_virtualCount] > 1) {
            // this seems to more commonly have the cursor staying within the viewport rather than overlapping outside.
            gINT_FIELDS[fEDI_cursor_indexLine]--;
        }
        if (gINT_FIELDS[fEDI_cursor_indexLine] >= EDI_lineEndPositionList.count) {
            // TODO: You can't delete EOF can you? i.e.: cursor final position of file then delete?
            gINT_FIELDS[fEDI_cursor_indexLine] = EDI_lineEndPositionList.count - 1;
        }
        gINT_FIELDS[fEDI_cursor_indexColumn] = 0;
        // TODO: allow someone to select via this keybind, but for now it causes a bad selection if you { 'Ctrl' + 'a' } then use it so I'm clearing any active selection here for now.
        gINT_FIELDS[fEDI_cursor_selectionAnchor] = gINT_FIELDS[fEDI_cursor_selectionEnd];
        EDI_render_request(RenderKind_Cursor_n);
        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
            EDI_cursorBlink_startChecking();
        }
    }
}

function EDI_onKeyDown_PageUp(event) {
    event.stopPropagation();

    if (event.ctrlKey) {        
        gINT_FIELDS[fEDI_cursor_indexLine] = gINT_FIELDS[fEDI_virtualIndexLine];
        if (gINT_FIELDS[fEDI_virtualCount] > 1) {
            // this seems to more commonly have the cursor staying within the viewport rather than overlapping outside.
            gINT_FIELDS[fEDI_cursor_indexLine]++;
        }
        if (gINT_FIELDS[fEDI_cursor_indexLine] >= EDI_lineEndPositionList.count) {
            // TODO: You can't delete EOF can you? i.e.: cursor final position of file then delete?
            gINT_FIELDS[fEDI_cursor_indexLine] = EDI_lineEndPositionList.count - 1;
        }
        gINT_FIELDS[fEDI_cursor_indexColumn] = 0;
        // TODO: allow someone to select via this keybind, but for now it causes a bad selection if you { 'Ctrl' + 'a' } then use it so I'm clearing any active selection here for now.
        gINT_FIELDS[fEDI_cursor_selectionAnchor] = gINT_FIELDS[fEDI_cursor_selectionEnd];
        EDI_render_request(RenderKind_Cursor_n);
        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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

            EDI_finalizeAllCursors();
            await EDI_copySelection();
            break;
        case 'x':

            event.preventDefault();
            event.stopPropagation();

            EDI_finalizeAllCursors();
            await EDI_copySelection();
            EDI_removeSelection(); // TODO: Multicursor bad
            EDI_render_request(RenderKind_Cursor_n);
            if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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

            EDI_finalizeAllCursors(); // TODO: Multicursor bad
            gINT_FIELDS[fEDI_cursor_selectionAnchor] = 0;
            gINT_FIELDS[fEDI_cursor_selectionEnd] = EDI_textByteList.count;
            EDI_getLineAndColumnIndices(gINT_FIELDS[fEDI_cursor_selectionEnd]);
            let selectionEndLineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
            let selectionEndLineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn];
            gINT_FIELDS[fEDI_cursor_indexLine] = selectionEndLineAndColumnIndices_indexLine;
            gINT_FIELDS[fEDI_cursor_indexColumn] = selectionEndLineAndColumnIndices_indexColumn;
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

function EDI_onMouseDown(event) {
    EDI_movementBasedCacheInvalidation();
    
    // TODO: You might want to do this inside 'EDI_finalizeAllCursors_andClearNonPrimaryCursors();' at the end... I'm not sure.
    gINT_FIELDS[fEDI_offsetColumn] = 0;
    gINT_FIELDS[fEDI_offsetLine] = 0;

    if (get_EDI_recentBoundingClientRect_isNull_intFalsey()) {
        let boundingClientRect = EDI_baseElement.getBoundingClientRect();
        gINT_FIELDS[fEDI_recentBoundingClientRect_left] = boundingClientRect.left;
        gINT_FIELDS[fEDI_recentBoundingClientRect_top] = boundingClientRect.top;
        set_EDI_recentBoundingClientRect_isNull_intFalsey(0);
    }

    if (event.button === 0) {
        gBYTE_FIELDS[byteEDI_mousemove_eventListener_isActive] = true;
        EDI_baseElement.addEventListener('mousemove', EDI_onMouseMove_WRAPIT);
    }

    let rY = event.clientY - gINT_FIELDS[fEDI_recentBoundingClientRect_top] + gINT_FIELDS[fEDI_lastReadNumber_scrollTop];
    let rX = event.clientX - gINT_FIELDS[fEDI_recentBoundingClientRect_left] - gINT_FIELDS[fEDI_gutterWidthTotal] + gINT_FIELDS[fEDI_lastReadNumber_scrollLeft];
    
    let indexLine = Math.floor(rY / gINT_FIELDS[fEDI_lineHeight]);
    let indexColumn = Math.round(rX / EDI_characterWidth);

    if (indexLine < 0) {
        indexLine = 0;
    }

    if (indexColumn < 0) {
        indexColumn = 0;
    }

    if (indexLine >= EDI_lineEndPositionList.count) {
        indexLine = EDI_lineEndPositionList.count - 1;
    }

    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);
    if (indexColumn > lastValidIndexColumn) {
        indexColumn = lastValidIndexColumn;
    }

    if (rX < -1 * CONST_EDI_gutterPaddingRight) {
        set_EDI_detailRank(3);
        EDI_onMouseDownDetailRankThree(event.button, event.shiftKey, indexLine, indexColumn);
        if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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
        EDI_onMouseDownDetailRankOne(event.button, event.shiftKey, indexLine, indexColumn);
    }

    if (!gBYTE_FIELDS[byteEDI_isChecking_cursorBlinkTrailingEdge]) {
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

    let menuLeft = gINT_FIELDS[fEDI_recentBoundingClientRect_left] + gINT_FIELDS[fEDI_gutterWidthTotal] + gINT_FIELDS[fEDI_cursor_cursorTranslateXValue] - gINT_FIELDS[fEDI_lastReadNumber_scrollLeft];
    let menuTop = gINT_FIELDS[fEDI_recentBoundingClientRect_top] + gINT_FIELDS[fEDI_cursor_cursorTranslateYValue] + gINT_FIELDS[fEDI_lineHeight] - gINT_FIELDS[fEDI_lastReadNumber_scrollTop];

    return menuSet('EDITOR', null, optionList, menuLeft, menuTop);
}

function EDI_onWheel(event) {
    if (event.shiftKey) {
        EDI_baseElement.scrollBy(event.deltaY, 0);
        // TODO: 'gINT_FIELDS[fEDI_lastReadNumber_scrollLeft]' here?
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

    EDI_finalizeAllCursors();

    EDI_findOverlay_searchResultPositionList.clear();

    let offset = 0;
    let posStartOfMatch = 0;

    /** Given the current EDI_primaryCursor position, which match comes next. */
    let nextMatchNumber = -1;
    let nextMatchPos;

    if (EDI_cursor_hasSelection()) {
        let small = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        let large = gINT_FIELDS[fEDI_cursor_selectionEnd];
        if (gINT_FIELDS[fEDI_cursor_selectionAnchor] > gINT_FIELDS[fEDI_cursor_selectionEnd]) {
            small = gINT_FIELDS[fEDI_cursor_selectionEnd];
            large = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        }
        nextMatchPos = small;
    }
    else {
        nextMatchPos = EDI_getPositionIndex_cursor();
    }
    
    if (get_EDI_findOverlay_options_matchWord() && ((searchEncoded[0] >= 97 && searchEncoded[0] <= 122) || (searchEncoded[0] >= 65 && searchEncoded[0] <= 90) || (searchEncoded[0] >= 48 && searchEncoded[0] <= 57) || (searchEncoded[0] === 95))) {
		for (let i = 0; i < EDI_textByteList.count; i++) {
			if ((EDI_textByteList.bytes[i] >= 97 && EDI_textByteList.bytes[i] <= 122) || (EDI_textByteList.bytes[i] >= 65 && EDI_textByteList.bytes[i] <= 90) || (EDI_textByteList.bytes[i] >= 48 && EDI_textByteList.bytes[i] <= 57) || (EDI_textByteList.bytes[i] === 95)) {
				if (EDI_textByteList.bytes[i] === searchEncoded[0]) {
    				while (i < EDI_textByteList.count) { // context switch to checking match
    					if (EDI_textByteList.bytes[i] === searchEncoded[offset]) {
				            if (offset === 0) {
				                posStartOfMatch = i;
				            }
				            offset++;
				            if (offset === searchEncoded.length) { // found "possible match"
				            	if (i + 1 >= EDI_textByteList.count ||
				            		!((EDI_textByteList.bytes[i + 1] >= 97 && EDI_textByteList.bytes[i + 1] <= 122) || (EDI_textByteList.bytes[i + 1] >= 65 && EDI_textByteList.bytes[i + 1] <= 90) || (EDI_textByteList.bytes[i + 1] >= 48 && EDI_textByteList.bytes[i + 1] <= 57) || (EDI_textByteList.bytes[i + 1] === 95))) { // ends on a word, therefore take match
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
				            		while (i < EDI_textByteList.count) { // move pos to next NON(letterOrDigit) or EOF
				            			if (!((EDI_textByteList.bytes[i] >= 97 && EDI_textByteList.bytes[i] <= 122) || (EDI_textByteList.bytes[i] >= 65 && EDI_textByteList.bytes[i] <= 90) || (EDI_textByteList.bytes[i] >= 48 && EDI_textByteList.bytes[i] <= 57) || (EDI_textByteList.bytes[i] === 95))) {
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
				            while (i < EDI_textByteList.count) { // move pos to next NON(letterOrDigit) or EOF
		            			if (!((EDI_textByteList.bytes[i] >= 97 && EDI_textByteList.bytes[i] <= 122) || (EDI_textByteList.bytes[i] >= 65 && EDI_textByteList.bytes[i] <= 90) || (EDI_textByteList.bytes[i] >= 48 && EDI_textByteList.bytes[i] <= 57) || (EDI_textByteList.bytes[i] === 95))) {
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
					while (i < EDI_textByteList.count) { // move pos to next NON(letterOrDigit) or EOF
            			if (!((EDI_textByteList.bytes[i] >= 97 && EDI_textByteList.bytes[i] <= 122) || (EDI_textByteList.bytes[i] >= 65 && EDI_textByteList.bytes[i] <= 90) || (EDI_textByteList.bytes[i] >= 48 && EDI_textByteList.bytes[i] <= 57) || (EDI_textByteList.bytes[i] === 95))) {
            				i--; // backtrack by one due to outer for loop's incrementation step
            				break;
            			}
        				i++;
            		}
				}
			}
			else {
				while (i < EDI_textByteList.count) { // move pos to next letterOrDigit or EOF
        			if ((EDI_textByteList.bytes[i] >= 97 && EDI_textByteList.bytes[i] <= 122) || (EDI_textByteList.bytes[i] >= 65 && EDI_textByteList.bytes[i] <= 90) || (EDI_textByteList.bytes[i] >= 48 && EDI_textByteList.bytes[i] <= 57) || (EDI_textByteList.bytes[i] === 95)) {
        				i--; // backtrack by one due to outer for loop's incrementation step
        				break;
        			}
    				i++;
        		}
			}
	    }
    }
    else {
    	for (let i = 0; i < EDI_textByteList.count; i++) {
	        if (EDI_textByteList.bytes[i] === searchEncoded[offset]) {
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
    EDI_finalizeAllCursors();

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
        	EDI_finalizeAllCursors();
            let selectionAnchor = gINT_FIELDS[fEDI_cursor_selectionAnchor];
            let selectionEnd = gINT_FIELDS[fEDI_cursor_selectionEnd];
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
        if (pos <= EDI_textByteList.count) {
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
        if (pos <= EDI_textByteList.count) {
            EDI_moveCursor_position(pos);
        }
    }
}

function EDI_render_do_IndentMore() {

    const ints = gINT_FIELDS;

    // When you're done with IndentLess batch editing correctly.
    // You still need to come back to the render for
    // - [ ] IndentMore and
    // - [ ] IndentLess
    //
    // and ensure that they render properly. This currently if two edits get done in a single "rAF" the second is cancelled for redundancy yet each one only handles 1 editDisplacement so you missed 1 displacement.

    let startingIndex = ints[fEDI_indent_startingIndex];
    let SMALL_lineAndColumnIndices_indexLine = ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];

    // TODO: Consider having this string available rather than making it everytime this function is invoked.
    let EDI_on_tab_string = '';
    for (let i = 0; i < EDI_on_tab_bytes.length; i++) {
        EDI_on_tab_string += String.fromCharCode(EDI_on_tab_bytes[i]);
    }

    if (ints[fEDI_cursor_editKind] !== EditKind_IndentMore) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        ints[fEDI_cursor_editRenderedDisplacement]++;
        for (var lineI = startingIndex; lineI >= SMALL_lineAndColumnIndices_indexLine; lineI--) {
            let linePos = EDI_getLineBoundaryPositions(lineI);

            // Draw the line to reflect the edit, if it is being currently shown on screen.
            // TODO: Use NEXT if the lines are one after another?
            
            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexLine = (lineI + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
            if (beltIndexLine >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine < 0) beltIndexLine = -1;
            else beltIndexLine = (beltIndexLine + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

            if (beltIndexLine >= 0) {
                    let div = EDI_textElement.children[beltIndexLine];
                    let span;
                    if (div.children[0].className === '') {
                        span = div.children[0];
                    }
                    else {
                        span = document.createElement('span');
                        div.insertBefore(span, div.children[0]);
                    }
                    if (span.textContent.length > 0 &&
                        (span.textContent[0] === ' ' || span.textContent[0] === '\t' || span.textContent[0] === '\0') &&
                        (span.textContent[span.textContent.length - 1] === ' ' || span.textContent[span.textContent.length - 1] === '\t' || span.textContent[span.textContent.length - 1] === '\0')) {
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
    if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices_raw(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let SMALL_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    EDI_getLineAndColumnIndices_raw(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let LARGE_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn]; // TODO: remove these unused if they're truly unused.

    // # Determine the starting indexLine (the start is the large position, this confused me for a moment)
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    let startingLinePos = EDI_getLineBoundaryPositions_raw(startingIndex);
    if (startingLinePos.start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            startingLinePos = EDI_getLineBoundaryPositions_raw(startingIndex);
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    gINT_FIELDS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = SMALL_lineAndColumnIndices_indexLine;
    gINT_FIELDS[fEDI_indent_startingIndex] = startingIndex;

    if (gINT_FIELDS[fEDI_cursor_editLength] === 0) {
        gINT_FIELDS[fEDI_EDI_indentLess_startingLinePos_end] = startingLinePos.end;
    } 

    //// # Update the cursor's selection to reflect the inserted text
    //if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
    //    gINT_FIELDS[fEDI_cursor_selectionEnd] += ORIGINAL_incrementBy;
    //}
    //else {
    //    gINT_FIELDS[fEDI_cursor_selectionAnchor] += ORIGINAL_incrementBy;
    //}

    // # Update the cursor's indexColumn to reflect the inserted text
    gINT_FIELDS[fEDI_cursor_indexColumn] += 4;

    //// # Update the cursor's selection to reflect the inserted text
    //let smallLinePos = EDI_getLineBoundaryPositions(SMALL_lineAndColumnIndices.indexLine);
    //if (SMALL_pos > smallLinePos.start) {
    //    if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
    //        gINT_FIELDS[fEDI_cursor_selectionAnchor] += 4;
    //    }
    //    else {
    //        gINT_FIELDS[fEDI_cursor_selectionEnd] += 4;
    //    }
    //}

    gINT_FIELDS[fEDI_cursor_editLength]++;
    EDI_render_request(RenderKind_IndentMore);
}

function EDI_render_do_IndentLess() {
    
    const ints = gINT_FIELDS;

    let startingIndex = ints[fEDI_indent_startingIndex] = startingIndex;
    let SMALL_lineAndColumnIndices_indexLine = ints[fEDI_indent_SMALL_lineAndColumnIndices_indexLine];

    if (ints[fEDI_cursor_editKind] !== EditKind_IndentLess) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        
        ints[fEDI_cursor_editRenderedDisplacement]++;

        /////////////////////// P_1
        let textSelectionDiv;
        if (gBYTE_FIELDS[byteEDI_cursor_selectionDivExists]) {
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
            let linePos = EDI_getLineBoundaryPositions(lineI);
            let line = linePos;
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
                let c = getCharacter(line.start + i);
                switch (c) {
                    case ' ':
                        seenSpace = true;
                        innerRemoveCount++;
                        break;
                    case '\t':
                        if (!seenSpace) {
                            innerRemoveCount += 4;
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

            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexLine = (lineI + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
            if (beltIndexLine >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine < 0) beltIndexLine = -1;
            else beltIndexLine = (beltIndexLine + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

            if (beltIndexLine >= 0) {
                    let div = EDI_textElement.children[beltIndexLine];
                    let span = div.children[0];
                    span.textContent = span.textContent.slice(innerRemoveCount);
            }
        }

        /////////////////////// P_3
        ints[fEDI_cursor_DRAWN_selectionAnchor] = ints[fEDI_cursor_selectionAnchor];
        ints[fEDI_cursor_DRAWN_selectionEnd] = ints[fEDI_cursor_selectionEnd];
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
    if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
    }
    else {
        SMALL_pos = gINT_FIELDS[fEDI_cursor_selectionEnd];
        LARGE_pos = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    }

    EDI_getLineAndColumnIndices(SMALL_pos);
    let SMALL_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let SMALL_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn];
    
    EDI_getLineAndColumnIndices(LARGE_pos);
    let LARGE_lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let LARGE_lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn];

    // starting index
    let startingIndex = LARGE_lineAndColumnIndices_indexLine;
    let startingLinePos = EDI_getLineBoundaryPositions(startingIndex);
    if (startingLinePos.start === LARGE_pos) {
        startingIndex -= 1;
        if (startingIndex >= 0) {
            startingLinePos = EDI_getLineBoundaryPositions(startingIndex);
        }
    }
    if (startingIndex < SMALL_lineAndColumnIndices_indexLine) {
        return;
    }

    gINT_FIELDS[fEDI_indent_SMALL_lineAndColumnIndices_indexLine] = SMALL_lineAndColumnIndices_indexLine;
    gINT_FIELDS[fEDI_indent_startingIndex] = startingIndex;

    if (gINT_FIELDS[fEDI_cursor_editLength] === 0) {
        gINT_FIELDS[fEDI_EDI_indentLess_startingLinePos_end] = startingLinePos.end;
    }

    // TODO: Some kind of "fake" selection somehow because you really only need to modify the top-left most selection and the bottom-right most selection.
    // Then when you perhaps hit 'ctrl + c' to copy. You'd need to finalize the edit then and there so you copy the text correctly.
    //
    //if (gINT_FIELDS[fEDI_cursor_selectionAnchor] < gINT_FIELDS[fEDI_cursor_selectionEnd]) {
    //    gINT_FIELDS[fEDI_cursor_selectionEnd] -= ORIGINAL_decrementBy;
    //}
    //else {
    //    gINT_FIELDS[fEDI_cursor_selectionAnchor] -= ORIGINAL_decrementBy;
    //}

    gINT_FIELDS[fEDI_cursor_editLength]++;
    EDI_render_request(RenderKind_IndentLess);
}

/**
 * Invoking 'EDI_finalizeAllCursors()' is a good idea prior to invoking this. Long term perhaps this won't be so important.
 */
async function EDI_copySelection() {
	if (!EDI_cursor_hasSelection()) {
		// TODO: This code has a bug and doesn't work with multicursor... EDI_onMouseDownDetailRankThree needs to accept a cursor rather than acting on EDI_primaryCursor
    	EDI_onMouseDownDetailRankThree(0, false, gINT_FIELDS[fEDI_cursor_indexLine], gINT_FIELDS[fEDI_cursor_indexColumn]);
	}
	let selectionAnchor = gINT_FIELDS[fEDI_cursor_selectionAnchor];
    let selectionEnd = gINT_FIELDS[fEDI_cursor_selectionEnd];
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
    return window.myAPI.editorSetClipboard(EDI_textByteList.bytes, small, large - small, EDI_lineEndString);
}

/**
 * Invoking 'EDI_finalizeAllCursors()' is a good idea prior to invoking this. Long term perhaps this won't be so important.
 */
async function EDI_duplicateSelection() {

    const ints = gINT_FIELDS;

	if (!EDI_cursor_hasSelection()) {
		// TODO: This code has a bug and doesn't work with multicursor... EDI_onMouseDownDetailRankThree needs to accept a cursor rather than acting on EDI_primaryCursor...
        // ...these days the todo is somewhat incorrect, it takes cursor now, but you'd need to check whether this causes the selection of two cursors to overlap.
    	EDI_onMouseDownDetailRankThree(0, false, ints[fEDI_cursor_indexLine], ints[fEDI_cursor_indexColumn]);
	}

	let selectionAnchor = ints[fEDI_cursor_selectionAnchor];
    let selectionEnd = ints[fEDI_cursor_selectionEnd];
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

    ints[fEDI_cursor_editPosition] = large;
    EDI_getLineAndColumnIndices(large);
    let large_lineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
    let large_lineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    ints[fEDI_cursor_editIndexLine] = large_lineAndColumnIndices_indexLine;
    ints[fEDI_cursor_editIndexColumn] = large_lineAndColumnIndices_indexColumn;
    ints[fEDI_cursor_editLength] = length;

    ints[fEDI_cursor_indexLine] = large_lineAndColumnIndices_indexLine;
    ints[fEDI_cursor_indexColumn] = large_lineAndColumnIndices_indexColumn;

    ints[fEDI_cursor_EDI_duplicate_small] = small;
    ints[fEDI_cursor_EDI_duplicate_length] = length;

    ints[fEDI_cursor_selectionAnchor] = large;
    ints[fEDI_cursor_selectionEnd] = large + length;

    // TODO: The previous render logic was actually moving the cursor as well. Just something to keep in mind, you might see a bug related to this.
    EDI_render_request(RenderKind_DuplicateOrPaste);
}

function EDI_render_do_DuplicateOrPaste() {

    const ints = gINT_FIELDS;

    // Word
    // Tab
    // LineFeed

    // Duplicate / Paste
    // - [x] get Word to work
    //     - [x] for 'duplicate'
    //     - [x] for 'paste'
    // - [x] get Tab to work
    //     - [x] for 'duplicate'
    //     - [x] for 'paste'
    // - [x] get lineFeed to work
    //     - [x] for 'duplicate'
    //     - [x] for 'paste'

    let hasSeenLinefeed = false;

    if (ints[fEDI_cursor_editKind] !== EditKind_Duplicate && ints[fEDI_cursor_editKind] !== EditKind_Paste) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength] || ints[fEDI_cursor_editKind] === EditKind_Paste /* Paste has an editLength of 0 currently */) {

        let small = ints[fEDI_cursor_EDI_duplicate_small];
        let length = ints[fEDI_cursor_EDI_duplicate_length];
        let large = small + length;
        
        // TODO: update the 'ints[fEDI_cursor_editRenderedDisplacement]'

        let byteArray;

        // TODO: re-use the paste byte array
        if (ints[fEDI_cursor_editKind] === EditKind_Duplicate) {
            byteArray = EDI_textByteList.bytes.subarray(small, large);
        }
        else if (ints[fEDI_cursor_editKind] === EditKind_Paste) {
            large = EDI_getPositionIndex_raw_cursor();
            let clipboardContent = EDI_cursor_EDI_paste_clipboardContent;
            let clipboardContentLength = clipboardContent.length;

            let lengthBytes = 0;
            let pos = 0;

            while (pos < clipboardContentLength) {
                switch (clipboardContent[pos]) {
                    case '\r':
                        lengthBytes++;
                        if (pos < clipboardContentLength - 1 && clipboardContent[pos + 1] === '\n') {
                            pos += 2;
                        }
                        else {
                            pos++;
                        }
                        break;
                    case '\t':
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
            // TODO: You need 'ints[fEDI_cursor_editLength]' when finalizing the cursor right? It isn't set until this point for Paste edits.
            ints[fEDI_cursor_editLength] = lengthBytes;

            // I'm gonna re-use lengthBytes to populate the array to avoid messing something up just to get a different variable with the name of maybe 'offsetBytes' or some such.
            lengthBytes = 0;
            pos = 0;

            while (pos < clipboardContentLength) {
                switch (clipboardContent[pos]) {
                    case '\r':
                        byteArray[lengthBytes++] = 10; // char code for '\n' is 10
                        if (pos < clipboardContentLength - 1 && clipboardContent[pos + 1] === '\n') { // Editor tracks all linefeeds as '\n', then when saving out the file swaps the '\n' for whatever the originally first encountered line end kind was (perhaps '\r', '\n' or '\r\n').
                            pos += 2;
                        }
                        else {
                            pos++;
                        }
                        break;
                    case '\t':
                        // '\t\0\0\0' was likely a bad idea and should "TODO: be changed", but nevertheless it is how the editor works at the moment.
                        //
                        byteArray[lengthBytes++] = 9; // char code for '\t' is 9
                        byteArray[lengthBytes++] = 0; // char code for '\0' is 0
                        byteArray[lengthBytes++] = 0; // char code for '\0' is 0
                        byteArray[lengthBytes++] = 0; // char code for '\0' is 0
                        pos++;
                        break;
                    default:
                        byteArray[lengthBytes++] = clipboardContent.charCodeAt(pos);
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

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_current = ((ints[fEDI_cursor_indexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_current >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_current < 0) beltIndexLine_current = -1;
        else beltIndexLine_current = (beltIndexLine_current + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_first = ((ints[fEDI_virtualIndexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_first >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_first < 0) beltIndexLine_first = -1;
        else beltIndexLine_first = (beltIndexLine_first + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        // TODO: Use PREVIOUS here from 'beltIndexLine_first'

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
        else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];


        let last_valid_indexColumn_currentLine = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);

        // TODO: An optimization to check whether you even need to redraw any lines perhaps is possible but it would add too much complexity at the moment and so it isn't being considered...
        // ...i.e.: if you're inserting so many lines that you know you'll scroll or that only a small amount of lines need to be redrawn due to predicting a scroll event.

        let shouldPreserveCssClassWhenSplittingAmongLine = false;
        let hasSeenLinefeed = false;

        let original_indexColumn_SpanTextContentRelative = ints[fEDI_w_indexColumn_SpanTextContentRelative];
        let original_span_textContent_length = w_span.textContent.length;
        let original_tracked_syntax_start = positionIndex - ints[fEDI_cursor_indexColumn] + ints[fEDI_w_indexColumn_Sum];

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
                            // TODO: This is nonsensical you cannot numerically compare a belt index because the zeroth index isn't necessarily 0
                            if (beltIndexLine_current > beltIndexLine_last) return;
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

        ints[fEDI_cursor_editLength] = insertionLength;
        ints[fEDI_cursor_editPosition] = large;

        if (linesInsertedCount > 0) {
            update_verticalVirtualizationBoundary(EDI_lineEndPositionList.count + linesInsertedCount);
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
                // TODO: This is nonsensical you cannot numerically compare a belt index because the zeroth index isn't necessarily 0
                if (beltIndexLine_current > beltIndexLine_last) {
                    // A scroll should take place and handle the rest
                    // Note: any lines indices that don't change between the current scrollTop and what is shown with the new scrollTop...
                    // ...won't redraw so you still need to run this code for some of the lines.
                    // you could probably predict which lines in particular overlap or some such but it isn't being done here currently.
                    break;
                }

                if (ints[fEDI_cursor_indexColumn] === 0 && last_valid_indexColumn_currentLine !== 0) { // start of line
                    
                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, beltIndexLine_current);
                    EDI_textElement.children[beltIndexLine_current].appendChild(document.createElement('span'));

                    beltIndexLine_current = (beltIndexLine_current + 1) % ints[fEDI_ArrayFrom_textElement_children_length];
                    let lineDiv = EDI_textElement.children[beltIndexLine_current];
                    w_div = lineDiv;
                    ints[fEDI_w_indexSpan] = 0;
                    w_span = lineDiv.children[ints[fEDI_w_indexSpan]];
                    ints[fEDI_w_indexColumn_Goal] = 0;
                    ints[fEDI_w_indexColumn_Sum] = 0;
                    ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    ints[fEDI_cursor_indexLine]++;
                    ints[fEDI_cursor_indexColumn] = 0;

                    continue;
                }
                else {
                    // ensure this conditional branch continues if handled, otherwise it will execute the fallback case erroneously
                    if (last_valid_indexColumn_currentLine === ints[fEDI_cursor_indexColumn]) { // end of line

                        beltIndexLine_current = (beltIndexLine_current + 1) % ints[fEDI_ArrayFrom_textElement_children_length];
                        
                        EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, beltIndexLine_current);
                        let span = document.createElement('span');
                        EDI_textElement.children[beltIndexLine_current].appendChild(span);

                        let lineDiv = EDI_textElement.children[beltIndexLine_current];
                        w_div = lineDiv;
                        ints[fEDI_w_indexSpan] = 0;
                        w_span = lineDiv.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_Goal] = 0;
                        ints[fEDI_w_indexColumn_Sum] = 0;
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                        ints[fEDI_cursor_indexLine]++;
                        ints[fEDI_cursor_indexColumn] = 0;
                        last_valid_indexColumn_currentLine = 0;
                        

                        continue;
                    }
                    else { // among a line
                        // This case can only happen once at the start of the edit

                        let spanClassName = '';
                        let spanText = '';

                        if (ints[fEDI_w_indexColumn_Goal] > 0) {
                            if (ints[fEDI_w_indexColumn_Goal] !== ints[fEDI_w_indexColumn_Sum] + w_span.textContent.length) {
                                let firstText = w_span.textContent.substring(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]);
                                let lastText = w_span.textContent.substring(ints[fEDI_w_indexColumn_SpanTextContentRelative]);
                                last_valid_indexColumn_currentLine = lastText.length;
                                w_span.textContent = firstText;
                                spanText += lastText; // This might NOT have to be +=, but it is due to the enter key method having needed += and this continues the pattern.
                                if (shouldPreserveCssClassWhenSplittingAmongLine) {
                                    spanClassName = w_span.className;
                                }
                            }
                        }

                        beltIndexLine_current = (beltIndexLine_current + 1) % ints[fEDI_ArrayFrom_textElement_children_length];

                        EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, beltIndexLine_current);

                        let aaa = EDI_textElement.children[beltIndexLine_current];
                        let span = document.createElement('span');
                        span.className = spanClassName;
                        span.textContent = spanText;
                        aaa.appendChild(span);

                        let rememberIndex = ints[fEDI_w_indexSpan] + 1;
                        let rememberLength = w_div.children.length;
                        for (let i = rememberIndex; i < rememberLength; i++) {
                            aaa.appendChild(w_div.children[rememberIndex]);
                        }

                        let lineDiv = EDI_textElement.children[beltIndexLine_current];
                        w_div = lineDiv;
                        ints[fEDI_w_indexSpan] = 0;
                        w_span = lineDiv.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_Goal] = 0;
                        ints[fEDI_w_indexColumn_Sum] = 0;
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                        ints[fEDI_cursor_indexLine]++;
                        ints[fEDI_cursor_indexColumn] = 0;
                        // last_valid_indexColumn_currentLine is being set when splitting the text.

                        continue;
                    }
                }
            }

            linefeedLength = 0;
        }

        function EDI_duplicate_and_paste_writeWord(wordLength, word) {
            w_span.textContent = 
                w_span.textContent.slice(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]) +
                word +
                w_span.textContent.slice(ints[fEDI_w_indexColumn_SpanTextContentRelative]);

            ints[fEDI_cursor_indexColumn] += wordLength;
            ints[fEDI_w_indexColumn_SpanTextContentRelative] += wordLength;
        }
    }
}

/**
 * @param {*} content 
 */
function EDI_paste(content) {
    let positionIndex = EDI_getPositionIndex_cursor();

    const ints = gINT_FIELDS;

    ints[fEDI_cursor_editPosition] = positionIndex;
    ints[fEDI_cursor_editIndexLine] = ints[fEDI_cursor_indexLine];
    ints[fEDI_cursor_editIndexColumn] = ints[fEDI_cursor_indexColumn];

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

    // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
    let beltIndexLine_current = ((ints[fEDI_cursor_indexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
    if (beltIndexLine_current >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_current < 0) beltIndexLine_current = -1;
    else beltIndexLine_current = (beltIndexLine_current + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

    // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
    let beltIndexLine_first = ((ints[fEDI_virtualIndexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
    if (beltIndexLine_first >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_first < 0) beltIndexLine_first = -1;
    else beltIndexLine_first = (beltIndexLine_first + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

    // TODO: Use PREVIOUS here from 'beltIndexLine_first'
    
    // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
    let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
    if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
    else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

    let last_valid_indexColumn_currentLine = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);

    // TODO: An optimization to check whether you even need to redraw any lines perhaps is possible but it would add too much complexity at the moment and so it isn't being considered...
    // ...i.e.: if you're inserting so many lines that you know you'll scroll or that only a small amount of lines need to be redrawn due to predicting a scroll event.

    let shouldPreserveCssClassWhenSplittingAmongLine = false;
    let hasSeenLinefeed = false;

    //let original_indexColumn_SpanTextContentRelative = ints[fEDI_w_indexColumn_SpanTextContentRelative];
    //let original_span_textContent_length = w_span.textContent.length;
    //let original_tracked_syntax_start = positionIndex - ints[fEDI_cursor_indexColumn] + ints[fEDI_w_indexColumn_Sum];

    for (var sourceI = 0; sourceI < content.length; sourceI++) {
        switch (content[sourceI]) {
            case '\n':
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
            case '\r':
                //
                if (wordLength > 0) {
                    //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
                    last_valid_indexColumn_currentLine += wordLength;
                    wordStart = 0;
                    wordLength = 0;
                }
                //else if (tabLength > 0) writeTab();
                //
                if (sourceI < content.length - 1 && content[sourceI + 1] === '\n') {
                    sourceI++;
                }
                insertionLength++;
                linesInsertedCount++;
                //
                linefeedLength++;
                break;
            case '\t':
                //
                if (wordLength > 0) {
                    //EDI_duplicate_and_paste_writeWord(wordLength, content.substring(wordStart, wordStart + wordLength));
                    last_valid_indexColumn_currentLine += wordLength;
                    wordStart = 0;
                    wordLength = 0;
                }
                //else if (linefeedLength > 0) writeLinefeed();
                // TODO: Extremely important next line but it doesn't fully pattern with every case so it is somewhat out of nowhere
                // TODO: This is nonsensical you cannot numerically compare a belt index because the zeroth index isn't necessarily 0
                if (beltIndexLine_current > beltIndexLine_last) return;
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
                // TODO: This is nonsensical you cannot numerically compare a belt index because the zeroth index isn't necessarily 0
                if (beltIndexLine_current > beltIndexLine_last) return;
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
        update_verticalVirtualizationBoundary(EDI_lineEndPositionList.count + linesInsertedCount);
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
                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_Comment, indexPosition - gINT_FIELDS[fEDI_cursor_indexColumn] + gINT_FIELDS[fEDI_w_indexColumn_Sum], original_span_textContent_length);
                return true;
            }
            return false;
        case 'eCM':
            return true;
        case 'eSm':
            if (original_indexColumn_SpanTextContentRelative >= 1 && (original_indexColumn_SpanTextContentRelative <= original_span_textContent_length - 1)) {
                w_span.className = 'eSM';
                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_String, indexPosition - gINT_FIELDS[fEDI_cursor_indexColumn] + gINT_FIELDS[fEDI_w_indexColumn_Sum], original_span_textContent_length);
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
    if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_Tab) {
        return;
    }
    if (gINT_FIELDS[fEDI_cursor_editRenderedDisplacement] < gINT_FIELDS[fEDI_cursor_editLength] || gINT_FIELDS[fEDI_cursor_editKind] === EditKind_Tab) {

        gINT_FIELDS[fEDI_cursor_indexColumn] -= 4; // awkward thing to have 'walkLineUntilIndexColumn' invocation work then at end of block I '+= 4'.

        walkLineUntilIndexColumn();

        if (!w_span || !w_div) {
            // TODO: silent error bad
            return;
        }

        // TODO: Consider having this string available rather than making it everytime this function is invoked.
        let EDI_on_tab_string = '';
        for (let i = 0; i < EDI_on_tab_bytes.length; i++) {
            EDI_on_tab_string += String.fromCharCode(EDI_on_tab_bytes[i]);
        }

        w_span.textContent = 
            w_span.textContent.slice(0, gINT_FIELDS[fEDI_w_indexColumn_SpanTextContentRelative]) +
            EDI_on_tab_string +
            w_span.textContent.slice(gINT_FIELDS[fEDI_w_indexColumn_SpanTextContentRelative]);

        gINT_FIELDS[fEDI_cursor_indexColumn] += 4; // awkward thing to have 'walkLineUntilIndexColumn' invocation work then at end of block I '+= 4'.
    }
}

function EDI_tabKey() {

    if (gINT_FIELDS[fEDI_cursor_editLength] === 0) {
        gINT_FIELDS[fEDI_cursor_editPosition] = EDI_getPositionIndex_cursor();
        gINT_FIELDS[fEDI_cursor_editIndexLine] = gINT_FIELDS[fEDI_cursor_indexLine];
        gINT_FIELDS[fEDI_cursor_editIndexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    }

    gINT_FIELDS[fEDI_cursor_editLength]++;

    gINT_FIELDS[fEDI_cursor_indexColumn] += 4; // this has to come after the 'walkLineUntilIndexColumn' invocation.

    EDI_render_request(RenderKind_TabKey);
}

/**
 * @returns the COLUMN index that exclusively ends the indentation.
 */
function EDI_findEndExclusiveIndentationIndexColumn() {
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);
    let line = EDI_getLineBoundaryPositions(gINT_FIELDS[fEDI_cursor_indexLine]);

    for (var i = 0; i < lastValidIndexColumn; i++) {
        let c = getCharacter(line.start + i);
        switch (c) {
            case ' ':
            case '\t':
            case '\0': // tabs are stored as: '\t\0\0\0'
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
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);
    let line = EDI_getLineBoundaryPositions(gINT_FIELDS[fEDI_cursor_indexLine]);

    let upperLimitIndexColumn;

    if (lastValidIndexColumn > gINT_FIELDS[fEDI_cursor_indexColumn]) {
        upperLimitIndexColumn = gINT_FIELDS[fEDI_cursor_indexColumn];
    }
    else {
        upperLimitIndexColumn = lastValidIndexColumn;
    }

    outer: for (var i = 0; i < upperLimitIndexColumn; i++) {
        let c = getCharacter(line.start + i);
        switch (c) {
            case ' ':
                EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, CONST_EDI_ASCII_SPACE);
                indentationBuilder.push(c);
                break;
            case '\t':
                EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, CONST_EDI_ASCII_TAB);
                indentationBuilder.push(c);
                break;
            case '\0': // tabs are stored as: '\t\0\0\0'
                EDI_cursor_enterKey_newLinePlusIndentation_byteList.insert(EDI_cursor_enterKey_newLinePlusIndentation_byteList.count, 0);
                indentationBuilder.push(c);
                break;
            default:
                break outer;
        }
    }

    EDI_cursor_cached_indentation_string = indentationBuilder.join('');
}

function EDI_lineWasInsertedValidateGutter() {
    // shift lines of text needs to do this logic (both directions but specifically you're thinking about the enter key insertions right now)
    // - [ ] When shifting lines of text to a larger line index:
    //     - [ ] 'break' when you start moving '~' lines to '~' lines.
    //     - [ ] When you move from 'existing lines of text' to '~' lines, you need to set the line number of that '~' line.
    // 
    //if (EDI_gutter.children.length > 0 && EDI_gutter.children.length === gINT_FIELDS[fEDI_virtualCount]) {
    //    if (EDI_gutter.children[EDI_gutter.children.length - 1].textContent === '~') {
    //        let successFoundTildeAtIndex = EDI_gutter.children.length - 1;
    //        for (let i = EDI_gutter.children.length - 2; i >= 0; i--) {
    //            if (EDI_gutter.children[i].textContent === '~') {
    //                successFoundTildeAtIndex = i;
    //            }
    //            else {
    //                successFoundTildeAtIndex = i + 1;
    //                break;
    //            }
    //        }
    //        if (successFoundTildeAtIndex > 0) {
    //            let number = parseInt(EDI_gutter.children[successFoundTildeAtIndex - 1].textContent);
    //            EDI_gutter.children[successFoundTildeAtIndex].textContent = number + 1;
    //        }
    //    }
    //}
    //
    // I currently move the nodes from line to line when I hit the enter key,
    // I could consider the overhead of shifting the belt as if I scrolled or some such
    // I gotta find the words
    //
    // I don't think that would work because you need to keep the belt indices such that they always:
    // - increase
    // - until they wrap around
    // - repeat over and over
    //
    // And regardless I really really gotta stick to one thing today so just keep what you said as a note...

    if (EDI_drawGutter_Width()) {
        // If true then you need to also draw the dependent UI
        EDI_draw_all_cursors();
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
    const ints = gINT_FIELDS;
    for (var i = 0; i < EDI_trackedSyntaxList.count_abstract; i++) {
        EDI_trackedSyntaxList.getElementAt(i);
        if (indexPosition <= ints[fEDI_pooledTrackedSyntax_start]) {
            EDI_trackedSyntaxList.setStart(i, ints[fEDI_pooledTrackedSyntax_start] + insertionCount);
        }
        else if (indexPosition > ints[fEDI_pooledTrackedSyntax_start] && indexPosition < ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length]) {
            EDI_trackedSyntaxList.setLength(i, ints[fEDI_pooledTrackedSyntax_length] + insertionCount);
        }
    }
}

function EDI_render_do_EnterKey() {

    const ints = gINT_FIELDS;

    update_verticalVirtualizationBoundary();

    if (ints[fEDI_cursor_editKind] !== EditKind_Enter) {
        return;
    }

    // you're missing either a:
    // - for loop
    // - or preferably a shift by some count other than just one
    //
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLineFeedCount]) {

        // TODO: This is missing a loop or etc... as was also stated elsewhere.
        // ...
        // Thus 'ints[fEDI_cursor_editRenderedDisplacement]' is being incremented by 1 only.
        // i.e.: This is wrong because if more than one enter key event was rendered as an edit length > 1 there's probably gonna be a rendering issue
        // and the invocation of 'EDI_render_do_EnterKey' from finalize edit will cause confusion because a length of 2 could pass given certain timing of events.
        //
        ints[fEDI_cursor_editRenderedDisplacement]++;

        // TODO: You're gonna have to tighten the virtualization logic?

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_firstTilde = ((EDI_lineEndPositionList.count) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_firstTilde >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_firstTilde < 0) beltIndexLine_firstTilde = -1;
        else beltIndexLine_firstTilde = (beltIndexLine_firstTilde + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        if (beltIndexLine_firstTilde >= 0) {
            EDI_gutter.children[beltIndexLine_firstTilde].textContent = EDI_lineEndPositionList.count + 1;
        }
        
        let shouldRenderEntireViewport = false;

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_current = ((ints[fEDI_cursor_editIndexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_current >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_current < 0) beltIndexLine_current = -1;
        else beltIndexLine_current = (beltIndexLine_current + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        if (beltIndexLine_current < 0)
            shouldRenderEntireViewport = true;

        // There are some cases that I don't feel like thinking about at the moment, this if statement singles them out.
        if (ints[fEDI_virtualCount] <= 1 || EDI_textElement.children.length !== ints[fEDI_virtualCount])
            shouldRenderEntireViewport = true;

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_first = ((ints[fEDI_virtualIndexLine]) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_first >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_first < 0) beltIndexLine_first = -1;
        else beltIndexLine_first = (beltIndexLine_first + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        // TODO: Use PREVIOUS here from 'beltIndexLine_first'

        // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
        if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
        else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

        // TODO: reminder for when virtualization padding is improved, this function might need to be looked at.
        // TODO: Track the enter keystroke the same as any other insertion edit and have it pending until it needs to be finalized.

        // 4 cases:
        // - "start of line":
        // - "end of line":
        // - "among a line":
        // - "fallback case": this last case is a fallback case and redraws the entire viewport in the case that the UI is in an "unpredictable state" and cannot be optimally redrawn in a smaller more specific redraw.

        // consider using 'gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind]' for the 'render'?

        // Is holding down ctrl+enter / shift+enter batchable?

        if (!shouldRenderEntireViewport && ints[fEDI_cursor_editIndexColumn] === 0) { // start of line
            EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, beltIndexLine_current);
            EDI_textElement.children[beltIndexLine_current].appendChild(document.createElement('span'));

            EDI_lineWasInsertedValidateGutter();
            return;
        }
        else {
            if (!shouldRenderEntireViewport) {
                // ensure this conditional branch returns if handled, otherwise it will execute the fallback case erroneously
                let lastValidIndexColumn = EDI_getLastValidIndexColumn(ints[fEDI_cursor_editIndexLine]);

                if (lastValidIndexColumn === ints[fEDI_cursor_editIndexColumn]) { // end of line
                    
                    let next_beltIndexLine = (beltIndexLine_current + 1) % ints[fEDI_ArrayFrom_textElement_children_length];

                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, next_beltIndexLine);
                    let span = document.createElement('span');
                    span.textContent = EDI_cursor_cached_indentation_string;
                    EDI_textElement.children[next_beltIndexLine].appendChild(span);

                    EDI_lineWasInsertedValidateGutter();
                    return;
                }
                else { // among a line


                    // among a line uses 'walkLineUntilIndexColumn', this function takes a cursor and accesses the fields: 'indexLine', and 'indexColumn'.
                    // This is problematic because one needs to use ints[fEDI_cursor_editIndexColumn] for this renderKind.
                    // Since only this case needs the logic I'm going to isolate it to here.
                    //
                    // Remember 'indexLine', and 'indexColumn'.
                    // Set them to the edit respective fields.
                    // Prior to returning from this function restore the original 'indexLine', and 'indexColumn'.

                    let remember_cursorIndexLine = ints[fEDI_cursor_indexLine];
                    let remember_cursorIndexColumn = ints[fEDI_cursor_indexColumn];

                    ints[fEDI_cursor_indexLine] = ints[fEDI_cursor_editIndexLine];
                    ints[fEDI_cursor_indexColumn] = ints[fEDI_cursor_editIndexColumn];

                    let spanClassName = '';
                    let spanText = EDI_cursor_cached_indentation_string;

                    walkLineUntilIndexColumn();

                    let shouldPreserveCssClassWhenSplittingAmongLine = false;
                    
                    switch (w_span.className) {
                        case 'eCm':
                            if (ints[fEDI_w_indexColumn_SpanTextContentRelative] >= 2 && (ints[fEDI_w_indexColumn_SpanTextContentRelative] <= w_span.textContent.length - 2)) {
                                w_span.className = 'eCM';
                                let indexPosition = EDI_getPositionIndex_raw_cursor();
                                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_Comment, indexPosition - ints[fEDI_cursor_indexColumn] + ints[fEDI_w_indexColumn_Sum], w_span.textContent.length);
                                shouldPreserveCssClassWhenSplittingAmongLine = true;
                            }
                            break;
                        case 'eCM':
                            shouldPreserveCssClassWhenSplittingAmongLine = true;
                            break;
                        case 'eSm':
                            if (ints[fEDI_w_indexColumn_SpanTextContentRelative] >= 1 && (ints[fEDI_w_indexColumn_SpanTextContentRelative] <= w_span.textContent.length - 1)) {
                                w_span.className = 'eSM';
                                let indexPosition = EDI_getPositionIndex_raw_cursor();
                                let indexOfGreaterThanOrEqual = EDI_trackedSyntaxReposition_find(indexPosition);
                                EDI_trackedSyntaxList.insert(indexOfGreaterThanOrEqual, TrackedSyntaxKind_String, indexPosition - ints[fEDI_cursor_indexColumn] + ints[fEDI_w_indexColumn_Sum], w_span.textContent.length);
                                shouldPreserveCssClassWhenSplittingAmongLine = true;
                            }
                            break;
                        case 'eSM':
                            shouldPreserveCssClassWhenSplittingAmongLine = true;
                            break;
                    }
                    
                    if (ints[fEDI_w_indexColumn_Goal] > 0) {
                        if (ints[fEDI_w_indexColumn_Goal] !== ints[fEDI_w_indexColumn_Sum] + w_span.textContent.length) {
                            let firstText = w_span.textContent.substring(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]);
                            let lastText = w_span.textContent.substring(ints[fEDI_w_indexColumn_SpanTextContentRelative]);
                            w_span.textContent = firstText;
                            spanText += lastText; // += due to the possibility of indentation
                            if (shouldPreserveCssClassWhenSplittingAmongLine) {
                                spanClassName = w_span.className;
                            }
                        }
                    }

                    let next_beltIndexLine = (ints[fEDI_w_beltIndexLine] + 1) % ints[fEDI_ArrayFrom_textElement_children_length];

                    EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, next_beltIndexLine);

                    let aaa = EDI_textElement.children[next_beltIndexLine];
                    let span = document.createElement('span');
                    span.className = spanClassName;
                    span.textContent = spanText;
                    aaa.appendChild(span);

                    let rememberIndex = ints[fEDI_w_indexSpan] + 1;
                    let rememberLength = w_div.children.length;
                    for (let i = rememberIndex; i < rememberLength; i++) {
                        aaa.appendChild(w_div.children[rememberIndex]);
                    }

                    EDI_lineWasInsertedValidateGutter();

                    ints[fEDI_cursor_indexLine] = remember_cursorIndexLine;
                    ints[fEDI_cursor_indexColumn] = remember_cursorIndexColumn;
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
 *     if (gINT_FIELDS[fEDI_cursor_editLength] === 0) {...}
 * 
 * 3 cases:
 * - "start of line":
 * - "end of line":
 * - "among a line":
 */
function EDI_EnterKey(ctrlKey, shiftKey) {
    if (!EDI_cursor_enterKey_newLinePlusIndentation_byteList)
        EDI_cacheIndentation();

    if (ctrlKey) gINT_FIELDS[fEDI_cursor_indexColumn] = 0;
    else if (shiftKey) gINT_FIELDS[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);

    if (gINT_FIELDS[fEDI_cursor_editLength] === 0) {

        gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_None;

        gINT_FIELDS[fEDI_cursor_editPosition] = EDI_getPositionIndex_raw_cursor();
        gINT_FIELDS[fEDI_cursor_editIndexLine] = gINT_FIELDS[fEDI_cursor_indexLine];
        gINT_FIELDS[fEDI_cursor_editIndexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];
    }

    let insertionCount = EDI_cursor_enterKey_newLinePlusIndentation_byteList.count;
    
    if (gINT_FIELDS[fEDI_cursor_indexColumn] === 0) { // start of line
        if (gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] === 0) {
            gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] = EnterKeyEventKind_StartOfLine;
        }

        if (!ctrlKey)
            gINT_FIELDS[fEDI_cursor_indexLine]++;
    }
    else {
        let lastValidIndexColumn = EDI_getLastValidIndexColumn(gINT_FIELDS[fEDI_cursor_indexLine]);

        if (gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] === 0) {
            gBYTE_FIELDS[byteEDI_cursor_enterKeyEventKind] = lastValidIndexColumn === gINT_FIELDS[fEDI_cursor_indexColumn]
                ? EnterKeyEventKind_EndOfLine
                : EnterKeyEventKind_AmongALine;
        }
        
        gINT_FIELDS[fEDI_cursor_indexLine]++;
    }

    gINT_FIELDS[fEDI_cursor_indexColumn] = insertionCount - 1;
    gINT_FIELDS[fEDI_cursor_editLength] += insertionCount;
    gINT_FIELDS[fEDI_cursor_editLineFeedCount]++;

    gINT_FIELDS[fEDI_cursor_END_editIndexLine] = gINT_FIELDS[fEDI_cursor_indexLine];
    gINT_FIELDS[fEDI_cursor_END_editIndexColumn] = gINT_FIELDS[fEDI_cursor_indexColumn];

    EDI_render_request(RenderKind_Enter);
}

/**
 * CORRUPT_STATE: The invoker needs to ensure there is at least one empty span on the 'inclusiveSmallestBeltIndexLineToShift' after they invoke this function.
 * 
 * TODO: implement this but by an arbitrary distance
 */
function EDI_shiftLinesOfText_ToALarger_IndexLine_byOne(beltIndexLine_last, inclusiveSmallestBeltIndexLineToShift) {
    // TODO: This remove logic for the last line wasn't written with the correct understanding...
    // ...
    // It appears that this logic for 99% of cases is NOT needed.
    // But that if you:
    // - "Were at belt index zero" (I'm not sure what I'm thinking by this I need to focus on my task at hand but this edge case is being slightly-considered in my mind while typing this)
    //     - I think the correct wording is if you were at 'PREVIOUS(belt_index_zero)' then you'd be the last line
    //     - i.e.: if 'beltIndexLine_last === inclusiveSmallestBeltIndexLineToShift'
    // - for some reason only had a virtualization count of '1',
    // you might need to run this logic otherwise an enter key at column index 0 of a line wouldn't show any changes.
    // 
    let local_ArrayFrom_textElement_children_length = gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length];

    let lastDiv = EDI_textElement.children[beltIndexLine_last];
    for (let i = lastDiv.children.length - 1; i >= 0; i--) {
        lastDiv.removeChild(lastDiv.children[i]);
    }

    for (let i = beltIndexLine_last; i !== inclusiveSmallestBeltIndexLineToShift;) {
        let destinationDiv = EDI_textElement.children[i];
        i = (i - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;
        let sourceDiv = EDI_textElement.children[i];
        destinationDiv.replaceChildren(...sourceDiv.childNodes);
    }
}

/**
 * 'smallestBeltIndexLineToReceive' somewhat 'exclusive' in that it doesn't get shifted. It is the smallest line that receives the shift of the next line, and thus all content on this line is lost in the process.
 * 
 * TODO: an idea that you might be able to short circuit if you start shifting 'out of bounds lines of text' into 'out of bounds lines of text'?
 * */
function EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(beltIndexLine_last, smallestBeltIndexLineToReceive, distance, local_virtualIndexLine, local_virtualCount) {

    // TODO: Does 'coalesce assignment' exist, and is it equivalent?
    if (!local_virtualIndexLine) local_virtualIndexLine = gINT_FIELDS[fEDI_virtualIndexLine];
    if (!local_virtualCount) local_virtualCount = gINT_FIELDS[fEDI_virtualCount];

    // TODO: if smallestBeltIndexLineToReceive < 0 throw an error?

    let local_ArrayFrom_textElement_children_length = gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length];

    let breakingPoint = beltIndexLine_last;
    for (let i = 1 /*starts at one*/; i < distance; i++) {
        breakingPoint = (breakingPoint - 1 + local_ArrayFrom_textElement_children_length) % local_ArrayFrom_textElement_children_length;
    }

    for (let destinationIndex = smallestBeltIndexLineToReceive; destinationIndex !== breakingPoint;) {
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

    let beltIndexLine = breakingPoint;
    for (let i = 0; ; i++) {
        EDI_drawLine(local_virtualIndexLine + local_virtualCount - (distance - i), EDI_gutter.children[beltIndexLine], EDI_textElement.children[beltIndexLine]);
        if (beltIndexLine === beltIndexLine_last) break; // awkward positioning of this break, it seems somewhat necessary but need to take time to read the code further and try to have it moved somewhere more sensible.
        beltIndexLine = (beltIndexLine + 1) % local_ArrayFrom_textElement_children_length;
    }
}

function EDI_render_do_Resize(timestamp) {
    EDI_baseElement.style.width = '';
    EDI_baseElement.style.height = '';
    EDI_baseElement.style.contain = '';

    EDI_measureBaseElement();

    let remember_virtualCount = gINT_FIELDS[fEDI_virtualCount];
    update_virtualCount();
    if (gINT_FIELDS[fEDI_virtualCount] !== remember_virtualCount) {
        // why 'update_verticalVirtualizationBoundary' here???
        update_verticalVirtualizationBoundary(EDI_lineEndPositionList.count + 1);

        gINT_FIELDS[fEDI_intFalsey_isScrolling] = 0;

        gINT_FIELDS[fEDI_scrollEndDeadline] = timestamp + 1000;

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
    if (gINT_FIELDS[fEDI_onResize_timer]) {
        gBYTE_FIELDS[byteEDI_onResize_hasTrailingCall] = true;
        return;
    }

    // Leading edge: Execute immediately
    EDI_onResize();

    // Start the throttle window
    EDI_onResize_startThrottleTimeout();
}

// 2. The Gatekeeper
function EDI_onResize_startThrottleTimeout() {
    gINT_FIELDS[fEDI_onResize_timer] = setTimeout(() => {
        if (gBYTE_FIELDS[byteEDI_onResize_hasTrailingCall]) {
            gBYTE_FIELDS[byteEDI_onResize_hasTrailingCall] = false;
            EDI_onResize();
            
            EDI_onResize_startThrottleTimeout();
        } else {
            gINT_FIELDS[fEDI_onResize_timer] = 0;
        }
    }, 500);
}

function EDI_measureBaseElement() {
    gINT_FIELDS[fEDI_lastReadNumber_offsetWidth] = Math.floor(EDI_baseElement.offsetWidth);
    gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] = Math.floor(EDI_baseElement.offsetHeight);
    
    EDI_baseElement.style.width = gINT_FIELDS[fEDI_lastReadNumber_offsetWidth] + 'px';
    EDI_baseElement.style.height = gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] + 'px';

    EDI_baseElement.style.contain = 'layout';

    gINT_FIELDS[fEDI_lastReadNumber_offsetWidth] = EDI_baseElement.offsetWidth;
    gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] = EDI_baseElement.offsetHeight;

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
<     gINT_FIELDS[fEDI_lastReadNumber_offsetWidth] = rect.width;
<     gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] = rect.height;
< 
<     // 2. Calculate lines safely without modifying the DOM
<     const rawLineCount = gINT_FIELDS[fEDI_lastReadNumber_offsetHeight] / KNOWN_LINE_HEIGHT;
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

    const ints = gINT_FIELDS;

    if (ints[fEDI_cursor_editKind] != EditKind_None) {
        // TODO: multicursor confusion scenario is likely to happy due to this code, but the code isn't related enough for me to change it yet.
        EDI_finalizeEdit();
    }

    let smallPosition;
    let largePosition;
    if (ints[fEDI_cursor_selectionAnchor] < ints[fEDI_cursor_selectionEnd]) {
        smallPosition = ints[fEDI_cursor_selectionAnchor];
        largePosition = ints[fEDI_cursor_selectionEnd];
    }
    else {
        smallPosition = ints[fEDI_cursor_selectionEnd];
        largePosition = ints[fEDI_cursor_selectionAnchor];
    }

    ints[fEDI_EDI_RemoveSelection_smallPosition] = smallPosition;
    ints[fEDI_EDI_RemoveSelection_largePosition] = largePosition;

    ints[fEDI_cursor_selectionAnchor] = 0;
    ints[fEDI_cursor_selectionEnd] = 0;

    let editLength = largePosition - smallPosition;
    // editLength is 0 in this ...startEdit invocation intentionally, you cannot set the editLength until the end (TODO: remember what the exact reason was and put it here... I think it was because 'EDI_readLineEndPositionList' function is used rather than reading directly)
    EDI_startEdit(EditKind_RemoveTextNoBatching, smallPosition, /*editLength*/ 0);

    EDI_getLineAndColumnIndices(smallPosition);
    let smallLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
    let smallLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    ints[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine] = smallLineAndColumnIndices_indexLine;
    ints[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn] = smallLineAndColumnIndices_indexColumn;
    ints[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
    ints[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;
    ints[fEDI_cursor_editIndexLine] = smallLineAndColumnIndices_indexLine;
    ints[fEDI_cursor_editIndexColumn] = smallLineAndColumnIndices_indexColumn;

    EDI_getLineAndColumnIndices(largePosition);
    let largeLineAndColumnIndices_indexLine = ints[fEDI_getLineAndColumnIndices_indexLine];
    let largeLineAndColumnIndices_indexColumn = ints[fEDI_getLineAndColumnIndices_indexColumn];
    ints[fEDI_cursor_END_editIndexLine] = largeLineAndColumnIndices_indexLine;
    ints[fEDI_cursor_END_editIndexColumn] = largeLineAndColumnIndices_indexColumn;

    ints[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
    ints[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;

    ints[fEDI_cursor_editLength] = editLength;
    
    ints[fEDI_cursor_STORED_indexColumn] = ints[fEDI_cursor_indexColumn];

    EDI_render_request(RenderKind_RemoveSelection);
}

function EDI_render_do_RemoveSelection() {

    const ints = gINT_FIELDS;

    let smallPosition = ints[fEDI_EDI_RemoveSelection_smallPosition];
    let largePosition = ints[fEDI_EDI_RemoveSelection_largePosition];

    let editLength = largePosition - smallPosition;

    let smallLineAndColumnIndices_indexLine = ints[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine];
    let smallLineAndColumnIndices_indexColumn = ints[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn];

    ///////////
    ///////////

    if (ints[fEDI_cursor_editKind] !== EditKind_RemoveTextNoBatching) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        let original_edit_length = ints[fEDI_cursor_editLength];
        ints[fEDI_cursor_editLength] = 0;

        let indexTrackedSyntax = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(ints[fEDI_cursor_indexLine]);
        if (indexTrackedSyntax === NaN || indexTrackedSyntax === -1) {
            indexTrackedSyntax = EDI_trackedSyntaxList.count_abstract;
        }
        let possibleTrackedSyntaxToSpanSingleLine = false;
        if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
            EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
            if (ints[fEDI_pooledTrackedSyntax_start] < EDI_lineEndPositionList.data[ints[fEDI_cursor_indexLine]]) {
                possibleTrackedSyntaxToSpanSingleLine = true;
            }
            // TODO: This has no reason to be a for loop
            for (let i = ints[fEDI_cursor_indexLine] - 1; i >= 0; i--) {
                let lineEndPosition = EDI_lineEndPositionList.data[i];
                if (ints[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                    ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
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
        for (var iVarDependent = ints[fEDI_cursor_indexLine]; iVarDependent < EDI_lineEndPositionList.count - 1; iVarDependent++) {
            // TODO: all of these reads need to be raw for this work with multicursor just remember that for tomorrow don't worry about this right now just focus on the one task but remember this for tomorrow.
            let lineEnding = EDI_readLineEndPositionList(iVarDependent);
            if (lineEnding >= ints[fEDI_cursor_editPosition] && lineEnding < ints[fEDI_cursor_editPosition] + editLength) {
                linesRemovedCount++;
                ints[fEDI_cursor_editLineFeedCount]++;
                EDI_lineEndPositionList_PENDING.insert(EDI_lineEndPositionList_PENDING.count, lineEnding);

                if (possibleTrackedSyntaxToSpanSingleLine) {
                    let NOTlineEndBelongsToSyntax;
                    if (iVarDependent >= EDI_lineEndPositionList.count)
                        NOTlineEndBelongsToSyntax = true;
                    else if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] <= EDI_lineEndPositionList.data[iVarDependent])
                        NOTlineEndBelongsToSyntax = true;
                    
                    if (NOTlineEndBelongsToSyntax) {
                        EDI_trackedSyntaxList.removeAt(indexTrackedSyntax, 1);

                        // do not increment because removed
                        possibleTrackedSyntaxToSpanSingleLine = false;
                        if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
                            EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
                            if (ints[fEDI_pooledTrackedSyntax_start] < lineEnding &&
                                ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > lineEnding) {
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
            if (iVarDependent >= EDI_lineEndPositionList.count)
                NOTlineEndBelongsToSyntax = true;
            else if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] <= EDI_lineEndPositionList.data[iVarDependent])
                NOTlineEndBelongsToSyntax = true;
            
            if (NOTlineEndBelongsToSyntax)
                EDI_trackedSyntaxList.removeAt(indexTrackedSyntax, 1);
        }

        let finalLineEndPosition = EDI_readLineEndPositionList(ints[fEDI_cursor_indexLine] + linesRemovedCount);
        let largestDrawnIndexLine = ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1;
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
            ints[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
            ints[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;

            walkLineUntilIndexColumn();
            
            let lineBoundaryPositions = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
            let remaining;
            if (largePosition > lineBoundaryPositions.end) {
                remaining = lineBoundaryPositions.end - smallPosition;
            }
            else {
                remaining = largePosition - smallPosition;
            }

            if (w_span && ints[fEDI_w_indexColumn_SpanTextContentRelative] >= 0) {
                smallLineDiv = w_div;
                while (remaining > 0) {
                    let available = w_span.textContent.length - ints[fEDI_w_indexColumn_SpanTextContentRelative];
                    let count = remaining > available ? available : remaining;
                    remaining -= count;    
                    
                    if (count > 0) {
                        w_span.textContent = w_span.textContent.slice(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(ints[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                    }

                    if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                        w_div.removeChild(w_span);
                    }
                    else {
                        ints[fEDI_w_indexSpan]++;
                    }
        
                    if (remaining > 0) {
                        if (ints[fEDI_w_indexSpan] >= w_div.children.length) break;
                        w_span = w_div.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
                    }
                }
            }
        }

        // Remove selection on large position line
        let largeLineDiv = null;
        if (linesRemovedCount > 0) {
            ints[fEDI_cursor_indexLine] = ints[fEDI_cursor_indexLine] + linesRemovedCount;
            ints[fEDI_cursor_indexColumn] = 0;

            let lineBoundaryPositions = EDI_getLineBoundaryPositions(ints[fEDI_cursor_indexLine]);
            let remaining = largePosition - lineBoundaryPositions.start;

            walkLineUntilIndexColumn();

            if (w_span && ints[fEDI_w_indexColumn_SpanTextContentRelative] >= 0) {
                largeLineDiv = w_div;
                while (remaining > 0) {
                    let available = w_span.textContent.length - ints[fEDI_w_indexColumn_SpanTextContentRelative];
                    let count = remaining > available ? available : remaining;
                    remaining -= count;

                    if (count > 0)
                        w_span.textContent = w_span.textContent.slice(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(ints[fEDI_w_indexColumn_SpanTextContentRelative] + count);

                    if (w_div.children.length > 1 && w_span.textContent.length === 0)
                        w_div.removeChild(w_span);
                    else
                        ints[fEDI_w_indexSpan]++;
        
                    if (remaining > 0) {
                        if (ints[fEDI_w_indexSpan] >= w_div.children.length) break;
                        w_span = w_div.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
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
            ints[fEDI_cursor_indexLine] = smallLineAndColumnIndices_indexLine;
            ints[fEDI_cursor_indexColumn] = smallLineAndColumnIndices_indexColumn;

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

            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexLine_current = ((smallLineAndColumnIndices_indexLine + 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
            if (beltIndexLine_current >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_current < 0) beltIndexLine_current = -1;
            else beltIndexLine_current = (beltIndexLine_current + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
            if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
            else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

            // TODO: This will be wrong because you'd need to explicitly redraw the large selection line index.
            EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(beltIndexLine_last, beltIndexLine_current, linesRemovedCount);

            if (EDI_drawGutter_Width()) {
                // If true then you need to also draw the dependent UI
                EDI_draw_all_cursors();
                EDI_drawHorizontalScrollbar();
            }
        }

        ints[fEDI_cursor_editLength] = original_edit_length;
    }
}

/*
comments from EDI_removeSelection(cursor) that may or may not be useful idk I just wanna get them out of the way.

    // 'Draw lines that came into view' / 'clear text for any lines > text length and use a '~' in the gutter'
    if (linesRemovedCount > 0) {

        // off by 1 character
        //
        // Finalizing all cursors fixes the issue... but why was it off by 1 character?
        // 
        // TODO: this needs to be understood but delaying the finalization of an edit is more along the lines of an optimization...
        // ...versus selecting and removing text which needs to work properly both in terms of editing the text and visually displaying the correct result.
        // 
        EDI_finalizeAllCursors();

        // 3 cases (TODO: Ensure these for backspace and delete)
        // =======
        // - [ ] inViewTildeCase
        // - [ ] comesIntoViewDueToRemovalTildeCase
        // - [ ] notInViewTildeCase
        //
        // Each case might be the same solution I don't know I just need time to think I'm completely exhausted but ima figure it out by just typing everything out and overtime it will happen
        // 

        let beltIndexLine_last = EDI_indexLineTo_beltIndexLine(gINT_FIELDS[fEDI_virtualIndexLine] + gINT_FIELDS[fEDI_virtualCount] - 1);

        if (EDI_textElement.children.length === EDI_gutter.children.length) {
            for (let i = 0; i < visibleLinesRemovedCount; i++) {
                // TODO: wrap around suspect?
                let gutterLineElement = EDI_gutter.children[beltIndexLine_last - i];
                gutterLineElement.innerHTML = ''; // I don't believe this will have already been cleared.
                // TODO: wrap around suspect?
                let textLineElement = EDI_textElement.children[beltIndexLine_last - i];
                textLineElement.innerHTML = ''; // Might already be cleared, furthermore might ALWAYS be cleared.
                EDI_drawLine(largestDrawnIndexLine - i, gutterLineElement, textLineElement);
            }
        }

        TODO: draw gutter?

        // TODO: 'update_verticalVirtualizationBoundary(EDI_lineEndPositionList.count);'?
        // TODO: EDI_REMOVE_line_drawGutter(linesRemovedCount);
    }
*/

/** TODO: this is nearly identical to backspace, the difference is the check 'if (gINT_FIELDS[fEDI_cursor_editKind] !== EditKind_DeleteLtr)', thus dedupe the logic or no? */
function EDI_render_do_Delete() {
    const ints = gINT_FIELDS;

    if (ints[fEDI_cursor_editKind] !== EditKind_DeleteLtr) {
        return;
    }
    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        walkLineUntilIndexColumn();

        if (!w_span) {
            // TODO: this
        }
        else {
            let remaining = ints[fEDI_cursor_editLength] - ints[fEDI_cursor_editRenderedDisplacement];
            ints[fEDI_cursor_editRenderedDisplacement] = ints[fEDI_cursor_editLength];
            while (remaining > 0) {
                // When the cursor is at the end of a span, there is no text to delete, because the text starts in the next span.
                let available = w_span.textContent.length - ints[fEDI_w_indexColumn_SpanTextContentRelative];
                let count = remaining > available ? available : remaining;
                remaining -= count;

                if (count > 0) {
                    w_span.textContent = w_span.textContent.slice(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(ints[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                }

                if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                    w_div.removeChild(w_span);
                }
                else {
                    ints[fEDI_w_indexSpan]++;
                }

                if (remaining > 0) {
                    if (ints[fEDI_w_indexSpan] >= w_div.children.length) {

                        // This is a pain I'm not sure if the finalizeEdit will bug it all out timing wise
                        // but I'll presume for now that it won't and then everything should become clear in time (not always but in this scenario I feel it is the case).
                        // 
                        // Extreme cancellation logic whenever finalizeEdit runs, if there were any pending specific draws, skip them and force full screen redraw
                        // would permit a bridge of having the code work as I narrow down the edge cases more and more maybe.
                        //
                        if (ints[fEDI_cursor_indexLine] < EDI_lineEndPositionList.count - 1) {

                            remaining--;

                            if (w_span.className === 'eCM') {
                                EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine();
                            }

                            // Merge the lines if both are visible.
                            // TODO: Use NEXT here (... + 1)

                            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
                            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                            let beltIndexLine_next = ((ints[fEDI_cursor_indexLine] + 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
                            if (beltIndexLine_next >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_next < 0) beltIndexLine_next = -1;
                            else beltIndexLine_next = (beltIndexLine_next + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

                            if (beltIndexLine_next >= 0) {
                                let keepingDiv = w_div;
                                let removingDiv = EDI_textElement.children[beltIndexLine_next];

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

                                // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
                                // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                                // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                                // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                                let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
                                if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
                                else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

                                EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(beltIndexLine_last, beltIndexLine_next, 1);
                            }
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        w_span = w_div.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
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

    const ints = gINT_FIELDS;

    let virtual_cursorIndexLine = ints[fEDI_cursor_indexLine] + ints[fEDI_cursor_editLineFeedCount];

    let virtual_cursorIndexColumn;
    if (EDI_cursor_edit_flagLineChanged === -1) {
        virtual_cursorIndexColumn = ints[fEDI_cursor_indexColumn];
    }
    else {
        virtual_cursorIndexColumn = ints[fEDI_cursor_editLength] - EDI_cursor_edit_flagLineChanged;
    }

    let lineEnd = EDI_getLineEnd_pos_raw(virtual_cursorIndexLine);
    let lastValidIndexColumn = EDI_getLastValidIndexColumn_raw(virtual_cursorIndexLine);

    // You might have to finalize when moving the cursor from this scenario though with ArrowAaa or mousedown
    // not necessarily impossible long term but short term you're gonna make a mess with this...
    // but it worth it?

    if (virtual_cursorIndexColumn === lastValidIndexColumn) {
        if (virtual_cursorIndexLine < EDI_lineEndPositionList.count - 1) {

            // flag the current editlength whenever u change lines so you can check the editlength relative to the line

            ints[fEDI_cursor_editLength]++;
            ints[fEDI_cursor_editLineFeedCount]++;
            EDI_lineEndPositionList_PENDING.insert(EDI_lineEndPositionList_PENDING.count, lineEnd);

            EDI_cursor_edit_flagLineChanged = ints[fEDI_cursor_editLength];

            EDI_render_request(RenderKind_DeleteLtr);
        }
        else {
            // Start of file
            // nothing?
        }
    }
    else {
        if (event.ctrlKey) {
            // ints[fEDI_cursor_editPosition] is intended to be equal due to the batch requirements / a new edit would also be equal.
            let tempIndexColumn = ints[fEDI_cursor_indexColumn];
            let tempPosition = ints[fEDI_cursor_editPosition];


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
            ints[fEDI_cursor_editLength]++;
            
            while (ints[fEDI_cursor_indexColumn] < lastValidIndexColumn) {
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
                ints[fEDI_cursor_editLength]++;
            }
        }
        else {
            ints[fEDI_cursor_editLength]++;
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

    const ints = gINT_FIELDS;

    if (ints[fEDI_cursor_editKind] !== EditKind_BackspaceRtl) {
        return;
    }

    if (ints[fEDI_cursor_editRenderedDisplacement] < ints[fEDI_cursor_editLength]) {
        walkLineUntilIndexColumn();

        if (!w_span) {
            // TODO: this
        }
        else {
            let remaining = ints[fEDI_cursor_editLength] - ints[fEDI_cursor_editRenderedDisplacement];
            ints[fEDI_cursor_editRenderedDisplacement] = ints[fEDI_cursor_editLength];
            while (remaining > 0) {
                let available = w_span.textContent.length - ints[fEDI_w_indexColumn_SpanTextContentRelative];
                let count = remaining > available ? available : remaining;
                remaining -= count;
    
                // When the cursor is at the end of a span, there is no text to delete, because the text starts in the next span.
                if (count > 0) {
                    w_span.textContent = w_span.textContent.slice(0, ints[fEDI_w_indexColumn_SpanTextContentRelative]) + w_span.textContent.slice(ints[fEDI_w_indexColumn_SpanTextContentRelative] + count);
                }

                if (w_div.children.length > 1 && w_span.textContent.length === 0) {
                    w_div.removeChild(w_span);
                }
                else {
                    ints[fEDI_w_indexSpan]++;
                }
    
                if (remaining > 0) {
                    if (ints[fEDI_w_indexSpan] >= w_div.children.length) {
                        if (ints[fEDI_cursor_indexLine] < EDI_lineEndPositionList.count - 1) {

                            remaining--;

                            if (w_span.className === 'eCM') {
                                EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine();
                            }

                            // Merge the lines if both are visible.
                            // TODO: Use NEXT here (... + 1)
                            
                            // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
                            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                            let beltIndexLine_next = ((ints[fEDI_cursor_indexLine] + 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
                            if (beltIndexLine_next >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_next < 0) beltIndexLine_next = -1;
                            else beltIndexLine_next = (beltIndexLine_next + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

                            if (beltIndexLine_next >= 0) {
                                let keepingDiv = w_div;
                                let removingDiv = EDI_textElement.children[beltIndexLine_next];

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

                                // TODO: This is an awkward explicit inlining of 'EDI_indexLineTo_beltIndexLine'...
                                // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                                // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                                // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                                let beltIndexLine_last = ((ints[fEDI_virtualIndexLine] + ints[fEDI_virtualCount] - 1) + ints[fEDI_offsetLine]) - ints[fEDI_virtualIndexLine];
                                if (beltIndexLine_last >= ints[fEDI_ArrayFrom_textElement_children_length] || beltIndexLine_last < 0) beltIndexLine_last = -1;
                                else beltIndexLine_last = (beltIndexLine_last + ints[fEDI_EDI_beltIndexZero]) % ints[fEDI_virtualCount];

                                EDI_shiftLinesOfText_ToASmaller_IndexLine_byDistance(beltIndexLine_last, beltIndexLine_next, 1);
                            }
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        w_span = w_div.children[ints[fEDI_w_indexSpan]];
                        ints[fEDI_w_indexColumn_SpanTextContentRelative] = 0;
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

    const ints = gINT_FIELDS;
    
    if (ints[fEDI_cursor_indexColumn] === 0) {
        if (ints[fEDI_cursor_indexLine] > 0) {

            // TODO: multicursor bugs are more likely to occur with this logic:
            // TODO: this logic is extremely suspect given editIndexLine and editIndexColumn...
            // ...as well if you move the cursor during a pending edit then finalize does it edit the correct positions?
            //
            // wrap to previous line
            ints[fEDI_cursor_indexLine]--;
            ints[fEDI_cursor_indexColumn] = EDI_getLastValidIndexColumn(ints[fEDI_cursor_indexLine]);
            ints[fEDI_cursor_editPosition]--;
            ints[fEDI_cursor_editLength]++;
            ints[fEDI_cursor_editIndexLine] = ints[fEDI_cursor_indexLine];
            ints[fEDI_cursor_editIndexColumn] = ints[fEDI_cursor_indexColumn];

            ints[fEDI_cursor_editLineFeedCount]++;
            EDI_lineEndPositionList_PENDING.insert(0, ints[fEDI_cursor_editPosition]);
        }
        else {
            return;
        }
    }
    else {
        if (event.ctrlKey) {
            // ints[fEDI_cursor_editPosition] is intended to be equal due to the batch requirements / a new edit would also be equal.

            let originalCharacterKind = getCharacter_kind_raw(ints[fEDI_cursor_editPosition] - 1);
            ints[fEDI_cursor_indexColumn]--;
            ints[fEDI_cursor_editPosition]--;
            ints[fEDI_cursor_editIndexColumn]--;
            ints[fEDI_cursor_editLength]++;

            while (ints[fEDI_cursor_indexColumn] > 0) {
                if (getCharacter_kind_raw(ints[fEDI_cursor_editPosition] - 1) !== originalCharacterKind) {
                    break;
                }
                ints[fEDI_cursor_indexColumn]--;
                ints[fEDI_cursor_editPosition]--;
                ints[fEDI_cursor_editIndexColumn]--;
                ints[fEDI_cursor_editLength]++;
            }
        }
        else {
            ints[fEDI_cursor_indexColumn] -= 1;
            ints[fEDI_cursor_editPosition] -= 1;
            ints[fEDI_cursor_editIndexColumn] -= 1;
            ints[fEDI_cursor_editLength]++;
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
    
    /*if (EDI_cursor_gapBufferWriteToSpanElement !== EDI_offsetWithinSpan_withRespectToThisSpan) {
        gINT_FIELDS[fEDI_offsetWithinSpan] = 0;
        EDI_offsetWithinSpan_withRespectToThisSpan = EDI_cursor_gapBufferWriteToSpanElement;
    }

    if (EDI_cursor_gapBufferWriteToSpanElement) {
        EDI_cursor_gapBufferWriteToSpanElement.textContent = 
            EDI_cursor_gapBufferWriteToSpanElement.textContent.slice(0, (gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] + gINT_FIELDS[fEDI_offsetWithinSpan]) + gINT_FIELDS[fEDI_cursor_gapBufferCount]) +
            character +
            EDI_cursor_gapBufferWriteToSpanElement.textContent.slice((gINT_FIELDS[fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex] + gINT_FIELDS[fEDI_offsetWithinSpan]) + gINT_FIELDS[fEDI_cursor_gapBufferCount]);
    }*/

    EDI_cursor_gapBuffer[gINT_FIELDS[fEDI_cursor_gapBufferCount]] = character.charCodeAt(0);
    gINT_FIELDS[fEDI_cursor_gapBufferCount]++;

    gINT_FIELDS[fEDI_cursor_editLength]++;
    gINT_FIELDS[fEDI_cursor_indexColumn]++;

    gINT_FIELDS[fEDI_offsetWithinSpan] = gINT_FIELDS[fEDI_offsetWithinSpan] + gINT_FIELDS[fEDI_cursor_gapBufferCount];
}

function EDI_stopTrackingIfTrackedSyntaxMadeToSpanSingleLine() {

    const ints = gINT_FIELDS;

    // binary search for 'if (ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > positionIndex)'
    let indexTrackedSyntax = EDI_drawViewPort_FindTrackedSyntax_StartingIndex(ints[fEDI_cursor_indexLine]);
    if (indexTrackedSyntax === NaN || indexTrackedSyntax === -1) {
        indexTrackedSyntax = EDI_trackedSyntaxList.count_abstract;
    }
    if (indexTrackedSyntax < EDI_trackedSyntaxList.count_abstract) {
        EDI_trackedSyntaxList.getElementAt(indexTrackedSyntax);
        if (ints[fEDI_pooledTrackedSyntax_start] < ints[fEDI_cursor_editPosition]) {
            let moreThanOneLineEndPositionIsEncompassed = false;

            // TODO: This has no reason to be a for loop
            for (let i = ints[fEDI_cursor_indexLine] - 1; i >= 0; i--) {
                let lineEndPosition = EDI_lineEndPositionList.data[i];
                if (ints[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                    ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
                        moreThanOneLineEndPositionIsEncompassed = true;
                        break;
                }
                else {
                    break;
                }
            }
            
            if (!moreThanOneLineEndPositionIsEncompassed) {
                // TODO: This has no reason to be a for loop
                for (let i = ints[fEDI_cursor_indexLine] + 1; i < EDI_lineEndPositionList.count; i++) {
                    let lineEndPosition = EDI_lineEndPositionList.data[i];
                    if (ints[fEDI_pooledTrackedSyntax_start] < lineEndPosition &&
                        ints[fEDI_pooledTrackedSyntax_start] + ints[fEDI_pooledTrackedSyntax_length] > lineEndPosition) {
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

    const ints = gINT_FIELDS;

    let scrollX = 0;
    let scrollY = 0;

    let local_lastReadNumber_scrollTop = ints[fEDI_lastReadNumber_scrollTop];

    if (ints[fEDI_cursor_cursorTranslateYValue] < local_lastReadNumber_scrollTop) {
        scrollY = ints[fEDI_cursor_cursorTranslateYValue] - local_lastReadNumber_scrollTop;
    }
    else if (ints[fEDI_cursor_cursorTranslateYValue] >= local_lastReadNumber_scrollTop + ints[fEDI_lastReadNumber_offsetHeight]) {
        // I want to use clientHeight but I don't have any logic for no scrollbar thus single page fitting text might bug out and trigger
        // scrollBy over and over.

        // make the bottom touch then add lineHeight is probably the algorithm to get a perfect fill maybe do lineHeight * 2 skip an event when spamming arrowDown?
        let currentBottom = local_lastReadNumber_scrollTop + ints[fEDI_lastReadNumber_offsetHeight];
        let changeToMakeBottomTouch = ints[fEDI_cursor_cursorTranslateYValue] - currentBottom;
        scrollY = changeToMakeBottomTouch + (2 * ints[fEDI_lineHeight]);
    }

    if (ints[fEDI_cursor_cursorTranslateXValue] < ints[fEDI_lastReadNumber_scrollLeft]) {
        scrollX = ints[fEDI_cursor_cursorTranslateXValue] - ints[fEDI_lastReadNumber_scrollLeft];
    }
    else if (ints[fEDI_cursor_cursorTranslateXValue] >= ints[fEDI_lastReadNumber_scrollLeft] + ints[fEDI_lastReadNumber_offsetWidth]) {
        // I want to use clientWidth but I don't have any logic for no scrollbar thus single page fitting text might bug out and trigger
        // scrollBy over and over.

        // make the right touch then add characterWidth is probably the algorithm to get a perfect fill maybe do characterWidth * 2 skip an event when spamming arrowRight?
        let currentRight = ints[fEDI_lastReadNumber_scrollLeft] + ints[fEDI_lastReadNumber_offsetWidth];
        let changeToMakeRightTouch = ints[fEDI_cursor_cursorTranslateXValue] - currentRight;
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
            EDI_finalizeAllCursors();
            await EDI_copySelection();
            EDI_removeSelection();
            EDI_render_request(RenderKind_Cursor_n);
            return;
        case CommandKind_Copy:
            EDI_finalizeAllCursors();
            return EDI_copySelection();
        case CommandKind_Paste:
            EDI_finalizeAllCursors();
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
    let lineAndColumnIndices_indexLine = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexLine];
    let lineAndColumnIndices_indexColumn = gINT_FIELDS[fEDI_getLineAndColumnIndices_indexColumn];
    EDI_moveCursor_indexLine_indexColumn(lineAndColumnIndices_indexLine, lineAndColumnIndices_indexColumn);
}

/**
 * This clears the cursor's selection.
 */
function EDI_moveCursor_indexLine_indexColumn(indexLine, indexColumn) {
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);

    if (indexColumn > lastValidIndexColumn) {
        gINT_FIELDS[fEDI_cursor_indexColumn] = lastValidIndexColumn;
    }
    else {
        gINT_FIELDS[fEDI_cursor_indexColumn] = indexColumn;
    }

    gINT_FIELDS[fEDI_cursor_indexLine] = indexLine;
    
    // TODO: selectionAnchor = selectionEnd; EDI_drawCursor(); # being the way to clear a selection should be documented / wrapped by a method for ease of use / readability?
    gINT_FIELDS[fEDI_cursor_selectionAnchor] = gINT_FIELDS[fEDI_cursor_selectionEnd];
    EDI_render_request(RenderKind_Cursor_n);
}

/**
 * Tabs are stored as '\t\0\0\0', all line feeds converted to '\n'.
 * 
 * textonly is in reference to conversion of the raw storage of the text editor such that a tab of '\t\0\0\0' is returned as just '\t', and all line feeds as EDI_lineEndString
 * 
 * @returns {string}
 */
function EDI_decode_textonly(start, length) {

    if (!EDI_lineEndString)
        EDI_lineEndString = '\n';

	// TODO: repeated duplications of the same extremely large selection might benefit from temporary caching of this functions result.
	let EDI_decode_pooled_stringBuilder_array = new Array(length);

    let end = start + length;
	
	let bytes = EDI_textByteList.bytes;
	
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

    let bytes = EDI_textByteList.bytes;

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
        span.textContent = EDI_decoder.decode(EDI_textByteList.bytes.subarray(substart, substart + length));
    }

    return childIndex;
}

///**
// * These tend to be performed within a loop, and the logic seems simplistic enough to compiler-inline to the build file, consider?
// * 
// * The argument is a beltIndexLine i.e.: the result of 'EDI_indexLineTo_beltIndexLine' (no validation is performed on the argument, it is presumed to be the index of a valid text editor line div dom element). This returns -1 if you go out of viewport. It will wrap around if you go too large because 'gINT_FIELDS[fEDI_EDI_beltIndexZero]' isn't 0.
// */
//function EDI_beltIndexLine_NEXT(beltIndexLine) {
//    return ++beltIndexLine >= gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] ? beltIndexLine -= gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] : beltIndexLine;
//
//
///*
//> Do you have any thoughts on the most optimal way to perform this calculation?
//> 
//> I have the code 'beltIndexCurrent = EDI_beltIndexLine_NEXT(beltIndexCurrent);'.
//> 
//> This runs very often within a loop. The 'EDI_beltIndexLine_NEXT' function is:
//> return ++beltIndexLine >= gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] ? beltIndexLine -= gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] : beltIndexLine;
//
//< To optimize this operation, the most effective approach is to replace the function call and conditional branch with a
//< bitwise AND mask or a direct modulo operation, while inlining the logic to eliminate function call overhead.
//< ...
//< 1. The Fastest Approach (Power of 2)
//< ...
//< beltIndexCurrent = (beltIndexCurrent + 1) & (ARRAY_LENGTH - 1);
//<
//< 2. The Cleanest Micro-Optimization (Dynamic Length)
//< beltIndexCurrent = (beltIndexCurrent + 1) % gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length];
//<
//
//*/
//}

///**
// * These tend to be performed within a loop, and the logic seems simplistic enough to compiler-inline to the build file, consider?
// * 
// * The argument is a beltIndexLine i.e.: the result of 'EDI_indexLineTo_beltIndexLine' (no validation is performed on the argument, it is presumed to be the index of a valid text editor line div dom element). This returns -1 if you go out of viewport. It will wrap around if you go too small because 'gINT_FIELDS[fEDI_EDI_beltIndexZero]' isn't 0.
// */
//function EDI_beltIndexLine_PREVIOUS(beltIndexLine) {
//    return --beltIndexLine < 0 ? beltIndexLine += gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length] : beltIndexLine;
//
///*
//< 1. The Fastest Approach (Power of 2)
//< beltIndexCurrent = (beltIndexCurrent - 1) & (ARRAY_LENGTH - 1);
//< 
//< 2. The Cleanest Universal Approach (Dynamic Length)
//< beltIndexCurrent = (beltIndexCurrent - 1 + gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length]) % gINT_FIELDS[fEDI_ArrayFrom_textElement_children_length];
//*/
//}

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
    gINT_FIELDS[fEDI_lineHeight] = Math.ceil(measureElementBoundingClientRect.height); // 15

    wrapper.removeChild(measureElement);
    EDI_textElement.removeChild(wrapper);

    const root = document.documentElement;
    const computedStyles = window.getComputedStyle(root);
    let teLineHeight = gINT_FIELDS[fEDI_lineHeight] + 'px';
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

// TODO:
//
// (From the perspective of understanding)
//
// You gotta look into the event and performance leak,
// I feel like you would've dropped the references and it'd be cleared.
// it just have a 1 shot one opportunity to be removed from some buffer and 
// it sees you leaked it so it doesn't remove from the buffer
// and then even if you set your references to null you missed that one chance for it to be removed from a buffer.
//
// ^ SPECULATION
//
// I'm just very confused because my undestanding of GC said "I can get a reference to it so long as I set that reference null eventually"
// so there's gotta be a buffer that missed the chance to be removed from.
//
// It went to remove it from a buffer but saw I had a reference to it so it left it in the buffer
// and then when I nulled my reference it still was in the buffer but never will be cleared unless I manually cleared it from the buffer myself.
//
// methinks
/*
< The missing puzzle piece is that PerformanceEventTiming and native MouseEvent objects are not normal JavaScript objects.
< They are hybrid, split-personality objects governed by the browser engine (Chromium/V8).
< 
< Here is the exact explanation of why your "missed chance at the buffer" theory is spot on, and why your previous code broke the traditional GC rules:
<
< 1. Your "One Shot / Missed Chance" Buffer Theory is Real
< In Chromium, when a user moves a mouse, two things are created simultaneously:
< - A C++ DOM Object (inside Chromium's core engine, managing the event loop and the native Performance Timeline buffer).
< - A JavaScript Wrapper Object (inside the V8 engine, which is the e variable you see in your code).
<
< Chromium has an internal performance logging buffer. When an event happens, it registers it in that buffer.
< When the event finishes processing and the browser completes a paint frame,
< Chromium runs a cleanup pass to flush short-lived event timings from its internal buffers.
< 
< If you copy the JavaScript wrapper e into a global variable or trap it inside an overwritten setTimeout closure,
< the V8 engine alerts Chromium's C++ engine: "Hey, this JS code is still actively holding a reference to this event."
<
< Because of that active reference, Chromium skips purging that event from its internal performance/event buffers during that frame's cleanup pass.
< Once it skips it, that specific entry is essentially "pushed" into a long-term fallback cache or historical timeline stream.
< Even if you null out your JavaScript variable later, the C++ engine has already abandoned its tracking pass for that frame,
< leaving the object permanently pinned from the C++ side.
<
< 2. The "Overwritten Variable" Trap (Why traditional GC failed here)
<
< You mentioned: "I can get a reference to it so long as I set that reference null eventually."
< This is true, but your original code was accidentally breaking this rule due to how mouseover fires.
<
< Look at what happened when the mouse moved across 3 tokens rapidly:
<
< ```js
< // Mouse hits Token 1:
< EDI_mouseOver_event = e1; // Reference to e1 is created
< gINT_FIELDS[fEDI_hoverTimeout] = setTimeout(..., 1000); // Timer 1 created, traps e1 in background
< 
< // Mouse hits Token 2 (0.1 seconds later):
< EDI_mouseOver_event = e2; // Overwrites the global! 
< // Traditional GC should clean up e1 now, RIGHT? 
< ```
<
< Wrong! Because clearTimeout wasn't running inside mouseOver, Timer 1 was still alive.
< 
< Even though you overwrote the global variable EDI_mouseOver_event = e2,
< Timer 1's hidden internal browser closure was still holding onto e1 in the background.
<
< When mouseOut eventually fired much later, it executed:
<
< ```js
< clearTimeout(gINT_FIELDS[fEDI_hoverTimeout]); // This ONLY clears Timer 2 (the current ID)!
< EDI_mouseOver_event = null;     // This ONLY nulls e2!
< ```
<
< Timer 1 was never cleared. It was left running in the browser's hidden event-loop array.
< Because Timer 1 was never cleared, the code that nulled out e1 inside EDI_requestLspHover was never reached.
< The reference to e1 was never set to null, completely violating your GC rule.
<
< Summary:
< Your "methinks" comment is a fantastic summary of browser-level memory architecture. You ran into a double-whammy:
< 1. An asynchronous JavaScript timer loop that was accidentally losing track of old references before they could be nulled out.
< 2. A low-level browser engine (Chromium) that binds JS references to C++ memory buffers, changing the rules of traditional garbage collection.
<
< Now that you have primitives tracking the coordinates and mouseleave stopping the spam, your app is behaving exactly like a high-performance text editor should!
<
< If you look at your file explorer tree view, do you see any similar patterns where a fast-firing event (like dragging or scrolling) assigns events to variables?

What it says about the timeouts... that was an issue on my end I gave it the code snippet for 'function EDI_mouseOver(e)'.
This code currently is:

function EDI_mouseOver(e) {
    EDI_mouseOver_event_clientY = e.clientY;
    EDI_mouseOver_event_clientX = e.clientX;
    
    //const tokenElement = event.target.closest('.editor-token');
    //if (!tokenElement) return;
    //
    // Clear previous timer because the mouse is still moving
    clearTimeout(gINT_FIELDS[fEDI_hoverTimeout]);
    //
    // Extract line and column stored in the DOM node's data attributes
    //const line = parseInt(tokenElement.dataset.line);
    //const column = parseInt(tokenElement.dataset.column);
    //
    // Wait 300ms. If the mouse leaves or moves, this timer gets cleared.
    gINT_FIELDS[fEDI_hoverTimeout] = setTimeout(EDI_requestLspHover, 1000);
}

I said "it doesn't need all these comments"

and I removed what I thought was one continuously block of single line comments
but there's actually a 'clearTimeout(gINT_FIELDS[fEDI_hoverTimeout]);' hidden among the single line comments.

So I ended up removing that.

I tried explaining what I'm a goof to the AI after the fact. It seems to have brought it back up for some reason.
*/

/**
 * < Thanks to a browser feature called Event Bubbling, when the mouse enters a tiny token span, the event bubbles up to the parent container
 * 
 * Oh wow I can clearly see why this is better than mouseMove with heavy throttling/debouncing
 */
function EDI_mouseOver(e) {
    gINT_FIELDS[fEDI_EDI_mouseOver_event_clientY] = e.clientY;
    gINT_FIELDS[fEDI_EDI_mouseOver_event_clientX] = e.clientX;
    
    //const tokenElement = event.target.closest('.editor-token');
    //if (!tokenElement) return;
    //
    // Clear previous timer because the mouse is still moving


    
    clearTimeout(gINT_FIELDS[fEDI_hoverTimeout]);



    //
    // Extract line and column stored in the DOM node's data attributes
    //const line = parseInt(tokenElement.dataset.line);
    //const column = parseInt(tokenElement.dataset.column);
    //
    // Wait 300ms. If the mouse leaves or moves, this timer gets cleared.
    gINT_FIELDS[fEDI_hoverTimeout] = setTimeout(EDI_requestLspHover, 1000);
}

// Partially it was:
// - avoid letting the event objects escape the event handler, if you screw it up you'll leak the objects.
// - and then mouseout => mouseleave was also needed presumably something in 'EDI_hideTooltip' causes a lot of issues?
//     - (you drastically reduce the amount of hide tooltip invocations and you only need to do it mouseleave anyhow cause mouseover will clearTimeout too)

function EDI_mouseLeave() {
    // Clear timer if mouse leaves the token before 1000ms
    clearTimeout(gINT_FIELDS[fEDI_hoverTimeout]);
    gINT_FIELDS[fEDI_hoverTimeout] = 0;
    EDI_hideTooltip();
}

function EDI_requestLspComplete() {
    window.myAPI.editorCompletionRequest(gINT_FIELDS[fEDI_cursor_indexLine], gINT_FIELDS[fEDI_cursor_indexColumn]);
}

function EDI_doEditorGoToDefinitionRequest() {
    window.myAPI.editorGoToDefinitionRequest(gINT_FIELDS[fEDI_cursor_indexLine], gINT_FIELDS[fEDI_cursor_indexColumn]);
}

function EDI_requestLspHover() {
    let event_clientY = gINT_FIELDS[fEDI_EDI_mouseOver_event_clientY];
    let event_clientX = gINT_FIELDS[fEDI_EDI_mouseOver_event_clientX];

    ///////////
    ///////////
    // # GET INDICES
    ///////////
    ///////////
    if (get_EDI_recentBoundingClientRect_isNull_intFalsey()) {
        let boundingClientRect = EDI_baseElement.getBoundingClientRect();
        gINT_FIELDS[fEDI_recentBoundingClientRect_left] = boundingClientRect.left;
        gINT_FIELDS[fEDI_recentBoundingClientRect_top] = boundingClientRect.top;
        set_EDI_recentBoundingClientRect_isNull_intFalsey(0);
    }

    let rY = event_clientY - gINT_FIELDS[fEDI_recentBoundingClientRect_top] + gINT_FIELDS[fEDI_lastReadNumber_scrollTop];
    let rX = event_clientX - gINT_FIELDS[fEDI_recentBoundingClientRect_left] - gINT_FIELDS[fEDI_gutterWidthTotal] + gINT_FIELDS[fEDI_lastReadNumber_scrollLeft];
    
    let indexLine = Math.floor(rY / gINT_FIELDS[fEDI_lineHeight]);
    let indexColumn = Math.round(rX / EDI_characterWidth);

    if (indexLine < 0) return;
    if (indexColumn < 0) return;
    if (indexLine >= EDI_lineEndPositionList.count) return;
    // ----
    let lastValidIndexColumn = EDI_getLastValidIndexColumn(indexLine);
    if (indexColumn > lastValidIndexColumn) return;
    
    ///////////
    ///////////
    // # GET INDICES
    ///////////
    ///////////

    // Indices are wrong... they're likely outdated
    if (!gBYTE_FIELDS[byteEDI_mousemove_eventListener_isActive]) {
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

```js
// aaa.js
let aaa = 2;
```

```js
// bbb.js

import "bbb"

let aaa = 2;
```

Parse bbb.js:
See import:
- parse entirety of what is being imported aka: aaa.js
- copy all the global scope nodes and insert them into the AST for bbb.js as if they were just copy and pasted text.

Immediately problematic:
- circular references blowing up my computer...
- a single import target being referenced in one file, which ends up due to a sequence of imports having the AST calculated multiple times redundantly.
- track the text between the quotes of the import and use it as a weak means of determining circular references (I'm thinking the various ways you can type something will muck it up i.e. is "aaa" === "aaa.js" === "./aaa", etc...)
- during a singular parse store all the AST's as their own standalone AST so you can as needed re-use it.

- [ ] Parse variables progress by end of day

> javascript async code:
> if I reference a variable prior to an await statement, but then don't reference that variable after the await statement.
> Is it garbage collectable while the 'await' statement is "awaited".

< No, the variable is generally not garbage collectible while the await is pending.
<
< How await and Scope Work
< - Coroutine State: When an async function hits an await, the JavaScript engine pauses execution and saves the entire local lexical environment (the activation record/closure frame) on the heap.
< - Liveness vs. Usage: Even if you do not reference the variable after the await line, modern engines typically retain all local variables present in that function's saved scope for the entire duration of the async pause.
< - Engine Optimizations: While some advanced engines (like V8) perform liveness analysis to clear dead variables during regular synchronous execution, across an asynchronous suspension point (await), the entire frame is kept reachable via the continuation/promise machinery. The variable only becomes eligible for garbage collection after the await finishes, the function finishes or exits its scope, and the execution context is completely destroyed.


Prior to this I was trying to get the AI to read this code snippet:

> I'd like to ask you a question about this code snippet. 
> ```js
> let buttonElement = document.getElementById('button');
> buttonElement.addEventListener('keydown', keydown_function);
> 
> async function keydown_function(e) {
>     // ... some code that uses 'e'
> 
>     // the first 'await' is hit here
>     await foo();
> 
>     // ... some code that does NOT use 'e'
> }
> ```

But it just kept giving me "Here are top web results for exploring this topic:" :(
I got a response by using the words though.

=====

this is a massive deal because
PerformanceEventTiming objects are created via an event firing.
These objects are stored in a short term "buffer" internally to the browser (specifically blink engine I believe)

When the engine internally tries to clear the PerformanceEventTiming object from the internal buffer,
if it sees that your event object "as a whole" cannot be collected, then it cannot fully stop
tracking of the PerformanceEventTiming

so it removes the PerformanceEventTiming from the short term "buffer"
and moves it to a long term "buffer"
where you'll then have THOUSANDS of these things sitting in the heap for your apps duration
and depending on the speed of the event firing
you'll accrue thousands and thousands of these in the heap per second
until your program is unusable.

> If I have a class instance, and I use 'this.' within a method on that instance.
> Is the variable found faster than that of a global variable due to the engine knowing exactly which scope to check

< No, a property on this is not found faster than a local variable, and it is usually not faster than a global variable either.
< When you use this.variable, you are not looking up a variable in a scope. You are performing a property lookup on an object, which follows an entirely different resolution path in the JavaScript engine.
< ...


=====

ugh why does the text disappear when I resize until I scroll enough to refill the viewport
I'm annoyed cause I've seen this bug before and I can't remember.
If I can get this then I think today was a 10/10

=====

Anxiety has been a bit high for me.
I'm not overly concerned with getting a large throughput today.

I strongly believe that coding for 13 hours each day is a foolish thing to do.
"If you don't code for 13 hours each day someone else will"

The workload ebs and flows.

The key is to show up consistently and at minimum achieve some degree of "fatigue".

And you feel out whether you're fatigued for the day based on various heuristics
such as "I've been doing this for an hour, okay I'm more likely to be in a fatigued state but I cannot actually use this
         heuristic as definitive proof I'm just feeling out whether the fatigue has been achieved
         because one day to another the work I'm doing for that hour varies in complexity and etc... let me check other heuristics
         that I use for whether I've sufficiently fatigued myself for the day."

And I do this EVERY DAY

So I show up an hour, that's massive, especially if I've honestly felt the fatigue for that day.

"If you don't code for 13 hours each day someone else will"
I hear tech youtubers say these things all the time they're such clowns on this end.

Theprimeagen is the quote. Maybe he said 12 not 13 big deal what a stupid statement

I think about it daily cause of how much I hate what he said

I haven't done anything yet, but I'm now able to hoist the gINT_FIELDS as a local variable anywhere it is used a lot.

====

"what you're doing is stupid just make a class"

But, nobody will know just how stupid it really is quite like I will after suffering through this all

====

"
I optimized away the smi's by storing them all in a UInt32Array
so that the GC when doing a collection no longer has to visit every smi variable
in order to verify that every smi is infact a smi prior moving to the next node.
"

...

"yeah I can no longer maintain the code every change is a massive pain, it isn't readable, and
 I might even be wrong about my original idea because the truth is that I have no idea what I'm doing."

"but I optimized away accessing properties on a class"

"and as for the global access of the array you can hoist it as a local variable in any function that frequently references it over and over"

"it's the worst idea I've ever had"

"how will you implement multiple editors at the same time"

"..."

----

you "optimize away the smi's" while still having smi const definitions because you
use babel to inline and delete the const definitions.

I think I'm gonna remove all the multicursor logic,
I messed with it a lot anyways so even what little did work probably no longer does
and I wanna get things perfect single cursor first I think.

The key was not defining them in terms of eachother but instead just taking an initial position
as if no other edits existed in reverse order and then from there you're just modifying the length of the edit
and since no cursors overlapped it all "just worked".

Well except for when cursors shared the same line
and when cursors something something

but that's what all that column and line offset logic was for
I found the minimum necessary "in terms of eachother" that was necessary.

And that worked because you started the edit in reverse so they didn't clobber eachother
but you rendered them forwards so you could track the cumulative offsets caused by prior cursors.

And since I'll only have 1 cursor, I'm gonna de-smi-ify it so I can go all in on this no-smi idea just to see how far it goes
and then probably abandon the idea at that point once I've seen that it barely changes anything and classes or etc... idk

Removing all the multicursor logic feels a bit upsetting
but I need to get the explorer to scroll and have the text available as you do it

same for the editor's syntax highlighting

The delay to see the syntax highlighting is too much and various other things need to be better first.

I'm trying to continue I might be done today I mood crash

and everything is messing with my head like the youtube recommendations I keep seeing
'Ava tests Caleb | "Are you a good person?" | ...'

and I keep taking this as though you're questioning whether I'm a good person
and that you lean towards the idea that I'm a bad person

====

Ultimately once I've done these I'll just have crossed them off
a list of bad ideas and not have to do them ever again

and I care about eating the 2 lbs of 98% fat free ground chicken everyday until sep 16
so I don't even really care if what I'm doing goes nowhere right now
because even if to others it looks like it goes nowhere
I am aware that I might be doing the wrong thing
and so I am prepared to just cross off an item on a list of bad ideas and then go on with things

I'm confused I need to do lateral raises

Maybe I should go to bed wtf have I been doing the last hour or so

====

Google AI

> I have an electron app that uses vanilla JS. When I do 'npm run start', does the code get interpreted or is it compiled or...?

< When you run npm run start in your Electron app, your JavaScript code is interpreted and compiled just-in-time (JIT) by Google's V8 engine, exactly like it is inside a standard Google Chrome browser.
<
< ...

> Does the length of my identifiers effect the speed of interpretation? Or the size of the compiled code? Or...?

< The length of your identifiers (variable, function, and class names) does not affect the execution speed of your Electron app, but it does have a microscopic effect on initial file size and parse time.
<
< ...

Don't look at me I'm desparate.
"Why does my code suck?"

Omg desperate*

I should start using const

'const ints'

I'm also gonna try changing the color theme in VSCode maybe that's what is holding me back

=====

I'm confused because I don't have the syntax highlighting of any degree available as you scroll new lines of text into view.
Not even just the "second layer" that pops in in VSCode when you scroll a line of text into view then it gets a second round of syntax highlighting
and yet even just this block of singular color, it has moments where I can see the GC collections happening.

So is it me or the smi's?

I still got some more smi's left I can probably get rid of the rest of them tomorrow.
That way I've "been there done that" even if it was all just incorrect in the end.


====

you wanna feel like you have control over your life

and you focus on trying to hold control over all these other things that don't actually mean anything to you
so no matter how much control you hold over them it is never enough

becuase what you truly want to control is your diet, health, weight

i.e.: getting to 199.9 lbs is the cure to OCD

Although OCD also has to do with feeling like you can't trust your memory but...
I dunno maybe you get what I'm saying

I think it is 3 things:

- 1. chronic feeling that "something is wrong"
- 2. trying to find something to blame for why you feel that way
- 3. the futile compulsions to remedy something that never truly was the problem to begin with

====

and for that reason if you can prevent step 1, you won't fall into
the 2nd and 3rd steps.


====


Whether it is slower or faster you have to just see it through so you can reason about things
and determine what the better path would be.

Because you tried shoving essentially "a language server" "and client" into a single app.
And you did this when you didn't understand garbage collection in the slightest.
This went from "I know nothing about garbage collection" to "I understand something about garbage collection
and from perspective it destroys your app" etc... like
not exactly but I have such an extreme fear adversion to garbage collection overhead
because my realization about it all happened where the overhead I was incurring was massive
and then I obsessed over every little detail that possibly could reduce GC overhead
to the point that I probably learned some bad habits
due to something having worked to reduce the GC load in that singular app
but the reality is you don't have to shove a million features into a single app
even if you just separate features into separate processes and then communicate to one another
sometimes that's just the way to go otherwise your singular app has too large of a GC footprint
and it just stops being sensible no matter how obsessed you get.

And I think I need to take a break and eat a lb of 98% fat free ground chicken.

But I'm almost done with this idea

because is it reducing the amount of global scope identifiers for variable matching
everything ever has more overhead cause I pollute the global scope.
But then I also am polluting the global scope due to an adversion to objects
and avoiding making a class
and this is an extreme learned scenario that "technically" could work but it's silly
because you "something something something" like perhaps you're polluting global scope
and making every global scope access take longer or something I don't know
you just gotta see it all through and then learn from it.

I'm a huge fan of Marina and the Diamonds lately.
And by lately I mean the last 2 days,
and by huge fan I mean I keep listening to the same 2 songs over and over.


Google AI:
==========

> In my electron app's renderer process I have a lot of vanilla javascript.
> 
> I tend to put all my code at the global scope level. i.e.: no classes, the state and functions are directly
> part of the global scope and I use 'let or const'.
> 
> I have a UInt32Array that can store state (provided that the javascript 'let' declared variable can be fit into an int32 slot).
> 
> I have a question about this because I've noticed massive performance improvements versus having the "int32" variables as global variables.
> 
> I'm wondering, is this due to the reduction in global scope identifier pollution, thus every global lookup is performed faster?
> 
> Or is it that a normal javascript 'let' declared variable is a "smi" and while this avoids a large amount of garbage collection overhead,
> each "smi" is still a "node" that the garbage collector has to "visit" for an extremely short period of time to verify that the variable is indeed a "smi" before skipping it. And this checking of "smi's" while extremely fast is non-zero.

< Both of your theories touch on real V8 engine behaviors, but your second theory (garbage collector overhead and memory layout) is
< much closer to the physical reality of why you are seeing massive performance improvements.
<
< While reducing global scope pollution does help slightly with identifier lookups,
< the sheer scale of the performance boost you are seeing comes down to how V8 optimizes memory allocation, pointer chasing, and cache locality.
<
< Here is the exact breakdown of why your Uint32Array approach is outperforming raw global variables.
<
< 1. The True Winner: Memory Locality and Pointer Chasing (CPU Cache)
< |
< When you declare dozens or hundreds of independent global variables (let a = 5; let b = 10;),
< V8 allocates space for them on the heap. Even if they are Small Integers (Smis), V8 represents the global scope behind the scenes as a dictionary-like object.
< |
< - The Problem:
<     The values are scattered across memory. When your code accesses five different global variables in a row,
<     the CPU has to "chase pointers" to different memory addresses, causing CPU cache misses.
<
< - The TypedArray Advantage:
<     A Uint32Array allocates a single, contiguous block of raw binary memory. When you access state[0], state[1], and state[2], the
<     CPU loads the entire chunk of memory into its ultra-fast L1/L2 cache at once. You are eliminating pointer chasing entirely.
<
< 2. Your Smi Theory: The GC Edge
< You are entirely correct that Smis (Small Integers) do not create garbage because they are stored "inline" inside the pointer itself.
< However, global variables are a special case:
< - As you noted, the GC still has to trace the global object's properties to ensure references haven't changed.
< - Furthermore, if any of your global let variables ever accidentally hold a value that doesn't fit into a Smi
<   (like a float, a string, or a number > 2^30), V8 instantly "boxes" that number into a full HeapNumber object,
<   triggering actual garbage collection allocation and disposal cycles.
< - By forcing your state into a Uint32Array, V8 never has to guess. It knows exactly how much memory is allocated,
<   and the garbage collector completely ignores the interior of the array. The GC only looks at the array wrapper once and moves on.
<
< 3. Global Scope Lookup Inflation
< Your first theory about scope pollution is valid but usually accounts for a smaller fraction of the performance gap.
< 
< In V8, looking up a global variable is notoriously slow compared to a local variable.
< Global lookups require traversing the script context or the global object dictionary.
< While V8 uses an "Inline Cache" (IC) to make global lookups faster after the first time,
< accessing properties via a constant array reference index (state[5]) bypasses global scope resolution entirely.
< V8 compiles state[5] down to a single, lightning-fast hardware memory offset instruction.
<
< Summary: Why Uint32Array Wins
< ...
(it shows a table of the previously stated points here)


- [ ] Should I make a class for the editor in order to avoid intra-editor function invocations having to lookup via global scope the functions?
- [ ] umm

> Should I make a class my code in order to avoid function invocations having to lookup via global scope the functions when I invoke my own code?

< No, you do not need to convert your code into a class just to fix function lookup speeds. Wrapping everything in a class might actually introduce new performance overhead (like prototype lookups and this binding context) that cancels out what you are trying to solve.
<
< Instead, you can achieve maximum performance while keeping your functional style by using a classic JavaScript pattern: the IIFE (Immediately Invoked Function Expression) / Modular Scope Closure.
<
< Here is why your current approach is slow, why classes aren't the best fix, and the exact pattern you should use instead.
< 
< # Why Global Function Invocations Are Slow
< When you call a global function like myFunction(), the V8 engine has to look up the identifier myFunction on the global window
< object.Even though V8 uses "Inline Caches" (ICs) to speed this up, it still has to verify that the global variable hasn’t been
< re-assigned or shadowed somewhere along the scope chain every single time it runs.
<
< # The Problem With Classes
< If you rewrite your code into a class:
< ```js
< class GameManager {
<   update() { ... }
< }
< ```
< 
< When you call manager.update(), V8 now has to do a prototype chain lookup to find update on GameManager.prototype.
< While highly optimized, it doesn't give you the absolute raw speed you are looking for, and navigating this context can add subtle overhead.
<
< # The Absolute Fastest Solution: The Module/Closure Pattern
< To get the absolute fastest execution speed, you want your functions to look up other functions via Lexical (Local) Scope,
< not Global Scope. Local variable lookups in V8 are compiled down to direct register/stack offsets. They are nearly instantaneous.
< 
< You can achieve this by wrapping your entire vanilla JavaScript file in a single self-executing function block:
< ```js
< // Wrap your entire script in a block or IIFE
< (() => {
<   // 1. Your Uint32Array State
<   const state = new Uint32Array(100);
< 
<   // 2. Local Function Declarations
<   // V8 optimizes these incredibly well because they are locked in this local scope.
<   function updatePlayer() {
<     state[0] += 1; 
<   }
< 
<   function gameLoop() {
<     // 🚀 ULTRA FAST: This lookup is purely lexical (local scope).
<     // No global window lookup, no prototype chain lookup.
<     updatePlayer(); 
<     
<     requestAnimationFrame(gameLoop);
<   }
< 
<   // 3. Kick off your app internally
<   gameLoop();
< 
< })(); // Immediately invoked
< ```
< 
< # Why this is the ultimate performance choice for your architecture:
< - Zero Global Pollution: None of your functions or variables are attached to the window object anymore. The global scope stays entirely empty.
< - Lexical Scope Speed: Because updatePlayer and gameLoop live in the same parent scope, V8 resolves the function invocation instantly. It treats them almost like local variables.
< - Preserves Your Style: You don't have to rewrite your code into object-oriented programming or deal with this.updatePlayer(). It remains pure, simple, vanilla JavaScript.
< - Bundler Ready: If you eventually use a tool like Vite or Esbuild, they wrap your code in module scopes exactly like this automatically.
<
< How are you currently structuring the entry point of your renderer process? If you wrap it in an IIFE or a native ES Module (<script type="module">),
< you will get this local-scope speed boost instantly without changing a line of your functional logic.

TODO: Is that rocket emoji gonna crash the editor if I open this... I expect a 'boxed off question mark'.

The rocket emoji looks like '=?' but the '?' is actually surrounded by a diamond? It is centered within a diamond. The diamond is the font color, the ? is actually transparent.

> Is there a difference between IIFE or a native ES Module?

< ...

"Implicitly Strict by default (forces cleaner, faster code execution)."

> Is there a way I can verify with developer tools that 'type="module"' caused a change?

< Yes, you can absolutely verify this using Chrome DevTools inside your Electron app. Because ES Modules and standard scripts are treated as
< completely different execution contexts by the V8 engine, DevTools exposes this in several clear places.
< 
< Open your Electron DevTools (Ctrl+Shift+I or Cmd+Option+I) and look for these three specific indicators:
<
< 1. Check the Scope Chain in the Debugger (Most Direct)
< ...

I gotta calm down cuz it is almost my bed time
I feel so good right now
but yeah I gotta calm down so I can go to bed on time

=========

- [ ] Line and column indices needs to be moved to "return" to field buffer rather than an object.

Each edit needs to keep the lsp up to date.
i.e.:
- Get when the edits finalize that the lsp is always in sync at that point
    (minus the whole "tab as '\t\0\0\0' scenario, that's for another time).
Extremely small work load everyday, focus on weight loss.
If a high work load happens naturally that's fine but don't stress about trying to force a large workload
just make sure you do something everyday and things will just lead into one another and etc...

When is renderer -> ipc serialized is this part synchronous? you can pool the DTOs

==========

11:30 AM

I want to get this done as soon as possible today.

- [ ] Editor local variable int field buffer.
    - [ ] I believe this is good, but you need to look into it.
- [ ] Move booleans where the use of it from boolean field buffer, that the scope already has a reference to a local of the int field buffer.
    - [ ] ONLY if it is a hot path / meaningful for some reason.
- [ ] Move all Editor related state so that it is contiguous within the field buffers.
- [ ] Look into array caching and whether you could put hot path data a certain way that it reads fastest due to caching
- [ ] ???

Google AI:
==========

> I am making a text editor app. A lot of the code is written already, and so my question is more specifically going to relate to
> a generalized performance question. The app uses electron, and vanilla javascript as a single monolithic ES6 module.

< ...

> The preface to my performance question: The text editor state has various number variables.
> Rather than declare these variables at the top-level scope of my module. I have a 'const gINT_FIELDS = new Uint32Array(168);'
> wherein I store every number, such as the cursor's line index.

< ...

< ...
< ...
< 2. Inter-Process Communication (IPC) Bottlenecks
< 
< In Electron, the Main process and the Renderer process live in isolated memory spaces.
< If you need to send this state from the Renderer (UI) to the Main process (e.g., saving a file or updating a native OS menu),
< copying a standard JS object requires expensive JSON serialization.
< 
< The Solution: You can pass the underlying ArrayBuffer directly across the IPC channel as a Transferable Object,
< or use SharedArrayBuffer if you are utilizing Web Workers for heavy background processing (like syntax highlighting).
< This allows zero-copy data sharing between threads.
<
< ...

> The performance question: when within a function, should this 'gINT_FIELDS' variable be made a local variable such as 'const intFields = gINT_FIELDS'.
> 
> The thought process: you are reducing pointer chasing.

< No, you should not do this because it does not actually reduce pointer chasing or provide any performance benefit.
< In JavaScript, assigning const intFields = gINT_FIELDS does not copy the array or change how the memory is accessed;
< it simply creates a new local reference pointing to the exact same object in memory.
<
< # Why It Doesn't Reduce Pointer Chasing:
< - Both are direct pointers: In the V8 engine, a top-level const module variable and a local function variable are both resolved as direct pointers
<   to the underlying typed array object.
< - The real "chase" is the same: The only actual pointer chasing happens when V8 looks up the array's elements in physical memory.
<   Since both gINT_FIELDS and intFields point to the exact same ArrayBuffer, the CPU executes the exact same memory lookup steps either way.
<
< # When Local Aliasing Does Help (The V8 Exception):
< There is only one scenario where creating a local alias improves performance: when you are caching a property lookup from a deeply nested object.
<
< ```js
< // HELPS: Avoids repeating the property lookup chain (.state and .integers) inside a hot loop
< const intFields = app.state.integers; 
< for (let i = 0; i < 1000; i++) { intFields[0] = i; }
< 
< // DOES NOT HELP: gINT_FIELDS is already at the top-level module scope
< const intFields = gINT_FIELDS; 
< ```
< 
< Because gINT_FIELDS is already declared at the top-level of your ES6 module, V8 can optimize access to it globally.
< Aliasing it locally just adds an extra variable allocation to the function's stack frame for no technical gain.
<
< # The Best Way to Keep This Fast
< |
< If you want to ensure your hot functions stay fully optimized by V8's TurboFan compiler, focus on Monomorphism.
< |
< Keep your function signatures clean and avoid changing the type of data passed into functions that read from gINT_FIELDS.
< V8 optimizes heavily when it knows a function only ever deals with that specific Uint32Array.
< |
< To help optimize your hot paths further, what does a typical heavy or high-frequency function look like in your editor
< (e.g., your keystroke handler or rendering loop)? If you share a snippet, I can look for actual V8 optimization bottlenecks.

> Can you give more information on why the local variable doesn't change anything? i.e.:
> 
> ```js
> ```

(I pressed the enter key without holding shift like a goof)

< ...

*/
