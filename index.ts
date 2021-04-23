import _ from 'lodash';

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

export function Temporalize({
  model,
  modelHistory,
  sequelize,
  temporalizeOptions
}: {
  model;
  modelHistory?;
  sequelize;
  temporalizeOptions;
}) {
  temporalizeOptions = _.extend(
    {},
    temporalizeDefaultOptions,
    temporalizeOptions
  );

  if (
    temporalizeOptions.logTransactionId &&
    !temporalizeOptions.allowTransactions
  ) {
    throw new Error(
      'If temporalizeOptions.logTransactionId===true, temporalizeOptions.allowTransactions must also be true'
    );
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
  const historyAttributes = _(model.rawAttributes)
    .mapValues(function(v) {
      v = _.omit(v, excludedAttributes);
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
  const modelOptions = _.omit(model.options, excludedNames);
  const historyOptions: any = _.assign({}, modelOptions, historyOwnOptions);

  // We want to delete indexes that have unique constraint
  const indexes = _.cloneDeep(historyOptions.indexes);
  if (Array.isArray(indexes)) {
    historyOptions.indexes = indexes.filter(function(index) {
      return !index.unique && index.type != 'UNIQUE';
    });
  }
  historyOptions.indexes.forEach(indexElement => {
    if (
      indexElement.name.length + temporalizeOptions.indexSuffix.length >=
      63
    ) {
      console.log(
        'index name ' +
          indexElement.name +
          ' is very long and hence it was shortened before adding the suffix ' +
          temporalizeOptions.indexSuffix
      );
      indexElement.name =
        indexElement.name.substring(
          0,
          indexElement.name.length - temporalizeOptions.indexSuffix.length
        ) + temporalizeOptions.indexSuffix;
    } else {
      indexElement.name += temporalizeOptions.indexSuffix;
    }
  });

  let modelHistoryOutput;
  if (modelHistory) {
    const historyClassOptions = {
      ...historyOptions,
      sequelize,
      tableName: historyName
    };
    modelHistory.init(historyAttributes, historyClassOptions);
    modelHistoryOutput = modelHistory;
  } else {
    modelHistoryOutput = sequelize.define(
      historyName,
      historyAttributes,
      historyOptions
    );
  }
  modelHistoryOutput.originModel = model;

  function transformToHistoryEntry(
    instance,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
    const dataValues = _.cloneDeep(instance.dataValues);
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

  async function createHistoryEntry(
    instance,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
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
  }

  async function createHistoryEntryBulk(
    instances,
    options,
    {
      destroyOperation,
      restoreOperation
    }: { destroyOperation?: Boolean; restoreOperation?: Boolean }
  ) {
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
  }

  async function storeBulkPrimaryKeys(options) {
    const instances = await model.findAll({
      attributes: model.primaryKeyAttributes,
      where: options.where,
      transaction: options.transaction,
      paranoid: options.paranoid
    });
    options._sequelizeTemporalizeIdStore = instances.map(
      i => i[model.primaryKeyAttributes[0]]
    );
  }

  const afterCreateHook = async function(obj, options) {
    return model
      .findOne({
        where: { id: obj.id },
        transaction: options.transaction,
        paranoid: false
      })
      .then(function(instance) {
        return createHistoryEntry(instance, options, {});
      });
  };

  const afterBulkCreateHook = async function(instances, options) {
    if (!options.individualHooks) {
      return createHistoryEntryBulk(instances, options, {});
    }
  };

  const afterUpdateHook = async (instance, options) => {
    return createHistoryEntry(instance, options, {});
  };

  const beforeBulkUpdateHook = async options => {
    if (!options.individualHooks) {
      await storeBulkPrimaryKeys(options);
    }
  };

  const afterBulkUpdateHook = async options => {
    if (!options.individualHooks) {
      const primaryKeyValues = options._sequelizeTemporalizeIdStore;
      const instances = await model.findAll({
        where: {
          [model.primaryKeyAttributes[0]]: { [Op.in]: primaryKeyValues }
        },
        transaction: options.transaction,
        paranoid: options.paranoid
      });
      return createHistoryEntryBulk(instances, options, {});
    }
  };

  const afterDestroyHook = async (instance, options) => {
    return createHistoryEntry(instance, options, { destroyOperation: true });
  };

  const beforeBulkDestroyHook = async options => {
    if (!options.individualHooks) {
      const instances = await model.findAll({
        where: options.where,
        transaction: options.transaction,
        paranoid: false
      });
      return createHistoryEntryBulk(instances, options, {
        destroyOperation: true
      }); // Set date is implied by options.paranoid === false
    }
  };

  const afterBulkDestroyHook = async options => {};

  const afterRestoreHook = async (instance, options) => {
    return createHistoryEntry(instance, options, { restoreOperation: true });
  };

  const beforeBulkRestoreHook = async options => {
    throw new Error('beforeBulkRestoreHook not working');
    if (!options.individualHooks) {
      await storeBulkPrimaryKeys(options);
    }
  };

  const afterBulkRestoreHook = async options => {
    options.restoreOperation = true;
    if (!options.individualHooks) {
      await model
        .findAll({
          where: options.where,
          transaction: options.transaction,
          paranoid: false
        })
        .then(function(instances) {
          return createHistoryEntryBulk(instances, options, {
            restoreOperation: true
          });
        });
    }
  };

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

  const readOnlyHook = function() {
    throw new Error(
      "This is a read-only history database. You aren't allowed to modify it."
    );
  };

  modelHistoryOutput.addHook('beforeUpdate', readOnlyHook);
  modelHistoryOutput.addHook('beforeDestroy', readOnlyHook);

  const beforeSync = function() {};

  modelHistoryOutput.addHook('beforeSync', 'HistoricalSyncHook', beforeSync);

  return modelHistoryOutput;
}

export function getTransactionId(transaction) {
  function getId() {
    return this.id;
  }
  const boundGetId = getId.bind(transaction);
  return boundGetId();
}
