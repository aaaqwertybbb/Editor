let AUTOCOMPLETE_exists = false;

let AUTOCOMPLETE_pending_lspResult = null;
// I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
let AUTOCOMPLETE_items_slice = null;

const AUTOCOMPLETErenderKind_None = 0;
const AUTOCOMPLETErenderKind_Show = 1;
const AUTOCOMPLETErenderKind_Hide = 2;
const AUTOCOMPLETErenderKind_CursorSet = 3;
const AUTOCOMPLETErenderKind_CreateLines = 4;
const AUTOCOMPLETErenderKind_Scroll = 5;

let AUTOCOMPLETE_renderKindArray = [];
let AUTOCOMPLETE_isRenderPending = false;

let AUTOCOMPLETE_cursorIndex = 0;


let AUTOCOMPLETE_rectHeight = 0;
let AUTOCOMPLETE_rectLeft = 0;
let AUTOCOMPLETE_rectTop = 0;
let AUTOCOMPLETE_rect_isNull = true;

let AUTOCOMPLETE_virtualCount = 0;
let AUTOCOMPLETE_virtualIndex = 0;

let AUTOCOMPLETE_beltIndexZero = 0;

let AUTOCOMPLETEElement = null;
let AUTOCOMPLETE_scrollTop = 0;
let AUTOCOMPLETE_arrayFromItemListElement = null;

let AUTOCOMPLETE_scrollEndDeadline = 0;
let AUTOCOMPLETE_isCheckingTrailingEdge = false;

let AUTOCOMPLETE_scrollIsFetchingData = false;

let AUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 2;

let AUTOCOMPLETE_sliceVirtualIndex_SLICE = 0;
let AUTOCOMPLETE_sliceVirtualCount_SLICE = 0;
let AUTOCOMPLETE_sliceBeltIndexZero_SLICE = 0;

function AUTOCOMPLETE_render_request(renderKind) {
    if (AUTOCOMPLETE_renderKindArray[AUTOCOMPLETE_renderKindArray.length - 1] !== renderKind) {
        AUTOCOMPLETE_renderKindArray.push(renderKind);
    }
    
    if (!AUTOCOMPLETE_isRenderPending) {
        AUTOCOMPLETE_isRenderPending = true;
        requestAnimationFrame(AUTOCOMPLETE_renderDo);
    }
}

function AUTOCOMPLETE_renderDo(timestamp) {
    let renderKind;

    while (renderKind = AUTOCOMPLETE_renderKindArray.shift()) {
        switch (renderKind) {
            case AUTOCOMPLETErenderKind_Show:
                AUTOCOMPLETE_render_do_show(timestamp);
                break;
            case AUTOCOMPLETErenderKind_Hide:
                AUTOCOMPLETE_render_do_hide();
                break;
            case AUTOCOMPLETErenderKind_CursorSet:
                AUTOCOMPLETE_cursor_render_set();
                break;
            case AUTOCOMPLETErenderKind_CreateLines:
                AUTOCOMPLETE_render_create_lines();
                break;
            case AUTOCOMPLETErenderKind_Scroll:
                AUTOCOMPLETE_events_scroll_render(timestamp);
                break;
        }
    }
    
    AUTOCOMPLETE_isRenderPending = false; // Reset the lock
}

function AUTOCOMPLETE_render_create_lines(AUTOCOMPLETE_itemList) {

    if (!AUTOCOMPLETE_itemList) {
        AUTOCOMPLETE_itemList = document.getElementById('AUTOCOMPLETE_itemList');
        if (!AUTOCOMPLETE_itemList) return; // TODO: silent error
    }

    // TODO: minus CONST_AUTOCOMPLETE_topPadding
    AUTOCOMPLETE_virtualCount = Math.floor(AUTOCOMPLETE_rectHeight / APP_lineHeight);
    AUTOCOMPLETE_virtualIndex = 0;
    AUTOCOMPLETE_beltIndexZero = 0;
    AUTOCOMPLETE_scrollTop = 0;

    AUTOCOMPLETE_cursorIndex = 0;

    let appHeightCssAttributeValue = `${APP_lineHeight}px`;

    AUTOCOMPLETE_itemList.innerHTML = '';

    let verticalOffset = CONST_AUTOCOMPLETE_topPadding;

    let widthAttributeValueNumber = Math.ceil((AUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING + 2/*padding*/) * EXPLORER_firstSpanWidthValue);
    let widthAttributeValueString = widthAttributeValueNumber + 'px';

    for (let i = 0; i < AUTOCOMPLETE_virtualCount; i++) {
        let div = document.createElement('div');
        div.style.height = appHeightCssAttributeValue;
        div.style.whiteSpace = 'nowrap';
        div.style.position = 'absolute';
        div.style.left = '0px';
        div.style.top = '0px';

        // TODO: Does treeViewComponent.js specify a:
        // - [ ] left
        // - [ ] top
        // |
        // for the nodes, it needs to even if 0 so the browser receives explicit instructions rather than trying to static place and it "happens" to end up at 0,0.

        div.style.width = widthAttributeValueString;
        AUTOCOMPLETE_itemList.append(div);

        div.style.transform = `translateY(${verticalOffset}px)`;
        verticalOffset += APP_lineHeight;
    }

    AUTOCOMPLETE_arrayFromItemListElement = Array.from(AUTOCOMPLETE_itemList.children);
}

