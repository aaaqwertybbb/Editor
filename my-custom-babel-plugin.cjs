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

    "F_EDI_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",
    

    "F_EDI_drawn_count_of_digits_longest_line_number",

    

    "F_EDI_detailRank",
    

    "F_EDI_detail_smallPosition",
    

    "F_EDI_detail_largePosition",

    "F_EDI_detailRank3OriginLine",
    

    "F_EDI_gutterWidthStyleValue",
    

    "F_EDI_gutterWidthTotal",
    

    "F_EDI_virtualIndexLine",
    

    "F_EDI_virtualCount",
    

    "F_didChangeTextDocument_version",
    

    "F_EDI_indexCursor",
    

    "F_EDI_offsetLine",
    

    "F_EDI_offsetColumn_withRespectToThisIndexLine",
    

    "F_EDI_offsetColumn",
    

    "F_EDI_totalShift",
    

    "F_EDI_offsetWithinSpan",
    

    "F_EDI_ONSCROLLvirtualIndexLine",
    

    

    "F_EDI_ONSCROLLscrollTop",
    

    "F_EDI_longestLine_indexLine",
    
    
    "F_EDI_longestLine_length",
    

    "F_EDI_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar",
    

    "F_EDI_contentWidth",
    

    "F_EDI_indent_ORIGINAL_indentBy",
    

    "F_EDI_indent_SMALL_lineAndColumnIndices_indexLine",
    

    "F_EDI_indent_startingIndex",
    

    "F_EDI_recentBoundingClientRect_left",
    

    "F_EDI_recentBoundingClientRect_top",
    

    "F_EDI_recentBoundingClientRect_isNull_intFalsey",
    

    "F_EDI_pooledTrackedSyntax_start",
    

    "F_EDI_pooledTrackedSyntax_length",
    

    "F_EDI_findOverlay_show",
    

    "F_EDI_findOverlay_isBeingShownDueToMultiCursorMatching",
    

    "F_EDI_fileStartsWithBom",
    

    "F_EDI_findOverlay_wasSearched",
    

    "F_EDI_findOverlay_options_matchWord",
    

    "F_EDI_scrollEndDeadline",

    "F_EDI_intFalsey_isScrolling",
    





    "F_EDI_lineHeight",
    "F_EDI_virtualIndexLine",
    "F_EDI_virtualCount",
    "F_EDI_ONSCROLLvirtualIndexLine",
    "F_EDI_ONSCROLLvirtualCount",
    "F_EDI_ONSCROLLscrollTop",
    "F_EDI_longestLine_indexLine",
    "F_EDI_longestLine_length",
    "F_EDI_scrollEndDeadline",
    "F_EDI_sum_diffPositive",
    "F_EDI_sum_diffNegative",
    "F_lastReadNumber_scrollTop",

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












    "F_EDI_cursor_editKind",
    "F_EDI_cursor_indexLine",
    "F_EDI_cursor_indexColumn",
    "F_EDI_cursor_STORED_indexColumn",
    "F_EDI_cursor_cursorTranslateYValue",
    "F_EDI_cursor_cursorTranslateXValue",
    "F_EDI_cursor_selectionAnchor",
    "F_EDI_cursor_selectionEnd",
    "F_EDI_cursor_selectionIndexAnchorLine",
    "F_EDI_cursor_selectionIndexAnchorColumn",
    "F_EDI_cursor_selectionIndexEndLine",
    "F_EDI_cursor_selectionIndexEndColumn",
    "F_EDI_cursor_DRAWN_selectionAnchor",
    "F_EDI_cursor_DRAWN_selectionEnd",
    "F_EDI_cursor_DRAWN_selection_virtualIndexLine",
    "F_EDI_cursor_DRAWN_selection_virtualCount",
    "F_EDI_cursor_editLength",
    "F_EDI_cursor_editPosition",
    "F_EDI_cursor_editIndexLine",
    "F_EDI_cursor_editIndexColumn",
    "F_EDI_cursor_editRenderedDisplacement",
    "F_EDI_cursor_editRenderedDisplacement_INDEX_LINE_OFFSET",
    "F_EDI_cursor_END_editIndexLine",
    "F_EDI_cursor_END_editIndexColumn",
    "F_EDI_cursor_gapBufferCount",
    "F_EDI_cursor_editLineFeedCount",
    "F_EDI_cursor_EDI_duplicate_small",
    "F_EDI_cursor_EDI_duplicate_length",













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
