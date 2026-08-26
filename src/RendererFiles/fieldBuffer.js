/*
#################
# Goal of file: #
#################

Every variable in javascript is in essence a reference.

Most engines optimize the storage of various primitives,
such that the reference's value is the value of the primitive itself.

They do this by tagging the reference to indicate that it is to be interpreted as a primitive value rather than a pointer.

That all being said.

The Garbage Collector when doing a marking phase of the "mark and sweep" algorithm still needs to
visit the primitive variables in order to confirm that they are tagged as a primitive.

The overhead of checking whether a variable is a primitive, then moving on to the next variable;
is less than that of if it were an object which then would require further visiting of the child nodes.
BUT even though it is less, this overhead is not zero.

This is VERY LIKELY over optimization. I wanted to try it nevertheless.
So, by allocating a Uint*Array, I can create a single reference that the garbage collector needs to check.
It sees that the children of that Uint*Array are primitive values, and thus it doesn't have to visit the children.
Thus 64 number variables, that would've been 64 visits during the marking phase of GC, become just 1 visit.


The next thing I'm doing is referring to these Uint*Array members by name through the use of const fat arrow functions.
I want to avoid the cost of invoking these const fat arrow functions, and remove the cost of their definitions.
The first statement needs to be that a JS engine might actually do what this file does at runtime through
their own inlining, or caching. But I wanted to ensure it occured in a way that felt confidently in control of.

So to have complete control over the inlining of some state I define const fat arrow functions that have an expression body.
I then use babel to replace all invocations of these fat arrow functions as the expression body itself.
Furthermore babel removes the definition of the const fat arrow function from the AST entirely so there is literally 0 overhead,
it is as if I typed the expression body everywhere I typed the fat arrow function when it comes to the end compiled file.
*/

/**
 * having a boolean be a byte isn't ideal, but most engines store them as either 4bytes or 8bytes
 * 
 * primarily the goal is to remove the variable from the marking phase of gc.
 * because the boolean variable could store anything so the gc still has to check that it still stores a primitive
 * and that takes time albeit a small amount of time.
 * 
 * TODO: index 8 is available because 'EDI_onScroll_bool' was removed.
 */
const gBYTE_FIELDS = new Uint8Array(44);

/** returns a number, beware '===' */
const get_EDI_detailRank = () => gBYTE_FIELDS[0];
const set_EDI_detailRank = (byte) => gBYTE_FIELDS[0] = byte;

/** returns a number, beware '===' */
const get_EDI_recentBoundingClientRect_isNull_intFalsey = () => gBYTE_FIELDS[1];
const set_EDI_recentBoundingClientRect_isNull_intFalsey = (byte) => gBYTE_FIELDS[1] = byte;
set_EDI_recentBoundingClientRect_isNull_intFalsey(1);

/** returns a number, beware '===' */
const get_EDI_findOverlay_show = () => gBYTE_FIELDS[2];
const set_EDI_findOverlay_show = (byte) => gBYTE_FIELDS[2] = byte;

/** returns a number, beware '===' */
const get_EDI_findOverlay_isBeingShownDueToMultiCursorMatching = () => gBYTE_FIELDS[3];
const set_EDI_findOverlay_isBeingShownDueToMultiCursorMatching = (byte) => gBYTE_FIELDS[3] = byte;

/** returns a number, beware '===' */
const get_EDI_fileStartsWithBom = () => gBYTE_FIELDS[4];
const set_EDI_fileStartsWithBom = (byte) => gBYTE_FIELDS[4] = byte;

/** returns a number, beware '===' */
const get_EDI_findOverlay_wasSearched = () => gBYTE_FIELDS[5];
const set_EDI_findOverlay_wasSearched = (byte) => gBYTE_FIELDS[5] = byte;

/** returns a number, beware '===' */
const get_EDI_findOverlay_options_matchWord = () => gBYTE_FIELDS[6];
const set_EDI_findOverlay_options_matchWord = (byte) => gBYTE_FIELDS[6] = byte;

const byteDIALOG_FindAll_options_matchWord = 7;

const byteDIALOG_Settings_isDark = 8;
gBYTE_FIELDS[byteDIALOG_Settings_isDark] = 1;

