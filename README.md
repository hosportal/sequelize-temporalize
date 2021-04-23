# Temporalize tables for Sequelize

(aka "Historical records")

This package is a derivative of [sequelize-temporal](https://www.npmjs.com/package/sequelize-temporal), with some bug fixes and major changes merged in. The project is now a substantial divergence from [sequelize-temporal](https://www.npmjs.com/package/sequelize-temporal), so it is no longer interchangeable.

## What is it?

Temporalize tables maintain **historical versions** of data. Modifying operations (UPDATE, DELETE) on these tables don't cause permanent changes to entries, but create new versions of them. Hence this might be used to:

- log changes (security/auditing)
- undo functionalities
- track interactions (customer support)

Under the hood a history table with the same structure, but without constraints is created.

The normal singular/plural naming scheme in Sequelize is used:

- model name: `modelName + 'History'`
- table name: `modelName + 'Histories'`
- index name: `indexName + '_history'`

## Installation

```bash
npm install sequelize-temporalize
```

## How to use

### 1) Import `sequelize-temporalize`

```js
var Sequelize = require('sequelize');
var Temporalize = require('sequelize-temporalize');
```

or using imports

```js
import { Sequelize, Model, UUID, UUIDV4 } from 'sequelize';
import { Temporalize } from 'sequelize-temporalize';
```

Create a sequelize instance and your models, e.g.

```js
var sequelize = new Sequelize('', '', '', {
  dialect: 'sqlite',
  storage: __dirname + '/.test.sqlite'
});
```

### 2) Add the _temporalize_ feature to your models

```js
var User = sequelize.define('User', {paranoid: true});
// paranoid: true necessary to keep track of deleted entries in history table
var UserHistory = Temporalize({
    model: User,
    sequelize: sequelize,
    temporalizeOptions: {/* some options can be put here */});
```

or using es6 classes (useful in Typescript)

```js
export class User extends Model {
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date; // necessary if using paranoid:true
  public id!: string;
  public username!: string;
  public email!: string;
}
export class UserHistory extends User {
  public readonly archivedAt!: Date;
  public readonly transactionId!: string; // necessary if logTransactionId: true
  public readonly eventId!: string;
  public readonly deletion!: boolean;
}
// initialize the User model
User.init({
  id: {
    type: UUID,
    defaultValue: UUIDV4,
    primaryKey: true,
    unique: true,
  },
  username: {
    type: new DataTypes.STRING(),
    unique: true,
  },
  email: {
    type: new DataTypes.STRING(),
  },
},
{
  sequelize,
  tableName: 'User',
  paranoid: true,
});
// initialize the UserHistory model
Temporalize({
  model: User,
  modelHistory: UserHistory,
  sequelize,
  temporalizeOptions: {/* some options can be put here */},
});
```

The output of `Temporalize` is its history model. If you pass it a modelHistory
class, it will return that same modelHistory class.

## IMPORTANT NOTE

If you would like to keep track of deletes in the history table, you MUST use
the `paranoid: true` option when creating the original table.

## Options

The default syntax for `Temporalize` is:

`Temporalize({model, modelHistory, sequelize, temporalizeOptions})`

whereas the temporalizeOptions are listed here (with default value).

### temporalizeOptions.blocking = true

Runs the insert within the sequelize hook promise chain, disable for increased
performance without warranties.

### temporalizeOptions.modelSuffix = 'History'

By default sequelize-temporalize will add 'History' to the history model name
and 'Histories' to the history table. By updating the modelSuffix value, you can
decide what the naming will be. The value will be appended to the history model
name and its plural will be appended to the history tablename.

examples for table User:
modelSuffix: '\_Hist' --> History Model Name: User_Hist --> History Table Name: User_Hists
modelSuffix: 'Memory' --> History Model Name: UserMemory --> History Table Name: UserMemories
modelSuffix: 'Pass' --> History Model Name: UserPass --> History Table Name: UserPasses

### temporalizeOptions.indexSuffix = '\_history'

All indexes that are preserved during the creation of the history table will
have a '\_history' suffix added to make it distinct to the original table's
index.

### temporalizeOptions.allowTransactions = true

By default, transactions are allowed but can be disabled with that flag for the
historical tables (transactions on original tables should stay the same). It is
useful in case you are using a separate DB than the one use by the original DB.

NOTE: IF YOU USE A SEPARATE DB FOR HISTORICAL TABLE, SET THE VALUE TO FALSE OR
YOU WILL GET AN ERROR.

### temporalizeOptions.logTransactionId = true

Logging the transactionId allows you to identify records that have been updated
in a single transaction across tables.

### temporalizeOptions.logEventId = true

Logging eventIds allows you to keep track of operations that occur in a single
event, and if you simultaneously keep a history of requests in anther table, who
performed them.
For example, we may be updating multiple tables in a single request. We want a
way of identifying the single operation across multiple tables in the table
histories. To do this, we store the eventId. It is important that immediately
after the creation of the eventId that the eventId, current time, route being
requested and user ID of the individual making the request (and any other
information you think is important) is stored in a request table.

```js
import { v4 as uuidv4 } from 'uuid';
import { RequestLog } from '../models/request-log'; // the RequestLog table
import { Post } from '../models/post'; // the Posts table

export function doPostCreate(req, res) {
  const userId = req.userId;
  const eventId = uuidv4(); // for example, can use other uuid functions to generate unique ids for the request event
  // Log the request
  await RequestLog.create(
    {
      userId,
      date: new Date()
    },
    { eventId } // use `{ eventId } as any` here if using typescript, as eventId is not defined on sequelize options types
  );

  // Do other things with the same eventId
  await Post.create({
    title: req.body.title,
    text: req.body.text
  },
  {eventId});
  // The eventId will be logged in the associated history table for Post AND in RequestLog
});
```

### temporalizeOptions.eventIdColumnName

Because it is quite likely that there will be a conflict between the column name
`eventId` in the history table, and a column in the min table, an option is
provided to rename the `eventId` column. Note that the `eventId` parameter
attached to the options object in `Model.create(obj, options)` etc remains
unchanged.

### History table

History table stores historical versions of rows, which are inserted by triggers
on every modifying operation executed on current table. It has the same
structure and indexes as current table, but it doesn’t have any constraints.
History tables are insert only and creator should prevent other users from
executing updates or deletes by correct user rights settings. Otherwise the
history can be violated.

### Hooks

Triggers for storing old versions of rows to history table are inspired by
referential integrity triggers. They are fired for each row after UPDATE and
DELETE (within the same transaction)

### IMPORTANT

If you use `destroy` or `restore` methods it is very important that you use
`paranoid: true` on all models you plan to use destroy/restore on, to ensure
that copies of the data exist in the DB to be copied into the history table.

## License

The MIT License (MIT)

Copyright (c) 2015 James Jansson, Hosportal, BonaVal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
