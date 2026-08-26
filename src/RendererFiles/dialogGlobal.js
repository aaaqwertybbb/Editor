//__#__
// preprocessor.cjs
import "./fieldBuffer"
//__#__

const DialogKind_None = "None";
const DialogKind_FindAll = "FindAll";
const DialogKind_Settings = "Settings";
const DialogKind_DocumentSymbol = "DocumentSymbol";
const DialogKind_Debug = "Debug";

let DIALOG_currentDialogKind = DialogKind_None;

/** A delegate of the form: () => {} */
let DIALOG_onResizeAction = null;
let DIALOG_restoreFocusToElement = null;
let DIALOG_HIDE_shouldRestoreFocus = true;

let DIALOG_windowExists = false;

let DIALOG_hasBeenMeaasured = false;

let DIALOG_SHOW_restoreFocusToElement = null;
let DIALOG_SHOW_currentDialogKind = DialogKind_None;
let DIALOG_SHOW_onResizeAction = null;

let DIALOG_after_X = 0;
let DIALOG_after_Y = 0;

let DIALOG_FindAll_options_matchWord = false;

let DIALOG_Settings_isDark = true;
let DIALOG_Settings_trueTabs_falseSpaces = true;
let DIALOG_Settings_editorDebugShowAdjacentCharacters = false;

let DIALOG_renderKindArray = [];
let DIALOG_isRenderPending = false;

//let DIALOG_ArrayFrom_menuOptionList_children = [];

const DIALOGrenderKind_None = 0;
const DIALOGrenderKind_Show = 1;
const DIALOGrenderKind_Hide = 2;
const DIALOGrenderKind_DimensionsChanged = 3;

function DIALOG_render_request(renderKind) {
    if (DIALOG_renderKindArray[DIALOG_renderKindArray.length - 1] !== renderKind) {
        DIALOG_renderKindArray.push(renderKind);
    }
    
    if (!DIALOG_isRenderPending) {
        DIALOG_isRenderPending = true;
        requestAnimationFrame(DIALOG_render_do);
    }
}

function DIALOG_render_do() {
    let renderKind;
    
    while (renderKind = DIALOG_renderKindArray.shift()) {
        switch (renderKind) {
            case DIALOGrenderKind_Show:
                DIALOG_render_do_Show();
                break;
            case DIALOGrenderKind_Hide:
                DIALOG_render_do_Hide();
                break;
            case DIALOGrenderKind_DimensionsChanged:
                DIALOG_render_do_DimensionsChanged();
                break;
        }
    }
    
    DIALOG_isRenderPending = false; // Reset the paint lock
}

function DIALOG_render_do_DimensionsChanged() {
    let DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    if (gINT_FIELDS[fDIALOG_left_DRAWN] !== gINT_FIELDS[fDIALOG_left]) {
        gINT_FIELDS[fDIALOG_left_DRAWN] = gINT_FIELDS[fDIALOG_left];
        DIALOG_element.style.left = `${gINT_FIELDS[fDIALOG_left_DRAWN]}px`;
    }
    if (fDIALOG_top_DRAWN !== gINT_FIELDS[fDIALOG_top]) {
        fDIALOG_top_DRAWN = gINT_FIELDS[fDIALOG_top];
        DIALOG_element.style.top = `${fDIALOG_top_DRAWN}px`;
    }
    if (gINT_FIELDS[fDIALOG_width_DRAWN] !== gINT_FIELDS[fDIALOG_width]) {
        gINT_FIELDS[fDIALOG_width_DRAWN] = gINT_FIELDS[fDIALOG_width];
        DIALOG_element.style.width = `${gINT_FIELDS[fDIALOG_width_DRAWN]}px`;
    }
    if (gINT_FIELDS[fDIALOG_height_DRAWN] !== gINT_FIELDS[fDIALOG_height]) {
        gINT_FIELDS[fDIALOG_height_DRAWN] = gINT_FIELDS[fDIALOG_height];
        DIALOG_element.style.height = `${gINT_FIELDS[fDIALOG_height_DRAWN]}px`;
    }
    
}

