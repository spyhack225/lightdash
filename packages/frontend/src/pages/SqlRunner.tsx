import { subject } from '@casl/ability';
import {
    ApiQueryResults,
    ChartType,
    CompiledDimension,
    CompiledMetric,
    CompiledTable,
    DimensionType,
    Explore,
    fieldId,
    FieldType,
    getCustomLabelsFromTableConfig,
    getFields,
    getItemId,
    isDimension,
    isMetric,
    MetricType,
    NotFoundError,
} from '@lightdash/common';
import {
    ActionIcon,
    Alert,
    Box,
    Button,
    Group,
    Select,
    Stack,
    Tabs,
    TextInput,
} from '@mantine/core';
import { getHotkeyHandler } from '@mantine/hooks';
import { IconAlertCircle, IconRefresh, IconTrash } from '@tabler/icons-react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMount } from 'react-use';

import { useForm } from '@mantine/form';
import { downloadCsvFromSqlRunner } from '../api/csv';
import { ChartDownloadMenu } from '../components/ChartDownload';
import { BigButton } from '../components/common/BigButton';
import CollapsableCard from '../components/common/CollapsableCard';
import MantineIcon from '../components/common/MantineIcon';
import Page from '../components/common/Page/Page';
import PageBreadcrumbs from '../components/common/PageBreadcrumbs';
import ShareShortLinkButton from '../components/common/ShareShortLinkButton';
import SideBarLoadingState from '../components/common/SideBarLoadingState';
import CatalogTree from '../components/common/SqlRunner/CatalogTree';
import DownloadSqlCsvButton from '../components/DownloadSqlCsvButton';
import VisualizationConfigPanel from '../components/Explorer/VisualizationCard/VisualizationConfigPanel';
import VisualizationCardOptions from '../components/Explorer/VisualizationCardOptions';
import ForbiddenPanel from '../components/ForbiddenPanel';
import LightdashVisualization from '../components/LightdashVisualization';
import VisualizationProvider from '../components/LightdashVisualization/VisualizationProvider';
import RefreshDbtButton from '../components/RefreshDbtButton';
import RunSqlQueryButton from '../components/SqlRunner/RunSqlQueryButton';
import SqlRunnerInput from '../components/SqlRunner/SqlRunnerInput';
import SqlRunnerResultsTable from '../components/SqlRunner/SqlRunnerResultsTable';
import { useProjectCatalog } from '../hooks/useProjectCatalog';
import {
    ProjectCatalogTreeNode,
    useProjectCatalogTree,
} from '../hooks/useProjectCatalogTree';
import { useCreateMutation } from '../hooks/useSavedQuery';
import { useSqlQueryMutation } from '../hooks/useSqlQuery';
import useSqlQueryVisualization from '../hooks/useSqlQueryVisualization';
import {
    useSqlRunnerRoute,
    useSqlRunnerUrlState,
} from '../hooks/useSqlRunnerRoute';
import { useApp } from '../providers/AppProvider';
import { TrackSection } from '../providers/TrackingProvider';
import { SectionName } from '../types/Events';

const generateBasicSqlQuery = (table: string) =>
    `SELECT *
     FROM ${table}
     LIMIT 25`;

enum SqlRunnerCards {
    CHART = 'CHART',
    SQL = 'SQL',
    EXPLORE = 'EXPLORE',
    RESULTS = 'RESULTS',
}

