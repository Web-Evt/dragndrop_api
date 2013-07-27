/**
 * @file
 * Contains a DnD class,custom DnD jQuery plugin and a behavior-function.
 *
 * Settings are provided via Drupal.settings.dragndrop_upload variable.
 */

(function ($) {
  Drupal.behaviors.dragndropUploadWidget = {
    attach: function (context, settings) {
      $.each(settings.dragndropAPI, function (selector, settings) {
        var $droppable = $(selector);

        var dnd = $droppable.DnD(settings);

        var fileAddedCallback = function (event, file) {
          $droppable.html(file.file.name);
          $droppable.DnD().send();
        };
        $droppable.bind('dnd:addFiles:added', fileAddedCallback);

        $droppable.bind('dnd:send:success', function (event, response) {
          alert(response);
        });
      });
    }
  }
})(jQuery);