async function DIALOG_render_do_Show() {
    if (DIALOG_currentDialogKind !== DialogKind_None) {
        DIALOG_HIDE_shouldRestoreFocus = true;
        await DIALOG_render_do_Hide();
    }

    let DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) {
        DIALOG_element = document.createElement('div');
        DIALOG_element.id = "DIALOG";
        document.body.appendChild(DIALOG_element);
    }

    DIALOG_restoreFocusToElement = DIALOG_SHOW_restoreFocusToElement;
    DIALOG_currentDialogKind = DIALOG_SHOW_currentDialogKind;
    DIALOG_onResizeAction = DIALOG_SHOW_onResizeAction;

    DIALOG_createWindow();

    switch (DIALOG_currentDialogKind) {
        case DialogKind_FindAll:
            return DIALOG_FindAll_Create_async();
        case DialogKind_Settings:
            return DIALOG_Settings_Create_async();
        case DialogKind_DocumentSymbol:
            return DIALOG_DocumentSymbol_Create_async();
        case DialogKind_Debug:
            return DIALOG_Debug_Create_async();
    }
}

async function DIALOG_show_async(dialogKind, onResizeAction) {    
    DIALOG_SHOW_restoreFocusToElement = document.activeElement;
    DIALOG_SHOW_currentDialogKind = dialogKind;
    DIALOG_SHOW_onResizeAction = onResizeAction;
    DIALOG_render_request(DIALOGrenderKind_Show);
}

async function DIALOG_render_do_Hide() {
    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    switch (DIALOG_currentDialogKind) {
        case DialogKind_FindAll:
            await DIALOG_FindAll_Delete_async();
            break;
        case DialogKind_Settings:
            await DIALOG_Settings_Delete_async();
            break;
        case DialogKind_DocumentSymbol:
            await DIALOG_DocumentSymbol_Delete_async();
            break;
        case DialogKind_Debug:
            await DIALOG_Debug_Delete_async();
            break;
    }

    DIALOG_deleteWindow();

    DIALOG_onResizeAction = null;
    DIALOG_element.remove();
    DIALOG_currentDialogKind = DialogKind_None;
    if (shouldRestoreFocus) {
        if (DIALOG_restoreFocusToElement) {
            DIALOG_restoreFocusToElement.focus();
        }
        DIALOG_restoreFocusToElement = null;
    }
}

function DIALOG_hide_request(shouldRestoreFocus) {
    DIALOG_HIDE_shouldRestoreFocus = shouldRestoreFocus;
    DIALOG_render_request(DIALOGrenderKind_Hide);
}

function DIALOG_closeButton_onclick() {
    DIALOG_hide_request(true);
}

function DIALOG_resize_onmouseenter(event) {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    if (event.buttons & 1) {
        // while resizing you went from one end to the other and it bugged out
        return;
    }

    let resize = document.getElementById('DIALOG_resize');
    if (!resize) return;

    // TODO: cache the bounding client rect
    let dialogBoundingClientRect = DIALOG_element.getBoundingClientRect();

    DIALOG_resize_setCursor(event.clientX, event.clientY, dialogBoundingClientRect, resize);
}

function DIALOG_resize_onmousedown(event) {
    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    let resize = document.getElementById('DIALOG_resize');
    if (!resize) return;

    // TODO: cache the bounding client rect
    let dialogBoundingClientRect = DIALOG_element.getBoundingClientRect();

    DIALOG_resize_setCursor(event.clientX, event.clientY, dialogBoundingClientRect, resize);

    gINT_FIELDS[fDIALOG_before_X] = event.clientX;
    gINT_FIELDS[fDIALOG_before_Y] = event.clientY;
    DIALOG_after_X = 0;
    DIALOG_after_Y = 0;

    gINT_FIELDS[fDIALOG_left] = dialogBoundingClientRect.left;
    gINT_FIELDS[fDIALOG_top] = dialogBoundingClientRect.top;
    gINT_FIELDS[fDIALOG_width] = dialogBoundingClientRect.width;
    gINT_FIELDS[fDIALOG_height] = dialogBoundingClientRect.height;
    DIALOG_hasBeenMeaasured = true;

    document.body.classList.add('unselectable');
    window.addEventListener('mousemove', DIALOG_resize_body_onmousemove, /*useCapture*/ true);
}

