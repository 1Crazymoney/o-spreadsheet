import { Component, tags } from "@odoo/owl";
import { Model } from "../model";
import { SCROLLBAR_WIDTH } from "../constants";
import { Cell } from "../types";
import { SpreadsheetEnv } from "./spreadsheet";
import { Registry } from "../registry";

const { xml, css } = tags;

//------------------------------------------------------------------------------
// Context Menu Registry
//------------------------------------------------------------------------------

export type ContextMenuType = "COLUMN" | "ROW" | "CELL";

interface ActionContextMenuItem {
  type: "action";
  name: string;
  description: string;
  isEnabled?: (cell: Cell | null) => boolean;
  isVisible?: (type: ContextMenuType) => boolean;
  action: (model: Model, subEnv: SpreadsheetEnv) => void;
}

interface SeparatorContextMenuItem {
  type: "separator";
  isVisible?: (type: ContextMenuType) => boolean;
}

export type ContextMenuItem = ActionContextMenuItem | SeparatorContextMenuItem;

export const contextMenuRegistry = new Registry<ContextMenuItem>()
  .add("cut", {
    type: "action",
    name: "cut",
    description: "Cut",
    action(model) {
      model.dispatch({ type: "CUT", target: model.state.selection.zones });
    }
  })
  .add("copy", {
    type: "action",
    name: "copy",
    description: "Copy",
    action(model) {
      model.dispatch({ type: "COPY", target: model.state.selection.zones });
    }
  })
  .add("paste", {
    type: "action",
    name: "paste",
    description: "Paste",
    action(model) {
      model.dispatch({
        type: "PASTE",
        target: model.state.selection.zones,
        onlyFormat: false
      });
    }
  })
  .add("separator1", {
    type: "separator"
  })
  .add("clear_cell", {
    type: "action",
    name: "clear_cell",
    description: "Clear cell",
    action(model: Model) {
      model.dispatch({ type: "SET_VALUE", xc: model.state.activeXc, text: "" });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "CELL";
    },
    isEnabled: (cell: Cell | null) => {
      return Boolean(cell && cell.content);
    }
  })
  .add("conditional_formatting", {
    type: "action",
    name: "conditional_formatting",
    description: "Conditional Format",
    action(model, subEnv: SpreadsheetEnv) {
      subEnv.openSidePanel("ConditionalFormatting");
    }
  })
  .add("delete_column", {
    type: "action",
    name: "delete_column",
    description: "Delete column(s)",
    action(model) {
      const columns = model.getters.getActiveCols();
      model.dispatch({
        type: "REMOVE_COLUMNS",
        columns: [...columns],
        sheet: model.state.activeSheet
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "COLUMN";
    }
  })
  .add("clear_column", {
    type: "action",
    name: "clear_column",
    description: "Clear column(s)",
    action(model) {
      const target = [...model.getters.getActiveCols()].map(index =>
        model.getters.getColsZone(index, index)
      );
      model.dispatch({
        type: "DELETE_CONTENT",
        target,
        sheet: model.workbook.activeSheet.name
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "COLUMN";
    }
  })
  .add("add_column_before", {
    type: "action",
    name: "add_column_before",
    description: "Add column before",
    action(model) {
      const column = Math.min(...model.getters.getActiveCols());
      const quantity = model.getters.getActiveCols().size;
      model.dispatch({
        type: "ADD_COLUMNS",
        sheet: model.state.activeSheet,
        position: "before",
        column,
        quantity
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "COLUMN";
    }
  })
  .add("add_column_after", {
    type: "action",
    name: "add_column_after",
    description: "Add column after",
    action(model) {
      const column = Math.max(...model.getters.getActiveCols());
      const quantity = model.getters.getActiveCols().size;
      model.dispatch({
        type: "ADD_COLUMNS",
        sheet: model.state.activeSheet,
        position: "after",
        column,
        quantity
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "COLUMN";
    }
  })
  .add("delete_row", {
    type: "action",
    name: "delete_row",
    description: "Delete row(s)",
    action(model) {
      const rows = model.getters.getActiveRows();
      model.dispatch({ type: "REMOVE_ROWS", sheet: model.state.activeSheet, rows: [...rows] });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "ROW";
    }
  })
  .add("clear_row", {
    type: "action",
    name: "clear_row",
    description: "Clear row(s)",
    action(model) {
      const target = [...model.getters.getActiveRows()].map(index =>
        model.getters.getRowsZone(index, index)
      );
      model.dispatch({
        type: "DELETE_CONTENT",
        target,
        sheet: model.workbook.activeSheet.name
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "ROW";
    }
  })
  .add("add_row_before", {
    type: "action",
    name: "add_row_before",
    description: "Add row before",
    action(model) {
      const row = Math.min(...model.getters.getActiveRows());
      const quantity = model.getters.getActiveRows().size;
      model.dispatch({
        type: "ADD_ROWS",
        sheet: model.state.activeSheet,
        position: "before",
        row,
        quantity
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "ROW";
    }
  })
  .add("add_row_after", {
    type: "action",
    name: "add_row_after",
    description: "Add row after",
    action(model) {
      const row = Math.max(...model.getters.getActiveRows());
      const quantity = model.getters.getActiveRows().size;
      model.dispatch({
        type: "ADD_ROWS",
        sheet: model.state.activeSheet,
        position: "after",
        row,
        quantity
      });
    },
    isVisible: (type: ContextMenuType): boolean => {
      return type === "ROW";
    }
  });

//------------------------------------------------------------------------------
// Context Menu Component
//------------------------------------------------------------------------------

const TEMPLATE = xml/* xml */ `
    <div class="o-context-menu" t-att-style="style" tabindex="-1" t-on-blur="trigger('close')">
        <t t-foreach="menuItems" t-as="menuItem" t-key="menuItem.name">
          <t t-set="isEnabled" t-value="!menuItem.isEnabled or menuItem.isEnabled(model.state.selectedCell)"/>
          <div
            t-if="menuItem.type === 'action'"
            t-att-data-name="menuItem.name"
            t-on-click="activateMenu(menuItem)"
            class="o-menuitem"
            t-att-class="{disabled: !isEnabled}">
              <t t-esc="menuItem.description"/>
          </div>
          <div t-else="" class="o-menuitem separator" />
        </t>
    </div>`;

const CSS = css/* scss */ `
  .o-context-menu {
    position: absolute;
    width: 180px;
    background-color: white;
    box-shadow: 0 1px 4px 3px rgba(60, 64, 67, 0.15);
    font-size: 14px;
    &:focus {
      outline: none;
    }
    .o-menuitem {
      padding: 10px 25px;
      cursor: pointer;

      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }

      &.disabled {
        color: grey;
      }

      &.separator {
        height: 1px;
        background-color: rgba(0, 0, 0, 0.12);
        margin: 0 8px;
        padding: 0;
      }
    }
  }
`;

interface Props {
  model: Model;
  position: { x: number; y: number };
  type: ContextMenuType;
}

export class ContextMenu extends Component<Props, any> {
  static template = TEMPLATE;
  static style = CSS;

  model: Model = this.props.model;

  menuItems: ContextMenuItem[] = contextMenuRegistry
    .getAll()
    .filter(item => !item.isVisible || item.isVisible(this.props.type));

  mounted() {
    this.el!.focus();
  }

  async willUpdateProps(newProps: Props) {
    this.menuItems = contextMenuRegistry
      .getAll()
      .filter(item => !item.isVisible || item.isVisible(newProps.type));
  }

  get style() {
    const { x, y } = this.props.position;
    const width = this.model.state.clientWidth;
    const height = this.model.state.clientHeight;
    const hAlign = x < width - 220 ? "left" : "right";
    const hStyle = hAlign + ":" + (hAlign === "left" ? x : width - x + SCROLLBAR_WIDTH);
    const vAlign = y < height - 220 ? "top" : "bottom";
    const vStyle = vAlign + ":" + (vAlign === "top" ? y : height - y);
    return `${vStyle}px;${hStyle}px`;
  }

  activateMenu(menu: ActionContextMenuItem) {
    if (!menu.isEnabled || menu.isEnabled(this.model.state.selectedCell)) {
      menu.action(this.model, this.env.spreadsheet);
    }
  }
}
