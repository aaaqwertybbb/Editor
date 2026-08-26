init();

function init() {
    document
        .getElementById('HEADER_buttonSettings')
        .addEventListener('click', HEADER_buttonSettings_onClick);

    window.myAPI.onMessage(window_myAPI_onMessage);

    const EDI_gotoF_button = document.getElementById('EDI_gotoF');
    EDI_gotoF_button.addEventListener('click', window.myAPI.editorDocumentSymbolsRequest);
    document.body.addEventListener('keydown', documentBody_onKeyDown);

    requestAnimationFrame(APP_render_init);
}

/**
 * TODO: "Nothing stops you" from interacting with the UI thus it is possible to do things pre-initialization? TODO: Don't let this be the case?
 */
function APP_render_init() {
    APP_measureLineHeightAndCharacterWidth();
    EXPLORER_init();
    EDI_init();
}

function APP_measureLineHeightAndCharacterWidth() {
    const measureElement = document.createElement('div');
    measureElement.textContent = "0";
    measureElement.style.width = "fit-content";
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.padding = '0';
    measureElement.style.border = 'none';
    measureElement.style.left = '0';
    measureElement.style.top = '0';

    // AI is saying "// The foolproof way to prevent ALL scrollbars during measurement" is this paragraph of code.
    // The foolproof way to prevent ALL scrollbars during measurement
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed'; // Removes it from the normal page layout flow
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '0';        // Forces a tiny container footprint
    wrapper.style.height = '0';       // Forces a tiny container footprint
    wrapper.style.overflow = 'hidden'; // Prevents any layout leaking out or causing scrollbars
    wrapper.style.visibility = 'hidden'; // Keeps it completely invisible to the user

    wrapper.appendChild(measureElement);
    document.body.appendChild(wrapper);

    gINT_FIELDS[fAPP_lineHeight] = Math.ceil(measureElement.getBoundingClientRect().height);

    // This permits me to in 'explorer.js' set the first span of every "tree-view-node" to be the same width, regardless of whether its content is '-', '+', or '' (an empty string).
    // In theory this width calculation and 'gINT_FIELDS[fAPP_lineHeight]' can be done at the same time. But combining the steps could result in confusion or unexpected side effects when trying to modify lineheight or width but then again they do rely on the same css styling so you're already doing this
    measureElement.textContent = "-";
    const minusWidth = Math.ceil(measureElement.getBoundingClientRect().width);
    measureElement.textContent = "+";
    const plusWidth = Math.ceil(measureElement.getBoundingClientRect().width);
    const largerWidth = minusWidth > plusWidth ? minusWidth : plusWidth; // 11
    EXPLORER_firstSpanWidthValue = largerWidth;
    EXPLORER_firstSpanWidth = EXPLORER_firstSpanWidthValue + 'px';

    wrapper.removeChild(measureElement);
    document.body.removeChild(wrapper);

    const root = document.documentElement;
    const computedStyles = window.getComputedStyle(root);
    const appLineHeight = gINT_FIELDS[fAPP_lineHeight] + 'px';
    const propertyName = '--APP-line-height';
    if (computedStyles.getPropertyValue(propertyName) !== appLineHeight) {
        root.style.setProperty(propertyName, appLineHeight);
    }
}

