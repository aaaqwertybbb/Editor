
/*
When collapse maybe you reset the length of the longest line or something

===

The reason you're so confused about garbage collection and how much overhead it provides is that you
don't understand how to render things in a browser, and a side effect of your crummy rendering is that you're blowing up the GC and then
you go around looking at const numbers and start trippin bout it like a fool.
I mean maybe it does have a non zero overhead a const number. But like cmon dude.

===

also need to update the width of the cursor to the largest width seen div thing so it visually looks correct
need to make sure the code does a min-width esque logic. Probably don't want the css but just for the code that sets the style to consider it for you avoids min-width overhead if exists?
*/



function EXPLORER_TreeViewDirector_constructor() {
    /////
    ///// start treeViewComponent.js
    /////
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

    this.SET_ITEMS_itemHeightNumber = 0;
    this.SET_ITEMS_itemHeightStyleAttributeValueString = '';

    this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 2;

    this.LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH = 0;
    /////
    ///// end treeViewComponent.js
    /////






    /** @type {string} */
    this.chosenDirectory = null;

    /**
     * @type {TreeViewNodeList}
     * */
    this.nodeList = new TreeViewNodeList(32);

    this.scrollEndDeadline = 0;
    this.scrollIsFetchingData = false;
    this.scrollFetchData_virtualIndex = 0;
    this.scrollFetchData_virtualCount = 0;
    this.scrollFetchData_beltIndexZero = 0;
    
    /** Starting with an empty array so I can have undefined/null signify that the "TreeViewDirector" is "opting out" of this feature, thus the component should not allocate this on the "TreeViewDirector"'s behalf. */
    this.pullData_array = new Uint32Array(0);
    this.pullData_array_count = 0;

    this.pullData_result = new Uint32Array(0);
    this.pullData_result_count = 0;

    this.arrayEntries = null;

    // Google AI'd the bit logic
    // Configuration matching our table above
    this.KEY_BITS = 12;
    this.KEY_MASK = (1 << this.KEY_BITS) - 1; // Binary: 00000000000000000000111111111111 (0xFFF)
}

/** // Invoke this?: 'this.draw_render_fullReset_request();' */
function EXPLORER_TreeViewDirector_setChosenDirectory(chosenDirectory, chosenDirectoryAbsolutePathId) {
    this.chosenDirectory = chosenDirectory;
    this.chosenDirectoryAbsolutePathId = chosenDirectoryAbsolutePathId;

    this.nodeList.clear();

    if (!this.chosenDirectory) return;

    let nodeKind = TreeViewNodeKind_isExpandable_NOTisExpanded;
    this.nodeList.insert(this.nodeList.count_abstract, nodeKind, this.chosenDirectoryAbsolutePathId, 0);
    this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
    this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
}