const ExploreEditor: FC<{
    explore: Explore;
    generatedExplore: Explore;
    onChange: (explore: Explore) => void;
}> = ({ explore, generatedExplore, onChange }) => {
    const fields = getFields(explore);
    const form = useForm({
        initialValues: { fields },
    });
    return (
        <Box mx="sm">
            <form
                onSubmit={form.onSubmit((values) => {
                    const newTable: CompiledTable = {
                        ...explore.tables[explore.baseTable],
                        dimensions: values.fields
                            .filter(isDimension)
                            .reduce<Record<string, CompiledDimension>>(
                                (acc, cur) => {
                                    const newDimension: CompiledDimension = {
                                        fieldType: FieldType.DIMENSION,
                                        type: cur.type as DimensionType,
                                        name: cur.name,
                                        label: cur.label,
                                        table: explore.baseTable,
                                        tableLabel:
                                            explore.tables[explore.baseTable]
                                                .label,
                                        sql: '',
                                        hidden: false,
                                        compiledSql: '',
                                        tablesReferences: [],
                                    };
                                    return {
                                        ...acc,
                                        [getItemId(cur)]: newDimension,
                                    };
                                },
                                {},
                            ),
                        metrics: values.fields
                            .filter(isMetric)
                            .reduce<Record<string, CompiledMetric>>(
                                (acc, cur) => {
                                    const newMetric: CompiledMetric = {
                                        fieldType: FieldType.METRIC,
                                        type: cur.type as MetricType,
                                        name: cur.name,
                                        label: cur.label,
                                        table: explore.baseTable,
                                        tableLabel:
                                            explore.tables[explore.baseTable]
                                                .label,
                                        sql: '',
                                        hidden: false,
                                        compiledSql: '',
                                        tablesReferences: [],
                                        isAutoGenerated: false,
                                    };
                                    return {
                                        ...acc,
                                        [getItemId(cur)]: newMetric,
                                    };
                                },
                                {},
                            ),
                    };
                    onChange({
                        ...explore,
                        tables: { [explore.baseTable]: newTable },
                    });
                })}
            >
                {form.values.fields.map((item, index) => (
                    <Group key={item.name} mt="xs">
                        <TextInput
                            disabled
                            label={index === 0 ? 'Column' : undefined}
                            placeholder="Column name"
                            withAsterisk
                            sx={{ flex: 1 }}
                            {...form.getInputProps(`fields.${index}.name`)}
                        />
                        <TextInput
                            label={index === 0 ? 'Label' : undefined}
                            placeholder="Label"
                            withAsterisk
                            sx={{ flex: 1 }}
                            {...form.getInputProps(`fields.${index}.label`)}
                        />
                        <Select
                            label={index === 0 ? 'Field type' : undefined}
                            data={[
                                {
                                    value: FieldType.DIMENSION,
                                    label: 'Dimension',
                                },
                                { value: FieldType.METRIC, label: 'Metric' },
                            ]}
                            {...form.getInputProps(`fields.${index}.fieldType`)}
                        />
                        <Select
                            label={index === 0 ? 'Value type' : undefined}
                            data={
                                form.values.fields[index].fieldType ===
                                FieldType.DIMENSION
                                    ? [
                                          {
                                              value: DimensionType.STRING,
                                              label: 'String',
                                          },
                                          {
                                              value: DimensionType.NUMBER,
                                              label: 'Number',
                                          },
                                      ]
                                    : [
                                          {
                                              value: MetricType.STRING,
                                              label: 'String',
                                          },
                                          {
                                              value: MetricType.NUMBER,
                                              label: 'Number',
                                          },
                                      ]
                            }
                            {...form.getInputProps(`fields.${index}.type`)}
                        />
                        <ActionIcon
                            color="red"
                            onClick={() => form.removeListItem('fields', index)}
                        >
                            <IconTrash size="1rem" />
                        </ActionIcon>
                    </Group>
                ))}
                <Group position="left" mt="md">
                    <Button
                        onClick={() => {
                            const newEmptyDimension: CompiledDimension = {
                                fieldType: FieldType.DIMENSION,
                                type: DimensionType.STRING,
                                name: '',
                                label: '',
                                table: explore.baseTable,
                                tableLabel:
                                    explore.tables[explore.baseTable].label,
                                sql: '',
                                hidden: false,
                                compiledSql: '',
                                tablesReferences: [],
                            };
                            form.insertListItem('fields', newEmptyDimension);
                        }}
                    >
                        Add field
                    </Button>
                </Group>
                <Group position="right" mt="md">
                    <Button
                        variant="default"
                        size="xs"
                        leftIcon={
                            <MantineIcon icon={IconRefresh} color="gray" />
                        }
                        onClick={() =>
                            form.setValues({
                                fields: getFields(generatedExplore),
                            })
                        }
                    >
                        Regenerate explore
                    </Button>
                    <Button type="submit">Submit</Button>
                </Group>
            </form>
        </Box>
    );
};

