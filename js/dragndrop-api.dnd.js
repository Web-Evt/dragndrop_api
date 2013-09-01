/**
 * @file
 * Contains DnD class.
 *
 * @param {jQuery} droppable
 *  jQuery object of droppable areas.
 * @param {Object} settings
 *
 * Each droppable area has these events:
 *
 *  dnd:addFiles:before
 *    Arguments: event
 *
 *  dnd:addFiles:added
 *    Arguments: event, dndFile
 *
 *  dnd:addFiles:after
 *    Arguments: event, filesList
 *
 *  dnd:createPreview
 *    Arguments: event, dndFile, {FileReader} reader
 *
 *  dnd:removePreview
 *    Arguments: event, dndFile
 *
 *  dnd:validateFile
 *    Arguments: event, dndFile
 *
 *  dnd:showErrors
 *    Arguments: event, dndFile
 *
 *  dnd:removeFile
 *    Arguments: event, dndFile
 *
 *  dnd:removeFile:empty
 *    Arguments: event
 *
 *  dnd:send:form
 *    Arguments: event, form
 *
 *  dnd:send:beforeSend
 *    Arguments: event, xmlhttprequest, options, sentFiles
 *
 *  dnd:send:success
 *    Arguments: response, status, sentFiles
 *
 *  dnd:send:complete
 *    Arguments: response, status, sentFiles
 *
 *  dnd:send:options
 *    Arguments: event, options
 *
 *  dnd:send:init
 *    Arguments: event
 *
 *  dnd:destroy:before
 *    Arguments: event
 *
 *  dnd:destroy:after
 *    Arguments: event
 */
function DnD(droppable, settings) {
  this.$droppables = jQuery();
  this.settings = settings;

  this.addDroppable(droppable);
}

