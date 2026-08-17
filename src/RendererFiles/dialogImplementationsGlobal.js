
class DIALOG_FindAll_TreeViewDirector {

    constructor() {
        /** @type {Array} object or string */
        this.actualData = null;

        /**
         * @type {TreeViewNodeList}
         * */
        this.nodeList = new TreeViewNodeList(32);
        this.component = new TreeViewComponent();
    }

    /** // Invoke this?: 'this.component.draw_render_fullReset_request();' */
    setData_causes_state_reset(actualData) {
        this.actualData = actualData;

        this.nodeList.clear();

        if (!this.actualData) {
            return;
        }

        this.component.setItems(this, APP_lineHeight, APP_lineHeight + 'px');

        for (let i = 0; i < actualData.length; i++) {
            let nodeKind = get_TreeViewNodeKind_isExpandable_NOTisExpanded();
            this.nodeList.insert(this.nodeList.count_abstract, nodeKind, i, 0);
        }
        this.component.itemHeightTotal = this.tvd_getTotalCount() * this.component.itemHeightNumber;
        this.component.virtualizationElement.style.height = this.component.itemHeightTotal + 'px';
    }

    /** 
     * @param {number} caseThreeOrigin if left undefined or (falsey but not 0), this will default to 'this.component.beltIndexZero'
     */
    tvd_drawItem_BATCH(start, length, onePositiveDiff_twoNegativeDiff_orThreeFullScreen, caseThreeOrigin, timestamp) {
        let upperBound = start + length;
        let totalCount = this.nodeList.count_abstract;
        let loopCounter = 0;

        let lastIndex = this.component.beltIndexZero - 1;
        if (lastIndex < 0) {
            lastIndex += this.component.virtualCount; // TODO: 'this.component.virtualCount' or 'this.component.itemListElement.children.length'
        }

        let loopTotalIterations = upperBound - start;
        let caseTwoDivIndex = lastIndex - (loopTotalIterations - 1);
        if (caseTwoDivIndex < 0) {
            caseTwoDivIndex += this.component.itemListElement.children.length;
        }

        let verticalStyleNumber = start * this.component.itemHeightNumber;

        if (!caseThreeOrigin && caseThreeOrigin !== 0) {
            caseThreeOrigin = this.component.beltIndexZero;
        }
        if (caseThreeOrigin < 0 || caseThreeOrigin >= this.component.itemListElement.children.length) {
            throw new RangeError();
        }

        for (var indexItem = start; indexItem < upperBound; indexItem++) {

            let depth = 0;
            let nodeKind = get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded();

            let divItem;
            let divIndex;

            switch (onePositiveDiff_twoNegativeDiff_orThreeFullScreen) {
                case 1:
                    divIndex = this.component.beltIndexZero + loopCounter;
                    if (divIndex >= this.component.itemListElement.children.length)
                        divIndex -= this.component.itemListElement.children.length;
                    break;
                case 2:
                    divIndex = caseTwoDivIndex++;
                    if (caseTwoDivIndex >= this.component.itemListElement.children.length)
                        caseTwoDivIndex -= this.component.itemListElement.children.length;
                    break;
                case 3:
                    divIndex = caseThreeOrigin + loopCounter;
                    if (divIndex >= this.component.itemListElement.children.length)
                        divIndex -= this.component.itemListElement.children.length;
                    break;
            }
            divItem = this.component.itemListElement.children[divIndex];

            if (indexItem >= totalCount) {
                // TODO: Will the user agent remove a text node that has an "empty" nodeValue?
                divItem.lastChild.nodeValue = '~';
                divItem.title = '';
            }
            else {
                this.nodeList.getElementAt(indexItem);
                let key = TreeView_pooledNode_key;
                depth = TreeView_pooledNode_depth;
                nodeKind = TreeView_pooledNode_nodeKind;

                let textNode = divItem.lastChild;
                if (textNode.nodeType !== Node.TEXT_NODE) throw new Error('if (textNode.nodeType !== Node.TEXT_NODE)');
                
                let item = this.actualData[key];
                if (item.filename) {
                    textNode.nodeValue = item.filename + '(' + item.count + ')';
                    divItem.title = item.absolutePath;
                }
                else {
                    textNode.nodeValue = item;
                    divItem.title = '';
                }
            }

            switch (nodeKind) {
                case get_TreeViewNodeKind_isExpandable_isExpanded():
                    divItem.children[0].textContent = '-';
                    break;
                case get_TreeViewNodeKind_isExpandable_NOTisExpanded():
                    divItem.children[0].textContent = '+';
                    break;
                case get_TreeViewNodeKind_NOTisExpandable_isExpanded():
                    divItem.children[0].textContent = '';
                    break;
                case get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded():
                    divItem.children[0].textContent = '';
                    break;
            }

            divItem.style.transform = `translate(${EXPLORER_offsetPerDepth * depth}px, ${verticalStyleNumber}px)`;
            verticalStyleNumber += this.component.itemHeightNumber;

            loopCounter++;
        }

        if (onePositiveDiff_twoNegativeDiff_orThreeFullScreen === 1) {
            let newZerothIndex = this.component.beltIndexZero + loopCounter;
            if (newZerothIndex >= this.component.itemListElement.children.length) {
                newZerothIndex -= this.component.itemListElement.children.length;
            }
            this.component.beltIndexZero = newZerothIndex;
        }
        else if (onePositiveDiff_twoNegativeDiff_orThreeFullScreen === 2) {
            this.component.beltIndexZero = lastIndex - (loopTotalIterations - 1);
        }
    }
    
