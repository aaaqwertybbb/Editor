
/** File contains more than one class (noted only because it doesn't feel obvious that there would be more than one class, this note doesn't exist in every file) */

/** See the "interface TreeViewDirector" towards the bottom of this file */

const get_TREEVIEWrenderKind_None = () => 0;
const get_TREEVIEWrenderKind_Cursor = () => 1;
const get_TREEVIEWrenderKind_Create = () => 2;
const get_TREEVIEWrenderKind_Batch = () => 3;
const get_TREEVIEWrenderKind_Scroll = () => 4;
const get_TREEVIEWrenderKind_SetItems = () => 5;
const get_TREEVIEWrenderKind_FullReset = () => 6;
const get_TREEVIEWrenderKind_Scroll_PullDataDrawResult = () => 7;
const get_TREEVIEWrenderKind_Resize = () => 8;

/**
 * The director maintains a flat optimized list of every element i.e.: represent each element in a uint8array and each one is a byte that maps to the actual.
 * 
 * Then the actual can be a hierarchical datastructure.
 * 
 * You just keep flattening it into a byte array and map back and forth.
 */
class TreeViewComponent {
    constructor(itemHeight) {
        this.rootElement = document.createElement('div');
        this.rootElement.classList.add('TREEVIEW', 'unselectable');
        this.rootElement.tabIndex = 0;
        this.rootElement.style.height = '100%';

        this.virtualizationElement = document.createElement('div');
        this.virtualizationElement.className = 'TREEVIEW_virtualization';
        this.rootElement.appendChild(this.virtualizationElement);

        /** Consider the existence of such methods as 'state_cursor_setIndex' before mutating state directly */
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = 'TREEVIEW_cursor';
        this.rootElement.appendChild(this.cursorElement);

        this.itemListElement = document.createElement('div');
        this.itemListElement.className = 'TREEVIEW_itemList';
        this.rootElement.appendChild(this.itemListElement);

        this.itemHeightTotal = 0;

        /** Consider the existence of such methods as 'state_cursor_setIndex' before mutating state directly */
        this.cursorIndex = 0;

        this._ONSCROLLvirtualIndex = 0;
        this._ONSCROLLvirtualCount = 0;

        this.lastReadNumber_scrollLeft = 0;
        this.lastReadNumber_scrollTop = 0;
        
        this.scrollTimer = null;
        this.hasTrailingCall = false;

        this.beltIndexZero = 0;

        this.TREEVIEW_renderKindArray = [];
        this.TREEVIEW_isRenderPending = false;

        this.TREEVIEW_ArrayFrom_itemListElement_children = [];
        this.TREEVIEW_ArrayFrom_itemListElement_children_length = 0;

        this.TREEVIEW_draw_create_request_parentElement = null;
        this.TREEVIEW_draw_create_request_insertBeforeThisChild = null;

        this.start = 0;
        this.length = 0;
        this.onePositiveDiff_twoNegativeDiff_orThreeFullScreen = 0;
        this.caseThreeOrigin = 0;

        this.SET_ITEMS_director = null;
        this.SET_ITEMS_itemHeightNumber = 0;
        this.SET_ITEMS_itemHeightStyleAttributeValueString = '';

        this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 2;

        this.LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH = 0;
    }

    TREEVIEW_render_request(renderKind) {
        if (this.TREEVIEW_renderKindArray[this.TREEVIEW_renderKindArray.length - 1] !== renderKind) {
            this.TREEVIEW_renderKindArray.push(renderKind);
        }
        
        if (!this.TREEVIEW_isRenderPending) {
            this.TREEVIEW_isRenderPending = true;
            requestAnimationFrame(this.renderDo);
        }
    }

    renderDo = (timestamp) => {
        let renderKind;
        
        // Synchronously exhaust the item queue for this animation frame
        while (renderKind = this.TREEVIEW_renderKindArray.shift()) {
            switch (renderKind) {
                case get_TREEVIEWrenderKind_Cursor():
                    this.TREEVIEW_render_do_Cursor();
                    break;
                case get_TREEVIEWrenderKind_Create():
                    this.TREEVIEW_render_do_Create(timestamp);
                    break;
                case get_TREEVIEWrenderKind_Batch():
                    this.TREEVIEW_render_do_Batch(timestamp);
                    break;
                case get_TREEVIEWrenderKind_Scroll():
                    this.TREEVIEW_render_do_Scroll(timestamp);
                    break;
                case get_TREEVIEWrenderKind_Scroll_PullDataDrawResult():
                    this.TREEVIEW_render_do_Scroll_PullDataDrawResult();
                    break;
                case get_TREEVIEWrenderKind_SetItems():
                    this.TREEVIEW_render_do_SetItems();
                    break;
                case get_TREEVIEWrenderKind_FullReset():
                    this.TREEVIEW_render_do_FullReset(timestamp);
                    break;
                case get_TREEVIEWrenderKind_Resize():
                    this.TREEVIEW_render_do_Resize(timestamp);
                    break;
            }
        }
        
        this.TREEVIEW_isRenderPending = false; // Reset the paint lock
    };

