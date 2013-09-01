/**
 * @file
 * Contains behavior to initialize DnD instances.
 */

(function ($) {
  Drupal.behaviors.dragndropUploadAPI = {
    attach: function (context, settings) {
      if (!settings.dragndropAPI) {
        return;
      }

      $.each(settings.dragndropAPI, function (selector, settings) {
        $(selector, context).once('dnd-api', function () {
          var $droppable = $(this);

          var dnd;
          // Check if a droppable is a mirror.
          if (settings.asMirrorFor) {
            // Try to get DnD instance.
            dnd = $(settings.asMirrorFor);
            // Add the event callback only if droppable is found.
            if (dnd.size()) {
              // Add an event callback for adding a droppable, because may be
              // the mirrored droppable does not exist yet, so act when it is
              // initiated.
              dnd.one('dnd:init', function () {
                $(this).DnD().addDroppable($droppable);
              });
            }
            // Main droppable area is not found, so remove the processed class.
            else {
              $droppable.removeClass('dnd-api-processed');
            }
          }
          // Otherwise just create a new droppable instance.
          else {
            dnd = $droppable.DnD(settings);
            $droppable.bind('dnd:showErrors', showErrors);
          }
        });
      });
    },

    detach: function (context, settings) {
      if (settings.dragndropAPI) {
        $.each(settings.dragndropAPI, function (selector) {
          var $droppable = $(selector, context);
          var dnd = $droppable.DnD();
          if (dnd) {
            $droppable.removeClass('dnd-api-processed');
            dnd.removeDroppable($droppable);
          }
        });
      }
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
