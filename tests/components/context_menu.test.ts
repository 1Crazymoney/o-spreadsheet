import { Component, xml } from "@odoo/owl";
import { Action, ActionSpec, createActions } from "../../src/actions/action";
import { Menu } from "../../src/components/menu/menu";
import {
  MENU_ITEM_HEIGHT,
  MENU_SEPARATOR_HEIGHT,
  MENU_VERTICAL_PADDING,
  MENU_WIDTH,
} from "../../src/constants";
import { toXC } from "../../src/helpers";
import { Model } from "../../src/model";
import { cellMenuRegistry } from "../../src/registries/menus/cell_menu_registry";
import { setCellContent } from "../test_helpers/commands_helpers";
import {
  click,
  rightClickCell,
  simulateClick,
  triggerMouseEvent,
  triggerTouchEvent,
} from "../test_helpers/dom_helper";
import { getCell, getCellContent, getEvaluatedCell } from "../test_helpers/getters_helpers";

import {
  getStylePropertyInPx,
  makeTestFixture,
  mountComponent,
  mountSpreadsheet,
  nextTick,
} from "../test_helpers/helpers";
import { mockGetBoundingClientRect } from "../test_helpers/mock_helpers";

let fixture: HTMLElement;
let model: Model;
let parent: Component;

mockGetBoundingClientRect({
  "o-menu": (el) => getElPosition(el),
  "o-popover": (el) => {
    const childName = (el.firstChild?.firstChild as HTMLElement)?.title;
    if (childName && childName.includes("subMenu")) {
      return getSubMenuSize();
    }
    return getMenuSize();
  },
  "o-spreadsheet": () => ({ top: 0, left: 0, height: 1000, width: 1000 }),
  "o-menu-item": (el) => {
    const parentPosition = getElPosition(el.parentElement!);
    let offset = MENU_VERTICAL_PADDING;
    for (let e of el.parentElement!.children) {
      if (e === el) break;

      if (el.classList.contains("o-menu-item")) {
        offset += MENU_ITEM_HEIGHT;
      } else if (el.classList.contains("o-separator")) {
        offset += MENU_SEPARATOR_HEIGHT;
      }
    }
    return {
      top: parentPosition.top + offset,
      left: parentPosition.left,
      height: MENU_ITEM_HEIGHT,
      width: MENU_WIDTH,
    };
  },
});

function getElPosition(element: string | Element): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const menu = typeof element === "string" ? fixture.querySelector<HTMLElement>(element)! : element;

  const top = getStylePropertyInPx(menu.parentElement!, "top")!;
  const left = getStylePropertyInPx(menu.parentElement!, "left")!;
  const width = getStylePropertyInPx(menu.parentElement!, "width");
  const height = getStylePropertyInPx(menu.parentElement!, "height");
  const maxHeight = getStylePropertyInPx(menu.parentElement!, "max-height")!;
  const maxWidth = getStylePropertyInPx(menu.parentElement!, "max-width")!;

  return {
    top,
    left,
    width: width || maxWidth,
    height: height || maxHeight,
  };
}

function getMenuPosition() {
  const { left, top } = getElPosition(".o-menu");
  return { left, top: top };
}

function getSubMenuPosition(depth = 1) {
  const { left, top } = getElPosition(fixture.querySelectorAll(".o-menu")[depth]);
  return { left, top: top };
}

function getItemSize() {
  return MENU_ITEM_HEIGHT;
}

function getSize(menuItemsCount: number): { width: number; height: number } {
  return {
    width: MENU_WIDTH,
    height: getItemSize() * menuItemsCount + 2 * MENU_VERTICAL_PADDING,
  };
}

function getMenuSize() {
  const menu = fixture.querySelector(".o-menu");
  const menuItems = menu!.querySelectorAll(".o-menu-item");
  return getSize(menuItems.length);
}

function getSubMenuSize(depth = 1) {
  const menu = fixture.querySelectorAll(".o-menu")[depth];
  const menuItems = menu!.querySelectorAll(".o-menu-item");
  return getSize(menuItems.length);
}

