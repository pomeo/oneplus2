'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var AccountsSchema = new Schema();

AccountsSchema.add({
  _id         : false,
  userid      : { type: String, unique: true }, // id paypal адрес
  email       : { type: String, index: true }, // почтовый адрес
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
});

AccountsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

mongoose.model('Accounts', AccountsSchema);