    /*** Not every key invokes this. */
    async tvd_onkeydown_async(divItem, indexItem, key) {
        
    }
    
    async tvd_ondblclick_async(divItem, indexItem) {
        this.nodeList.getElementAt(indexItem);
        let key = TreeView_pooledNode_key;
        let depth = TreeView_pooledNode_depth;
        let nodeKind = TreeView_pooledNode_nodeKind;

        if (nodeKind === get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded()) {

            let textNode = divItem.lastChild;
            if (textNode.nodeType !== Node.TEXT_NODE) throw new Error('if (textNode.nodeType !== Node.TEXT_NODE)');

            const intValue = parseInt(textNode.nodeValue, 10);
            let absolutePath = null;

            for (let i = indexItem - 1; i >= 0; i--) {
                // If ithElementDepth < currentDepth; // then ithElement is the parent of current.
                if (this.nodeList.getDepth(i) < depth) {
                    absolutePath = this.actualData[this.nodeList.getKey(i)].absolutePath;
                    break;
                }
            }

            if (!absolutePath) {
                return;
            }
            
            await EXPLORER_openInEditor(absolutePath, /*shouldFocus*/ true);
            
            if (intValue > EDITOR_lineEndPositionList.count) {
                return;
            }

            EDITOR_moveCursor_indexLine_indexColumn(intValue, 0);
        }
    }
    
    async tvd_oncontextmenu_async(divItem, indexItem, event, relativeIndex) {
        
    }