const SqlRunnerPage = () => {
    const { user } = useApp();
    const { projectUuid } = useParams<{ projectUuid: string }>();
    const initialState = useSqlRunnerUrlState();
    const sqlQueryMutation = useSqlQueryMutation();
    const { isLoading: isCatalogLoading, data: catalogData } =
        useProjectCatalog();

    const [sql, setSql] = useState<string>(initialState?.sqlRunner?.sql || '');
    const [lastSqlRan, setLastSqlRan] = useState<string>();

    const [expandedCards, setExpandedCards] = useState(
        new Map([
            [SqlRunnerCards.CHART, false],
            [SqlRunnerCards.SQL, true],
            [SqlRunnerCards.RESULTS, true],
        ]),
    );

    const handleCardExpand = (card: SqlRunnerCards, value: boolean) => {
        setExpandedCards((prev) => new Map(prev).set(card, value));
    };

    const { isLoading, mutate } = sqlQueryMutation;
    const {
        initialChartConfig,
        initialPivotDimensions,
        explore: generatedExplore,
        chartType,
        resultsData: generatedResultsData,
        columnOrder,
        createSavedChart,
        setChartType,
        setChartConfig,
        setPivotFields,
    } = useSqlQueryVisualization({
        initialState: initialState?.createSavedChart,
        sqlQueryMutation,
    });

    const [explore, setExplore] = useState<Explore>();

    const fieldsMap = useMemo(() => {
        return [...getFields(explore || generatedExplore)].reduce(
            (sum, field) => ({
                ...sum,
                [fieldId(field)]: field,
            }),
            {},
        );
    }, [explore, generatedExplore]);

    const resultsData: ApiQueryResults | undefined = useMemo(
        () =>
            generatedResultsData
                ? {
                      ...generatedResultsData,
                      metricQuery: {
                          dimensions: Object.keys(
                              (explore || generatedExplore).tables[
                                  explore?.baseTable ||
                                      generatedExplore.baseTable
                              ].dimensions,
                          ),
                          metrics: Object.keys(
                              (explore || generatedExplore).tables[
                                  explore?.baseTable ||
                                      generatedExplore.baseTable
                              ].metrics,
                          ),
                          filters: {},
                          sorts: [],
                          limit: 0,
                          tableCalculations: [],
                      },
                  }
                : undefined,
        [generatedResultsData, explore, generatedExplore],
    );

    const { mutate: createChartMutate, isLoading: isSaving } =
        useCreateMutation();

    const saveChart = useCallback(() => {
        if (createSavedChart) {
            createChartMutate({
                name: 'Chart from SQL Runner',
                description: 'Chart from SQL Runner',
                type: 'sql_runner',
                sql,
                explore: explore || generatedExplore,
                ...createSavedChart,
            });
        }
    }, [createChartMutate, createSavedChart, sql, explore, generatedExplore]);

    const sqlRunnerState = useMemo(
        () => ({
            createSavedChart,
            sqlRunner: lastSqlRan ? { sql: lastSqlRan } : undefined,
        }),
        [createSavedChart, lastSqlRan],
    );

    useSqlRunnerRoute(sqlRunnerState);

    const handleSubmit = useCallback(() => {
        if (!sql) return;

        mutate(sql);
        setLastSqlRan(sql);
    }, [mutate, sql]);

    useMount(() => {
        handleSubmit();
    });

    useEffect(() => {
        const handler = getHotkeyHandler([['mod+Enter', handleSubmit]]);
        document.body.addEventListener('keydown', handler);
        return () => document.body.removeEventListener('keydown', handler);
    }, [handleSubmit]);

    const catalogTree = useProjectCatalogTree(catalogData);

    const handleTableSelect = useCallback(
        (node: ProjectCatalogTreeNode) => {
            if (!node.sqlTable) return;

            const query = generateBasicSqlQuery(node.sqlTable);

            setSql(query);
            handleCardExpand(SqlRunnerCards.SQL, true);
        },
        [setSql],
    );

    const cannotManageSqlRunner = user.data?.ability?.cannot(
        'manage',
        subject('SqlRunner', {
            organizationUuid: user.data?.organizationUuid,
            projectUuid,
        }),
    );
    const cannotViewProject = user.data?.ability?.cannot('view', 'Project');
    if (cannotManageSqlRunner || cannotViewProject) {
        return <ForbiddenPanel />;
    }

    const getCsvLink = async () => {
        if (sql) {
            const customLabels = getCustomLabelsFromTableConfig(
                createSavedChart?.chartConfig.config,
            );
            const customLabelsWithoutTablePrefix = customLabels
                ? Object.fromEntries<string>(
                      Object.entries(customLabels).map(([key, value]) => [
                          key.replace(/^sql_runner_/, ''),
                          value,
                      ]),
                  )
                : undefined;
            const csvResponse = await downloadCsvFromSqlRunner({
                projectUuid,
                sql,
                customLabels: customLabelsWithoutTablePrefix,
            });
            return csvResponse.url;
        }
        throw new NotFoundError('no SQL query defined');
    };

    return (
        <Page
            title="SQL Runner"
            withSidebarFooter
            withFullHeight
            withPaddedContent
            sidebar={
                <Stack
                    spacing="xl"
                    mah="100%"
                    sx={{ overflowY: 'hidden', flex: 1 }}
                >
                    <PageBreadcrumbs
                        items={[{ title: 'SQL Runner', active: true }]}
                    />

                    <Tabs
                        defaultValue="warehouse-schema"
                        display="flex"
                        sx={{
                            overflowY: 'hidden',
                            flexGrow: 1,
                            flexDirection: 'column',
                        }}
                    >
                        <Tabs.Panel
                            value="warehouse-schema"
                            display="flex"
                            sx={{ overflowY: 'hidden', flex: 1 }}
                        >
                            {isCatalogLoading ? (
                                <SideBarLoadingState />
                            ) : (
                                <Stack sx={{ overflowY: 'auto', flex: 1 }}>
                                    <Box>
                                        <CatalogTree
                                            nodes={catalogTree}
                                            onSelect={handleTableSelect}
                                        />
                                    </Box>

                                    <Alert
                                        icon={<IconAlertCircle />}
                                        title="Tables missing?"
                                        color="blue"
                                        sx={{ flexShrink: 0 }}
                                    >
                                        Currently we only display tables that
                                        are declared in the dbt project.
                                    </Alert>
                                </Stack>
                            )}
                        </Tabs.Panel>
                    </Tabs>
                </Stack>
            }
        >
            <TrackSection name={SectionName.EXPLORER_TOP_BUTTONS}>
                <Group position="apart">
                    <RefreshDbtButton />

                    <div>
                        <RunSqlQueryButton
                            onSubmit={handleSubmit}
                            isLoading={isLoading}
                        />
                        <BigButton
                            icon="saved"
                            style={{ width: 150 }}
                            onClick={saveChart}
                            loading={isSaving}
                        >
                            Save
                        </BigButton>
                        <ShareShortLinkButton
                            disabled={lastSqlRan === undefined}
                        />
                    </div>
                </Group>
            </TrackSection>

            <Stack mt="lg" spacing="sm" sx={{ flexGrow: 1 }}>
                <VisualizationProvider
                    initialChartConfig={initialChartConfig}
                    chartType={chartType}
                    initialPivotDimensions={initialPivotDimensions}
                    resultsData={resultsData}
                    isLoading={isLoading}
                    onChartConfigChange={setChartConfig}
                    onChartTypeChange={setChartType}
                    onPivotDimensionsChange={setPivotFields}
                    columnOrder={columnOrder}
                    explore={explore || generatedExplore}
                    isSqlRunner={true}
                >
                    <CollapsableCard
                        title="Charts"
                        rightHeaderElement={
                            expandedCards.get(SqlRunnerCards.CHART) && (
                                <>
                                    <VisualizationCardOptions />
                                    <VisualizationConfigPanel
                                        chartType={chartType}
                                    />
                                    {chartType === ChartType.TABLE && (
                                        <DownloadSqlCsvButton
                                            getCsvLink={getCsvLink}
                                            disabled={!sql}
                                        />
                                    )}
                                    <ChartDownloadMenu
                                        projectUuid={projectUuid}
                                    />
                                </>
                            )
                        }
                        isOpen={expandedCards.get(SqlRunnerCards.CHART)}
                        shouldExpand
                        onToggle={(value) =>
                            handleCardExpand(SqlRunnerCards.CHART, value)
                        }
                    >
                        <LightdashVisualization className="sentry-block fs-block cohere-block" />
                    </CollapsableCard>
                </VisualizationProvider>
                <CollapsableCard
                    title="Explore"
                    isOpen={expandedCards.get(SqlRunnerCards.EXPLORE)}
                    onToggle={(value) =>
                        handleCardExpand(SqlRunnerCards.EXPLORE, value)
                    }
                >
                    <ExploreEditor
                        explore={explore || generatedExplore}
                        generatedExplore={generatedExplore}
                        onChange={setExplore}
                    />
                </CollapsableCard>
                <CollapsableCard
                    title="SQL"
                    isOpen={expandedCards.get(SqlRunnerCards.SQL)}
                    onToggle={(value) =>
                        handleCardExpand(SqlRunnerCards.SQL, value)
                    }
                >
                    <SqlRunnerInput
                        sql={sql}
                        onChange={setSql}
                        projectCatalog={catalogData}
                        isDisabled={isLoading}
                    />
                </CollapsableCard>

                <CollapsableCard
                    title="Results"
                    isOpen={expandedCards.get(SqlRunnerCards.RESULTS)}
                    onToggle={(value) =>
                        handleCardExpand(SqlRunnerCards.RESULTS, value)
                    }
                >
                    <SqlRunnerResultsTable
                        onSubmit={handleSubmit}
                        resultsData={resultsData}
                        fieldsMap={fieldsMap}
                        sqlQueryMutation={sqlQueryMutation}
                    />
                </CollapsableCard>
            </Stack>
        </Page>
    );
};
export default SqlRunnerPage;