function AUTOCOMPLETE_render_RESET_lines(AUTOCOMPLETE_itemList) {

    if (!AUTOCOMPLETE_itemList) {
        AUTOCOMPLETE_itemList = document.getElementById('AUTOCOMPLETE_itemList');
        if (!AUTOCOMPLETE_itemList) return; // TODO: silent error
    }

    AUTOCOMPLETE_ensure_boundingClientRect();

    // TODO: minus CONST_AUTOCOMPLETE_topPadding
    AUTOCOMPLETE_virtualCount = Math.floor(AUTOCOMPLETE_rectHeight / APP_lineHeight);
    AUTOCOMPLETE_virtualIndex = 0;
    AUTOCOMPLETE_beltIndexZero = 0;
    AUTOCOMPLETE_scrollTop = 0;

    AUTOCOMPLETEElement.removeEventListener('scroll', AUTOCOMPLETE_events_scroll_receive, { passive: true });
    AUTOCOMPLETEElement.scrollTop = 0;
    AUTOCOMPLETEElement.addEventListener('scroll', AUTOCOMPLETE_events_scroll_receive, { passive: true });
    AUTOCOMPLETE_cursorIndex = 0;

    let appHeightCssAttributeValue = `${APP_lineHeight}px`;

    let verticalOffset = CONST_AUTOCOMPLETE_topPadding;

    for (let i = 0; i < AUTOCOMPLETE_virtualCount; i++) {
        
        let div = AUTOCOMPLETE_arrayFromItemListElement[i];

        // TODO: Does treeViewComponent.js specify a:
        // - [ ] left
        // - [ ] top
        // |
        // for the nodes, it needs to even if 0 so the browser receives explicit instructions rather than trying to static place and it "happens" to end up at 0,0.

        div.style.transform = `translateY(${verticalOffset}px)`;
        verticalOffset += APP_lineHeight;
    }
}