    /**
     * TODO: Many of these suffer from two invocations sitting in the render queue with something between them so they didn't coallesce then the parameters
     * of the second are used for the first.
     */
    TREEVIEW_render_do_SetItems() {
        this.itemListElement.innerHTML = '';
        this.virtualizationElement.style.height = 1 + 'px';
        this.state_cursor_setIndex(0);
        
        this.director = this.SET_ITEMS_director;
        this.itemHeightNumber = this.SET_ITEMS_itemHeightNumber;
        this.itemHeightStyleAttributeValueString = this.SET_ITEMS_itemHeightStyleAttributeValueString;

        this.cursorElement.style.height = this.itemHeightStyleAttributeValueString;
        this.itemHeightTotal = this.director.tvd_getTotalCount() * this.itemHeightNumber;
        this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
        this.boundingClientRect = null;
    }

    /**
     * @param {*} director interface TreeViewDirectory { director.drawItem(divItem, indexItem), director.onkeydown(this.TREEVIEW_ArrayFrom_itemListElement_children[relativeIndex], this.cursorIndex, this.items[this.cursorIndex]); }
     * @param {*} itemHeightNumber '50'; cursorTop = currentIndex * itemHeightNumber;
     * @param {*} itemHeightStyleAttributeValueString '50px'; div.style.height = itemHeightStyleAttributeValueString;
     */
    setItems(director, itemHeightNumber, itemHeightStyleAttributeValueString) {
        this.SET_ITEMS_director = director;
        this.SET_ITEMS_itemHeightNumber = itemHeightNumber;
        this.SET_ITEMS_itemHeightStyleAttributeValueString = itemHeightStyleAttributeValueString;
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_SetItems());
    }

    TREEVIEW_render_do_Create(timestamp) {
        if (this.rootElement.parentElement) {
            // It is the case that I invoke 'draw_create_request' when creating the tree view for the first time.
            // But I also do this when I re-open the os input file dialog and pick either a separate or the same folder.
            // In this scenario having this invoke a "fullReset" is necessary otherwise nothing appears in the treeview.
            //
            // TODO: but, perhaps this is best left to the consumer of the TreeViewComponent to invoke themselves...
            // ...in such a scenario. Until further decision is made I'll have the invocation here.
            this.TREEVIEW_render_do_FullReset(timestamp);
            // TODO: Should there be a return here?...
            // ...more accurately the concern is 'TREEVIEW_draw_create_request_parentElement.insertBefore'
            // and 'this.draw_addEvents()'
            // |
            // Should those be in an else?
            // It reads as though you'd be inserting the element twice, which internally you cannot
            // have an HTML node with two parents so this probably doesn't duplicate the UI, but instead just wastes CPU.
            // |
            // The 'this.draw_addEvents();'... can you subscribe twice?
        }
        this.TREEVIEW_draw_create_request_parentElement.insertBefore(this.rootElement, this.TREEVIEW_draw_create_request_insertBeforeThisChild);
        this.draw_addEvents();


        this.rootElement.style.width = '';
        this.rootElement.style.height = '';
        this.rootElement.style.contain = '';

        this.measureBaseElement();

        this.TREEVIEW_render_do_Scroll(timestamp);
    }

    /**
     * if (this.rootElement.parentElement) { this.draw_render_fullReset_request(); return; }
     * Because the "list" is already drawn somewhere and 'draw_delete()' needs to be invoked prior to drawing at a different location.
     * 
     * @param {HTMLElement} parentElement 
     * @param {*} insertBeforeThisChild (if falsey, the list UI is appended to the parent element)
     */
    draw_create_request(parentElement, insertBeforeThisChild) {
        this.TREEVIEW_draw_create_request_parentElement = parentElement;
        this.TREEVIEW_draw_create_request_insertBeforeThisChild = insertBeforeThisChild;
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_Create());
    }

    TREEVIEW_render_do_Batch(timestamp) {
        this.director.tvd_drawItem_BATCH(this.start, this.length, this.onePositiveDiff_twoNegativeDiff_orThreeFullScreen, this.caseThreeOrigin, timestamp);
    }

    /**
     * if (!this.rootElement.parentElement) return;
     * Because the "list" is not drawn, no UI needs to be removed.
     * (the purpose of this method is more-so related to unsubscribing of events and other such non-automatic actions that need to be performed)
     * 
     * @returns 
     */
    draw_delete() {
        if (!this.rootElement.parentElement) return;
        this.draw_removeEvents();
        this.boundingClientRect = null;
        this.rootElement.parentElement.removeChild(this.rootElement);
    }

    draw_addEvents() {
        this.rootElement.addEventListener('click', this);
        this.rootElement.addEventListener('keydown', this);
        this.rootElement.addEventListener('scroll', this, { passive: true });
        this.rootElement.addEventListener('dblclick', this);
        this.rootElement.addEventListener('contextmenu', this);
        window.addEventListener('resize', this);
    }
    
    draw_removeEvents() {
        this.rootElement.removeEventListener('click', this);
        this.rootElement.removeEventListener('keydown', this);
        this.rootElement.removeEventListener('scroll', this, { passive: true });
        this.rootElement.addEventListener('dblclick', this);
        this.rootElement.addEventListener('contextmenu', this);
        window.removeEventListener('resize', this);
    }

    // The browser automatically looks for this exact method name
    handleEvent(event) {
        switch (event.type) {
            case 'click':
                this.event_click(event.clientY, event.target);
                break;
            case 'keydown':
                this.event_keydown(event);
                break;
            case 'scroll':
                this.event_scroll();
                break;
            case 'dblclick':
                this.event_dblclick(event.clientY, event.target);
                break;
            case 'contextmenu':
                this.event_contextmenu(event.button, event.clientX, event.clientY);
                break;
            case 'resize':
                this.event_windowResize();
                break;
        }
    }

    TREEVIEW_render_do_Scroll(timestamp) {
        if (this.TREEVIEW_ArrayFrom_itemListElement_children_length !== this.virtualCount) {
            this.TREEVIEW_render_do_FullReset(timestamp);
        }
        else {
            this.virtualIndex_ofScrollTop = Math.floor(this.lastReadNumber_scrollTop / this.itemHeightNumber);

            if (this._ONSCROLLvirtualIndex === this.virtualIndex_ofScrollTop &&
                this._ONSCROLLvirtualCount === this.virtualCount) {
                    return;
            }

            // If I delay setting 'this._ONSCROLLvirtualIndex' then I can just use that.
            // I can't bear to do that right now though. I'm just gonna make this variable.
            let prevVli = this._ONSCROLLvirtualIndex;
            let currVli = this.virtualIndex_ofScrollTop;

            this._ONSCROLLvirtualIndex = this.virtualIndex_ofScrollTop;

            if (this._ONSCROLLvirtualCount === this.virtualCount &&
                this.TREEVIEW_ArrayFrom_itemListElement_children_length === this.virtualCount) {

                let diff = currVli - prevVli;

                let totalCount = this.director.tvd_getTotalCount();

                if (diff > 0 && diff < this.virtualCount) {
                    this.director.tvd_drawItem_BATCH(prevVli + this._ONSCROLLvirtualCount, diff, 1, undefined, timestamp);
                }
                else if (diff < 0 && (diff *= -1) < this.virtualCount) {
                    this.director.tvd_drawItem_BATCH(currVli, diff, 2, undefined, timestamp);
                }
                else {
                    if (diff === 0) {
                        this.director.scrollEndDeadline = timestamp + 300;
                    }
                    else {
                        this.director.tvd_drawItem_BATCH(this.virtualIndex_ofScrollTop, this.virtualCount, 3, undefined, timestamp);
                    }
                }
            }
        }
    }

    TREEVIEW_render_do_Scroll_PullDataDrawResult() {
        if (this.director.tvd_drawItem_BATCH_PullDataDrawResult) {
            this.director.tvd_drawItem_BATCH_PullDataDrawResult();
        }
    }

    draw_BATCH_request(start, length, onePositiveDiff_twoNegativeDiff_orThreeFullScreen, caseThreeOrigin) {
        this.start = start;
        this.length = length;
        this.onePositiveDiff_twoNegativeDiff_orThreeFullScreen = onePositiveDiff_twoNegativeDiff_orThreeFullScreen;
        this.caseThreeOrigin = caseThreeOrigin;
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_Batch());
    }

    TREEVIEW_render_do_FullReset(timestamp) {
        this.ensure_boundingClientRect();

        this._ONSCROLLvirtualCount = this.virtualCount;

        this.virtualIndex_ofScrollTop = Math.floor(this.lastReadNumber_scrollTop / this.itemHeightNumber);
        this.beltIndexZero = 0;

        let totalCount = this.director.tvd_getTotalCount();

        if (this.itemListElement.children.length !== this.virtualCount) {
            this.itemListElement.innerHTML = '';

            // padding of 2ch (the style attribute receives the width as a pixel by using 'EXPLORER_firstSpanWidthValue' as a baseline (not quite ch))
            // TODO: this is all very inaccurate and prone to eventual rounding issues due to not monospace font.
            //
            this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 2;
            let widthAttributeValueNumber = Math.ceil((this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING + 2/*padding*/) * EXPLORER_firstSpanWidthValue);
            // This is actually more complicated you have to track whether you go above the minimum requirement lest you add 1 character over and over in width just to keep redrawing widths.
            //if (widthAttributeValueNumber < this.lastReadNumber_offsetWidth) {
            //    widthAttributeValueNumber = this.lastReadNumber_offsetWidth;
            //}
            //this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING
            let widthAttributeValueString = widthAttributeValueNumber + 'px';
            this.cursorElement.style.width = widthAttributeValueString;

            // this is zero'd, could use change for clarity of algorithm and match patterns but focus elsewhere first
            for (let i = 0; i < this.virtualCount; i++) {
                
                let divItem = document.createElement('div');
                divItem.style.width = widthAttributeValueString;
                divItem.style.height = this.itemHeightStyleAttributeValueString;
                divItem.style.whiteSpace = 'nowrap';
                divItem.style.position = 'absolute';
                this.itemListElement.appendChild(divItem);
                let iconSpan = document.createElement('span');
                iconSpan.style.width = EXPLORER_firstSpanWidth;
                iconSpan.style.display = 'inline-block';
                // TODO: Consider what differences if any exist between the '' iconSpan having an empty height of 0 when left unset, versus if you were to set it to 1px, does this matter? It doesn't seem to impact the "horizontal" space being taken.
                divItem.appendChild(iconSpan);
                divItem.appendChild(document.createTextNode(i));
            }
            
            // TODO: check the resize logic, that it works
            if (this.director.pullData_array) {
                this.director.pullData_array = new Uint32Array(this.virtualCount);
                this.director.pullData_array_count = 0;
            }

            this.TREEVIEW_ArrayFrom_itemListElement_children = Array.from(this.itemListElement.children);
            this.TREEVIEW_ArrayFrom_itemListElement_children_length = this.TREEVIEW_ArrayFrom_itemListElement_children.length;
        }

        // TODO: This if statement check is awkward because the previous if statement ought to have guaranteed this one to be true.
        if (this.itemListElement.children.length === this.virtualCount) {
            this.director.tvd_drawItem_BATCH(this.virtualIndex_ofScrollTop, this.virtualCount, 3, undefined, timestamp);
        }
    }

    /**
     * This actually only gets invoked if 'this.itemListElement.children.length !== this.virtualCount'...
     * ...But it is a bit more complicated if you want to involve a change to totalCount, you'd need to force the final 'else' case
     * so it is easier to just invoke this directly when you change totalCount?
     */
    draw_render_fullReset_request() {
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_FullReset());
    }

    /**
     * TODO: To detect whether the "expand/collapse icon" was clicked, the logic 'if(event.target === nodeElement.children[0])' is used...
     * ...this logic is flawed if one ever were to put an element within the span that became the target...
     * ...thus, you should consider checking the x position of the event against the x position of the nodeElement.children[0].
     * @param {*} event 
     */
    event_click(event_clientY, event_target) {
        this.ensure_boundingClientRect();

        let rY = event_clientY - this.boundingClientRect.top + this.lastReadNumber_scrollTop;
        let indexItem = Math.floor(rY / this.itemHeightNumber);
        indexItem = this.state_cursor_validateIndex(indexItem);

        // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexItem = ((indexItem)) - this.virtualIndex_ofScrollTop;
        if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
        else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

        if (beltIndexItem < 0) return;
        let divItem = this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem];

        if (event_target === divItem.children[0]) {
            return this.director.tvd_expandCollapseIconWasClicked_async(divItem, indexItem);
        }
        else {
            this.state_cursor_setIndex(indexItem);
        }
    }

    event_dblclick(event_clientY, event_target) {
        this.ensure_boundingClientRect();

        let rY = event_clientY - this.boundingClientRect.top + this.lastReadNumber_scrollTop;
        let indexItem = Math.floor(rY / this.itemHeightNumber);
        indexItem = this.state_cursor_validateIndex(indexItem);

        // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
        // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
        // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
        // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
        let beltIndexItem = ((indexItem)) - this.virtualIndex_ofScrollTop;
        if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
        else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

        if (beltIndexItem < 0) return;
        let divItem = this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem];

        // if not clicked "chevron"
        if (event_target !== divItem.children[0]) {
            // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
            if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
            else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

            if (beltIndexItem < 0) return;
            return this.director.tvd_ondblclick_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
        }
    }

    event_contextmenu(event_button, event_clientX, event_clientY) {
        this.ensure_boundingClientRect();

        if (event_button === 2) {
            let rY = event_clientY - this.boundingClientRect.top + this.lastReadNumber_scrollTop;

            this.state_cursor_setIndex(this.state_cursor_validateIndex(
                Math.floor(rY / this.itemHeightNumber)));

            // TODO: you need to move this above the divItem assignment and do checks earlier... double check all other uses

            // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
            if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
            else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

            if (beltIndexItem < 0) return;
            return this.director.tvd_oncontextmenu_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event_button, event_clientX, event_clientY, beltIndexItem);
        } else {
            if (this.cursorIndex >= this.director.tvd_getTotalCount()) {
                return;
            }

            this.state_cursor_setIndex(this.state_cursor_validateIndex(
                this.cursorIndex));

            // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
            // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
            // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
            // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
            let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
            if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
            else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

            if (beltIndexItem < 0) return;

            // TODO: Handle context menu with keyboard when active node is out of view
            return this.director.tvd_oncontextmenu_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event_button, event_clientX, event_clientY, beltIndexItem);
        }
    }

    event_keydown(event) {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (event.ctrlKey) {
                    this.rootElement.scrollBy(0, this.itemHeightNumber);
                }
                else {
                    this.state_cursor_setIndex(this.state_cursor_validateIndex(
                        this.cursorIndex + 1));
                }
                return;
            case 'ArrowUp':
                event.preventDefault();
                if (event.ctrlKey) {
                    this.rootElement.scrollBy(0, -1 * this.itemHeightNumber);
                }
                else {
                    this.state_cursor_setIndex(this.state_cursor_validateIndex(
                        this.cursorIndex - 1));
                }
                return;
            case 'ArrowRight':
                if (!event.ctrlKey) { // If holding ctrl, don't preventDefault so the user can scroll horizontally?
                    event.preventDefault();
                    this.state_cursor_setIndex(this.state_cursor_validateIndex(
                        this.cursorIndex));

                    // TODO: 'ArrowRight' when the cursor is on a valid item but isn't part of the virtualization result.

                    // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
                    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                    let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
                    if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
                    else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

                    if (beltIndexItem < 0) return;
                    return this.director.tvd_arrowRight_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
                }
                return;
            case 'ArrowLeft':
            	if (!event.ctrlKey) { // If holding ctrl, don't preventDefault so the user can scroll horizontally?
                    event.preventDefault();
                    this.state_cursor_setIndex(this.state_cursor_validateIndex(
                        this.cursorIndex));
                    
                    // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
                    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                    let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
                    if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
                    else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

                    if (beltIndexItem < 0) return;
                    return this.director.tvd_arrowLeft_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
                }
            	return;
            case ' ':
            case 'Enter':
                event.preventDefault();
                this.state_cursor_setIndex(this.state_cursor_validateIndex(
                    this.cursorIndex));
                
                // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
                // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
                // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
                // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
                let beltIndexItem = ((this.cursorIndex)) - this.virtualIndex_ofScrollTop;
                if (beltIndexItem >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndexItem < 0) beltIndexItem = -1;
                else beltIndexItem = (beltIndexItem + this.beltIndexZero) % this.virtualCount;

                if (beltIndexItem < 0) return;
                return this.director.tvd_onkeydown_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event.key);
        }
    }

    TREEVIEW_render_do_Resize(timestamp) {
        this.rootElement.style.width = '';
        this.rootElement.style.height = '';
        this.rootElement.style.contain = '';

        this.measureBaseElement();

        this.boundingClientRect = null;
        this.ensure_boundingClientRect();
        this.TREEVIEW_render_do_FullReset(timestamp);
    }

    /**
     * TODO: intra-app resizes or movements will also invoke this; i.e.: if a list is shown in a dialog and the dialog is resized or moved.
     */
    event_windowResize() {
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_Resize());
    }

    event_scroll() {
        this.lastReadNumber_scrollLeft = this.rootElement.scrollLeft;
        this.lastReadNumber_scrollTop = this.rootElement.scrollTop;
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_Scroll());
    }

    ensure_boundingClientRect() {
        if (!this.boundingClientRect) {
            this.boundingClientRect = this.rootElement.getBoundingClientRect();
            this.virtualCount = Math.ceil(this.rootElement.offsetHeight / this.itemHeightNumber);
        }
    }

    TREEVIEW_render_do_Cursor(index) {
        // Determine the number without modifying styles so you can use this variable to determine the need to scroll into view without synchronous layout.
        this.cursorTranslateYNumber = this.cursorIndex * this.itemHeightNumber;

        // Preferably this hasn't changed thus the function immediately just returns.
        this.ensure_boundingClientRect();
        
        // If no UI modifications were made prior that are still pending this might avoid a synchronous layout.
        // TODO: If you touch the transform style first... I don't know what would happen it is a GPU related style... so I'm unsure.
        //
        if (this.cursorTranslateYNumber + (2 * this.itemHeightNumber) > this.lastReadNumber_scrollTop + this.boundingClientRect.height) {
            let currentBottom = this.lastReadNumber_scrollTop + this.boundingClientRect.height;
            let changeToMakeBottomTouch = this.cursorTranslateYNumber - currentBottom;
            let entireValueToScrollBy = changeToMakeBottomTouch + (2 * this.itemHeightNumber);
            this.rootElement.scrollBy(0, entireValueToScrollBy);
        }
        else if (this.cursorTranslateYNumber < this.lastReadNumber_scrollTop) {
            this.rootElement.scrollBy(0, this.cursorTranslateYNumber - this.lastReadNumber_scrollTop);
        }

        // transform last for optimal state flagging of the modified DOM element
        this.cursorElement.style.transform = `translateY(${this.cursorTranslateYNumber}px)`;
    }

    /**
     * if (this.cursorIndex === index) return;
     * 
     * @param {*} index 
     */
    state_cursor_setIndex(index) {
        if (this.cursorIndex === index) return;
        this.cursorIndex = index;
        this.TREEVIEW_render_request(get_TREEVIEWrenderKind_Cursor());
    }

    /**
     * if (this.cursorIndex === index) return;
     * 
     * @param {*} indexItem 
     */
    state_cursor_validateIndex(indexItem) {
        if (indexItem >= this.director.tvd_getTotalCount()) {
            indexItem = this.director.tvd_getTotalCount() - 1;
        }
        if (indexItem < 0) {
            indexItem = 0;
        }
        return indexItem;
    }

    /**
     * This logic according to what I understand Google AI to be saying, is very bad (I gave it the version that the Editor has).
     * 
     * I don't fully agree with the AI on this for a few reasons.
     * And I'm not entirely adverse to removing this logic.
     * But a main reason for why I don't agree with the AI is that I don't fully understand things.
     * And the only way for me to fully understand things is to mess around with this a bit more and see what happens.
     * So I can hopefully glean some insight and better understand what the AI is saying.
     * 
     * I want to list out my points for doing this, I have a limited amount of energy each day
     * and I have a lot to do involving measuring the longest line of text and setting all divs to that width
     * so I might find it in me to list my point of view today.
     * Maybe if I don't find it in me today I will tomorrow etc...
     * 
     * My point of view:
     * - I think I agree that making the width and height a whole number is pointless.
     * - And that getBoundingClientRect is more accurate so I should be using that, since I'd incur layout cost regardless if it was needed when accessing any offset... properties.
     * - But, I have absolute positioned elements and A LOT of them.
     * - By marking the base element as "contain = 'layout'" I believe I am explicitly telling the browser to ignore all of my "z axis layers" or layers made by using position absolute.
     *   i.e.: that they will NEVER impact the UI that exists outside of the base element.
     *   and that this is beneficial.
     * - As well by making the size explicitly defined I am permitting the use of "contain = 'layout'" without that you wouldn't have a width or height of the base element I believe.
     *   because otherwise the children could cause a change in width and impact the surrounding UI which you just said explicitly won't happen.
     * - The final statements that read the offsetWidth and height after having set them is a guaranteed synchronous layout,
     *   but this only happens oninit or when resizing, vs the constant changes happening while I scroll explicitly stating that nothing else will be impacted each event.
     * 
     * And I am very open to the idea that I'm wrong.
     * But I don't understand the AI's point of view and I'm not going to blindly copy what it says.
     * I am instead just aware that this might be wrong and I'm looking for some indications to learn from and observe.
     * 
     * I read the property back just incase some weird interaction (perhaps DPI?) causes the number I set to not actually be the end result number that is used
     * for the attribute value.
     */
    measureBaseElement() {
        this.lastReadNumber_offsetWidth = Math.floor(this.rootElement.offsetWidth);
        this.lastReadNumber_offsetHeight = Math.floor(this.rootElement.offsetHeight);
        
        this.rootElement.style.width = this.lastReadNumber_offsetWidth + 'px';
        this.rootElement.style.height = this.lastReadNumber_offsetHeight + 'px';

        this.rootElement.style.contain = 'layout';

        this.lastReadNumber_offsetWidth = this.rootElement.offsetWidth;
        this.lastReadNumber_offsetHeight = this.rootElement.offsetHeight;
    }

    /*
    TODO: The TreeView after you resize it, you can continually scroll down and it keeps replacing more and more '~' lines
          even if you've scrolled through everything already.
          This is probably some kind of rounding error?
          It porbably happens regardless of whether you resized
          and more-so that you just happen to have hit the perfect height for it to happen?
    */
}

