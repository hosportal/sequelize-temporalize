"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const temporalizeDefaultOptions = {
    // runs the insert within the sequelize hook chain, disable
    // for increased performance
    blocking: true,
    modelSuffix: 'History',
    indexSuffix: '_history',
    allowTransactions: true,
    logTransactionId: true,
    logEventId: true,
    eventIdColumnName: 'eventId'
};
function Temporalize({ model, modelHistory, sequelize, temporalizeOptions }) {
    temporalizeOptions = lodash_1.default.extend({}, temporalizeDefaultOptions, temporalizeOptions);
    if (temporalizeOptions.logTransactionId &&
        !temporalizeOptions.allowTransactions) {
        throw new Error('If temporalizeOptions.logTransactionId===true, temporalizeOptions.allowTransactions must also be true');
    }
    const Sequelize = sequelize.Sequelize;
    const Op = Sequelize.Op;
    const historyName = model.name + temporalizeOptions.modelSuffix;
    const transactionIdAttr = temporalizeOptions.logTransactionId
        ? {
            type: Sequelize.STRING,
            allowNull: true
        }
        : undefined;
    const eventIdAttr = temporalizeOptions.logEventId
        ? {
            type: Sequelize.STRING,
            allowNull: true
        }
        : undefined;
    const historyOwnAttrs = {
        hid: {
            type: Sequelize.DataTypes.UUID,
            defaultValue: Sequelize.DataTypes.UUIDV4,
            primaryKey: true,
            // autoIncrement: true,
            unique: true
        },
        archivedAt: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        deletion: {
            type: Sequelize.BOOLEAN,
            allowNull: true
        },
        transactionId: transactionIdAttr,
        [temporalizeOptions.eventIdColumnName]: eventIdAttr
    };
    const excludedAttributes = [
        'Model',
        'unique',
        'primaryKey',
        'autoIncrement',
        'set',
        'get',
        '_modelAttribute',
        'references',
        'onDelete',
        'onUpdate'
    ];
    const historyAttributes = lodash_1.default(model.rawAttributes)
        .mapValues(function (v) {
        v = lodash_1.default.omit(v, excludedAttributes);
        // remove the "NOW" defaultValue for the default timestamps
        // we want to save them, but just a copy from our master record
        if (v.fieldName == 'createdAt' || v.fieldName == 'updatedAt') {
            v.type = Sequelize.DATE;
        }
        return v;
    })
        .assign(historyOwnAttrs)
        .value();
    // If the order matters, use this:
    //historyAttributes = _.assign({}, historyOwnAttrs, historyAttributes);
    const historyOwnOptions = {
        timestamps: false
    };
    const excludedNames = [
        'name',
        'tableName',
        'sequelize',
        'uniqueKeys',
        'hasPrimaryKey',
        'hooks',
        'scopes',
        'instanceMethods',
        'defaultScope'
    ];
    const modelOptions = lodash_1.default.omit(model.options, excludedNames);
    const historyOptions = lodash_1.default.assign({}, modelOptions, historyOwnOptions);
    // We want to delete indexes that have unique constraint
    const indexes = lodash_1.default.cloneDeep(historyOptions.indexes);
    if (Array.isArray(indexes)) {
        historyOptions.indexes = indexes.filter(function (index) {
            return !index.unique && index.type != 'UNIQUE';
        });
    }
    historyOptions.indexes.forEach(indexElement => {
        if (indexElement.name.length + temporalizeOptions.indexSuffix.length >=
            63) {
            console.log('index name ' +
                indexElement.name +
                ' is very long and hence it was shortened before adding the suffix ' +
                temporalizeOptions.indexSuffix);
            indexElement.name =
                indexElement.name.substring(0, indexElement.name.length - temporalizeOptions.indexSuffix.length) + temporalizeOptions.indexSuffix;
        }
        else {
            indexElement.name += temporalizeOptions.indexSuffix;
        }
    });
    let modelHistoryOutput;
    if (modelHistory) {
        const historyClassOptions = Object.assign(Object.assign({}, historyOptions), { sequelize, tableName: historyName });
        modelHistory.init(historyAttributes, historyClassOptions);
        modelHistoryOutput = modelHistory;
    }
    else {
        modelHistoryOutput = sequelize.define(historyName, historyAttributes, historyOptions);
    }
    modelHistoryOutput.originModel = model;
    function transformToHistoryEntry(instance, options, { destroyOperation, restoreOperation }) {
        const dataValues = lodash_1.default.cloneDeep(instance.dataValues);
        dataValues.archivedAt = instance.dataValues.updatedAt || Date.now(); // Date.now() if options.timestamps = false
        if (restoreOperation) {
            dataValues.archivedAt = Date.now(); // There may be a better time to use, but we are yet to find it
        }
        if (destroyOperation) {
            // If paranoid is true, use the deleted value
            dataValues.archivedAt = instance.dataValues.deletedAt || Date.now();
            dataValues.deletion = true;
        }
        if (temporalizeOptions.logTransactionId && options.transaction) {
            dataValues.transactionId = getTransactionId(options.transaction);
        }
        if (temporalizeOptions.logEventId && options.eventId) {
            dataValues[temporalizeOptions.eventIdColumnName] = options.eventId;
        }
        return dataValues;
    }
    function createHistoryEntry(instance, options, { destroyOperation, restoreOperation }) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataValues = transformToHistoryEntry(instance, options, {
                destroyOperation,
                restoreOperation
            });
            const historyRecordPromise = modelHistoryOutput.create(dataValues, {
                transaction: temporalizeOptions.allowTransactions
                    ? options.transaction
                    : null
            });
            if (temporalizeOptions.blocking) {
                return historyRecordPromise;
            }
        });
    }
    function createHistoryEntryBulk(instances, options, { destroyOperation, restoreOperation }) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataValuesArr = instances.map(instance => {
                return transformToHistoryEntry(instance, options, {
                    destroyOperation,
                    restoreOperation
                });
            });
            const historyRecordPromise = modelHistoryOutput.bulkCreate(dataValuesArr, {
                transaction: temporalizeOptions.allowTransactions
                    ? options.transaction
                    : null
            });
            if (temporalizeOptions.blocking) {
                return historyRecordPromise;
            }
        });
    }
    function storeBulkPrimaryKeys(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const instances = yield model.findAll({
                attributes: model.primaryKeyAttributes,
                where: options.where,
                transaction: options.transaction,
                paranoid: options.paranoid
            });
            options._sequelizeTemporalizeIdStore = instances.map(i => i[model.primaryKeyAttributes[0]]);
        });
    }
    const afterCreateHook = function (obj, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return model
                .findOne({
                where: { id: obj.id },
                transaction: options.transaction,
                paranoid: false
            })
                .then(function (instance) {
                return createHistoryEntry(instance, options, {});
            });
        });
    };
    const afterBulkCreateHook = function (instances, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!options.individualHooks) {
                return createHistoryEntryBulk(instances, options, {});
            }
        });
    };
    const afterUpdateHook = (instance, options) => __awaiter(this, void 0, void 0, function* () {
        return createHistoryEntry(instance, options, {});
    });
    const beforeBulkUpdateHook = (options) => __awaiter(this, void 0, void 0, function* () {
        if (!options.individualHooks) {
            yield storeBulkPrimaryKeys(options);
        }
    });
    const afterBulkUpdateHook = (options) => __awaiter(this, void 0, void 0, function* () {
        if (!options.individualHooks) {
            const primaryKeyValues = options._sequelizeTemporalizeIdStore;
            const instances = yield model.findAll({
                where: {
                    [model.primaryKeyAttributes[0]]: { [Op.in]: primaryKeyValues }
                },
                transaction: options.transaction,
                paranoid: options.paranoid
            });
            return createHistoryEntryBulk(instances, options, {});
        }
    });
    const afterDestroyHook = (instance, options) => __awaiter(this, void 0, void 0, function* () {
        return createHistoryEntry(instance, options, { destroyOperation: true });
    });
    const beforeBulkDestroyHook = (options) => __awaiter(this, void 0, void 0, function* () {
        if (!options.individualHooks) {
            const instances = yield model.findAll({
                where: options.where,
                transaction: options.transaction,
                paranoid: false
            });
            return createHistoryEntryBulk(instances, options, {
                destroyOperation: true
            }); // Set date is implied by options.paranoid === false
        }
    });
    const afterBulkDestroyHook = (options) => __awaiter(this, void 0, void 0, function* () { });
    const afterRestoreHook = (instance, options) => __awaiter(this, void 0, void 0, function* () {
        return createHistoryEntry(instance, options, { restoreOperation: true });
    });
    const beforeBulkRestoreHook = (options) => __awaiter(this, void 0, void 0, function* () {
        throw new Error('beforeBulkRestoreHook not working');
        if (!options.individualHooks) {
            yield storeBulkPrimaryKeys(options);
        }
    });
    const afterBulkRestoreHook = (options) => __awaiter(this, void 0, void 0, function* () {
        options.restoreOperation = true;
        if (!options.individualHooks) {
            yield model
                .findAll({
                where: options.where,
                transaction: options.transaction,
                paranoid: false
            })
                .then(function (instances) {
                return createHistoryEntryBulk(instances, options, {
                    restoreOperation: true
                });
            });
        }
    });
    model.addHook('afterCreate', afterCreateHook);
    model.addHook('afterBulkCreate', afterBulkCreateHook);
    model.addHook('afterUpdate', afterUpdateHook);
    model.addHook('beforeBulkUpdate', beforeBulkUpdateHook);
    model.addHook('afterBulkUpdate', afterBulkUpdateHook);
    model.addHook('afterDestroy', afterDestroyHook);
    model.addHook('beforeBulkDestroy', beforeBulkDestroyHook);
    model.addHook('afterBulkDestroy', afterBulkDestroyHook);
    model.addHook('afterRestore', afterRestoreHook);
    model.addHook('beforeBulkRestore', beforeBulkRestoreHook);
    model.addHook('afterBulkRestore', afterBulkRestoreHook);
    const readOnlyHook = function () {
        throw new Error("This is a read-only history database. You aren't allowed to modify it.");
    };
    modelHistoryOutput.addHook('beforeUpdate', readOnlyHook);
    modelHistoryOutput.addHook('beforeDestroy', readOnlyHook);
    const beforeSync = function () { };
    modelHistoryOutput.addHook('beforeSync', 'HistoricalSyncHook', beforeSync);
    return modelHistoryOutput;
}
exports.Temporalize = Temporalize;
function getTransactionId(transaction) {
    function getId() {
        return this.id;
    }
    const boundGetId = getId.bind(transaction);
    return boundGetId();
}
exports.getTransactionId = getTransactionId;
