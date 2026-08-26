const CommandKind_None = 0;
const CommandKind_Submenu = 1;
const CommandKind_Copy = 2;
const CommandKind_CopyAbsolutePath = 3;
const CommandKind_Cut = 4;
const CommandKind_Paste = 5;
const CommandKind_NewFile_Directory = 6;
const CommandKind_NewFile_File = 7;
const CommandKind_DeleteFile_Directory = 8;
const CommandKind_DeleteFile_File = 9;
const CommandKind_RenameFile_Directory = 10;
const CommandKind_RenameFile_File = 11;
const CommandKind_Find = 12;
const CommandKind_SelectFolder = 13;
const CommandKind_SelectWorkspace = 14;

/**
 * This needs to wrap the list.js?
 */
class MenuOption {
    commandKind = CommandKind_None;
    text = '';
    /**
     * If submenu is not null, the commandKind will be overriden to be CommandKind_Submenu
     * @type {MenuOption[]}
     */
    submenu = null;

    /**
     * @param {CommandKind} commandKind 
     * @param {string} text 
     * @param {MenuOption[]} submenu If submenu is not null, the commandKind will be overriden to be CommandKind_Submenu
     */
    constructor(commandKind, text, submenu) {
        this.commandKind = commandKind;
        this.text = text;
        if (submenu) {
            this.submenu = submenu;
        }
    }
}

// - [ ] ticketId
// - [ ] Show ...other Show => cancel first show because
// - [ ] Show Show doesn't focus inbetween
// - [ ] Essentially the show/hide is async, the render "doesn't need to be".
// - [ ] Hide Hide => ???
// - [ ] Hide rAF Hide => ???
// - [ ] Hide ...other Hide => ???
// - [ ] Should focus
// - [ ] Time between show and rAF_show if I hold down the arrow down event where does this event go? Because the focus is in the rAF.
// - [ ] To what degree of separation should the 'MENU_renderKindArray' be? None of the UI should share the same array?
// - [ ] Is the Menu a "cancelable" concept?

let MENU_ticketId_counter = 1;

/** TODO: It might read better to make this 'null' or something after you've drawn the pending. */
let MENU_ticketId_pending = 0;
let MENU_ticketId_drawn = 0;

let MENU_context = null;
let MENU_target = null;

let MENU_restoreFocusToElement = null;

////////
////////
////////

let MENU_recentBoundingClientRectTop = null;

let MENU_cursorIndex = 0;
/** By duplicating this you guarantee the initial cursor index is what was expected. */
let MENU_SET_index = 0;

let MENU_HIDE_shouldRestoreFocus = true;

let MENU_left = 0;
let MENU_top = 0;
let MENU_SET_NOTshouldFocus = false;

let MENU_renderKindArray = [];
let MENU_isRenderPending = false;

let MENU_renderKind_Set_countOfPendingRequests = 0;

let MENU_optionList = null;
/** TODO: Perhaps use 'MENU_optionList' instead? */
let MENU_ArrayFrom_menuOptionList_children = null;

let MENU_NOTshouldFocus = false;

// TODO: maybe the menu should always be empty, and just be some div that moves left top positions and you can put anything you want in it.

/** a delegate of kind: () => Promise */
let MENU_onHideAction = null;

let MENU_last_handled_ticketId = 0;

const MENUrenderKind_None = 0;
const MENUrenderKind_Cursor = 1;
const MENUrenderKind_Set = 2;
const MENUrenderKind_Hide = 3;

function MENU_render_request(renderKind) {
    if (MENU_renderKindArray[MENU_renderKindArray.length - 1] !== renderKind) {
        MENU_renderKindArray.push(renderKind);
        if (renderKind === MENUrenderKind_Set) MENU_renderKind_Set_countOfPendingRequests++;
    }
    
    if (!MENU_isRenderPending) {
        MENU_isRenderPending = true;
        requestAnimationFrame(MENU_render_do);
    }
}

