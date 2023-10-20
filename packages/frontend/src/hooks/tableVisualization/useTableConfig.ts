import {
    ApiQueryResults,
    ColumnProperties,
    ConditionalFormattingConfig,
    Explore,
    getItemLabel,
    getItemMap,
    isDimension,
    isField,
    isMetric,
    isTableCalculation,
    itemsInMetricQuery,
    PivotData,
    ResultRow,
    TableChart,
} from '@lightdash/common';
import { createWorkerFactory, useWorker } from '@shopify/react-web-worker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableColumn, TableHeader } from '../../components/common/Table/types';
import useHealth from '../health/useHealth';
import { isSummable } from '../useColumnTotals';
import getDataAndColumns from './getDataAndColumns';

const createWorker = createWorkerFactory(
    () => import('../pivotTable/pivotQueryResults'),
);

const useTableConfig = (
    tableChartConfig: TableChart | undefined,
    resultsData: ApiQueryResults | undefined,
    explore: Explore | undefined,
    columnOrder: string[],
    pivotDimensions: string[] | undefined,
) => {
    const { data: health, isLoading: isHealthLoading } = useHealth();

    const [showColumnCalculation, setShowColumnCalculation] = useState<boolean>(
        !!tableChartConfig?.showColumnCalculation,
    );

    const [showRowCalculation, setShowRowCalculation] = useState<boolean>(
        !!tableChartConfig?.showRowCalculation,
    );

    const [conditionalFormattings, setConditionalFormattings] = useState<
        ConditionalFormattingConfig[]
    >(tableChartConfig?.conditionalFormattings ?? []);

    const [showTableNames, setShowTableNames] = useState<boolean>(
        tableChartConfig?.showTableNames === undefined
            ? true
            : tableChartConfig.showTableNames,
    );
    const [showResultsTotal, setShowResultsTotal] = useState<boolean>(
        tableChartConfig?.showResultsTotal ?? false,
    );
    const [hideRowNumbers, setHideRowNumbers] = useState<boolean>(
        tableChartConfig?.hideRowNumbers === undefined
            ? false
            : tableChartConfig.hideRowNumbers,
    );

    const [metricsAsRows, setMetricsAsRows] = useState<boolean>(
        tableChartConfig?.metricsAsRows || false,
    );

    useEffect(() => {
        if (
            tableChartConfig?.showTableNames === undefined &&
            explore !== undefined
        ) {
            setShowTableNames(explore.joinedTables.length > 0);
        }
    }, [explore, tableChartConfig?.showTableNames]);

    const [columnProperties, setColumnProperties] = useState<
        Record<string, ColumnProperties>
    >(tableChartConfig?.columns === undefined ? {} : tableChartConfig?.columns);

    const selectedItemIds = useMemo(() => {
        return resultsData
            ? itemsInMetricQuery(resultsData.metricQuery)
            : undefined;
    }, [resultsData]);
    const itemsMap = useMemo(() => {
        if (!explore) return {};

        return getItemMap(
            explore,
            resultsData?.metricQuery.additionalMetrics,
            resultsData?.metricQuery.tableCalculations,
        );
    }, [explore, resultsData]);

    const getFieldLabelDefault = useCallback(
        (fieldId: string | null | undefined) => {
            if (!fieldId || !(fieldId in itemsMap)) return undefined;

            const item = itemsMap[fieldId];

            if (isField(item) && !showTableNames) {
                return item.label;
            } else {
                return getItemLabel(item);
            }
        },
        [itemsMap, showTableNames],
    );

    const getFieldLabelOverride = useCallback(
        (fieldId: string | null | undefined) => {
            return fieldId ? columnProperties[fieldId]?.name : undefined;
        },
        [columnProperties],
    );

    const getField = useCallback(
        (fieldId: string) => itemsMap[fieldId],
        [itemsMap],
    );

    const getFieldLabel = useCallback(
        (fieldId: string | null | undefined) => {
            return (
                getFieldLabelOverride(fieldId) || getFieldLabelDefault(fieldId)
            );
        },
        [getFieldLabelOverride, getFieldLabelDefault],
    );

    // This is controlled by the state in this component.
    // User configures the names and visibilty of these in the config panel
    const isColumnVisible = useCallback(
        (fieldId: string) => {
            // we should always show dimensions when pivoting
            // hiding a dimension randomly removes values from all metrics
            if (
                pivotDimensions &&
                pivotDimensions.length > 0 &&
                isDimension(getField(fieldId))
            ) {
                return true;
            }

            return columnProperties[fieldId]?.visible ?? true;
        },
        [pivotDimensions, getField, columnProperties],
    );
    const isColumnFrozen = useCallback(
        (fieldId: string) => columnProperties[fieldId]?.frozen === true,
        [columnProperties],
    );

    const canUsePivotTable =
        resultsData?.metricQuery &&
        resultsData.metricQuery.metrics.length > 0 &&
        resultsData.rows.length &&
        pivotDimensions &&
        pivotDimensions.length > 0;

    const { rows, columns, error } = useMemo<{
        rows: ResultRow[];
        columns: Array<TableColumn | TableHeader>;
        error?: string;
    }>(() => {
        if (!resultsData || !selectedItemIds) {
            return {
                rows: [],
                columns: [],
            };
        }

        if (pivotDimensions && pivotDimensions.length > 0) {
            return {
                rows: [],
                columns: [],
            };
        }

        return getDataAndColumns({
            itemsMap,
            selectedItemIds,
            resultsData,
            isColumnVisible,
            showTableNames,
            getFieldLabelOverride,
            isColumnFrozen,
            columnOrder,
        });
    }, [
        columnOrder,
        selectedItemIds,
        pivotDimensions,
        itemsMap,
        resultsData,
        isColumnVisible,
        showTableNames,
        isColumnFrozen,
        getFieldLabelOverride,
    ]);
    const worker = useWorker(createWorker);
    const [pivotTableData, setPivotTableData] = useState<{
        loading: boolean;
        data: PivotData | undefined;
        error: undefined | string;
    }>({
        loading: false,
        data: undefined,
        error: undefined,
    });

    useEffect(() => {
        if (isHealthLoading || !health) {
            setPivotTableData({
                loading: true,
                data: undefined,
                error: undefined,
            });
            return;
        }

        if (
            !pivotDimensions ||
            pivotDimensions.length === 0 ||
            !resultsData ||
            resultsData.rows.length === 0
        ) {
            setPivotTableData({
                loading: false,
                data: undefined,
                error: undefined,
            });
            return;
        }

        setPivotTableData({
            loading: true,
            data: undefined,
            error: undefined,
        });

        const hiddenMetricFieldIds = selectedItemIds?.filter((fieldId) => {
            const field = getField(fieldId);

            return (
                !isColumnVisible(fieldId) &&
                ((isField(field) && isMetric(field)) ||
                    isTableCalculation(field))
            );
        });

        const summableMetricFieldIds = selectedItemIds?.filter((fieldId) => {
            const field = getField(fieldId);

            if (isDimension(field)) {
                return false;
            }

            if (
                hiddenMetricFieldIds &&
                hiddenMetricFieldIds.includes(fieldId)
            ) {
                return false;
            }

            return isSummable(field);
        });

        worker
            .pivotQueryResults({
                pivotConfig: {
                    pivotDimensions,
                    metricsAsRows,
                    columnOrder,
                    hiddenMetricFieldIds,
                    summableMetricFieldIds,
                    columnTotals: tableChartConfig?.showColumnCalculation,
                    rowTotals: tableChartConfig?.showRowCalculation,
                },
                metricQuery: resultsData.metricQuery,
                rows: resultsData.rows,
                options: {
                    maxColumns: health.pivotTable.maxColumnLimit,
                },
            })
            .then((data) => {
                setPivotTableData({
                    loading: false,
                    data: data,
                    error: undefined,
                });
            })
            .catch((e) => {
                setPivotTableData({
                    loading: false,
                    data: undefined,
                    error: e.message,
                });
            });
    }, [
        resultsData,
        pivotDimensions,
        columnOrder,
        metricsAsRows,
        selectedItemIds,
        isColumnVisible,
        getField,
        tableChartConfig?.showColumnCalculation,
        tableChartConfig?.showRowCalculation,
        worker,
        health,
        isHealthLoading,
    ]);

    // Remove columnProperties from map if the column has been removed from results
    useEffect(() => {
        if (Object.keys(columnProperties).length > 0 && selectedItemIds) {
            const columnsRemoved = Object.keys(columnProperties).filter(
                (field) => !selectedItemIds.includes(field),
            );
            columnsRemoved.forEach((field) => delete columnProperties[field]);

            setColumnProperties(columnProperties);
        }
    }, [selectedItemIds, columnProperties]);

    const updateColumnProperty = useCallback(
        (field: string, properties: Partial<ColumnProperties>) => {
            const newProperties =
                field in columnProperties
                    ? { ...columnProperties[field], ...properties }
                    : {
                          ...properties,
                      };
            setColumnProperties({
                ...columnProperties,
                [field]: newProperties,
            });
        },
        [columnProperties],
    );

    const handleSetConditionalFormattings = useCallback(
        (configs: ConditionalFormattingConfig[]) => {
            setConditionalFormattings(configs);
        },
        [],
    );

    const validTableConfig: TableChart = useMemo(
        () => ({
            showColumnCalculation,
            showRowCalculation,
            showTableNames,
            showResultsTotal,
            columns: columnProperties,
            hideRowNumbers,
            conditionalFormattings,
            metricsAsRows,
        }),
        [
            showColumnCalculation,
            showRowCalculation,
            hideRowNumbers,
            showTableNames,
            showResultsTotal,
            columnProperties,
            conditionalFormattings,
            metricsAsRows,
        ],
    );

    return {
        selectedItemIds,
        columnOrder,
        validTableConfig,
        showColumnCalculation,
        setShowColumnCalculation,
        showRowCalculation,
        setShowRowCalculation,
        showTableNames,
        setShowTableNames,
        hideRowNumbers,
        setHideRowNumbers,
        showResultsTotal,
        setShowResultsTotal,
        columnProperties,
        setColumnProperties,
        updateColumnProperty,
        rows,
        error,
        columns,
        getFieldLabelOverride,
        getFieldLabelDefault,
        getFieldLabel,
        getField,
        isColumnVisible,
        isColumnFrozen,
        conditionalFormattings,
        onSetConditionalFormattings: handleSetConditionalFormattings,
        pivotTableData,
        metricsAsRows,
        setMetricsAsRows,
        canUsePivotTable,
    };
};

export default useTableConfig;
