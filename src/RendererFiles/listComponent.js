const get_LISTrenderKind_None = () => 0;
const get_LISTrenderKind_Cursor = () => 1;

class ListComponent {
    constructor() {
        /** @type {HTMLDivElement} */
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'LIST_moveChildNodes';
        this.rootElement.tabIndex = 0;
        this.rootElement.style.height = '100%';

        /** @type {HTMLDivElement} */
        this.virtualizationElement = document.createElement('div');
        this.virtualizationElement.className = 'LIST_moveChildNodes_virtualization';
        this.rootElement.appendChild(this.virtualizationElement);

        /**
         * @type {HTMLDivElement}
         * Consider the existence of such methods as 'state_cursor_setIndex' before mutating state directly
         */
        this.cursorElement = document.createElement('div');
        this.cursorElement.className = 'LIST_moveChildNodes_cursor';
        this.rootElement.appendChild(this.cursorElement);

        /** @type {HTMLDivElement} */
        this.itemListElement = document.createElement('div');
        this.itemListElement.className = 'LIST_moveChildNodes_itemList';
        this.rootElement.appendChild(this.itemListElement);

        /** @type {number} */ this.itemHeightTotal = 0;

        /**
         * @type {number}
         * Consider the existence of such methods as 'state_cursor_setIndex' before mutating state directly
         */
        this.cursorIndex = 0;

        /** @type {number} */ this._ONSCROLLscrollTop = 0;
        /** @type {number} */ this._ONSCROLLvirtualIndex = 0;
        /** @type {number} */ this._ONSCROLLvirtualCount = 0;
        
        //this.event_scroll_timer = null;
        ///** @type {boolean} */ this.event_scroll_bool = false;
        this.scrollTimer = null;
        this.hasTrailingCall = false;
        this.rAFTimer = null;

        /** @type {number} */ this.beltIndexZero = 0;

        this.LIST_renderKindArray = [];
        this.LIST_isRenderPending = false;

        this.LIST_ArrayFrom_menuOptionList_children = [];
    }

    LIST_render_request(renderKind) {
        if (this.LIST_renderKindArray[this.LIST_renderKindArray.length - 1] !== renderKind) {
            this.LIST_renderKindArray.push(renderKind);
        }
        
        if (!this.LIST_isRenderPending) {
            this.LIST_isRenderPending = true;
            requestAnimationFrame(this.renderDo);
        }
    }

    renderDo = () => {
        let renderKind;
        
        // Synchronously exhaust the item queue for this animation frame
        while (renderKind = this.LIST_renderKindArray.shift()) {
            switch (renderKind) {
                case get_LISTrenderKind_Cursor():
                    this.LIST_render_do_Cursor();
                    break;
            }
        }
        
        this.LIST_isRenderPending = false; // Reset the paint lock
    };

    /**
     * @param {*} itemHeightNumber '50'; cursorTop = currentIndex * itemHeightNumber;
     * @param {*} itemHeightStyleAttributeValueString '50px'; div.style.height = itemHeightStyleAttributeValueString;
     * @param {*} drawItemAction receives the div that represents the individual item in the list, the index of the item OR -1 to indicate the function should clear the div because there is no entry at that location (need to handle null item due to when viewport isn't filled). This div is empty, and you can do "whatever you want to it" provided the height stays consistent.
     * @param {*} onkeydownAction receives the div that represents the individual item in the list, the index of the item OR -1 to indicate there is no entry at that location.
     * @param {*} getItemsCountFunc returns the total count of items
     */
    setItems(itemHeightNumber, itemHeightStyleAttributeValueString, drawItemAction, onkeydownAction, getItemsCountFunc) {
        this.itemListElement.innerHTML = '';
        this.virtualizationElement.style.height = 1 + 'px';
        this.state_cursor_setIndex(0);

        this.itemHeightNumber = itemHeightNumber;
        this.itemHeightStyleAttributeValueString = itemHeightStyleAttributeValueString;
        /** receives the div that represents the individual item in the list, the index of the item, and the item itself. This div is empty, and you can do "whatever you want to it" provided the height stays consistent. */
        this.drawItemAction = drawItemAction;
        /** receives the div that represents the individual item in the list, the index of the item, and the item itself. */
        this.onkeydownAction = onkeydownAction;

        this.cursorElement.style.height = this.itemHeightStyleAttributeValueString;
        this.getItemsCountFunc = getItemsCountFunc;
        this.itemHeightTotal = this.getItemsCountFunc() * this.itemHeightNumber;
        this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
        this.boundingClientRect = null;
    }

