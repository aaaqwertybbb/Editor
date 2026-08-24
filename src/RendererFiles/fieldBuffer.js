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
 * TODO: index 8 is available because 'EDITOR_onScroll_bool' was removed.
 */
const EDITOR_byte_fields = new Uint8Array(8);

/** returns a number, beware '===' */
const get_EDITOR_detailRank = () => EDITOR_byte_fields[0];
const set_EDITOR_detailRank = (byte) => EDITOR_byte_fields[0] = byte;

/** returns a number, beware '===' */
const get_EDITOR_recentBoundingClientRect_isNull_intFalsey = () => EDITOR_byte_fields[1];
const set_EDITOR_recentBoundingClientRect_isNull_intFalsey = (byte) => EDITOR_byte_fields[1] = byte;
set_EDITOR_recentBoundingClientRect_isNull_intFalsey(1);

/** returns a number, beware '===' */
const get_EDITOR_findOverlay_show = () => EDITOR_byte_fields[2];
const set_EDITOR_findOverlay_show = (byte) => EDITOR_byte_fields[2] = byte;

/** returns a number, beware '===' */
const get_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching = () => EDITOR_byte_fields[3];
const set_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching = (byte) => EDITOR_byte_fields[3] = byte;

/** returns a number, beware '===' */
const get_EDITOR_fileStartsWithBom = () => EDITOR_byte_fields[4];
const set_EDITOR_fileStartsWithBom = (byte) => EDITOR_byte_fields[4] = byte;

/** returns a number, beware '===' */
const get_EDITOR_findOverlay_wasSearched = () => EDITOR_byte_fields[5];
const set_EDITOR_findOverlay_wasSearched = (byte) => EDITOR_byte_fields[5] = byte;

/** returns a number, beware '===' */
const get_EDITOR_findOverlay_options_matchWord = () => EDITOR_byte_fields[6];
const set_EDITOR_findOverlay_options_matchWord = (byte) => EDITOR_byte_fields[6] = byte;

const get_EDITOR_ASCII_LINE_FEED = () => 10;
const get_EDITOR_ASCII_TAB = () => 9;
const get_EDITOR_ASCII_SPACE = () => 32;

/////////////////////

const get_js_DOUBLEQUOTE_str = () => '"';
const get_js_DOUBLEQUOTE_num = () => 34;

const get_js_SINGLEQUOTE_str = () => '\'';
const get_js_SINGLEQUOTE_num = () => 39;

const get_js_BACKTICK_str = () => '`';
const get_js_BACKTICK_num = () => 96;

const get_js_FORWARDSLASH_str = () => '/';
const get_js_FORWARDSLASH_num = () => 47;

const get_js_BACKSLASH_str = () => '\\';
const get_js_BACKSLASH_num = () => 92;

const get_js_ASTERISK_str = () => '*';
const get_js_ASTERISK_num = () => 42;

const get_js_LINEFEED_str = () => '\n';
const get_js_LINEFEED_num = () => 10;

const get_js_OPENPARENTHESIS_str = () => '(';
const get_js_OPENPARENTHESIS_num = () => 40;

const get_js_CLOSEPARENTHESIS_str = () => ')';
const get_js_CLOSEPARENTHESIS_num = () => 41;

const get_js_PERIOD_str = () => '.';
const get_js_PERIOD_num = () => 46;

const get_js_EQUALS_str = () => '=';
const get_js_EQUALS_num = () => 61;

const get_js_OPENBRACKET_str = () => '[';
const get_js_OPENBRACKET_num = () => 60;

const get_js_CLOSEBRACKET_str = () => ']';
const get_js_CLOSEBRACKET_num = () => 62;

const get_js_BANG_str = () => '!';
const get_js_BANG_num = () => 33;

const get_js_PLUS_str = () => '+';
const get_js_PLUS_num = () => 43;

const get_js_MINUS_str = () => '-';
const get_js_MINUS_num = () => 45;

const get_js_STAR_str = () => '*';
const get_js_STAR_num = () => 42;

const get_js_PERCENT_str = () => '%';
const get_js_PERCENT_num = () => 37;

const get_js_AMPERSAND_str = () => '&';
const get_js_AMPERSAND_num = () => 38;

const get_js_PIPE_str = () => '|';
const get_js_PIPE_num = () => 24;

const get_js_QUESTIONMARK_str = () => '?';
const get_js_QUESTIONMARK_num = () => 63;

const get_js_CARET_str = () => '^';
const get_js_CARET_num = () => 94;

const get_EDITOR_gutterPaddingLeft = () => 3;
const get_EDITOR_gutterPaddingRight = () => 6;

const CONST_DIALOG_minTop = 8;
const CONST_DIALOG_minLeft = 8;
const CONST_DIALOG_minHeight = 100;
const CONST_DIALOG_minWidth = 100;


////////////////////////////
////////////////////////////
////////////////////////////

// TODO: index 10 is available because 'ticket_didChangeTextDocumentNotificationPromise' was removed.
// TODO: index 4 is available because 'EDITOR_isSourceOfLeftMouseButton' was removed.
const EDITOR_int_fields = new Uint32Array(64);

