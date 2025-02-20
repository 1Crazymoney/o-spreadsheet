import { MAX_DELAY } from "../../helpers";
import { SpreadsheetChildEnv } from "../../types/env";
import { HeaderIndex } from "../../types/misc";
import { gridOverlayPosition } from "./dom_helpers";
type EventFn = (ev: MouseEvent) => void;

export function startDnd(
  onMouseMove: EventFn,
  onMouseUp: EventFn,
  onMouseDown: EventFn = () => {}
) {
  const _onMouseDown = (ev: MouseEvent) => {
    ev.preventDefault();
    onMouseDown(ev);
  };
  const _onMouseMove = (ev: MouseEvent) => {
    ev.preventDefault();
    onMouseMove(ev);
  };
  const _onMouseUp = (ev: MouseEvent) => {
    ev.preventDefault();
    onMouseUp(ev);

    window.removeEventListener("mousedown", _onMouseDown);
    window.removeEventListener("mouseup", _onMouseUp);
    window.removeEventListener("dragstart", _onDragStart);
    window.removeEventListener("mousemove", _onMouseMove);
    window.removeEventListener("wheel", _onMouseMove);
  };
  function _onDragStart(ev: DragEvent) {
    ev.preventDefault();
  }
  window.addEventListener("mousedown", _onMouseDown);
  window.addEventListener("mouseup", _onMouseUp);
  window.addEventListener("dragstart", _onDragStart);
  window.addEventListener("mousemove", _onMouseMove);
  // mouse wheel on window is by default a passive event.
  // preventDefault() is not allowed in passive event handler.
  // https://chromestatus.com/feature/6662647093133312
  window.addEventListener("wheel", _onMouseMove, { passive: false });
}

/**
 * Function to be used during a mousedown event, this function allows to
 * perform actions related to the mousemove and mouseup events and adjusts the viewport
 * when the new position related to the mousemove event is outside of it.
 * Among inputs are two callback functions. First intended for actions performed during
 * the mousemove event, it receives as parameters the current position of the mousemove
 * (occurrence of the current column and the current row). Second intended for actions
 * performed during the mouseup event.
 */
export function dragAndDropBeyondTheViewport(
  env: SpreadsheetChildEnv,
  cbMouseMove: (col: HeaderIndex, row: HeaderIndex, ev: MouseEvent) => void,
  cbMouseUp: () => void,
  only: "horizontal" | "vertical" | false = false
) {
  let timeOutId: any = null;
  let currentEv: MouseEvent;
  let previousEv: MouseEvent;
  let startingEv: MouseEvent;
  let startingX: number;
  let startingY: number;
  const getters = env.model.getters;
  const sheetId = getters.getActiveSheetId();
  const position = gridOverlayPosition();
  let colIndex: number;
  let rowIndex: number;
  const onMouseDown = (ev: MouseEvent) => {
    previousEv = ev;
    startingEv = ev;
    startingX = startingEv.clientX - position.left;
    startingY = startingEv.clientY - position.top;
  };
  const onMouseMove = (ev: MouseEvent) => {
    currentEv = ev;
    if (timeOutId) {
      return;
    }

    const { x: offsetCorrectionX, y: offsetCorrectionY } = getters.getMainViewportCoordinates();
    let { top, left, bottom, right } = getters.getActiveMainViewport();
    let { scrollX, scrollY } = getters.getActiveSheetDOMScrollInfo();
    const { xSplit, ySplit } = getters.getPaneDivisions(sheetId);
    let canEdgeScroll = false;
    let timeoutDelay = MAX_DELAY;

    const x = currentEv.clientX - position.left;
    colIndex = getters.getColIndex(x);

    if (only !== "vertical") {
      const previousX = previousEv.clientX - position.left;
      const edgeScrollInfoX = getters.getEdgeScrollCol(x, previousX, startingX);
      if (edgeScrollInfoX.canEdgeScroll) {
        canEdgeScroll = true;
        timeoutDelay = Math.min(timeoutDelay, edgeScrollInfoX.delay);
        let newTarget: number;
        switch (edgeScrollInfoX.direction) {
          case "reset":
            colIndex = xSplit;
            newTarget = xSplit;
            break;
          case 1:
            colIndex = right;
            newTarget = left + 1;
            break;
          case -1:
            colIndex = left - 1;
            while (env.model.getters.isColHidden(sheetId, colIndex)) {
              colIndex--;
            }
            newTarget = colIndex;
            break;
        }
        scrollX = getters.getColDimensions(sheetId, newTarget!).start - offsetCorrectionX;
      }
    }

    const y = currentEv.clientY - position.top;
    rowIndex = getters.getRowIndex(y);

    if (only !== "horizontal") {
      const previousY = previousEv.clientY - position.top;
      const edgeScrollInfoY = getters.getEdgeScrollRow(y, previousY, startingY);
      if (edgeScrollInfoY.canEdgeScroll) {
        canEdgeScroll = true;
        timeoutDelay = Math.min(timeoutDelay, edgeScrollInfoY.delay);
        let newTarget: number;
        switch (edgeScrollInfoY.direction) {
          case "reset":
            rowIndex = ySplit;
            newTarget = ySplit;
            break;
          case 1:
            rowIndex = bottom;
            newTarget = top + edgeScrollInfoY.direction;
            break;
          case -1:
            rowIndex = top - 1;
            while (env.model.getters.isRowHidden(sheetId, rowIndex)) {
              rowIndex--;
            }
            newTarget = rowIndex;
            break;
        }
        scrollY = env.model.getters.getRowDimensions(sheetId, newTarget!).start - offsetCorrectionY;
      }
    }

    if (!canEdgeScroll) {
      if (rowIndex === -1) {
        rowIndex = y < 0 ? 0 : getters.getNumberRows(sheetId) - 1;
      }
      if (colIndex === -1 && x < 0) {
        colIndex = x < 0 ? 0 : getters.getNumberCols(sheetId) - 1;
      }
    }

    cbMouseMove(colIndex, rowIndex, currentEv);
    if (canEdgeScroll) {
      env.model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: scrollX, offsetY: scrollY });
      timeOutId = setTimeout(() => {
        timeOutId = null;
        onMouseMove(currentEv);
      }, Math.round(timeoutDelay));
    }
    previousEv = currentEv;
  };

  const onMouseUp = () => {
    clearTimeout(timeOutId);
    cbMouseUp();
  };

  startDnd(onMouseMove, onMouseUp, onMouseDown);
}