const byteDIALOG_Settings_trueTabs_falseSpaces = 9;
gBYTE_FIELDS[byteDIALOG_Settings_trueTabs_falseSpaces] = 1;

const byteDIALOG_Settings_editorDebugShowAdjacentCharacters = 10;

const byteDIALOG_hasBeenMeasured = 11;

const byteDIALOG_windowExists = 12;

const byteDIALOG_HIDE_shouldRestoreFocus = 13;

const byteAUTOCOMPLETE_exists = 14;

const byteAUTOCOMPLETE_isRenderPending = 15;

const byteAUTOCOMPLETE_rect_isNull = 16;
gBYTE_FIELDS[byteAUTOCOMPLETE_rect_isNull] = 1;

const byteAUTOCOMPLETE_isCheckingTrailingEdge = 17;

const byteAUTOCOMPLETE_scrollIsFetchingData = 18;

const byteWIDGET_isRenderPending = 19;

const byteWIDGET_shouldRestoreFocus = 20;
gBYTE_FIELDS[byteWIDGET_shouldRestoreFocus] = 1;

const byteDIALOG_isRenderPending = 21;

const byteTOOLTIP_isRenderPending = 22;

/**
 * 0 => None
 * 1 => Show
 * 2 => Hide
 */
const byteTOOLTIP_pending_renderKind = 23;

const byteTOOLTIP_exists = 24;

const byteDIALOG_currentDialogKind = 25;

const byteDIALOG_SHOW_currentDialogKind = 26;

const byteMENU_HIDE_shouldRestoreFocus = 27;
gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = 1;

const byteMENU_SET_NOTshouldFocus = 28;

const byteMENU_NOTshouldFocus = 29;

const byteMENU_isRenderPending = 30;

const byteWIDGET_WidgetKind_pending = 31;
const byteWIDGET_WidgetKind_drawn = 32;

const byteTreeView_pooledNode_nodeKind = 33;

const byteEDI_cursor_enterKeyEventKind = 34;

const byteEDI_extensionKind = 35;

const byteEDI_pooledTrackedSyntax_trackedSyntaxKind = 36;

const byteEDI_isChecking_cursorBlinkTrailingEdge = 37;

const byteEDI_cursor_selectionDivExists = 38;

const byteEDI_onResize_hasTrailingCall = 39;

/** Also is used from 'EDI_render_do_SetText()', and 'EDI_render_do_Resize()', not just 'EDI_render_do_Scroll()' */
const byteisCheckingTrailingEdge = 40;

const byteisProcessingLspQueue = 41;

const byteEDI_isRenderPending = 42;

const byteEDI_mousemove_eventListener_isActive = 43;

// gBYTE_FIELDS[byteEDI_mousemove_eventListener_isActive]

// TODO: some things to consider when moving from a boolean to gBYTE_FIELDS
// - [ ] triple equals
// - [ ] type coercion overhead
// - [ ] Extremely high access gBYTE_FIELDS move to the int fields if there would otherwise be both a local reference to the byteFields and intFields if it is sensible.
// - [ ] Move stored enums here if they're <= 255

// inclusive final index is 43

const CONST_EDI_ASCII_LINE_FEED = 10;
const CONST_EDI_ASCII_TAB = 9;
const CONST_EDI_ASCII_SPACE = 32;

/////////////////////

const CONST_js_DOUBLEQUOTE_str = '"';
const CONST_js_DOUBLEQUOTE_num = 34;

const CONST_js_SINGLEQUOTE_str = '\'';
const CONST_js_SINGLEQUOTE_num = 39;

const CONST_js_BACKTICK_str = '`';
const CONST_js_BACKTICK_num = 96;

const CONST_js_FORWARDSLASH_str = '/';
const CONST_js_FORWARDSLASH_num = 47;

const CONST_js_BACKSLASH_str = '\\';
const CONST_js_BACKSLASH_num = 92;

const CONST_js_ASTERISK_str = '*';
const CONST_js_ASTERISK_num = 42;

const CONST_js_LINEFEED_str = '\n';
const CONST_js_LINEFEED_num = 10;