    /**
     * if (this.rootElement.parentElement) return;
     * Because the "list" is already drawn somewhere and 'draw_delete()' needs to be invoked prior to drawing at a different location.
     * 
     * @param {HTMLElement} parentElement 
     * @param {*} insertBeforeThisChild (if falsey, the list UI is appended to the parent element)
     */
    draw_create(parentElement, insertBeforeThisChild) {
        if (this.rootElement.parentElement) return;
        parentElement.insertBefore(this.rootElement, insertBeforeThisChild);
        this.draw_addEvents();
        this.draw_render();
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
        this.rootElement.addEventListener('scroll', this);
        window.addEventListener('resize', this);
    }
    
    draw_removeEvents() {
        this.rootElement.removeEventListener('click', this);
        this.rootElement.removeEventListener('keydown', this);
        this.rootElement.removeEventListener('scroll', this);
        window.removeEventListener('resize', this);
    }

    // The browser automatically looks for this exact method name
    handleEvent(event) {
        switch (event.type) {
            case 'click':
                this.event_click(event);
                break;
            case 'keydown':
                this.event_keydown(event);
                break;
            case 'scroll':
                this.event_scroll_WRAPIT();
                break;
            case 'resize':
                this.event_windowResize();
                break;
        }
    }

    draw_render() {
        if (!this.boundingClientRect) {
            this.ensure_boundingClientRect();
        }

        if (this.itemListElement.children.length !== this.virtualCount) {
            this.draw_render_fullReset();
        }
        else {
            this.virtualIndex_ofScrollTop = Math.floor(this.rootElement.scrollTop / this.itemHeightNumber);

            if (this._ONSCROLLscrollTop === this.rootElement.scrollTop &&
                this._ONSCROLLvirtualIndex === this.virtualIndex_ofScrollTop &&
                this._ONSCROLLvirtualCount === this.virtualCount) {
                    return;
            }

            this._ONSCROLLscrollTop = this.rootElement.scrollTop;

            // If I delay setting 'this._ONSCROLLvirtualIndex' then I can just use that.
            // I can't bear to do that right now though. I'm just gonna make this variable.
            let prevVli = this._ONSCROLLvirtualIndex;
            let currVli = this.virtualIndex_ofScrollTop;

            this._ONSCROLLvirtualIndex = this.virtualIndex_ofScrollTop;

            if (this._ONSCROLLvirtualCount === this.virtualCount &&
                this.itemListElement.children.length === this.virtualCount) {

                // The same count of lines is on the UI so you can probably
                // redraw them one by one and save "some" of the existing HTML.

                let diff = currVli - prevVli;

                if (diff > 0 && diff < this.virtualCount) {
                    
                    let firstIndexLineThatWasNotAlreadyRendered = prevVli + this._ONSCROLLvirtualCount;
                    let itemsCount = this.getItemsCountFunc();
                    let vertical = (prevVli + this._ONSCROLLvirtualCount) * this.itemHeightNumber;
                    let origin = this.beltIndexZero;

                    this.beltIndexZero = origin + diff;
                    if (this.beltIndexZero >= this.itemListElement.children.length) {
                        this.beltIndexZero -= this.itemListElement.children.length;
                    }

                    for (var i = 0; i < diff; i++) {
                        let indexItem = prevVli + this._ONSCROLLvirtualCount + i;

                        let beltIndexItem = origin + i;
                        if (beltIndexItem >= this.itemListElement.children.length) {
                            beltIndexItem -= this.itemListElement.children.length;
                        }

                        let divItem = this.itemListElement.children[beltIndexItem];
                        
                        divItem.style.transform = `translateY(${vertical}px)`;
                        vertical += this.itemHeightNumber;

                        if (indexItem >= itemsCount)
                            this.drawItemAction(divItem, -1);
                        else
                            this.drawItemAction(divItem, indexItem);
                    }
                }
                else if (diff < 0 && (diff *= -1) < this.virtualCount) {

                    // move the final lines to the start
                    // move large lines to start of list with the content changed

                    let itemsCount = this.getItemsCountFunc();

                    let lastIndex;
                    if (this.beltIndexZero === 0) {
                        lastIndex = this.itemListElement.children.length - 1;
                    }
                    else {
                        lastIndex = this.beltIndexZero - 1;
                    }
                    this.beltIndexZero = lastIndex - (diff - 1);

                    if (this.beltIndexZero < 0) {
                        this.beltIndexZero += this.itemListElement.children.length;
                    }

                    let vertical = (currVli + (diff - 1)) * this.itemHeightNumber;
                    
                    for (var i = 0; i < diff; i++) {
                        let indexItem = currVli + i;
                        
                        let divItem = this.itemListElement.children[lastIndex--];
                        if (lastIndex <= -1) {
                            lastIndex = this.itemListElement.children.length - 1;
                        }

                        divItem.style.transform = `translateY(${vertical}px)`;
                        vertical -= this.itemHeightNumber;

                        if (indexItem >= itemsCount)
                            this.drawItemAction(divItem, -1);
                        else
                            this.drawItemAction(divItem, indexItem);
                    }
                }
                else {
                    // re-use the divs, but keep them in place and redraw over them all

                    let itemsCount = this.getItemsCountFunc();
                    let vertical = this.virtualIndex_ofScrollTop * this.itemHeightNumber;
                    let origin = this.beltIndexZero;
                    
                    for (var i = 0; i < this.virtualCount; i++) {
                        let indexItem = i + this.virtualIndex_ofScrollTop;

                        let beltIndexItem = origin + i;
                        if (beltIndexItem >= this.itemListElement.children.length) {
                            beltIndexItem -= this.itemListElement.children.length;
                        }

                        let divItem = this.itemListElement.children[beltIndexItem];

                        divItem.style.transform = `translateY(${vertical}px)`;
                        vertical += this.itemHeightNumber;

                        if (indexItem >= itemsCount)
                            this.drawItemAction(divItem, -1);
                        else
                            this.drawItemAction(divItem, indexItem);
                    }
                }
            }
        }
    }

