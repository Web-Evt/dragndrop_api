/**
 * @file
 *
 */

(function ($) {
  Drupal.behaviors.dragndropUploadAPI = {
    attach: function (context, settings) {
      $.each(settings.dragndropAPI, function (selector, settings) {
        var $droppable = $(selector);
        var dnd;
        // Check if a droppable is a mirror.
        if (settings.asMirrorFor) {
          // Try to get DnD instance.
          dnd = $(settings.asMirrorFor);
          // Add an event callback for adding a droppable, because may be
          // the mirrored droppable does not exist yet, so act when it is
          // initiated.
          dnd.one('dnd:init', function () {
            $(this).DnD().addDroppable($droppable);
          });
        }
        // Otherwise just create a new droppable instance.
        else {
          dnd = $droppable.DnD(settings);
          $droppable.bind('dnd:showErrors', showErrors);
        }
      });
    },

    detach: function (context, settings) {
      $.each(settings.dragndropAPI, function (selector) {
        var $droppable = $(selector);
        var dnd = $droppable.DnD();
        if (dnd) {
          dnd.removeDroppable($droppable);
        }
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
