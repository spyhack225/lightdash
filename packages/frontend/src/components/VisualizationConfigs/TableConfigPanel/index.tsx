import { Colors, Tab, Tabs } from '@blueprintjs/core';
import { Box, Button, Popover } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import React from 'react';
import {
    COLLAPSABLE_CARD_BUTTON_PROPS,
    COLLAPSABLE_CARD_POPOVER_PROPS,
} from '../../common/CollapsableCard';
import MantineIcon from '../../common/MantineIcon';
import { useVisualizationContext } from '../../LightdashVisualization/VisualizationProvider';
import ConditionalFormattingList from './ConditionalFormattingList';
import GeneralSettings from './GeneralSettings';

const TableConfigPanel: React.FC = () => {
    const { resultsData } = useVisualizationContext();
    const disabled = !resultsData;

    return (
        <Popover {...COLLAPSABLE_CARD_POPOVER_PROPS} disabled={disabled}>
            <Popover.Target>
                <Button
                    {...COLLAPSABLE_CARD_BUTTON_PROPS}
                    disabled={disabled}
                    rightIcon={
                        <MantineIcon icon={IconChevronDown} color="gray" />
                    }
                >
                    Configure
                </Button>
            </Popover.Target>

            <Popover.Dropdown>
                <Box
                    w={320}
                    p={0}
                    sx={{
                        // FIXME: remove after Blueprint migration is complete
                        'label.bp4-label': {
                            display: 'inline-flex',
                            gap: '0.214em',
                            color: Colors.DARK_GRAY1,
                            fontWeight: 600,
                        },
                    }}
                >
                    <Tabs>
                        <Tab
                            id="general"
                            title="General"
                            panel={<GeneralSettings />}
                        />
                        <Tab
                            id="conditional-formatting"
                            title="Conditional formatting"
                            panel={<ConditionalFormattingList />}
                        />
                    </Tabs>
                </Box>
            </Popover.Dropdown>
        </Popover>
    );
};

export default TableConfigPanel;
