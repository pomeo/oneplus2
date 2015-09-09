'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SettingsSchema = new Schema();

SettingsSchema.add({
  property    : { type: String, index: true }, // свойство
  value       : String, // значение свойства
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
}, {
  _id: false
});

mongoose.model('Settings', SettingsSchema);