const get_TreeViewNodeKind_None = () => 0;
const get_TreeViewNodeKind_isExpandable_isExpanded = () => 1;
const get_TreeViewNodeKind_isExpandable_NOTisExpanded = () => 2;
const get_TreeViewNodeKind_NOTisExpandable_isExpanded = () => 3;
const get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded = () => 4;

class TreeViewNodeList {
    data_literal;
    capacity_literal;

    capacity_abstract;
    count_abstract = 0;

    // Storing the nodeKind as an int32 isn't the most ideal thing in the world.
    // Previously the ints were being grouped via a class instance.
    // So this still ought to be better than what was done previously.
    field_count = 3;
    // this.nodeKind = nodeKind;
    // this.key = key;
    // this.depth = depth;

    nodeKind_offset = 0;
    key_offset = 1;
    depth_offset = 2;

    constructor(initialCapacity_abstract) {
        let temp_capacity_literal = initialCapacity_abstract * this.field_count;

        this.data_literal = new Uint32Array(temp_capacity_literal);
        this.capacity_abstract = initialCapacity_abstract;
        this.capacity_literal = temp_capacity_literal;

        this.count_abstract = 0;
    }

    /**
     * Does not clear the information, only sets 'this.count' to '0'.
     */
    clear() {
        this.count_abstract = 0;
    }

