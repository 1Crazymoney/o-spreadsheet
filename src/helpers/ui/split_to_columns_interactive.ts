import { CommandResult } from "../..";
import { _lt } from "../../translation";
import { SpreadsheetChildEnv } from "../../types";
import { DispatchResult } from "./../../types/commands";

export const SplitToColumnsInteractiveContent = {
  SplitIsDestructive: _lt("This will overwrite data in the subsequent columns. Split anyway?"),
};

export function interactiveSplitToColumns(
  env: SpreadsheetChildEnv,
  separator: string,
  addNewColumns: boolean
): DispatchResult {
  let result = env.model.dispatch("SPLIT_TEXT_INTO_COLUMNS", { separator, addNewColumns });
  if (result.isCancelledBecause(CommandResult.SplitWillOverwriteContent)) {
    env.askConfirmation(SplitToColumnsInteractiveContent.SplitIsDestructive, () => {
      result = env.model.dispatch("SPLIT_TEXT_INTO_COLUMNS", {
        separator,
        addNewColumns,
        force: true,
      });
    });
  }
  return result;
}
