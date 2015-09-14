'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EmailsAccountsSchema = new Schema({
  email       : { type: String, unique: true }, // почтовый адрес
  urlhash     : { type: String, index: true }, // хеш
  password    : String, // пароль от аккаунта
  invite      : { type: Boolean, index: true }, // инвайт в аккаунте
  sell        : { type: Boolean, index: true }, // продан аккаунт
  type        : { type: Number, index: true }, // тип аккаунта
  start       : { type: Number, index: true }, // дата начала инвайта
  end         : { type: Number, index: true }, // дата конца инвайта
  created_at  : { type: Date }, // дата создания
  updated_at  : { type: Date } // дата изменения
});

mongoose.model('EmailsAccounts', EmailsAccountsSchema);