const CONST_js_OPENPARENTHESIS_str = '(';
const CONST_js_OPENPARENTHESIS_num = 40;

const CONST_js_CLOSEPARENTHESIS_str = ')';
const CONST_js_CLOSEPARENTHESIS_num = 41;

const CONST_js_PERIOD_str = '.';
const CONST_js_PERIOD_num = 46;

const CONST_js_EQUALS_str = '=';
const CONST_js_EQUALS_num = 61;

const CONST_js_OPENBRACKET_str = '[';
const CONST_js_OPENBRACKET_num = 60;

const CONST_js_CLOSEBRACKET_str = ']';
const CONST_js_CLOSEBRACKET_num = 62;

const CONST_js_BANG_str = '!';
const CONST_js_BANG_num = 33;

const CONST_js_PLUS_str = '+';
const CONST_js_PLUS_num = 43;

const CONST_js_MINUS_str = '-';
const CONST_js_MINUS_num = 45;

const CONST_js_STAR_str = '*';
const CONST_js_STAR_num = 42;

const CONST_js_PERCENT_str = '%';
const CONST_js_PERCENT_num = 37;

const CONST_js_AMPERSAND_str = '&';
const CONST_js_AMPERSAND_num = 38;

const CONST_js_PIPE_str = '|';
const CONST_js_PIPE_num = 24;

const CONST_js_QUESTIONMARK_str = '?';
const CONST_js_QUESTIONMARK_num = 63;

const CONST_js_CARET_str = '^';
const CONST_js_CARET_num = 94;

const CONST_EDI_gutterPaddingLeft = 3;
const CONST_EDI_gutterPaddingRight = 6;

const CONST_DIALOG_minTop = 8;
const CONST_DIALOG_minLeft = 8;
const CONST_DIALOG_minHeight = 100;
const CONST_DIALOG_minWidth = 100;

/**
 * I'm not sure how large I want this, what matters is that I just have a size of anything for the time being, then can change this constant later.
 */
const CONST_EDI_cursor_GAP_BUFFER_CAPACITY = 32;

const CONST_AUTOCOMPLETE_topPadding = 4;

const CONST_EDI_cursor_htmlId = "EDI_cursor-1";


////////////////////////////
////////////////////////////
////////////////////////////

const gINT_FIELDS = new Uint32Array(150);

const fEDI_lineHeight = 0;
gINT_FIELDS[fEDI_lineHeight] = 20;

/** The first line of text that you should see shown in the UI given the current scrollTop */
const fEDI_virtualIndexLine = 1;

/** The value of 'EDI_baseElement.scrollTop' at the most recent scroll event that occurred */
const fEDI_lastReadNumber_scrollTop = 2;

const fEDI_ONSCROLLvirtualIndexLine = 3;
//throw new Error('-1');
// This set used to be -1 to indicate a non existent value, 500 "seems to work" but a proof of it being an equivalent solution has not thoroughly been thought out, only a sort of "yeah that probably works" kinda vibe.
gINT_FIELDS[fEDI_ONSCROLLvirtualIndexLine] = 500;

/** Also is used from 'EDI_render_do_SetText()', and 'EDI_render_do_Resize()', not just 'EDI_render_do_Scroll()' */
const fEDI_scrollEndDeadline = 4;

const fEDI_ONSCROLLscrollTop = 5;
//throw new Error('-1');
// This set used to be -1 to indicate a non existent value, 500 "seems to work" but a proof of it being an equivalent solution has not thoroughly been thought out, only a sort of "yeah that probably works" kinda vibe.
gINT_FIELDS[fEDI_ONSCROLLscrollTop] = 500;


const fEDI_virtualCount = 6;

const fEDI_sum_diffPositive = 7;

const fEDI_ONSCROLLvirtualCount = 8;
gINT_FIELDS[fEDI_ONSCROLLvirtualCount] = 0;

const fEDI_sum_diffNegative = 9;

const fEDI_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber = 10;

const fEDI_drawn_count_of_digits_longest_line_number = 11;

const fEDI_detail_smallPosition = 12;

const fEDI_detail_largePosition = 13;

const fEDI_detailRank3OriginLine = 14;