interface ContextMenuTestConfig {
  onClose?: () => void;
  menuItems?: Action[];
}

async function renderContextMenu(
  x: number,
  y: number,
  testConfig: ContextMenuTestConfig = {},
  width = 1000,
  height = 1000
): Promise<[number, number]> {
  // x, y are relative to the upper left grid corner, but the menu
  // props must take the top bar into account.
  fixture = makeTestFixture();
  ({ fixture, model, parent } = await mountComponent(ContextMenuParent, {
    props: {
      x,
      y,
      width,
      height,
      config: testConfig,
    },
    fixture,
  }));

  return [x, y];
}

function getSelectionAnchorCellXc(model: Model): string {
  const { col, row } = model.getters.getSelection().anchor.cell;
  return toXC(col, row);
}

const subMenu: Action[] = createActions([
  {
    id: "root",
    name: "root",
    children: [
      () => [
        {
          id: "subMenu1",
          name: "subMenu1",
          execute() {},
        },
        {
          id: "subMenu2",
          name: "subMenu2",
          execute() {},
        },
      ],
    ],
  },
]);

class ContextMenuParent extends Component {
  static template = xml/* xml */ `
    <div class="o-spreadsheet">
      <Menu
        onClose="() => this.onClose()"
        position="position"
        menuItems="menus"
      />
    </div>
  `;
  static components = { Menu };
  menus!: Action[];
  position!: { x: number; y: number; width: number; height: number };
  onClose!: () => void;

  constructor(props, env, node) {
    super(props, env, node);
    this.onClose = this.props.config.onClose || (() => {});
    this.position = {
      x: this.props.x,
      y: this.props.y,
      width: this.props.width,
      height: this.props.height,
    };
    this.menus =
      this.props.config.menuItems ||
      createActions([
        {
          id: "Action",
          name: "Action",
          execute() {},
        },
      ]);
    this.env.model.dispatch("RESIZE_SHEETVIEW", {
      height: this.props.height,
      width: this.props.width,
      gridOffsetX: 0,
      gridOffsetY: 0,
    });
  }
}

