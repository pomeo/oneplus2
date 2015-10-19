'use strict';
$(document).ready(function() {
  var urlParams;
  (window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query)) {
      urlParams[decode(match[1])] = decode(match[2]);
    }
  })();
  setInterval(function() {
    if (window.location.pathname.substr(1) === 'return') {
      $.ajax({
        type: 'POST',
        url: '/check',
        dataType: 'json',
        data: {
          paymentId: urlParams.paymentId
        },
        success: function(msg) {
          if (msg.url) {
            window.location = msg.url;
          }
        }
      });
    }
  }, 3000);
});
