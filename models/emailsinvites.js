'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EmailsForInvitesSchema = new Schema();

EmailsForInvitesSchema.add({
  _id         : false,
  order       : { type: Number, index: true }, // номер почты
  mail        : { type: String, unique: true }, // почтовый адрес
  hash        : { type: String, index: true }, // хеш
  equal       : { type: Number, index: true }, // количество рефереров должно быть
  count       : { type: Number, index: true }, // количество рефереров на данный момент
  ref         : { type: String, index: true }, // реферальный код
  confirm     : Boolean, // подтверждённый адрес
  used        : { type: Boolean, index: true }, // использован как реферер
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
});

EmailsForInvitesSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

mongoose.model('EmailsForInvites', EmailsForInvitesSchema);
