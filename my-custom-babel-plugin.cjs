// This file was originally generated with google AI

module.exports = function (babel) {
  const { types: t } = babel;

  // List all the function names you want to inline
  const TARGET_FUNCTIONS = [

    "get_EDI_detailRank",
    "set_EDI_detailRank",

    "get_EDI_recentBoundingClientRect_isNull_intFalsey",
    "set_EDI_recentBoundingClientRect_isNull_intFalsey",
    
    "get_EDI_findOverlay_show",
    "set_EDI_findOverlay_show",
    
    "get_EDI_findOverlay_isBeingShownDueToMultiCursorMatching",
    "set_EDI_findOverlay_isBeingShownDueToMultiCursorMatching",
    
    "get_EDI_fileStartsWithBom",
    "set_EDI_fileStartsWithBom",
    
    "get_EDI_findOverlay_wasSearched",
    "set_EDI_findOverlay_wasSearched",
    
    "get_EDI_findOverlay_options_matchWord",
    "set_EDI_findOverlay_options_matchWord",
  ];

  // List all the variable names you want to inline
  const TARGET_VARIABLES = [

    "fEDI_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",
    

    "fEDI_drawn_count_of_digits_longest_line_number",

    

    "fEDI_detailRank",
    

    "fEDI_detail_smallPosition",
    

    "fEDI_detail_largePosition",

    "fEDI_detailRank3OriginLine",
    

    "fEDI_gutterWidthStyleValue",
    

    "fEDI_gutterWidthTotal",
    

    "fEDI_virtualIndexLine",
    

    "fEDI_virtualCount",
    

    "F_didChangeTextDocument_version",
    

    "fEDI_indexCursor",
    

    "fEDI_offsetLine",
    

    "fEDI_offsetColumn_withRespectToThisIndexLine",
    

    "fEDI_offsetColumn",
    

    "fEDI_totalShift",
    

    "fEDI_offsetWithinSpan",
    

    "fEDI_ONSCROLLvirtualIndexLine",
    

    

    "fEDI_ONSCROLLscrollTop",
    

    "fEDI_longestLine_indexLine",
    
    
    "fEDI_longestLine_length",
    

    "fEDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar",
    

    "fEDI_contentWidth",
    

    "fEDI_indent_ORIGINAL_indentBy",
    

    "fEDI_indent_SMALL_lineAndColumnIndices_indexLine",
    

    "fEDI_indent_startingIndex",
    

    "fEDI_recentBoundingClientRect_left",
    

    "fEDI_recentBoundingClientRect_top",
    

    "fEDI_recentBoundingClientRect_isNull_intFalsey",
    

    "fEDI_pooledTrackedSyntax_start",
    

    "fEDI_pooledTrackedSyntax_length",
    

    "fEDI_findOverlay_show",
    

    "fEDI_findOverlay_isBeingShownDueToMultiCursorMatching",
    

    "fEDI_fileStartsWithBom",
    

    "fEDI_findOverlay_wasSearched",
    

    "fEDI_findOverlay_options_matchWord",
    

    "fEDI_scrollEndDeadline",

    "fEDI_intFalsey_isScrolling",
    





    "fEDI_lineHeight",
    "fEDI_virtualIndexLine",
    "fEDI_virtualCount",
    "fEDI_ONSCROLLvirtualIndexLine",
    "fEDI_ONSCROLLvirtualCount",
    "fEDI_ONSCROLLscrollTop",
    "fEDI_longestLine_indexLine",
    "fEDI_longestLine_length",
    "fEDI_scrollEndDeadline",
    "fEDI_sum_diffPositive",
    "fEDI_sum_diffNegative",
    "fEDI_lastReadNumber_scrollTop",

    "AUTOCOMPLETErenderKind_None",
    "AUTOCOMPLETErenderKind_Show",
    "AUTOCOMPLETErenderKind_Hide",
    "AUTOCOMPLETErenderKind_CursorSet",
    "AUTOCOMPLETErenderKind_CreateLines",
    "AUTOCOMPLETErenderKind_Scroll",

    "DIALOGrenderKind_None",
    "DIALOGrenderKind_Show",
    "DIALOGrenderKind_Hide",
    "DIALOGrenderKind_DimensionsChanged",

    "LISTrenderKind_None",
    "LISTrenderKind_Cursor",

    "TREEVIEWrenderKind_None",
    "TREEVIEWrenderKind_Cursor",
    "TREEVIEWrenderKind_Create",
    "TREEVIEWrenderKind_Batch",
    "TREEVIEWrenderKind_Scroll",
    "TREEVIEWrenderKind_SetItems",
    "TREEVIEWrenderKind_FullReset",
    "TREEVIEWrenderKind_Scroll_PullDataDrawResult",
    "TREEVIEWrenderKind_Resize",

    "MENUrenderKind_None",
    "MENUrenderKind_Cursor",
    "MENUrenderKind_Set",
    "MENUrenderKind_Hide",

    "WidgetKind_None",
    "WidgetKind_InputText",
    "WidgetKind_YesCancel",

    "WIDGETrenderKind_None",
    "WIDGETrenderKind_Show",
    "WIDGETrenderKind_Hide",

    "TreeViewNodeKind_None",
    "TreeViewNodeKind_isExpandable_isExpanded",
    "TreeViewNodeKind_isExpandable_NOTisExpanded",
    "TreeViewNodeKind_NOTisExpandable_isExpanded",
    "TreeViewNodeKind_NOTisExpandable_NOTisExpanded",

    "TrackedSyntaxKind_None",
    "TrackedSyntaxKind_String",
    "TrackedSyntaxKind_Comment",

    "CommandKind_None",
    "CommandKind_Submenu",
    "CommandKind_Copy",
    "CommandKind_CopyAbsolutePath",
    "CommandKind_Cut",
    "CommandKind_Paste",
    "CommandKind_NewFile_Directory",
    "CommandKind_NewFile_File",
    "CommandKind_DeleteFile_Directory",
    "CommandKind_DeleteFile_File",
    "CommandKind_RenameFile_Directory",
    "CommandKind_RenameFile_File",
    "CommandKind_Find",
    "CommandKind_SelectFolder",
    "CommandKind_SelectWorkspace",

    "DialogKind_None",
    "DialogKind_FindAll",
    "DialogKind_Settings",
    "DialogKind_DocumentSymbol",
    "DialogKind_Debug",

    "EditKind_None",
    "EditKind_InsertLtr",
    "EditKind_DeleteLtr",
    "EditKind_BackspaceRtl",
    "EditKind_RemoveTextNoBatching",
    "EditKind_Tab",
    "EditKind_IndentMore",
    "EditKind_IndentLess",
    "EditKind_Enter",
    "EditKind_Paste",
    "EditKind_Duplicate",

    "EnterKeyEventKind_None",
    "EnterKeyEventKind_StartOfLine",
    "EnterKeyEventKind_EndOfLine",
    "EnterKeyEventKind_AmongALine",

    "CharacterKind_None",
    "CharacterKind_Whitespace",
    "CharacterKind_Punctuation",
    "CharacterKind_LetterOrDigit",

    "RenderKind_None",
    "RenderKind_Scroll",
    "RenderKind_Resize",
    "RenderKind_InsertLtr",
    "RenderKind_TabKey",
    "RenderKind_IndentMore",
    "RenderKind_IndentLess",
    "RenderKind_BackspaceRtl",
    "RenderKind_DeleteLtr",
    "RenderKind_RemoveSelection",
    "RenderKind_Enter",
    "RenderKind_DuplicateOrPaste",
    "RenderKind_Clear",
    "RenderKind_SetText",
    "RenderKind_CreateViewport",
    "RenderKind_SyntaxHighlighting",
    "RenderKind_Cursor_flag_scrollIntoViewExplicit",
    "RenderKind_Cursor_flag_doNotScrollIntoView",
    "RenderKind_Cursor_n",

    "ExtensionKind_None",
    "ExtensionKind_JavaScript",

    "CONST_EDI_ASCII_LINE_FEED",
    "CONST_EDI_ASCII_TAB",
    "CONST_EDI_ASCII_SPACE",

    "CONST_js_DOUBLEQUOTE_str",
    "CONST_js_SINGLEQUOTE_str",
    "CONST_js_BACKTICK_str",
    "CONST_js_FORWARDSLASH_str",
    "CONST_js_BACKSLASH_str",
    "CONST_js_ASTERISK_str",
    "CONST_js_LINEFEED_str",
    "CONST_js_OPENPARENTHESIS_str",
    "CONST_js_CLOSEPARENTHESIS_str",
    "CONST_js_PERIOD_str",
    "CONST_js_EQUALS_str",
    "CONST_js_OPENBRACKET_str",
    "CONST_js_CLOSEBRACKET_str",
    "CONST_js_BANG_str",
    "CONST_js_PLUS_str",
    "CONST_js_MINUS_str",
    "CONST_js_STAR_str",
    "CONST_js_PERCENT_str",
    "CONST_js_AMPERSAND_str",
    "CONST_js_PIPE_str",
    "CONST_js_QUESTIONMARK_str",
    "CONST_js_CARET_str",
    
    "CONST_js_DOUBLEQUOTE_num",
    "CONST_js_SINGLEQUOTE_num",
    "CONST_js_BACKTICK_num",
    "CONST_js_FORWARDSLASH_num",
    "CONST_js_BACKSLASH_num",
    "CONST_js_ASTERISK_num",
    "CONST_js_LINEFEED_num",
    "CONST_js_OPENPARENTHESIS_num",
    "CONST_js_CLOSEPARENTHESIS_num",
    "CONST_js_PERIOD_num",
    "CONST_js_EQUALS_num",
    "CONST_js_OPENBRACKET_num",
    "CONST_js_CLOSEBRACKET_num",
    "CONST_js_BANG_num",
    "CONST_js_PLUS_num",
    "CONST_js_MINUS_num",
    "CONST_js_STAR_num",
    "CONST_js_PERCENT_num",
    "CONST_js_AMPERSAND_num",
    "CONST_js_PIPE_num",
    "CONST_js_QUESTIONMARK_num",
    "CONST_js_CARET_num",

    "CONST_EDI_gutterPaddingLeft",
    "CONST_EDI_gutterPaddingRight",


    "CONST_DIALOG_minTop",
    "CONST_DIALOG_minLeft",
    "CONST_DIALOG_minHeight",
    "CONST_DIALOG_minWidth",

    "CONST_EDI_cursor_GAP_BUFFER_CAPACITY",

    "CONST_AUTOCOMPLETE_topPadding",












    "fEDI_cursor_editKind",
    "fEDI_cursor_indexLine",
    "fEDI_cursor_indexColumn",
    "fEDI_cursor_STORED_indexColumn",
    "fEDI_cursor_cursorTranslateYValue",
    "fEDI_cursor_cursorTranslateXValue",
    "fEDI_cursor_selectionAnchor",
    "fEDI_cursor_selectionEnd",
    "fEDI_cursor_selectionIndexAnchorLine",
    "fEDI_cursor_selectionIndexAnchorColumn",
    "fEDI_cursor_selectionIndexEndLine",
    "fEDI_cursor_selectionIndexEndColumn",
    "fEDI_cursor_DRAWN_selectionAnchor",
    "fEDI_cursor_DRAWN_selectionEnd",
    "fEDI_cursor_DRAWN_selection_virtualIndexLine",
    "fEDI_cursor_DRAWN_selection_virtualCount",
    "fEDI_cursor_editLength",
    "fEDI_cursor_editPosition",
    "fEDI_cursor_editIndexLine",
    "fEDI_cursor_editIndexColumn",
    "fEDI_cursor_editRenderedDisplacement",
    "fEDI_cursor_editRenderedDisplacement_INDEX_LINE_OFFSET",
    "fEDI_cursor_END_editIndexLine",
    "fEDI_cursor_END_editIndexColumn",
    "fEDI_cursor_gapBufferCount",
    "fEDI_cursor_editLineFeedCount",
    "fEDI_cursor_EDI_duplicate_small",
    "fEDI_cursor_EDI_duplicate_length",



    "byteDIALOG_FindAll_options_matchWord",
    "byteDIALOG_Settings_isDark",
    "byteDIALOG_Settings_trueTabs_falseSpaces",
    "byteDIALOG_Settings_editorDebugShowAdjacentCharacters",
    "byteDIALOG_hasBeenMeasured",
    "byteDIALOG_windowExists",
    "byteDIALOG_HIDE_shouldRestoreFocus",
    


    "fDIALOG_left",
    "fDIALOG_top",
    "fDIALOG_width",
    "fDIALOG_height",
    "fDIALOG_left_DRAWN",
    "fDIALOG_top_DRAWN",
    "fDIALOG_width_DRAWN",
    "fDIALOG_height_DRAWN",
    "fDIALOG_before_X",
    "fDIALOG_before_Y",
    "fDIALOG_after_X",
    "fDIALOG_after_Y",

    "fEDI_w_indexColumn_Goal",
    "fEDI_w_indexColumn_Sum",
    "fEDI_w_indexColumn_SpanTextContentRelative",
    "fEDI_w_indexSpan",
    "fEDI_w_beltIndexLine",
    "fEDI_EDI_beltIndexZero",
    //"fEDI_EDI_characterWidth",
    "fEDI_EDI_horizontal_scrollbar_widthValue",
    "fEDI_lastReadNumber_scrollLeft",
    "fEDI_lastReadNumber_offsetHeight",
    "fEDI_lastReadNumber_offsetWidth",
    "fEDI_ArrayFrom_textElement_children_length",
    "fEDI_EDI_mouseOver_event_clientY",
    "fEDI_EDI_mouseOver_event_clientX",
    "fEDI_EDI_RemoveSelection_smallPosition",
    "fEDI_EDI_RemoveSelection_largePosition",
    "fEDI_EDI_indentLess_startingLinePos_end",
    "fEDI_EDI_cursorBlinkLastTimestamp",
    "fEDI_DRAWN_NUMBER_EDI_horizontal_scrollbar_style_left",
    "fEDI_prevVli",
    "fEDI_currVli",

    "fAUTOCOMPLETE_items_slice_start",
    "fAUTOCOMPLETE_items_slice_end",
    "fAUTOCOMPLETE_items_totalLength",
    "fAUTOCOMPLETE_cursorIndex",
    "fAUTOCOMPLETE_rectHeight",
    "fAUTOCOMPLETE_rectLeft",
    "fAUTOCOMPLETE_rectTop",
    "fAUTOCOMPLETE_sliceVirtualIndex_SLICE",
    "fAUTOCOMPLETE_sliceVirtualCount_SLICE",
    "fAUTOCOMPLETE_sliceBeltIndexZero_SLICE",
    "fAUTOCOMPLETE_virtualCount",
    "fAUTOCOMPLETE_virtualIndex",
    "fAUTOCOMPLETE_beltIndexZero",
    "fAUTOCOMPLETE_scrollTop",
    "fAUTOCOMPLETE_scrollEndDeadline",
    "fAUTOCOMPLETE_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING",
    "fAPP_lineHeight",

    "byteAUTOCOMPLETE_exists",
    "byteAUTOCOMPLETE_isRenderPending",
    "byteAUTOCOMPLETE_rect_isNull",
    "byteAUTOCOMPLETE_isCheckingTrailingEdge",
    "byteAUTOCOMPLETE_scrollIsFetchingData",

    "fWIDGET_ticketId_counter",
    "fWIDGET_ticketId_pending",
    "fWIDGET_ticketId_drawn",
    "fWIDGET_left",
    "fWIDGET_top",
    "fWIDGETrenderKind_Show_countOfPendingRequests",

    "byteWIDGET_isRenderPending",
    "byteWIDGET_shouldRestoreFocus",

    "byteDIALOG_isRenderPending",

    "byteTOOLTIP_isRenderPending",
    "byteTOOLTIP_pending_renderKind",
    "byteTOOLTIP_exists",
    "byteDIALOG_currentDialogKind",
    "byteDIALOG_SHOW_currentDialogKind",

    "fMENU_ticketId_counter",
    "fMENU_ticketId_pending",
    "fMENU_ticketId_drawn",
    "fMENU_cursorIndex",
    "fMENU_SET_index",
    "fMENU_left",
    "fMENU_top",
    "fMENU_renderKind_Set_countOfPendingRequests",

    "byteMENU_HIDE_shouldRestoreFocus",
    "byteMENU_SET_NOTshouldFocus",
    "byteMENU_NOTshouldFocus",
    "byteMENU_isRenderPending",

    "byteWIDGET_WidgetKind_pending",
    "byteWIDGET_WidgetKind_drawn",

    "byteTreeView_pooledNode_nodeKind",
    "fTreeView_pooledNode_key",
    "fTreeView_pooledNode_depth",

    "fMENU_last_handled_ticketId",

    "byteEDI_cursor_enterKeyEventKind",
    "byteEDI_extensionKind",
    "byteEDI_pooledTrackedSyntax_trackedSyntaxKind",
    "byteEDI_isChecking_cursorBlinkTrailingEdge",
    "byteEDI_cursor_selectionDivExists",
    "byteEDI_onResize_hasTrailingCall",
    "byteisCheckingTrailingEdge",
    "byteisProcessingLspQueue",
    "byteEDI_isRenderPending",
    "byteEDI_mousemove_eventListener_isActive",
    "fEDI_onResize_timer",
    "fEDI_hoverTimeout",
    "fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexLine",
    "fEDI_RemoveSelection_smallLineAndColumnIndices_small_indexColumn",

    "CONST_EDI_cursor_htmlId",

    "fEDI_cursor_gapBufferWriteToSpanElement_SpanTextContentRelativeIndex",

    "CONST_EXPLORER_offsetPerDepth",
    "fEXPLORER_firstSpanWidthValue",
    "fEXPLORER_menuOptionX",
    "fEXPLORER_menuOptionY",
    "byteEXPLORER_show",

    "fEXPLORER_TreeViewDirector_lastReadNumber_offsetWidth",
    "fEXPLORER_TreeViewDirector_lastReadNumber_offsetHeight",
    "fEXPLORER_TreeViewDirector_cursorTranslateYNumber",
    "fEXPLORER_TreeViewDirector_itemHeightTotal",
    "fEXPLORER_TreeViewDirector_cursorIndex",
    "fEXPLORER_TreeViewDirector_virtualIndex_ofScrollTop",
    "fEXPLORER_TreeViewDirector_virtualCount",
    "fEXPLORER_TreeViewDirector__ONSCROLLvirtualIndex",
    "fEXPLORER_TreeViewDirector__ONSCROLLvirtualCount",
    "fEXPLORER_TreeViewDirector_lastReadNumber_scrollLeft",
    "fEXPLORER_TreeViewDirector_lastReadNumber_scrollTop",
    "fEXPLORER_TreeViewDirector_beltIndexZero",
    "fEXPLORER_TreeViewDirector_TREEVIEW_ArrayFrom_itemListElement_children_length",
    "fEXPLORER_TreeViewDirector_start",
    "fEXPLORER_TreeViewDirector_length",
    "fEXPLORER_TreeViewDirector_onePositiveDiff_twoNegativeDiff_orThreeFullScreen",
    "fEXPLORER_TreeViewDirector_caseThreeOrigin",
    "fEXPLORER_TreeViewDirector_itemHeightNumber",
    "fEXPLORER_TreeViewDirector_SET_ITEMS_itemHeightNumber",
    "fEXPLORER_TreeViewDirector_WIDTH_NODE_DRAWN_NUMBER_IN_CH_UNITS_NO_PADDING",
    "fEXPLORER_TreeViewDirector_LARGEST_DEPTH_SEEN_NOT_THE_CSS_JUST_THE_DEPTH",
    "fEXPLORER_TreeViewDirector_scrollEndDeadline",
    "fEXPLORER_TreeViewDirector_scrollFetchData_virtualIndex",
    "fEXPLORER_TreeViewDirector_scrollFetchData_virtualCount",
    "fEXPLORER_TreeViewDirector_scrollFetchData_beltIndexZero",
    "fEXPLORER_TreeViewDirector_pullData_array_count",
    "fEXPLORER_TreeViewDirector_pullData_result_count",
    
    "CONST_EXPLORER_TreeViewDirector_KEY_BITS",

    "byteEXPLORER_TreeViewDirector_TREEVIEW_isRenderPending",
    "byteEXPLORER_TreeViewDirector_isCheckingTrailingEdge",
    "byteEXPLORER_TreeViewDirector_scrollIsFetchingData",

    "fEDI_getLineAndColumnIndices_indexLine",
    "fEDI_getLineAndColumnIndices_indexColumn",

  ];

  return {
    name: "inline-direct-substitution-safe",
    visitor: {
      Program(path) {
        const functionsToInline = new Map();
        const variablesToInline = new Map();

        // Pass 1: Collect targets and remove their definitions
        path.traverse({
          VariableDeclarator(varPath) {
            const varName = varPath.node.id.name;

            // Handle function inlining
            if (
              TARGET_FUNCTIONS.includes(varName) &&
              varPath.node.init &&
              t.isArrowFunctionExpression(varPath.node.init)
            ) {
              const arrowFn = varPath.node.init;

              let bodyStatements;
              if (t.isBlockStatement(arrowFn.body)) {
                bodyStatements = arrowFn.body.body;
              } else {
                bodyStatements = [t.expressionStatement(arrowFn.body)];
              }

              functionsToInline.set(varName, {
                params: arrowFn.params.map(p => p.name),
                body: bodyStatements.map(stmt => t.cloneNode(stmt)),
              });

              varPath.parentPath.remove();
            }
            
            // Handle static variable inlining
            else if (TARGET_VARIABLES.includes(varName) && varPath.node.init) {
              variablesToInline.set(varName, t.cloneNode(varPath.node.init));
              varPath.parentPath.remove();
            }
          }
        });

        // Pass 2: Safely replace variable references
        if (variablesToInline.size > 0) {
          path.traverse({
            Identifier(idPath) {
              const varName = idPath.node.name;
              
              if (
                variablesToInline.has(varName) &&
                !(idPath.parentPath.isMemberExpression() && idPath.parentPath.node.property === idPath.node && !idPath.parentPath.node.computed) &&
                !(idPath.parentPath.isVariableDeclarator() && idPath.parent.id === idPath.node)
              ) {
                const valueNode = variablesToInline.get(varName);
                idPath.replaceWith(t.cloneNode(valueNode));
              }
            }
          });
        }

        // Pass 3: Safely replace the call expressions directly
        if (functionsToInline.size > 0) {
          path.traverse({
            CallExpression(callPath) {
              const calleeName = callPath.node.callee.name;

              if (t.isIdentifier(callPath.node.callee) && functionsToInline.has(calleeName)) {
                const fnData = functionsToInline.get(calleeName);
                const args = callPath.node.arguments;
                
                const specializedBody = fnData.body.map(stmt => t.cloneNode(stmt));

                const paramValueMap = new Map();
                fnData.params.forEach((paramName, index) => {
                  paramValueMap.set(paramName, args[index] || t.identifier("undefined"));
                });

                specializedBody.forEach(statement => {
                  babel.traverse(statement, {
                    Identifier(idPath) {
                      if (
                        paramValueMap.has(idPath.node.name) &&
                        !(idPath.parentPath.isMemberExpression() && idPath.parentPath.node.property === idPath.node && !idPath.parentPath.node.computed)
                      ) {
                        const substitutionNode = paramValueMap.get(idPath.node.name);
                        idPath.replaceWith(t.cloneNode(substitutionNode));
                      }
                    }
                  }, path.scope, path);
                });

                const nodesToInsert = specializedBody.map(node => {
                  if (t.isExpressionStatement(node)) {
                    return node.expression;
                  }
                  return node;
                });

                // FIXED: Extract the single node out of the array before replacing
                if (nodesToInsert.length === 1) {
                  callPath.replaceWith(nodesToInsert[0]);
                } else if (nodesToInsert.length > 1) {
                  callPath.replaceWithMultiple(nodesToInsert);
                } else {
                  callPath.remove();
                }
              }
            }
          });
        }
      }
    }
  };
};