    /**
     * TODO: To detect whether the "expand/collapse icon" was clicked, the logic 'if(event.target === nodeElement.children[0])' is used...
     * ...this logic is flawed if one ever were to put an element within the span that became the target...
     * ...thus, you should consider checking the x position of the event against the x position of the nodeElement.children[0].
     * @param {*} event 
     */
    async tvd_expandCollapseIconWasClicked_async(divItem, indexItem) {
        this.nodeList.getElementAt(indexItem);
        let key = TreeView_pooledNode_key;
        let depth = TreeView_pooledNode_depth;
        let nodeKind = TreeView_pooledNode_nodeKind;

        if (nodeKind === get_TreeViewNodeKind_isExpandable_NOTisExpanded()) {

            divItem.children[0].textContent = '-';
            this.nodeList.setNodeKind(indexItem, get_TreeViewNodeKind_isExpandable_isExpanded());

            let searchTextInput = document.getElementById('DIALOG_FindAll_searchTextInput');
            if (!searchTextInput) return;
            let results = await window.myAPI.findAllGetPositions(divItem.title, searchTextInput.value, DIALOG_FindAll_options_matchWord);
            if (!results) {
                return;
            }
            if (results.length > 0) {
                this.actualData.splice(indexItem + 1, 0, ...results);

                for (let i = indexItem + 1; i < this.nodeList.count_abstract; i++) {
                    // TODO: Maybe you could delay this cause you'd know there is an expansion at such and such and then on the fly sum it instead.
                    this.nodeList.setKey(i, this.nodeList.getKey(i) + results.length);
                }

                for (let i = 0; i < results.length; i++) {
                    let nodeKind = get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded();
                    // TODO: Insert range, or at the least 'pre-emptively' resize the list so that it fits each insertion without resizing per insertion.
                    this.nodeList.insert(indexItem + 1 + i, nodeKind, indexItem + 1 + i, depth + 1);
                    this.component.itemHeightTotal = this.tvd_getTotalCount() * this.component.itemHeightNumber;
                    this.component.virtualizationElement.style.height = this.component.itemHeightTotal + 'px';
                }
            }

            this.component.draw_render_fullReset_request();
        }
        else if (nodeKind === get_TreeViewNodeKind_isExpandable_isExpanded()) {

            divItem.children[0].textContent = '+';
            this.nodeList.setNodeKind(indexItem, get_TreeViewNodeKind_isExpandable_NOTisExpanded());

            let countChildren = 0;
            for (let i = indexItem + 1; i < this.nodeList.count_abstract; i++) {
                // If currentDepth < ithElementDepth; then current is a parent of ithElement.
                if (depth < this.nodeList.getDepth(i)) {
                    countChildren++;
                }
                else {
                    break;
                }
            }
            if (countChildren > 0) { // TODO: is this check necessary?
                this.actualData.splice(indexItem + 1, countChildren);
                this.nodeList.removeAt(indexItem + 1, countChildren);
                for (let i = indexItem + 1; i < this.nodeList.count_abstract; i++) {
                    // TODO: Maybe you could delay this cause you'd know there is an expansion at such and such and then on the fly sum it instead.
                    this.nodeList.setKey(i, this.nodeList.getKey(i) - countChildren);
                }
                this.component.itemHeightTotal = this.tvd_getTotalCount() * this.component.itemHeightNumber;
                this.component.virtualizationElement.style.height = this.component.itemHeightTotal + 'px';
                this.component.draw_render_fullReset_request();
            }
        }
    }
    
    async tvd_arrowRight_async(divItem, indexItem) {
        
	}
    
    async tvd_arrowLeft_async(divItem, indexItem) {
        
    }

    tvd_getTotalCount() {
        return this.nodeList.count_abstract;
    }

    addSpecificMenuOptionsForTarget(optionList, divItem, target) {
        
    }
}

/** @type {DIALOG_FindAll_TreeViewDirector} */
let DIALOG_FindAll_TreeViewDirector_instance = null;

async function DIALOG_FindAll_Create_async() {
    let dialogBody = document.getElementById('DIALOG_body');

    let searchTextInput = document.createElement('input');
    searchTextInput.type = "text";
    searchTextInput.placeholder = 'find all';
    searchTextInput.id = 'DIALOG_FindAll_searchTextInput';
    searchTextInput.style.marginLeft = '5px';
    searchTextInput.style.marginTop = '5px';
    searchTextInput.style.height = 'var(--APP-line-height)';
    searchTextInput.addEventListener('keydown', DIALOG_FindAll_searchTextInput_onkeydown);
    dialogBody.appendChild(searchTextInput);
    searchTextInput.focus();
    
    let divOptions = document.createElement('div');
    divOptions.style.height = 'var(--APP-line-height)';
    divOptions.style.whiteSpace = 'nowrap';
    let checkboxMatchWord = document.createElement('input');
    checkboxMatchWord.type = 'checkbox';
    checkboxMatchWord.id = 'DIALOG_FindAll_checkboxMatchWord';
    checkboxMatchWord.checked = DIALOG_FindAll_options_matchWord;
    checkboxMatchWord.addEventListener('change', DIALOG_FindAll_checkboxMatchWord_onchange);
    divOptions.appendChild(checkboxMatchWord);
    let label_for_checkboxMatchWord = document.createElement('label');
    label_for_checkboxMatchWord.htmlFor = 'DIALOG_FindAll_checkboxMatchWord';
    label_for_checkboxMatchWord.textContent = 'matchWord ';
    divOptions.appendChild(label_for_checkboxMatchWord);
    // TODO: The dialog body doesn't currently have an overflow scrollbar, so this will just clip if text goes offscreen due to...
    // ...the encompassing div having 'white-space: nowrap' style.
    // But this behavior is contrary to the ctrl+f. So I wanted to note it in some way with some immediacy before I continued.
    let spanNotes = document.createElement('span');
    spanNotes.id = 'DIALOG_FindAll_spanNotes';
    spanNotes.className = 'eC';
    divOptions.appendChild(spanNotes);
    dialogBody.appendChild(divOptions);

    // TODO: Remove 'searchResultsDiv'? It is pointlessly wrapping.
    let searchResultsDiv = document.createElement('div');
    searchResultsDiv.id = 'DIALOG_FindAll_searchResultsDiv';
    dialogBody.appendChild(searchResultsDiv);
}

