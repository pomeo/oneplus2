'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EmailsAccountsSchema = new Schema();

EmailsAccountsSchema.add({
  email       : { type: String, unique: true }, // почтовый адрес
  hash        : { type: String, index: true }, // хеш
  password    : String, // пароль от аккаунта
  invite      : { type: Boolean, index: true }, // инвайт в аккаунте
  sell        : { type: Boolean, index: true }, // продан аккаунт
  start       : { type: Date, index: true }, // дата начала инвайта
  end         : { type: Date, index: true }, // дата конца инвайта
  created_at  : { type: Date }, // дата создания
  updated_at  : { type: Date } // дата изменения
}, {
  _id: false
});

mongoose.model('EmailsAccounts', EmailsAccountsSchema);
