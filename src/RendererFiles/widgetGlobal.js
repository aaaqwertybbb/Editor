const WidgetKind_None = 0;
const WidgetKind_InputText = 1;
const WidgetKind_YesCancel = 2;

const WIDGETrenderKind_None = 0;
const WIDGETrenderKind_Show = 1;
const WIDGETrenderKind_Hide = 2;

/**
 * @callback MENU_Callback
 * @param {Object} options - The response object.
 * @param {boolean} [options.isCancelled=false] - Indicates if the action was cancelled.
 * @param {string} [options.value=''] - The data string returned.
 * @returns {Promise}
 */

let WIDGET_restoreFocusToElement_drawn = null;

/**
 * @type {MENU_Callback}
 */
let WIDGET_currentCallback = null;
let WIDGET_placeholder = null;
let WIDGET_value = null;
let WIDGET_target = null;

// Instead of passing the data around in a way that even still is prone to timing errors
// you should tag the UI with an id and each set increments this id you then verify that the id is matching upon
// submitting the "form"/"widget" and if the id doesn't match then the "widget" is stale and you ignore the submition.
//
// Although you'd want to ensure that every callback has the 'cancel' passed to it when it gets overwritten

const WIDGET_renderKindArray = [];

let WIDGET_restoreFocusToElementOverride = null;

// You aren't focusing the widget element itself so blur likely won't work.
//WIDGET_element.addEventListener('focusout', () => WIDGET_hide());

function WIDGET_render_request(renderKind) {
    if (WIDGET_renderKindArray[WIDGET_renderKindArray.length - 1] !== renderKind) {
        WIDGET_renderKindArray.push(renderKind);
        if (renderKind === WIDGETrenderKind_Show) INTS[fWIDGETrenderKind_Show_countOfPendingRequests]++;
    }
    
    if (!BYTES[byteWIDGET_isRenderPending]) {
        BYTES[byteWIDGET_isRenderPending] = 1;
        requestAnimationFrame(WIDGET_render_do);
    }
}

function WIDGET_render_do() {
    let renderKind = 0;
    
    while (renderKind = WIDGET_renderKindArray.shift()) {
        switch (renderKind) {
            case WIDGETrenderKind_Show:
                if (INTS[fWIDGETrenderKind_Show_countOfPendingRequests]-- > 1) break;
                WIDGET_render_do_Show();
                break;
            case WIDGETrenderKind_Hide:
                WIDGET_render_do_Hide();
                break;
        }
    }
    
    BYTES[byteWIDGET_isRenderPending] = 0; // Reset the paint lock
}

