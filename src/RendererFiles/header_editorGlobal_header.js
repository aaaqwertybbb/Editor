//__#__
// preprocessor.cjs
import "./fieldBuffer"
//__#__

const EDITOR_baseElement = document.getElementById('EDITOR');

let cached_EDITOR_virtualization_horizontal;
let cached_EDITOR_virtualization_vertical;
let cached_EDITOR_gutter;
let cached_EDITOR_horizontal_scrollbar;
let cached_EDITOR_horizontal_scrollbar_virtualization_boundary;
let cached_EDITOR_body;
let cached_EDITOR_presentation;
let cached_EDITOR_cursorListElement;
let cached_EDITOR_textElement;

const EDITOR_tab_tabsbytes = new Uint8Array(4);
EDITOR_tab_tabsbytes[0] = get_EDITOR_ASCII_TAB();
EDITOR_tab_tabsbytes[1] = 0;
EDITOR_tab_tabsbytes[2] = 0;
EDITOR_tab_tabsbytes[3] = 0;
const EDITOR_tab_spacesbytes = new Uint8Array(4);
EDITOR_tab_spacesbytes[0] = get_EDITOR_ASCII_SPACE();
EDITOR_tab_spacesbytes[1] = get_EDITOR_ASCII_SPACE();
EDITOR_tab_spacesbytes[2] = get_EDITOR_ASCII_SPACE();
EDITOR_tab_spacesbytes[3] = get_EDITOR_ASCII_SPACE();

/**
 * If you have an extension listed here, it is expected that the "function to invoke" exists.
 * As of right now any patterns to naming the function that gets invoked are tentative.
 * But I am not checking whether JS_full_lex or JS_line_lex exist, I'm just switching on ExtensionKind and presuming that function exists.
 */
const get_ExtensionKind_None = () => 0;
const get_ExtensionKind_JavaScript = () => 1;

/**
 * DeleteLtr and BackspaceRtl are both forms of removing text,
 * their edits are stored the same (i.e.: both in "the form of a delete" keypress)
 * The kind delete/backspace tells you how to restore the cursor when doing a ctrl+z and etc...?
 */
const get_EditKind_None = () => 0;
const get_EditKind_InsertLtr = () => 1;
const get_EditKind_DeleteLtr = () => 2;
const get_EditKind_BackspaceRtl = () => 3;
const get_EditKind_RemoveTextNoBatching = () => 4;
const get_EditKind_Tab = () => 5;
const get_EditKind_IndentMore = () => 6;
const get_EditKind_IndentLess = () => 7;
const get_EditKind_Enter = () => 8;
const get_EditKind_Paste = () => 9;
const get_EditKind_Duplicate = () => 10;

/**
 * TODO: Long term this likely should be removed and all enter key logic reduced into an insertion but this will help in the time being.
 */
const get_EnterKeyEventKind_None = () => 0;
const get_EnterKeyEventKind_StartOfLine = () => 1;
const get_EnterKeyEventKind_EndOfLine = () => 2;
const get_EnterKeyEventKind_AmongALine = () => 3;

/**
 * Do not change the order/values of these, they are used in equality comparisons, the larger the number says when double clicking between a character and a punctuation
 * whoever has larger number gets selected then the selection continues while the same kind is being read.
 * 
 * TODO: Bug only 1 character selected when punctuation then letterOrDigit click between them the letterOrDigit is more than 1 contiguous only 1 selected.
 */
const get_CharacterKind_None = () => 0;
const get_CharacterKind_Whitespace = () => 1;
const get_CharacterKind_Punctuation = () => 2;
const get_CharacterKind_LetterOrDigit = () => 3;

// see editorGlobal.js:
// > const count_of_wellknown_renderKinds = ...;
//
// get_RenderKind_Cursor_n is to say
// renderKind - (count_of_wellknown_renderKinds - 1) => render the cursor at cursorList[result];
// ...
// maybe I'll change this to be the id of the cursor at some point cause I'm not sure if it holds up with cursor movement possibly changing their order in the list.
// but for now...
const get_RenderKind_None = () => 0;
const get_RenderKind_Scroll = () => 1;
const get_RenderKind_Resize = () => 2;
const get_RenderKind_InsertLtr = () => 3;
const get_RenderKind_TabKey = () => 4;
const get_RenderKind_IndentMore = () => 5;
const get_RenderKind_IndentLess = () => 6;
const get_RenderKind_BackspaceRtl = () => 7;
const get_RenderKind_DeleteLtr = () => 8;
const get_RenderKind_RemoveSelection = () => 9;
const get_RenderKind_Enter = () => 10;
const get_RenderKind_DuplicateOrPaste = () => 11;
const get_RenderKind_Clear = () => 12;
const get_RenderKind_SetText = () => 13;
const get_RenderKind_CreateViewport = () => 14;
const get_RenderKind_SyntaxHighlighting = () => 15;
/** non-primaryCursors won't scroll into view, */
const get_RenderKind_Cursor_flag_scrollIntoViewExplicit = () => 16;
/** To have a cursor not scroll into view add request this render immediately after the 'get_RenderKind_Cursor_n'. */
const get_RenderKind_Cursor_flag_doNotScrollIntoView = () => 17;
/** Add the index of the cursor */
const get_RenderKind_Cursor_n = () => 18;