describe("Context Menu integration tests", () => {
  beforeEach(async () => {
    ({ fixture, model } = await mountSpreadsheet());
  });
  test("context menu simple rendering", async () => {
    await rightClickCell(model, "C8");
    expect(fixture.querySelector(".o-menu")).toMatchSnapshot();
  });

  test("right click on a cell opens a context menu", async () => {
    expect(getSelectionAnchorCellXc(model)).toBe("A1");
    expect(fixture.querySelector(".o-menu")).toBeFalsy();
    await rightClickCell(model, "C8");
    expect(getSelectionAnchorCellXc(model)).toBe("C8");
    expect(fixture.querySelector(".o-menu")).toBeTruthy();
  });

  test("right click on a cell, then left click elsewhere closes a context menu", async () => {
    await rightClickCell(model, "C8");
    expect(getSelectionAnchorCellXc(model)).toBe("C8");
    await nextTick();
    expect(fixture.querySelector(".o-menu")).toBeTruthy();

    await simulateClick(".o-grid-overlay", 50, 50);
    expect(fixture.querySelector(".o-menu")).toBeFalsy();
  });

  test("can copy/paste with context menu", async () => {
    setCellContent(model, "B1", "b1");

    await rightClickCell(model, "B1");
    expect(getSelectionAnchorCellXc(model)).toBe("B1");

    // click on 'copy' menu item
    await simulateClick(".o-menu div[data-name='copy']");

    await rightClickCell(model, "B2");

    // click on 'paste' menu item
    await simulateClick(".o-menu div[data-name='paste']");
    expect(getCellContent(model, "B1")).toBe("b1");
    expect(getCellContent(model, "B2")).toBe("b1");
  });

  test("can cut/paste with context menu", async () => {
    setCellContent(model, "B1", "b1");

    await rightClickCell(model, "B1");

    // click on 'cut' menu item
    await simulateClick(".o-menu div[data-name='cut']");

    // right click on B2
    await rightClickCell(model, "B2");
    await nextTick();
    expect(getSelectionAnchorCellXc(model)).toBe("B2");

    // click on 'paste' menu item
    await simulateClick(".o-menu div[data-name='paste']");

    expect(getCell(model, "B1")).toBeUndefined();
    expect(getCellContent(model, "B2")).toBe("b1");
  });

  test("menu does not close when right click elsewhere", async () => {
    await rightClickCell(model, "B1");
    expect(fixture.querySelector(".o-menu")).toBeTruthy();
    await rightClickCell(model, "D5");
    expect(fixture.querySelector(".o-menu")).toBeTruthy();
  });

  test("close contextmenu when clicking on menubar", async () => {
    await rightClickCell(model, "B1");
    expect(fixture.querySelector(".o-menu .o-menu-item[data-name='cut']")).toBeTruthy();
    await click(fixture, ".o-topbar-topleft");
    expect(fixture.querySelector(".o-menu")).toBeFalsy();
  });

  test("close contextmenu when clicking on menubar item", async () => {
    await rightClickCell(model, "B1");
    expect(fixture.querySelector(".o-menu .o-menu-item[data-name='cut']")).toBeTruthy();
    await click(fixture, ".o-topbar-menu[data-id='insert']");
    expect(fixture.querySelector(".o-menu .o-menu-item[data-name='cut']")).toBeFalsy();
  });

  test("close contextmenu when clicking on tools bar", async () => {
    await rightClickCell(model, "B1");
    expect(fixture.querySelector(".o-menu .o-menu-item[data-name='cut']")).toBeTruthy();
    await click(fixture, ".o-menu-item-button[title='Bold (Ctrl+B)']");
    expect(fixture.querySelector(".o-menu .o-menu-item[data-name='cut']")).toBeFalsy();
  });

  test("menu can be hidden/displayed based on the env", async () => {
    const menuDefinitions = Object.assign({}, cellMenuRegistry.content);
    cellMenuRegistry
      .add("visible_action", {
        name: "visible_action",
        sequence: 1,
        isVisible: (env) => getEvaluatedCell(model, "B1").value === "b1",
        execute() {},
      })
      .add("hidden_action", {
        name: "hidden_action",
        sequence: 2,
        isVisible: (env) => getEvaluatedCell(model, "B1").value !== "b1",
        execute() {},
      });
    setCellContent(model, "B1", "b1");
    await rightClickCell(model, "B1");
    expect(fixture.querySelector(".o-menu div[data-name='visible_action']")).toBeTruthy();
    expect(fixture.querySelector(".o-menu div[data-name='hidden_action']")).toBeFalsy();
    cellMenuRegistry.content = menuDefinitions;
  });

  test("scroll through the menu with the wheel / scrollbar prevents the grid from scrolling", async () => {
    const verticalScrollBar = fixture.querySelector(".o-scrollbar.vertical") as HTMLElement;
    const horizontalScrollBar = fixture.querySelector(".o-scrollbar.horizontal") as HTMLElement;
    expect(verticalScrollBar.scrollTop).toBe(0);
    expect(horizontalScrollBar.scrollLeft).toBe(0);

    await rightClickCell(model, "C8");

    const menu = fixture.querySelector(".o-menu")!;
    // scroll
    menu.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 300, deltaX: 300, deltaMode: 0, bubbles: true })
    );
    menu.dispatchEvent(new Event("scroll", { bubbles: true }));
    await nextTick();

    // grid always at (0, 0) scroll position
    expect(verticalScrollBar.scrollTop).toBe(0);
    expect(horizontalScrollBar.scrollLeft).toBe(0);
  });

  test("scroll through the menu with the touch device prevents the grid from scrolling", async () => {
    const verticalScrollBar = fixture.querySelector(".o-scrollbar.vertical") as HTMLElement;
    const horizontalScrollBar = fixture.querySelector(".o-scrollbar.horizontal") as HTMLElement;

    expect(verticalScrollBar.scrollTop).toBe(0);
    expect(horizontalScrollBar.scrollLeft).toBe(0);

    await rightClickCell(model, "C8");

    const menu = fixture.querySelector(".o-menu")!;

    // start move at (310, 210) touch position
    triggerTouchEvent(menu, "touchstart", { clientX: 310, clientY: 210, identifier: 1 });

    // move down;
    triggerTouchEvent(menu, "touchstart", { clientX: 310, clientY: 180, identifier: 1 });

    await nextTick();
    // grid always at (0, 0) scroll position
    expect(verticalScrollBar.scrollTop).toBe(0);
    expect(horizontalScrollBar.scrollLeft).toBe(0);
  });
});

