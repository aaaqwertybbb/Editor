let TOOLTIP_exists = false;

let TOOLTIP_pending_textContent = null;

/**
 * 0 => None
 * 1 => Show
 * 2 => Hide
 */
let TOOLTIP_pending_renderKind = 0;
let TOOLTIP_isRenderPending = false;

function TOOLTIP_render_request(renderKind) {
    TOOLTIP_pending_renderKind = renderKind;
    
    if (!TOOLTIP_isRenderPending) {
        TOOLTIP_isRenderPending = true;
        requestAnimationFrame(TOOLTIP_renderDo);
    }
}

function TOOLTIP_renderDo() {
    let renderKind = TOOLTIP_pending_renderKind;
    TOOLTIP_pending_renderKind = 0;

    if (renderKind === 1) {
        TOOLTIP_render_do_show();
    }
    else if (renderKind === 2) {
        TOOLTIP_render_do_hide();
    }
    else {
        throw new Error();
    }
    
    TOOLTIP_isRenderPending = false; // Reset the paint lock
};

function TOOLTIP_render_do_show() {
    TOOLTIP_render_request(1);

    let tooltipElement;

    if (TOOLTIP_exists) {
        tooltipElement = document.getElementById('TOOLTIP');
        // This is why I worry about doing a bool check in the other UIs
        // I worry about the state getting corrupted somehow.
        //
        // And then if it is truly meaningful from an optimization standpoint such as the scrolling of the editor
        // I take on the state corruption risk, otherwise I just defensively handle it.
        if (!tooltipElement) {
            TOOLTIP_exists = false;
            TOOLTIP_show(textContent);
            return;
        }
    }
    else {
        tooltipElement = document.createElement('div');
        tooltipElement.id = 'TOOLTIP';
        tooltipElement.style.left = '0px';
        tooltipElement.style.top = '0px';
        document.body.appendChild(tooltipElement);
    }
    
    // This was quickest first way of writing things that came to my mind.
    // I don't like it cause you're appending the child, then setting textContent
    // but it is sufficient for the first version.
    tooltipElement.textContent = TOOLTIP_pending_textContent;
    TOOLTIP_pending_textContent = null;

    TOOLTIP_exists = true;
}

function TOOLTIP_show(textContent) {
    TOOLTIP_pending_textContent = textContent;
    TOOLTIP_render_request(1);
}

function TOOLTIP_render_do_hide() {
    const tooltip = document.getElementById('TOOLTIP');
    if (tooltip) {
        tooltip.remove();
    }

    TOOLTIP_exists = false;
}

function TOOLTIP_hide() {
    TOOLTIP_pending_textContent = null;
    TOOLTIP_render_request(2);
}
