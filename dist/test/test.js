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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const sequelize_1 = require("sequelize");
const chai = __importStar(require("chai"));
const chai_as_promised_1 = __importDefault(require("chai-as-promised"));
const fs = __importStar(require("fs"));
chai.use(chai_as_promised_1.default);
const assert = chai.assert;
describe('Test sequelize-temporalize', function () {
    let sequelize;
    function newDB({ options, temporalizeOptions } = {}) {
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
        }
        catch (_a) { }
        sequelize = new sequelize_1.Sequelize('', '', '', {
            dialect: 'sqlite',
            storage: dbFile,
            logging: false //console.log
        });
        // Define origin models
        const User = sequelize.define('User', { name: sequelize_1.DataTypes.TEXT }, options);
        const Creation = sequelize.define('Creation', {
            name: sequelize_1.DataTypes.TEXT,
            user: sequelize_1.DataTypes.INTEGER,
            user2: sequelize_1.DataTypes.INTEGER
        }, options);
        const Tag = sequelize.define('Tag', { name: sequelize_1.DataTypes.TEXT }, options);
        const Event = sequelize.define('Event', {
            name: sequelize_1.DataTypes.TEXT,
            creation: sequelize_1.DataTypes.INTEGER
        }, options);
        const CreationTag = sequelize.define('CreationTag', {
            creation: sequelize_1.DataTypes.INTEGER,
            tag: sequelize_1.DataTypes.INTEGER
        }, options);
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
        index_1.Temporalize({
            model: User,
            sequelize,
            temporalizeOptions
        });
        index_1.Temporalize({
            model: Creation,
            sequelize,
            temporalizeOptions
        });
        index_1.Temporalize({
            model: Tag,
            sequelize,
            temporalizeOptions
        });
        index_1.Temporalize({
            model: Event,
            sequelize,
            temporalizeOptions
        });
        index_1.Temporalize({
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
    function dataCreate() {
        return __awaiter(this, void 0, void 0, function* () {
            const tag1 = yield sequelize.models.Tag.create({ name: 'tag01' }).then(t => {
                t.name = 'tag01 renamed';
                t.save();
                t.name = 'tag01 renamed twice';
                t.save();
                t.name = 'tag01 renamed three times';
                t.save();
                return t;
            });
            const tag2 = yield sequelize.models.Tag.create({ name: 'tag02' }).then(t => {
                t.name = 'tag02 renamed';
                t.save();
                t.name = 'tag02 renamed twice';
                t.save();
                t.name = 'tag02 renamed three times';
                t.save();
                return t;
            });
            const tag3 = yield sequelize.models.Tag.create({ name: 'tag03' }).then(t => {
                t.name = 'tag03 renamed';
                t.save();
                t.name = 'tag03 renamed twice';
                t.save();
                t.name = 'tag03 renamed three times';
                t.save();
                return t;
            });
            const user1 = yield sequelize.models.User.create({ name: 'user01' }).then(u => {
                u.name = 'user01 renamed';
                u.save();
                u.name = 'user01 renamed twice';
                u.save();
                u.name = 'user01 renamed three times';
                u.save();
                return u;
            });
            const user2 = yield sequelize.models.User.create({ name: 'user02' }).then(u => {
                u.name = 'user02 renamed';
                u.save();
                u.name = 'user02 renamed twice';
                u.save();
                u.name = 'user02 renamed three times';
                u.save();
                return u;
            });
            const creation1 = yield sequelize.models.Creation.create({
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
            const creation2 = yield sequelize.models.Creation.create({
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
            const event1 = yield sequelize.models.Event.create({
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
            const event2 = yield sequelize.models.Event.create({
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
            const creationTag1 = yield creation1.addTag(tag1);
            const creationTag1_rem = yield creation1.removeTag(tag1);
            const creationTags = yield sequelize.models.CreationTag.findAll({
                paranoid: false
            });
            if (creationTags.length === 0) {
                // paranoid: false is being used, so the tag deletion is a hard delete
                const creationTag1_rea = yield creation1.addTag(tag1);
            }
            else if (creationTags.length === 1) {
                // paranoid: true is being used so we just have to un-delete
                const deletedTag = yield sequelize.models.CreationTag.findAll({
                    paranoid: false
                });
                deletedTag[0].setDataValue('deletedAt', null);
                yield deletedTag[0].save();
            }
            const creationTag2 = yield creation1.addTag(tag2);
            const creationTag3 = yield creation1.addTag(tag3);
            const creationTag4 = yield creation2.addTag(tag1);
            const creationTag5 = yield creation2.addTag(tag2);
            const creationTag6 = yield creation2.addTag(tag3);
        });
    }
    function freshDB(dbOptions) {
        return function () {
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
    function assertCount(modelHistory, n, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const count = yield modelHistory.count(options);
            yield assert.equal(count, n, 'history entries ' + modelHistory.name);
        });
    }
    describe('paranoid=false, timestamps=true', function () {
        test({ options: { paranoid: false, timestamps: true } });
    });
    describe('paranoid=false, timestamps=false', function () {
        test({ options: { paranoid: false, timestamps: false } });
    });
    describe('paranoid=true', function () {
        test({ options: { paranoid: true } });
    });
    function test(dbOptions) {
        describe('DB Tests', function () {
            beforeEach(freshDB(dbOptions));
            it('onUpdate/onDestroy: should save to the historyDB 1', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const user = yield sequelize.models.User.create();
                    yield assertCount(sequelize.models.UserHistory, 1);
                    user.name = 'foo';
                    yield user.save();
                    yield assertCount(sequelize.models.UserHistory, 2);
                    yield user.destroy();
                    yield assertCount(sequelize.models.UserHistory, 3);
                });
            });
            it('revert on failed transactions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    const user = yield sequelize.models.User.create({ name: 'not foo' });
                    yield assertCount(sequelize.models.UserHistory, 1);
                    user.name = 'foo';
                    yield user.save({ transaction });
                    yield assertCount(sequelize.models.UserHistory, 2, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 1);
                });
            });
            it('should archive every entry', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield sequelize.models.User.bulkCreate([
                        { name: 'foo1' },
                        { name: 'foo2' }
                    ]);
                    yield assertCount(sequelize.models.UserHistory, 2);
                    yield sequelize.models.User.update({ name: 'updated-foo' }, { where: {}, individualHooks: true });
                    yield assertCount(sequelize.models.UserHistory, 4);
                });
            });
            it('should revert under transactions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    yield sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], { transaction });
                    yield assertCount(sequelize.models.UserHistory, 0);
                    yield assertCount(sequelize.models.UserHistory, 2, {
                        transaction
                    });
                    yield sequelize.models.User.update({ name: 'updated-foo' }, {
                        where: {},
                        transaction
                    });
                    yield assertCount(sequelize.models.UserHistory, 0);
                    yield assertCount(sequelize.models.UserHistory, 4, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 0);
                });
            });
            it('should revert on failed transactions, even when using after hooks', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    const user = yield sequelize.models.User.create({ name: 'test' }, { transaction });
                    yield assertCount(sequelize.models.UserHistory, 1, { transaction });
                    yield user.destroy({ transaction });
                    yield assertCount(sequelize.models.UserHistory, 2, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 0);
                });
            });
        });
        describe('Association Tests', function () {
            describe('test there are no history association', function () {
                beforeEach(freshDB(dbOptions));
                it('Should have relations for origin models but not for history models', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield dataCreate();
                        //Get User
                        const user = yield sequelize.models.User.findOne();
                        //User associations check
                        yield assert.notExists(user.getUserHistories, 'User: getUserHistories exists');
                        yield assert.exists(user.getCreatorCreations, 'User: getCreatorCreations does not exist');
                        yield assert.exists(user.getUpdaterCreations, 'User: getUpdaterCreations does not exist');
                        const creation = yield user.getCreatorCreations();
                        //Creation associations check
                        yield assert.equal(creation.length, 2, 'User: should have found 2 creations');
                        yield assert.notExists(creation[0].getCreationHistories, 'Creation: getCreationHistories exists');
                        yield assert.exists(creation[0].getTags, 'Creation: getTags does not exist');
                        const tag = yield creation[0].getTags();
                        yield assert.exists(creation[0].getEvent, 'Creation: getEvent does not exist');
                        const event = yield creation[0].getEvent();
                        yield assert.exists(creation[0].getCreateUser, 'Creation: getCreateUser does not exist');
                        yield assert.exists(creation[0].getUpdateUser, 'Creation: getUpdateUser does not exist');
                        const cUser = yield creation[0].getCreateUser();
                        yield assert.exists(cUser, 'Creation: did not find CreateUser');
                        //Tag associations check
                        yield assert.equal(tag.length, 3, 'Creation: should have found 3 tags');
                        yield assert.notExists(tag[0].getTagHistories, 'Tag: getTagHistories exists');
                        yield assert.exists(tag[0].getCreations, 'Tag: getCreations does not exist');
                        const tCreation = yield tag[0].getCreations();
                        yield assert.equal(tCreation.length, 2, 'Tag: should have found 2 creations');
                        //Event associations check
                        yield assert.exists(event, 'Creation: did not find event');
                        yield assert.notExists(event.getEventHistories, 'Event: getEventHistories exist');
                        yield assert.exists(event.getCreation);
                        const eCreation = yield event.getCreation();
                        yield assert.exists(eCreation);
                        //Check history data
                        yield assertCount(sequelize.models.UserHistory, 8);
                        yield assertCount(sequelize.models.CreationHistory, 8);
                        yield assertCount(sequelize.models.TagHistory, 12);
                        yield assertCount(sequelize.models.EventHistory, 8);
                        yield assertCount(sequelize.models.CreationTagHistory, 8);
                    });
                });
            });
        });
        describe('hooks', function () {
            beforeEach(freshDB(dbOptions));
            it('onCreate: should store the new version in history db', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield sequelize.models.User.create({ name: 'test' });
                    yield assertCount(sequelize.models.UserHistory, 1);
                });
            });
            it('onUpdate/onDestroy: should save to the historyDB', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const user = yield sequelize.models.User.create();
                    yield assertCount(sequelize.models.UserHistory, 1);
                    user.name = 'foo';
                    yield user.save();
                    yield assertCount(sequelize.models.UserHistory, 2);
                    yield user.destroy();
                    yield assertCount(sequelize.models.UserHistory, 3);
                });
            });
            it('onUpdate: should store the previous version to the historyDB', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const user = yield sequelize.models.User.create({ name: 'foo' });
                    yield assertCount(sequelize.models.UserHistory, 1);
                    user.name = 'bar';
                    yield user.save();
                    yield assertCount(sequelize.models.UserHistory, 2);
                    const users = yield sequelize.models.UserHistory.findAll();
                    yield assert.equal(users.length, 2, 'multiple entries');
                    yield sequelize.models.User.findOne();
                    yield user.destroy();
                    yield assertCount(sequelize.models.UserHistory, 3);
                });
            });
            it('onDelete: should store the previous version to the historyDB', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const user = yield sequelize.models.User.create({ name: 'foo' });
                    yield assertCount(sequelize.models.UserHistory, 1);
                    yield user.destroy();
                    yield assertCount(sequelize.models.UserHistory, 2);
                    const users = yield sequelize.models.UserHistory.findAll();
                    yield assert.equal(users.length, 2, 'two entries');
                });
            });
        });
        describe('transactions', function () {
            beforeEach(freshDB(dbOptions));
            it('revert on failed transactions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    const user = yield sequelize.models.User.create({ name: 'not foo' }, { transaction });
                    yield assertCount(sequelize.models.UserHistory, 1, { transaction });
                    user.name = 'foo';
                    yield user.save({ transaction });
                    yield assertCount(sequelize.models.UserHistory, 2, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 0);
                });
            });
        });
        describe('bulk update', function () {
            beforeEach(freshDB(dbOptions));
            it('should archive every entry', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield sequelize.models.User.bulkCreate([
                        { name: 'foo1' },
                        { name: 'foo2' }
                    ]);
                    yield assertCount(sequelize.models.UserHistory, 2);
                    yield sequelize.models.User.update({ name: 'updated-foo' }, { where: {} });
                    yield assertCount(sequelize.models.UserHistory, 4);
                });
            });
            it('should revert under transactions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    yield sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], { transaction });
                    yield assertCount(sequelize.models.UserHistory, 2, { transaction });
                    yield sequelize.models.User.update({ name: 'updated-foo' }, {
                        where: {},
                        transaction
                    });
                    yield assertCount(sequelize.models.UserHistory, 4, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 0);
                });
            });
        });
        describe('bulk destroy/truncate', function () {
            beforeEach(freshDB(dbOptions));
            it('should archive every entry', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield sequelize.models.User.bulkCreate([
                        { name: 'foo1' },
                        { name: 'foo2' }
                    ]);
                    yield assertCount(sequelize.models.UserHistory, 2);
                    yield sequelize.models.User.destroy({
                        where: {},
                        truncate: true // truncate the entire table
                    });
                    yield assertCount(sequelize.models.UserHistory, 4);
                });
            });
            it('should revert under transactions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const transaction = yield sequelize.transaction();
                    yield sequelize.models.User.bulkCreate([{ name: 'foo1' }, { name: 'foo2' }], { transaction });
                    yield assertCount(sequelize.models.UserHistory, 2, { transaction });
                    yield sequelize.models.User.destroy({
                        where: {},
                        truncate: true,
                        transaction
                    });
                    yield assertCount(sequelize.models.UserHistory, 4, { transaction });
                    yield transaction.rollback();
                    yield assertCount(sequelize.models.UserHistory, 0);
                });
            });
        });
        describe('read-only ', function () {
            beforeEach(freshDB(dbOptions));
            it('should forbid updates', function () {
                const userUpdate = sequelize.models.UserHistory.create({
                    name: 'bla00'
                }).then(uh => uh.update({ name: 'bla' }));
                // @ts-ignore
                return assert.isRejected(userUpdate, Error, 'Validation error');
            });
            it('should forbid deletes', function () {
                const userUpdate = sequelize.models.UserHistory.create({
                    name: 'bla00'
                }).then(uh => uh.destroy());
                // @ts-ignore
                return assert.isRejected(userUpdate, Error, 'Validation error');
            });
        });
        describe('interference with the original model', function () {
            beforeEach(freshDB(dbOptions));
            it("shouldn't delete instance methods", function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const Fruit = sequelize.define('Fruit', {
                        name: sequelize_1.DataTypes.TEXT
                    });
                    const FruitHistory = index_1.Temporalize({
                        model: Fruit,
                        sequelize,
                        temporalizeOptions: {}
                    });
                    Fruit.prototype.sayHi = () => {
                        return 2;
                    };
                    yield sequelize.sync();
                    const f = yield Fruit.create();
                    assert.isFunction(f.sayHi);
                    assert.equal(f.sayHi(), 2);
                });
            });
            it("shouldn't interfere with hooks of the model", function () {
                return __awaiter(this, void 0, void 0, function* () {
                    let triggered = 0;
                    const Fruit = sequelize.define('Fruit', { name: sequelize_1.DataTypes.TEXT }, {
                        hooks: {
                            beforeCreate: function () {
                                triggered++;
                            }
                        }
                    });
                    const FruitHistory = index_1.Temporalize({
                        model: Fruit,
                        sequelize,
                        temporalizeOptions: {}
                    });
                    yield sequelize.sync();
                    yield Fruit.create();
                    assert.equal(triggered, 1, 'hook trigger count');
                });
            });
            it("shouldn't interfere with setters", function () {
                return __awaiter(this, void 0, void 0, function* () {
                    let triggered = 0;
                    const Fruit = sequelize.define('Fruit', {
                        name: {
                            type: sequelize_1.DataTypes.TEXT,
                            set: function () {
                                triggered++;
                            }
                        }
                    });
                    const FruitHistory = index_1.Temporalize({
                        model: Fruit,
                        sequelize,
                        temporalizeOptions: {}
                    });
                    yield sequelize.sync();
                    yield Fruit.create({ name: 'apple' });
                    assert.equal(triggered, 1, 'hook trigger count');
                });
            });
        });
    }
});
