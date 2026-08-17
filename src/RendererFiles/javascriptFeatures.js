//__#__
// preprocessor.cjs
import "./fieldBuffer"
//__#__

function JS_line_lex(div, substart, lineEnd, childIndex) {
    let pos = substart;

    let bytes = EDITOR_textByteList.bytes;

    let span;
    let textContent;
    let className;

    /**
     * At times you are accumulating a larger and larger span of text, up until the point of encountering a differing syntax.
     * The textContent variable might already be in use for the differing syntax.
     * Thus in those scenarios the flushTextContent contains the prior accumulated text that you need to write out prior to the encountered syntax.
     */
    let flushTextContent;

    let shouldSkipContiguous;

    while (pos < lineEnd) {
        switch (bytes[pos]) {
            case 97:  // a
            case 98:  // b
            case 99:  // c
            case 100: // d
            case 101: // e
            case 102: // f
            case 103: // g
            case 104: // h
            case 105: // i
            case 106: // j
            case 107: // k
            case 108: // l
            case 109: // m
            case 110: // n
            case 111: // o
            case 112: // p
            case 113: // q
            case 114: // r
            case 115: // s
            case 116: // t
            case 117: // u
            case 118: // v
            case 119: // w
            case 120: // x
            case 121: // y
            case 122: // z
            case 65:  // A
            case 66:  // B
            case 67:  // C
            case 68:  // D
            case 69:  // E
            case 70:  // F
            case 71:  // G
            case 72:  // H
            case 73:  // I
            case 74:  // J
            case 75:  // K
            case 76:  // L
            case 77:  // M
            case 78:  // N
            case 79:  // O
            case 80:  // P
            case 81:  // Q
            case 82:  // R
            case 83:  // S
            case 84:  // T
            case 85:  // U
            case 86:  // V
            case 87:  // W
            case 88:  // X
            case 89:  // Y
            case 90:  // Z
            case 95:  // _
                let wordstart = pos;

                // you don't know if a word is a keyword until you've read the keyword.
                // so until that point you're tracking it along with all the other text/whitespace on the line
                // and planning to make everything just a single span.

                let charIntSum = 0;

                outer: while (pos < lineEnd) {
                    switch (bytes[pos]) {
                        case 97:  // a
                        case 98:  // b
                        case 99:  // c
                        case 100: // d
                        case 101: // e
                        case 102: // f
                        case 103: // g
                        case 104: // h
                        case 105: // i
                        case 106: // j
                        case 107: // k
                        case 108: // l
                        case 109: // m
                        case 110: // n
                        case 111: // o
                        case 112: // p
                        case 113: // q
                        case 114: // r
                        case 115: // s
                        case 116: // t
                        case 117: // u
                        case 118: // v
                        case 119: // w
                        case 120: // x
                        case 121: // y
                        case 122: // z
                        case 65:  // A
                        case 66:  // B
                        case 67:  // C
                        case 68:  // D
                        case 69:  // E
                        case 70:  // F
                        case 71:  // G
                        case 72:  // H
                        case 73:  // I
                        case 74:  // J
                        case 75:  // K
                        case 76:  // L
                        case 77:  // M
                        case 78:  // N
                        case 79:  // O
                        case 80:  // P
                        case 81:  // Q
                        case 82:  // R
                        case 83:  // S
                        case 84:  // T
                        case 85:  // U
                        case 86:  // V
                        case 87:  // W
                        case 88:  // X
                        case 89:  // Y
                        case 90:  // Z
                        case 95:  // _
                        case 48:  // 0
                        case 49:  // 1
                        case 50:  // 2
                        case 51:  // 3
                        case 52:  // 4
                        case 53:  // 5
                        case 54:  // 6
                        case 55:  // 7
                        case 56:  // 8
                        case 57:  // 9
                            charIntSum += bytes[pos];
                            pos++;
                            break;
                        default:
                            break outer;
                    }
                }
                // heuristic for possible keyword is comparing char int sum:
                //
                // const
                // c 99
                // o 111
                // n 110
                // s 115
                // t 116
                //
                // 551
                // 
                let wordlength = pos - wordstart;
                switch (charIntSum) {
                    case 551: // const
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 99  /* 'c' */ &&
                            bytes[wordstart + 1] === 111 /* 'o' */ &&
                            bytes[wordstart + 2] === 110 /* 'n' */ &&
                            bytes[wordstart + 3] === 115 /* 's' */ &&
                            bytes[wordstart + 4] === 116 /* 't' */) {
                                className = 'eK';
                                textContent = 'const';
                                break;
                        }
                        className = '';
                        break;
                    case 325: // let
                        if (wordlength === 3 &&
                            bytes[wordstart + 0] === 108 /* 'l' */ &&
                            bytes[wordstart + 1] === 101 /* 'e' */ &&
                            bytes[wordstart + 2] === 116 /* 't' */) {
                                className = 'eK';
                                textContent = 'let';
                                break;
                        }
                        className = '';
                        break;
                    case 870: // function
                        if (wordlength === 8 &&
                            bytes[wordstart + 0] === 102 /* 'f' */ &&
                            bytes[wordstart + 1] === 117 /* 'u' */ &&
                            bytes[wordstart + 2] === 110 /* 'n' */ &&
                            bytes[wordstart + 3] === 99  /* 'c' */ &&
                            bytes[wordstart + 4] === 116 /* 't' */ &&
                            bytes[wordstart + 5] === 105 /* 'i' */ &&
                            bytes[wordstart + 6] === 111 /* 'o' */ &&
                            bytes[wordstart + 7] === 110 /* 'n' */) {
                                className = 'eK';
                                textContent = 'function';
                                break;
                        }
                        className = '';
                        break;
                    case 207: // if
                        if (wordlength === 2 &&
                            bytes[wordstart + 0] === 105 /* 'i' */ &&
                            bytes[wordstart + 1] === 102 /* 'f' */) {
                                className = 'eKC';
                                textContent = 'if';
                                break;
                        }
                        className = '';
                        break;
                    case 351: // try
                        if (wordlength === 3 &&
                            bytes[wordstart + 0] === 116 /* 't' */ &&
                            bytes[wordstart + 1] === 114 /* 'r' */ &&
                            bytes[wordstart + 2] === 121 /* 'y' */) {
                                className = 'eK';
                                textContent = 'try';
                                break;
                        }
                        className = '';
                        break;
                    case 327: // for
                        if (wordlength === 3 &&
                            bytes[wordstart + 0] === 102 /* 'f' */ &&
                            bytes[wordstart + 1] === 111 /* 'o' */ &&
                            bytes[wordstart + 2] === 114 /* 'r' */) {
                                className = 'eKC';
                                textContent = 'for';
                                break;
                        }
                        className = '';
                        break;
                    case 329: // var
                        if (wordlength === 3 &&
                            bytes[wordstart + 0] === 118 /* 'v' */ &&
                            bytes[wordstart + 1] === 97  /* 'a' */ &&
                            bytes[wordstart + 2] === 114 /* 'r' */) {
                                className = 'eK';
                                textContent = 'var';
                                break;
                        }
                        className = '';
                        break;
                    case 515: // catch
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 99  /* 'c' */ &&
                            bytes[wordstart + 1] === 97  /* 'a' */ &&
                            bytes[wordstart + 2] === 116 /* 't' */ &&
                            bytes[wordstart + 3] === 99  /* 'c' */ &&
                            bytes[wordstart + 4] === 104 /* 'h' */) {
                                className = 'eK';
                                textContent = 'catch';
                                break;
                        }
                        className = '';
                        break;
                    case 672: // return
                        if (wordlength === 6 &&
                            bytes[wordstart + 0] === 114 /* 'r' */ &&
                            bytes[wordstart + 1] === 101 /* 'e' */ &&
                            bytes[wordstart + 2] === 116 /* 't' */ &&
                            bytes[wordstart + 3] === 117 /* 'u' */ &&
                            bytes[wordstart + 4] === 114 /* 'r' */ &&
                            bytes[wordstart + 5] === 110 /* 'n' */) {
                                className = 'eKC';
                                textContent = 'return';
                                break;
                        }
                        className = '';
                        break;
                    case 658: // switch
                        if (wordlength === 6 &&
                            bytes[wordstart + 0] === 115 /* 's' */ &&
                            bytes[wordstart + 1] === 119 /* 'w' */ &&
                            bytes[wordstart + 2] === 105 /* 'i' */ &&
                            bytes[wordstart + 3] === 116 /* 't' */ &&
                            bytes[wordstart + 4] === 99  /* 'c' */ &&
                            bytes[wordstart + 5] === 104 /* 'h' */) {
                                className = 'eKC';
                                textContent = 'switch';
                                break;
                        }
                        className = '';
                        break;
                    case 412: // case
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 99  /* 'c' */ &&
                            bytes[wordstart + 1] === 97  /* 'a' */ &&
                            bytes[wordstart + 2] === 115 /* 's' */ &&
                            bytes[wordstart + 3] === 101 /* 'e' */) {
                                className = 'eKC';
                                textContent = 'case';
                                break;
                        }
                        className = '';
                        break;
                    case 542: // async
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 97  /* 'a' */ &&
                            bytes[wordstart + 1] === 115 /* 's' */ &&
                            bytes[wordstart + 2] === 121 /* 'y' */ &&
                            bytes[wordstart + 3] === 110 /* 'n' */ &&
                            bytes[wordstart + 4] === 99  /* 'c' */) {
                                className = 'eK';
                                textContent = 'async';
                                break;
                        }
                        className = '';
                        break;
                    case 425: // else
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 101 /* 'e' */ &&
                            bytes[wordstart + 1] === 108 /* 'l' */ &&
                            bytes[wordstart + 2] === 115 /* 's' */ &&
                            bytes[wordstart + 3] === 101 /* 'e' */) {
                                className = 'eKC';
                                textContent = 'else';
                                break;
                        }
                        className = '';
                        break;
                    case 741: // default
                        if (wordlength === 7 &&
                            bytes[wordstart + 0] === 100 /* 'd' */ &&
                            bytes[wordstart + 1] === 101 /* 'e' */ &&
                            bytes[wordstart + 2] === 102 /* 'f' */ &&
                            bytes[wordstart + 3] === 97  /* 'a' */ &&
                            bytes[wordstart + 4] === 117 /* 'u' */ &&
                            bytes[wordstart + 5] === 108 /* 'l' */ &&
                            bytes[wordstart + 6] === 116 /* 't' */) {
                                className = 'eK';
                                textContent = 'default';
                                break;
                        }
                        className = '';
                        break;
                    case 564: // throw
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 116 /* 't' */ &&
                            bytes[wordstart + 1] === 104 /* 'h' */ &&
                            bytes[wordstart + 2] === 114 /* 'r' */ &&
                            bytes[wordstart + 3] === 111 /* 'o' */ &&
                            bytes[wordstart + 4] === 119 /* 'w' */) {
                                className = 'eK';
                                textContent = 'throw';
                                break;
                        }
                        className = '';
                        break;
                    case 330: // new
                        if (wordlength === 3 &&
                            bytes[wordstart + 0] === 110 /* 'n' */ &&
                            bytes[wordstart + 1] === 101 /* 'e' */ &&
                            bytes[wordstart + 2] === 119 /* 'w' */) {
                                className = 'eK';
                                textContent = 'new';
                                break;
                        }
                        className = '';
                        break;
                    case 534: // class
                        if (wordlength === 5) {
                            if (bytes[wordstart + 0] === 97  /* 'a' */ &&
                                bytes[wordstart + 1] === 119 /* 'w' */ &&
                                bytes[wordstart + 2] === 97  /* 'a' */ &&
                                bytes[wordstart + 3] === 105 /* 'i' */ &&
                                bytes[wordstart + 4] === 116 /* 't' */) {
                                
                                    className = 'eK';
                                	textContent = 'await';
                                    break;
                            }
                            else if (bytes[wordstart + 0] === 99  /* 'c' */ &&
                                     bytes[wordstart + 1] === 108 /* 'l' */ &&
                                     bytes[wordstart + 2] === 97  /* 'a' */ &&
                                     bytes[wordstart + 3] === 115 /* 's' */ &&
                                     bytes[wordstart + 4] === 115 /* 's' */) {

                                    className = 'eK';
                                	textContent = 'class';
                                    break;
                            }
                        }
                        className = '';
                        break;
                    case 1222: // constructor
                        if (wordlength === 11 &&
                            bytes[wordstart + 0] === 99   /* 'c' */ &&
                            bytes[wordstart + 1] === 111  /* 'o' */ &&
                            bytes[wordstart + 2] === 110  /* 'n' */ &&
                            bytes[wordstart + 3] === 115  /* 's' */ &&
                            bytes[wordstart + 4] === 116  /* 't' */ &&
                            bytes[wordstart + 5] === 114  /* 'r' */ &&
                            bytes[wordstart + 6] === 117  /* 'u' */ &&
                            bytes[wordstart + 7] === 99   /* 'c' */ &&
                            bytes[wordstart + 8] === 116  /* 't' */ &&
                            bytes[wordstart + 9] === 111  /* 'o' */ &&
                            bytes[wordstart + 10] === 114 /* 'r' */) {
                                className = 'eK';
                                textContent = 'constructor';
                                break;
                        }
                        className = '';
                        break;
                    case 667: // import
                        if (wordlength === 6 &&
                            bytes[wordstart + 0] === 105 /* 'i' */ &&
                            bytes[wordstart + 1] === 109 /* 'm' */ &&
                            bytes[wordstart + 2] === 112 /* 'p' */ &&
                            bytes[wordstart + 3] === 111 /* 'o' */ &&
                            bytes[wordstart + 4] === 114 /* 'r' */ &&
                            bytes[wordstart + 5] === 116 /* 't' */) {
                                className = 'eKC';
                                textContent = 'import';
                                break;
                        }
                        className = '';
                        break;
                    case 436: // from
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 102 /* 'f' */ &&
                            bytes[wordstart + 1] === 114 /* 'r' */ &&
                            bytes[wordstart + 2] === 111 /* 'o' */ &&
                            bytes[wordstart + 3] === 109 /* 'm' */) {
                                className = 'eKC';
                                textContent = 'from';
                                break;
                        }
                        className = '';
                        break;
                    case 674: // export
                        if (wordlength === 6 &&
                            bytes[wordstart + 0] === 101 /* 'e' */ &&
                            bytes[wordstart + 1] === 120 /* 'x' */ &&
                            bytes[wordstart + 2] === 112 /* 'p' */ &&
                            bytes[wordstart + 3] === 111 /* 'o' */ &&
                            bytes[wordstart + 4] === 114 /* 'r' */ &&
                            bytes[wordstart + 5] === 116 /* 't' */) {
                                className = 'eK';
                                textContent = 'export';
                                break;
                        }
                        className = '';
                        break;
                    case 440: // this
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 116 /* 't' */ &&
                            bytes[wordstart + 1] === 104 /* 'h' */ &&
                            bytes[wordstart + 2] === 105 /* 'i' */ &&
                            bytes[wordstart + 3] === 115 /* 's' */) {
                                className = 'eK';
                                textContent = 'this';
                                break;
                        }
                        className = '';
                        break;
                    case 537: // while
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 119 /* 'w' */ &&
                            bytes[wordstart + 1] === 104 /* 'h' */ &&
                            bytes[wordstart + 2] === 105 /* 'i' */ &&
                            bytes[wordstart + 3] === 108 /* 'l' */ &&
                            bytes[wordstart + 4] === 101 /* 'e' */) {
                                className = 'eKC';
                                textContent = 'while';
                                break;
                        }
                        className = '';
                        break;
                    case 517: // break
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 98  /* 'b' */ &&
                            bytes[wordstart + 1] === 114 /* 'r' */ &&
                            bytes[wordstart + 2] === 101 /* 'e' */ &&
                            bytes[wordstart + 3] === 97  /* 'a' */ &&
                            bytes[wordstart + 4] === 107 /* 'k' */) {
                                className = 'eKC';
                                textContent = 'break';
                                break;
                        }
                        className = '';
                        break;
                    case 869: // continue
                        if (wordlength === 8 &&
                            bytes[wordstart + 0] === 99  /* 'c' */ &&
                            bytes[wordstart + 1] === 111 /* 'o' */ &&
                            bytes[wordstart + 2] === 110 /* 'n' */ &&
                            bytes[wordstart + 3] === 116 /* 't' */ &&
                            bytes[wordstart + 4] === 105 /* 'i' */ &&
                            bytes[wordstart + 5] === 110 /* 'n' */ &&
                            bytes[wordstart + 6] === 117 /* 'u' */ &&
                            bytes[wordstart + 7] === 101 /* 'e' */) {
                                className = 'eKC';
                                textContent = 'continue';
                                break;
                        }
                        className = '';
                        break;
                    case 448: // true
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 116 /* 't' */ &&
                            bytes[wordstart + 1] === 114 /* 'r' */ &&
                            bytes[wordstart + 2] === 117 /* 'u' */ &&
                            bytes[wordstart + 3] === 101 /* 'e' */) {
                                className = 'eK';
                                textContent = 'true';
                                break;
                        }
                        className = '';
                        break;
                    case 523: // false
                        if (wordlength === 5 &&
                            bytes[wordstart + 0] === 102 /* 'f' */ &&
                            bytes[wordstart + 1] === 97  /* 'a' */ &&
                            bytes[wordstart + 2] === 108 /* 'l' */ &&
                            bytes[wordstart + 3] === 115 /* 's' */ &&
                            bytes[wordstart + 4] === 101 /* 'e' */) {
                                className = 'eK';
                                textContent = 'false';
                                break;
                        }
                        className = '';
                        break;
                    case 443: // null
                        if (wordlength === 4 &&
                            bytes[wordstart + 0] === 110 /* 'n' */ &&
                            bytes[wordstart + 1] === 117 /* 'u' */ &&
                            bytes[wordstart + 2] === 108 /* 'l' */ &&
                            bytes[wordstart + 3] === 108 /* 'l' */) {
                                className = 'eK';
                                textContent = 'null';
                                break;
                        }
                        className = '';
                        break;
                    default:
                        className = '';
                        break;
                }
                if (className) {
                    // is done when there IS a valid match, in order to write out any pending text that came prior to the keyword.
                    if (substart < wordstart) {
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = wordstart));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }

                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = className;
                        span.textContent = textContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.className = className;
                        span.textContent = textContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                    substart += wordlength;
                }
                continue;
            case get_js_FORWARDSLASH():
                if (bytes[pos + 1] === get_js_FORWARDSLASH()) {

                    if (substart < pos) {
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }

                    // lex_comment_singleLine(...)

                    // The current character is the first forward slash of the 'two consecutive ones' that represent the start of a single line comment.
                    // "changing" this to guarantee at least 1 read means you can continue after the invocation returns (for the while loop)
                    // All in all, this already was guaranteed to read at least 1 since the while loop's condition in this method
                    // This change is moreso a matter of anxiety and me not wanting to deal with this at the moment so I need to see the explicit read here so I can sleep at night for the time being until my stress levels are lower.
                    pos++;
                    while (pos < lineEnd) {
                        if (bytes[pos] === get_js_LINEFEED()) {
                            break;
                        }
                        pos++;
                    }

                    // TODO: I think checking this is redundant because you guaranteed at least one increment?
                    if (substart < pos) {
                        textContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = 'eC';
                            span.textContent = textContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.className = 'eC';
                            span.textContent = textContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }

                    continue;
                }
                else if (bytes[pos + 1] === get_js_ASTERISK()) {
                    if (substart < pos) { // write any text that came prior, and on the same line.
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }

                    // Move past the 'forwardslash and asterisk'
                    pos += 2;

                    // I'm starting this at 2 because 0 would bug (-1 + 1 === 0)
                    // but then I just don't want to deal with this so I need to go 1,
                    // then like I'm tired and I don't want to deal with this so I'll just go to 2 and surely nothing bad can happen
                    // but in reality I probably only need to start at 1 (or start of other ticket variables + 2 or something idk I don't wanna deal with this right now).
                    let ticketSource = 2;
                    let ticketAsterisk = -1;
                    let ticketForwardSlash = -1;
                    while (pos < lineEnd) {
                        switch (bytes[pos]) {
                            case get_js_ASTERISK():
                                ticketAsterisk = ticketSource++;
                                break;
                            case get_js_FORWARDSLASH():
                                ticketForwardSlash = ticketSource++;
                                break;
                            case get_js_LINEFEED():
                                ticketSource++;
                                break;
                            default:
                                ticketSource++;
                                break;
                        }
                        pos++;
                        if (ticketAsterisk + 1 === ticketForwardSlash) {
                            break;
                        }
                    }

                    textContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = 'eCm';
                        span.textContent = textContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.className = 'eCm';
                        span.textContent = textContent;
                        div.appendChild(span);
                        childIndex++;
                    }

                    continue;
                }

                break;
            case get_js_DOUBLEQUOTE():
                if (substart < pos) {
                    flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = '';
                        span.textContent = flushTextContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.textContent = flushTextContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                }
                // This code is somewhat a duplication of 'function lex_string(...)'
                //
                // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                pos++;
                outer: while (pos < lineEnd) {
                    switch (bytes[pos]) {
                        case get_js_DOUBLEQUOTE():
                            pos++;
                            break outer;
                        case get_js_BACKSLASH():
                            pos++;
                            if (pos < lineEnd) {
                                pos++; // skip the escaped character provided that the file didn't end after the original backslash
                            }
                            continue /*outer*/;
                        default:
                            pos++;
                            break;
                    }
                }
                textContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                if (childIndex < div.children.length) {
                    span = div.children[childIndex++];
                    span.className = 'eS';
                    span.textContent = textContent;
                }
                else {
                    span = document.createElement('span');
                    span.className = 'eS';
                    span.textContent = textContent;
                    div.appendChild(span);
                    childIndex++;
                }
                continue;
            case get_js_SINGLEQUOTE():
                if (substart < pos) {
                    flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = '';
                        span.textContent = flushTextContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.textContent = flushTextContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                }
                // This code is somewhat a duplication of 'function lex_string(...)'
                //
                // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                pos++;
                outer: while (pos < lineEnd) {
                    switch (bytes[pos]) {
                        case get_js_SINGLEQUOTE():
                            pos++;
                            break outer;
                        case get_js_BACKSLASH():
                            pos++;
                            if (pos < lineEnd) {
                                pos++; // skip the escaped character provided that the file didn't end after the original backslash
                            }
                            continue /*outer*/;
                        default:
                            pos++;
                            break;
                    }
                }
                textContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                if (childIndex < div.children.length) {
                    span = div.children[childIndex++];
                    span.className = 'eS';
                    span.textContent = textContent;
                }
                else {
                    span = document.createElement('span');
                    span.className = 'eS';
                    span.textContent = textContent;
                    div.appendChild(span);
                    childIndex++;
                }
                continue;
            case get_js_BACKTICK():
                if (substart < pos) {
                    flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = '';
                        span.textContent = flushTextContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.textContent = flushTextContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                }
                // This code is somewhat a duplication of 'function lex_string(...)'
                //
                // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                pos++;
                outer: while (pos < lineEnd) {
                    switch (bytes[pos]) {
                        case get_js_BACKTICK():
                            pos++;
                            break outer;
                        case get_js_BACKSLASH():
                            pos++;
                            if (pos < lineEnd) {
                                pos++; // skip the escaped character provided that the file didn't end after the original backslash
                            }
                            continue /*outer*/;
                        default:
                            pos++;
                            break;
                    }
                }
                textContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                if (childIndex < div.children.length) {
                    span = div.children[childIndex++];
                    span.className = 'eSm';
                    span.textContent = textContent;
                }
                else {
                    span = document.createElement('span');
                    span.className = 'eSm';
                    span.textContent = textContent;
                    div.appendChild(span);
                    childIndex++;
                }
                continue;
            case get_js_EQUALS():
                // I think I actually want to handle the '==', '===', and '===...=' cases just so I can skip over the text quickly.
                // Otherwise every time I see '=' I have to check the left and right side and it is quite redundant?
                //
                // I also have to consider anything of the form '+=' then typing '=' after it for '+=='. I don't think this is valid but I need to consider it I'll probably skip over any '=' that appear after the first '+=' text and is contiguous?
                // No that doesn't work because you're adding this step to every syntax that ends in '=' that it has to understand the '=' case.
                // What you want is a left check, but that the left check only happens once per contiguous block of '=' incase the left '=' isn't part of your syntax.
                //
                
                // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in ="...
                // ...this presumption permits checking only the text that is in bounds of substart and lineEnd.
                
                // TODO: This contiguous skipping logic isn't working for every switch case?
                //
                // TODO: If this contiguous skipping logic works for the '=' it will handle both '!=' and '!==' solely by checking for '!='
                //
                // let shouldSkipContiguous;... sneaky uninitialized variable conversion to a falsey or something was going on?
                shouldSkipContiguous = false;
                if (pos > substart) {
                    if (bytes[pos - 1] === get_js_EQUALS()) {
                        shouldSkipContiguous = true;
                    }
                    else if (bytes[pos - 1] === get_js_BANG()) {
                        shouldSkipContiguous = true;
                    }
                    else if (bytes[pos - 1] === get_js_OPENBRACKET()) {
                        shouldSkipContiguous = true;
                    }
                    else if (bytes[pos - 1] === get_js_CLOSEBRACKET()) {
                        shouldSkipContiguous = true;
                    }
                }
                else {
                    shouldSkipContiguous = false;
                }
                if (!shouldSkipContiguous) {
                    if (pos < lineEnd && bytes[pos + 1] === get_js_EQUALS()) {
                        shouldSkipContiguous = true;
                    }
                }
                
                if (shouldSkipContiguous) {
                    // skip current
                    pos++;
                    // skip contiguous
                    while (pos < lineEnd && bytes[pos] === get_js_EQUALS()) {
                        pos++;
                    }
                    continue;
                }
                else {
                    if (substart < pos) { // write any text that came prior, and on the same line.
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }
                    // I don't know if I would count '=>' as an "assignment operator"... maybe I would but I'm too focused on whether I'd count it as such that I can't figure out the way to make it work. So I need to just make it work first.
                    pos++;
                    substart++;
                    if (pos < lineEnd && bytes[pos] === get_js_CLOSEBRACKET()) {
                        textContent = '=>';
                        pos++;
                        substart++;
                    }
                    else {
                        textContent = '=';
                    }
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = 'eOA';
                        span.textContent = textContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.className = 'eOA';
                        span.textContent = textContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                    continue;
                }
                
                // TODO: you don't understand how code caching or like instruction caching etc works with respect to whether inlining interupts things
                break;
            case get_js_PLUS():
                // ++
                // +=
                
                // If "some syntax that I don't actually think exists" such as '=+' were to exist I'd need to care for '=+' then a '+' making '=++'
                // this should cause a skipping of contiguous '+' in my initial opinion so that's what I'll probably do.
                // 
                // I have a better example now... '++' then you type '+' causing '+++', the first two '++' are syntax highlighted and the third isn't.
                // Some might say you should not syntax highlight any of the plus in that case because you're reading the operator as '++'
                // rather than the combination of '++' and '+'. I think I'm somewhat indifferent but I lean towards syntax highlighting
                // the two plus characters and not doing so for the final '+' (at least my initial opinion is that).
                //
                // ++++
                // It doesn't actually work... I tried it and '+++' works but then '++++' is two '++' rather than one '++' and then just the "text of '++'".
                //
                
                // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in +"...
                // ...this presumption permits checking only the text that is in bounds of substart and lineEnd.
                
                // TODO: This contiguous skipping logic isn't working for every switch case?
                shouldSkipContiguous = pos > substart && bytes[pos - 1] === get_js_PLUS();
                if (!shouldSkipContiguous) {
                    if (pos < lineEnd) {
                        if (bytes[pos + 1] === get_js_PLUS()) {
                            textContent = '++';
                        }
                        else if (bytes[pos + 1] === get_js_EQUALS()) {
                            textContent = '+=';
                        }
                        else {
                            shouldSkipContiguous = true;
                        }
                    }
                    else {
                        shouldSkipContiguous = true;
                    }
                }
                
                if (shouldSkipContiguous) {
                    // skip current
                    pos++;
                    // skip contiguous
                    while (pos < lineEnd && bytes[pos] === get_js_PLUS()) {
                        pos++;
                    }
                    continue;
                }
                else {
                    if (substart < pos) { // write any text that came prior, and on the same line.
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }
                    pos += 2;
                    substart += 2;
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = 'eOA';
                        span.textContent = textContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.className = 'eOA';
                        span.textContent = textContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                    continue;
                }
            case get_js_MINUS():
                // --
                // -=
                
                // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in -"...
                // ...this presumption permits checking only the text that is in bounds of substart and lineEnd.
                
                // When you switch on '+' then check for '-' or '+'... should you do something relating to NOT invoking the decode function and instead
                // you just "know" the text that goes there based on your conditional branching?
                    
                // TODO: This contiguous skipping logic isn't working for every switch case?
                shouldSkipContiguous = pos > substart && bytes[pos - 1] === get_js_MINUS();
                if (!shouldSkipContiguous) {
                    if (pos < lineEnd) {
                        if (bytes[pos + 1] === get_js_MINUS()) {
                            textContent = '--';
                        }
                        else if (bytes[pos + 1] === get_js_EQUALS()) {
                            textContent = '-=';
                        }
                        else {
                            shouldSkipContiguous = true;
                        }
                    }
                    else {
                        shouldSkipContiguous = true;
                    }
                }
                
                if (shouldSkipContiguous) {
                    // skip current
                    pos++;
                    // skip contiguous
                    while (pos < lineEnd && bytes[pos] === get_js_MINUS()) {
                        pos++;
                    }
                    continue;
                }
                else {
                    if (substart < pos) { // write any text that came prior, and on the same line.
                        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
                        if (childIndex < div.children.length) {
                            span = div.children[childIndex++];
                            span.className = '';
                            span.textContent = flushTextContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.textContent = flushTextContent;
                            div.appendChild(span);
                            childIndex++;
                        }
                    }
                    pos += 2;
                    substart += 2;
                    if (childIndex < div.children.length) {
                        span = div.children[childIndex++];
                        span.className = 'eOA';
                        span.textContent = textContent;
                    }
                    else {
                        span = document.createElement('span');
                        span.className = 'eOA';
                        span.textContent = textContent;
                        div.appendChild(span);
                        childIndex++;
                    }
                    continue;
                }
        }
        pos++;
    }

    // TODO: Consider the final pos? Is this gonna bug? I don't think it will.
    if (substart < pos) {
        flushTextContent = EDITOR_decoder.decode(bytes.subarray(substart, substart = pos));
        if (childIndex < div.children.length) {
            span = div.children[childIndex++];
            span.className = '';
            span.textContent = flushTextContent;
        }
        else {
            span = document.createElement('span');
            span.textContent = flushTextContent;
            div.appendChild(span);
            childIndex++;
        }
    }

    return childIndex;
}