/** // Invoke this?: 'this.draw_render_fullReset_request();' */
function EXPLORER_TreeViewDirector_setChosenWorkspace(chooseWorkspaceResult) {
    this.chosenWorkspace = chooseWorkspaceResult.workspaceFileAbsolutePath;

    this.nodeList.clear();

    if (!this.chosenWorkspace) return;

    for (let i = 0; i < chooseWorkspaceResult.directories.length; i++) {
        let directory = chooseWorkspaceResult.directories[i];
        let nodeKind = TreeViewNodeKind_isExpandable_NOTisExpanded;
        this.nodeList.insert(this.nodeList.count_abstract, nodeKind, directory.id, 0);
    }

    this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
    this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_ScrollTrailingEdgeCheck = (timestamp) => {
    // If the scroll deadline hasn't been met yet, keep checking on the next frame
    if (timestamp < this.scrollEndDeadline) {
        requestAnimationFrame(this.TREEVIEW_render_do_ScrollTrailingEdgeCheck);
        return;
    }

    // The 1,000ms has passed! Fire your trailing edge logic safely
    this.tvd_drawItem_BATCH_trailingEdge();
}

function EXPLORER_TreeViewDirector_tvd_drawItem_BATCH_trailingEdge() {
    this.isCheckingTrailingEdge = false; // Reset the flag here
    if (!this.scrollIsFetchingData) {
        this.scrollIsFetchingData = true;
        this.tvd_drawItem_BATCH_pullData(); // no await
    }
};

/** 
 * @param {number} caseThreeOrigin if left undefined or (falsey but not 0), this will default to 'this.beltIndexZero'
 */
function EXPLORER_TreeViewDirector_tvd_drawItem_BATCH(start, length, onePositiveDiff_twoNegativeDiff_orThreeFullScreen, caseThreeOrigin, timestamp) {

    // TODO: I'm putting this in treeViewComponent.js as well for now when diff === 0:
    this.scrollEndDeadline = timestamp + 300;

    if (!this.isCheckingTrailingEdge) {
        this.isCheckingTrailingEdge = true;
        requestAnimationFrame(this.TREEVIEW_render_do_ScrollTrailingEdgeCheck);
    }

    let upperBound = start + length;
    let totalCount = this.nodeList.count_abstract;
    let loopCounter = 0;

    let lastIndex = (this.beltIndexZero - 1 + this.virtualCount) % this.virtualCount; // TODO: 'this.virtualCount' or 'this.TREEVIEW_ArrayFrom_itemListElement_children.length'

    let loopTotalIterations = upperBound - start;

    let caseTwoDivIndex = (lastIndex - (loopTotalIterations - 1) + this.TREEVIEW_ArrayFrom_itemListElement_children_length) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;

    let verticalStyleNumber = start * this.itemHeightNumber;

    if (!caseThreeOrigin && caseThreeOrigin !== 0) {
        caseThreeOrigin = this.beltIndexZero;
    }
    if (caseThreeOrigin < 0 || caseThreeOrigin >= this.TREEVIEW_ArrayFrom_itemListElement_children_length) {
        throw new RangeError();
    }

    for (var indexItem = start; indexItem < upperBound; indexItem++) {

        let depth = 0;
        let nodeKind = TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

        let divItem;
        let divIndex;

        switch (onePositiveDiff_twoNegativeDiff_orThreeFullScreen) {
            case 1:
                divIndex = (this.beltIndexZero + loopCounter) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;
                break;
            case 2:
                divIndex = (caseTwoDivIndex++) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;
                break;
            case 3:
                divIndex = (caseThreeOrigin + loopCounter) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;
                break;
        }
        divItem = this.TREEVIEW_ArrayFrom_itemListElement_children[divIndex];

        if (indexItem >= totalCount) {
            // TODO: Will the user agent remove a text node that has an "empty" nodeValue?
            divItem.lastChild.nodeValue = '~';
            divItem.lastChild.title = '';
        }
        else {
            this.nodeList.getElementAt(indexItem);
            let key = gINT_FIELDS[fTreeView_pooledNode_key];
            depth = gINT_FIELDS[fTreeView_pooledNode_depth];
            nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
            
            let isDirectory = nodeKind === TreeViewNodeKind_isExpandable_isExpanded ||
                                nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded;

            //let entry = arrayEntries[loopCounter];
            let textNode = divItem.lastChild;
            textNode.nodeValue = '...';//entry.basename;
            textNode.title = '...';//entry.absolutePath;
            divItem.className = 'eN';

            if (false /*isDirectory*/ /*&& !entry.isDirectory*/) {
                // A file was deleted then a directory was created with same absolute file path or vice versa.
                this.nodeList.setNodeKind(indexItem, TreeViewNodeKind_NOTisExpandable_NOTisExpanded);
                nodeKind = TreeViewNodeKind_NOTisExpandable_NOTisExpanded;
            }
        }
        
        switch (nodeKind) {
            case TreeViewNodeKind_isExpandable_isExpanded:
                divItem.children[0].textContent = '-';
                break;
            case TreeViewNodeKind_isExpandable_NOTisExpanded:
                divItem.children[0].textContent = '+';
                break;
            case TreeViewNodeKind_NOTisExpandable_isExpanded:
                divItem.children[0].textContent = '';
                break;
            case TreeViewNodeKind_NOTisExpandable_NOTisExpanded:
                divItem.children[0].textContent = '';
                break;
        }

        // TODO: predict this when expanding/collapsing?????
        if (depth > this.LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH) {
            this.LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH = depth;
        }

        divItem.style.transform = `translate(${CONST_EXPLORER_offsetPerDepth * depth}px, ${verticalStyleNumber}px)`;
        verticalStyleNumber += this.itemHeightNumber;

        loopCounter++;
    }

    if (onePositiveDiff_twoNegativeDiff_orThreeFullScreen === 1) {
        this.beltIndexZero = (this.beltIndexZero + loopCounter) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;
    }
    else if (onePositiveDiff_twoNegativeDiff_orThreeFullScreen === 2) {
        this.beltIndexZero = (lastIndex - (loopTotalIterations - 1) + this.TREEVIEW_ArrayFrom_itemListElement_children_length) % this.TREEVIEW_ArrayFrom_itemListElement_children_length;
    }
}

/*
This comment is from 'tvd_drawItem_BATCH', it was in my way

// The main process has similar logic that allocates an array of length in order to return a response that converted the keys to their filesystem entries.
    // (maybe I could overwrite the same array indices and return that but...)
    // all in all the GC overhead of the renderer process I believe to be greatly higher than that of the main process,
    // and since their GC overhead are independent of one another.
    // Allocating this array in the renderer is far more costly due to the renderer already having generally high GC overhead due to the UI
    // vs the importance of removing the corresponding array allocation from the main process.
    //
    //
    // I think I'll even introduce a slight "regression" and have the synchronous scrolling use the text '...' for any scrolled into view nodes
    // synchronously,
    // then asynchronously I'll have a debounce that fetches the names
    //
    // after that I can add a caching layer to remember the filenames that I've already pulled.
    //
    // caching layer: 1 byte array you toString the spans from the byte array that represent the node text flattened all together
    //
    // you actually don't need to have this logic then.
    // when you initially get the treeview nodes, they I think have the filename already.
    // And if you subarray setWithin or something then it moves super quickly
    // and you can get the min index and max index in the byte array when you en masse remove a chunk of contiguous nodes.
    //
    // well wait then you'd have to update what sections of the byte array the nodes have their text at...
    //
    // I gave Google AI the comment above...
    //
    // Google AI:
    // < You are dealing with a classic high-performance UI problem: balancing memory footprint, IPC (Inter-Process Communication) bottlenecks, and GC (Garbage Collection) thrashing in a virtualized list.
    // < 
    // < Your train of thought moves from a stateless pull model to an asynchronous debounced model, and finally to a flattened byte-array cache.
    // < 
    // < Here is an analysis of your architectural ideas, along with concrete recommendations to minimize both memory and GC overhead.
    // < 
    // < 1. The Flattened Byte-Array Cache (The Best Idea)
    // < |
    // < Your idea of storing text as flat bytes in a single Uint8Array is excellent for memory efficiency, but your concern about updating indices when deleting nodes is valid.
    // < 
    // < The Fix: Do not delete or shift data inside the byte array when individual nodes leave the viewport. Instead, use an Append-Only Ring Buffer or a Slot-Based Cache.
    // < ...
    // < SharedArrayBuffer: If you want to eliminate the Main-to-Renderer array allocation overhead entirely, look into SharedArrayBuffer. Both processes can map to the same memory space. The main process writes the node data into the buffer, and the renderer reads it without any IPC copy or allocation cost.
    // < ...
    //
    //let arrayKeys = new Array(length);
    //for (var indexItem = start; indexItem < upperBound; indexItem++) {
    //    arrayKeys[loopCounter++] = this.nodeList.getKey(indexItem);
    //}
    //let arrayEntries = await window.myAPI.getFilesystemEntryById_ARRAY(arrayKeys);
    //
    // The main complexity is the goal as a whole. I just gotta decide on a plan for what steps I'm taking to get me to the end goal.
    // If you don't panic about the goal as whole and just take it step by step it shouldn't be hard.
    //
    // I'm gonna get lost in the sauce if I don't take it slow and do the simpler less optimized solution first.
    // 
    //
    // I need to figure out why the entire screen redraws when I scroll
    // it should only be the ones that came into view.
    //
    // TODO: does this have a diff===0 case?
    //
*/

async function EXPLORER_TreeViewDirector_tvd_drawItem_BATCH_pullData() {
    /*
    Google AI:
    > my rAF loop is currently synchronous.
    >
    > I believe 'fetchMissingNodeNames(); // Pull data from Main process' would have to be async for it to work correctly, but I might be wrong about this.
    > 
    > If it does need to be async, I worry about making the entire rAF loop async just so a single branch can await.

    < You are 100% correct to worry about this. Never make your requestAnimationFrame loop async or use await inside it.
    < ...
    */
    this.scrollFetchData_virtualIndex = this._ONSCROLLvirtualIndex;
    this.scrollFetchData_virtualCount = this._ONSCROLLvirtualCount;
    this.scrollFetchData_beltIndexZero = this.beltIndexZero;

    // This isn't the most optimal way of doing things.
    //
    let itemListElement_children = this.TREEVIEW_ArrayFrom_itemListElement_children;
    let itemListElement_childrenLength = this.TREEVIEW_ArrayFrom_itemListElement_children_length;

    this.pullData_array_count = 0;

    // TODO: This is an awkward explicit inlining of 'this.indexItemTo_beltIndexItem'...
    // ...the initial declaration of 'let beltIndexLine' is assigned what I refer to as the "virtualIndex"
    // but 'beltIndexLine' is the output of the function, and a 'virtualIndex' variable is only needed temporarily
    // for the calculation. So by storing the 'virtualIndex' in 'beltIndexLine' at the start I skip a variable declaration.
    let beltIndex_current = ((this.scrollFetchData_virtualIndex)) - this.virtualIndex_ofScrollTop;
    if (beltIndex_current >= this.TREEVIEW_ArrayFrom_itemListElement_children_length || beltIndex_current < 0) beltIndex_current = -1;
    else beltIndex_current = (beltIndex_current + this.beltIndexZero) % this.virtualCount;

    for (let i = 0; i < itemListElement_childrenLength; i++) {

        if (itemListElement_children[beltIndex_current].className === 'eN') {
            let indexItem = this.scrollFetchData_virtualIndex + i;
            
            // The index of the actual dom element within this.itemListElement.children
            // that is displaying the UI representation of what 'indexItem' points to.
            let indexBelt = beltIndex_current;

            this.pullData_array[this.pullData_array_count++] = ((indexBelt << this.KEY_BITS) | this.nodeList.getKey(indexItem));
        }

        beltIndex_current = (beltIndex_current + 1) % itemListElement_childrenLength;
    }

    this.arrayEntries = await window.myAPI.getFilesystemEntryById_ARRAY(this.pullData_array.subarray(0, this.pullData_array_count));

    this.pullData_result = this.pullData_array;
    this.pullData_result_count = this.pullData_array_count;

    this.scrollIsFetchingData = false; // TODO: try/catch/finally; put this in the finally.

    this.TREEVIEW_render_request(TREEVIEWrenderKind_Scroll_PullDataDrawResult);
};

function EXPLORER_TreeViewDirector_tvd_drawItem_BATCH_PullDataDrawResult () {
    if (this.scrollFetchData_virtualIndex === this._ONSCROLLvirtualIndex &&
        this.scrollFetchData_virtualCount === this._ONSCROLLvirtualCount &&
        this.scrollFetchData_beltIndexZero === this.beltIndexZero) {

        // This isn't the most optimal way of doing things.
        //
        let itemListElement_children = this.TREEVIEW_ArrayFrom_itemListElement_children;
        let itemListElement_childrenLength = this.TREEVIEW_ArrayFrom_itemListElement_children_length;

        let currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;
        let NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;

        for (let i = 0; i < this.pullData_result_count; i++) {
            let packedInteger = this.pullData_result[i];
            const key = packedInteger & this.KEY_MASK;
            const beltIndexItem = packedInteger >> this.KEY_BITS;

            let nodeElement = itemListElement_children[beltIndexItem];
            nodeElement.className = '';
            let textNode = nodeElement.lastChild;
            let entry = this.arrayEntries[i];
            textNode.nodeValue = entry.basename;
            textNode.title = entry.absolutePath;

            // TODO: Reduce drawn width under some circumstance too
            if (entry.basename.length > NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING) {
                NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = entry.basename.length;
            }
        }

        if (NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING > currentWIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING) {
            this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = NEXT_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING;
            let widthAttributeValueNumber = Math.ceil(((this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING + 2/*padding*/) * gINT_FIELDS[fEXPLORER_firstSpanWidthValue]) + CONST_EXPLORER_offsetPerDepth * this.LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH);

            // This is actually more complicated you have to track whether you go above the minimum requirement lest you add 1 character over and over in width just to keep redrawing widths.
            //if (widthAttributeValueNumber < this.lastReadNumber_offsetWidth) {
            //    widthAttributeValueNumber = this.lastReadNumber_offsetWidth;
            //}
            //this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING
            let widthAttributeValueString = widthAttributeValueNumber + 'px';
            this.cursorElement.style.width = widthAttributeValueString;
            for (let i = 0; i < itemListElement_childrenLength; i++) {
                itemListElement_children[i].style.width = widthAttributeValueString;
            }
        }

        this.pullData_result = null;
        this.arrayEntries = null;
    }
}

/**
 * Not every key invokes this. 
 */
async function EXPLORER_TreeViewDirector_tvd_onkeydown_async(divItem, indexItem, eventKey) {
    switch (eventKey) {
        case ' ':
        case 'Enter':
            this.nodeList.getElementAt(indexItem);
            let key = gINT_FIELDS[fTreeView_pooledNode_key];
            let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
            let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
            if (nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded) {
                // TODO: open the file by id in one ipc call
                const entry = await window.myAPI.getFilesystemEntryById(key);
                if (!entry) return;
    
                if (!entry.isDirectory) {
                    let shouldFocus;
                    if (eventKey === ' ') {
                        shouldFocus = false;
                    }
                    else if (eventKey === 'Enter') {
                        shouldFocus = true;
                    }
                    await EXPLORER_openInEditor(entry.absolutePath, shouldFocus);
                }
            }
            break;
    }
}

async function EXPLORER_TreeViewDirector_tvd_ondblclick_async(divItem, indexItem) {
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];

    if (nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded) {
        // TODO: open the file by id in one ipc call
        const entry = await window.myAPI.getFilesystemEntryById(key);
        if (!entry) return;

        if (!entry.isDirectory) {
            await EXPLORER_openInEditor(entry.absolutePath, /*shouldFocus*/ true);
        }
    }
}