async function DIALOG_FindAll_Delete_async() {
    let searchTextInput = document.getElementById('DIALOG_FindAll_searchTextInput');
    if (searchTextInput) {
        searchTextInput.removeEventListener('keydown', DIALOG_FindAll_searchTextInput_onkeydown);
    }
    
    let checkboxMatchWord = document.getElementById('DIALOG_FindAll_checkboxMatchWord');
    if (checkboxMatchWord) {
    	checkboxMatchWord.removeEventListener('change', DIALOG_FindAll_checkboxMatchWord_onchange);
    }

    DIALOG_FindAll_TreeViewDirector_instance = null;
}

async function DIALOG_FindAll_searchTextInput_onkeydown(event) {
    if (event.key === 'Enter') {
        let dialogBody = document.getElementById('DIALOG_body');
        if (!dialogBody) return;
        let searchResultsDiv = document.getElementById('DIALOG_FindAll_searchResultsDiv');
        if (!searchResultsDiv) return;
        let searchTextInput = document.getElementById('DIALOG_FindAll_searchTextInput');
        if (!searchTextInput) return;
        let spanNotes = document.getElementById('DIALOG_FindAll_spanNotes');
	    if (spanNotes) {
	        spanNotes.textContent = '';
	    }

        let search = searchTextInput.value;
        if (!search) {
            return;
        }

        let results = await window.myAPI.findAll(search, DIALOG_FindAll_options_matchWord);
        if (!DIALOG_FindAll_TreeViewDirector_instance) {
            DIALOG_FindAll_TreeViewDirector_instance = new DIALOG_FindAll_TreeViewDirector();
        }
        DIALOG_FindAll_TreeViewDirector_instance.setData_causes_state_reset(results);
        DIALOG_FindAll_TreeViewDirector_instance.component.draw_create_request(searchResultsDiv, null);
    }
}

function DIALOG_FindAll_checkboxMatchWord_onchange() {
	// for an onchange event, event.target might always be precise?
	let checkboxMatchWord = document.getElementById('DIALOG_FindAll_checkboxMatchWord');
    if (checkboxMatchWord) {
    	DIALOG_FindAll_options_matchWord = checkboxMatchWord.checked;
    	let spanNotes = document.getElementById('DIALOG_FindAll_spanNotes');
	    if (spanNotes) {
	        spanNotes.textContent = 'NOTE: changing \'matchWord\' here does not re-do the search';
	    }
    }
}