    draw_render_fullReset() {
        this._ONSCROLLvirtualCount = this.virtualCount;
        this.itemListElement.innerHTML = '';
        this.virtualIndex_ofScrollTop = Math.floor(this.rootElement.scrollTop / this.itemHeightNumber);
        this.beltIndexZero = 0;

        let itemsCount = this.getItemsCountFunc();
        let vertical = this.virtualIndex_ofScrollTop * this.itemHeightNumber;

        for (let i = 0; i < this.virtualCount; i++) {
            // TODO: you don't break you still populate and then drawItemAction handles a null case?
            if (this.virtualIndex_ofScrollTop + i >= itemsCount) {
                break;
            }
            let divItem = document.createElement('div');
            divItem.style.height = this.itemHeightStyleAttributeValueString;
            divItem.style.position = 'absolute';
            divItem.style.transform = `translateY(${vertical}px)`;
            vertical += this.itemHeightNumber;
            divItem.textContent = i;
            this.itemListElement.appendChild(divItem);
            this.drawItemAction(divItem, this.virtualIndex_ofScrollTop + i);
        }
    }

    event_click(event) {
        this.ensure_boundingClientRect();

        let rY = event.clientY - this.boundingClientRect.top + this.rootElement.scrollTop;
        let index = Math.floor(rY / this.itemHeightNumber);
        index = this.state_cursor_validateIndex(index);
        this.state_cursor_setIndex(index);
    }
    