/**
 * does not redraw, only preps the state to be redrawn
 */
function DIALOG_n_resize_calcOnly(diff_Y, clientY) {
    if (diff_Y < 0) {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_top] <= CONST_DIALOG_minTop) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_top] - absdiff_Y < CONST_DIALOG_minTop) {
            clientY += (absdiff_Y - (gINT_FIELDS[fDIALOG_top] - CONST_DIALOG_minTop));
            absdiff_Y = gINT_FIELDS[fDIALOG_top] - CONST_DIALOG_minTop;
        }
        gINT_FIELDS[fDIALOG_top] -= absdiff_Y;
        gINT_FIELDS[fDIALOG_height] += absdiff_Y;
        gINT_FIELDS[fDIALOG_before_Y] = clientY;
    }
    else {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_height] <= CONST_DIALOG_minHeight) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_height] - absdiff_Y < CONST_DIALOG_minHeight) {
            clientY -= (absdiff_Y - (gINT_FIELDS[fDIALOG_height] - CONST_DIALOG_minHeight));
            absdiff_Y = gINT_FIELDS[fDIALOG_height] - CONST_DIALOG_minHeight;
        }
        gINT_FIELDS[fDIALOG_height] -= absdiff_Y;
        gINT_FIELDS[fDIALOG_top] += absdiff_Y;
        gINT_FIELDS[fDIALOG_before_Y] = clientY;
    }
}

/** does not redraw, only preps the state to be redrawn */
function DIALOG_e_resize_calcOnly(diff_X, clientX) {
    if (diff_X < 0) {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_width] <= CONST_DIALOG_minWidth) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_width] - absdiff_X < CONST_DIALOG_minWidth) {
            clientX += (absdiff_X - (gINT_FIELDS[fDIALOG_width] - CONST_DIALOG_minWidth));
            absdiff_X = gINT_FIELDS[fDIALOG_width] - CONST_DIALOG_minWidth;
        }
        gINT_FIELDS[fDIALOG_width] -= absdiff_X;
        gINT_FIELDS[fDIALOG_before_X] = clientX;
    }
    else {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_left] + gINT_FIELDS[fDIALOG_width] + 8 >= window.innerWidth) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_left] + gINT_FIELDS[fDIALOG_width] + 8 + absdiff_X > window.innerWidth) {
            let DIALOG_maxWidth = window.innerWidth - 8 - gINT_FIELDS[fDIALOG_left];
            clientX -= (absdiff_X - (DIALOG_maxWidth - gINT_FIELDS[fDIALOG_width]));
            absdiff_X = DIALOG_maxWidth - gINT_FIELDS[fDIALOG_width];
        }
        gINT_FIELDS[fDIALOG_width] += absdiff_X;
        gINT_FIELDS[fDIALOG_before_X] = clientX;
    }
}

/** does not redraw, only preps the state to be redrawn */
function DIALOG_s_resize_calcOnly(diff_Y, clientY) {
    if (diff_Y < 0) {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_height] <= CONST_DIALOG_minHeight) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_height] - absdiff_Y < CONST_DIALOG_minHeight) {
            // tighten in the other direction because overshoot
            clientY += (absdiff_Y - (gINT_FIELDS[fDIALOG_height] - CONST_DIALOG_minHeight));
            absdiff_Y = gINT_FIELDS[fDIALOG_height] - CONST_DIALOG_minHeight;
        }
        gINT_FIELDS[fDIALOG_height] -= absdiff_Y;
        gINT_FIELDS[fDIALOG_before_Y] = clientY;
    }
    else {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_top] + 8 + gINT_FIELDS[fDIALOG_height] >= window.innerHeight) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_top] + 8 + gINT_FIELDS[fDIALOG_height] + absdiff_Y > window.innerHeight) {
            // tighten in the other direction because overshoot
            // -8 is the hardcoded pixel size that the resize element overhangs the dialog.
            let DIALOG_maxHeight = window.innerHeight - 8 - gINT_FIELDS[fDIALOG_top];
            clientY -= (absdiff_Y - (DIALOG_maxHeight - gINT_FIELDS[fDIALOG_height]));
            absdiff_Y = DIALOG_maxHeight - gINT_FIELDS[fDIALOG_height];
        }
        gINT_FIELDS[fDIALOG_height] += absdiff_Y;
        gINT_FIELDS[fDIALOG_before_Y] = clientY;
    }
}