function MENU_render_do() {
    let renderKind;
    
    while (renderKind = MENU_renderKindArray.shift()) {
        switch (renderKind) {
            case MENUrenderKind_Cursor:
                MENU_render_do_Cursor();
                break;
            case MENUrenderKind_Set:
                if (MENU_renderKind_Set_countOfPendingRequests-- > 1) break;
                MENU_render_do_Set();
                break;
            case MENUrenderKind_Hide:
                MENU_render_do_Hide();
                break;
        }
    }
    
    MENU_isRenderPending = false; // Reset the paint lock
}

function MENU_render_do_Hide() {
    const menu = document.getElementById('MENU');
    if (!menu) return;

    MENU_removeEvents();

    menu.remove();
    MENU_ArrayFrom_menuOptionList_children = null;

    // This changes after drawing at a different left/top thus needs be null'd out in the render function.
    MENU_recentBoundingClientRectTop = null;

    if (MENU_restoreFocusToElement) {
        if (MENU_HIDE_shouldRestoreFocus) {
            MENU_restoreFocusToElement.focus();
        }
        MENU_restoreFocusToElement = null;
    }
}

async function MENU_state_do_hide(shouldRestoreFocus) {

    if (MENU_onHideAction) {
        await MENU_onHideAction();
    }
    MENU_onHideAction = null;

    MENU_last_handled_ticketId = MENU_ticketId_drawn;

    MENU_optionList = null;

    //MENU_recentBoundingClientRectTop = null;

    MENU_context = null;
    MENU_target = null;

    if (shouldRestoreFocus === true || shouldRestoreFocus === false) {
        MENU_HIDE_shouldRestoreFocus = shouldRestoreFocus;
    }
}

async function menuHide(shouldRestoreFocus) {
    // TODO: Don't put this line here when you could instead just think about async code and figure out the truth of what will happen...
    // ...I'm anxious and can't think straight I swear...
    MENU_last_handled_ticketId = MENU_ticketId_drawn;
    await MENU_state_do_hide(shouldRestoreFocus);
    MENU_render_request(MENUrenderKind_Hide);
}

function MENU_render_do_Set() {
    let menuElement = document.getElementById('MENU');
    if (menuElement) {
        menuElement = null; // Superstitiously setting this to null in the name of GC, this is a bad thing to do because here it doesn't have any reason than anxiety and I'm giving into said anxiety and only making it stronger in the long run.
        MENU_render_do_Hide();
    }

    MENU_ticketId_drawn = MENU_ticketId_pending;

    menuElement = document.createElement('div');
    menuElement.id = 'MENU';
    menuElement.tabIndex = 0;
    document.body.appendChild(menuElement);

    if (MENU_optionList && MENU_optionList.length > 0) {
        let virtualizationBoundary = document.createElement('div');
        virtualizationBoundary.id = "MENU_virtualizationBoundary";
        let cursor = document.createElement('div');
        cursor.id = "MENU_cursor";
        let optionListElement = document.createElement('div');
        optionListElement.id = "MENU_optionList";
        menuElement.appendChild(virtualizationBoundary);
        menuElement.appendChild(cursor);
        menuElement.appendChild(optionListElement);
        MENU_addEvents();
        for (var i = 0; i < MENU_optionList.length; i++) {
            const entry = MENU_optionList[i];
            const optionElement = document.createElement('div');
            optionElement.className = 'menuOption';
            optionElement.textContent = entry.text;

            if (entry.submenu) {
                optionElement.setAttribute("data-command-kind", CommandKind_Submenu);
                optionElement.textContent += '>';
            }
            else {
                optionElement.setAttribute("data-command-kind", entry.commandKind);
            }

            optionListElement.appendChild(optionElement);
        }

        MENU_ArrayFrom_menuOptionList_children = Array.from(optionListElement.children);
    }

    //////////
    //////////
    //////////
    //////////

    // > When making a menu UI with vanilla javascript and rAF, how do people reposition the menu if it would go offscreen?
    //  
    // < Developers handle offscreen menus by calculating the menu's boundaries relative to the viewport and shifting its position if it overflows.
    // < Using requestAnimationFrame (rAF) ensures these calculations and visual updates sync perfectly with the browser's refresh rate, preventing layout stutter.

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalLeft = MENU_left;
    let finalTop = MENU_top;
    //let rect = menuElement.getBoundingClientRect();

    // Check right edge
    //if (rect.right > viewportWidth) {
    if (MENU_left + menuElement.offsetWidth > viewportWidth) {
      finalLeft = viewportWidth - menuElement.offsetWidth - 10; // 10px padding boundary
    }
    // Check left edge (fallback if menu is wider than screen)
    if (finalLeft < 0) finalLeft = 10;

    // Check bottom edge
    //if (rect.bottom > viewportHeight) {
    if (MENU_top + menuElement.offsetHeight > viewportHeight) {
      finalTop = viewportHeight - menuElement.offsetHeight - 10; 
    }
    // Check top edge
    if (finalTop < 0) finalTop = 10;

    // 3. Apply the corrected coordinates
    menuElement.style.left = `${finalLeft}px`;
    menuElement.style.top = `${finalTop}px`;

    /////////////
    /////////////
    /////////////
    /////////////

    if (!MENU_SET_index) {
        MENU_SET_index = 0;
    }
    if (MENU_cursorIndex !== MENU_SET_index) {
        MENU_state_do_Cursor(MENU_SET_index);
    }
    MENU_render_do_Cursor();

    MENU_restoreFocusToElement = document.activeElement;

    if (!MENU_SET_NOTshouldFocus) {
        menuElement.focus();
    }
}

