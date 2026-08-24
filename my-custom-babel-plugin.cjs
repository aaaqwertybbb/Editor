// This file was originally generated with google AI

module.exports = function (babel) {
  const { types: t } = babel;

  // List all the function names you want to inline
  const TARGET_FUNCTIONS = [
    
    
    
    // TODO: this is in here twice (it appears again as another entry later)... why?
    "set_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",




    "get_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",
    "set_EDITOR_findOverlay_isBeingShownDueToMultiCursorMatching_originMatchNumber",
    "get_EDITOR_drawn_count_of_digits_longest_line_number",
    "set_EDITOR_drawn_count_of_digits_longest_line_number",
    "get_EDITOR_lineHeight",
    "set_EDITOR_lineHeight",
    "get_EDITOR_detailRank",
    "set_EDITOR_detailRank",
    "get_EDITOR_detail_smallPosition",
    "set_EDITOR_detail_smallPosition",
    "get_EDITOR_detail_largePosition",
    "set_EDITOR_detail_largePosition",
    "get_EDITOR_detailRank3OriginLine",
    "set_EDITOR_detailRank3OriginLine",
    "get_EDITOR_gutterWidthStyleValue",
    "set_EDITOR_gutterWidthStyleValue",
    "get_EDITOR_gutterWidthTotal",
    "set_EDITOR_gutterWidthTotal",
    "get_EDITOR_virtualIndexLine",
    "set_EDITOR_virtualIndexLine",
    "get_EDITOR_virtualCount",
    "set_EDITOR_virtualCount",
    "get_didChangeTextDocument_version",
    "set_didChangeTextDocument_version",
    "get_EDITOR_indexCursor",
    "set_EDITOR_indexCursor",
    "get_EDITOR_offsetLine",
    "set_EDITOR_offsetLine",
    "get_EDITOR_offsetColumn_withRespectToThisIndexLine",
    "set_EDITOR_offsetColumn_withRespectToThisIndexLine",
    "get_EDITOR_offsetColumn",
    "set_EDITOR_offsetColumn",
    "get_EDITOR_totalShift",
    "set_EDITOR_totalShift",
    "get_EDITOR_offsetWithinSpan",
    "set_EDITOR_offsetWithinSpan",
    "get_EDITOR_ONSCROLLvirtualIndexLine",
    "set_EDITOR_ONSCROLLvirtualIndexLine",
    "get_EDITOR_ONSCROLLvirtualCount",
    "set_EDITOR_ONSCROLLvirtualCount",
    "get_EDITOR_ONSCROLLscrollTop",
    "set_EDITOR_ONSCROLLscrollTop",
    "get_EDITOR_longestLine_indexLine",
    "set_EDITOR_longestLine_indexLine",
    "get_EDITOR_longestLine_length",
    "set_EDITOR_longestLine_length",
    "get_EDITOR_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar",
    "set_EDITOR_longestLine_length_PreviousValueWhenLastDrewHorizontalScrollbar",
    "get_EDITOR_contentWidth",
    "set_EDITOR_contentWidth",
    "get_EDITOR_indent_ORIGINAL_indentBy",
    "set_EDITOR_indent_ORIGINAL_indentBy",
    "get_EDITOR_indent_SMALL_lineAndColumnIndices_indexLine",
    "set_EDITOR_indent_SMALL_lineAndColumnIndices_indexLine",
    "get_EDITOR_indent_startingIndex",
    "set_EDITOR_indent_startingIndex",


    "get_EDITOR_recentBoundingClientRect_left",
    "set_EDITOR_recentBoundingClientRect_left",

    "get_EDITOR_recentBoundingClientRect_top",
    "set_EDITOR_recentBoundingClientRect_top",

    "get_EDITOR_recentBoundingClientRect_isNull_intFalsey",
    "set_EDITOR_recentBoundingClientRect_isNull_intFalsey",

    "get_EDITOR_pooledTrackedSyntax_start",
    "set_EDITOR_pooledTrackedSyntax_start",

    "get_EDITOR_pooledTrackedSyntax_length",
    "set_EDITOR_pooledTrackedSyntax_length",



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

    "get_ExtensionKind_None",
    "get_ExtensionKind_JavaScript",

    "get_EditKind_None",
    "get_EditKind_InsertLtr",
    "get_EditKind_DeleteLtr",
    "get_EditKind_BackspaceRtl",
    "get_EditKind_RemoveTextNoBatching",
    "get_EditKind_Tab",
    "get_EditKind_IndentMore",
    "get_EditKind_IndentLess",
    "get_EditKind_Enter",
    "get_EditKind_Paste",
    "get_EditKind_Duplicate",

    "get_EnterKeyEventKind_None",
    "get_EnterKeyEventKind_StartOfLine",
    "get_EnterKeyEventKind_EndOfLine",
    "get_EnterKeyEventKind_AmongALine",

    "get_CharacterKind_None",
    "get_CharacterKind_Whitespace",
    "get_CharacterKind_Punctuation",
    "get_CharacterKind_LetterOrDigit",

    "get_DialogKind_None",
    "get_DialogKind_FindAll",
    "get_DialogKind_Settings",
    "get_DialogKind_DocumentSymbol",
    "get_DialogKind_Debug",

    "get_CommandKind_None",
    "get_CommandKind_Submenu",
    "get_CommandKind_Copy",
    "get_CommandKind_CopyAbsolutePath",
    "get_CommandKind_Cut",
    "get_CommandKind_Paste",
    "get_CommandKind_NewFile_Directory",
    "get_CommandKind_NewFile_File",
    "get_CommandKind_DeleteFile_Directory",
    "get_CommandKind_DeleteFile_File",
    "get_CommandKind_RenameFile_Directory",
    "get_CommandKind_RenameFile_File",
    "get_CommandKind_Find",
    "get_CommandKind_SelectFolder",
    "get_CommandKind_SelectWorkspace",


    "get_TrackedSyntaxKind_None",
    "get_TrackedSyntaxKind_String",
    "get_TrackedSyntaxKind_Comment",

    "get_TreeViewNodeKind_None",
    "get_TreeViewNodeKind_isExpandable_isExpanded",
    "get_TreeViewNodeKind_isExpandable_NOTisExpanded",
    "get_TreeViewNodeKind_NOTisExpandable_isExpanded",
    "get_TreeViewNodeKind_NOTisExpandable_NOTisExpanded",

    "get_WidgetKind_None",
    "get_WidgetKind_InputText",
    "get_WidgetKind_YesCancel",

    "get_EDITOR_ASCII_LINE_FEED",
    "get_EDITOR_ASCII_TAB",
    "get_EDITOR_ASCII_SPACE",

    "get_js_DOUBLEQUOTE_str",
    "get_js_SINGLEQUOTE_str",
    "get_js_BACKTICK_str",
    "get_js_FORWARDSLASH_str",
    "get_js_BACKSLASH_str",
    "get_js_ASTERISK_str",
    "get_js_LINEFEED_str",
    "get_js_OPENPARENTHESIS_str",
    "get_js_CLOSEPARENTHESIS_str",
    "get_js_PERIOD_str",
    "get_js_EQUALS_str",
    "get_js_OPENBRACKET_str",
    "get_js_CLOSEBRACKET_str",
    "get_js_BANG_str",
    "get_js_PLUS_str",
    "get_js_MINUS_str",
    "get_js_STAR_str",
    "get_js_PERCENT_str",
    "get_js_AMPERSAND_str",
    "get_js_PIPE_str",
    "get_js_QUESTIONMARK_str",
    "get_js_CARET_str",
    
    "get_js_DOUBLEQUOTE_num",
    "get_js_SINGLEQUOTE_num",
    "get_js_BACKTICK_num",
    "get_js_FORWARDSLASH_num",
    "get_js_BACKSLASH_num",
    "get_js_ASTERISK_num",
    "get_js_LINEFEED_num",
    "get_js_OPENPARENTHESIS_num",
    "get_js_CLOSEPARENTHESIS_num",
    "get_js_PERIOD_num",
    "get_js_EQUALS_num",
    "get_js_OPENBRACKET_num",
    "get_js_CLOSEBRACKET_num",
    "get_js_BANG_num",
    "get_js_PLUS_num",
    "get_js_MINUS_num",
    "get_js_STAR_num",
    "get_js_PERCENT_num",
    "get_js_AMPERSAND_num",
    "get_js_PIPE_num",
    "get_js_QUESTIONMARK_num",
    "get_js_CARET_num",

    "get_EDITOR_gutterPaddingLeft",
    "get_EDITOR_gutterPaddingRight",

    "get_DIALOG_minTop",
    "get_DIALOG_minLeft",
    "get_DIALOG_minHeight",
    "get_DIALOG_minWidth",

    "get_RenderKind_None",
    "get_RenderKind_Scroll",
    "get_RenderKind_Resize",
    "get_RenderKind_InsertLtr",
    "get_RenderKind_TabKey",
    "get_RenderKind_IndentMore",
    "get_RenderKind_IndentLess",
    "get_RenderKind_BackspaceRtl",
    "get_RenderKind_DeleteLtr",
    "get_RenderKind_RemoveSelection",
    "get_RenderKind_Enter",
    "get_RenderKind_DuplicateOrPaste",
    "get_RenderKind_Clear",
    "get_RenderKind_SetText",
    "get_RenderKind_CreateViewport",
    "get_RenderKind_SyntaxHighlighting",
    "get_RenderKind_Cursor_flag_scrollIntoViewExplicit",
    "get_RenderKind_Cursor_flag_doNotScrollIntoView",
    "get_RenderKind_Cursor_n",

    "get_MENUrenderKind_None",
    "get_MENUrenderKind_Cursor",
    "get_MENUrenderKind_Set",
    "get_MENUrenderKind_Hide",

    "get_TREEVIEWrenderKind_None",
    "get_TREEVIEWrenderKind_Cursor",
    "get_TREEVIEWrenderKind_Create",
    "get_TREEVIEWrenderKind_Batch",
    "get_TREEVIEWrenderKind_Scroll",
    "get_TREEVIEWrenderKind_SetItems",
    "get_TREEVIEWrenderKind_FullReset",
    "get_TREEVIEWrenderKind_Scroll_PullDataDrawResult",
    "get_TREEVIEWrenderKind_Resize",

    "get_LISTrenderKind_None",
    "get_LISTrenderKind_Cursor",

    "get_WIDGETrenderKind_None",
    "get_WIDGETrenderKind_Show",
    "get_WIDGETrenderKind_Hide",

    "get_DIALOGrenderKind_None",
    "get_DIALOGrenderKind_Show",
    "get_DIALOGrenderKind_Hide",
    "get_DIALOGrenderKind_DimensionsChanged",

    "get_AUTOCOMPLETErenderKind_None",
    "get_AUTOCOMPLETErenderKind_Show",
    "get_AUTOCOMPLETErenderKind_Hide",
    "get_AUTOCOMPLETErenderKind_CursorSet",
    "get_AUTOCOMPLETErenderKind_CreateLines",
    "get_AUTOCOMPLETErenderKind_Scroll",

    "INDEXOF_EDITOR_lineHeight",
    "INDEXOF_EDITOR_virtualIndexLine",
    "INDEXOF_EDITOR_virtualCount",
    "INDEXOF_EDITOR_ONSCROLLvirtualIndexLine",
    "INDEXOF_EDITOR_ONSCROLLvirtualCount",
    "INDEXOF_EDITOR_ONSCROLLscrollTop",
    "INDEXOF_EDITOR_longestLine_length",
    "INDEXOF_EDITOR_longestLine_indexLine",

    "get_EDITOR_scrollEndDeadline",
    "set_EDITOR_scrollEndDeadline",
    "INDEXOF_EDITOR_scrollEndDeadline",

    "get_EDITOR_sum_diffPositive",
    "set_EDITOR_sum_diffPositive",
    "INDEXOF_EDITOR_sum_diffPositive",

    "get_EDITOR_sum_diffNegative",
    "set_EDITOR_sum_diffNegative",
    "INDEXOF_EDITOR_sum_diffNegative",

    "get_lastReadNumber_scrollTop",
    "set_lastReadNumber_scrollTop",
    "INDEXOF_lastReadNumber_scrollTop",
  ];

  return {
    name: "inline-direct-substitution-safe",
    visitor: {
      Program(path) {
        const functionsToInline = new Map();

        // Pass 1: Collect target functions and remove their definitions
        path.traverse({
          VariableDeclarator(varPath) {
            const varName = varPath.node.id.name;

            if (
              TARGET_FUNCTIONS.includes(varName) &&
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
                body: bodyStatements,
              });

              varPath.parentPath.remove();
            }
          }
        });

        if (functionsToInline.size === 0) return;

        // Pass 2: Safely replace the call expressions directly
        path.traverse({
          CallExpression(callPath) {
            const calleeName = callPath.node.callee.name;

            if (t.isIdentifier(callPath.node.callee) && functionsToInline.has(calleeName)) {
              const fnData = functionsToInline.get(calleeName);
              const args = callPath.node.arguments;
              
              // Clone the body statements for this specific call instance
              const specializedBody = fnData.body.map(stmt => t.cloneNode(stmt));

              // Map parameters to arguments
              const paramValueMap = new Map();
              fnData.params.forEach((paramName, index) => {
                paramValueMap.set(paramName, args[index] || t.identifier("undefined"));
              });

              // Substitute the variable values into the statements
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

              // Strip away ExpressionStatement wrappers if replacing code inline
              const nodesToInsert = specializedBody.map(node => {
                if (t.isExpressionStatement(node)) {
                  return node.expression;
                }
                return node;
              });

              // Safely swap out the exact call expression node without crashing on the parent lookups
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
  };
};
