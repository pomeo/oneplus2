'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PaymentsSchema = new Schema({
  paymentId   : { type: String, index: true },
  token       : { type: String, index: true },
  PayerID     : { type: String, index: true },
  email       : { type: String, index: true },
  notes       : String,
  state       : String,
  invite      : Boolean,
  created_at  : { type: Date, default: Date.now }, // дата создания
  updated_at  : { type: Date, default: Date.now } // дата изменения
});

mongoose.model('Payments', PaymentsSchema);
