import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import * as mappings from '../maps/table_names.json';
import * as whitelist from '../maps/whitelist.json';
@Injectable()
export class DatabaseService {
    private readonly logger = new Logger(DatabaseService.name);

    constructor(@Inject('DATABASE_POOL') private pool: Pool) {
    }

    preprocessQuery(queryText: string): string {
        let result = queryText
        const extendedNames = Object.keys(mappings);
        if (extendedNames.some(tableName => new RegExp(`\\b${tableName}\\b`, 'i').test(queryText))) {
            extendedNames.forEach(extendedName => result = result.replace(new RegExp(extendedName, 'gi'), mappings[extendedName]))
        }

        return result;
    }

    async executeQuery(queryText: string, values: any[] = [], allowedReports = []): Promise<any[]> {
        // pre processing query here
        let datasetTableNames = this.getDatasetTableNames(queryText);
        let executeQuery = true;

        if (datasetTableNames.length > 0) {
            let result = await this.getDatasetGrammar(allowedReports);
            for (let i = 0; i < datasetTableNames.length; i++) {
                let datasetTableName = datasetTableNames[i].toLowerCase();
                let datasetGrammar = result.find(rec => {
                    rec.tableName = typeof rec.tableName === 'string' ? rec.tableName.toLowerCase() : rec.tableName;
                    rec.tableNameExpanded = typeof rec.tableNameExpanded === 'string' ? rec.tableNameExpanded.toLowerCase() : rec.tableNameExpanded;

                    return rec.tableName === datasetTableName || rec.tableNameExpanded === datasetTableName;
                });

                if (!datasetGrammar || (datasetGrammar && datasetGrammar.program && allowedReports.indexOf(datasetGrammar.program) === -1)) {
                    executeQuery = false;
                    break;
                }
            }
        }

        if (executeQuery) {
            const preprocessedQuery = this.preprocessQuery(queryText);
            this.logger.debug(`Executing query: ${preprocessedQuery} (${values})`);
            return this.pool.query(preprocessedQuery, values).then((result: QueryResult) => {
                return result.rows;
            });
        }

        return [];
    }

    getDatasetGrammar(reports: string[]) {
        let query = `SELECT program, "tableName", "tableNameExpanded" FROM spec."DatasetGrammar" WHERE program IN('${reports.join("','")}')`;
        return this.pool.query(query).then((result: QueryResult) => {
            return result.rows;
        });
    }

    getDatasetTableNames(query: string) {
        const regexp = /(datasets\.)[a-zA-Z0-9_]+/g;
        const datasetTableNames = [...query.matchAll(regexp)];
        
        if (datasetTableNames.length > 0) {
            return datasetTableNames.map(tableName => {
                let extTableName = tableName[0].split(".");
                extTableName.splice(0, 1);
                return extTableName.join("");
            });
        }

        return [];
    }

    async executeWhiteListedQuery(queryText: string, values: any[]): Promise<any[]> {
        const queries = whitelist?.queries;
        if (!queries.includes(queryText)) {
            throw new NotFoundException('Query not found');
        }

        const preprocessedQuery = this.preprocessQuery(queryText);
        return this.pool.query(preprocessedQuery, values).then((result: QueryResult) => {
            return result.rows;
        });
    }
}