describe("Context Menu internal tests", () => {
  test("submenu opens and close when (un)hovered", async () => {
    const menuItems = createActions([
      {
        id: "action",
        name: "action",
        execute() {},
      },
      {
        id: "root",
        name: "root",
        children: [
          () => [
            {
              id: "subMenu",
              name: "subMenu",
              execute() {},
            },
          ],
        ],
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    triggerMouseEvent(".o-menu div[data-name='root']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu']")).toBeTruthy();
    triggerMouseEvent(".o-menu div[data-name='action']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu']")).toBeFalsy();
  });

  test("Submenu parent is highlighted", async () => {
    await renderContextMenu(300, 300, { menuItems: cellMenuRegistry.getMenuItems() });
    const menuItem = fixture.querySelector(".o-menu div[data-name='paste_special']");
    expect(menuItem?.classList).not.toContain("o-menu-item-active");
    triggerMouseEvent(menuItem, "mouseover");
    await nextTick();
    expect(menuItem?.classList).toContain("o-menu-item-active");
    triggerMouseEvent(".o-menu div[data-name='paste_value_only']", "mouseover");
    await nextTick();
    expect(menuItem?.classList).toContain("o-menu-item-active");
  });

  test("submenu does not open when disabled", async () => {
    const menuItems: Action[] = createActions([
      {
        id: "root",
        name: "root",
        isEnabled: () => false,
        children: [
          {
            name: "subMenu",
            id: "subMenu",
            execute() {},
          },
        ],
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    expect(fixture.querySelector(".o-menu div[data-name='root']")!.classList).toContain("disabled");
    await simulateClick(".o-menu div[data-name='root']");
    expect(fixture.querySelector(".o-menu div[data-name='subMenu']")).toBeFalsy();
  });

  test("submenu does not open when hovering write only parent", async () => {
    const menuItems: Action[] = createActions([
      {
        id: "root",
        name: "root",
        isEnabled: () => true,
        isReadonlyAllowed: false,
        children: [
          {
            name: "subMenu",
            id: "subMenu",
            execute() {},
          },
        ],
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    model.updateMode("readonly");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='root']")!.classList).toContain("disabled");
    triggerMouseEvent(".o-menu div[data-name='root']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu']")).toBeFalsy();
  });

  test("submenu does not close when sub item hovered", async () => {
    await renderContextMenu(300, 300, { menuItems: subMenu });
    triggerMouseEvent(".o-menu div[data-name='root']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu1']")).toBeTruthy();
    triggerMouseEvent(".o-menu div[data-name='subMenu1']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu1']")).toBeTruthy();
  });

  test("menu does not close when root menu is clicked", async () => {
    await renderContextMenu(300, 300, { menuItems: subMenu });
    await simulateClick(".o-menu div[data-name='root']");
    expect(fixture.querySelector(".o-menu div[data-name='subMenu1']")).toBeTruthy();
    expect(fixture.querySelector(".o-menu div[data-name='root']")).toBeTruthy();
  });

  test("menu closed when sub menu item is clicked", async () => {
    const mockCallback = jest.fn(() => {});
    await renderContextMenu(300, 300, {
      onClose: mockCallback,
      menuItems: subMenu,
    });
    await simulateClick(".o-menu div[data-name='root']");
    await simulateClick(".o-menu div[data-name='subMenu1']");
    expect(fixture.querySelector(".o-menu div[data-name='subMenu1']")).toBeFalsy();
    expect(mockCallback).toHaveBeenCalled();
  });

  test("it renders subsubmenus", async () => {
    const menuItems = createActions([
      {
        id: "root1",
        name: "root1",
        children: [
          () => [
            {
              id: "root2",
              name: "root2",
              children: [
                () => [
                  {
                    id: "subMenu",
                    name: "subMenu",
                    execute() {},
                  },
                ],
              ],
            },
          ],
        ],
      },
    ]);
    await renderContextMenu(300, 990, { menuItems });
    await simulateClick("div[data-name='root1']");
    await simulateClick("div[data-name='root2']");
    expect(fixture.querySelector(".o-menu div[data-name='subMenu']")).toBeTruthy();
  });

  test("Can color menu items", async () => {
    const menuItems: Action[] = createActions([
      {
        id: "black",
        name: "black",
        execute() {},
      },
      {
        id: "orange",
        name: "orange",
        execute() {},
        textColor: "orange",
      },
    ]);
    await renderContextMenu(0, 0, { menuItems });
    expect((fixture.querySelector("div[data-name='black']") as HTMLElement).style.color).toEqual(
      ""
    );
    expect((fixture.querySelector("div[data-name='orange']") as HTMLElement).style.color).toEqual(
      "orange"
    );
  });

  test("Only submenus of the current parent are visible", async () => {
    const menuItems = createActions([
      {
        id: "root_1",
        name: "root_1",
        children: [
          () => [
            {
              id: "root_1_1",
              name: "root_1_1",
              children: [
                () => [
                  {
                    id: "subMenu_1",
                    name: "subMenu_1",
                    execute() {},
                  },
                ],
              ],
            },
          ],
        ],
      },
      {
        id: "root_2",
        name: "root_2",
        children: [
          () => [
            {
              id: "root_2_1",
              name: "root_2_1",
              children: [
                () => [
                  {
                    id: "subMenu_2",
                    name: "subMenu_2",
                    execute() {},
                  },
                ],
              ],
            },
          ],
        ],
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });

    triggerMouseEvent(".o-menu div[data-name='root_1']", "mouseover");
    await nextTick();
    triggerMouseEvent(".o-menu div[data-name='root_1_1']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu_1']")).toBeTruthy();
    triggerMouseEvent(".o-menu div[data-name='root_2']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='subMenu_1']")).toBeFalsy();
    expect(fixture.querySelector(".o-menu div[data-name='root_2_1']")).toBeTruthy();
  });

  test("Submenu visibility is taken into account", async () => {
    const menuItems = createActions([
      {
        id: "root",
        name: "root_1",
        children: [
          () => [
            {
              id: "menu_1",
              name: "root_1_1",
              children: [
                () => [
                  {
                    id: "visible_submenu_1",
                    name: "visible_submenu_1",
                    execute() {},
                    isVisible: () => true,
                  },
                  {
                    id: "invisible_submenu_1",
                    name: "invisible_submenu_1",
                    execute() {},
                    isVisible: () => false,
                  },
                ],
              ],
            },
          ],
        ],
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    triggerMouseEvent(".o-menu div[data-name='root']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='menu_1']")).toBeTruthy();
    triggerMouseEvent(".o-menu div[data-name='menu_1']", "mouseover");
    await nextTick();
    expect(fixture.querySelector(".o-menu div[data-name='visible_submenu_1']")).toBeTruthy();
    expect(fixture.querySelector(".o-menu div[data-name='invisible_submenu_1']")).toBeFalsy();
  });

  test("Enabled menus are updated at each render", async () => {
    let enabled = true;
    const menuItems: Action[] = createActions([
      {
        id: "menuItem",
        name: "menuItem",
        isEnabled: () => enabled,
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    expect(fixture.querySelector("div[data-name='menuItem']")?.classList).not.toContain("disabled");

    enabled = false;
    parent.render(true);
    await nextTick();
    expect(fixture.querySelector("div[data-name='menuItem']")?.classList).toContain("disabled");
  });

  test("Visible menus are updated at each render", async () => {
    let visible = true;
    const menuItems: Action[] = createActions([
      {
        id: "menuItem",
        name: "menuItem",
        isVisible: () => visible,
      },
    ]);
    await renderContextMenu(300, 300, { menuItems });
    expect(fixture.querySelector("div[data-name='menuItem']")).toBeTruthy();

    visible = false;
    parent.render(true);
    await nextTick();
    expect(fixture.querySelector("div[data-name='menuItem']")).toBeFalsy();
  });
});

describe("Context Menu position on large screen 1000px/1000px", () => {
  test("it renders menu on the bottom right if enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(300, 300);
    const { left, top } = getMenuPosition();
    expect(left).toBe(clickX);
    expect(top).toBe(clickY);
  });

  test("it renders menu on the top right if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(300, 990);
    const { left, top } = getMenuPosition();
    const { height } = getMenuSize();
    expect(left).toBe(clickX);
    expect(top).toBe(clickY - height);
  });

  test("it renders menu on the bottom left if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(990, 300);
    const { left, top } = getMenuPosition();
    const { width } = getMenuSize();
    expect(left).toBe(clickX - width);
    expect(top).toBe(clickY);
  });

  test("it renders menu on the top left if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(990, 990);
    const { left, top } = getMenuPosition();
    const { width, height } = getMenuSize();
    expect(left).toBe(clickX - width);
    expect(top).toBe(clickY - height);
  });

  test("it renders submenu on the bottom right if enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(300, 300, { menuItems: subMenu });
    await simulateClick("div[data-name='root']");
    const { left, top } = getSubMenuPosition();
    const { width } = getMenuSize();
    expect(left).toBe(clickX + width);
    expect(top).toBe(clickY);
  });

  test("it renders submenu on the bottom left if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(1000 - MENU_WIDTH - 10, 300, {
      menuItems: subMenu,
    });
    await simulateClick("div[data-name='root']");
    const { left, top } = getSubMenuPosition();
    const { width } = getMenuSize();
    const { left: rootLeft } = getMenuPosition();
    expect(rootLeft).toBe(clickX);
    expect(left).toBe(clickX - width);
    expect(top).toBe(clickY);
  });

  test("it renders all menus on the bottom left if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(990, 300, { menuItems: subMenu });
    await simulateClick("div[data-name='root']");
    const { left, top } = getSubMenuPosition();
    const { width } = getMenuSize();
    const { left: rootLeft } = getMenuPosition();
    expect(rootLeft).toBe(clickX - width);
    expect(left).toBe(clickX - 2 * width);
    expect(top).toBe(clickY);
  });

  test("it renders submenu on the top right if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(300, 980, { menuItems: subMenu });
    await simulateClick("div[data-name='root']");
    const { left, top } = getSubMenuPosition();
    const { height } = getSubMenuSize();
    const { width } = getMenuSize();
    expect(top).toBe(clickY - height + getItemSize());
    expect(left).toBe(clickX + width);
  });

  test("it renders all menus on the top right if not enough space", async () => {
    const [clickX, clickY] = await renderContextMenu(300, 990, { menuItems: subMenu });
    await simulateClick("div[data-name='root']");
    const { left, top } = getSubMenuPosition();
    const { top: rootTop } = getMenuPosition();
    const { height, width } = getSubMenuSize();
    const { height: rootHeight } = getMenuSize();
    expect(rootTop).toBe(clickY - rootHeight);
    expect(top).toBe(clickY + MENU_ITEM_HEIGHT - height);
    expect(left).toBe(clickX + width);
  });

  test("multi depth menu is properly placed on the screen", async () => {
    const subMenus: Action[] = createActions([
      {
        id: "root",
        name: "root",
        children: [
          {
            id: "subMenu",
            name: "subMenu",
            children: [
              {
                id: "subSubMenu",
                name: "subSubMenu",
                execute() {},
              },
            ],
          },
        ],
      },
    ]);
    const [clickX] = await renderContextMenu(100, 100, { menuItems: subMenus });
    await simulateClick("div[data-name='root']");
    await simulateClick("div[data-name='subMenu']");
    const { left: secondSubLeft } = getSubMenuPosition(2);
    const { width: subMenuWidth } = getSubMenuSize();
    const { width: rootWidth } = getMenuSize();
    expect(secondSubLeft).toBe(clickX + rootWidth + subMenuWidth);
  });
});