function AUTOCOMPLETE_render_do_show(timestamp) {

    // TODO: The code as is already isn't guaranteed to not race condition with the lsp requests
    // so this continues failing to avoid race condition, but now if the lsp throws an error you don't get locked out forever.
    // (the reason specfically I think relates to when you change a file i.e.: changing a file can race condition regardless of this being forced to false)
    // (UGH not changing a file I'm gonna pass out I'm almost done but I mean the changing the autocomplete menu or some such)
    // (also something in the code seems buggy about having the items in the correct order or something? am I missing a belt?)
    AUTOCOMPLETE_scrollIsFetchingData = false;

    let local_AUTOCOMPLETEElement;
    let AUTOCOMPLETE_itemList;
    let AUTOCOMPLETE_virtualization;

    if (AUTOCOMPLETE_exists) {
        local_AUTOCOMPLETEElement = document.getElementById('AUTOCOMPLETE');

        AUTOCOMPLETE_itemList = document.getElementById('AUTOCOMPLETE_itemList');
        if (!AUTOCOMPLETE_itemList) {
            throw new Error();
        }

        AUTOCOMPLETE_virtualization = document.getElementById('AUTOCOMPLETE_itemList');
        if (!AUTOCOMPLETE_virtualization) {
            throw new Error();
        }

        // This is why I worry about doing a bool check in the other UIs
        // I worry about the state getting corrupted somehow.
        //
        // And then if it is truly meaningful from an optimization standpoint such as the scrolling of the editor
        // I take on the state corruption risk, otherwise I just defensively handle it.
        if (!local_AUTOCOMPLETEElement) {
            AUTOCOMPLETE_exists = false;
            AUTOCOMPLETE_render_do_show();
            return;
        }

        AUTOCOMPLETE_render_RESET_lines(AUTOCOMPLETE_itemList);
    }
    else {
        local_AUTOCOMPLETEElement = document.createElement('div');
        local_AUTOCOMPLETEElement.id = 'AUTOCOMPLETE';
        local_AUTOCOMPLETEElement.className = 'unselectable';
        local_AUTOCOMPLETEElement.style.left = '0px';
        local_AUTOCOMPLETEElement.style.top = '0px';
        local_AUTOCOMPLETEElement.tabIndex = 0;

        AUTOCOMPLETE_virtualization = document.createElement('div');
        AUTOCOMPLETE_virtualization.id = 'AUTOCOMPLETE_virtualization';
        local_AUTOCOMPLETEElement.appendChild(AUTOCOMPLETE_virtualization);

        let AUTOCOMPLETE_cursor = document.createElement('div');
        AUTOCOMPLETE_cursor.id = 'AUTOCOMPLETE_cursor';
        local_AUTOCOMPLETEElement.appendChild(AUTOCOMPLETE_cursor);

        AUTOCOMPLETE_itemList = document.createElement('div');
        AUTOCOMPLETE_itemList.id = 'AUTOCOMPLETE_itemList';

        local_AUTOCOMPLETEElement.appendChild(AUTOCOMPLETE_itemList);

        document.body.appendChild(local_AUTOCOMPLETEElement);
        let rect = local_AUTOCOMPLETEElement.getBoundingClientRect();
        AUTOCOMPLETE_rectHeight = Math.floor(rect.height);
        AUTOCOMPLETE_rectLeft = rect.left;
        AUTOCOMPLETE_rectTop = rect.top;
        AUTOCOMPLETE_rect_isNull = false;

        AUTOCOMPLETE_render_create_lines(AUTOCOMPLETE_itemList);

        AUTOCOMPLETE_events_add(local_AUTOCOMPLETEElement);

        AUTOCOMPLETEElement = local_AUTOCOMPLETEElement;
    }
    
    let lspResult = AUTOCOMPLETE_pending_lspResult;
    AUTOCOMPLETE_pending_lspResult = null;
    AUTOCOMPLETE_items_slice = lspResult.items;
    gINT_FIELDS[fAUTOCOMPLETE_items_slice_start] = lspResult.itemsStart;
    gINT_FIELDS[fAUTOCOMPLETE_items_slice_end] = lspResult.itemsEnd;
    gINT_FIELDS[fAUTOCOMPLETE_items_totalLength] = lspResult.totalLength;

    // TODO: This doesn't need mail.ceil but perhaps add it to ensure things?
    let itemHeightTotalNumber = gINT_FIELDS[fAUTOCOMPLETE_items_totalLength] * APP_lineHeight + CONST_AUTOCOMPLETE_topPadding;
    AUTOCOMPLETE_virtualization.style.height = itemHeightTotalNumber + 'px';

    AUTOCOMPLETE_exists = true;

    local_AUTOCOMPLETEElement.focus();

    AUTOCOMPLETE_cursor_render_set();

    AUTOCOMPLETE_virtualIndex = AUTOCOMPLETE_virtualCount;
    AUTOCOMPLETE_events_scroll_render(timestamp);
    AUTOCOMPLETE_virtualIndex = 0;
}

function AUTOCOMPLETE_show(lspResult) {
    AUTOCOMPLETE_pending_lspResult = lspResult;
    AUTOCOMPLETE_render_request(AUTOCOMPLETErenderKind_Show);
}

