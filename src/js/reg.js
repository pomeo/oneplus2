'use strict';
$('#iframe').submit(() => {
  $('#iframe').ajaxSubmit({
    success: () => {
      $.UIkit.notify('Created new account', {
        pos: 'bottom-left',
        timeout: 5000
      });
    }
  });
  return false;
});
