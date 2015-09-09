'use strict';
let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let AccountsSchema = new Schema();

AccountsSchema.add({
  userid      : { type: String, unique: true }, // id paypal адрес
  email       : { type: String, index: true }, // почтовый адрес
  created_at  : { type: Date }, // дата создания
  updated_at  : { type: Date } // дата изменения
}, {
  _id: false
});

mongoose.model('Accounts', AccountsSchema);