    event_keydown(event) {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.state_cursor_setIndex(
                    this.state_cursor_validateIndex(this.cursorIndex + 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.state_cursor_setIndex(
                    this.state_cursor_validateIndex(this.cursorIndex - 1));
                break;
            case ' ':
                event.preventDefault();
                this.state_cursor_setIndex(
                    this.state_cursor_validateIndex(this.cursorIndex));
                let virtualIndex_ofEvent = this.cursorIndex - this.virtualIndex_ofScrollTop;
                if (virtualIndex_ofEvent >= 0 && virtualIndex_ofEvent < this.itemListElement.children.length) { // check if is in virtualization space
                    virtualIndex_ofEvent += this.beltIndexZero; // then map the "virtualIndex_ofEvent" by the origin aka:'this.beltIndexZero'... i.e.: which line in the dom is the first line from the top of the screen down.
                    if (virtualIndex_ofEvent >= this.itemListElement.children.length) {
                        virtualIndex_ofEvent -= this.itemListElement.children.length;
                    }
                    this.onkeydownAction(this.itemListElement.children[virtualIndex_ofEvent], this.cursorIndex);
                }
                break;
        }
    }

    /**
     * intra-app resizes or movements will also invoke this; i.e.: if a list is shown in a dialog and the dialog is resized or moved.
     */
    event_windowResize() {
        this.boundingClientRect = null;
    }

    // 1. The Entry Point (Replaces WRAPIT)
    event_scroll_WRAPIT() {
        // If a frame is already scheduled, do nothing (drops intermediate inputs)
        if (this.rAFTimer) {
            return;
        }

        // Schedule the sync work to happen right before the next browser paint
        this.rAFTimer = requestAnimationFrame(() => {
            this.event_scroll();
            
            // Clear the gate AFTER the work is done so the next event can schedule
            this.rAFTimer = null;
        });
    }
    
    event_scroll() {
        this.draw_render();
    }

    ensure_boundingClientRect() {
        if (!this.boundingClientRect) {
            this.boundingClientRect = this.rootElement.getBoundingClientRect();
            this.virtualCount = Math.ceil(this.rootElement.offsetHeight / this.itemHeightNumber);
        }
    }

    LIST_render_do_Cursor() {
        // Determine the number without modifying styles so you can use this variable to determine the need to scroll into view without synchronous layout.
        this.cursorTopNumber = this.cursorIndex * this.itemHeightNumber;

        // Preferably this hasn't changed thus the function immediately just returns.
        this.ensure_boundingClientRect();

        // If no UI modifications were made prior that are still pending this might avoid a synchronous layout.
        // TODO: If you touch the transform style first... I don't know what would happen it is a GPU related style... so I'm unsure.
        //
        if (this.cursorTopNumber + (2 * this.itemHeightNumber) > this.rootElement.scrollTop + this.boundingClientRect.height) {
            let currentBottom = this.rootElement.scrollTop + this.boundingClientRect.height;
            let changeToMakeBottomTouch = this.cursorTopNumber - currentBottom;
            let entireValueToScrollBy = changeToMakeBottomTouch + (2 * this.itemHeightNumber);
            this.rootElement.scrollBy(0, entireValueToScrollBy);
        }
        else if (this.cursorTopNumber < this.rootElement.scrollTop) {
            this.rootElement.scrollBy(0, this.cursorTopNumber - this.rootElement.scrollTop);
        }

        this.cursorElement.style.top = this.cursorTopNumber + 'px';
    }

    /**
     * if (this.cursorIndex === index) return;
     * 
     * @param {*} indexItem 
     */
    state_cursor_setIndex(indexItem) {
        if (this.cursorIndex === indexItem) return;
        this.cursorIndex = indexItem;
        this.LIST_render_request(get_LISTrenderKind_Cursor());
    }

    /**
     * if (this.cursorIndex === index) return;
     * 
     * @param {*} indexItem 
     */
    state_cursor_validateIndex(indexItem) {
        let itemsCount = this.getItemsCountFunc();
        if (indexItem >= itemsCount) {
            indexItem = itemsCount - 1;
        }
        if (indexItem < 0) {
            indexItem = 0;
        }
        return indexItem;
    }
}
