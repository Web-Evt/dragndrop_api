/**
 * DnD magic.
 *
 * @param {jQuery} droppable
 *  jQuery object of droppable areas.
 * @param {Object} settings
 *
 * Each droppable area has these events:
 *  dnd:addFiles:added
 *    Arguments: dndFile
 *
 *  dnd:addFiles:finished
 *    Arguments: filesList
 *
 *  dnd:createPreview
 *    Arguments: dndFile
 *
 *  dnd:removePreview
 *    Arguments: dndFile
 *
 *  dnd:validateFile
 *    Arguments: dndFile
 *
 *  dnd:showErrors
 *    Arguments: dndFile
 *
 *  dnd:removeFile
 *    Arguments: dndFile
 *
 *  dnd:removeFile:empty
 *    Arguments: <none>
 *
 *  dnd:send:form
 *    Arguments: form
 *
 *  dnd:send:beforeSend
 *    Arguments: xmlhttprequest, options
 *
 *  dnd:send:success
 *    Arguments: response, status
 *
 *  dnd:send:complete
 *    Arguments: response, status
 *
 *  dnd:send:options
 *    Arguments: options
 */
function DnD(droppable, settings) {
  this.$droppable = jQuery(droppable);
  this.settings = settings;
  this.attachEvents();
}

(function ($) {
  // Get plain jQuery version and check whether is needed to apply data trick in
  // ajax options.
  var jQueryVersion = parseInt($.fn.jquery.split('.').join(''));
  var applyDataTrick = jQueryVersion < 150;

  DnD.prototype = {
    $droppable: null,
    $activeDroppable: null,
    settings: {},

    /**
     * Attach events to the given droppable areas.
     */
    attachEvents: function () {
      var me = this;
      $.each(this.$droppable, function (i, droppable) {
        droppable.ondrop = me.eventsList.drop.bind(me);
        droppable.ondragover = me.eventsList.dragover.bind(me);
        droppable.ondragleave = me.eventsList.dragleave.bind(me);
      });

      // Attach event to create a preview when a file is added.
      this.$droppable.bind('dnd:addFiles:added', this.createPreview);

      // Add default validators.
      var validators = this.settings.validators;
      if (validators.maxSize) {
        this.$droppable.bind('dnd:validateFile', this.validatorsList.fileSize);
      }

      if (validators.extensions) {
        this.$droppable.bind('dnd:validateFile', this.validatorsList.fileExt);
      }

      if (this.settings.cardinality != -1) {
        this.$droppable.bind('dnd:validateFile', this.validatorsList.filesNum);
      }
    },

    eventsList: {
      /**
       * Fires when file was dropped in the droppable area.
       *
       * @param event
       */
      drop: function (event) {
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
      dragover: function (event) {
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
      dragleave: function (event) {
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
              '%ext': ext
            }
          };
        }
      },

      filesNum: function (event, dndFile, filesList) {
        var settings = $(this).DnD().settings;

        if (filesList.length > settings.cardinality) {
          dndFile.error = {
            type: 'filesNum',
            args: {
              '%number': filesList.length
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
         *  - dndFile {Object}: dropped dndFile object.
         *  - $preview {jQuery|null}: preview object.
         *  - errorStatus {Boolean}: whether dndFile pass validation or not.
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
      }

      // Trigger the event telling that all files have been added.
      $droppable.trigger('dnd:addFiles:finished', [transFiles]);
    },

    /**
     * Create previews of dropped files.
     *
     * @param dndFile
     */
    createPreview: function (dndFile) {
      var reader = new FileReader();
      var me = this;

      reader.onload = function () {
        // Give others an ability to build a preview for a dndFile.
        // Trigger event for all droppables. Each one should decide what to do
        // accodring to the $droppable reference in the dndFile object.
        me.$droppable.trigger('dnd:createPreview', [dndFile]);
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
      this.$droppable.trigger('dnd:removePreview', [dndFile]);
    },

    /**
     * Validate dndFile by given function.
     *
     * @param dndFile
     * @param filesList
     *  Array of files already dropped.
     *
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

      $.each(droppedFiles, function (index, eachFile) {
        if (dndFile == eachFile) {
          droppedFiles.splice(index, 1);
          me.removePreview(dndFile);
        }
      });

      me.setFilesList(droppedFiles);

      // Trigger an event telling that dndFile has been removed.
      this.$droppable.trigger('dnd:removeFile', [dndFile]);
      if (!droppedFiles.length) {
        this.$droppable.trigger('dnd:removeFile:empty');
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
     * @returns {*|Array}
     */
    getFilesList: function () {
      return this.$droppable.data('files') || [];
    },

    /**
     * Get files list of the droppable area.
     *
     * @param filesList
     */
    setFilesList: function (filesList) {
      filesList = filesList || [];
      this.$droppable.data('files', filesList);
    },

    /**
     * Send files.
     */
    send: function ($droppable) {
      var me = this;
      $droppable = $droppable || this.$droppable;

      var filesList = this.getFilesList();
      if (!filesList.length) {
        return;
      }

      var form = new FormData();

      // Append filesList to the form.
      $.each(filesList, function (index, dndFile) {
        // jQuery().is() is not working?
        // Add to the form only files from the provided droppable area.
        $droppable.each(function (i, el) {
          if (el === dndFile.$droppable[0]) {
            form.append(me.settings.name, dndFile.file);
          }
        });
      });

      // Give an ability to add data to the form.
      $droppable.trigger('dnd:send:form', [form]);

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

          $droppable.trigger('dnd:send:beforeSend', [xmlhttprequest, options]);
        },
        success: function (response, status) {
          $droppable.trigger('dnd:send:success', [response, status]);
        },
        complete: function (response, status) {
          $droppable.trigger('dnd:send:complete', [response, status]);
        }
      };

      // Set data for the request, if was not set in the beforeSend
      // callback (jQuery version is 1.5.0 or higher).
      if (!applyDataTrick) {
        options.data = form;
      }

      // Give an ability to modify ajax options before sending request.
      $droppable.trigger('dnd:send:options', [options]);

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
    var dnd = this.data('dnd');
    if (!dnd) {
      this.data('dnd', new DnD(this, settings));
    }

    return dnd;
  };
})(jQuery);