async function menuSet(context, target, optionList, left, top, NOTshouldFocus, index, onHideAction) {
    MENU_ticketId_pending = MENU_ticketId_counter++;
    
    // TODO: These 'if (MENU_optionList)' and 'if (MENU_ArrayFrom_menuOptionList_children)' won't work because for some reason you decided that a menu could be "empty", thus these could be null and no longer would indicate that whether only the state function ran or both the state function and the render function ran or etc...
    if (MENU_optionList) {
        await MENU_state_do_hide();
    }

    MENU_left = left;
    MENU_top = top;

    if (index) {
        MENU_SET_index = index;
    }
    else {
        MENU_SET_index = 0; // an '|| 0' check in the preceeding 'if' would fall here anyways.
        // TODO: Is this just 'MENU_SET_index = index ?? 0;'
    }

    MENU_context = context;
    MENU_target = target;

    MENU_optionList = optionList;

    MENU_NOTshouldFocus = NOTshouldFocus;

    MENU_recentBoundingClientRectTop = null;

    MENU_render_request(MENUrenderKind_Set);
}

function MENU_onMouseMove(event) {
    // then cancel the throttle? That's what you were actually doing with the thing?

    if (!MENU_recentBoundingClientRectTop) {
        MENU_ensure_boundingClientRect();
    }

    let relativeY = event.clientY - (MENU_recentBoundingClientRectTop + 4 /*paddingTop*/);
    let index = Math.floor(relativeY / gINT_FIELDS[fAPP_lineHeight]);
    if (MENU_cursorIndex === index) {
        return;
    }
    
    MENU_setCursorIndex(index);
}

async function optionOnClick(indexClicked, elementClicked) {
    if (MENU_ticketId_drawn === MENU_ticketId_pending && MENU_ticketId_drawn !== MENU_last_handled_ticketId) {
        MENU_last_handled_ticketId = MENU_ticketId_drawn;
        MENU_HIDE_shouldRestoreFocus = true;
        switch (MENU_context) {
            case 'EXPLORER':
                await EXPLORER_MenuOnClick(indexClicked, elementClicked);
                break;
            case 'EDITOR':
                await EDI_MenuOnClick(indexClicked, elementClicked);
                break;
            case 'EXPLORER_pickFolderOrWorkspaceButton':
                await EXPLORER_pickFolderOrWorkspaceButton_MenuOnClick(indexClicked, elementClicked);
                break;
        }
    }
    await menuHide(/*shouldRestoreFocus*/ undefined);
}