const get_EDITOR_lineHeight = () => EDITOR_int_fields[0];
const set_EDITOR_lineHeight = (int) => EDITOR_int_fields[0] = int;
const INDEXOF_EDITOR_lineHeight = () => 0;
set_EDITOR_lineHeight(20);

/** The first line of text that you should see shown in the UI given the current scrollTop */
const get_EDITOR_virtualIndexLine = () => EDITOR_int_fields[1];
const set_EDITOR_virtualIndexLine = (int) => EDITOR_int_fields[1] = int;
const INDEXOF_EDITOR_virtualIndexLine = () => 1;

/** The value of 'EDITOR_baseElement.scrollTop' at the most recent scroll event that occurred */
const get_lastReadNumber_scrollTop = () => EDITOR_int_fields[2];
/** The value of 'EDITOR_baseElement.scrollTop' at the most recent scroll event that occurred */
const set_lastReadNumber_scrollTop = (int) => EDITOR_int_fields[2] = int;
/** The value of 'EDITOR_baseElement.scrollTop' at the most recent scroll event that occurred */
const INDEXOF_lastReadNumber_scrollTop = () => 2;

const get_EDITOR_ONSCROLLvirtualIndexLine = () => EDITOR_int_fields[3];
const set_EDITOR_ONSCROLLvirtualIndexLine = (int) => EDITOR_int_fields[3] = int;
const INDEXOF_EDITOR_ONSCROLLvirtualIndexLine = () => 3;
//throw new Error('-1');
// This set used to be -1 to indicate a non existent value, 500 "seems to work" but a proof of it being an equivalent solution has not thoroughly been thought out, only a sort of "yeah that probably works" kinda vibe.
set_EDITOR_ONSCROLLvirtualIndexLine(500);

/** Also is used from 'EDITOR_render_do_SetText()', and 'EDITOR_render_do_Resize()', not just 'EDITOR_render_do_Scroll()' */
const get_EDITOR_scrollEndDeadline = () => EDITOR_int_fields[4];
/** Also is used from 'EDITOR_render_do_SetText()', and 'EDITOR_render_do_Resize()', not just 'EDITOR_render_do_Scroll()' */
const set_EDITOR_scrollEndDeadline = (int) => EDITOR_int_fields[4] = int;
/** Also is used from 'EDITOR_render_do_SetText()', and 'EDITOR_render_do_Resize()', not just 'EDITOR_render_do_Scroll()' */
const INDEXOF_EDITOR_scrollEndDeadline = () => 4;

const get_EDITOR_ONSCROLLscrollTop = () => EDITOR_int_fields[5];
const set_EDITOR_ONSCROLLscrollTop = (int) => EDITOR_int_fields[5] = int;
const INDEXOF_EDITOR_ONSCROLLscrollTop = () => 5;
//throw new Error('-1');
// This set used to be -1 to indicate a non existent value, 500 "seems to work" but a proof of it being an equivalent solution has not thoroughly been thought out, only a sort of "yeah that probably works" kinda vibe.
set_EDITOR_ONSCROLLscrollTop(500);

const get_EDITOR_virtualCount = () => EDITOR_int_fields[6];
const set_EDITOR_virtualCount = (int) => EDITOR_int_fields[6] = int;
const INDEXOF_EDITOR_virtualCount = () => 6;

const get_EDITOR_sum_diffPositive = () => EDITOR_int_fields[7];
const set_EDITOR_sum_diffPositive = (int) => EDITOR_int_fields[7] = int;
const INDEXOF_EDITOR_sum_diffPositive = () => 7;

const get_EDITOR_ONSCROLLvirtualCount = () => EDITOR_int_fields[8];
const set_EDITOR_ONSCROLLvirtualCount = (int) => EDITOR_int_fields[8] = int;
const INDEXOF_EDITOR_ONSCROLLvirtualCount = () => 8;
set_EDITOR_ONSCROLLvirtualCount(0);

const get_EDITOR_sum_diffNegative = () => EDITOR_int_fields[9];
const set_EDITOR_sum_diffNegative = (int) => EDITOR_int_fields[9] = int;
const INDEXOF_EDITOR_sum_diffNegative = () => 9;

const get_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber = () => EDITOR_int_fields[10];
const set_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber = (int) => EDITOR_int_fields[10] = int;

const get_EDITOR_drawn_count_of_digits_longest_line_number = () => EDITOR_int_fields[11];
const set_EDITOR_drawn_count_of_digits_longest_line_number = (int) => EDITOR_int_fields[11] = int;

const get_EDITOR_detail_smallPosition = () => EDITOR_int_fields[12];
const set_EDITOR_detail_smallPosition = (int) => EDITOR_int_fields[12] = int;

const get_EDITOR_detail_largePosition = () => EDITOR_int_fields[13];
const set_EDITOR_detail_largePosition = (int) => EDITOR_int_fields[13] = int;

const get_EDITOR_detailRank3OriginLine = () => EDITOR_int_fields[14];
const set_EDITOR_detailRank3OriginLine = (int) => EDITOR_int_fields[14] = int;

