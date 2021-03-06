'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SettingsSchema = new Schema({
  property    : { type: String, index: true }, // свойство
  value       : String, // значение свойства
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
});

mongoose.model('Settings', SettingsSchema);
