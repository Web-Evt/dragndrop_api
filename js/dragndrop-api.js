/**
 * @file
 *
 */

(function ($) {
  Drupal.behaviors.dragndropUploadAPI = {
    attach: function (context, settings) {
      $.each(settings.dragndropAPI, function (selector, settings) {
        var $droppable = $(selector);
        var dnd = $droppable.DnD(settings);

        $droppable.bind('dnd:showErrors', showErrors);

//        var fileAddedCallback = function (event, file) {
//          $(event.target).html(file.file.name);
//          $droppable.DnD().send();
//        };
//        $droppable.bind('dnd:addFiles:added', fileAddedCallback);
//
//        $droppable.bind('dnd:send:success', function (event, response) {
//          alert(response);
//        });
//
//        $droppable.bind('dnd:validateFile', function (event, file, filesList) {
//          file.error = "Some error occured";
//        });
//
//        $droppable.bind('dnd:showErrors', function (event, messages) {
//          $(event.target).html(messages.join());
//        });
      });
    }
  };

  /**
   * Default showErrors callback for DnD.
   *
   * @param event
   * @param errors
   */
  var showErrors = function (event, errors) {
    alert(errors.join());
  };

})(jQuery);
