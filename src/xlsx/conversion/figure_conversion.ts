import {
  getCanonicalSheetName,
  isDefined,
  splitReference,
  toUnboundedZone,
  zoneToXc,
} from "../../helpers";
import { ChartDefinition, ExcelChartDefinition, FigureData } from "../../types";
import { XLSXFigure, XLSXWorksheet } from "../../types/xlsx";
import { convertEMUToDotValue, getColPosition, getRowPosition } from "../helpers/content_helpers";
import { convertColor } from "./color_conversion";

export function convertFigures(sheetData: XLSXWorksheet): FigureData<any>[] {
  let id = 1;
  return sheetData.figures
    .map((figure) => convertFigure(figure, (id++).toString(), sheetData))
    .filter(isDefined);
}

function convertFigure(
  figure: XLSXFigure,
  id: string,
  sheetData: XLSXWorksheet
): FigureData<any> | undefined {
  const x1 =
    getColPosition(figure.anchors[0].col, sheetData) +
    convertEMUToDotValue(figure.anchors[0].colOffset);
  const x2 =
    getColPosition(figure.anchors[1].col, sheetData) +
    convertEMUToDotValue(figure.anchors[1].colOffset);

  const y1 =
    getRowPosition(figure.anchors[0].row, sheetData) +
    convertEMUToDotValue(figure.anchors[0].rowOffset);
  const y2 =
    getRowPosition(figure.anchors[1].row, sheetData) +
    convertEMUToDotValue(figure.anchors[1].rowOffset);

  const width = x2 - x1;
  const height = y2 - y1;

  const chartData = convertChartData(figure.data);
  if (!chartData) return undefined;
  return {
    id: id,
    x: x1,
    y: y1,
    width: width,
    height: height,
    tag: "chart",
    data: convertChartData(figure.data),
  };
}

function convertChartData(chartData: ExcelChartDefinition): ChartDefinition | undefined {
  const dataSetsHaveTitle = chartData.dataSets[0].label !== undefined;
  const labelRange = chartData.labelRange
    ? convertExcelRangeToSheetXC(chartData.labelRange, dataSetsHaveTitle)
    : undefined;
  let dataSets = chartData.dataSets.map((data) =>
    convertExcelRangeToSheetXC(data.range, dataSetsHaveTitle)
  );
  // For doughnut charts, in chartJS first dataset = outer dataset, in excel first dataset = inner dataset
  if (chartData.type === "pie") {
    dataSets.reverse();
  }
  return {
    dataSets,
    dataSetsHaveTitle,
    labelRange,
    title: chartData.title || "",
    type: chartData.type,
    background: convertColor({ rgb: chartData.backgroundColor }) || "#FFFFFF",
    verticalAxisPosition: chartData.verticalAxisPosition,
    legendPosition: chartData.legendPosition,
    stacked: chartData.stacked || false,
    aggregated: false,
    labelsAsText: false,
  };
}

function convertExcelRangeToSheetXC(range: string, dataSetsHaveTitle: boolean): string {
  let { sheetName, xc } = splitReference(range);
  if (sheetName) {
    sheetName = getCanonicalSheetName(sheetName) + "!";
  } else {
    sheetName = "";
  }
  let zone = toUnboundedZone(xc);
  if (dataSetsHaveTitle && zone.bottom !== undefined && zone.right !== undefined) {
    const height = zone.bottom - zone.top + 1;
    const width = zone.right - zone.left + 1;
    if (height === 1) {
      zone = { ...zone, left: zone.left - 1 };
    } else if (width === 1) {
      zone = { ...zone, top: zone.top - 1 };
    }
  }
  const dataXC = zoneToXc(zone);
  return sheetName + dataXC;
}
