var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var SettingsSchema = new Schema();

SettingsSchema.add({
  property    : { type: String, index: true }, // свойство
  value       : String, // значение свойства
  created_at  : Date, // дата создания
  updated_at  : Date // дата изменения
});

var MailsSchema = new Schema();

MailsSchema.add({
  from        : { type: String, index: true }, // откого
  to          : { type: String, index: true }, // кому
  subject     : { type: String, index: true }, // тема
  date        : Date,   // дата письма
  html        : String, // html письма
  text        : String, // текст письма
  created_at  : Date,   // дата создания записи
  updated_at  : Date    // дата изменения записи
});

var EmailsForInvitesSchema = new Schema();

EmailsForInvitesSchema.add({
  order       : Number, // номер почты
  mail        : { type: String, unique: true }, // почтовый адрес
  hash        : { type: String, index: true }, // хеш
  equal       : Number, // количество рефереров должно быть
  count       : Number, // количество рефереров на данный момент
  ref         : { type: String, index: true }, // реферальный код
  confirm     : Boolean, // подтверждённый адрес
  used        : Boolean, // использован как реферер
  created_at  : Date, // дата создания
  updated_at  : Date // дата изменения
});

var ChargesSchema = new Schema();

ChargesSchema.add({
  insalesid        : { type: Number, index: true }, // id магазина
  guid             : { type: Number, index: true }, // id списания
  monthly          : String, // сумма
  till             : String, // заплачено до
  blocked          : Boolean, // заблочен за неуплату
  expired_at       : String, // окончание триала
  updated_at       : Date, // дата из ответа insales
  created_at       : Date // дата из ответа insales
});

var AppsSchema = new Schema();

AppsSchema.add({
  insalesid   : { type: Number, unique: true }, // id магазина
  insalesurl  : String, // урл магазина
  token       : String, // ключ доступа к api
  autologin   : String, // сохраняется ключ автологина
  settings    : [SettingsSchema], // настройки приложения
  created_at  : Date, // дата создания записи
  updated_at  : Date, // дата изменения записи
  blocked     : Boolean, // блокировка за неуплату
  enabled     : Boolean // установлено или нет приложение для магазина
});

module.exports = {
  Apps: mongoose.model('Apps', AppsSchema),
  Chrg: mongoose.model('Charges', ChargesSchema),
  Mail: mongoose.model('Mails', MailsSchema),
  Emfi: mongoose.model('EmailsForInvites', EmailsForInvitesSchema)
};