function EXPLORER_TreeViewDirector_tvd_oncontextmenu_async(divItem, indexItem, event_button, event_clientX, event_clientY, relativeIndex) {
    let optionList = [
        new MenuOption(CommandKind_Copy, 'Copy', null),
        new MenuOption(CommandKind_CopyAbsolutePath, 'Copy Absolute Path', null),
    ];

    this.ensure_boundingClientRect();
    let nodeListBoundingClientRect = this.boundingClientRect;

    // TODO: !!!! You might need to be careful with async and the TreeView_pooledNode; I'm not certain whether you do or don't have to be careful, and I don't feel like looking into it at the moment.
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];

    let target = {
        id: key,
        depth: depth,
        nodeKind: nodeKind,
        indexItem: indexItem,
        divRelativeIndex: relativeIndex,
    };

    if (event_button === 2) {
        this.addSpecificMenuOptionsForTarget(optionList, divItem, target);
        return menuSet('EXPLORER', target, optionList, gINT_FIELDS[fEXPLORER_menuOptionX]=event_clientX, gINT_FIELDS[fEXPLORER_menuOptionY]=event_clientY);
    } else {
        this.addSpecificMenuOptionsForTarget(optionList, divItem, target);
        return menuSet('EXPLORER', target, optionList, gINT_FIELDS[fEXPLORER_menuOptionX]=nodeListBoundingClientRect.left, gINT_FIELDS[fEXPLORER_menuOptionY]=(nodeListBoundingClientRect.top + ((this.cursorIndex + 1) * this.itemHeightNumber) - this.rootElement.scrollTop));
    }
}

/**
 * TODO: To detect whether the "expand/collapse icon" was clicked, the logic 'if(event.target === nodeElement.children[0])' is used...
 * ...this logic is flawed if one ever were to put an element within the span that became the target...
 * ...thus, you should consider checking the x position of the event against the x position of the nodeElement.children[0].
 * @param {*} event 
 */
async function EXPLORER_TreeViewDirector_tvd_expandCollapseIconWasClicked_async(divItem, indexItem) {
    // TODO: !!!! You might need to be careful with async and the TreeView_pooledNode; I'm not certain whether you do or don't have to be careful, and I don't feel like looking into it at the moment.
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];

    if (nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded) {

        divItem.children[0].textContent = '-';
        this.nodeList.setNodeKind(indexItem, TreeViewNodeKind_isExpandable_isExpanded);

        const filesystemEntries = await window.myAPI.getFilesystemEntries_argumentIsId(key);

        for (let i = 0; i < filesystemEntries.length; i++) {
            let entry = filesystemEntries[i];
            let nodeKind;
            if (entry.isDirectory) {
                nodeKind = TreeViewNodeKind_isExpandable_NOTisExpanded;
            }
            else {
                nodeKind = TreeViewNodeKind_NOTisExpandable_NOTisExpanded;
            }
            // TODO: Insert range, or at the least 'pre-emptively' resize the list so that it fits each insertion without resizing per insertion.
            this.nodeList.insert(indexItem + 1 + i, nodeKind, entry.id, depth + 1);
            this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
            this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
        }

        this.draw_render_fullReset_request();
    }
    else if (nodeKind === TreeViewNodeKind_isExpandable_isExpanded) {

        divItem.children[0].textContent = '+';
        this.nodeList.setNodeKind(indexItem, TreeViewNodeKind_isExpandable_NOTisExpanded);

        let countChildren = 0;
        for (let i = indexItem + 1; i < this.nodeList.count_abstract; i++) {
            // If currentDepth < ithElementDepth; // then current is a parent of ithElement.
            if (depth < this.nodeList.getDepth(i)) {
                countChildren++;
            }
            else {
                break;
            }
        }
        if (countChildren > 0) { // TODO: is this check necessary?
            this.nodeList.removeAt(indexItem + 1, countChildren);
            this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
            this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
            this.draw_render_fullReset_request();
        }
    }
}

function EXPLORER_TreeViewDirector_tvd_arrowRight_async(divItem, indexItem) {
    // TODO: !!!! You might need to be careful with async and the TreeView_pooledNode; I'm not certain whether you do or don't have to be careful, and I don't feel like looking into it at the moment.
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
    
    if (nodeKind === TreeViewNodeKind_isExpandable_isExpanded) {
        if (indexItem + 1 < this.nodeList.count_abstract) {
            if (this.nodeList.getDepth(indexItem + 1) > depth) {
                this.state_cursor_setIndex(this.state_cursor_validateIndex(
                    this.cursorIndex + 1));
            }
        }
    }
    else if (nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded) {
        return this.tvd_expandCollapseIconWasClicked_async(divItem, indexItem);
    }

    return Promise.resolve();
}

function EXPLORER_TreeViewDirector_tvd_arrowLeft_async(divItem, indexItem) {
    // TODO: !!!! You might need to be careful with async and the TreeView_pooledNode; I'm not certain whether you do or don't have to be careful, and I don't feel like looking into it at the moment.
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
    
    if (nodeKind === TreeViewNodeKind_isExpandable_isExpanded) {
        return this.tvd_expandCollapseIconWasClicked_async(divItem, indexItem);
    }
    else {
        let distanceToParent = 0;
        for (let i = indexItem - 1; i >= 0; i--) {
            // If ithElementDepth < currentDepth; // then ithElement is the parent of current.
            if (this.nodeList.getDepth(i) < depth) {
                distanceToParent++;
                break;
            }
            else {
                distanceToParent++;
            }
        }
        if (distanceToParent > 0) {
            this.state_cursor_setIndex(this.state_cursor_validateIndex(
                indexItem - distanceToParent));
        }
    }

    return Promise.resolve();
}

function EXPLORER_TreeViewDirector_tvd_getTotalCount() {
    return this.nodeList.count_abstract;
}

/**
 * This method should only pertain itself with the contents of the flat list, any UI changes will be made based on the returned 'changeCount'
 * which is interpreted as one for the item itself, plus the count of any children that were recursively removed.
 * 
 * TODO: Include the word "directory"?
 * 
 * @param {*} indexItem 
 * @returns 
 */
function EXPLORER_TreeViewDirector_removeFromNodeList(indexItem) {
    this.nodeList.getElementAt(indexItem);
    let key = gINT_FIELDS[fTreeView_pooledNode_key];
    let depth = gINT_FIELDS[fTreeView_pooledNode_depth];
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];

    if (nodeKind === TreeViewNodeKind_NOTisExpandable_isExpanded) {
        alert("TODO: if (nodeKind === ...TreeViewNodeKind_NOTisExpandable_isExpanded())");
        return;
    }

    let countChildren = 0;

    if (nodeKind === TreeViewNodeKind_isExpandable_isExpanded) {
        for (let i = indexItem + 1; i < this.nodeList.count_abstract; i++) {
            // If currentDepth < ithElementDepth; then current is a parent of ithElement.
            if (depth < this.nodeList.getDepth(i)) {
                countChildren++;
            }
            else {
                break;
            }
        }
    }

    this.nodeList.removeAt(indexItem, 1 + countChildren);
    this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
    this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
    return 1 + countChildren;
}