function AUTOCOMPLETE_slice(lspResult) {

    AUTOCOMPLETE_scrollIsFetchingData = false;
    if (AUTOCOMPLETE_sliceVirtualIndex_SLICE != AUTOCOMPLETE_virtualIndex ||
        AUTOCOMPLETE_sliceVirtualCount_SLICE != AUTOCOMPLETE_virtualCount ||
        AUTOCOMPLETE_sliceBeltIndexZero_SLICE != AUTOCOMPLETE_beltIndexZero) {
            return;
    }

    let local_AUTOCOMPLETE_arrayFromItemListElement = AUTOCOMPLETE_arrayFromItemListElement;
    let local_AUTOCOMPLETE_arrayFromItemListElement_length = local_AUTOCOMPLETE_arrayFromItemListElement.length;

    let currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = AUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;
    let NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;

    let beltIndex = AUTOCOMPLETE_beltIndexZero;

    for (let i = 0; i < lspResult.items.length; i++) {
        let item = lspResult.items[i];
        let div = local_AUTOCOMPLETE_arrayFromItemListElement[beltIndex];
        beltIndex = (beltIndex + 1) % local_AUTOCOMPLETE_arrayFromItemListElement_length;
        div.className = '';
        div.textContent = item.label;

        // TODO: Reduce drawn width under some circumstance too
        if (item.label.length > NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING) {
            NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = item.label.length;
        }
    }

    if (NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING > currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING) {
        AUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;
        let widthAttributeValueNumber = Math.ceil((AUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING + 2/*padding*/) * EXPLORER_firstSpanWidthValue);

        // This is actually more complicated you have to track whether you go above the minimum requirement lest you add 1 character over and over in width just to keep redrawing widths.
        //if (widthAttributeValueNumber < this.lastReadNumber_offsetWidth) {
        //    widthAttributeValueNumber = this.lastReadNumber_offsetWidth;
        //}
        //this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING
        let widthAttributeValueString = widthAttributeValueNumber + 'px';

        let cursorElement = document.getElementById('AUTOCOMPLETE_cursor');
        if (cursorElement) {
            cursorElement.style.width = widthAttributeValueString;
        }

        for (let i = 0; i < local_AUTOCOMPLETE_arrayFromItemListElement_length; i++) {
            local_AUTOCOMPLETE_arrayFromItemListElement[i].style.width = widthAttributeValueString;
        }
    }
}

function AUTOCOMPLETE_render_do_hide() {
    const AUTOCOMPLETE = document.getElementById('AUTOCOMPLETE');
    if (AUTOCOMPLETE) {
        AUTOCOMPLETE_events_remove(AUTOCOMPLETE);
        AUTOCOMPLETE.remove();
        AUTOCOMPLETEElement = null;
    }

    AUTOCOMPLETE_exists = false;
}

function AUTOCOMPLETE_hide() {
    AUTOCOMPLETE_pending_lspResult = null;
    AUTOCOMPLETE_render_request(AUTOCOMPLETErenderKind_Hide);
}

function AUTOCOMPLETE_cursor_render_set() {
    if (!AUTOCOMPLETE_exists) return;
    
    let cursorElement = document.getElementById('AUTOCOMPLETE_cursor');

    // Determine the number without modifying styles so you can use this variable to determine the need to scroll into view without synchronous layout.
    let cursorTranslateYNumber = CONST_AUTOCOMPLETE_topPadding + (APP_lineHeight * AUTOCOMPLETE_cursorIndex);

    // Preferably this hasn't changed thus the function immediately just returns.
    if (AUTOCOMPLETE_rect_isNull)
        AUTOCOMPLETE_ensure_boundingClientRect();
    
    // If no UI modifications were made prior that are still pending this might avoid a synchronous layout.
    // TODO: If you touch the transform style first... I don't know what would happen it is a GPU related style... so I'm unsure.
    //
    if (cursorTranslateYNumber + (2 * APP_lineHeight) > AUTOCOMPLETE_scrollTop + AUTOCOMPLETE_rectHeight) {
        let currentBottom = AUTOCOMPLETE_scrollTop + AUTOCOMPLETE_rectHeight;
        let changeToMakeBottomTouch = cursorTranslateYNumber - currentBottom;
        let entireValueToScrollBy = changeToMakeBottomTouch + (2 * APP_lineHeight);
        AUTOCOMPLETEElement.scrollBy(0, entireValueToScrollBy);
    }
    else if (cursorTranslateYNumber < AUTOCOMPLETE_scrollTop) {
        AUTOCOMPLETEElement.scrollBy(0, cursorTranslateYNumber - AUTOCOMPLETE_scrollTop);
    }

    // transform last for optimal state flagging of the modified DOM element
    cursorElement.style.transform = `translateY(${cursorTranslateYNumber}px)`;
}