function JS_line_lex_newVersion(div, beltIndexOfDiv, trackedSyntax_I, lineStart) {
    
    
    // 3. V8 Hidden Optimization Trick: textContent Hardcoding.
    // Do this ONCE before entering the scanner engine
    //const sourceText = String(div.children[0].textContent); 

    const divSpanTextContent = String(div.children[0].textContent);
    let divSpanTextContentLength = divSpanTextContent.length;

    let divChildrenInitialLength = div.children.length;

    let childIndex = 0;

    let substart = 0;
    
    let pos = 0;

    let span;
    let textContent;
    let className;

    /**
     * At times you are accumulating a larger and larger span of text, up until the point of encountering a differing syntax.
     * The textContent variable might already be in use for the differing syntax.
     * Thus in those scenarios the flushTextContent contains the prior accumulated text that you need to write out prior to the encountered syntax.
     */
    let flushTextContent;

    let shouldSkipContiguous;

    let createTrackedSyntaxFlag = false;
    let createDoLexFlag = false;
    // I keep reading this variable name and it makes me extremely anxious
    // I'm worried that by calling the variable this that I will become exhausted by nature of having named the variable that
    // and that like saying the variable in my mind is making me exhausted.
    let trackedSyntaxExhausted = false;

    let subend = divSpanTextContentLength;

    while (pos < divSpanTextContentLength) {
        if (createDoLexFlag) {

            while (pos < subend) {

// > I have an upsetting switch statement that checks for non-digits, then within that a switch statement that has all the outer cases however additionally has 0,1...9
// 
// < ...
// < Instead of duplicating your entire keyword switch block inside an inner nesting, you can cleanly solve this by separating your scanner logic into two steps:
// < The Initial Character Check (the gatekeeper) and The Loop (the collector).
// < ...

// not doing this right now though tired

                switch (divSpanTextContent[pos]) {
                    case 'a':
                    case 'b':
                    case 'c':
                    case 'd':
                    case 'e':
                    case 'f':
                    case 'g':
                    case 'h':
                    case 'i':
                    case 'j':
                    case 'k':
                    case 'l':
                    case 'm':
                    case 'n':
                    case 'o':
                    case 'p':
                    case 'q':
                    case 'r':
                    case 's':
                    case 't':
                    case 'u':
                    case 'v':
                    case 'w':
                    case 'x':
                    case 'y':
                    case 'z':
                    case 'A':
                    case 'B':
                    case 'C':
                    case 'D':
                    case 'E':
                    case 'F':
                    case 'G':
                    case 'H':
                    case 'I':
                    case 'J':
                    case 'K':
                    case 'L':
                    case 'M':
                    case 'N':
                    case 'O':
                    case 'P':
                    case 'Q':
                    case 'R':
                    case 'S':
                    case 'T':
                    case 'U':
                    case 'V':
                    case 'W':
                    case 'X':
                    case 'Y':
                    case 'Z':
                    case '_':
                        let wordstart = pos;

                        // you don't know if a word is a keyword until you've read the keyword.
                        // so until that point you're tracking it along with all the other text/whitespace on the line
                        // and planning to make everything just a single span.

                        let charIntSum = 0;

                        outer: while (pos < subend) {
                            switch (divSpanTextContent[pos]) {
                                case 'a':
                                case 'b':
                                case 'c':
                                case 'd':
                                case 'e':
                                case 'f':
                                case 'g':
                                case 'h':
                                case 'i':
                                case 'j':
                                case 'k':
                                case 'l':
                                case 'm':
                                case 'n':
                                case 'o':
                                case 'p':
                                case 'q':
                                case 'r':
                                case 's':
                                case 't':
                                case 'u':
                                case 'v':
                                case 'w':
                                case 'x':
                                case 'y':
                                case 'z':
                                case 'A':
                                case 'B':
                                case 'C':
                                case 'D':
                                case 'E':
                                case 'F':
                                case 'G':
                                case 'H':
                                case 'I':
                                case 'J':
                                case 'K':
                                case 'L':
                                case 'M':
                                case 'N':
                                case 'O':
                                case 'P':
                                case 'Q':
                                case 'R':
                                case 'S':
                                case 'T':
                                case 'U':
                                case 'V':
                                case 'W':
                                case 'X':
                                case 'Y':
                                case 'Z':
                                case '_':
                                case '0':
                                case '1':
                                case '2':
                                case '3':
                                case '4':
                                case '5':
                                case '6':
                                case '7':
                                case '8':
                                case '9':
                                    charIntSum = ((charIntSum << 5) - charIntSum) + divSpanTextContent.charCodeAt(pos);
                                    pos++;

                                    /*
                                    < perfect hashing on a closed set
                                    < ...

                                    I "feel" horrible at the moment

                                    I feel horrible about having mentioned further details of the "event"
                                    I think I feel better generally but

                                    This switch within a switch just to add the numbers drives me wild lol there's no way this is a good way to things

                                    Intrusive thoughts and stress

                                    And I don't know how I feel about this new logic
                                    I just feel so out of it

                                    This isn't actually unique btw it is unique across this closed set*
                                    I realize it was saying that

                                    And then it wants me to allocate a string to compare against a hardcoded version of the keyword.
                                    I feel like I'm just super decision making out'd right now
                                    every little detail of this just feels far more stressful to think about

                                    I feel so anxious if I could just get this double switch of alphabet/thenumnbers then I'd feel so much fbeter

> do you remember this too? '2. Manual Character Validation vs. V8 Monomorphism'

< Yes, absolutely. That was the core engine-level optimization we discussed right after fixing the hash calculation.
<
< We were targeting how V8 (the engine behind Chrome and Node.js) optimizes your JavaScript code under the hood.
< Specifically, we analyzed why writing a manual character-by-character validation loop for'
< the fallback verification was actually slower than just using a native string check due to how V8 handles monomorphism and inline caches (ICs).
<
< ...
< Why Native Strings Win: V8 Monomorphism
< 
< While the manual code looks lean, it defeats V8's internal optimizations. Here is exactly why we decided to drop manual validation and use a standard string comparison:
<
< 1. V8 String Interning: V8 keeps a hidden internal table of "interned strings" for all constants in your source code.
< The literal string "const" in your validation check === "const" is already allocated once when your engine boots up.
< It lives permanently in V8's "Old Space" memory heap and is never garbage collected.
<
< 2. Monomorphic Inline Caches: When you pull a substring out of your buffer and compare it to a string literal,
< V8 creates a monomorphic (single-shape) optimized code path.
< If the comparison operation always receives the same hidden class of string shapes,
< V8 optimizes the comparison down to raw assembly instructions that execute instantly
< 
< 3. The Sliced String Optimization: When you slice or substring text in modern JS engines,
< V8 often doesn't actually copy the characters. Instead, it creates a SlicedString object,
< which is just a tiny pointer pointing directly to your original divSpanTextContent string buffer with a start and length property.
< The actual comparison happens via highly optimized C++ memory operations inside the engine, beating manual JS loops every single time

I strongly believe that making this editor has humiliated the black pill out of me.
I realize just how little I understand and it is an extremely painful experience.

I was mainly black pilled cause I thought I "knew it all" about philosophy and everything.
And this is just daily a slap in the face that says you don't actually know anything

It goes hand in hand like "you thought you knew how to code, now we're here"
"you thought you understood how the world works... but remember how you felt about coding?"

I think that's the feeling I feel right now is extreme humiliation

I'm making the whole thing still
I'm just describing how I feel right now is all

My number 1 goal tomorrow is that I do my shift if I do 0 coding that's fine.
I've been a bit on the edge lately so so long as I do my shift it was good progress.

I did some exercises then about an hour long walk then showered...

> should I include the check on wordLength?

< Yes, adding a word length check is a massive performance win
                                    */

                                    break;
                                default:
                                    break outer;
                            }
                        }
                        // heuristic for possible keyword is comparing char int sum:
                        //
                        // const
                        // c 99
                        // o 111
                        // n 110
                        // s 115
                        // t 116
                        //
                        // 551
                        // 
                        // TODO: These 'divSpanTextContent.substring(wordstart, pos) ===' perhaps look wasteful at a glance...
                        // ...but it is solely with the goal of cheap confirmation that the text is truly the keyword, rather than some other identifier.
                        // The 'charIntSum' TODO: rename the variable to reflect the hashing logic...
                        // the variable is only distinct among the set of keywords.
                        // Thus you get a simple switch but you still gotta verify that you don't have a false positive due to all the other possible non-keyword identifiers.
                        // 
                        // "Why Native Strings Win: V8 Monomorphism"
                        // 'Monomorphic Inline Caches:'... raw assembly instructions that execute instantly
                        //
                        let wordlength = pos - wordstart;
                        switch (charIntSum) {
                            case 94844771: // const
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'const') {
                                        className = 'eK';
                                        textContent = 'const';
                                        break;
                                }
                                className = '';
                                break;
                            case 107035: // let
                                if (wordlength === 3 && divSpanTextContent.substring(wordstart, pos) === 'let') {
                                        className = 'eK';
                                        textContent = 'let';
                                        break;
                                }
                                className = '';
                                break;
                            case 1380938712: // function
                                if (wordlength === 8 && divSpanTextContent.substring(wordstart, pos) === 'function') {
                                        className = 'eK';
                                        textContent = 'function';
                                        break;
                                }
                                className = '';
                                break;
                            case 3357: // if
                                if (wordlength === 2 && divSpanTextContent.substring(wordstart, pos) === 'if') {
                                        className = 'eKC';
                                        textContent = 'if';
                                        break;
                                }
                                className = '';
                                break;
                            case 115131: // try
                                if (wordlength === 3 && divSpanTextContent.substring(wordstart, pos) === 'try') {
                                        className = 'eK';
                                        textContent = 'try';
                                        break;
                                }
                                className = '';
                                break;
                            case 101577: // for
                                if (wordlength === 3 && divSpanTextContent.substring(wordstart, pos) === 'for') {
                                        className = 'eKC';
                                        textContent = 'for';
                                        break;
                                }
                                className = '';
                                break;
                            case 116519: // var
                                if (wordlength === 3 && divSpanTextContent.substring(wordstart, pos) === 'var') {
                                        className = 'eK';
                                        textContent = 'var';
                                        break;
                                }
                                className = '';
                                break;
                            case 94432955: // catch
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'catch') {
                                        className = 'eK';
                                        textContent = 'catch';
                                        break;
                                }
                                className = '';
                                break;
                            case -934396624: // return
                                if (wordlength === 6 && divSpanTextContent.substring(wordstart, pos) === 'return') {
                                        className = 'eKC';
                                        textContent = 'return';
                                        break;
                                }
                                className = '';
                                break;
                            case -889473228: // switch
                                if (wordlength === 6 && divSpanTextContent.substring(wordstart, pos) === 'switch') {
                                        className = 'eKC';
                                        textContent = 'switch';
                                        break;
                                }
                                className = '';
                                break;
                            case 3046192: // case
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'case') {
                                        className = 'eKC';
                                        textContent = 'case';
                                        break;
                                }
                                className = '';
                                break;
                            case 93127292: // async
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'async') {
                                        className = 'eK';
                                        textContent = 'async';
                                        break;
                                }
                                className = '';
                                break;
                            case 3116345: // else
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'else') {
                                        className = 'eKC';
                                        textContent = 'else';
                                        break;
                                }
                                className = '';
                                break;
                            case 1544803905: // default
                                if (wordlength === 7 && divSpanTextContent.substring(wordstart, pos) === 'default') {
                                        className = 'eK';
                                        textContent = 'default';
                                        break;
                                }
                                className = '';
                                break;
                            case 110339814: // throw
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'throw') {
                                        className = 'eK';
                                        textContent = 'throw';
                                        break;
                                }
                                className = '';
                                break;
                            case 108960: // new
                                if (wordlength === 3 && divSpanTextContent.substring(wordstart, pos) === 'new') {
                                        className = 'eK';
                                        textContent = 'new';
                                        break;
                                }
                                className = '';
                                break;
                            case 93223254: // await
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'await') {
                                        className = 'eK';
                                        textContent = 'await';
                                        break;
                                }
                                className = '';
                                break;
                            case 94742904: // class
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'class') {
                                        className = 'eK';
                                        textContent = 'class';
                                        break;
                                }
                                className = '';
                                break;
                            case -1588406278: // constructor
                                if (wordlength === 11 && divSpanTextContent.substring(wordstart, pos) === 'constructor') {
                                        className = 'eK';
                                        textContent = 'constructor';
                                        break;
                                }
                                className = '';
                                break;
                            case -1184795739: // import
                                if (wordlength === 6 && divSpanTextContent.substring(wordstart, pos) === 'import') {
                                        className = 'eKC';
                                        textContent = 'import';
                                        break;
                                }
                                className = '';
                                break;
                            case 3151786: // from
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'from') {
                                        className = 'eKC';
                                        textContent = 'from';
                                        break;
                                }
                                className = '';
                                break;
                            case -1289153612: // export
                                if (wordlength === 6 && divSpanTextContent.substring(wordstart, pos) === 'export') {
                                        className = 'eK';
                                        textContent = 'export';
                                        break;
                                }
                                className = '';
                                break;
                            case 3559070: // this
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'this') {
                                        className = 'eK';
                                        textContent = 'this';
                                        break;
                                }
                                className = '';
                                break;
                            case 113101617: // while
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'while') {
                                        className = 'eKC';
                                        textContent = 'while';
                                        break;
                                }
                                className = '';
                                break;
                            case 94001407: // break
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'break') {
                                        className = 'eKC';
                                        textContent = 'break';
                                        break;
                                }
                                className = '';
                                break;
                            case -567202649: // continue
                                if (wordlength === 8 && divSpanTextContent.substring(wordstart, pos) === 'continue') {
                                        className = 'eKC';
                                        textContent = 'continue';
                                        break;
                                }
                                className = '';
                                break;
                            case 3569038: // true
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'true') {
                                        className = 'eK';
                                        textContent = 'true';
                                        break;
                                }
                                className = '';
                                break;
                            case 97196323: // false
                                if (wordlength === 5 && divSpanTextContent.substring(wordstart, pos) === 'false') {
                                        className = 'eK';
                                        textContent = 'false';
                                        break;
                                }
                                className = '';
                                break;
                            case 3392903: // null
                                if (wordlength === 4 && divSpanTextContent.substring(wordstart, pos) === 'null') {
                                        className = 'eK';
                                        textContent = 'null';
                                        break;
                                }
                                className = '';
                                break;
                            default:
                                className = '';
                                break;
                        }
                        if (className) {
                            // is done when there IS a valid match, in order to write out any pending text that came prior to the keyword.
                            if (substart < wordstart) {
                                // TODO: After you make these changes, span pooling is going to FAR more important now cause you're scrolling to just 1 span per line each time.
                                // TODO: If a comment or multi-line comment are the only things on a line, and prior to them on that same line is only whitespace...
                                // ...preprocessor.cjs should remove the entire line itself rather than take the line and indentation for no reason.
                                //
                                flushTextContent = divSpanTextContent.substring(substart, substart = wordstart);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }

                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = className;
                                span.textContent = textContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.className = className;
                                span.textContent = textContent;
                                div.appendChild(span);
                            }
                            substart += wordlength;
                        }
                        continue;
                    case get_js_FORWARDSLASH():
                        if (divSpanTextContent[pos + 1] === get_js_FORWARDSLASH()) {

                            if (substart < pos) {
                                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }

                            // lex_comment_singleLine(...)

                            // The current character is the first forward slash of the 'two consecutive ones' that represent the start of a single line comment.
                            // "changing" this to guarantee at least 1 read means you can continue after the invocation returns (for the while loop)
                            // All in all, this already was guaranteed to read at least 1 since the while loop's condition in this method
                            // This change is moreso a matter of anxiety and me not wanting to deal with this at the moment so I need to see the explicit read here so I can sleep at night for the time being until my stress levels are lower.
                            pos++;
                            while (pos < subend) {
                                if (divSpanTextContent[pos] === get_js_LINEFEED()) {
                                    break;
                                }
                                pos++;
                            }

                            // TODO: I think checking this is redundant because you guaranteed at least one increment?
                            if (substart < pos) {
                                textContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = 'eC';
                                    span.textContent = textContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.className = 'eC';
                                    span.textContent = textContent;
                                    div.appendChild(span);
                                }
                            }

                            continue;
                        }
                        else if (divSpanTextContent[pos + 1] === get_js_ASTERISK()) {
                            if (substart < pos) { // write any text that came prior, and on the same line.
                                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }

                            // Move past the 'forwardslash and asterisk'
                            pos += 2;

                            // I'm starting this at 2 because 0 would bug (-1 + 1 === 0)
                            // but then I just don't want to deal with this so I need to go 1,
                            // then like I'm tired and I don't want to deal with this so I'll just go to 2 and surely nothing bad can happen
                            // but in reality I probably only need to start at 1 (or start of other ticket variables + 2 or something idk I don't wanna deal with this right now).
                            let ticketSource = 2;
                            let ticketAsterisk = -1;
                            let ticketForwardSlash = -1;
                            while (pos < subend) {
                                switch (divSpanTextContent[pos]) {
                                    case get_js_ASTERISK():
                                        ticketAsterisk = ticketSource++;
                                        break;
                                    case get_js_FORWARDSLASH():
                                        ticketForwardSlash = ticketSource++;
                                        break;
                                    case get_js_LINEFEED():
                                        ticketSource++;
                                        break;
                                    default:
                                        ticketSource++;
                                        break;
                                }
                                pos++;
                                if (ticketAsterisk + 1 === ticketForwardSlash) {
                                    break;
                                }
                            }

                            textContent = divSpanTextContent.substring(substart, substart = pos);
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = 'eCm';
                                span.textContent = textContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.className = 'eCm';
                                span.textContent = textContent;
                                div.appendChild(span);
                            }

                            continue;
                        }

                        // TODO: Remove this break because it was confusing, you gotta make sure it continues, but this actually just never gets hit because the previous branches end with continue.
                        break;
                    case get_js_DOUBLEQUOTE():
                        if (substart < pos) {
                            flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = '';
                                span.textContent = flushTextContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.textContent = flushTextContent;
                                div.appendChild(span);
                            }
                        }
                        // This code is somewhat a duplication of 'function lex_string(...)'
                        //
                        // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                        pos++;
                        outer: while (pos < subend) {
                            switch (divSpanTextContent[pos]) {
                                case get_js_DOUBLEQUOTE():
                                    pos++;
                                    break outer;
                                case get_js_BACKSLASH():
                                    pos++;
                                    if (pos < subend) {
                                        pos++; // skip the escaped character provided that the file didn't end after the original backslash
                                    }
                                    continue /*outer*/;
                                default:
                                    pos++;
                                    break;
                            }
                        }
                        textContent = divSpanTextContent.substring(substart, substart = pos);
                        if (childIndex < divChildrenInitialLength) {
                            span = div.children[childIndex++];
                            span.className = 'eS';
                            span.textContent = textContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.className = 'eS';
                            span.textContent = textContent;
                            div.appendChild(span);
                        }
                        continue;
                    case get_js_SINGLEQUOTE():
                        if (substart < pos) {
                            flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = '';
                                span.textContent = flushTextContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.textContent = flushTextContent;
                                div.appendChild(span);
                            }
                        }
                        // This code is somewhat a duplication of 'function lex_string(...)'
                        //
                        // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                        pos++;
                        outer: while (pos < subend) {
                            switch (divSpanTextContent[pos]) {
                                case get_js_SINGLEQUOTE():
                                    pos++;
                                    break outer;
                                case get_js_BACKSLASH():
                                    pos++;
                                    if (pos < subend) {
                                        pos++; // skip the escaped character provided that the file didn't end after the original backslash
                                    }
                                    continue /*outer*/;
                                default:
                                    pos++;
                                    break;
                            }
                        }
                        textContent = divSpanTextContent.substring(substart, substart = pos);
                        if (childIndex < divChildrenInitialLength) {
                            span = div.children[childIndex++];
                            span.className = 'eS';
                            span.textContent = textContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.className = 'eS';
                            span.textContent = textContent;
                            div.appendChild(span);
                        }
                        continue;
                    case get_js_BACKTICK():
                        if (substart < pos) {
                            flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = '';
                                span.textContent = flushTextContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.textContent = flushTextContent;
                                div.appendChild(span);
                            }
                        }
                        // This code is somewhat a duplication of 'function lex_string(...)'
                        //
                        // likely what started the string is the same as the terminator, so you need to move ahead one position before starting the loop.
                        pos++;
                        outer: while (pos < subend) {
                            switch (divSpanTextContent[pos]) {
                                case get_js_BACKTICK():
                                    pos++;
                                    break outer;
                                case get_js_BACKSLASH():
                                    pos++;
                                    if (pos < subend) {
                                        pos++; // skip the escaped character provided that the file didn't end after the original backslash
                                    }
                                    continue /*outer*/;
                                default:
                                    pos++;
                                    break;
                            }
                        }
                        textContent = divSpanTextContent.substring(substart, substart = pos);
                        if (childIndex < divChildrenInitialLength) {
                            span = div.children[childIndex++];
                            span.className = 'eSm';
                            span.textContent = textContent;
                        }
                        else {
                            span = document.createElement('span');
                            span.className = 'eSm';
                            span.textContent = textContent;
                            div.appendChild(span);
                        }
                        continue;
                    case get_js_EQUALS():
                        // I think I actually want to handle the '==', '===', and '===...=' cases just so I can skip over the text quickly.
                        // Otherwise every time I see '=' I have to check the left and right side and it is quite redundant?
                        //
                        // I also have to consider anything of the form '+=' then typing '=' after it for '+=='. I don't think this is valid but I need to consider it I'll probably skip over any '=' that appear after the first '+=' text and is contiguous?
                        // No that doesn't work because you're adding this step to every syntax that ends in '=' that it has to understand the '=' case.
                        // What you want is a left check, but that the left check only happens once per contiguous block of '=' incase the left '=' isn't part of your syntax.
                        //
                        
                        // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in ="...
                        // ...this presumption permits checking only the text that is in bounds of substart and subend.
                        
                        // TODO: This contiguous skipping logic isn't working for every switch case?
                        //
                        // TODO: If this contiguous skipping logic works for the '=' it will handle both '!=' and '!==' solely by checking for '!='
                        //
                        // let shouldSkipContiguous;... sneaky uninitialized variable conversion to a falsey or something was going on?
                        shouldSkipContiguous = false;
                        if (pos > substart) {
                            if (divSpanTextContent[pos - 1] === get_js_EQUALS()) {
                                shouldSkipContiguous = true;
                            }
                            else if (divSpanTextContent[pos - 1] === get_js_BANG()) {
                                shouldSkipContiguous = true;
                            }
                            else if (divSpanTextContent[pos - 1] === get_js_OPENBRACKET()) {
                                shouldSkipContiguous = true;
                            }
                            else if (divSpanTextContent[pos - 1] === get_js_CLOSEBRACKET()) {
                                shouldSkipContiguous = true;
                            }
                        }
                        else {
                            shouldSkipContiguous = false;
                        }
                        if (!shouldSkipContiguous) {
                            if (pos < subend && divSpanTextContent[pos + 1] === get_js_EQUALS()) {
                                shouldSkipContiguous = true;
                            }
                        }
                        
                        if (shouldSkipContiguous) {
                            // skip current
                            pos++;
                            // skip contiguous
                            while (pos < subend && divSpanTextContent[pos] === get_js_EQUALS()) {
                                pos++;
                            }
                            continue;
                        }
                        else {
                            if (substart < pos) { // write any text that came prior, and on the same line.
                                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }
                            // I don't know if I would count '=>' as an "assignment operator"... maybe I would but I'm too focused on whether I'd count it as such that I can't figure out the way to make it work. So I need to just make it work first.
                            pos++;
                            substart++;
                            if (pos < subend && divSpanTextContent[pos] === get_js_CLOSEBRACKET()) {
                                textContent = '=>';
                                pos++;
                                substart++;
                            }
                            else {
                                textContent = '=';
                            }
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = 'eOA';
                                span.textContent = textContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.className = 'eOA';
                                span.textContent = textContent;
                                div.appendChild(span);
                            }
                            continue;
                        }
                        
                        // TODO: you don't understand how code caching or like instruction caching etc works with respect to whether inlining interupts things
                        break;
                    case get_js_PLUS():
                        // ++
                        // +=
                        
                        // If "some syntax that I don't actually think exists" such as '=+' were to exist I'd need to care for '=+' then a '+' making '=++'
                        // this should cause a skipping of contiguous '+' in my initial opinion so that's what I'll probably do.
                        // 
                        // I have a better example now... '++' then you type '+' causing '+++', the first two '++' are syntax highlighted and the third isn't.
                        // Some might say you should not syntax highlight any of the plus in that case because you're reading the operator as '++'
                        // rather than the combination of '++' and '+'. I think I'm somewhat indifferent but I lean towards syntax highlighting
                        // the two plus characters and not doing so for the final '+' (at least my initial opinion is that).
                        //
                        // ++++
                        // It doesn't actually work... I tried it and '+++' works but then '++++' is two '++' rather than one '++' and then just the "text of '++'".
                        //
                        
                        // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in +"...
                        // ...this presumption permits checking only the text that is in bounds of substart and subend.
                        
                        // TODO: This contiguous skipping logic isn't working for every switch case?
                        shouldSkipContiguous = pos > substart && divSpanTextContent[pos - 1] === get_js_PLUS();
                        if (!shouldSkipContiguous) {
                            if (pos < subend) {
                                if (divSpanTextContent[pos + 1] === get_js_PLUS()) {
                                    textContent = '++';
                                }
                                else if (divSpanTextContent[pos + 1] === get_js_EQUALS()) {
                                    textContent = '+=';
                                }
                                else {
                                    shouldSkipContiguous = true;
                                }
                            }
                            else {
                                shouldSkipContiguous = true;
                            }
                        }
                        
                        if (shouldSkipContiguous) {
                            // skip current
                            pos++;
                            // skip contiguous
                            while (pos < subend && divSpanTextContent[pos] === get_js_PLUS()) {
                                pos++;
                            }
                            continue;
                        }
                        else {
                            if (substart < pos) { // write any text that came prior, and on the same line.
                                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }
                            pos += 2;
                            substart += 2;
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = 'eOA';
                                span.textContent = textContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.className = 'eOA';
                                span.textContent = textContent;
                                div.appendChild(span);
                            }
                            continue;
                        }
                    case get_js_MINUS():
                        // --
                        // -=
                        
                        // NOTE: A presumption is being made here that "any multiline syntax that spans multiple lines, won't end in -"...
                        // ...this presumption permits checking only the text that is in bounds of substart and subend.
                        
                        // When you switch on '+' then check for '-' or '+'... should you do something relating to NOT invoking the decode function and instead
                        // you just "know" the text that goes there based on your conditional branching?
                            
                        // TODO: This contiguous skipping logic isn't working for every switch case?
                        shouldSkipContiguous = pos > substart && divSpanTextContent[pos - 1] === get_js_MINUS();
                        if (!shouldSkipContiguous) {
                            if (pos < subend) {
                                if (divSpanTextContent[pos + 1] === get_js_MINUS()) {
                                    textContent = '--';
                                }
                                else if (divSpanTextContent[pos + 1] === get_js_EQUALS()) {
                                    textContent = '-=';
                                }
                                else {
                                    shouldSkipContiguous = true;
                                }
                            }
                            else {
                                shouldSkipContiguous = true;
                            }
                        }
                        
                        if (shouldSkipContiguous) {
                            // skip current
                            pos++;
                            // skip contiguous
                            while (pos < subend && divSpanTextContent[pos] === get_js_MINUS()) {
                                pos++;
                            }
                            continue;
                        }
                        else {
                            if (substart < pos) { // write any text that came prior, and on the same line.
                                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                                if (childIndex < divChildrenInitialLength) {
                                    span = div.children[childIndex++];
                                    span.className = '';
                                    span.textContent = flushTextContent;
                                }
                                else {
                                    span = document.createElement('span');
                                    span.textContent = flushTextContent;
                                    div.appendChild(span);
                                }
                            }
                            pos += 2;
                            substart += 2;
                            if (childIndex < divChildrenInitialLength) {
                                span = div.children[childIndex++];
                                span.className = 'eOA';
                                span.textContent = textContent;
                            }
                            else {
                                span = document.createElement('span');
                                span.className = 'eOA';
                                span.textContent = textContent;
                                div.appendChild(span);
                            }
                            continue;
                        }
                }
                pos++;
            }

            // TODO: Consider the final pos? Is this gonna bug? I don't think it will.
            if (substart < pos && pos !== 0) {
                flushTextContent = divSpanTextContent.substring(substart, substart = pos);
                if (childIndex < divChildrenInitialLength) {
                    span = div.children[childIndex++];
                    span.className = '';
                    span.textContent = flushTextContent;
                }
                else {
                    span = document.createElement('span');
                    span.textContent = flushTextContent;
                    div.appendChild(span);
                }
            }

            if (!trackedSyntaxExhausted) {
                createDoLexFlag = false;
                createTrackedSyntaxFlag = true;
            }
        }
        else if (createTrackedSyntaxFlag) {
            
            createTrackedSyntaxFlag = false;

            let span;
            if (childIndex < divChildrenInitialLength) {
                span = div.children[childIndex++];
                //span.className = ''; className is guaranteed to be set in this specific case
            }
            else {
                span = document.createElement('span');
                div.appendChild(span);
            }

            let trackedSyntaxEnd = get_EDITOR_pooledTrackedSyntax_start() + get_EDITOR_pooledTrackedSyntax_length();
            subend = trackedSyntaxEnd > divSpanTextContentLength ? divSpanTextContentLength : trackedSyntaxEnd;
            
            let length = subend - substart;
            span.textContent = divSpanTextContent.substring(substart, subend);
            substart += length;
            pos += length;
            switch (EDITOR_pooledTrackedSyntax_trackedSyntaxKind) {
                case get_TrackedSyntaxKind_Comment():
                    span.className = 'eCM';
                    break;
                case get_TrackedSyntaxKind_String():
                    span.className = 'eSM';
                    break;
                default:
                    span.className = '';
                    break;
            }
        }
        else {
            
            if (trackedSyntax_I >= EDITOR_trackedSyntaxList.count_abstract) {
                createDoLexFlag = true;
                trackedSyntaxExhausted = true;
                subend = divSpanTextContentLength;
                continue;
            }

            EDITOR_trackedSyntaxList.getElementAt(trackedSyntax_I);

            if (substart >= divSpanTextContentLength) {
                createDoLexFlag = true;
                trackedSyntaxExhausted = true;
                subend = divSpanTextContentLength;
                continue;
            }

            if (get_EDITOR_pooledTrackedSyntax_start() >= lineStart + divSpanTextContentLength) {
                createDoLexFlag = true;
                trackedSyntaxExhausted = true;
                subend = divSpanTextContentLength;
                continue;
            }

            if (get_EDITOR_pooledTrackedSyntax_start() + get_EDITOR_pooledTrackedSyntax_length() < lineStart) {
                trackedSyntax_I++;
                continue;
            }

            if (get_EDITOR_pooledTrackedSyntax_start() > lineStart + substart) {
                createDoLexFlag = true;
                trackedSyntaxExhausted = false;
                subend = get_EDITOR_pooledTrackedSyntax_start() > lineStart + divSpanTextContentLength ? lineStart + divSpanTextContentLength : get_EDITOR_pooledTrackedSyntax_start(); // probably a nonsense line of code given the previous if statements
                continue;
                //childIndex = EDITOR_language_line_lex(div, substart, subend, childIndex);
                //substart += (subend - substart);
            }

            {
                createTrackedSyntaxFlag = true;
                continue;
                
            }

            if (get_EDITOR_pooledTrackedSyntax_start() + get_EDITOR_pooledTrackedSyntax_length() <= divSpanTextContentLength) {
                trackedSyntax_I++;
                continue;
            }
        
            //if (substart < divSpanTextContentLength) {
            //    childIndex = EDITOR_language_line_lex(div, substart, divSpanTextContentLength, childIndex);
            //}

            //let aaa = divChildrenInitialLength - childIndex;
            //for (let i = 0; i < aaa; i++) {
            //    div.removeChild(div.children[childIndex]);
            //}

            //return trackedSyntax_I;
        }
    }

    return trackedSyntax_I;
}