/**
 * Pixels.
 * 
 * The gutter width changes far more frequently than the line height.
 * That is why the gutter width is a JavaScript variable, and the styles are updated from JavaScript.
 * 
 * Whereas the line height is a css variable (and thus could cause layout for the entire application whenever it changes).
 */
const get_EDITOR_gutterWidthStyleValue = () => EDITOR_int_fields[15];
const set_EDITOR_gutterWidthStyleValue = (int) => EDITOR_int_fields[15] = int;
set_EDITOR_gutterWidthStyleValue(32);

/**
 * This is the sum of the 'get_EDITOR_gutterWidthStyleValue()' in addition to the left and right padding
 * consider 'gutterWidthTotal_withPxUnits'
 */
const get_EDITOR_gutterWidthTotal = () => EDITOR_int_fields[16];
/** WARNING: This will not set 'gutterWidthTotal_withPxUnits' and thus is somewhat prone to a mistake at some point. */
const set_EDITOR_gutterWidthTotal = (int) => EDITOR_int_fields[16] = int;
set_EDITOR_gutterWidthTotal(32);

const get_didChangeTextDocument_version = () => EDITOR_int_fields[17];
const set_didChangeTextDocument_version = (int) => EDITOR_int_fields[17] = int;

/**
 * All the 'EDITOR_cursorList' loops are currently using the variable 'i'.
 * I'm experimenting with a few of the loops though such that at the start of every loop they set this variable equal to 'i'.
 * Then in any functions like getCharacter, I might be able to contextually find the character much faster.
 * */
const get_EDITOR_indexCursor = () => EDITOR_int_fields[18];
const set_EDITOR_indexCursor = (int) => EDITOR_int_fields[18] = int;

const get_EDITOR_offsetLine = () => EDITOR_int_fields[19];
const set_EDITOR_offsetLine = (int) => EDITOR_int_fields[19] = int;

const get_EDITOR_offsetColumn_withRespectToThisIndexLine = () => EDITOR_int_fields[20];
const set_EDITOR_offsetColumn_withRespectToThisIndexLine = (int) => EDITOR_int_fields[20] = int;

const get_EDITOR_offsetColumn = () => EDITOR_int_fields[21];
const set_EDITOR_offsetColumn = (int) => EDITOR_int_fields[21] = int;

const get_EDITOR_totalShift = () => EDITOR_int_fields[22];
const set_EDITOR_totalShift = (int) => EDITOR_int_fields[22] = int;

const get_EDITOR_offsetWithinSpan = () => EDITOR_int_fields[23];
const set_EDITOR_offsetWithinSpan = (int) => EDITOR_int_fields[23] = int;

const get_EDITOR_longestLine_indexLine = () => EDITOR_int_fields[24];
const set_EDITOR_longestLine_indexLine = (int) => EDITOR_int_fields[24] = int;
const INDEXOF_EDITOR_longestLine_indexLine = () => 24;

const get_EDITOR_longestLine_length = () => EDITOR_int_fields[25];
const set_EDITOR_longestLine_length = (int) => EDITOR_int_fields[25] = int;
const INDEXOF_EDITOR_longestLine_length = () => 25;

/**
 * The get_EDITOR_contentWidth() is calculated via Math.ceil(someVar * otherVar) so this is faster to check whether content width will change rather than the multiplication and ceil.
 */
const get_EDITOR_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar = () => EDITOR_int_fields[26];
const set_EDITOR_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar = (int) => EDITOR_int_fields[26] = int;

const get_EDITOR_contentWidth = () => EDITOR_int_fields[27];
const set_EDITOR_contentWidth = (int) => EDITOR_int_fields[27] = int;

const get_EDITOR_indent_ORIGINAL_indentBy = () => EDITOR_int_fields[28];
const set_EDITOR_indent_ORIGINAL_indentBy = (int) => EDITOR_int_fields[28] = int;

const get_EDITOR_indent_SMALL_lineAndColumnIndices_indexLine = () => EDITOR_int_fields[29];
const set_EDITOR_indent_SMALL_lineAndColumnIndices_indexLine = (int) => EDITOR_int_fields[29] = int;

const get_EDITOR_indent_startingIndex = () => EDITOR_int_fields[30];
const set_EDITOR_indent_startingIndex = (int) => EDITOR_int_fields[30] = int;

const get_EDITOR_recentBoundingClientRect_left = () => EDITOR_int_fields[31];
const set_EDITOR_recentBoundingClientRect_left = (int) => EDITOR_int_fields[31] = int;

const get_EDITOR_recentBoundingClientRect_top = () => EDITOR_int_fields[32];
const set_EDITOR_recentBoundingClientRect_top = (int) => EDITOR_int_fields[32] = int;

const get_EDITOR_pooledTrackedSyntax_start = () => EDITOR_int_fields[33];
const set_EDITOR_pooledTrackedSyntax_start = (int) => EDITOR_int_fields[33] = int;

const get_EDITOR_pooledTrackedSyntax_length = () => EDITOR_int_fields[34];
const set_EDITOR_pooledTrackedSyntax_length = (int) => EDITOR_int_fields[34] = int;
