import { Temporalize } from '../index';
import { Sequelize, DataTypes } from 'sequelize';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
chai.use(chaiAsPromised);
const assert = chai.assert;

// TODO: future tests
// Test paranoid: true and paranoid: false
// Test timestamps: true and timestamps: false
// Test logEventId and logTransactionId

interface DbOptions {
  options?: { paranoid?: boolean; timestamps?: boolean };
  temporalizeOptions?;
}

describe('Test sequelize-temporalize', function() {
  let sequelize;

  function newDB({ options, temporalizeOptions }: DbOptions = {}) {
    // Set defaults
    options = options || {};
    options.paranoid = options.paranoid || false;

    if (sequelize) {
      sequelize.close();
      sequelize = null;
    }

    const dbFile = __dirname + '/.test.sqlite';

    try {
      fs.unlinkSync(dbFile);
    } catch {}

    sequelize = new Sequelize('', '', '', {
      dialect: 'sqlite',
      storage: dbFile,
      logging: false //console.log
    });

    // Define origin models
    const User = sequelize.define('User', { name: DataTypes.TEXT }, options);
    const Creation = sequelize.define(
      'Creation',
      {
        name: DataTypes.TEXT,
        user: DataTypes.INTEGER,
        user2: DataTypes.INTEGER
      },
      options
    );
    const Tag = sequelize.define('Tag', { name: DataTypes.TEXT }, options);
    const Event = sequelize.define(
      'Event',
      {
        name: DataTypes.TEXT,
        creation: DataTypes.INTEGER
      },
      options
    );
    const CreationTag = sequelize.define(
      'CreationTag',
      {
        creation: DataTypes.INTEGER,
        tag: DataTypes.INTEGER
      },
      options
    );

    //Associate models

    //1.* with 2 association to same table
    User.hasMany(Creation, {
      foreignKey: 'user',
      as: 'creatorCreations'
    });
    User.hasMany(Creation, {
      foreignKey: 'user2',
      as: 'updaterCreations'
    });

    Creation.belongsTo(User, {
      foreignKey: 'user',
      as: 'createUser'
    });
    Creation.belongsTo(User, {
      foreignKey: 'user2',
      as: 'updateUser'
    });

    //1.1
    Event.belongsTo(Creation, {
      foreignKey: 'creation'
    });
    Creation.hasOne(Event, {
      foreignKey: 'creation'
    });

    //*.*
    Tag.belongsToMany(Creation, {
      through: CreationTag,
      foreignKey: 'tag',
      otherKey: 'creation'
    });
    Creation.belongsToMany(Tag, {
      through: CreationTag,
      foreignKey: 'creation',
      otherKey: 'tag'
    });

    // Temporalize
    Temporalize({
      model: User,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Creation,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Tag,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: Event,
      sequelize,
      temporalizeOptions
    });
    Temporalize({
      model: CreationTag,
      sequelize,
      temporalizeOptions
    });

    return sequelize.sync({ force: true });
  }

  // Adding 3 tags, 2 creations, 2 events, 2 user
  // each creation has 3 tags
  // user has 2 creations
  // creation has 1 event
  // tags,creations,user,events are renamed 3 times to generate 3 history data
  // 1 tag is removed and re-added to a creation to create 1 history entry in the CreationTags table
  async function dataCreate() {
    const tag1 = await sequelize.models.Tag.create({ name: 'tag01' }).then(
      t => {
        t.name = 'tag01 renamed';
        t.save();
        t.name = 'tag01 renamed twice';
        t.save();
        t.name = 'tag01 renamed three times';
        t.save();
        return t;
      }
    );

    const tag2 = await sequelize.models.Tag.create({ name: 'tag02' }).then(
      t => {
        t.name = 'tag02 renamed';
        t.save();
        t.name = 'tag02 renamed twice';
        t.save();
        t.name = 'tag02 renamed three times';
        t.save();
        return t;
      }
    );

    const tag3 = await sequelize.models.Tag.create({ name: 'tag03' }).then(
      t => {
        t.name = 'tag03 renamed';
        t.save();
        t.name = 'tag03 renamed twice';
        t.save();
        t.name = 'tag03 renamed three times';
        t.save();
        return t;
      }
    );

    const user1 = await sequelize.models.User.create({ name: 'user01' }).then(
      u => {
        u.name = 'user01 renamed';
        u.save();
        u.name = 'user01 renamed twice';
        u.save();
        u.name = 'user01 renamed three times';
        u.save();
        return u;
      }
    );

    const user2 = await sequelize.models.User.create({ name: 'user02' }).then(
      u => {
        u.name = 'user02 renamed';
        u.save();
        u.name = 'user02 renamed twice';
        u.save();
        u.name = 'user02 renamed three times';
        u.save();
        return u;
      }
    );

    const creation1 = await sequelize.models.Creation.create({
      name: 'creation01',
      user: user1.id,
      user2: user2.id
    }).then(c => {
      c.name = 'creation01 renamed';
      c.save();
      c.name = 'creation01 renamed twice';
      c.save();
      c.name = 'creation01 renamed three times';
      c.save();
      return c;
    });

    const creation2 = await sequelize.models.Creation.create({
      name: 'creation02',
      user: user1.id,
      user2: user2.id
    }).then(c => {
      c.name = 'creation02 renamed';
      c.save();
      c.name = 'creation02 renamed twice';
      c.save();
      c.name = 'creation02 renamed three times';
      c.save();
      return c;
    });

    const event1 = await sequelize.models.Event.create({
      name: 'event01',
      creation: creation1.id
    }).then(e => {
      e.name = 'event01 renamed';
      e.save();
      e.name = 'event01 renamed twice';
      e.save();
      e.name = 'event01 renamed three times';
      e.save();
      return e;
    });

    const event2 = await sequelize.models.Event.create({
      name: 'event02',
      creation: creation2.id
    }).then(e => {
      e.name = 'event02 renamed';
      e.save();
      e.name = 'event02 renamed twice';
      e.save();
      e.name = 'event02 renamed three times';
      e.save();
      return e;
    });

    const creationTag1 = await creation1.addTag(tag1);
    const creationTag1_rem = await creation1.removeTag(tag1);
    const creationTags = await sequelize.models.CreationTag.findAll({
      paranoid: false
    });
    if (creationTags.length === 0) {
      // paranoid: false is being used, so the tag deletion is a hard delete
      const creationTag1_rea = await creation1.addTag(tag1);
    } else if (creationTags.length === 1) {
      // paranoid: true is being used so we just have to un-delete
      const deletedTag = await sequelize.models.CreationTag.findAll({
        paranoid: false
      });
      deletedTag[0].setDataValue('deletedAt', null);
      await deletedTag[0].save();
    }

    const creationTag2 = await creation1.addTag(tag2);
    const creationTag3 = await creation1.addTag(tag3);
    const creationTag4 = await creation2.addTag(tag1);
    const creationTag5 = await creation2.addTag(tag2);
    const creationTag6 = await creation2.addTag(tag3);
  }

  function freshDB(dbOptions: DbOptions) {
    return function() {
      return newDB(dbOptions);
    };
  }

  function freshDBWithSuffixEndingWithT() {
    return newDB({
      options: { paranoid: false },
      temporalizeOptions: {
        modelSuffix: '_Hist'
      }
    });
  }

  async function assertCount(modelHistory, n, options?) {
    const count = await modelHistory.count(options);
    await assert.equal(count, n, 'history entries ' + modelHistory.name);
  }

  describe('paranoid=false, timestamps=true', function() {
    test({ options: { paranoid: false, timestamps: true } });
  });
  describe('paranoid=false, timestamps=false', function() {
    test({ options: { paranoid: false, timestamps: false } });
  });
  describe('paranoid=true', function() {
    test({ options: { paranoid: true } });
  });

  function test(dbOptions: DbOptions) {
    describe('DB Tests', function() {
      beforeEach(freshDB(dbOptions));

      it('onUpdate/onDestroy: should save to the historyDB 1', async function() {
        const user = await sequelize.models.User.create();
        await assertCount(sequelize.models.UserHistory, 1);
        user.name = 'foo';
        await user.save();
        await assertCount(sequelize.models.UserHistory, 2);
        await user.destroy();
        await assertCount(sequelize.models.UserHistory, 3);
      });

      it('revert on failed transactions', async function() {
        const transaction = await sequelize.transaction();
        const user = await sequelize.models.User.create({ name: 'not foo' });
        await assertCount(sequelize.models.UserHistory, 1);
        user.name = 'foo';
        await user.save({ transaction });
        await assertCount(sequelize.models.UserHistory, 2, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 1);
      });

      it('should archive every entry', async function() {
        await sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ]);
        await assertCount(sequelize.models.UserHistory, 2);
        await sequelize.models.User.update(
          { name: 'updated-foo' },
          { where: {}, individualHooks: true }
        );
        await assertCount(sequelize.models.UserHistory, 4);
      });

      it('should revert under transactions', async function() {
        const transaction = await sequelize.transaction();
        await sequelize.models.User.bulkCreate(
          [{ name: 'foo1' }, { name: 'foo2' }],
          { transaction }
        );
        await assertCount(sequelize.models.UserHistory, 0);
        await assertCount(sequelize.models.UserHistory, 2, {
          transaction
        });
        await sequelize.models.User.update(
          { name: 'updated-foo' },
          {
            where: {},
            transaction
          }
        );
        await assertCount(sequelize.models.UserHistory, 0);
        await assertCount(sequelize.models.UserHistory, 4, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 0);
      });

      it('should revert on failed transactions, even when using after hooks', async function() {
        const transaction = await sequelize.transaction();
        const user = await sequelize.models.User.create(
          { name: 'test' },
          { transaction }
        );
        await assertCount(sequelize.models.UserHistory, 1, { transaction });
        await user.destroy({ transaction });
        await assertCount(sequelize.models.UserHistory, 2, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 0);
      });
    });

    describe('Association Tests', function() {
      describe('test there are no history association', function() {
        beforeEach(freshDB(dbOptions));

        it('Should have relations for origin models but not for history models', async function() {
          await dataCreate();

          //Get User
          const user = await sequelize.models.User.findOne();

          //User associations check
          await assert.notExists(
            user.getUserHistories,
            'User: getUserHistories exists'
          );

          await assert.exists(
            user.getCreatorCreations,
            'User: getCreatorCreations does not exist'
          );
          await assert.exists(
            user.getUpdaterCreations,
            'User: getUpdaterCreations does not exist'
          );
          const creation = await user.getCreatorCreations();

          //Creation associations check
          await assert.equal(
            creation.length,
            2,
            'User: should have found 2 creations'
          );
          await assert.notExists(
            creation[0].getCreationHistories,
            'Creation: getCreationHistories exists'
          );

          await assert.exists(
            creation[0].getTags,
            'Creation: getTags does not exist'
          );
          const tag = await creation[0].getTags();

          await assert.exists(
            creation[0].getEvent,
            'Creation: getEvent does not exist'
          );
          const event = await creation[0].getEvent();

          await assert.exists(
            creation[0].getCreateUser,
            'Creation: getCreateUser does not exist'
          );
          await assert.exists(
            creation[0].getUpdateUser,
            'Creation: getUpdateUser does not exist'
          );
          const cUser = await creation[0].getCreateUser();
          await assert.exists(cUser, 'Creation: did not find CreateUser');

          //Tag associations check
          await assert.equal(
            tag.length,
            3,
            'Creation: should have found 3 tags'
          );
          await assert.notExists(
            tag[0].getTagHistories,
            'Tag: getTagHistories exists'
          );

          await assert.exists(
            tag[0].getCreations,
            'Tag: getCreations does not exist'
          );
          const tCreation = await tag[0].getCreations();

          await assert.equal(
            tCreation.length,
            2,
            'Tag: should have found 2 creations'
          );

          //Event associations check
          await assert.exists(event, 'Creation: did not find event');
          await assert.notExists(
            event.getEventHistories,
            'Event: getEventHistories exist'
          );

          await assert.exists(event.getCreation);
          const eCreation = await event.getCreation();
          await assert.exists(eCreation);

          //Check history data
          await assertCount(sequelize.models.UserHistory, 8);
          await assertCount(sequelize.models.CreationHistory, 8);
          await assertCount(sequelize.models.TagHistory, 12);
          await assertCount(sequelize.models.EventHistory, 8);
          await assertCount(sequelize.models.CreationTagHistory, 8);
        });
      });
    });

    describe('hooks', function() {
      beforeEach(freshDB(dbOptions));
      it('onCreate: should store the new version in history db', async function() {
        await sequelize.models.User.create({ name: 'test' });
        await assertCount(sequelize.models.UserHistory, 1);
      });

      it('onUpdate/onDestroy: should save to the historyDB', async function() {
        const user = await sequelize.models.User.create();
        await assertCount(sequelize.models.UserHistory, 1);
        user.name = 'foo';
        await user.save();
        await assertCount(sequelize.models.UserHistory, 2);
        await user.destroy();
        await assertCount(sequelize.models.UserHistory, 3);
      });

      it('onUpdate: should store the previous version to the historyDB', async function() {
        const user = await sequelize.models.User.create({ name: 'foo' });
        await assertCount(sequelize.models.UserHistory, 1);
        user.name = 'bar';
        await user.save();
        await assertCount(sequelize.models.UserHistory, 2);
        const users = await sequelize.models.UserHistory.findAll();
        await assert.equal(users.length, 2, 'multiple entries');
        await sequelize.models.User.findOne();
        await user.destroy();
        await assertCount(sequelize.models.UserHistory, 3);
      });

      it('onDelete: should store the previous version to the historyDB', async function() {
        const user = await sequelize.models.User.create({ name: 'foo' });
        await assertCount(sequelize.models.UserHistory, 1);
        await user.destroy();
        await assertCount(sequelize.models.UserHistory, 2);
        const users = await sequelize.models.UserHistory.findAll();
        await assert.equal(users.length, 2, 'two entries');
      });
    });

    describe('transactions', function() {
      beforeEach(freshDB(dbOptions));

      it('revert on failed transactions', async function() {
        const transaction = await sequelize.transaction();
        const user = await sequelize.models.User.create(
          { name: 'not foo' },
          { transaction }
        );
        await assertCount(sequelize.models.UserHistory, 1, { transaction });
        user.name = 'foo';
        await user.save({ transaction });
        await assertCount(sequelize.models.UserHistory, 2, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 0);
      });
    });

    describe('bulk update', function() {
      beforeEach(freshDB(dbOptions));

      it('should archive every entry', async function() {
        await sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ]);
        await assertCount(sequelize.models.UserHistory, 2);
        await sequelize.models.User.update(
          { name: 'updated-foo' },
          { where: {} }
        );
        await assertCount(sequelize.models.UserHistory, 4);
      });

      it('should revert under transactions', async function() {
        const transaction = await sequelize.transaction();
        await sequelize.models.User.bulkCreate(
          [{ name: 'foo1' }, { name: 'foo2' }],
          { transaction }
        );
        await assertCount(sequelize.models.UserHistory, 2, { transaction });
        await sequelize.models.User.update(
          { name: 'updated-foo' },
          {
            where: {},
            transaction
          }
        );
        await assertCount(sequelize.models.UserHistory, 4, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 0);
      });
    });

    describe('bulk destroy/truncate', function() {
      beforeEach(freshDB(dbOptions));
      it('should archive every entry', async function() {
        await sequelize.models.User.bulkCreate([
          { name: 'foo1' },
          { name: 'foo2' }
        ]);
        await assertCount(sequelize.models.UserHistory, 2);
        await sequelize.models.User.destroy({
          where: {},
          truncate: true // truncate the entire table
        });
        await assertCount(sequelize.models.UserHistory, 4);
      });

      it('should revert under transactions', async function() {
        const transaction = await sequelize.transaction();
        await sequelize.models.User.bulkCreate(
          [{ name: 'foo1' }, { name: 'foo2' }],
          { transaction }
        );
        await assertCount(sequelize.models.UserHistory, 2, { transaction });
        await sequelize.models.User.destroy({
          where: {},
          truncate: true, // truncate the entire table
          transaction
        });
        await assertCount(sequelize.models.UserHistory, 4, { transaction });
        await transaction.rollback();
        await assertCount(sequelize.models.UserHistory, 0);
      });
    });

    describe('read-only ', function() {
      beforeEach(freshDB(dbOptions));

      it('should forbid updates', function() {
        const userUpdate = sequelize.models.UserHistory.create({
          name: 'bla00'
        }).then(uh => uh.update({ name: 'bla' }));

        // @ts-ignore
        return assert.isRejected(userUpdate, Error, 'Validation error');
      });

      it('should forbid deletes', function() {
        const userUpdate = sequelize.models.UserHistory.create({
          name: 'bla00'
        }).then(uh => uh.destroy());
        // @ts-ignore
        return assert.isRejected(userUpdate, Error, 'Validation error');
      });
    });

    describe('interference with the original model', function() {
      beforeEach(freshDB(dbOptions));

      it("shouldn't delete instance methods", async function() {
        const Fruit = sequelize.define('Fruit', {
          name: DataTypes.TEXT
        });
        const FruitHistory = Temporalize({
          model: Fruit,
          sequelize,
          temporalizeOptions: {}
        });
        Fruit.prototype.sayHi = () => {
          return 2;
        };
        await sequelize.sync();
        const f = await Fruit.create();
        assert.isFunction(f.sayHi);
        assert.equal(f.sayHi(), 2);
      });

      it("shouldn't interfere with hooks of the model", async function() {
        let triggered = 0;
        const Fruit = sequelize.define(
          'Fruit',
          { name: DataTypes.TEXT },
          {
            hooks: {
              beforeCreate: function() {
                triggered++;
              }
            }
          }
        );
        const FruitHistory = Temporalize({
          model: Fruit,
          sequelize,
          temporalizeOptions: {}
        });
        await sequelize.sync();
        await Fruit.create();
        assert.equal(triggered, 1, 'hook trigger count');
      });

      it("shouldn't interfere with setters", async function() {
        let triggered = 0;
        const Fruit = sequelize.define('Fruit', {
          name: {
            type: DataTypes.TEXT,
            set: function() {
              triggered++;
            }
          }
        });
        const FruitHistory = Temporalize({
          model: Fruit,
          sequelize,
          temporalizeOptions: {}
        });
        await sequelize.sync();
        await Fruit.create({ name: 'apple' });
        assert.equal(triggered, 1, 'hook trigger count');
      });
    });
  }
});
