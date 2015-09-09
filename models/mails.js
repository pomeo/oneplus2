'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MailsSchema = new Schema({
  from        : { type: String, index: true }, // откого
  to          : { type: String, index: true }, // кому
  subject     : { type: String, index: true }, // тема
  date        : Date,   // дата письма
  html        : String, // html письма
  text        : String, // текст письма
  created_at  : { type: Date, default: Date.now },   // дата создания записи
  updated_at  : { type: Date, default: Date.now }    // дата изменения записи
});

mongoose.model('Mails', MailsSchema);