function AUTOCOMPLETE_cursor_do_set(cursorIndex) {
    AUTOCOMPLETE_cursorIndex = cursorIndex;
    AUTOCOMPLETE_render_request(AUTOCOMPLETErenderKind_CursorSet);
}

function AUTOCOMPLETE_cursor_validate(cursorIndex) {
    if (cursorIndex >= gINT_FIELDS[fAUTOCOMPLETE_items_totalLength]) {
        cursorIndex = gINT_FIELDS[fAUTOCOMPLETE_items_totalLength] - 1;
    }
    if (cursorIndex < 0) {
        cursorIndex = 0;
    }
    return cursorIndex;
}

function AUTOCOMPLETE_ensure_boundingClientRect() {
    if (AUTOCOMPLETE_rect_isNull && AUTOCOMPLETE_exists) {
        let rect = AUTOCOMPLETEElement.getBoundingClientRect();
        AUTOCOMPLETE_rectHeight = rect.height;
        AUTOCOMPLETE_rectLeft = rect.left;
        AUTOCOMPLETE_rectTop = rect.top;
        AUTOCOMPLETE_rect_isNull = false;
    }
}

function AUTOCOMPLETE_events_add(AUTOCOMPLETEElement) {
    AUTOCOMPLETEElement.addEventListener('keydown', AUTOCOMPLETE_events_onkeydown);
    AUTOCOMPLETEElement.addEventListener('scroll', AUTOCOMPLETE_events_scroll_receive, { passive: true });
    AUTOCOMPLETEElement.addEventListener('blur', AUTOCOMPLETE_events_blur_receive);
    window.addEventListener('resize', AUTOCOMPLETE_events_resize);
}

function AUTOCOMPLETE_events_remove(AUTOCOMPLETEElement) {
    AUTOCOMPLETEElement.removeEventListener('keydown', AUTOCOMPLETE_events_onkeydown);
    AUTOCOMPLETEElement.removeEventListener('scroll', AUTOCOMPLETE_events_scroll_receive, { passive: true });
    AUTOCOMPLETEElement.removeEventListener('blur', AUTOCOMPLETE_events_blur_receive);
    window.removeEventListener('resize', AUTOCOMPLETE_events_resize);
}

function AUTOCOMPLETE_events_resize() {
    AUTOCOMPLETE_rect_isNull = true;
}

function AUTOCOMPLETE_events_blur_receive() {
    AUTOCOMPLETE_hide();
}

function AUTOCOMPLETE_events_scroll_receive(event) {
    // it might be better as event.target.scrollTop or something... or????
    //
    // Something is still breaking
    // 
    AUTOCOMPLETE_scrollTop = AUTOCOMPLETEElement.scrollTop;
    AUTOCOMPLETE_render_request(AUTOCOMPLETErenderKind_Scroll);
}

