// This file was originally generated with google AI

module.exports = function (babel) {
  const { types: t } = babel;

  // List all the function names you want to inline
  const TARGET_FUNCTIONS = [

    "get_EDITOR_detailRank",
    "set_EDITOR_detailRank",

    "get_EDITOR_recentBoundingClientRect_isNull_intFalsey",
    "set_EDITOR_recentBoundingClientRect_isNull_intFalsey",
    
    "get_EDITOR_findOverlay_show",
    "set_EDITOR_findOverlay_show",
    
    "get_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching",
    "set_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching",
    
    "get_EDITOR_fileStartsWithBom",
    "set_EDITOR_fileStartsWithBom",
    
    "get_EDITOR_findOverlay_wasSearched",
    "set_EDITOR_findOverlay_wasSearched",
    
    "get_EDITOR_findOverlay_options_matchWord",
    "set_EDITOR_findOverlay_options_matchWord",
  ];

  // List all the variable names you want to inline
  const TARGET_VARIABLES = [

    "INDEXOF_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",
    

    "INDEXOF_EDITOR_drawn_count_of_digits_longest_line_number",

    

    "INDEXOF_EDITOR_detailRank",
    

    "INDEXOF_EDITOR_detail_smallPosition",
    

    "INDEXOF_EDITOR_detail_largePosition",

    "INDEXOF_EDITOR_detailRank3OriginLine",
    

    "INDEXOF_EDITOR_gutterWidthStyleValue",
    

    "INDEXOF_EDITOR_gutterWidthTotal",
    

    "INDEXOF_EDITOR_virtualIndexLine",
    

    "INDEXOF_EDITOR_virtualCount",
    

    "INDEXOF_didChangeTextDocument_version",
    

    "INDEXOF_EDITOR_indexCursor",
    

    "INDEXOF_EDITOR_offsetLine",
    

    "INDEXOF_EDITOR_offsetColumn_withRespectToThisIndexLine",
    

    "INDEXOF_EDITOR_offsetColumn",
    

    "INDEXOF_EDITOR_totalShift",
    

    "INDEXOF_EDITOR_offsetWithinSpan",
    

    "INDEXOF_EDITOR_ONSCROLLvirtualIndexLine",
    

    

    "INDEXOF_EDITOR_ONSCROLLscrollTop",
    

    "INDEXOF_EDITOR_longestLine_indexLine",
    
    
    "INDEXOF_EDITOR_longestLine_length",
    

    "INDEXOF_EDITOR_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar",
    

    "INDEXOF_EDITOR_contentWidth",
    

    "INDEXOF_EDITOR_indent_ORIGINAL_indentBy",
    

    "INDEXOF_EDITOR_indent_SMALL_lineAndColumnIndices_indexLine",
    

    "INDEXOF_EDITOR_indent_startingIndex",
    

    "INDEXOF_EDITOR_recentBoundingClientRect_left",
    

    "INDEXOF_EDITOR_recentBoundingClientRect_top",
    

    "INDEXOF_EDITOR_recentBoundingClientRect_isNull_intFalsey",
    

    "INDEXOF_EDITOR_pooledTrackedSyntax_start",
    

    "INDEXOF_EDITOR_pooledTrackedSyntax_length",
    

    "INDEXOF_EDITOR_findOverlay_show",
    

    "INDEXOF_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching",
    

    "INDEXOF_EDITOR_fileStartsWithBom",
    

    "INDEXOF_EDITOR_findOverlay_wasSearched",
    

    "INDEXOF_EDITOR_findOverlay_options_matchWord",
    

    "INDEXOF_EDITOR_scrollEndDeadline",

    "INDEXOF_EDITOR_intFalsey_isScrolling",
    





    "INDEXOF_EDITOR_lineHeight",
    "INDEXOF_EDITOR_virtualIndexLine",
    "INDEXOF_EDITOR_virtualCount",
    "INDEXOF_EDITOR_ONSCROLLvirtualIndexLine",
    "INDEXOF_EDITOR_ONSCROLLvirtualCount",
    "INDEXOF_EDITOR_ONSCROLLscrollTop",
    "INDEXOF_EDITOR_longestLine_indexLine",
    "INDEXOF_EDITOR_longestLine_length",
    "INDEXOF_EDITOR_scrollEndDeadline",
    "INDEXOF_EDITOR_sum_diffPositive",
    "INDEXOF_EDITOR_sum_diffNegative",
    "INDEXOF_lastReadNumber_scrollTop",

    "ENUM_AUTOCOMPLETErenderKind_None",
    "ENUM_AUTOCOMPLETErenderKind_Show",
    "ENUM_AUTOCOMPLETErenderKind_Hide",
    "ENUM_AUTOCOMPLETErenderKind_CursorSet",
    "ENUM_AUTOCOMPLETErenderKind_CreateLines",
    "ENUM_AUTOCOMPLETErenderKind_Scroll",

    "ENUM_DIALOGrenderKind_None",
    "ENUM_DIALOGrenderKind_Show",
    "ENUM_DIALOGrenderKind_Hide",
    "ENUM_DIALOGrenderKind_DimensionsChanged",

    "ENUM_LISTrenderKind_None",
    "ENUM_LISTrenderKind_Cursor",

    "ENUM_TREEVIEWrenderKind_None",
    "ENUM_TREEVIEWrenderKind_Cursor",
    "ENUM_TREEVIEWrenderKind_Create",
    "ENUM_TREEVIEWrenderKind_Batch",
    "ENUM_TREEVIEWrenderKind_Scroll",
    "ENUM_TREEVIEWrenderKind_SetItems",
    "ENUM_TREEVIEWrenderKind_FullReset",
    "ENUM_TREEVIEWrenderKind_Scroll_PullDataDrawResult",
    "ENUM_TREEVIEWrenderKind_Resize",

    "ENUM_MENUrenderKind_None",
    "ENUM_MENUrenderKind_Cursor",
    "ENUM_MENUrenderKind_Set",
    "ENUM_MENUrenderKind_Hide",

    "ENUM_WidgetKind_None",
    "ENUM_WidgetKind_InputText",
    "ENUM_WidgetKind_YesCancel",

    "ENUM_WIDGETrenderKind_None",
    "ENUM_WIDGETrenderKind_Show",
    "ENUM_WIDGETrenderKind_Hide",

    "ENUM_TreeViewNodeKind_None",
    "ENUM_TreeViewNodeKind_isExpandable_isExpanded",
    "ENUM_TreeViewNodeKind_isExpandable_NOTisExpanded",
    "ENUM_TreeViewNodeKind_NOTisExpandable_isExpanded",
    "ENUM_TreeViewNodeKind_NOTisExpandable_NOTisExpanded",

    "ENUM_TrackedSyntaxKind_None",
    "ENUM_TrackedSyntaxKind_String",
    "ENUM_TrackedSyntaxKind_Comment",

    "ENUM_CommandKind_None",
    "ENUM_CommandKind_Submenu",
    "ENUM_CommandKind_Copy",
    "ENUM_CommandKind_CopyAbsolutePath",
    "ENUM_CommandKind_Cut",
    "ENUM_CommandKind_Paste",
    "ENUM_CommandKind_NewFile_Directory",
    "ENUM_CommandKind_NewFile_File",
    "ENUM_CommandKind_DeleteFile_Directory",
    "ENUM_CommandKind_DeleteFile_File",
    "ENUM_CommandKind_RenameFile_Directory",
    "ENUM_CommandKind_RenameFile_File",
    "ENUM_CommandKind_Find",
    "ENUM_CommandKind_SelectFolder",
    "ENUM_CommandKind_SelectWorkspace",

    "ENUM_DialogKind_None",
    "ENUM_DialogKind_FindAll",
    "ENUM_DialogKind_Settings",
    "ENUM_DialogKind_DocumentSymbol",
    "ENUM_DialogKind_Debug",

    "ENUM_EditKind_None",
    "ENUM_EditKind_InsertLtr",
    "ENUM_EditKind_DeleteLtr",
    "ENUM_EditKind_BackspaceRtl",
    "ENUM_EditKind_RemoveTextNoBatching",
    "ENUM_EditKind_Tab",
    "ENUM_EditKind_IndentMore",
    "ENUM_EditKind_IndentLess",
    "ENUM_EditKind_Enter",
    "ENUM_EditKind_Paste",
    "ENUM_EditKind_Duplicate",

    "ENUM_EnterKeyEventKind_None",
    "ENUM_EnterKeyEventKind_StartOfLine",
    "ENUM_EnterKeyEventKind_EndOfLine",
    "ENUM_EnterKeyEventKind_AmongALine",

    "ENUM_CharacterKind_None",
    "ENUM_CharacterKind_Whitespace",
    "ENUM_CharacterKind_Punctuation",
    "ENUM_CharacterKind_LetterOrDigit",

    "ENUM_RenderKind_None",
    "ENUM_RenderKind_Scroll",
    "ENUM_RenderKind_Resize",
    "ENUM_RenderKind_InsertLtr",
    "ENUM_RenderKind_TabKey",
    "ENUM_RenderKind_IndentMore",
    "ENUM_RenderKind_IndentLess",
    "ENUM_RenderKind_BackspaceRtl",
    "ENUM_RenderKind_DeleteLtr",
    "ENUM_RenderKind_RemoveSelection",
    "ENUM_RenderKind_Enter",
    "ENUM_RenderKind_DuplicateOrPaste",
    "ENUM_RenderKind_Clear",
    "ENUM_RenderKind_SetText",
    "ENUM_RenderKind_CreateViewport",
    "ENUM_RenderKind_SyntaxHighlighting",
    "ENUM_RenderKind_Cursor_flag_scrollIntoViewExplicit",
    "ENUM_RenderKind_Cursor_flag_doNotScrollIntoView",
    "ENUM_RenderKind_Cursor_n",

    "ENUM_ExtensionKind_None",
    "ENUM_ExtensionKind_JavaScript",

    "CONST_EDITOR_ASCII_LINE_FEED",
    "CONST_EDITOR_ASCII_TAB",
    "CONST_EDITOR_ASCII_SPACE",

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

    "CONST_EDITOR_gutterPaddingLeft",
    "CONST_EDITOR_gutterPaddingRight",


    "CONST_DIALOG_minTop",
    "CONST_DIALOG_minLeft",
    "CONST_DIALOG_minHeight",
    "CONST_DIALOG_minWidth",

    "CONST_EDITOR_cursor_GAP_BUFFER_CAPACITY",
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