describe("Context menu react to grid size changes", () => {
  beforeEach(async () => {
    ({ model, fixture } = await mountSpreadsheet());
  });

  test("Submenu is closed when grid size change make the parent menu hidden", async () => {
    fixture
      .querySelector(".o-grid-overlay")!
      .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 800, clientY: 0 }));
    await nextTick();
    await simulateClick("div[data-name='paste_special']");
    let menus = fixture.querySelectorAll(".o-menu");
    expect(menus[0].parentElement?.style.display).toBe("block");
    expect(menus[1]).toBeTruthy();

    model.dispatch("RESIZE_SHEETVIEW", { width: 500, height: 500 });
    await nextTick();
    await nextTick(); // First render hides the parent menu, second closes the submenu

    menus = fixture.querySelectorAll(".o-menu");
    expect(menus[0].parentElement?.style.display).toBe("none");
    expect(menus[1]).toBeFalsy();
  });

  test("Submenu is closed when grid size change moves the parent menu", async () => {
    fixture
      .querySelector(".o-grid-overlay")!
      .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 500, clientY: 0 }));
    await nextTick();
    await simulateClick("div[data-name='paste_special']");
    let menus = fixture.querySelectorAll(".o-menu");
    expect(menus[0].parentElement?.style.left).toBe("500px");
    expect(menus[1]).toBeTruthy();

    model.dispatch("RESIZE_SHEETVIEW", { width: 500 + MENU_WIDTH / 2, height: 1000 });
    await nextTick();
    await nextTick(); // First render moves the parent menu, second closes the submenu

    menus = fixture.querySelectorAll(".o-menu");
    expect(menus[0].parentElement?.style.left).toBe(`${500 - MENU_WIDTH}px`);
    expect(menus[1]).toBeFalsy();
  });
});