/** mouse move handler has this explicit inlined (duplicated) due to the sheer frequency of its invocation */
function menuGetRelativeMouseEventData(event_clientY) {
    let paddingTop = 4;
    let relativeY = event_clientY - (MENU_recentBoundingClientRectTop + paddingTop);
    return Math.floor(relativeY / gINT_FIELDS[fAPP_lineHeight]);
}

function MENU_addEvents() {
    let menu = document.getElementById('MENU');
    if (!menu) return;
    menu.addEventListener('blur', menuHide); // TODO: should 'once' be used here?
    menu.addEventListener('click', MENU_onclick);
    menu.addEventListener('keydown', MENU_onKeyDown);
    menu.addEventListener('mousemove', MENU_onMouseMove);
}

function MENU_removeEvents() {
    let menu = document.getElementById('MENU');
    if (!menu) return;
    menu.removeEventListener('blur', menuHide); // TODO: should 'once' be used when adding?
    menu.removeEventListener('click', MENU_onclick);
    menu.removeEventListener('keydown', MENU_onKeyDown);
    menu.removeEventListener('mousemove', MENU_onMouseMove);
}

function MENU_onclick(event) {
    MENU_ensure_boundingClientRect();
    let indexClicked = menuGetRelativeMouseEventData(event.clientY);
    return optionOnClick(indexClicked, MENU_ArrayFrom_menuOptionList_children[indexClicked]);
}

function MENU_render_do_Cursor() {
    const cursorElement = document.getElementById('MENU_cursor');
    if (!cursorElement) return;
    // The menu 'padding-top: 4px'
    cursorElement.style.top = 4 + (gINT_FIELDS[fAPP_lineHeight] * MENU_cursorIndex) + 'px';
}

function MENU_state_do_Cursor(index) {
    if (index >= MENU_ArrayFrom_menuOptionList_children.length)
        index = MENU_ArrayFrom_menuOptionList_children.length - 1;
    
    if (index < 0)
        index = 0;

    MENU_cursorIndex = index;
}

function MENU_setCursorIndex(index) {
    MENU_state_do_Cursor(index);
    MENU_render_request(MENUrenderKind_Cursor);
}

// My only public C# repo is terrible too lol
// I threw it together to get a basic language server started I need time to revisit it
// "he keeps saying oh it's like C#... let's see what kind of C# he writes... well this C# code is even worse than his javascript"

// my body is in emotional pain but ima silently grind this out

// mainly I feel anxious, I feel like a clown. I feel like I'm completely incompetent at coding.

function MENU_validateCursor() {
    if (MENU_cursorIndex >= MENU_ArrayFrom_menuOptionList_children.length) {
        if (MENU_ArrayFrom_menuOptionList_children.length > 0) {
            MENU_setCursorIndex(MENU_ArrayFrom_menuOptionList_children.length - 1);
        }
        else {
            MENU_setCursorIndex(0);
        }
        return;
    }
    else if (MENU_cursorIndex < 0) {
        MENU_cursorIndex = 0;
    }
}

// > In JavaScript, when you have a function which returns a promise but does not await, do you still mark it as async?
//
// < No, you should not mark it as async if it simply returns a promise without using await inside.
//
// It's the same as C# then I wasn't sure.
//
// < The only time you must add async and await when returning a promise is if you want to catch errors inside that specific function.
// 
// < Performance Note: Avoid return await at the End
// |
// < If your goal is to have a clean final line, you might be tempted to use return await api.getStandardUser(userId).
// < While this works, it is an anti-pattern.
// < It forces the function to pause, unpack the promise value, and repack it into a new promise before returning it

function MENU_onKeyDown(event) {
    MENU_validateCursor();
    if (MENU_ArrayFrom_menuOptionList_children.length === 0) return;

    switch (event.key) {
        case 'ArrowDown':
            if (MENU_cursorIndex < MENU_ArrayFrom_menuOptionList_children.length - 1) {
                MENU_setCursorIndex(MENU_cursorIndex + 1);
            }
            break;
        case 'ArrowUp':
            if (MENU_cursorIndex > 0) {
                MENU_setCursorIndex(MENU_cursorIndex - 1);
            }
            break;
        case 'Escape':
            return menuHide(/*shouldRestoreFocus*/ true);
        case 'Enter':
        case ' ':
            return optionOnClick(MENU_cursorIndex, MENU_ArrayFrom_menuOptionList_children[MENU_cursorIndex]);
    }
}

