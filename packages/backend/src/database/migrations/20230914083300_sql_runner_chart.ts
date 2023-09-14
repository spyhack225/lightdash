import { Knex } from 'knex';

const primaryKeyAsGeneratedIdentity = (
    table: Knex.CreateTableBuilder,
    columnName: string,
): Knex.CreateTableBuilder => {
    table.specificType(
        columnName,
        `integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY`,
    );
    return table;
};

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('saved_queries', (t) => {
        t.text('type').notNullable().defaultTo('explorer');
    });

    await knex.schema.createTable(
        'saved_queries_version_sql_runner',
        (table) => {
            primaryKeyAsGeneratedIdentity(
                table,
                'saved_queries_version_sql_runner_id',
            );
            table.text('sql').notNullable();
            table.text('explore_name').notNullable();
            table.jsonb('explore').notNullable();
            table
                .integer('saved_queries_version_id')
                .notNullable()
                .references('saved_queries_version_id')
                .inTable('saved_queries_versions')
                .onDelete('CASCADE');
        },
    );
}

export async function down(knex: Knex): Promise<void> {
    // TODO: implement
}