/** does not redraw, only preps the state to be redrawn */
function DIALOG_w_resize_calcOnly(diff_X, clientX) {
    if (diff_X < 0) {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_left] <= CONST_DIALOG_minLeft) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_left] - absdiff_X < CONST_DIALOG_minLeft) {
            clientX += (absdiff_X - (gINT_FIELDS[fDIALOG_left] - CONST_DIALOG_minLeft));
            absdiff_X = gINT_FIELDS[fDIALOG_left] - CONST_DIALOG_minLeft;
        }
        gINT_FIELDS[fDIALOG_width] += absdiff_X;
        gINT_FIELDS[fDIALOG_left] -= absdiff_X;
        gINT_FIELDS[fDIALOG_before_X] = clientX;
    }
    else {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_width] <= CONST_DIALOG_minWidth) {
            return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_width] - absdiff_X < CONST_DIALOG_minWidth) {
            clientX += (absdiff_X - (gINT_FIELDS[fDIALOG_width] - CONST_DIALOG_minWidth));
            absdiff_X = gINT_FIELDS[fDIALOG_width] - CONST_DIALOG_minWidth;
        }
        gINT_FIELDS[fDIALOG_width] -= absdiff_X;
        gINT_FIELDS[fDIALOG_left] += absdiff_X;
        gINT_FIELDS[fDIALOG_before_X] = clientX;
    }
}

function DIALOG_resize_body_onmousemove(event) {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    let resize = document.getElementById('DIALOG_resize');
    if (!resize) return;

    if (event.buttons & 1) {
        // TODO: I literally can't even right now with this empty if statement
    }
    else {
        document.body.classList.remove('unselectable');
        window.removeEventListener('mousemove', DIALOG_resize_body_onmousemove, /*useCapture*/ true);
        if (DIALOG_onResizeAction) DIALOG_onResizeAction();
        return;
    }

    let diff_X = event.clientX - gINT_FIELDS[fDIALOG_before_X];
    let diff_Y = event.clientY - gINT_FIELDS[fDIALOG_before_Y];

    if (diff_Y > -1 && diff_Y < 1) diff_Y = 0;
    if (diff_X > -1 && diff_X < 1) diff_X = 0;

    if (diff_X === 0 && diff_Y === 0) {
        return;
    }

    let clientX = event.clientX;
    let clientY = event.clientY;

    switch (resize.style.cursor) {
        case 'nw-resize':
            DIALOG_n_resize_calcOnly(diff_Y, clientY);
            DIALOG_w_resize_calcOnly(diff_X, clientX);
            break;
        case 'w-resize':
            DIALOG_w_resize_calcOnly(diff_X, clientX);
            break;
        case 'sw-resize':
            DIALOG_s_resize_calcOnly(diff_Y, clientY);
            DIALOG_w_resize_calcOnly(diff_X, clientX);
            break;
        case 'n-resize':
            DIALOG_n_resize_calcOnly(diff_Y, clientY);
            break;
        case 's-resize':
            DIALOG_s_resize_calcOnly(diff_Y, clientY);
            break;
        case 'ne-resize':
            DIALOG_n_resize_calcOnly(diff_Y, clientY);
            DIALOG_e_resize_calcOnly(diff_X, clientX);
            break;
        case 'e-resize':
            DIALOG_e_resize_calcOnly(diff_X, clientX);
            break;
        case 'se-resize':
            DIALOG_s_resize_calcOnly(diff_Y, clientY);
            DIALOG_e_resize_calcOnly(diff_X, clientX);
            break;
        default:
            return;
    }

    DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
}

// TODO: async event handlers are probably more likely to leak the event...
// ...because if you access the variable after using an 'await'...
// ...the engine likely cannot collect the event object and...
// ...I'm not sure when the object is removed the from the cache but the timing might be off.