async function window_myAPI_onMessage(data) {
    if (data.method === 'textDocument/documentSymbol') {
        EDI_documentSymbolResult = data.result;
        if (!EDI_listComponent) {
            EDI_listComponent = new ListComponent();
        }
        EDI_listComponent.setItems(gINT_FIELDS[fAPP_lineHeight], gINT_FIELDS[fAPP_lineHeight] + 'px',
            EDI_listComponent_drawItemAction,
            EDI_listComponent_onkeydownAction,
            EDI_listComponent_getItemsCountFunc);
        return DIALOG_show_async(DialogKind_DocumentSymbol, dialog_documentSymbol_onResizeAction);
    }
    else if (data.method === 'textDocument/CustomFullFileLexRequest') {

        //let abc123 = 
        //'{"data_literal":{"0":2,"1":128,"2":2403,"3":2,"4":2533,"5":888,"6":2,"7":3482,"8":29,"9":2,"10":3753,"11":163,"12":2,"13":3959,"14":298,"15":2,"16":4344,"17":293,"18":2,"19":5174,"20":371,"21":2,"22":6134,"23":114,"24":2,"25":6915,"26":865,"27":2,"28":7962,"29":909,"30":2,"31":8916,"32":504,"33":2,"34":9470,"35":333,"36":2,"37":10408,"38":279,"39":2,"40":11968,"41":76,"42":2,"43":12693,"44":108,"45":2,"46":12851,"47":124,"48":2,"49":13039,"50":151,"51":2,"52":13372,"53":154,"54":2,"55":13783,"56":32,"57":2,"58":14872,"59":136,"60":2,"61":17630,"62":300,"63":2,"64":26791,"65":307,"66":2,"67":27100,"68":1610,"69":2,"70":28802,"71":192,"72":2,"73":30374,"74":93,"75":2,"76":35602,"77":64,"78":2,"79":35855,"80":281,"81":2,"82":43729,"83":1515,"84":2,"85":47223,"86":398,"87":2,"88":52404,"89":471,"90":2,"91":53202,"92":441,"93":2,"94":54715,"95":1199,"96":2,"97":57228,"98":219,"99":2,"100":59687,"101":1120,"102":2,"103":60969,"104":248,"105":2,"106":61857,"107":215,"108":2,"109":62116,"110":491,"111":2,"112":65697,"113":41,"114":2,"115":68480,"116":41,"117":2,"118":69904,"119":41,"120":2,"121":70352,"122":41,"123":2,"124":72284,"125":41,"126":2,"127":74341,"128":41,"129":2,"130":76281,"131":41,"132":2,"133":78225,"134":41,"135":2,"136":83117,"137":444,"138":2,"139":85074,"140":959,"141":2,"142":86437,"143":134,"144":2,"145":87477,"146":422,"147":2,"148":91179,"149":632,"150":2,"151":93563,"152":706,"153":2,"154":94964,"155":205,"156":2,"157":96252,"158":223,"159":2,"160":97624,"161":522,"162":2,"163":102077,"164":214,"165":2,"166":102908,"167":41,"168":2,"169":111712,"170":541,"171":2,"172":113395,"173":371,"174":2,"175":121721,"176":272,"177":2,"178":122413,"179":298,"180":2,"181":130528,"182":54,"183":2,"184":130836,"185":54,"186":2,"187":138179,"188":54,"189":2,"190":139321,"191":119,"192":2,"193":139855,"194":81,"195":2,"196":140295,"197":81,"198":2,"199":140963,"200":54,"201":2,"202":141280,"203":54,"204":2,"205":141591,"206":65,"207":2,"208":142284,"209":65,"210":2,"211":142631,"212":140,"213":2,"214":150771,"215":65,"216":2,"217":151466,"218":681,"219":2,"220":153302,"221":106,"222":2,"223":189581,"224":417,"225":2,"226":206557,"227":41,"228":2,"229":216395,"230":41,"231":2,"232":222976,"233":257,"234":2,"235":227742,"236":156,"237":2,"238":228693,"239":168,"240":2,"241":232325,"242":77,"243":2,"244":235762,"245":151,"246":2,"247":241676,"248":64,"249":2,"250":248862,"251":151,"252":2,"253":255273,"254":76,"255":2,"256":257191,"257":41,"258":2,"259":258314,"260":109,"261":2,"262":258963,"263":331,"264":2,"265":263110,"266":134,"267":2,"268":274672,"269":187,"270":2,"271":276562,"272":113,"273":2,"274":276790,"275":223,"276":2,"277":278440,"278":371,"279":2,"280":283242,"281":143,"282":2,"283":294866,"284":2667,"285":2,"286":299162,"287":2168,"288":2,"289":309345,"290":75,"291":2,"292":311252,"293":484,"294":2,"295":318604,"296":75,"297":2,"298":319259,"299":71,"300":2,"301":319381,"302":509,"303":2,"304":319900,"305":750,"306":2,"307":323164,"308":41,"309":2,"310":327784,"311":46,"312":2,"313":328066,"314":46,"315":2,"316":328941,"317":283,"318":2,"319":342079,"320":757,"321":2,"322":343523,"323":277,"324":2,"325":345246,"326":170,"327":2,"328":350575,"329":13228,"330":2,"331":363818,"332":354,"333":2,"334":364200,"335":23,"336":0,"337":0,"338":0,"339":0,"340":0,"341":0,"342":0,"343":0,"344":0,"345":0,"346":0,"347":0,"348":0,"349":0,"350":0,"351":0,"352":0,"353":0,"354":0,"355":0,"356":0,"357":0,"358":0,"359":0,"360":0,"361":0,"362":0,"363":0,"364":0,"365":0,"366":0,"367":0,"368":0,"369":0,"370":0,"371":0,"372":0,"373":0,"374":0,"375":0,"376":0,"377":0,"378":0,"379":0,"380":0,"381":0,"382":0,"383":0},"capacity_literal":384,"capacity_abstract":128,"count_abstract":112,"field_count":3,"trackedSyntaxKind_offset":0,"start_offset":1,"length_offset":2}';

        //let threeTwoOneCba = JSON.parse(abc123);
        //let zebra = 'lemon';

        /*
        The C# code:
        ```csharp
        _psuedoFourFieldTrackedSyntaxList.Add((int)TrackedSyntaxKind.String);
        _psuedoFourFieldTrackedSyntaxList.Add(token.Position.line);
        _psuedoFourFieldTrackedSyntaxList.Add(token.Position.character);
        _psuedoFourFieldTrackedSyntaxList.Add(token.Length);
        ```
        */
        let fieldCount = 4;

        if (data.result.length % fieldCount !== 0) {
            throw new Error('mismatched field count');
        }

        let data_countAbstract = data.result.length / fieldCount;

        let trackedSyntaxList = new TrackedSyntaxList(data_countAbstract);

        // '_psuedoFourFieldTrackedSyntaxList.Add((int)TrackedSyntaxKind.Comment);'
        // 
        // was the code being ran for multiline comments as well I see them correctly now.
        //
        // - [x] That being said the multiline backtick strings are wrong.
        //
        // Length is gonna be wrong too cause of crlf and tabs.

        // TODO: Don't do this, there likely are existing functions that will do this.
        for (let i = 0; i < data_countAbstract; i++) {
            let trackedSyntaxKind = data.result[(i * fieldCount) + 0];
            let line = data.result[(i * fieldCount) + 1];
            let character = data.result[(i * fieldCount) + 2];
            let length = data.result[(i * fieldCount) + 3];

            let lineStart;
            //let lineEnd;
            if (line < EDI_lineEndPositionList.count) {
                if (line === 0) {
                    lineStart = 0;
                    //lineEnd = EDI_lineEndPositionList.data[line] - 0;
                }
                else {
                    lineStart = (EDI_lineEndPositionList.data[line - 1] + 1);
                    //lineEnd = EDI_lineEndPositionList.data[line];
                }
            }
            else {
                lineStart = 0;
                //lineEnd = 0;
            }

            let start = lineStart + character;

            trackedSyntaxList.insert(
                trackedSyntaxList.count_abstract,
                trackedSyntaxKind,
                start,
                length);

            //let c0 = trackedSyntaxKind;
            //let c1 = start;
            //let c2 = length;
//
            //let p0 = threeTwoOneCba.data_literal[(i * 3) + 0];
            //let p1 = threeTwoOneCba.data_literal[(i * 3) + 1];
            //let p2 = threeTwoOneCba.data_literal[(i * 3) + 2];
//
            //if (c0 !== p0) {
            //    console.log('0');
            //}
            //if (c1 !== p1) {
            //    console.log('1');
            //}
            //if (c2 !== p2) {
            //    console.log('2');
            //}
        }


        // The start positions are wrong ooo okay

        // Also this code silently has some wild side story to it.
        //
        // I tried re-use the random name abc123 but 321cba isn't a valid identifier cause it starts with a number lol

        //for (let i = 0; i < trackedSyntaxList.count_abstract; i++) {
//
        //    let c0 = trackedSyntaxList.data_literal[(i * 3) + 0];
        //    let c1 = trackedSyntaxList.data_literal[(i * 3) + 1];
        //    let c2 = trackedSyntaxList.data_literal[(i * 3) + 2];
//
        //    let p0 = threeTwoOneCba.data_literal[(i * 3) + 0];
        //    let p1 = threeTwoOneCba.data_literal[(i * 3) + 1];
        //    let p2 = threeTwoOneCba.data_literal[(i * 3) + 2];
//
        //    if (c0 !== p0) {
        //        console.log('0');
        //    }
        //    if (c1 !== p1) {
        //        console.log('1');
        //    }
        //    if (c2 !== p2) {
        //        console.log('2');
        //    }
        //}

        EDI_trackedSyntaxList = trackedSyntaxList;
    }
    else if (data.method === 'textDocument/hover') {
        if (!gBYTE_FIELDS[byteEDI_mousemove_eventListener_isActive]) {
            TOOLTIP_show(data.result);
        }
    }
    else if (data.method === 'textDocument/definition') {
        let aaa = 2;
        if (data.result) {
            EDI_moveCursor_indexLine_indexColumn(data.result.range.start.line, /*indexColumn*/ 0)
        }
    }
    else if (data.method === 'textDocument/completion') {
        if (data.result.items) {
            AUTOCOMPLETE_show(data.result);
        }
    }
    else if (data.method === 'textDocument/completion_slice') {
        // I don't think 'slice' is in LSP specification but I need to start like this cause it is only way I'll get something "initially working".
        //if (data.result.items) {
        //    AUTOCOMPLETE_show(data.result);
        //}
        AUTOCOMPLETE_slice(data.result);
    }
}