(function ($) {
  // Get plain jQuery version and check whether is needed to apply data trick in
  // ajax options.
  var jQueryVersion = parseInt($.fn.jquery.split('.').join(''));
  var applyDataTrick = jQueryVersion < 150;

  DnD.prototype = {
    $droppables: null,
    $activeDroppable: null,
    settings: {},

    /**
     * Attach events to the given droppable areas.
     *
     * @param {jQuery} $droppables
     */
    attachEvents: function ($droppables) {
      var me = this;
      $.each($droppables, function (i, droppable) {
        $.each(me.eventsList, function (name, func) {
          droppable[name] = func.bind(me);
        });
      });

      // Attach event to create a preview when a file is added.
      $droppables.bind('dnd:addFiles:added', me.createPreview);

      // Add default validators.
      var validators = me.settings.validators;
      if (validators.maxSize) {
        $droppables.bind('dnd:validateFile', me.validatorsList.fileSize);
      }

      if (validators.extensions) {
        $droppables.bind('dnd:validateFile', me.validatorsList.fileExt);
      }

      if (me.settings.cardinality != -1) {
        $droppables.bind('dnd:validateFile', me.validatorsList.filesNum);
      }

      /**
       * Add an event callback to remove from DnD files that have been sent.
       */
      $droppables.bind('dnd:send:beforeSend', function (event, response, status, sentFiles) {
        me.removeFiles(sentFiles);
      });
    },

    /**
     * Detach events from the given droppable areas.
     *
     * @param {jQuery} $droppables
     */
    detachEvents: function ($droppables) {
      var me = this;

      $.each($droppables, function (i, droppable) {
        $.each(me.eventsList, function (name, func) {
          droppable[name] = null;
        });
      });

      // Attach event to create a preview when a file is added.
      $droppables.unbind('dnd:addFiles:added', me.createPreview);

      // Add default validators.
      var validators = me.settings.validators;
      if (validators.maxSize) {
        $droppables.unbind('dnd:validateFile', me.validatorsList.fileSize);
      }

      if (validators.extensions) {
        $droppables.unbind('dnd:validateFile', me.validatorsList.fileExt);
      }

      if (me.settings.cardinality != -1) {
        $droppables.unbind('dnd:validateFile', me.validatorsList.filesNum);
      }
    },

    eventsList: {
      /**
       * Fires when file was dropped in the droppable area.
       *
       * @param event
       */
      ondrop: function (event) {
        // Prevent drop event from bubbling through parent elements.
        event.stopPropagation();
        event.preventDefault();

        var transFiles = event.dataTransfer.files;
        if (transFiles.length == 0) {
          return;
        }

        var $dropppable = $(event.currentTarget);
        $dropppable.removeClass('drag-over').addClass('dropped');

        this.addFiles($dropppable, transFiles);
      },

      /**
       * Fires every time when file is under the droppable area.
       *
       * @param event
       */
      ondragover: function (event) {
        // Prevent the event from bubbling through parent elements.
        event.stopPropagation();
        event.preventDefault();

        $(event.target).addClass('drag-over');
      },

      /**
       * Fires when file was leave the droppable area.
       *
       * @param event
       */
      ondragleave: function (event) {
        // Prevent the event from bubbling through parent elements.
        event.stopPropagation();
        event.preventDefault();

        $(event.target).removeClass('drag-over');
      }
    },

    validatorsList: {
      fileSize: function (event, dndFile) {
        var settings = $(this).DnD().settings;
        if (dndFile.file.size > settings.validators.maxSize) {
          dndFile.error = {
            type: 'fileSize',
            args: {
              '%filename': dndFile.file.name,
              '%filesize': dndFile.file.size
            }
          };
        }
      },

      fileExt: function (event, dndFile) {
        var settings = $(this).DnD().settings;
        var ext = dndFile.file.name.split('.').pop();
        var isValid = false;

        $.each(settings.validators.extensions, function (index, allowedExt) {
          if (allowedExt == ext) {
            isValid = true;
            return false;
          }
        });

        if (!isValid) {
          dndFile.error = {
            type: 'fileExt',
            args: {
              '%filename': dndFile.file.name,
              '%allowed': settings.validators.extensions.join(','),
              '%ext': ext
            }
          };
        }
      },

      filesNum: function (event, dndFile, filesList) {
        var settings = $(this).DnD().settings;

        if (filesList.length >= settings.cardinality) {
          dndFile.error = {
            type: 'filesNum',
            args: {
              '%filename': dndFile.file.name,
              '%number': filesList.length,
              '%allowed': settings.cardinality
            }
          };
        }
      }
    },

    /**
     * Add files to the droppable area.
     *
     * @param {jQuery} $droppable
     *  A droppable area that should receive files.
     * @param {Array} transFiles
     *  Array of files that should be added to the dropppable area.
     */
    addFiles: function ($droppable, transFiles) {
      var dndFile, errors = [], filesList = this.getFilesList();
      
      $droppable.trigger('dnd:addFiles:before');

      for (var i = 0, n = transFiles.length; i < n; i++) {
        dndFile = {
          file: transFiles[i],
          $droppable: $droppable,
          $preview: null,
          error: null
        };

        this.validateFile(dndFile, filesList);
        if (dndFile.error) {
          errors.push(dndFile.error);
          continue;
        }

        filesList.push(dndFile);

        /**
         * Each dndFile have:
         *  - file {Object}: dropped file object.
         *  - $droppable {jQuery|null}: preview object.
         *  - $preview {jQuery|null}: preview object.
         *  - error {String}: error message if present.
         *
         * @type {Array}
         */
        this.setFilesList(filesList);

        // Trigger event telling that dndFile has been added.
        $droppable.trigger('dnd:addFiles:added', [dndFile]);
      }

      if (errors.length) {
        this.showErrors($droppable, errors);
        return;
      }

      // Trigger the event telling that all files have been added.
      $droppable.trigger('dnd:addFiles:after', [transFiles]);
    },

    /**
     * Add new droppable zone.
     *
     * @param {string|jQuery} droppable
     */
    addDroppable: function (droppable) {
      var $droppable = $(droppable);
      this.attachEvents($droppable);
      $droppable.data('DnD', this);

      this.$droppables = this.$droppables.add($droppable);

      $droppable.trigger('dnd:init');
    },

    /**
     * Remove droppable zone.
     *
     * @param {string|jQuery} droppable
     */
    removeDroppable: function (droppable) {
      var $droppable = $(droppable);

      $droppable.trigger('dnd:destroy:before', [$droppable]);

      this.detachEvents($droppable);
      $droppable.data('DnD', null);

      this.$droppables = this.$droppables.not($droppable);

      $droppable.trigger('dnd:destroy:after', [$droppable]);
    },

    /**
     * Create previews of dropped files.
     *
     * @param event
     * @param dndFile
     */
    createPreview: function (event, dndFile) {
      var reader = new FileReader();

      reader.onload = function () {
        // Give others an ability to build a preview for a dndFile.
        // Trigger event for all droppables. Each one should decide what to do
        // accodring to the $droppable reference in the dndFile object.
        dndFile.$droppable.trigger('dnd:createPreview', [dndFile, reader]);
      };
      reader.readAsDataURL(dndFile.file);
    },

    /**
     * Remove preview for the dndFile.
     *
     * @param dndFile
     */
    removePreview: function (dndFile) {
      // Give others an ability to remove dndFile preview.
      // Trigger event for all droppables. Each one should decide what to do
      // accodring to the $droppable reference in the dndFile object.
      this.$droppables.trigger('dnd:removePreview', [dndFile]);
    },

    /**
     * Validate dndFile by given function.
     *
     * @param dndFile
     * @param filesList
     *  Array of files already dropped.
     */
    validateFile: function (dndFile, filesList) {
      dndFile.$droppable.trigger('dnd:validateFile', [dndFile, filesList]);
    },

    /**
     * Show errors for the droppable.
     *
     * @param $droppable
     * @param errors
     */
    showErrors: function ($droppable, errors) {
      if (typeof errors != 'object') {
        errors = [errors];
      }

      $droppable.trigger('dnd:showErrors', [errors]);
    },

    /**
     * Remove a dndFile from droppable area.
     *
     * @param dndFile
     *  The dndFile that should be removed.
     */
    removeFile: function (dndFile) {
      var me = this;
      var droppedFiles = me.getFilesList();

      $.each(droppedFiles, function (i, eachFile) {
        if (dndFile == eachFile) {
          droppedFiles.splice(i, 1);
          me.removePreview(dndFile);
          return false;
        }
      });

      me.setFilesList(droppedFiles);

      // Trigger an event telling that dndFile has been removed.
      dndFile.$droppable.trigger('dnd:removeFile', [dndFile]);
      if (!me.getFilesList(dndFile.$droppable).length) {
        dndFile.$droppable.trigger('dnd:removeFile:empty', [dndFile.$droppable]);
      }
    },

    /**
     * Remove dndFiles from the droppable area.
     *
     * @param dndFiles
     *  Files to be removed. Removes all dndFiles if undefined.
     */
    removeFiles: function (dndFiles) {
      var me = this;
      dndFiles = dndFiles || this.getFilesList();

      $.each(dndFiles, function (index, eachFile) {
        me.removeFile(eachFile);
      });
    },

    /**
     * Get files list of the droppable area.
     *
     * $droppable {jQuery} Droppables to get files list from.
     *
     * @returns {*|Array}
     */
    getFilesList: function ($droppables) {
      var list = [];
      if ($droppables) {
        $.each(this.filesList, function (a, dndFile) {
          /**
           * jQuery().is() is not working?
           */
          $.each($droppables, function (b, droppable) {
            if (dndFile.$droppable[0] == droppable) {
              list.push(dndFile);
            }
          });
        });
      }
      else {
        list = this.filesList;
      }
      return list || [];
    },

    /**
     * Get files list of the droppable area.
     *
     * @param filesList
     */
    setFilesList: function (filesList) {
      this.filesList = filesList || [];
    },

    /**
     * Send files.
     */
    send: function ($droppables) {
      var me = this;
      $droppables = $droppables || this.$droppables;
      // Set flag telling that files are sending at the moment.
      me.sending = true;

      var filesList = this.getFilesList($droppables);
      if (!filesList.length) {
        return;
      }

      var form = new FormData();
      var sentFiles = [];

      // Append filesList to the form.
      $.each(filesList, function (index, dndFile) {
        form.append(me.settings.name, dndFile.file);
        // Add dndFile to the sent array to remove later.
        sentFiles.push(dndFile);
      });

      // Give an ability to add data to the form.
      $droppables.trigger('dnd:send:form', [form]);

      /**
       * Save 'dnd:send:complete' and 'dnd:send:success' handlers of the
       * $droppables in a separate variable as the element can be destroyed
       * (or behaviors can be detached) after the ajax request.
       */
      var droppableEvents = $droppables.data('events');
      var completeHandlers = $.extend({}, droppableEvents['dnd:send:complete']);
      var successHandlers = $.extend({}, droppableEvents['dnd:send:success']);

      var options = {
        url: this.settings.url,
        // Trick to overcome jQuery Update dependency.
        // Do not set data here because of incorrent handling of content-type
        // header in jQuery 1.4.4. Instead, set it in the beforeSend callback.
        // data: form,
        cache: false,
        contentType: false,
        processData: false,
        type: 'POST',
        beforeSend: function (xmlhttprequest, options) {
          // Request data must be set here for jQuery version < 1.5.0.
          // See line 339 for the comments.
          if (applyDataTrick) {
            options.data = form;
          }

          $droppables.trigger('dnd:send:beforeSend', [xmlhttprequest, options, sentFiles]);
        },
        success: function (response, status) {
          // Call 'dnd:send:success' handlers that have been saved earlier.
          $.each(successHandlers, function (i, event) {
            event.handler(response, status, sentFiles);
          });
        },
        complete: function (response, status) {
          // Set the flag telling that sending is finished.
          me.sending = false;
          // Call 'dnd:send:complete' handlers that have been saved earlier.
          $.each(completeHandlers, function (i, event) {
            event.handler(response, status, sentFiles);
          });
        }
      };

      /**
       * Set data for the request, if was not set in the beforeSend
       * callback (jQuery version is 1.5.0 or higher).
       */
      if (!applyDataTrick) {
        options.data = form;
      }

      // Give an ability to modify ajax options before sending request.
      $droppables.trigger('dnd:send:options', [options]);

      // Finally, send a request.
      $.ajax(options);
    }
  };

  /**
   * jQuery plugin to help to work with DnD class.
   *
   * @returns {DnD}
   * @constructor
   */
  $.fn.DnD = function (settings) {
    var dnd = this.data('DnD');
    if (!dnd && settings) {
      this.data('DnD', new DnD(this, settings));
    }

    return dnd;
  };
})(jQuery);