function DIALOG_resize_setCursor(clientX, clientY, dialogBoundingClientRect, resize) {
    let rX = clientX - dialogBoundingClientRect.left;
    let rY = clientY - dialogBoundingClientRect.top;
    // left to right
    //     top to bottom
    if (rX < 0) {
        if (rY < 0) {
            resize.style.cursor = 'nw-resize';
        }
        else if (clientY < dialogBoundingClientRect.top + dialogBoundingClientRect.height) {
            resize.style.cursor = 'w-resize';
        }
        else {
            resize.style.cursor = 'sw-resize';
        }
    }
    else if (clientX < dialogBoundingClientRect.left + dialogBoundingClientRect.width) {
        if (rY < 0) {
            resize.style.cursor = 'n-resize';
        }
        else if (clientY < dialogBoundingClientRect.top + dialogBoundingClientRect.height) {
            //resize.style.cursor = 'ns-resize';
        }
        else {
            resize.style.cursor = 's-resize';
        }
    }
    else {
        if (rY < 0) {
            resize.style.cursor = 'ne-resize';
        }
        else if (clientY < dialogBoundingClientRect.top + dialogBoundingClientRect.height) {
            resize.style.cursor = 'e-resize';
        }
        else {
            resize.style.cursor = 'se-resize';
        }
    }
}

/** This is the wellknown JS window object: 'window.addEventListener...' not to be confused with what I call the "window" of the dialog. */
function DIALOG_window_onresize() {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    if (!DIALOG_hasBeenMeaasured) return;

    // Max width and min width depend on the left/top so they need to come first.
    if (gINT_FIELDS[fDIALOG_left] <= CONST_DIALOG_minLeft) {
        gINT_FIELDS[fDIALOG_left] = CONST_DIALOG_minLeft;
        DIALOG_element.style.left = gINT_FIELDS[fDIALOG_left] + 'px';
    }
    if (gINT_FIELDS[fDIALOG_top] <= CONST_DIALOG_minTop) {
        gINT_FIELDS[fDIALOG_top] = CONST_DIALOG_minTop;
        DIALOG_element.style.top = gINT_FIELDS[fDIALOG_top] + 'px';
    }

    if (gINT_FIELDS[fDIALOG_height] <= CONST_DIALOG_minHeight) {
        gINT_FIELDS[fDIALOG_height] = CONST_DIALOG_minHeight;
        DIALOG_element.style.height = gINT_FIELDS[fDIALOG_height] + 'px';
    }
    else if (gINT_FIELDS[fDIALOG_height] + gINT_FIELDS[fDIALOG_top] + 8 >= window.innerHeight) {
        gINT_FIELDS[fDIALOG_height] = window.innerHeight - 8 - gINT_FIELDS[fDIALOG_top];
        DIALOG_element.style.height = gINT_FIELDS[fDIALOG_height] + 'px';
    }

    if (gINT_FIELDS[fDIALOG_width] <= CONST_DIALOG_minWidth) {
        gINT_FIELDS[fDIALOG_width] = CONST_DIALOG_minWidth;
        DIALOG_element.style.width = gINT_FIELDS[fDIALOG_width] + 'px';
    }	
    else if (gINT_FIELDS[fDIALOG_left] + gINT_FIELDS[fDIALOG_width] + 8 >= window.innerWidth) {
        gINT_FIELDS[fDIALOG_width] = window.innerWidth - 8 - gINT_FIELDS[fDIALOG_left];
        DIALOG_element.style.width = gINT_FIELDS[fDIALOG_width] + 'px';
    }
}