function EDI_listComponent_getItemsCountFunc() {
    if (EDI_documentSymbolResult) {
        return EDI_documentSymbolResult.length;
    }
    else {
        return 0;
    }
}

function EDI_listComponent_onkeydownAction(div, index) {
    if (index === -1) {
        // TODO: if (index === -1)
    }
    else {
        // TODO: Ensure that json parsing the title like this is a safe way of doing things
        const startPosition = JSON.parse(div.title);
        EDI_moveCursor_indexLine_indexColumn(startPosition.line, startPosition.character);
    }
}

function EDI_listComponent_drawItemAction(div, index) {
    if (index === -1) {
        div.textContent = '';
        div.title = '';
        div.style.display = 'none';
    }
    else {
        let item = EDI_documentSymbolResult[index];
        div.textContent = item.name;
        div.title = JSON.stringify(item.range.start);
        div.style.display = '';
    }
}

function dialog_documentSymbol_onResizeAction() {
    if (EDI_listComponent) {
        EDI_listComponent.boundingClientRect = null;
        EDI_listComponent.event_scroll();
    }
}

async function documentBody_onKeyDown(event) {
    switch (event.key) {
        case 's':
        case 'S':
            if (!event.ctrlKey) return;
            const unvalidatedAbsolutePath = EDI_textSourceIdentifier;
            const rawData = EDI_getFinalizedEditsAndRawSaveFileData();
            if (rawData.uint8arrayTextBytes) {
                event.preventDefault();
                event.stopPropagation();
                return window.myAPI.editorSaveFile(unvalidatedAbsolutePath, rawData.uint8arrayTextBytes, rawData.countOfBytesInUse, rawData.lineEndString, rawData.fileStartsWithBom);
            }
            return;
        case 'F':
            if (!event.ctrlKey) return;
            return DIALOG_show_async(DialogKind_FindAll);
        case 'Escape':
            // TODO: Provide a way to disable the next (body, and useCapture) 'Escape' keypress...
            // ...so a widget can restore focus to the relevant UI rather than
            // the 'EDITOR' when the user presses 'Escape' to "cancel".
            const editor = document.getElementById('EDITOR');
            if (editor) {
                editor.focus();
            }
            return;
        case 'e':
            if (event.altKey) {
                EXPLORER_setShow(true);
                const EXPLORER_Element = document.getElementById('EXPLORER');
                if (EXPLORER_Element.children.length === 1) {
                    EXPLORER_Element.children[0].focus();
                }
            }
            return;
        case 'E':
            if (event.altKey && event.shiftKey) {
                const editor = document.getElementById('EDITOR');
                if (editor) {
                    editor.focus();
                    EXPLORER_setShow(false);
                }
            }
            return;
        case 'd':
            if (event.altKey) {
                const dialogCloseButton = document.getElementById('DIALOG_closeButton');
                if (dialogCloseButton) {
                    dialogCloseButton.focus();
                }
            }
            return;
        case 'h':
            if (event.altKey) {
                const settingsButton = document.getElementById('HEADER_buttonSettings');
                if (settingsButton) {
                    settingsButton.focus();
                }
            }
            return;
    }
}

async function HEADER_buttonSettings_onClick() {
    return DIALOG_show_async(DialogKind_Settings);
}