function WIDGET_render_do_Show() {

    let WIDGET_element = document.getElementById('WIDGET');
    if (BYTES[byteWIDGET_WidgetKind_drawn] !== WidgetKind_None) {
        WIDGET_element = null;
        // You don't have to invoke 'WIDGET_state_do_Hide' because there was a 1 to 1 overwrite of all the state due to the 'WIDGET_show' invocation which triggered this function.
        BYTES[byteWIDGET_shouldRestoreFocus] = 0; // going to show a different widget so don't bother with focus here
        WIDGET_render_do_Hide();
    }

    if (!WIDGET_element) {
        WIDGET_element = document.createElement('div');
        WIDGET_element.id = 'WIDGET';
        document.body.appendChild(WIDGET_element);
    }

    BYTES[byteWIDGET_WidgetKind_drawn] = BYTES[byteWIDGET_WidgetKind_pending];

    if (WIDGET_restoreFocusToElementOverride) {
        WIDGET_restoreFocusToElement_drawn = WIDGET_restoreFocusToElementOverride;
        WIDGET_restoreFocusToElementOverride = null;
    }
    else {
        WIDGET_restoreFocusToElement_drawn = document.activeElement;
    }
    
    INTS[fWIDGET_ticketId_drawn] = INTS[fWIDGET_ticketId_pending];

    switch (BYTES[byteWIDGET_WidgetKind_drawn]) {
        case WidgetKind_InputText:
            WIDGET_CreateInputText();
            break;
        case WidgetKind_YesCancel:
            WIDGET_CreateYesCancel();
            break;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalLeft = INTS[fWIDGET_left];
    let finalTop = INTS[fWIDGET_top];
    //let rect = WIDGET_element.getBoundingClientRect();

    // Check right edge
    //if (rect.right > viewportWidth) {
    if (INTS[fWIDGET_left] + WIDGET_element.offsetWidth > viewportWidth) {
      finalLeft = viewportWidth - WIDGET_element.offsetWidth - 10; // 10px padding boundary
    }
    // Check left edge (fallback if menu is wider than screen)
    if (finalLeft < 0) finalLeft = 10;

    // Check bottom edge
    //if (rect.bottom > viewportHeight) {
    if (INTS[fWIDGET_top] + WIDGET_element.offsetHeight > viewportHeight) {
      finalTop = viewportHeight - WIDGET_element.offsetHeight - 10; 
    }
    // Check top edge
    if (finalTop < 0) finalTop = 10;

    // 3. Apply the corrected coordinates
    WIDGET_element.style.left = `${finalLeft}px`;
    WIDGET_element.style.top = `${finalTop}px`;
}

/**
 * Two consecutive invocations of this function will result in the first invocation's 'callback' being invoked with the cancelled state.
 * Whether the first invocation's rAF request triggered or not has no impact on things.
 * - If it was triggered the cancelled state is still passed to the first invocation's 'callback'.
 * - If it was NOT triggered, then the rAF request that relates to the first invocation in particular is skipped.
 * 
 * @param {number} widgetKind 'get_WidgetKind_%()'
 * @param {number} left 
 * @param {number} top 
 * @param {string} placeholder if the corresponding widget has a corresponding placeholder attribute this string will be provided as the attribute's value. This is stored in the variable 'WIDGET_placeholder'.
 * @param {string | object} value if the corresponding widget has a value attribute and this is expectedly a 'string' then this will be provided as the attribute's value. This is stored in the variable 'WIDGET_value'.
 * @param {object} target this is stored in the variable 'WIDGET_target'.
 * @param {MENU_Callback} callback this is invoked when the widget is either submitted or cancelled.
 */
async function WIDGET_show(widgetKind, left, top, placeholder, value, target, callback) {

    INTS[fWIDGET_ticketId_pending] = INTS[fWIDGET_ticketId_counter]++;
    BYTES[byteWIDGET_WidgetKind_pending] = widgetKind;

    // TODO: Does this go before the above ticketId logic? I'm not sure but I feel confident that it makes more sense at the least above the '_left and _top' logic.
    if (WIDGET_currentCallback) {
        await WIDGET_currentCallback({isCancelled:true, value:undefined});
    }
    WIDGET_currentCallback = callback;

    INTS[fWIDGET_left] = left;
    INTS[fWIDGET_top] = top;
    WIDGET_placeholder = placeholder;
    WIDGET_value = value;
    WIDGET_target = target;

    WIDGET_render_request(WIDGETrenderKind_Show);
}

function WIDGET_render_do_Hide() {
    const WIDGET_element = document.getElementById('WIDGET');

    switch (BYTES[byteWIDGET_WidgetKind_drawn]) {
        case WidgetKind_InputText:
            let input = document.getElementById('WIDGET_inputText');
            input.removeEventListener('keydown', WIDGET_inputTextOnKeyDown);
            break;
        case WidgetKind_YesCancel:
            let yesButtonElement = document.getElementById('WIDGET_YesCancel_yes');
            yesButtonElement.removeEventListener('click', WIDGET_YesCancelButtonOnClick_yes);
            let cancelButtonElement = document.getElementById('WIDGET_YesCancel_cancel');
            cancelButtonElement.removeEventListener('click', WIDGET_YesCancelButtonOnClick_cancel);
            break;
    }
    BYTES[byteWIDGET_WidgetKind_drawn] = WidgetKind_None;
    WIDGET_element.remove();
    if (BYTES[byteWIDGET_shouldRestoreFocus] && WIDGET_restoreFocusToElement_drawn)
        WIDGET_restoreFocusToElement_drawn.focus();
}

async function WIDGET_state_do_Hide(shouldRestoreFocus) {

    // TODO: This is believed to prevent any funny business where a UI is being shown, asked to be hidden, submitted before the hide rAF. Once this is confirmed to be true (or other...) remove or update this comment accordingly.
    INTS[fWIDGET_ticketId_pending] = INTS[fWIDGET_ticketId_counter]++;

    BYTES[byteWIDGET_shouldRestoreFocus] = shouldRestoreFocus;
    if (WIDGET_currentCallback) {
        await WIDGET_currentCallback({isCancelled:true, value:undefined});
    }
    WIDGET_currentCallback = null;
    BYTES[byteWIDGET_WidgetKind_pending] = WidgetKind_None;
    WIDGET_target = null;
}

async function WIDGET_hide(shouldRestoreFocus) {
    await WIDGET_state_do_Hide(shouldRestoreFocus);
    WIDGET_render_request(WIDGETrenderKind_Hide);
}

/**
 * resultObject is of the pattern {isCancelled:isCancelled, value:input.value}.
 * 
 * This function will perform any generalized widget validation.
 * At the moment the validation relates to whether the currently displayed UI is up to date with the show/hide function invocations.
 * 
 * This function is used for the UI event handlers.
 * Any internal "completion" due to for example invoking 'hide' when a UI" is being shown skips this function.
 * If anyone desires to in the future change this such that the internal "completion" uses this function, take care because 'INTS[fWIDGET_ticketId_pending] === INTS[fWIDGET_ticketId_drawn]'
 * isn't quite as sensible when dealing with internal "completion" that needs to cancel the previous UI.
 */
async function WIDGET_completeForm(resultObject) {
    if (WIDGET_currentCallback) {
        if (INTS[fWIDGET_ticketId_pending] !== INTS[fWIDGET_ticketId_drawn]) {
            resultObject.isCancelled = true;
        }
        // Avoid duplicate submissions
        // TODO: You should permit a means of cancelling the asynchronous request
        // TODO: You should consider handling the case where the asynchronous request fails due to a reason that would reasonably be followed up by allowing the user to try submitting the form again.
        //
        let local_WIDGET_currentCallback = WIDGET_currentCallback;
        WIDGET_currentCallback = null;
        return local_WIDGET_currentCallback(resultObject);
    }
}

async function WIDGET_inputTextOnKeyDown(event) {
    if (event.key === 'Enter' || event.key === 'Escape') {
        let isCancelled = event.key === 'Enter' ? false : true;
        let input = document.getElementById('WIDGET_inputText');
        await WIDGET_completeForm({isCancelled:isCancelled, value:input.value});
        await WIDGET_hide(true);
    }
}

async function WIDGET_YesCancelButtonOnClick_yes() {
    await WIDGET_completeForm({isCancelled: false, value:'Yes'});
    await WIDGET_hide(true);
}

async function WIDGET_YesCancelButtonOnClick_cancel() {
    await WIDGET_completeForm({isCancelled:true, value:'Cancel'});
    await WIDGET_hide(true);
}

function WIDGET_CreateInputText() {

    const WIDGET_element = document.getElementById('WIDGET');

    let input = document.createElement('input');
    input.type = "text";
    input.id = 'WIDGET_inputText';
    if (WIDGET_placeholder || WIDGET_placeholder === '') {
        input.placeholder = WIDGET_placeholder;
    }

    // TODO: "typeof value === 'string'" is not a bulletproof solution for checking whether the value is a string.
    // TODO: Extremely undocumented behavior in relation to the ways of using 'WIDGET_SHOW_value'.
    //
    if ((WIDGET_value || WIDGET_value === '') && (typeof WIDGET_value === 'string')) {
        input.value = WIDGET_value;
    }

    input.addEventListener('keydown', WIDGET_inputTextOnKeyDown);
    WIDGET_element.appendChild(input);
    input.focus();
}

function WIDGET_CreateYesCancel() {

    const WIDGET_element = document.getElementById('WIDGET');

    let topDivElement = document.createElement('div');
    if (WIDGET_placeholder || WIDGET_placeholder === '') {
        topDivElement.textContent = WIDGET_placeholder;
    }

    let bottomDivElement = document.createElement('div');
    let yesButtonElement = document.createElement('button');
    yesButtonElement.textContent = 'Yes';
    yesButtonElement.id = 'WIDGET_YesCancel_yes';
    yesButtonElement.addEventListener('click', WIDGET_YesCancelButtonOnClick_yes);
    bottomDivElement.appendChild(yesButtonElement);
    let cancelButtonElement = document.createElement('button');
    cancelButtonElement.textContent = 'Cancel';
    cancelButtonElement.id = 'WIDGET_YesCancel_cancel';
    cancelButtonElement.addEventListener('click', WIDGET_YesCancelButtonOnClick_cancel);
    bottomDivElement.appendChild(cancelButtonElement);

    WIDGET_element.appendChild(topDivElement);
    WIDGET_element.appendChild(bottomDivElement);
    yesButtonElement.focus();
}