/** TODO: any usage of this needs to respect the actual zeroth UI div not the literal. */
function EXPLORER_TreeViewDirector_setNodeListEntryId(indexItem, pathId) {
    this.nodeList.setKey(indexItem, pathId);
}

function EXPLORER_TreeViewDirector_addSpecificMenuOptionsForTarget(optionList, divItem, target) {
    if (!divItem) return;

    // check the "text icon": { '-', '+', '' }
    if (target.nodeKind === TreeViewNodeKind_isExpandable_isExpanded ||
        target.nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded) {
        
        // Directory
        optionList.push(new MenuOption(CommandKind_NewFile_File, 'NewFile', null));
        optionList.push(new MenuOption(CommandKind_NewFile_Directory, 'NewDirectory', null));
        optionList.push(new MenuOption(CommandKind_DeleteFile_Directory, 'Delete', null));
        optionList.push(new MenuOption(CommandKind_RenameFile_Directory, 'Rename', null));
        optionList.push(new MenuOption(CommandKind_Paste, 'Paste', null));
        optionList.push(new MenuOption(CommandKind_Cut, 'Cut', null));
    }
    else {
        // File
        optionList.push(new MenuOption(CommandKind_DeleteFile_File, 'Delete', null));
        optionList.push(new MenuOption(CommandKind_RenameFile_File, 'Rename', null));
        optionList.push(new MenuOption(CommandKind_Cut, 'Cut', null));
    }
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_request(renderKind) {
    if (this.TREEVIEW_renderKindArray[this.TREEVIEW_renderKindArray.length - 1] !== renderKind) {
        this.TREEVIEW_renderKindArray.push(renderKind);
    }
    
    if (!this.TREEVIEW_isRenderPending) {
        this.TREEVIEW_isRenderPending = true;
        requestAnimationFrame(this.renderDo);
    }
}

function EXPLORER_TreeViewDirector_renderDo = (timestamp) => {
    let renderKind;
    
    // Synchronously exhaust the item queue for this animation frame
    while (renderKind = this.TREEVIEW_renderKindArray.shift()) {
        switch (renderKind) {
            case TREEVIEWrenderKind_Cursor:
                this.TREEVIEW_render_do_Cursor();
                break;
            case TREEVIEWrenderKind_Create:
                this.TREEVIEW_render_do_Create(timestamp);
                break;
            case TREEVIEWrenderKind_Batch:
                this.TREEVIEW_render_do_Batch(timestamp);
                break;
            case TREEVIEWrenderKind_Scroll:
                this.TREEVIEW_render_do_Scroll(timestamp);
                break;
            case TREEVIEWrenderKind_Scroll_PullDataDrawResult:
                this.TREEVIEW_render_do_Scroll_PullDataDrawResult();
                break;
            case TREEVIEWrenderKind_SetItems:
                this.TREEVIEW_render_do_SetItems();
                break;
            case TREEVIEWrenderKind_FullReset:
                this.TREEVIEW_render_do_FullReset(timestamp);
                break;
            case TREEVIEWrenderKind_Resize:
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
function EXPLORER_TreeViewDirector_TREEVIEW_render_do_SetItems() {
    this.itemListElement.innerHTML = '';
    this.virtualizationElement.style.height = 1 + 'px';
    this.state_cursor_setIndex(0);
    
    this.itemHeightNumber = this.SET_ITEMS_itemHeightNumber;
    this.itemHeightStyleAttributeValueString = this.SET_ITEMS_itemHeightStyleAttributeValueString;

    this.cursorElement.style.height = this.itemHeightStyleAttributeValueString;
    this.itemHeightTotal = this.tvd_getTotalCount() * this.itemHeightNumber;
    this.virtualizationElement.style.height = this.itemHeightTotal + 'px';
    this.boundingClientRect = null;
}

/**
 * @param {*} itemHeightNumber '50'; cursorTop = currentIndex * itemHeightNumber;
 * @param {*} itemHeightStyleAttributeValueString '50px'; div.style.height = itemHeightStyleAttributeValueString;
 */
function EXPLORER_TreeViewDirector_setItems(itemHeightNumber, itemHeightStyleAttributeValueString) {
    this.SET_ITEMS_itemHeightNumber = itemHeightNumber;
    this.SET_ITEMS_itemHeightStyleAttributeValueString = itemHeightStyleAttributeValueString;
    this.TREEVIEW_render_request(TREEVIEWrenderKind_SetItems);
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Create(timestamp) {
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
function EXPLORER_TreeViewDirector_draw_create_request(parentElement, insertBeforeThisChild) {
    this.TREEVIEW_draw_create_request_parentElement = parentElement;
    this.TREEVIEW_draw_create_request_insertBeforeThisChild = insertBeforeThisChild;
    this.TREEVIEW_render_request(TREEVIEWrenderKind_Create);
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Batch(timestamp) {
    this.tvd_drawItem_BATCH(this.start, this.length, this.onePositiveDiff_twoNegativeDiff_orThreeFullScreen, this.caseThreeOrigin, timestamp);
}

/**
 * if (!this.rootElement.parentElement) return;
 * Because the "list" is not drawn, no UI needs to be removed.
 * (the purpose of this method is more-so related to unsubscribing of events and other such non-automatic actions that need to be performed)
 * 
 * @returns 
 */
function EXPLORER_TreeViewDirector_draw_delete() {
    if (!this.rootElement.parentElement) return;
    this.draw_removeEvents();
    this.boundingClientRect = null;
    this.rootElement.parentElement.removeChild(this.rootElement);
}

function EXPLORER_TreeViewDirector_draw_addEvents() {
    this.rootElement.addEventListener('click', this);
    this.rootElement.addEventListener('keydown', this);
    this.rootElement.addEventListener('scroll', this, { passive: true });
    this.rootElement.addEventListener('dblclick', this);
    this.rootElement.addEventListener('contextmenu', this);
    window.addEventListener('resize', this);
}

function EXPLORER_TreeViewDirector_draw_removeEvents() {
    this.rootElement.removeEventListener('click', this);
    this.rootElement.removeEventListener('keydown', this);
    this.rootElement.removeEventListener('scroll', this, { passive: true });
    this.rootElement.addEventListener('dblclick', this);
    this.rootElement.addEventListener('contextmenu', this);
    window.removeEventListener('resize', this);
}

// The browser automatically looks for this exact method name
function EXPLORER_TreeViewDirector_handleEvent(event) {
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

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Scroll(timestamp) {
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

            let totalCount = this.tvd_getTotalCount();

            if (diff > 0 && diff < this.virtualCount) {
                this.tvd_drawItem_BATCH(prevVli + this._ONSCROLLvirtualCount, diff, 1, undefined, timestamp);
            }
            else if (diff < 0 && (diff *= -1) < this.virtualCount) {
                this.tvd_drawItem_BATCH(currVli, diff, 2, undefined, timestamp);
            }
            else {
                if (diff === 0) {
                    this.scrollEndDeadline = timestamp + 300;
                }
                else {
                    this.tvd_drawItem_BATCH(this.virtualIndex_ofScrollTop, this.virtualCount, 3, undefined, timestamp);
                }
            }
        }
    }
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Scroll_PullDataDrawResult() {
    if (this.tvd_drawItem_BATCH_PullDataDrawResult) {
        this.tvd_drawItem_BATCH_PullDataDrawResult();
    }
}

function EXPLORER_TreeViewDirector_draw_BATCH_request(start, length, onePositiveDiff_twoNegativeDiff_orThreeFullScreen, caseThreeOrigin) {
    this.start = start;
    this.length = length;
    this.onePositiveDiff_twoNegativeDiff_orThreeFullScreen = onePositiveDiff_twoNegativeDiff_orThreeFullScreen;
    this.caseThreeOrigin = caseThreeOrigin;
    this.TREEVIEW_render_request(TREEVIEWrenderKind_Batch);
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_FullReset(timestamp) {
    this.ensure_boundingClientRect();

    this._ONSCROLLvirtualCount = this.virtualCount;

    this.virtualIndex_ofScrollTop = Math.floor(this.lastReadNumber_scrollTop / this.itemHeightNumber);
    this.beltIndexZero = 0;

    let totalCount = this.tvd_getTotalCount();

    if (this.itemListElement.children.length !== this.virtualCount) {
        this.itemListElement.innerHTML = '';

        // padding of 2ch (the style attribute receives the width as a pixel by using 'gINT_FIELDS[fEXPLORER_firstSpanWidthValue]' as a baseline (not quite ch))
        // TODO: this is all very inaccurate and prone to eventual rounding issues due to not monospace font.
        //
        this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING = 2;
        let widthAttributeValueNumber = Math.ceil((this.WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING + 2/*padding*/) * gINT_FIELDS[fEXPLORER_firstSpanWidthValue]);
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
        if (this.pullData_array) {
            this.pullData_array = new Uint32Array(this.virtualCount);
            this.pullData_array_count = 0;
        }

        this.TREEVIEW_ArrayFrom_itemListElement_children = Array.from(this.itemListElement.children);
        this.TREEVIEW_ArrayFrom_itemListElement_children_length = this.TREEVIEW_ArrayFrom_itemListElement_children.length;
    }

    // TODO: This if statement check is awkward because the previous if statement ought to have guaranteed this one to be true.
    if (this.itemListElement.children.length === this.virtualCount) {
        this.tvd_drawItem_BATCH(this.virtualIndex_ofScrollTop, this.virtualCount, 3, undefined, timestamp);
    }
}

/**
 * This actually only gets invoked if 'this.itemListElement.children.length !== this.virtualCount'...
 * ...But it is a bit more complicated if you want to involve a change to totalCount, you'd need to force the final 'else' case
 * so it is easier to just invoke this directly when you change totalCount?
 */
function EXPLORER_TreeViewDirector_draw_render_fullReset_request() {
    this.TREEVIEW_render_request(TREEVIEWrenderKind_FullReset);
}

/**
 * TODO: To detect whether the "expand/collapse icon" was clicked, the logic 'if(event.target === nodeElement.children[0])' is used...
 * ...this logic is flawed if one ever were to put an element within the span that became the target...
 * ...thus, you should consider checking the x position of the event against the x position of the nodeElement.children[0].
 * @param {*} event 
 */
function EXPLORER_TreeViewDirector_event_click(event_clientY, event_target) {
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
        return this.tvd_expandCollapseIconWasClicked_async(divItem, indexItem);
    }
    else {
        this.state_cursor_setIndex(indexItem);
    }
}

function EXPLORER_TreeViewDirector_event_dblclick(event_clientY, event_target) {
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
        return this.tvd_ondblclick_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
    }
}

function EXPLORER_TreeViewDirector_event_contextmenu(event_button, event_clientX, event_clientY) {
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
        return this.tvd_oncontextmenu_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event_button, event_clientX, event_clientY, beltIndexItem);
    } else {
        if (this.cursorIndex >= this.tvd_getTotalCount()) {
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
        return this.tvd_oncontextmenu_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event_button, event_clientX, event_clientY, beltIndexItem);
    }
}

function EXPLORER_TreeViewDirector_event_keydown(event) {
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
                return this.tvd_arrowRight_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
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
                return this.tvd_arrowLeft_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex);
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
            return this.tvd_onkeydown_async(this.TREEVIEW_ArrayFrom_itemListElement_children[beltIndexItem], this.cursorIndex, event.key);
    }
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Resize(timestamp) {
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
function EXPLORER_TreeViewDirector_event_windowResize() {
    this.TREEVIEW_render_request(TREEVIEWrenderKind_Resize);
}

function EXPLORER_TreeViewDirector_event_scroll() {
    this.lastReadNumber_scrollLeft = this.rootElement.scrollLeft;
    this.lastReadNumber_scrollTop = this.rootElement.scrollTop;
    this.TREEVIEW_render_request(TREEVIEWrenderKind_Scroll);
}

function EXPLORER_TreeViewDirector_ensure_boundingClientRect() {
    if (!this.boundingClientRect) {
        this.boundingClientRect = this.rootElement.getBoundingClientRect();
        this.virtualCount = Math.ceil(this.rootElement.offsetHeight / this.itemHeightNumber);
    }
}

function EXPLORER_TreeViewDirector_TREEVIEW_render_do_Cursor(index) {
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
function EXPLORER_TreeViewDirector_state_cursor_setIndex(index) {
    if (this.cursorIndex === index) return;
    this.cursorIndex = index;
    this.TREEVIEW_render_request(TREEVIEWrenderKind_Cursor);
}

/**
 * if (this.cursorIndex === index) return;
 * 
 * @param {*} indexItem 
 */
function EXPLORER_TreeViewDirector_state_cursor_validateIndex(indexItem) {
    if (indexItem >= this.tvd_getTotalCount()) {
        indexItem = this.tvd_getTotalCount() - 1;
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
function EXPLORER_TreeViewDirector_measureBaseElement() {
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





// ========
// ========
// ========
// ========
// ========
// ========

/** 8px by default or the measured value with px */
let EXPLORER_firstSpanWidth = '8px';

let EXPLORER_menuOptionCut_object = null;

let EXPLORER_director = new EXPLORER_TreeViewDirector();

function EXPLORER_init() {
    const EXPLORER_pickFolderOrWorkspaceButton = document.getElementById('EXPLORER_folderOrWorkspaceButtons');
    if (!EXPLORER_pickFolderOrWorkspaceButton) return;

    EXPLORER_pickFolderOrWorkspaceButton.addEventListener('click', EXPLORER_pickFolderOrWorkspaceButton_onClick);
    
    let toggleShowExplorerButton = document.getElementById('HEADER_toggleShowExplorer');
    toggleShowExplorerButton.checked = gBYTE_FIELDS[byteEXPLORER_show];
    toggleShowExplorerButton.addEventListener('click', toggleShowExplorerButton_onClick);
}

function toggleShowExplorerButton_onClick() {
    // TODO: Will shadowing 'toggleShowExplorerButton' with a declaration of the same name in here cause any oddities in relation to app long garbage collection overhead....
    // ...presumably the answer is 99.999% no but I can't bear to deal with this right now, thus the variable name 'avoidClosureCausingAppLongLivingVariable_toggleShowExplorerButton'.
    let avoidClosureCausingAppLongLivingVariable_toggleShowExplorerButton = document.getElementById('HEADER_toggleShowExplorer');
    if (avoidClosureCausingAppLongLivingVariable_toggleShowExplorerButton) {
        EXPLORER_setShow(avoidClosureCausingAppLongLivingVariable_toggleShowExplorerButton.checked);
    }
}

async function EXPLORER_pickFolderOrWorkspaceButton_onClick() {
    const EXPLORER_pickFolderOrWorkspaceButton = document.getElementById('EXPLORER_folderOrWorkspaceButtons');
    let optionList = [
        new MenuOption(CommandKind_SelectFolder, 'Folder', null),
        new MenuOption(CommandKind_SelectWorkspace, 'Workspace', null),
    ];
    let boundingClientRect = EXPLORER_pickFolderOrWorkspaceButton.getBoundingClientRect();
    await menuSet(/*context*/ 'EXPLORER_pickFolderOrWorkspaceButton', /*target*/ null, optionList, /*left*/ boundingClientRect.left, /*top*/ boundingClientRect.top + boundingClientRect.height, /*NOTshouldFocus*/ false, /*index*/ 0, /*onHideAction*/ null);
}

/**
Hiding an element's visibility rather than removing the HTML has a cost associated with it.
If a UI piece isn't integral to the app, I wouldn't even transitionally use this as a solution
because it could "slip through the cracks" and never get optimized.

That being said, the explorer in this app IS integral, so I'll go down this route to start off.

...more details involved but I'm thinking and deciding.
*/
function EXPLORER_setShow(shouldShow) {
    const EXPLORER_Element = document.getElementById('EXPLORER');
    if (!EXPLORER_Element) return;

	if (shouldShow && !gBYTE_FIELDS[byteEXPLORER_show]) {
		let editorHackElement = document.getElementById('EDI_hack');
		EXPLORER_Element.style.width = '200px';
		EXPLORER_Element.style.visibility = '';
		editorHackElement.style.width = 'calc(100% - 200px)';
		gBYTE_FIELDS[byteEXPLORER_show] = shouldShow;
		let toggleShowExplorerButton = document.getElementById('HEADER_toggleShowExplorer');
		toggleShowExplorerButton.checked = gBYTE_FIELDS[byteEXPLORER_show];
		EDI_onResize();
	}
	else if (!shouldShow && gBYTE_FIELDS[byteEXPLORER_show]) {
		// !show is redundant, but exists for readability.
		let editorHackElement = document.getElementById('EDI_hack');
		EXPLORER_Element.style.width = '0px';
		EXPLORER_Element.style.visibility = 'hidden';
		editorHackElement.style.width = '100%';
		gBYTE_FIELDS[byteEXPLORER_show] = shouldShow;
		let toggleShowExplorerButton = document.getElementById('HEADER_toggleShowExplorer');
		toggleShowExplorerButton.checked = gBYTE_FIELDS[byteEXPLORER_show];
		EDI_onResize();
	}
}

async function EXPLORER_openInEditor(absolutePath, shouldFocus) {
    const itHasBom = await window.myAPI.editorReadAllText(absolutePath);

    if (!itHasBom.text && itHasBom.text != '') {
        return;
    }

    EDI_setText(
        itHasBom.text,
        itHasBom.fileStartsWithBom,
        /*textSourceIdentifier*/ absolutePath,
        /*FORMATTED_textSourceIdentifier*/ itHasBom.formattedAbsolutePath,
        /*extensionKind*/ EDI_toExtensionKind(itHasBom.extension));
    if (shouldFocus) {
        let editor = document.getElementById('EDITOR');
        if (editor) {
            editor.focus();
        }
    }
}

async function EXPLORER_pickFolderOrWorkspaceButton_MenuOnClick(indexClicked, elementClicked) {
    const commandKind = parseInt(elementClicked.dataset.commandKind, 10);
    if (!commandKind) {
        return;
    }

    switch (commandKind) {
        case CommandKind_SelectFolder:
            {
                const EXPLORER_Element = document.getElementById('EXPLORER');
                if (!EXPLORER_Element) return;
                const EXPLORER_PickFolder = document.getElementById('EXPLORER_folderOrWorkspaceButtons');
                if (!EXPLORER_PickFolder) return;
    
                // { basename: basename, openedDirectory: openedDirectory }
                let chooseDirectoryResult = await window.myAPI.chooseDirectory();
                if (chooseDirectoryResult.canceled) return;
    
                EXPLORER_setShow(true);
                let chosenDirectory = chooseDirectoryResult.openedDirectory;
                EXPLORER_PickFolder.textContent = chooseDirectoryResult.basename;
                EXPLORER_PickFolder.title = chosenDirectory;
    
                EXPLORER_director.setChosenDirectory(chosenDirectory, chooseDirectoryResult.id);
                EXPLORER_director.setItems(gINT_FIELDS[fAPP_lineHeight], gINT_FIELDS[fAPP_lineHeight] + 'px');
                EXPLORER_director.draw_create_request(EXPLORER_Element, null);
            }
            break;
        case CommandKind_SelectWorkspace:
            {
                const EXPLORER_Element = document.getElementById('EXPLORER');
                if (!EXPLORER_Element) return;
                
                let chooseWorkspaceResult = await window.myAPI.chooseWorkspace();
                if (chooseWorkspaceResult.canceled) return;
    
                EXPLORER_setShow(true);
    
                let pickWorkspaceButton = document.getElementById('EXPLORER_folderOrWorkspaceButtons');
                pickWorkspaceButton.textContent = chooseWorkspaceResult.workspaceFileNameWithoutExtension;
                pickWorkspaceButton.title = chooseWorkspaceResult.workspaceFileAbsolutePath;
    
                EXPLORER_director.setChosenWorkspace(chooseWorkspaceResult);
                EXPLORER_director.setItems(gINT_FIELDS[fAPP_lineHeight], gINT_FIELDS[fAPP_lineHeight] + 'px');
                EXPLORER_director.draw_create_request(EXPLORER_Element, null);
            }
            break;
    }
}

async function EXPLORER_MenuOnClick(indexClicked, elementClicked) {
    const commandKind = parseInt(elementClicked.dataset.commandKind, 10);
    if (!commandKind) {
        return;
    }

    if (commandKind !== CommandKind_Cut & commandKind !== CommandKind_Paste) {
        EXPLORER_menuOptionCut_object = null;
    }

    switch (commandKind) {
        case CommandKind_Copy:
            if (MENU_target.id) {
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                await window.myAPI.setClipboard('file:///' + entry.absolutePath);
            }
            break;
        case CommandKind_Cut:
            // they don't fully work but I'm not feeling overly interested in anything at the moment I wanna just lay down and do nothing so I'm pleased that I did something at all
            if (MENU_target.id) {
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let text = 'file:///' + entry.absolutePath;
                EXPLORER_menuOptionCut_object = {
                    id: text,
                    indexItem: MENU_target.indexItem,
                    divRelativeIndex: MENU_target.divRelativeIndex
                };

                await window.myAPI.setClipboard(text);
            }
            break;
        case CommandKind_CopyAbsolutePath:
            if (MENU_target.id) {
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                await window.myAPI.setClipboard(entry.absolutePath);
            }
            break;
        case CommandKind_Paste:
            {
                EXPLORER_director.nodeList.getElementAt(MENU_target.indexItem);
                let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
                let depthOfTheParent = gINT_FIELDS[fTreeView_pooledNode_depth];
                let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

                let local_EXPLORER_menuOptionCut_object = EXPLORER_menuOptionCut_object;
                EXPLORER_menuOptionCut_object = null;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let pasteResult = await window.myAPI.copyClipboardAbsolutePathToDirectory(entry.absolutePath, local_EXPLORER_menuOptionCut_object?.id);
                if (pasteResult.success) {
                        /*
                        // TODO: I saw the result was success but the indexOf was -1 when adding a file with the same name twice that seems erroneous.

                        // TODO: I added 3 files total while testing various words that would alphabetically be placed at the start, end, or somewhere in the middle...
                        // ...I think the middle case for some reason ended up in the parent? I'm not quite sure what happened.
                        */

                        // TODO: I belive this final paste logic that comes after this comment and within this scope is extremely similar to the new file logic...

                        let nodeKind;
                        if (pasteResult.isDirectory) {
                            nodeKind = TreeViewNodeKind_isExpandable_NOTisExpanded;
                        }
                        else {
                            nodeKind = TreeViewNodeKind_NOTisExpandable_NOTisExpanded;
                        }

                        if (!isCollapsed) {
                            let targetDepth = depthOfTheParent + 1;
                            let someIndex = MENU_target.indexItem + 1;

                            // TODO: 'i_targetDepth' is a bad variable name, you're looping a minimum of until 'pasteResult.indexOf' and each loop you check
                            // whether that sibling is expanded, if so you skip all the children of the sibling.
                            //
                            for (let i_targetDepth = 0; i_targetDepth < pasteResult.indexOf; i_targetDepth++) {
                                EXPLORER_director.nodeList.getElementAt(someIndex);
                                let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
                                let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

                                let d_of_presumed_correct_depth = gINT_FIELDS[fTreeView_pooledNode_depth];
                                if (d_of_presumed_correct_depth !== targetDepth) {
                                    // Validate the target you paste into's child count
                                    break;
                                }

                                someIndex++;

                                if (!isCollapsed) {
                                    while (someIndex < EXPLORER_director.tvd_getTotalCount()) {
                                        let d_of_perhaps_too_large_depth = EXPLORER_director.nodeList.getDepth(someIndex);
                                        if (d_of_perhaps_too_large_depth > targetDepth) {
                                            someIndex++;
                                        }
                                        else {
                                            break;
                                        }
                                        // TODO: Check if depth is less than targetDepth? This would only happen if the tree view were somehow in an incorrect state.
                                    }
                                }

                                // TODO: You're missing a 'someIndex < EXPLORER_director.tvd_getTotalCount()' check for after the while loop.
                            }

                            EXPLORER_director.nodeList.insert(someIndex, nodeKind, pasteResult.pathId, MENU_target.depth + 1);

                            if (EXPLORER_director.virtualCount > 0) {
                                let largestIndexItemBeingShown = EXPLORER_director.virtualIndex_ofScrollTop + (EXPLORER_director.virtualCount - 1);
                                if (someIndex >= EXPLORER_director.virtualIndex_ofScrollTop && someIndex <= largestIndexItemBeingShown) {
                                    let finalDiv = EXPLORER_director.itemListElement.children[EXPLORER_director.itemListElement.children.length - 1];

                                    EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
                                    EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';

                                    // TODO: Check that the node you're pasting into is expanded.

                                    //await EXPLORER_director.tvd_drawItem_async(finalDiv, someIndex, /*isNull*/ false);
                                    if (someIndex !== largestIndexItemBeingShown) {
                                        //EXPLORER_director.itemListElement.insertBefore(finalDiv, EXPLORER_director.itemListElement.children[MENU_target.divRelativeIndex + 1 + pasteResult.indexOf]);
                                    }
                                }

                                if (pasteResult.sourceFileWasDeleted) {
                                    let id = local_EXPLORER_menuOptionCut_object.id;
                                    let indexItem = local_EXPLORER_menuOptionCut_object.indexItem;
                                    let divRelativeIndex = local_EXPLORER_menuOptionCut_object.divRelativeIndex;

                                    // TODO: it isn't just about whether the cut-directory is in the virtualization result...
                                    // ...if you paste below you could have some children of the cut-directory in view, but not the cut-directory itself.
        
                                    // TODO: Just check indexItem (is easier to tell whether the insertion happened "above" the cut items position in the treeview)?
                                    if (MENU_target.divRelativeIndex + 1 + pasteResult.indexOf >= local_EXPLORER_menuOptionCut_object.divRelativeIndex) {
                                        divRelativeIndex += 1;
                                        indexItem += 1;
                                    }
        
                                    if (divRelativeIndex <= largestIndexItemBeingShown) {

                                        let countOfMoreEntriesToShow = EXPLORER_director.tvd_getTotalCount() - (EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount);

                                        let countChanges;
                                        
                                        if (pasteResult.isDirectory) {
                                            countChanges = EXPLORER_director.removeFromNodeList(indexItem);
                                        }
                                        else {
                                            EXPLORER_director.nodeList.removeAt(indexItem, 1);
                                            countChanges = 1;
                                        }

                                        EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
                                        EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';

                                        let remainingChangesToRender = countChanges < EXPLORER_director.virtualCount ? countChanges : EXPLORER_director.virtualCount - divRelativeIndex;

                                        if (countOfMoreEntriesToShow > remainingChangesToRender) {
                                            countOfMoreEntriesToShow = remainingChangesToRender;
                                        }

                                        for (let i = 0; i < remainingChangesToRender; i++) {
                                            //let divItem = EXPLORER_director.itemListElement.children[divRelativeIndex];
                    
                                            // TODO: if you remove including the eventual final div in the itemListElement then this moving of the div isn't accomplishing anything and could be skipped.
                                            //EXPLORER_director.itemListElement.insertBefore(divItem, undefined);

                                            if (countOfMoreEntriesToShow <= 0) {
                                                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - 1, /*isNull*/ true);
                                            }
                                            else {
                                                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - (remainingChangesToRender - i), /*isNull*/ false);
                                                countOfMoreEntriesToShow--;
                                            }
                                        }
                                    }
                                }

                                // TODO: fine grained redrawing of only the nodes that are:
                                // - part of the virtualization result
                                // - and have changed in some way that necessitates their UI be redrawn
                                EXPLORER_director.draw_BATCH_request(EXPLORER_director.virtualIndex_ofScrollTop, EXPLORER_director.virtualCount, 3);
                            }
                        }
                    }
                break;
            }
        case CommandKind_NewFile_Directory:
            {
                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_InputText, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'filename', entry, MENU_target, NewFile_Directory_WIDGET_InputText_callback);
                break;
            }
        case CommandKind_NewFile_File:
            {
                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_InputText, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'filename', entry, MENU_target, NewFile_File_WIDGET_InputText_callback);
                break;
            }
        case CommandKind_DeleteFile_Directory:
            {
                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let filename = entry.basename;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_YesCancel, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'delete ' + filename, entry, MENU_target, DeleteFile_Directory_YesCancel_callback);
                break;
            }
        case CommandKind_DeleteFile_File:
            {
                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let filename = entry.basename;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_YesCancel, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'delete ' + filename, entry, MENU_target, DeleteFile_File_YesCancel_callback);
                break;
            }
        case CommandKind_RenameFile_Directory:
            {
                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let filename = entry.basename;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_InputText, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'rename', filename, {MENU_target:MENU_target, entry:entry}, RenameFile_Directory_InputText_callback);
                break;
            }
        case CommandKind_RenameFile_File:
            {
                /*
                Maybe the only difference between the _Directory and _File cases for each ..._...
                is the bool for isDirectory.

                But I'm exhausted and I cannot reduce the code duplication here because my head doesn't function.
                */

                if (!MENU_target.id) return;
                // TODO: optimize this?
                const entry = await window.myAPI.getFilesystemEntryById(MENU_target.id);
                if (!entry) return;
                let filename = entry.basename;
                gBYTE_FIELDS[byteMENU_HIDE_shouldRestoreFocus] = false;
                WIDGET_restoreFocusToElementOverride = MENU_restoreFocusToElement;
                await WIDGET_show(WidgetKind_InputText, gINT_FIELDS[fEXPLORER_menuOptionX], gINT_FIELDS[fEXPLORER_menuOptionY], 'rename', filename, {MENU_target: MENU_target, entry: entry}, RenameFile_File_InputText_callback);
                break;
            }
    }
}

async function NewFile_Directory_WIDGET_InputText_callback(result) {
    if (result.isCancelled) return;

    let entry = WIDGET_SHOW_value;

    EXPLORER_director.nodeList.getElementAt(WIDGET_target.indexItem);
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
    let depthOfTheParent = gINT_FIELDS[fTreeView_pooledNode_depth];
    let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

    let newFileResult = await window.myAPI.newFile(entry.absolutePath, result.value, /*isDirectory*/ true);
    if (newFileResult.success) {
        /*
        // TODO: I saw the result was success but the indexOf was -1 when adding a file with the same name twice that seems erroneous.

        // TODO: I added 3 files total while testing various words that would alphabetically be placed at the start, end, or somewhere in the middle...
        // ...I think the middle case for some reason ended up in the parent? I'm not quite sure what happened.
        */

        // TODO: I belive this final new directory logic that comes after this comment and within this scope is 1 to 1 an exact duplication of the new file logic...
        
        let nodeKind = TreeViewNodeKind_isExpandable_NOTisExpanded;

        if (!isCollapsed) {

            let targetDepth = depthOfTheParent + 1;
            let someIndex = WIDGET_target.indexItem + 1;

            // TODO: 'i_targetDepth' is a bad variable name, you're looping a minimum of until 'newFileResult.indexOf' and each loop you check
            // whether that sibling is expanded, if so you skip all the children of the sibling.
            //
            for (let i_targetDepth = 0; i_targetDepth < newFileResult.indexOf; i_targetDepth++) {
                EXPLORER_director.nodeList.getElementAt(someIndex);
                let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
                let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

                let d_of_presumed_correct_depth = gINT_FIELDS[fTreeView_pooledNode_depth];
                if (d_of_presumed_correct_depth !== targetDepth) {
                    // Validate the target you paste into's child count
                    break;
                }

                someIndex++;

                if (!isCollapsed) {
                    while (someIndex < EXPLORER_director.tvd_getTotalCount()) {
                        let d_of_perhaps_too_large_depth = EXPLORER_director.nodeList.getDepth(someIndex);
                        if (d_of_perhaps_too_large_depth > targetDepth) {
                            someIndex++;
                        }
                        else {
                            break;
                        }
                        // TODO: Check if depth is less than targetDepth? This would only happen if the tree view were somehow in an incorrect state.
                    }
                }

                // TODO: You're missing a 'someIndex < EXPLORER_director.tvd_getTotalCount()' check for after the while loop.
            }

            EXPLORER_director.nodeList.insert(someIndex, nodeKind, newFileResult.pathId, WIDGET_target.depth + 1);

            if (EXPLORER_director.virtualCount > 0) {
                let largestIndexItemBeingShown = EXPLORER_director.virtualIndex_ofScrollTop + (EXPLORER_director.virtualCount - 1);
                if (someIndex >= EXPLORER_director.virtualIndex_ofScrollTop && someIndex <= largestIndexItemBeingShown) {
                    //let finalDiv = EXPLORER_director.itemListElement.children[EXPLORER_director.itemListElement.children.length - 1];

                    EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
                    EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';

                    //await EXPLORER_director.tvd_drawItem_async(finalDiv, someIndex, /*isNull*/ false);
                    if (someIndex !== largestIndexItemBeingShown) {
                        //EXPLORER_director.itemListElement.insertBefore(finalDiv, EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex + 1 + newFileResult.indexOf]);
                    }
                }

                // TODO: fine grained redrawing of only the nodes that are:
                // - part of the virtualization result
                // - and have changed in some way that necessitates their UI be redrawn
                EXPLORER_director.draw_BATCH_request(EXPLORER_director.virtualIndex_ofScrollTop, EXPLORER_director.virtualCount, 3);
            }
        }
    }
}

async function NewFile_File_WIDGET_InputText_callback(result) {
    if (result.isCancelled) return;

    let entry = WIDGET_SHOW_value;
    
    EXPLORER_director.nodeList.getElementAt(WIDGET_target.indexItem);
    let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
    let depthOfTheParent = gINT_FIELDS[fTreeView_pooledNode_depth];
    let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

    let newFileResult = await window.myAPI.newFile(entry.absolutePath, result.value, /*isDirectory*/ false);
    if (newFileResult.success) {
        /*
        // TODO: I saw the result was success but the indexOf was -1 when adding a file with the same name twice that seems erroneous.

        // TODO: I added 3 files total while testing various words that would alphabetically be placed at the start, end, or somewhere in the middle...
        // ...I think the middle case for some reason ended up in the parent? I'm not quite sure what happened.
        */

        let nodeKind = TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

        if (!isCollapsed) {
            let targetDepth = depthOfTheParent + 1;
            let someIndex = WIDGET_target.indexItem + 1;

            // TODO: 'i_targetDepth' is a bad variable name, you're looping a minimum of until 'newFileResult.indexOf' and each loop you check
            // whether that sibling is expanded, if so you skip all the children of the sibling.
            //
            for (let i_targetDepth = 0; i_targetDepth < newFileResult.indexOf; i_targetDepth++) {
                EXPLORER_director.nodeList.getElementAt(someIndex);
                let nodeKind = gBYTE_FIELDS[byteTreeView_pooledNode_nodeKind];
                let isCollapsed = nodeKind === TreeViewNodeKind_isExpandable_NOTisExpanded || nodeKind === TreeViewNodeKind_NOTisExpandable_NOTisExpanded;

                let d_of_presumed_correct_depth = gINT_FIELDS[fTreeView_pooledNode_depth];
                if (d_of_presumed_correct_depth !== targetDepth) {
                    // Validate the target you paste into's child count
                    break;
                }

                someIndex++;

                if (!isCollapsed) {
                    while (someIndex < EXPLORER_director.tvd_getTotalCount()) {
                        let d_of_perhaps_too_large_depth = EXPLORER_director.nodeList.getDepth(someIndex);
                        if (d_of_perhaps_too_large_depth > targetDepth) {
                            someIndex++;
                        }
                        else {
                            break;
                        }
                        // TODO: Check if depth is less than targetDepth? This would only happen if the tree view were somehow in an incorrect state.
                    }
                }

                // TODO: You're missing a 'someIndex < EXPLORER_director.tvd_getTotalCount()' check for after the while loop.
            }

            EXPLORER_director.nodeList.insert(someIndex, nodeKind, newFileResult.pathId, WIDGET_target.depth + 1);
    
            if (EXPLORER_director.virtualCount > 0) {
                let largestIndexItemBeingShown = EXPLORER_director.virtualIndex_ofScrollTop + (EXPLORER_director.virtualCount - 1);
                if (someIndex >= EXPLORER_director.virtualIndex_ofScrollTop && someIndex <= largestIndexItemBeingShown) {
                    //let finalDiv = EXPLORER_director.itemListElement.children[EXPLORER_director.itemListElement.children.length - 1];
    
                    EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
                    EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';
    
                    //await EXPLORER_director.tvd_drawItem_async(finalDiv, someIndex, /*isNull*/ false);
                    if (someIndex !== largestIndexItemBeingShown) {
                        //EXPLORER_director.itemListElement.insertBefore(finalDiv, EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex + 1 + newFileResult.indexOf]);
                    }
                }
    
                // TODO: fine grained redrawing of only the nodes that are:
                // - part of the virtualization result
                // - and have changed in some way that necessitates their UI be redrawn
                EXPLORER_director.draw_BATCH_request(EXPLORER_director.virtualIndex_ofScrollTop, EXPLORER_director.virtualCount, 3);
            }
        }
    }
}

async function DeleteFile_Directory_YesCancel_callback(result) {
    if (result.isCancelled) return;
    let entry = WIDGET_SHOW_value;
    let deleteFileResult = await window.myAPI.deleteFile(entry.absolutePath, /*isDirectory*/ true);
    if (deleteFileResult) {
        let countOfMoreEntriesToShow = EXPLORER_director.tvd_getTotalCount() - (EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount);

        let countChanges = EXPLORER_director.removeFromNodeList(WIDGET_target.indexItem);

        EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
        EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';

        let remainingChangesToRender = countChanges < EXPLORER_director.virtualCount ? countChanges : EXPLORER_director.virtualCount - WIDGET_target.divRelativeIndex;

        if (countOfMoreEntriesToShow > remainingChangesToRender) {
            countOfMoreEntriesToShow = remainingChangesToRender;
        }

        for (let i = 0; i < remainingChangesToRender; i++) {
            //let divItem = EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex];

            // TODO: if you remove including the eventual final div in the itemListElement then this moving of the div isn't accomplishing anything and could be skipped.
            //EXPLORER_director.itemListElement.insertBefore(divItem, undefined);

            if (countOfMoreEntriesToShow <= 0) {
                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - 1, /*isNull*/ true);
            }
            else {
                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - (remainingChangesToRender - i), /*isNull*/ false);
                countOfMoreEntriesToShow--;
            }
        }

        // TODO: fine grained redrawing of only the nodes that are:
        // - part of the virtualization result
        // - and have changed in some way that necessitates their UI be redrawn
        EXPLORER_director.draw_BATCH_request(EXPLORER_director.virtualIndex_ofScrollTop, EXPLORER_director.virtualCount, 3);
    }
}