/**
 * Pixels.
 * 
 * The gutter width changes far more frequently than the line height.
 * That is why the gutter width is a JavaScript variable, and the styles are updated from JavaScript.
 * 
 * Whereas the line height is a css variable (and thus could cause layout for the entire application whenever it changes).
 */
const fEDI_gutterWidthStyleValue = 15;
gINT_FIELDS[fEDI_gutterWidthStyleValue] = 32;

/**
 * This is the sum of the 'fEDI_gutterWidthStyleValue()' in addition to paddig
 * consider 'gutterWidthTotal_withPxUnits'
 */
const fEDI_gutterWidthTotal = 16;
/** WARNING: This will not set 'gutterWidthTotal_withPxUnits' and thus is somewhat prone to a mistake at some point. */
gINT_FIELDS[fEDI_gutterWidthTotal] = 32;

const F_didChangeTextDocument_version = 17;

/**
 * All the 'EDI_cursorList' loops are currently using the variable 'i'.
 * I'm experimenting with a few of the loops though such that at the start of every loop they set this variable equal to 'i'.
 * Then in any functions like getCharacter, I might be able to contextually find the character much faster.
 * */
const fEDI_indexCursor = 18;

const fEDI_offsetLine = 19;

const fEDI_offsetColumn_withRespectToThisIndexLine = 20;

const fEDI_offsetColumn = 21;

const fEDI_totalShift = 22;

const fEDI_offsetWithinSpan = 23;

const fEDI_longestLine_indexLine = 24;

const fEDI_longestLine_length = 25;

/**
 * The fEDI_contentWidth() is calculated via Math.ceil(someVar * otherVar) so this is faster to check whether content width will change rather than the multiplication and ceil.
 */
const fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar = 26;

const fEDI_contentWidth = 27;

const fEDI_indent_ORIGINAL_indentBy = 28;

const fEDI_indent_SMALL_lineAndColumnIndices_indexLine = 29;

const fEDI_indent_startingIndex = 30;

const fEDI_recentBoundingClientRect_left = 31;

const fEDI_recentBoundingClientRect_top = 32;

const fEDI_pooledTrackedSyntax_start = 33;

const fEDI_pooledTrackedSyntax_length = 34;

/**
 * Also is used from 'EDI_render_do_SetText()', and 'EDI_render_do_Resize()', not just 'EDI_render_do_Scroll()'
 * 
 * I'm gonna store this in the int32 array so that the editor scroll render function can access it from the already existing local reference of gINT_FIELDS.
 */
const fEDI_intFalsey_isScrolling = 35;

/**
 * I'm gonna store this in the int32 array so that the editor scroll render function can access it from the already existing local reference of gINT_FIELDS.
 */
const fEDI_cursor_editKind = 36;

const fEDI_cursor_indexLine = 37;
const fEDI_cursor_indexColumn = 38;

/**
 * When moving cursor vertically, if the current column index cannot be matched due to the upcoming line being too short,
 * then this will allow a later vertical movement to a line that is long enough to match the original column rather than the minimized one.
 */
const fEDI_cursor_STORED_indexColumn = 39;

const fEDI_cursor_cursorTranslateYValue = 40;
const fEDI_cursor_cursorTranslateXValue = 41;

const fEDI_cursor_selectionAnchor = 42;
const fEDI_cursor_selectionEnd = 43;

const fEDI_cursor_selectionIndexAnchorLine = 44;
const fEDI_cursor_selectionIndexAnchorColumn = 45;

const fEDI_cursor_selectionIndexEndLine = 46;
const fEDI_cursor_selectionIndexEndColumn = 47;

const fEDI_cursor_DRAWN_selectionAnchor = 48;
const fEDI_cursor_DRAWN_selectionEnd = 49;

const fEDI_cursor_DRAWN_selection_virtualIndexLine = 50;
const fEDI_cursor_DRAWN_selection_virtualCount = 51;

const fEDI_cursor_editLength = 52;
const fEDI_cursor_editPosition = 53;
const fEDI_cursor_editIndexLine = 54;
const fEDI_cursor_editIndexColumn = 55;
/**
 * the amount of characters that UI has changed with respect to the pending edit
 * per 'EDI_render_do', if the displacement is not the editLength then you know you need to "draw more of this edit" on the UI.
 * 
 * The awkward name is to avoid re-using similar words that already are used in other fields on this class.
 */