    /**
     * TODO: Rename all of these because you're actually reading the data into a global variable and this name replicates an API that returns a value so it is confusing.
     * 
     * @param {TreeViewNode} trackedSyntax a place to read the data into, since it is stored as just int32 data (not the class)
     * @returns {TrackedSyntax}
     */
    getElementAt(index_abstract) {
        let index_literal = index_abstract * this.field_count;
        TreeView_pooledNode_nodeKind = this.data_literal[index_literal + this.nodeKind_offset];
        TreeView_pooledNode_key = this.data_literal[index_literal + this.key_offset];
        TreeView_pooledNode_depth = this.data_literal[index_literal + this.depth_offset];
    }

    getKey(index_abstract) {
        return this.data_literal[(index_abstract * this.field_count) + this.key_offset];
    }

    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} key 
     */
    setKey(index_abstract, key) {
        this.data_literal[(index_abstract * this.field_count) + this.key_offset] = key;
    }
    
    getDepth(index_abstract) {
        return this.data_literal[(index_abstract * this.field_count) + this.depth_offset];
    }
    
    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} depth 
     */
    setDepth(index_abstract, depth) {
        this.data_literal[(index_abstract * this.field_count) + this.depth_offset] = depth;
    }
    
    /**
     * TODO: This function has the 'index_abstract' as the first parameter,
     * meanwhile 'getElementAt(...)' takes this as second parameter.
     * A decision on a consistent position needs to be made.
     * @param {number} index_abstract 
     * @param {number} nodeKind 
     */
    setNodeKind(index_abstract, nodeKind) {
        this.data_literal[(index_abstract * this.field_count) + this.nodeKind_offset] = nodeKind;
    }

    insert(index_abstract, nodeKind, key, depth) {
        this.ensureCapacityForInsertion(index_abstract, 1);

        let index_literal = index_abstract * this.field_count;

        if (index_abstract !== this.count_abstract) {
            this.copyTo(this.data_literal, index_abstract, this.data_literal, index_abstract + 1, this.count_abstract - index_abstract);
        }

        this.data_literal[index_literal + this.nodeKind_offset] = nodeKind;
        this.data_literal[index_literal + this.key_offset] = key;
        this.data_literal[index_literal + this.depth_offset] = depth;

        this.count_abstract++;
    }

    /**
     * Does not clear trailing information.
     * 
     * count === 0 immediately returns
     */
    removeAt(index_abstract, count_abstract) {

        if (index_abstract > this.count_abstract) { throw new Error('removeAt(...): index_abstract > this.count_abstract'); }
        if (index_abstract + count_abstract > this.count_abstract) { throw new Error('removeAt(...): index_abstract + count_abstract > this.count_abstract'); }
        if (count_abstract === 0) { return; }

        if (index_abstract + count_abstract === this.count_abstract) {
            let shiftableCount_abstract = this.count_abstract - (index_abstract + count_abstract);
            if (shiftableCount_abstract > 0) {
                this.copyTo(
                    this.data_literal,
                    index_abstract + count_abstract,
                    this.data_literal,
                    index_abstract,
                    shiftableCount_abstract);
            }
        }
        else {
            this.copyTo(
                this.data_literal,
                index_abstract + count_abstract,
                this.data_literal,
                index_abstract,
                this.count_abstract - (index_abstract + count_abstract));
        }

        this.count_abstract -= count_abstract;
    }

    /**
     * - If the size asked for cannot be allocated, an exception will be thrown. (presumably the wording "thrown by the runtime" is involved.)
     * - JavaScript numbers do not wrap around to negative values when the value is very large.
     *       They instead approach infinity and lose precision.
     *       - There still is a check for whether the new, expected to be larger, capacity is smaller for whatever reason.
     *         Since this ought to be a negligible check for this method to perform.
     *         And failure to catch that case if it happens is an infinite loop.
     */
    ensureCapacityForInsertion(index_abstract, count_abstract) {
        let capacityPrevious_abstract = this.capacity_abstract;
        while (true) {
            if (this.count_abstract + count_abstract > this.capacity_abstract) {
                this.doubleCapacity();
            }
            else if (index_abstract >= this.capacity_abstract) {
                this.doubleCapacity();
            }
            else {
                break;
            }

            if (this.capacity_abstract === capacityPrevious_abstract) {
                break;
            }
            if (this.capacity_abstract < capacityPrevious_abstract) {
                throw new Error('ensureCapacityForInsertion(...): this.capacity_abstract < capacityPrevious_abstract');
            }

            capacityPrevious_abstract = this.capacity_abstract;
        }
    }

    doubleCapacity() {
        let capacityNew_literal = this.capacity_literal * 2;
        let dataNew_literal = new Uint32Array(capacityNew_literal);
        this.copyTo(this.data_literal, 0, dataNew_literal, 0, this.count_abstract);
        this.data_literal = dataNew_literal;
        this.capacity_literal = capacityNew_literal;
        this.capacity_abstract *= 2;
    }

    /**
     * inclusive/exclusive
     */
    copyTo(dataSource_literal, sourceStart_abstract, dataDestination_literal, destinationStart_abstract, length_abstract) {

        if (dataSource_literal === dataDestination_literal) {
            if (dataSource_literal !== this.data_literal) {
                throw new Error('dataSource_literal === dataDestination_literal ; but dataSource_literal !== this.data_literal');
            }

            // TODO: use 'copyWithin' method here and other such locations

            let distance_abstract = destinationStart_abstract - sourceStart_abstract;

            if (distance_abstract > 0) {
                for (var i_abstract = sourceStart_abstract + length_abstract - 1; i_abstract >= sourceStart_abstract; i_abstract--) {
                    let iplusd_abstract = i_abstract + distance_abstract;
                    let iplusd_literal = iplusd_abstract * this.field_count;
                    let i_literal = i_abstract * this.field_count;
                    this.data_literal[iplusd_literal + this.nodeKind_offset] = this.data_literal[i_literal + this.nodeKind_offset];
                    this.data_literal[iplusd_literal + this.key_offset] = this.data_literal[i_literal + this.key_offset];
                    this.data_literal[iplusd_literal + this.depth_offset] = this.data_literal[i_literal + this.depth_offset];
                }
            }
            else {
                for (var i_abstract = destinationStart_abstract; i_abstract < this.count_abstract; i_abstract++) {
                    let iminusd_abstract = i_abstract - distance_abstract;
                    let iminusd_literal = iminusd_abstract * this.field_count;
                    let i_literal = i_abstract * this.field_count;
                    this.data_literal[i_literal + this.nodeKind_offset] = this.data_literal[iminusd_literal + this.nodeKind_offset];
                    this.data_literal[i_literal + this.key_offset] = this.data_literal[iminusd_literal + this.key_offset];
                    this.data_literal[i_literal + this.depth_offset] = this.data_literal[iminusd_literal + this.depth_offset];
                }
            }
        }
        else {
            // TODO: use 'set' method here and other such locations
            for (var i_abstract = 0; i_abstract < length_abstract; i_abstract++) {
                let dSplusi_abstract = destinationStart_abstract + i_abstract;
                let dSplusi_literal = dSplusi_abstract * this.field_count;
                let sSplusi_abstract = sourceStart_abstract + i_abstract;
                let sSplusi_literal = sSplusi_abstract * this.field_count;
                dataDestination_literal[dSplusi_literal + this.nodeKind_offset] = dataSource_literal[sSplusi_literal + this.nodeKind_offset];
                dataDestination_literal[dSplusi_literal + this.key_offset] = dataSource_literal[sSplusi_literal + this.key_offset];
                dataDestination_literal[dSplusi_literal + this.depth_offset] = dataSource_literal[sSplusi_literal + this.depth_offset];
            }
        }
    }
}

let TreeView_pooledNode_nodeKind = get_TreeViewNodeKind_None();
let TreeView_pooledNode_key = 0;
let TreeView_pooledNode_depth = 0;