async function DeleteFile_File_YesCancel_callback(result) {
    if (result.isCancelled) return;
    // TODO: Biggest concern is that 'WIDGET_SHOW_value' is never set to a GC collectable state after widget finishes.
    // ...better wording of the TODO: the object that 'WIDGET_SHOW_value' references can never be garbage collected even after the widget finishes (unless a later show of a widget overrites the variable to reference a different object). This is because the variable is never set to null. Due to the variable being global, it exists for the entire app duration and a null set is required in this case for garbage collection of what it points to to take place.
    let entry = WIDGET_SHOW_value;
    let deleteFileResult = await window.myAPI.deleteFile(entry.absolutePath, /*isDirectory*/ false);
    if (deleteFileResult) {
        let noMoreEntriesToShow = EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount >= EXPLORER_director.tvd_getTotalCount();

        EXPLORER_director.nodeList.removeAt(WIDGET_target.indexItem, 1);

        if (EXPLORER_director.virtualCount > 0) {
            //let divItem = EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex];

            EXPLORER_director.itemHeightTotal = EXPLORER_director.tvd_getTotalCount() * EXPLORER_director.itemHeightNumber;
            EXPLORER_director.virtualizationElement.style.height = EXPLORER_director.itemHeightTotal + 'px';

            //EXPLORER_director.itemListElement.insertBefore(divItem, undefined);
            if (noMoreEntriesToShow) {
                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - 1, /*isNull*/ true);
            }
            else {
                //await EXPLORER_director.tvd_drawItem_async(divItem, EXPLORER_director.virtualIndex_ofScrollTop + EXPLORER_director.virtualCount - 1, /*isNull*/ false);
            }
        }

        // TODO: fine grained redrawing of only the nodes that are:
        // - part of the virtualization result
        // - and have changed in some way that necessitates their UI be redrawn
        EXPLORER_director.draw_BATCH_request(EXPLORER_director.virtualIndex_ofScrollTop, EXPLORER_director.virtualCount, 3);
    }
}