const fEDI_cursor_editRenderedDisplacement = 56;
/** TODO: perhaps you could determine this some other way, but tracking it for the moment is easiest and necessary if I'm to not give up on getting an initial solution to work, given my current mood and etc... */
const fEDI_cursor_editRenderedDisplacement_INDEX_LINE_OFFSET = 57;
const fEDI_cursor_END_editIndexLine = 58;
const fEDI_cursor_END_editIndexColumn = 59;
const fEDI_cursor_gapBufferCount = 60;

/**
 * TODO: probably is sensible to use this for the enter key too but I'm firstly adding it for the sake of backspace so
 * I don't have to waste time looping over the removed text to find the line end positions that are being removed.
 * (I could do some kind of other tracking but I chose not to for no particular reason, well I think I chose this one out of laziness and that the other solutions long term like a
 *  list at the editor level 1 of them that is shared among all cursors is probably better or something.)
 * 
 * ========
 * 
 * TODO: Cursor should store this as -1 to signify false,
 * and then it is a number 0 to ... the offset in the pending line end position list
 * and then you have another number too separately that says the length of line endings that this cursor contributed to modifying.
 */
const fEDI_cursor_editLineFeedCount = 61;
/** same comment that pertains to EDI_cursor_EDI_paste_clipboardContent is somewhat relevant here */
const fEDI_cursor_EDI_duplicate_small = 62;
/** same comment that pertains to EDI_cursor_EDI_paste_clipboardContent is somewhat relevant here */
const fEDI_cursor_EDI_duplicate_length = 63;

/**
 * defaults to viewport size then getBoundingClientRect says the exact pixels upon trying to resize
 * need to track resizes and store the useragent width/height by the onmousedown and then on resize get proportion and update left top width height.
 */
const fDIALOG_left = 64;
const fDIALOG_top = 65;
const fDIALOG_width = 66;
const fDIALOG_height = 67;

const fDIALOG_left_DRAWN = 68;
const fDIALOG_top_DRAWN = 69;
const fDIALOG_width_DRAWN = 70;
const fDIALOG_height_DRAWN = 71;

// TODO: Are 'fDIALOG_before_X' and 'fDIALOG_before_Y' actually doing anything?...
// ...When it comes to their after counterparts 'fDIALOG_after_X' and 'fDIALOG_after_Y'...
// ...it is believed that the counterparts are doing nothing, so also check the before.
const fDIALOG_before_X = 72;
const fDIALOG_before_Y = 73;

// TODO: What does 'fDIALOG_after_X' and 'fDIALOG_after_Y' even get used for? It seems they always only get set to 0 over and over and do nothing?
const fDIALOG_after_X = 74;
const fDIALOG_after_Y = 75;

// TODO: Avoid re-using these locally after getting the w result (i.e.: avoid re-using over and over in a loop or something, probably make a local variable if accessed enough).
// TODO: Verify and update all the previously -1 cases
const fEDI_w_indexColumn_Goal = 76;
const fEDI_w_indexColumn_Sum = 77;
const fEDI_w_indexColumn_SpanTextContentRelative = 78;
const fEDI_w_indexSpan = 79;
// TODO: This -1
const fEDI_w_beltIndexLine = 80;

// And this -1
const fEDI_EDI_beltIndexZero = 81;

const fEDI_EDI_characterWidth = 82;

const fEDI_EDI_horizontal_scrollbar_widthValue = 83;

/** The value of 'EDI_baseElement.scrollLeft' at the most recent scroll event that occurred */
const fEDI_lastReadNumber_scrollLeft = 84;

// just floor these on init / resize and set the style so if they want resize they have to explicit and it is non decimal?
const fEDI_lastReadNumber_offsetHeight = 85;

const fEDI_lastReadNumber_offsetWidth = 86;

const fEDI_ArrayFrom_textElement_children_length = 87;

const fEDI_EDI_mouseOver_event_clientY = 88;

const fEDI_EDI_mouseOver_event_clientX = 89;

