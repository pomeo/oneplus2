'use strict';
$(document).ready(function() {
  var ebay = setInterval(function() {
    if ($('.an-fb').length) {
      clearInterval(ebay);
      $('.an-fb').addClass('uk-hidden-touch');
    }
  }, 1000);
  console.log('ready!');
});