async function DIALOG_Settings_Create_async() {
    let dialogBody = document.getElementById('DIALOG_body');
    if (!dialogBody) return;

    let buttonTheme = document.createElement('button');
    buttonTheme.id = 'SETTINGS_theme';
    buttonTheme.textContent = 'Theme';
    buttonTheme.addEventListener('click', DIALOG_buttonTheme_onclick);
    dialogBody.appendChild(buttonTheme);

    let checkboxTrueTabsFalseSpaces = document.createElement('input');
    checkboxTrueTabsFalseSpaces.type = 'checkbox';
    checkboxTrueTabsFalseSpaces.id = 'SETTINGS_trueTabs_falseSpaces';
    checkboxTrueTabsFalseSpaces.checked = DIALOG_Settings_trueTabs_falseSpaces; // Optional: sets the initial state to checked
    checkboxTrueTabsFalseSpaces.addEventListener('change', DIALOG_checkboxTrueTabsFalseSpaces_onchange);
    dialogBody.appendChild(checkboxTrueTabsFalseSpaces);
	// -----------------------------------------------------------
    let label_for_checkboxTrueTabsFalseSpaces = document.createElement('label');
    label_for_checkboxTrueTabsFalseSpaces.htmlFor = 'SETTINGS_trueTabs_falseSpaces';
    label_for_checkboxTrueTabsFalseSpaces.textContent = 'trueTabs_falseSpaces';
    dialogBody.appendChild(label_for_checkboxTrueTabsFalseSpaces);
    
    let checkboxEditorDebugShowAdjacentCharacters = document.createElement('input');
    checkboxEditorDebugShowAdjacentCharacters.type = 'checkbox';
    checkboxEditorDebugShowAdjacentCharacters.id = 'SETTINGS_editorDebugShowAdjacentCharacters';
    checkboxEditorDebugShowAdjacentCharacters.checked = DIALOG_Settings_editorDebugShowAdjacentCharacters; // Optional: sets the initial state to checked
    checkboxEditorDebugShowAdjacentCharacters.addEventListener('change', DIALOG_checkboxEditorDebugShowAdjacentCharacters_onchange);
    dialogBody.appendChild(checkboxEditorDebugShowAdjacentCharacters);
	// -----------------------------------------------------------
    let label_for_checkboxEditorDebugShowAdjacentCharacters = document.createElement('label');
    label_for_checkboxEditorDebugShowAdjacentCharacters.htmlFor = 'SETTINGS_editorDebugShowAdjacentCharacters';
    label_for_checkboxEditorDebugShowAdjacentCharacters.textContent = 'editorDebugShowAdjacentCharacters';
    dialogBody.appendChild(label_for_checkboxEditorDebugShowAdjacentCharacters);
}

async function DIALOG_Settings_Delete_async() {
    let dialogBody = document.getElementById('DIALOG_body');
    if (!dialogBody) return;
    
    let buttonTheme = document.getElementById('SETTINGS_theme');
    if (buttonTheme) {
        buttonTheme.removeEventListener('click', DIALOG_buttonTheme_onclick);
    }

    let checkboxTrueTabsFalseSpaces = document.getElementById('SETTINGS_trueTabs_falseSpaces');
    if (checkboxTrueTabsFalseSpaces) {
        checkboxTrueTabsFalseSpaces.removeEventListener('change', DIALOG_checkboxTrueTabsFalseSpaces_onchange);
    }
    
    let checkboxEditorDebugShowAdjacentCharacters = document.getElementById('SETTINGS_editorDebugShowAdjacentCharacters');
    if (checkboxEditorDebugShowAdjacentCharacters) {
    	checkboxEditorDebugShowAdjacentCharacters.removeEventListener('change', DIALOG_checkboxEditorDebugShowAdjacentCharacters_onchange);
    }
}