describe("Context menu separator", () => {
  function getSimpleMenuItem(
    name: string,
    options?: {
      hidden?: boolean;
      separator?: boolean;
    }
  ): ActionSpec {
    return {
      id: name,
      name,
      isVisible: () => !options?.hidden,
      separator: options?.separator,
    };
  }

  test("Separators are displayed", async () => {
    const menuItems = createActions([
      getSimpleMenuItem("1", { separator: true }),
      getSimpleMenuItem("2"),
    ]);

    await renderContextMenu(0, 0, { menuItems });
    expect(fixture.querySelector(".o-menu")?.children[1].classList).toContain("o-separator");
    expect(fixture.querySelectorAll(".o-menu .o-separator").length).toBe(1);
  });

  test("Separators of hidden items are displayed", async () => {
    const menuItems = createActions([
      getSimpleMenuItem("1"),
      getSimpleMenuItem("2", { separator: true, hidden: true }),
      getSimpleMenuItem("3"),
    ]);

    await renderContextMenu(0, 0, { menuItems });
    expect(fixture.querySelector(".o-menu")?.children[1].classList).toContain("o-separator");
    expect(fixture.querySelectorAll(".o-menu .o-separator").length).toBe(1);
  });

  test("No separator for empty menu", async () => {
    const menuItems = createActions([getSimpleMenuItem("1", { separator: true, hidden: true })]);
    await renderContextMenu(0, 0, { menuItems });
    expect(fixture.querySelectorAll(".o-menu .o-separator").length).toBe(0);
  });

  test("No separator for last menu item in menu", async () => {
    const menuItems = createActions([getSimpleMenuItem("1", { separator: true })]);
    await renderContextMenu(0, 0, { menuItems });
    expect(fixture.querySelectorAll(".o-menu .o-separator").length).toBe(0);
  });

  test("No separator for last visible menu item menu", async () => {
    const menuItems = createActions([
      getSimpleMenuItem("1", { separator: true }),
      getSimpleMenuItem("2", { hidden: true }),
    ]);

    await renderContextMenu(0, 0, { menuItems });
    expect(fixture.querySelectorAll(".o-menu .o-separator").length).toBe(0);
  });
});