function MENU_ensure_boundingClientRect() {
    if (!MENU_recentBoundingClientRectTop) {
        const menuElement = document.getElementById('MENU');
        if (!menuElement) return;
        MENU_recentBoundingClientRectTop = menuElement.getBoundingClientRect().top;
    }
}

// submenus:
// =========
// Add salt to the "MENU" id specifically.
// Then all the inner elements can be specified by the hardcoded index that they reside at within the "MENU" element's child list.

// Is blur event guaranteed if you click something other than the menu?
//
// ... in my app it seems to be guaranteed.
// but you no longer eat the mousedown event...
//
/*function listenHandlerToCloseMenu(event) {
    if (event.target.id === 'MENU_virtualizationBoundary' ||
        event.target.id === 'MENU_cursor' ||
        event.target.id === 'MENU_optionList' ||
        event.target.className === 'menuOption') {

        return;
    }
    event.preventDefault();
    event.stopPropagation();
    menuHide();
}*/
/*
//let bodyElement = document.getElementById('ROOT');
//bodyElement.removeEventListener('mousedown', listenHandlerToCloseMenu, /*useCapturing*//* true);
*/
/*
// Is blur event guaranteed if you click something other than the menu?
//
// ... in my app it seems to be guaranteed.
// but you no longer eat the mousedown event...
//
//let bodyElement = document.getElementById('ROOT');
//bodyElement.addEventListener('mousedown', listenHandlerToCloseMenu, /*useCapturing*//* true);
*/

/*
> How do you implement logic so that the menu "repositions itself" if it would go offscreen

< To keep your menu perfectly on-screen without causing layout thrashing, you must follow your engine's golden rule: perform all bounding-box reads first,
< execute your boundary math second, and write the final style adjustments last.
<
< Because a dynamic menu's physical width and height depend entirely on its contents (e.g., the number of list items or font sizes), you cannot hardcode its dimensions.
< You must measure the element, but you must do it safely within your rAF pipeline.
<
< ...

==========

Okay this is exactly why AI is so crazy good:

I'm playing guild wars 2 right now.

Someone say in 'map chat':
"hey guys, got a noob question. is there a way to get enemies to target my summons instead of me?"

I said:
"I think there's a utility ability that has the purpose of summoning someone that "tanks" for you but I don't think you can do that generally"

Then some random person said:
"www."

Presumably they either meant to say www.google.com or they said www. as a joking prod towards the idea or whatever but

Then OP said:
"ah i see, thanks"

=====

Back in the day, you couldn't just "word a google search like you would the question to randoms in map chat while playing an MMO"

These days... you can and it gives you a crystal clear answer immediately.

The times have changed and it is crazy I remember so many map chatters.

All their problems are solved by googling the exact sentence they send to map chat, I'm realizing this now.

Again for emphasis: no you weren't able to just "googling the exact sentence they send to map chat" back in the day.
Sometimes you got lucky but it actually didn't always work.
You had to put some extra effort in to wording it exactly right to get the proper search results.
(more so than you have to today with AI)

btw I had like 98% world completion or something and I realized that I have 0% completion of brisban wilds I think it's called.
Literally every last POI, waypoint, vista, etc... are all just this one zone lol.

"You've played this character 71 hours 10 minutes in the last 18 days."
"Among all your characters, you have played 72 hours and 4 minutes during the last 18 days."

Btw I stand firm that I still dislike "intrusive AI".
Like AI autocomplete and etc... that interrupt your train of thought with something that may or may not be complete fabrication
so you have to stop what you're thinking to validate whether you're being recommended a sensible code block or etc...

But when you can have your space without any AI
and then as desired ask AI for their input. That's where it shines.

100% world completion
100% personal story of central tyria
71 hours 57 minutes in the last 18 days
72 hours 51 minutes in the last 18 days across all characters

*/