function DIALOG_toolbar_body_onmousemove(event) {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    let resize = document.getElementById('DIALOG_resize');
    if (!resize) return;

    if (event.buttons & 1) {
        // TODO: I literally can't even right now with this empty if statement
    }
    else {
        document.body.classList.remove('unselectable');
        window.removeEventListener('mousemove', DIALOG_toolbar_body_onmousemove, /*useCapture*/ true);
        if (DIALOG_onResizeAction) DIALOG_onResizeAction();
        return;
    }

    let diff_X = event.clientX - gINT_FIELDS[fDIALOG_before_X];
    let diff_Y = event.clientY - gINT_FIELDS[fDIALOG_before_Y];

    if (diff_Y > -1 && diff_Y < 1) diff_Y = 0;
    if (diff_X > -1 && diff_X < 1) diff_X = 0;

    if (diff_X === 0 && diff_Y === 0) {
        return;
    }

    let clientX = event.clientX;
    let clientY = event.clientY;

    if (diff_X < 0) {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_left] <= CONST_DIALOG_minLeft) {
            //return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_left] - absdiff_X < CONST_DIALOG_minLeft) {
            clientX += (absdiff_X - (gINT_FIELDS[fDIALOG_left] - CONST_DIALOG_minLeft));
            absdiff_X = gINT_FIELDS[fDIALOG_left] - CONST_DIALOG_minLeft;

            gINT_FIELDS[fDIALOG_left] -= absdiff_X;
            gINT_FIELDS[fDIALOG_before_X] = clientX;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
        else {
            gINT_FIELDS[fDIALOG_left] -= absdiff_X;
            gINT_FIELDS[fDIALOG_before_X] = clientX;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
    }
    else if (diff_X > 0) {
        let absdiff_X = Math.abs(diff_X);
        if (gINT_FIELDS[fDIALOG_left] + gINT_FIELDS[fDIALOG_width] + 8 >= window.innerWidth) {
            //return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_left] + gINT_FIELDS[fDIALOG_width] + 8 + absdiff_X > window.innerWidth) {
            let DIALOG_maxLeft = window.innerWidth - 8 - gINT_FIELDS[fDIALOG_width];
            clientX -= (absdiff_X - (DIALOG_maxLeft - gINT_FIELDS[fDIALOG_left]));
            absdiff_X = DIALOG_maxLeft - gINT_FIELDS[fDIALOG_left];

            gINT_FIELDS[fDIALOG_left] += absdiff_X;
            gINT_FIELDS[fDIALOG_before_X] = clientX;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
        else {
            gINT_FIELDS[fDIALOG_left] += absdiff_X;
            gINT_FIELDS[fDIALOG_before_X] = clientX;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
    }

    if (diff_Y < 0) {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_top] <= CONST_DIALOG_minTop) {
            //return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_top] - absdiff_Y < CONST_DIALOG_minTop) {
            clientY += (absdiff_Y - (gINT_FIELDS[fDIALOG_top] - CONST_DIALOG_minTop));
            absdiff_Y = gINT_FIELDS[fDIALOG_top] - CONST_DIALOG_minTop;
            
            gINT_FIELDS[fDIALOG_top] -= absdiff_Y;
            gINT_FIELDS[fDIALOG_before_Y] = clientY;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
        else {
            gINT_FIELDS[fDIALOG_top] -= absdiff_Y;
            gINT_FIELDS[fDIALOG_before_Y] = clientY;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
    }
    else if (diff_Y > 0) {
        let absdiff_Y = Math.abs(diff_Y);
        if (gINT_FIELDS[fDIALOG_top] + 8 + gINT_FIELDS[fDIALOG_height] >= window.innerHeight) {
            //return; // TODO: ...
        }
        else if (gINT_FIELDS[fDIALOG_top] + 8 + gINT_FIELDS[fDIALOG_height] + absdiff_Y > window.innerHeight) {
            let DIALOG_maxTop = window.innerHeight - 8 - gINT_FIELDS[fDIALOG_height];
            clientY -= (absdiff_Y - (DIALOG_maxTop - gINT_FIELDS[fDIALOG_top]));
            absdiff_Y = DIALOG_maxTop - gINT_FIELDS[fDIALOG_top];
            
            gINT_FIELDS[fDIALOG_top] += absdiff_Y;
            gINT_FIELDS[fDIALOG_before_Y] = clientY;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
        else {
            gINT_FIELDS[fDIALOG_top] += absdiff_Y;
            gINT_FIELDS[fDIALOG_before_Y] = clientY;
            DIALOG_render_request(DIALOGrenderKind_DimensionsChanged);
        }
    }
}

function DIALOG_toolbar_onmousedown(event) {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    let resize = document.getElementById('DIALOG_toolbar');
    if (!resize) return;

    // TODO: cache the bounding client rect
    let dialogBoundingClientRect = DIALOG_element.getBoundingClientRect();

    gINT_FIELDS[fDIALOG_before_X] = event.clientX;
    gINT_FIELDS[fDIALOG_before_Y] = event.clientY;
    DIALOG_after_X = 0;
    DIALOG_after_Y = 0;

    gINT_FIELDS[fDIALOG_left] = dialogBoundingClientRect.left;
    gINT_FIELDS[fDIALOG_top] = dialogBoundingClientRect.top;
    gINT_FIELDS[fDIALOG_width] = dialogBoundingClientRect.width;
    gINT_FIELDS[fDIALOG_height] = dialogBoundingClientRect.height;
    DIALOG_hasBeenMeaasured = true;

    document.body.classList.add('unselectable');
    window.addEventListener('mousemove', DIALOG_toolbar_body_onmousemove, /*useCapture*/ true);
}

/**
 * Window is the title bar, maximize, minimize, close etc...
 */
function DIALOG_createWindow() {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    // TODO: Might want to check if the HTML element exists instead.
    if (DIALOG_windowExists) return;
    DIALOG_windowExists = true;

    let toolbar = document.createElement('div');
    toolbar.id = 'DIALOG_toolbar';
    let body = document.createElement('div');
    body.id = 'DIALOG_body';
    let resize = document.createElement('div');
    resize.id = 'DIALOG_resize';

    toolbar.addEventListener('mousedown', DIALOG_toolbar_onmousedown);

    resize.addEventListener('mouseenter', DIALOG_resize_onmouseenter);
    resize.addEventListener('mousedown', DIALOG_resize_onmousedown);
    window.addEventListener('resize', DIALOG_window_onresize);

    DIALOG_element.appendChild(resize);
    DIALOG_element.appendChild(toolbar);
    DIALOG_element.appendChild(body);

    // TODO: You have to actually make sure the text fits
    toolbar.textContent = DIALOG_currentDialogKind;

    let closeButton = document.createElement('button');
    closeButton.textContent = 'x';
    closeButton.id = 'DIALOG_closeButton';

    closeButton.addEventListener('click', DIALOG_closeButton_onclick);

    toolbar.appendChild(closeButton);

    closeButton.focus();
}

/**
 * Window is the title bar, maximize, minimize, close etc...
 */
function DIALOG_deleteWindow() {

    const DIALOG_element = document.getElementById('DIALOG');
    if (!DIALOG_element) return;

    // TODO: Might want to check if the HTML element exists instead.
    if (!DIALOG_windowExists) return;
    // TODO: Perhaps move these respective sets to the end of their functions.
    // This way them being set as a certain value reflects that the entirety of their respective code had been ran but then again... idk
    DIALOG_windowExists = false;

    gINT_FIELDS[fDIALOG_left] = 0;
    gINT_FIELDS[fDIALOG_top] = 0;
    gINT_FIELDS[fDIALOG_width] = 0;
    gINT_FIELDS[fDIALOG_height] = 0;

    gINT_FIELDS[fDIALOG_before_X] = 0;
    gINT_FIELDS[fDIALOG_before_Y] = 0;
    DIALOG_after_X = 0;
    DIALOG_after_Y = 0;

    let toolbar = document.getElementById('DIALOG_toolbar');
    toolbar.removeEventListener('mousedown', DIALOG_toolbar_onmousedown);

    document.body.classList.remove('unselectable');
    window.removeEventListener('mousemove', DIALOG_resize_body_onmousemove, /*useCapture*/ true);
    window.removeEventListener('mousemove', DIALOG_toolbar_body_onmousemove, /*useCapture*/ true);
    if (DIALOG_onResizeAction) DIALOG_onResizeAction();

    window.removeEventListener('resize', DIALOG_window_onresize);

    let resize = document.getElementById('DIALOG_resize');
    resize.removeEventListener('mouseenter', DIALOG_resize_onmouseenter);
    resize.removeEventListener('mousedown', DIALOG_resize_onmousedown);

    let closeButton = document.getElementById('DIALOG_closeButton');
    closeButton.removeEventListener('click', DIALOG_closeButton_onclick);
}