// Move some 'EDI_removeSelection()' state here so I can access it in the render function.
// TODO: Don't do this long term, I need a simple bridge for this state so I can just get started otherwise I'll spend the rest of my life procrastinating.
//
const fEDI_EDI_RemoveSelection_smallPosition = 90;
const fEDI_EDI_RemoveSelection_largePosition = 91;

// Temporary hack for state access TODO: this
const fEDI_EDI_indentLess_startingLinePos_end = 92;

const fEDI_EDI_cursorBlinkLastTimestamp = 93;

/** 'EDI_init' and 'EDI_drawHorizontalScrollbar' related */
const fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left = 94;

/** TODO: What happens when you overflow 'gINT_FIELDS[fEDI_prevVli]' does it overflow such that you're the correct diff? */
const fEDI_prevVli = 95;
/** TODO: What happens when you overflow 'gINT_FIELDS[fEDI_prevVli]' does it overflow such that you're the correct diff? */
const fEDI_currVli = 96;

// I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
const fAUTOCOMPLETE_items_slice_start = 97;
const fAUTOCOMPLETE_items_slice_end = 98;
const fAUTOCOMPLETE_items_totalLength = 99;

const fAUTOCOMPLETE_cursorIndex = 100;

const fAUTOCOMPLETE_rectHeight = 101;
const fAUTOCOMPLETE_rectLeft = 102;
const fAUTOCOMPLETE_rectTop = 103;

const fAUTOCOMPLETE_sliceVirtualIndex_SLICE = 104;
const fAUTOCOMPLETE_sliceVirtualCount_SLICE = 105;
const fAUTOCOMPLETE_sliceBeltIndexZero_SLICE = 106;

const fAUTOCOMPLETE_virtualCount = 107;
const fAUTOCOMPLETE_virtualIndex = 108;
const fAUTOCOMPLETE_beltIndexZero = 109;

const fAUTOCOMPLETE_scrollTop = 110;

const fAUTOCOMPLETE_scrollEndDeadline = 111;

const fAUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 112;
gINT_FIELDS[fAUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING] = 2;

/**
 * This value ought to be an int (no decimal places) due to its high frequency usage in drawing UI,
 * and visually this having decimal places being of little to no value to the user when you could just ceil whatever height measurement you get.
 * 
 * TODO: (speculation) I've never liked saying "line height" I believe that deals with the vertical alignment of text within some container is "line height" a good wording.
 * */
const fAPP_lineHeight = 113;
gINT_FIELDS[fAUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING] = 20;

/**
 * start it at 1 because you thought about starting it at 0 then using a prefix incrementation to ensure the 0 state is never used as a means of detecting an empty state
 * but if someone changes the code and moves it to postfix incrementation then everything breaks so why even take that risk when you can just start at 1
 * then if they go from postfix to prefix then you simply miss out on the number 1 and the first ticketId is 2 who cares...
 * 
 * ticketId because you're standing in line at the deli in the supermarket and you've grabbed from the machine a paper that has your number on it
 * and you're waiting for your number to be called so you can get the turkey
 * 
 * > "what is it called when you are in line at a deli and they have a machine that prints a paper with a number on it"
 * 
 * < It is called a take-a-number system or a queue management system. It uses a ticket dispenser to give out paper numbers so people can wait in order without standing in a tight line.
 * 
 * okay yeah it is a ticket dispenser we're good
 */
const fWIDGET_ticketId_counter = 114;
gINT_FIELDS[fWIDGET_ticketId_counter] = 1;

const fWIDGET_ticketId_pending = 115;
const fWIDGET_ticketId_drawn = 116;

const fWIDGET_left = 117;
const fWIDGET_top = 118;

const fWIDGETrenderKind_Show_countOfPendingRequests = 119;

const fMENU_ticketId_counter = 120;
gINT_FIELDS[fMENU_ticketId_counter] = 1;

/** TODO: It might read better to make this 'null' or something after you've drawn the pending. */
const fMENU_ticketId_pending = 121;

const fMENU_ticketId_drawn = 122;

const fMENU_cursorIndex = 123;

