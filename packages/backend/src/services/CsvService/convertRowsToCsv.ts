import {
    DimensionType,
    formatItemValue,
    isField,
    Item,
} from '@lightdash/common';
import moment from 'moment';
import { parentPort, workerData } from 'worker_threads';

type Args = {
    rows: Record<string, any>[];
    onlyRaw: boolean;
    itemMap: Record<string, Item>;
    sortedFieldIds: string[];
};

function run() {
    const { rows, itemMap, sortedFieldIds, onlyRaw }: Args = workerData;

    if (parentPort)
        parentPort.postMessage(
            rows.map((row) =>
                sortedFieldIds.map((id: string) => {
                    const data = row[id];
                    const item = itemMap[id];

                    const itemIsField = isField(item);
                    if (itemIsField && item.type === DimensionType.TIMESTAMP) {
                        return moment(data).format('YYYY-MM-DD HH:mm:ss');
                    }
                    if (itemIsField && item.type === DimensionType.DATE) {
                        return moment(data).format('YYYY-MM-DD');
                    }
                    if (onlyRaw) return data;
                    return formatItemValue(item, data);
                }),
            ),
        );
}

run();