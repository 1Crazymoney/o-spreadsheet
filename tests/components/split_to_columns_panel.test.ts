import { Component, onMounted, onWillUnmount, xml } from "@odoo/owl";
import { Model } from "../../src";
import { SplitIntoColumnsPanel } from "../../src/components/side_panel/split_to_columns_panel/split_to_columns_panel";
import { SpreadsheetChildEnv } from "../../src/types";
import { setCellContent, setSelection } from "../test_helpers/commands_helpers";
import {
  click,
  setCheckboxValueAndTrigger,
  setInputValueAndTrigger,
} from "../test_helpers/dom_helper";
import { mountComponent, nextTick, setGrid, spyModelDispatch } from "../test_helpers/helpers";

interface ParentProps {
  onCloseSidePanel: () => void;
}
class Parent extends Component<ParentProps, SpreadsheetChildEnv> {
  static components = { SplitIntoColumnsPanel };
  static template = xml/*xml*/ `
    <SplitIntoColumnsPanel onCloseSidePanel="props.onCloseSidePanel"/>
  `;
  setup() {
    onMounted(() => this.env.model.on("update", this, () => this.render(true)));
    onWillUnmount(() => this.env.model.off("update", this));
  }
}

describe("split to columns sidePanel component", () => {
  let model: Model;
  let fixture: HTMLElement;
  let dispatch: jest.SpyInstance;
  let confirmButton: HTMLButtonElement;
  let checkBox: HTMLInputElement;
  let onCloseSidePanel: jest.Mock;

  beforeEach(async () => {
    onCloseSidePanel = jest.fn();
    ({ model, fixture } = await mountComponent(Parent, {
      props: { onCloseSidePanel: () => onCloseSidePanel() },
    }));
    dispatch = spyModelDispatch(model);
    await nextTick();
    confirmButton = fixture.querySelector(".o-split-to-cols-panel button")!;
    checkBox = fixture.querySelector('.o-split-to-cols-panel input[type="checkbox"]')!;
  });

  test("Separator values", () => {
    const separatorValues = fixture.querySelectorAll<HTMLOptionElement>(
      ".o-split-to-cols-panel select option"
    );
    const values = Array.from(separatorValues).map((option) => option.value);
    expect(values).toHaveLength(6);
    expect(values).toContain(" ");
    expect(values).toContain(",");
    expect(values).toContain(";");
    expect(values).toContain("\n");
    expect(values).toContain("custom");
    expect(values).toContain("auto");
  });

  test("Selected separator is dispatched on confirm", () => {
    setInputValueAndTrigger(".o-split-to-cols-panel select", ",", "change");
    click(confirmButton);
    expect(dispatch).toHaveBeenCalledWith("SPLIT_TEXT_INTO_COLUMNS", {
      separator: ",",
      addNewColumns: expect.any(Boolean),
    });

    setInputValueAndTrigger(".o-split-to-cols-panel select", ";", "change");
    click(confirmButton);
    expect(dispatch).toHaveBeenCalledWith("SPLIT_TEXT_INTO_COLUMNS", {
      separator: ";",
      addNewColumns: expect.any(Boolean),
    });
  });

  test("Custom separator", async () => {
    let input = fixture.querySelector('.o-split-to-cols-panel input[type="text"]')!;
    expect(input).toBeFalsy();
    setInputValueAndTrigger(".o-split-to-cols-panel select", "custom", "change");
    await nextTick();

    input = fixture.querySelector('.o-split-to-cols-panel input[type="text"]')!;
    expect(input).toBeTruthy();
    setInputValueAndTrigger(input, "customSeparator", "input");
    click(confirmButton);
    expect(dispatch).toHaveBeenCalledWith("SPLIT_TEXT_INTO_COLUMNS", {
      separator: "customSeparator",
      addNewColumns: expect.any(Boolean),
    });
  });

  test("Add new columns checkbox", async () => {
    setCheckboxValueAndTrigger(checkBox, true, "change");
    click(confirmButton);
    expect(dispatch).toHaveBeenCalledWith("SPLIT_TEXT_INTO_COLUMNS", {
      separator: expect.any(String),
      addNewColumns: true,
    });

    setCheckboxValueAndTrigger(checkBox, false, "change");
    click(confirmButton);
    expect(dispatch).toHaveBeenCalledWith("SPLIT_TEXT_INTO_COLUMNS", {
      separator: expect.any(String),
      addNewColumns: true,
    });
  });

  test("Multiple columns selected : confirm button disabled + error message", async () => {
    setSelection(model, ["A1:B3"]);
    await nextTick();

    expect(confirmButton.classList).toContain("o-disabled");
    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(1);
  });

  test("Empty custom separator : confirm button disabled but no error message", async () => {
    setInputValueAndTrigger(".o-split-to-cols-panel select", "custom", "change");
    await nextTick();

    expect(confirmButton.classList).toContain("o-disabled");
    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(0);
  });

  test("No separator in selection : confirm button disabled + error message", async () => {
    setSelection(model, ["A1"]);
    setCellContent(model, "A1", "hello");
    setInputValueAndTrigger(".o-split-to-cols-panel select", " ", "change");
    setCheckboxValueAndTrigger(checkBox, false, "change");
    await nextTick();

    expect(confirmButton.classList).toContain("o-disabled");
    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(1);
  });

  test("Warning if we will overwrite some content", async () => {
    setSelection(model, ["A1"]);
    setGrid(model, { A1: "hello there", B1: "content" });
    setInputValueAndTrigger(".o-split-to-cols-panel select", " ", "change");
    setCheckboxValueAndTrigger(checkBox, false, "change");
    await nextTick();

    expect(confirmButton.classList).not.toContain("o-disabled");
    expect(fixture.querySelectorAll(".o-sidepanel-warning")).toHaveLength(1);
  });

  test("Warning not displayed if there's an error", async () => {
    setSelection(model, ["A1:B1"]);
    setGrid(model, { A1: "hello there", B1: "content" });
    setInputValueAndTrigger(".o-split-to-cols-panel select", " ", "change");
    setCheckboxValueAndTrigger(checkBox, false, "change");
    await nextTick();

    expect(fixture.querySelectorAll(".o-sidepanel-warning")).toHaveLength(0);
    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(1);
  });

  test("Errors updated on separator selection change", async () => {
    setSelection(model, ["A1"]);
    setCellContent(model, "A1", "hello there");
    setInputValueAndTrigger(".o-split-to-cols-panel select", " ", "change");
    await nextTick();

    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(0);

    setInputValueAndTrigger(".o-split-to-cols-panel select", ";", "change");
    await nextTick();

    expect(fixture.querySelectorAll(".o-sidepanel-error")).toHaveLength(1);
  });

  test("Panel is closed if the user starts to edit a cell", async () => {
    model.dispatch("START_EDITION");
    await nextTick();
    expect(onCloseSidePanel).toHaveBeenCalled();
  });

  test("Panel is closed after a successful split", async () => {
    setSelection(model, ["A1"]);
    setCellContent(model, "A1", "hello there");
    click(confirmButton);
    await nextTick();
    expect(onCloseSidePanel).toHaveBeenCalled();
  });
});