/** By duplicating this you guarantee the initial cursor index is what was expected. */
const fMENU_SET_index = 124;

const fMENU_left = 125;
const fMENU_top = 126;

const fMENU_renderKind_Set_countOfPendingRequests = 127;

const fTreeView_pooledNode_key = 128;
const fTreeView_pooledNode_depth = 129;

const fMENU_last_handled_ticketId = 130;

const fEDI_onResize_timer = 131;

const fEDI_hoverTimeout = 132;

// Move some 'EDI_removeSelection()' state here so I can access it in the render function.
// TODO: Don't do this long term, I need a simple bridge for this state so I can just get started otherwise I'll spend the rest of my life procrastinating.
//
const fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine = 133;
const fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn = 134;

// gINT_FIELDS[fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn]

// 149

/*
Google AI
=========
Circular Buffers:
If you are implementing a fast ring buffer where you want to replace the expensive modulo operator (index % size) with
a fast bitwise AND mask (index & (size - 1)).
*/



// TODO: if (!MENU_SET_index) { MENU_SET_index = 0; }
// TODO: track down all the '&' or '|' that were supposed to be '&&' or '||'



// for the beltIndezZero etc... consider using max value?
// Although it might "just work" because you're using locals which would become negative?
// TODO: figure it out


// 130 is inclusive final index




// TODO: Sort the field buffer entries so that everything the scroll render function needs is next to eachother...
// ... / figure out details of caching so you read them all in one go if possible.

// TODO: Move all the other smi's here
// TODO: a local copy of 'gINT_FIELDS' is likely always a meaningful performance gain once you've moved everything because of how much state is being stored here, but it still depends maybe some functions only access it once or something etc...

/*
The smi's are when you do a collection you start at the roots
and if you have 100 smi's at the global scope the GC visits
100 smi's in order to check that they truly are smi's and that is the non-zero cost.
If you stick them all into a UInt...Array then the GC only has to visit the UInt...Array
and then it knows that everything within that array is a primitive that doesn't have to be collected so it skips over them
bringing 100 visits to just 1.

The global variable access of the UInt...Array can be offset by only doing it once and storing a local copy within whatever function needs it multiple times / within a loop.

Accessing a property on a class is not equivalent to accessing a variable.
I don't know the difference but property accessing of a class is similar to accessing a global variable?
Or maybe it only was if the prototype was large?

I remember a bit now so for correctness: I'm pretty sure it is more a matter of
if there's a large class or something that is close to a global variable in terms of accessing the property speed but I don't know.

Class property accessing is slower than that of a local variable, and approaches the time of accessing a global variable for large enough classes

I think that's the wording, and they try to make it match the speed of a local variable but it is slower
and the engine has tricks to try and bring the speed similar to a local.

But I don't know
*/














const EDI_baseElement = document.getElementById('EDITOR');

let EDI_virtualization_horizontal;
let EDI_virtualization_vertical;
let EDI_gutter;
let EDI_horizontal_scrollbar;
let EDI_horizontal_scrollbar_virtualization_boundary;
let EDI_body;
let EDI_presentation;
let EDI_cursorListElement;
let EDI_textElement;

/**
 * TODO: I wanted to get rid of this array but when you open a file you for certain want to take the text as is.
 * (a possible mixing of tabs and 4 spaces or etc...).
 * 
 * The question is:
 * when you paste text do you want to take the text pasted as is?
 * 
 * Because if not, then you can remove this, and then allocate it locally everytime you do an EDI_state_setText
 * since that is supposed to be a very infrequently invoked function.
 * 
 * The issue is, if paste ought to take the text pasted as is
 * I don't want to allocate this over and over as a local variable within the paste function
 * i.e.: maybe the user is holding 'ctrl'+'v'.
 * 
 * And as for some other form of caching and clearing it out... it isn't quite that important at the moment
 * to warrent looking into that for this.
 * 
 * I don't want 'EDI_on_tab_bytes' to point to this, because then I
 * maintain similar overhead whether the user is using tabs or spaces
 * and I can overwrite the entries of 'EDI_on_tab_bytes' if they change from one to another.
 * 
 * 'maintain similar overhead' i.e.: it is such a minimal amount of overhead
 * that I don't want to sit here splitting hairs about it at the moment, there's more important changes to be made.
 * 
 * All in all I removed 1 global variable. 'EDI_tab_spacesbytes'
 * The previous code allocated two arrays, and this code allocates two arrays as well.
 * So again, the only change I got out of this was removing the 'EDI_tab_spacesbytes' variable
 * so instead of 3 global variables for this logic I have 2 global variables.
 */