function DIALOG_buttonTheme_onclick() {
    if (DIALOG_Settings_isDark) {
        DIALOG_Settings_isDark = false;
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    }
    else {
        DIALOG_Settings_isDark = true;
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
}

function DIALOG_checkboxTrueTabsFalseSpaces_onchange() {
    let checkboxTrueTabsFalseSpaces = document.getElementById('SETTINGS_trueTabs_falseSpaces');
    if (!checkboxTrueTabsFalseSpaces) return;

    DIALOG_Settings_trueTabs_falseSpaces = checkboxTrueTabsFalseSpaces.checked;
    if (DIALOG_Settings_trueTabs_falseSpaces) {
        EDITOR_on_tab_bytes = EDITOR_tab_tabsbytes;
    }
    else {
        EDITOR_on_tab_bytes = EDITOR_tab_spacesbytes;
    }
}

function DIALOG_checkboxEditorDebugShowAdjacentCharacters_onchange() {
    let checkboxEditorDebugShowAdjacentCharacters = document.getElementById('SETTINGS_editorDebugShowAdjacentCharacters');
    if (!checkboxEditorDebugShowAdjacentCharacters) return;

    DIALOG_Settings_editorDebugShowAdjacentCharacters = checkboxEditorDebugShowAdjacentCharacters.checked;
    EDITOR_drawCursor(EDITOR_primaryCursor);
}

async function DIALOG_DocumentSymbol_Create_async() {
    let dialogBody = document.getElementById('DIALOG_body');
    if (!dialogBody) return;

    if (EDITOR_documentSymbolResult) {
        let div = document.createElement('div');
        div.textContent = 'EDITOR_documentSymbolResult.length: ' + EDITOR_documentSymbolResult.length;
        div.style.height = APP_lineHeight + 'px';
        div.style.whiteSpace = 'nowrap';
        dialogBody.appendChild(div);
        EDITOR_listComponent.rootElement.style.height = `calc(100% - ${div.style.height})`;
        EDITOR_listComponent.draw_create(dialogBody, null);
    }
    else {
        dialogBody.textContent = 'EDITOR_documentSymbolResult is falsey';
    }
}

async function DIALOG_DocumentSymbol_Delete_async() {
    let dialogBody = document.getElementById('DIALOG_body');
    if (!dialogBody) return;
    if (EDITOR_listComponent) {
        EDITOR_listComponent.draw_delete();
        EDITOR_listComponent = null;
    }
    EDITOR_documentSymbolResult = null;
}

//let DEBUG_listData = null;
//let DEBUG_listComponent = null;

async function DIALOG_Debug_Create_async() {
//    let dialogBody = document.getElementById('DIALOG_body');
//    if (!dialogBody) return;
//    
//    DEBUG_listData = new Uint16Array(65_536);
//    for (let i = 0; i < 65_536; i++) {
//        DEBUG_listData[i] = i;
//    }
//
//    if (!DEBUG_listComponent) {
//        DEBUG_listComponent = new ListComponent();
//    }
//    DEBUG_listComponent.setItems(APP_lineHeight, APP_lineHeight + 'px',
//        /*drawItemAction*/ (div, index) => {
//            if (index === -1) {
//                div.textContent = '';
//                div.title = '';
//                div.style.display = 'none';
//            }
//            else {
//                let item = DEBUG_listData[index];
//                div.textContent = item;
//                div.style.display = '';
//            }
//        },
//        /*onkeydownAction*/ (div, index) => {
//            //if (index === -1) {
//            //    // TODO: if (index === -1)
//            //}
//            //else {
//            //    // TODO: Ensure that json parsing the title like this is a safe way of doing things
//            //    const startPosition = JSON.parse(div.title);
//            //    EDITOR_moveCursor_indexLine_indexColumn(startPosition.line, startPosition.character);
//            //}
//        },
//        /*getItemsCountFunc*/ () => {
//            if (DEBUG_listData) {
//                return DEBUG_listData.length;
//            }
//            else {
//                return 0;
//            }
//        });
//    
//    if (DEBUG_listData) {
//        let div = document.createElement('div');
//        div.textContent = 'DEBUG_listData.length: ' + DEBUG_listData.length;
//        div.style.height = APP_lineHeight + 'px';
//        div.style.whiteSpace = 'nowrap';
//        dialogBody.appendChild(div);
//        DEBUG_listComponent.rootElement.style.height = `calc(100% - ${div.style.height})`;
//        DEBUG_listComponent.draw_create(dialogBody, null);
//    }
//    else {
//        dialogBody.textContent = 'DEBUG_listData is falsey';
//    }
}

async function DIALOG_Debug_Delete_async() {
//    let dialogBody = document.getElementById('DIALOG_body');
//    if (!dialogBody) return;
//
//    DEBUG_listData = null;
//    DEBUG_listComponent = null;
}