function AUTOCOMPLETE_events_scroll_render(timestamp) {

    AUTOCOMPLETE_scrollEndDeadline = timestamp + 300;

    if (!AUTOCOMPLETE_isCheckingTrailingEdge) {
        AUTOCOMPLETE_isCheckingTrailingEdge = true;
        requestAnimationFrame(AUTOCOMPLETE_events_scroll_render_trailingEdgeCheck);
    }

    let prevVli = AUTOCOMPLETE_virtualIndex;
    // TODO: minus CONST_AUTOCOMPLETE_topPadding
    let currVli = Math.floor(AUTOCOMPLETE_scrollTop / APP_lineHeight);

    AUTOCOMPLETE_virtualIndex = currVli;

    let diff = currVli - prevVli;
    if (diff === 0) return;

    let lowerBound;
    let upperBound;
    let beltIndexLine;

    let local_AUTOCOMPLETE_arrayFromItemListElement = AUTOCOMPLETE_arrayFromItemListElement;
    let local_AUTOCOMPLETE_arrayFromItemListElement_length = local_AUTOCOMPLETE_arrayFromItemListElement.length;
    let local_AUTOCOMPLETE_items_totalLength = gINT_FIELDS[fAUTOCOMPLETE_items_totalLength];

    if (diff > 0 && diff < AUTOCOMPLETE_virtualCount) {
        lowerBound = prevVli + AUTOCOMPLETE_virtualCount;
        upperBound = lowerBound + diff;

        beltIndexLine = AUTOCOMPLETE_beltIndexZero;

        AUTOCOMPLETE_beltIndexZero = (beltIndexLine + diff) % local_AUTOCOMPLETE_arrayFromItemListElement_length;
    }
    else if (diff < 0 && ((diff *= -1) < AUTOCOMPLETE_virtualCount)) {
        lowerBound = currVli;
        upperBound = lowerBound + diff;

        // TODO: This can be simplified to a modulo operation.
        let lastIndex = AUTOCOMPLETE_beltIndexZero === 0
            ? local_AUTOCOMPLETE_arrayFromItemListElement_length - 1
            : AUTOCOMPLETE_beltIndexZero - 1;

        AUTOCOMPLETE_beltIndexZero = (lastIndex - (diff - 1) + local_AUTOCOMPLETE_arrayFromItemListElement_length) % local_AUTOCOMPLETE_arrayFromItemListElement_length;

        beltIndexLine = AUTOCOMPLETE_beltIndexZero;
    }
    else {
        lowerBound = currVli;
        upperBound = currVli + AUTOCOMPLETE_virtualCount;
        beltIndexLine = AUTOCOMPLETE_beltIndexZero;
    }

    let verticalOffset = CONST_AUTOCOMPLETE_topPadding + (lowerBound * APP_lineHeight);

    beltIndexLine--; // The 0th loop will increment somewhat awkwardly. This decrement avoids that.

    for (let i = lowerBound; i < upperBound; i++) {

        beltIndexLine = (beltIndexLine + 1) % local_AUTOCOMPLETE_arrayFromItemListElement_length;

        let div = local_AUTOCOMPLETE_arrayFromItemListElement[beltIndexLine];
        
        if (i >= local_AUTOCOMPLETE_items_totalLength) {
            div.textContent = '~';
        }
        else {
            div.className = 'eN';
            div.textContent = '...';
        }
        
        div.style.transform = `translateY(${verticalOffset}px)`;
        verticalOffset += APP_lineHeight;
    }
}

function AUTOCOMPLETE_events_scroll_render_trailingEdgeCheck(timestamp) {
    if (timestamp < AUTOCOMPLETE_scrollEndDeadline) {
        requestAnimationFrame(AUTOCOMPLETE_events_scroll_render_trailingEdgeCheck);
        return;
    }

    AUTOCOMPLETE_isCheckingTrailingEdge = false;
    AUTOCOMPLETE_events_scroll_render_trailingEdgeDo();
}

function AUTOCOMPLETE_events_scroll_render_trailingEdgeDo() {
    if (!AUTOCOMPLETE_scrollIsFetchingData) {
        AUTOCOMPLETE_sliceVirtualIndex_SLICE = AUTOCOMPLETE_virtualIndex;
        AUTOCOMPLETE_sliceVirtualCount_SLICE = AUTOCOMPLETE_virtualCount;
        AUTOCOMPLETE_sliceBeltIndexZero_SLICE = AUTOCOMPLETE_beltIndexZero;
        AUTOCOMPLETE_scrollIsFetchingData = true;
        window.myAPI.editorCompletionRequest_slice(AUTOCOMPLETE_virtualIndex, AUTOCOMPLETE_virtualIndex + AUTOCOMPLETE_virtualCount);
    }
}

function AUTOCOMPLETE_events_onkeydown(event) {
    // Goal is to just have it disappear 99% of the time you interact with it and pull back on a key by key basis in time.
    switch (event.key) {
        case 'Shift':
            // Shift felt especially awkward to hide on because I was trying to 'Shift' + mousewheel so I could horizontally scroll (there's a horizontal scrollbar currently)
            break;
        case 'ArrowDown':
            event.preventDefault();
            event.stopPropagation();
            AUTOCOMPLETE_cursor_do_set(
                AUTOCOMPLETE_cursor_validate(AUTOCOMPLETE_cursorIndex + 1));
            break;
        case 'ArrowUp':
            event.preventDefault();
            event.stopPropagation();
            AUTOCOMPLETE_cursor_do_set(
                AUTOCOMPLETE_cursor_validate(AUTOCOMPLETE_cursorIndex - 1));
            break;
        default:
            AUTOCOMPLETE_hide();
            if (EDI_baseElement) {
                EDI_baseElement.focus();
            }
            break;
    }
}