const EDI_tab_tabsbytes = new Uint8Array(4);
EDI_tab_tabsbytes[0] = CONST_EDI_ASCII_TAB;
EDI_tab_tabsbytes[1] = 0;
EDI_tab_tabsbytes[2] = 0;
EDI_tab_tabsbytes[3] = 0;

/**
 * If you have an extension listed here, it is expected that the "function to invoke" exists.
 * As of right now any patterns to naming the function that gets invoked are tentative.
 * But I am not checking whether JS_full_lex or JS_line_lex exist, I'm just switching on ExtensionKind and presuming that function exists.
 */
const ExtensionKind_None = 0;
const ExtensionKind_JavaScript = 1;

/**
 * DeleteLtr and BackspaceRtl are both forms of removing text,
 * their edits are stored the same (i.e.: both in "the form of a delete" keypress)
 * The kind delete/backspace tells you how to restore the cursor when doing a ctrl+z and etc...?
 */
const EditKind_None = 0;
const EditKind_InsertLtr = 1;
const EditKind_DeleteLtr = 2;
const EditKind_BackspaceRtl = 3;
const EditKind_RemoveTextNoBatching = 4;
const EditKind_Tab = 5;
const EditKind_IndentMore = 6;
const EditKind_IndentLess = 7;
const EditKind_Enter = 8;
const EditKind_Paste = 9;
const EditKind_Duplicate = 10;

/**
 * TODO: Long term this likely should be removed and all enter key logic reduced into an insertion but this will help in the time being.
 */
const EnterKeyEventKind_None = 0;
const EnterKeyEventKind_StartOfLine = 1;
const EnterKeyEventKind_EndOfLine = 2;
const EnterKeyEventKind_AmongALine = 3;

/**
 * Do not change the order/values of these, they are used in equality comparisons, the larger the number says when double clicking between a character and a punctuation
 * whoever has larger number gets selected then the selection continues while the same kind is being read.
 * 
 * TODO: Bug only 1 character selected when punctuation then letterOrDigit click between them the letterOrDigit is more than 1 contiguous only 1 selected.
 */
const CharacterKind_None = 0;
const CharacterKind_Whitespace = 1;
const CharacterKind_Punctuation = 2;
const CharacterKind_LetterOrDigit = 3;

// see editorGlobal.js:
// > const count_of_wellknown_renderKinds = ...;
//
// RenderKind_Cursor_n is to say
// renderKind - (count_of_wellknown_renderKinds - 1) => render the cursor at cursorList[result];
// ...
// maybe I'll change this to be the id of the cursor at some point cause I'm not sure if it holds up with cursor movement possibly changing their order in the list.
// but for now...
const RenderKind_None = 0;
const RenderKind_Scroll = 1;
const RenderKind_Resize = 2;
const RenderKind_InsertLtr = 3;
const RenderKind_TabKey = 4;
const RenderKind_IndentMore = 5;
const RenderKind_IndentLess = 6;
const RenderKind_BackspaceRtl = 7;
const RenderKind_DeleteLtr = 8;
const RenderKind_RemoveSelection = 9;
const RenderKind_Enter = 10;
const RenderKind_DuplicateOrPaste = 11;
const RenderKind_Clear = 12;
const RenderKind_SetText = 13;
const RenderKind_CreateViewport = 14;
const RenderKind_SyntaxHighlighting = 15;
/** non-primaryCursors won't scroll into view, */
const RenderKind_Cursor_flag_scrollIntoViewExplicit = 16;
/** To have a cursor not scroll into view add request this render immediately after the 'RenderKind_Cursor_n'. */
const RenderKind_Cursor_flag_doNotScrollIntoView = 17;
/** Add the index of the cursor */
const RenderKind_Cursor_n = 18;





