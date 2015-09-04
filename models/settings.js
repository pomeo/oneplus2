'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SettingsSchema = new Schema();

SettingsSchema.add({
  _id         : false,
  property    : { type: String, index: true }, // свойство
  value       : String, // значение свойства
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
});

SettingsSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

mongoose.model('Settings', SettingsSchema);
