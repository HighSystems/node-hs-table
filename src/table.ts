'use strict';

/* Dependencies */
import merge from 'deepmerge';
import RFC4122 from 'rfc4122';
import {
	HighSystems,
	HighSystemsOptions,
	HighSystemsRequest,
	HighSystemsRequestGetRecords,
} from '@highsystems/client';
import { HSField, HSFieldJSON } from '@highsystems/field';
import { HSFids, HSRecord, HSRecordData, replaceUndefinedWithString } from '@highsystems/record';

/* Globals */
const VERSION = require('../package.json').version;
const IS_BROWSER = typeof(window) !== 'undefined';
const rfc4122 = new RFC4122();

/* Main Class */
export class HSTable<
	RecordData extends HSRecordData = HSRecordData,
	// CustomGetSet extends Object = Record<any, any>
> {

	public readonly CLASS_NAME = 'HSTable';
	static readonly CLASS_NAME = 'HSTable';

	/**
	 * The loaded library version
	 */
	static readonly VERSION: string = VERSION;

	/**
	 * The default settings of a `HighSystems` instance
	 */
	static defaults: HSTableOptions = {
		highsystems: {
			instance: IS_BROWSER ? window.location.host.split('.')[0] : ''
		},

		applicationId: '',
		tableId: '',
		fids: {
			recordid: 'id'
		}
	};

	/**
	 * An internal id (guid) used for tracking/managing object instances
	 */
	public id: string;

	private _hs: HighSystems;
	private _applicationId: string = '';
	private _tableId: string = '';
	private _fids: Record<any, string> = {};
	private _fields: HSField[] = [];
	private _records: HSRecord<RecordData>[] = [];
	private _data: Record<any, any> = {};

	constructor(options?: Partial<HSTableOptions<RecordData>>){
		this.id = rfc4122.v4();

		const {
			highsystems,
			...classOptions
		} = options || {};

		const settings = merge(HSTable.defaults, classOptions);

		this.setAppId(settings.applicationId)
			.setTableId(settings.tableId)
			.setFids(settings.fids as Record<any, string>);

		if(HighSystems.IsHighSystems(highsystems)){
			this._hs = highsystems;
		}else{
			this._hs = new HighSystems(merge.all([
				HSTable.defaults.highsystems,
				highsystems || {},
				{
					tempTokenDbid: this.getTableId()
				}
			]));
		}

		return this;
	}

	clear(): this {
		this._fields = [];
		this._records = [];
		// this._reports = [];
		this._data = {};

		return this;
	}

	async delete({ requestOptions }: HighSystemsRequest = {}) {
		const results = await this._hs.deleteTable({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			requestOptions
		});

		this.setTableId('');
		this.clear();

		return results;
	}

	async deleteRecord({ record, requestOptions }: { record: HSRecord<RecordData> } & HighSystemsRequest) {
		let i = -1;

		this.getRecords().some((r, o) => {
			if(record.id === r.id || (record.get('recordid') && record.get('recordid') === r.get('recordid'))){
				i = o;

				return true;
			}

			return false;
		});

		let results = true;

		if(i !== -1){
			this._records.splice(i, 1);
		}

		if(record.get('recordid')){
			try {
				await record.delete({
					requestOptions
				});
			}catch(err){
				this._records.push(record);

				throw err;
			}
		}

		return results;
	}

	async deleteRecords({
		individually = false,
		records,
		requestOptions
	}: {
		individually?: boolean;
		records?: HSRecord<RecordData>[];
	} & HighSystemsRequest = {}) {
		const results = {
			numberDeleted: 0
		};

		if(individually){
			if(records === undefined){
				records = this.getRecords();
			}

			for(const record of records){
				await this.deleteRecord({
					record,
					requestOptions
				});

				++results.numberDeleted;
			}
		}else{
			throw new Error('Not implemented yet');
			// if(records === undefined){
			// 	records = this._records.splice(0, this._records.length);
			// }

			// const batches: HSRecord<RecordData>[][] = records.reduce((batches: HSRecord<RecordData>[][], record: HSRecord<RecordData>) => {
			// 	if(record.get('recordid') <= 0){
			// 		return batches;
			// 	}

			// 	if(batches[batches.length - 1].length === 100){
			// 		batches.push([]);
			// 	}

			// 	batches[batches.length - 1].push(record);

			// 	return batches;
			// }, [ [] ]);

			// for(let i = 0; i < batches.length; ++i){
			// 	const result = await this._hs.deleteRecords({
			// 		tableId: this.getTableId(),
			// 		where: batches[i].map((record) => {
			// 			return `{'${this.getFid('recordid')}'.EX.'${record.get('recordid')}'}`;
			// 		}).join('AND'),
			// 		requestOptions
			// 	});

			// 	results.numberDeleted += result.numberDeleted;
			// }
		}

		return results;
	}

	get(attribute: any): any {
		if(attribute === 'id' || attribute === 'tableId'){
			return this.getTableId();
		}else
		if(attribute === 'appId' || attribute === 'applicationId'){
			return this.getApplicationId();
		}

		return this._data[attribute];
	}

	getApplicationId(): string {
		return this._applicationId;
	}

	getFid<T extends keyof RecordData>(field: T): string;
	getFid(field: string, byId?: false | undefined): string;
	getFid(field: string, byId: true): string;
	getFid(field: string, byId: boolean = false): string {
		const fids = this.getFids();
		let id: string = '';

		if(byId !== true){
			if(fids.hasOwnProperty(field)){
				id = fids[field];
			}
		}else{
			id = '';
			field = field;

			Object.keys(fids).some((name) => {
				if(fids[name] === field){
					id = name;

					return true;
				}

				return false;
			});
		}

		return id;
	}

	getFids() {
		return this._fids as HSFids<RecordData>;
	}

	getField(id: string, returnIndex: true): number | undefined;
	getField(id: string, returnIndex?: false): HSField | undefined;
	getField(id: string, returnIndex: boolean = false): number | HSField | undefined {
		const fields = this.getFields();

		let result = undefined;

		for(let i = 0; result === undefined && i < fields.length; ++i){
			if(fields[i].getFid() === id){
				result = returnIndex ? i : fields[i];
			}
		}

		return result;
	}

	getFields(): HSField[] {
		return this._fields;
	}

	getNRecords(): number {
		return this._records.length;
	}

	getRecord<T extends keyof RecordData>(value: RecordData[T], fieldName: T, returnIndex: true): number;
	getRecord<T extends keyof RecordData>(value: RecordData[T], fieldName: T, returnIndex?: false): HSRecord<RecordData> | undefined;
	getRecord(value: any, fieldName: string, returnIndex: true): number;
	getRecord(value: any, fieldName?: string, returnIndex?: false | undefined): HSRecord<RecordData> | undefined;
	getRecord(value: any, fieldName: string = 'recordid', returnIndex: boolean = false): HSRecord<RecordData> | number | undefined {
		const records = this.getRecords();
		let i = -1;

		records.some((record, o) => {
			if(record.get(fieldName) !== value){
				return false;
			}

			i = o;

			return true;
		});

		if(returnIndex){
			return i;
		}else
		if(i === -1){
			return undefined;
		}

		return records[i];
	}

	getRecords(): HSRecord<RecordData>[] {
		return this._records;
	}

	getTableId(): string {
		return this._tableId;
	}

	async loadField({ field, requestOptions }: HighSystemsRequest & { field: string | HSField }): Promise<HSField> {
		if(!HSField.IsHSField(field)){
			field = this.getField(field) || field;

			if(!HSField.IsHSField(field)){
				field = new HSField({
					highsystems: this._hs,
					applicationId: this.getApplicationId(),
					tableId: this.getTableId(),
					fid: field
				});

				this._fields.push(field);
			}
		}

		await field.load({
			requestOptions
		});

		return field;
	}

	async loadFields({ requestOptions }: HighSystemsRequest = {}): Promise<HSField[]> {
		const results = await this._hs.getFields({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			requestOptions
		});

		// @ts-expect-error
		results.forEach((field) => {
			let result = this.getField(field.id);

			if(!result){
				result = new HSField({
					highsystems: this._hs,
					applicationId: this.getApplicationId(),
					tableId: this.getTableId(),
					fid: field.id
				});

				this._fields.push(result);
			}

			Object.entries(field).forEach(([ attribute, value ]) => {
				result!.set(attribute, value);
			});
		});

		return this.getFields();
	}

	async loadSchema({ requestOptions }: HighSystemsRequest = {}) {
		const results = await Promise.all([
			this.loadFields({ requestOptions }),
			this.loadTable({ requestOptions })
		]);

		return {
			...results[1],
			fields: results[0]
		};
	}

	async loadTable({ requestOptions }: HighSystemsRequest = {}) {
		const results = await this._hs.getTable({
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			requestOptions
		});

		(Object.entries(results) as [ string, any ][]).forEach(([ attribute, value ]) => {
			this.set(attribute, value);
		});

		return this._data;
	}

	async loadRecords({ fids, query, requestOptions, ...rest }: Partial<Omit<HighSystemsRequestGetRecords, 'columns'> & {
		fids: (keyof RecordData)[]
	}> = {}) {
		const fidIds = this.getFids();

		if(!fids){
			fids = Object.keys(fidIds);
		}

		const results = await this._hs.getRecords({
			...rest,
			appid: this.getApplicationId(),
			tableid: this.getTableId(),
			query,
			columns: fids.map((name) => {
				return fidIds[name];
			}).filter(filterUnique).join('.'),
			requestOptions,
			returnAxios: false
		});

		const fields = this.getFields();

		// @ts-expect-error
		this._records = results.map((record) => {
			const hsRecord = new HSRecord<RecordData>({
				highsystems: this._hs,
				applicationId: this.getApplicationId(),
				tableId: this.getTableId(),
				fids: this.getFids()
			});

			hsRecord.setFields(fields);

			fids!.forEach((name) => {
				const fid = fidIds[name];

				hsRecord.set((name || fid), record[fid]);
			});

			return hsRecord;
		});

		return this.getRecords();
	}

	async saveFields({ attributesToSave, requestOptions }: { attributesToSave?: string[] } & HighSystemsRequest = {}): Promise<HSField[]> {
		const fields = this.getFields();

		for(let i = 0; i < fields.length; ++i){
			await fields[i].save({
				attributesToSave,
				requestOptions
			});
		}

		return fields;
	}

	async saveRecords({ individually, fidsToSave, recordsToSave, requestOptions }: { individually?:  boolean, fidsToSave?: (keyof RecordData | string)[], recordsToSave?: HSRecord<RecordData>[] } & HighSystemsRequest = {}): Promise<HSRecord<RecordData>[]> {
		const records = recordsToSave === undefined ? this.getRecords() : recordsToSave;

		if(individually){
			for(let i = 0; i < records.length; ++i){
				await records[i].save({
					fidsToSave,
					requestOptions
				});
			}
		}else{
			const fids = this.getFids();
			const names = Object.keys(fids);
			const selectedNames = names.filter((name) => {
				const fid = fids[name];
				const filtered = !fidsToSave || fidsToSave.indexOf(fid) !== -1 || fidsToSave.indexOf(name) !== -1 || fid === 'id';

				if(!filtered){
					return false;
				}

				const field = this.getField(fid);

				if(field && [
					'lookup',
					'summary',
					'formula'
				].indexOf(field.get('mode') || '') !== -1){
					return false;
				}

				return true;
			});
			const inputRecords = records.sort((a, b) => {
				const aVal = a.get('recordid');
				const bVal = b.get('recordid');

				if(aVal === bVal){
					return 0;
				}else
				if(aVal === undefined && bVal !== undefined){
					return -1;
				}else
				if(aVal !== undefined && bVal === undefined){
					return 1;
				}

				return aVal > bVal ? 1 : -1;
			});

			const results = await this._hs.upsertRecords({
				appid: this.getApplicationId(),
				tableid: this.getTableId(),
				data: inputRecords.map((hsRecord) => {
					return selectedNames.reduce((record, name) => {
						const fid = fids[name];

						if(fid){
							record[fid] = replaceUndefinedWithString(hsRecord.get(name));
						}

						return record;

					}, {} as Record<string, any>);
				}),
				requestOptions
			});

			for(let inputI = 0; inputI < inputRecords.length; ++inputI){
				const record = inputRecords[inputI];
				const recordid = results[inputI];

				// @ts-expect-error
				record.set('id', recordid);
			}
		}

		return records;
	}

	async saveTable({ attributesToSave, requestOptions }: { attributesToSave?: string[] } & HighSystemsRequest = {}) {
		const tableId = this.getTableId();
		const data = Object.keys(this._data).filter((attribute) => {
			return !attributesToSave || attributesToSave.indexOf(attribute) === -1;
		}).reduce((results: any, attribute) => {
			results[attribute] = this._data[attribute];

			return results;
		}, {
			relatedApplication: this.getApplicationId(),
			requestOptions
		});

		let results;

		if(tableId){
			data.tableid = tableId;

			results = await this._hs.putTable(data);
		}else{
			results = await this._hs.postTable(data);
		}

		(Object.entries(results) as [ string, any ][]).forEach(([ attribute, value ]) => {
			this.set(attribute, value);
		});

		return this._data;
	}

	set(attribute: any, value: any): this {
		if(attribute === 'id' || attribute === 'tableId'){
			return this.setTableId(value);
		}else
		if(attribute === 'appid' || attribute === 'applicationId'){
			return this.setAppId(value);
		}

		this._data[attribute] = value;

		return this;
	}

	setAppId(appId: string): this {
		this._applicationId = appId;

		return this;
	}

	setFid<T extends keyof RecordData>(name: T, id: string): this;
	setFid(name: string, id: string): this;
	setFid(name: string, id: string): this {
		this._fids[name] = id;

		return this;
	}

	setFids(fields: Record<any, string>): this {
		Object.entries(fields).forEach(([ name, fid ]) => {
			this.setFid(name, fid);
		});

		return this;
	}

	setTableId(tableId: string): this {
		this._tableId = tableId;
		this._data.id = tableId;

		return this;
	}

	async upsertField(options: HSField | Partial<HSFieldJSON['data']>, autoSave: boolean = false): Promise<HSField> {
		let field: HSField | undefined;

		if(HSField.IsHSField(options)){
			if(options.get('recordid')){
				field = this.getField(options.get('fid'));
			}else
			if(options.get('primaryKey')){
				field = this.getField(options.get('fid'));
			}else{
				field = options;
			}
		}else
		if(options !== undefined){
			if(options.fid){
				field = this.getField(options.fid);
			}else
			if(options.id){
				field = this.getField(options.id);
			}
		}

		if(!field){
			field = new HSField({
				highsystems: this._hs,
				applicationId: this.getApplicationId(),
				tableId: this.getTableId(),
				fid: ''
			});

			if(options && !HSField.IsHSField(options) && options.fid){
				field.setFid(options.fid);
			}

			this._fields.push(field);
		}

		if(options && !HSField.IsHSField(options)){
			Object.entries(options).forEach(([ attribute, value ]) => {
				field!.set(attribute, value);
			});
		}

		if(autoSave){
			await field.save();
		}

		return field;
	}

	async upsertFields(fields: (Partial<HSFieldJSON> | HSField)[], autoSave: boolean = false): Promise<HSField[]>{
		const results = [];

		for(let i = 0; i < fields.length; ++i){
			results.push(await this.upsertField(fields[i], autoSave));
		}

		return results;
	}

	async upsertRecord(options?: HSRecord<RecordData> | Partial<RecordData>, autoSave: boolean = false): Promise<HSRecord<RecordData>> {
		let record: HSRecord<RecordData> | undefined;

		if(HSRecord.IsHSRecord<RecordData>(options)){
			if(options.get('recordid')){
				record = this.getRecord(options.get('recordid'), 'recordid');
			}else{
				record = options;
			}
		}else
		if(options !== undefined){
			if(options.recordid){
				record = this.getRecord(options.recordid, 'recordid');
			}
		}

		if(!record){
			record = new HSRecord<RecordData>({
				highsystems: this._hs,
				applicationId: this.getApplicationId(),
				tableId: this.getTableId(),
				fids: this.getFids()
			});

			this._records.push(record);
		}

		record.setFields(this.getFields());

		if(options && !HSRecord.IsHSRecord<RecordData>(options)){
			const addDefaults = !record.get('recordid');

			Object.entries(options).forEach(([ fidName, fidValue ]) => {
				let value;

				if(addDefaults){
					const fid = this.getFid(fidName);
					const field = this.getField(fid);

					if(field){
						value = field.get('properties')?.defaultValue;
					}

					if(fidValue !== undefined){
						value = fidValue;
					}
				}else{
					value = fidValue;
				}

				record!.set(fidName, value);
			});
		}

		if(autoSave){
			await record.save();
		}

		return record;
	}

	async upsertRecords(records: (HSRecord<RecordData> | Partial<RecordData>)[], autoSave: boolean = false): Promise<HSRecord<RecordData>[]>{
		const results = [];

		for(let i = 0; i < records.length; ++i){
			results.push(await this.upsertRecord(records[i], autoSave));
		}

		return results;
	}

	/**
	 * Test if a variable is a `hs-record` object
	 *
	 * @param obj A variable you'd like to test
	 */
	static IsHSTable<T extends HSRecordData = HSRecordData>(obj: any): obj is HSTable<T> {
		return ((obj || {}) as HSTable).CLASS_NAME === HSTable.CLASS_NAME;
	}

	static NewRecord<T extends HSRecordData>(table: HSTable<T>, data?: Partial<T>){
		return HSRecord.NewRecord<T>({
			highsystems: table._hs,
			tableId: table.getTableId(),
			fids: table.getFids()
		}, data);
	}

	static ToCSV<T extends HSRecordData>(table: HSTable<T>, columns: (keyof T)[], data?: HSRecord<T>[]): string {
		return (data || table.getRecords()).map((record) => {
			return columns.map((field) => {
				const value = record.get(field);

				switch(typeof(value)){
					case 'number':
						return value;
					case 'boolean':
						return `"${value ? 'yes' : 'no'}"`;
					case 'object':
						return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
					default:
						return `"${value.replace(/"/g, '""')}"`;
				}
			}).join(',');
		}).join('\n');
	}

}

/* Helpers */
const filterUnique = (val: any, i: number, arr: any[]) => {
	return arr.indexOf(val) === i;
};

/* Interfaces */
export type HSTableOptions<RecordData extends HSRecordData = {}> = {
	highsystems: HighSystemsOptions | HighSystems;
	applicationId: string;
	tableId: string;
	fids: Partial<HSFids<RecordData>>;
}

/* Export to Browser */
if(IS_BROWSER){
	window.HSTable = exports;
}