async function RenameFile_Directory_InputText_callback(result) {
    if (result.isCancelled) return;
    // TODO: Confusing, hacky, upsetting: 'WIDGET_target.entry / WIDGET_target.MENU_target'
    let entry = WIDGET_target.entry;
    WIDGET_target = WIDGET_target.MENU_target;
    let renameFileResult = await window.myAPI.renameFile(entry.absolutePath, result.value, /*isDirectory*/ true);
    if (renameFileResult.success) {
        EXPLORER_director.setNodeListEntryId(WIDGET_target.indexItem, renameFileResult.pathId);
        let divItem = EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex];
        divItem.lastChild.nodeValue = result.value;
    }
}

async function RenameFile_File_InputText_callback(result) {
    if (result.isCancelled) return;
    // TODO: Confusing, hacky, upsetting: 'WIDGET_target.entry / WIDGET_target.MENU_target'
    let entry = WIDGET_target.entry;
    WIDGET_target = WIDGET_target.MENU_target;
    let renameFileResult = await window.myAPI.renameFile(entry.absolutePath, result.value, /*isDirectory*/ false);
    if (renameFileResult.success) {
        EXPLORER_director.setNodeListEntryId(WIDGET_target.indexItem, renameFileResult.pathId);
        let divItem = EXPLORER_director.itemListElement.children[WIDGET_target.divRelativeIndex];
        divItem.lastChild.nodeValue = result.value;
    }
}
