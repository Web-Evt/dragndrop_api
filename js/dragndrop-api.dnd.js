/**
 * DnD magic.
 *
 * @param {jQuery} droppable
 *  jQuery object of droppable areas.
 *  Each area must have an validators function in it.
 *  Eg. $('.droppable').data('validators', [validateFunction1, validateFunction1]);
 * @param {Object} settings
 *
 *  To see how to build validator function @see validateFile.
 */
function DnD(droppable, settings) {
  this.$droppable = jQuery(droppable).eq(0);
  this.settings = settings;
  this.attachEvents();
}

(function ($) {
  // Get plain jQuery version and check whether is needed to apply data trick in
  // ajax options. See line 428 for comments.
  var jQueryVersion = parseInt($.fn.jquery.split('.').join(''));
  var applyDataTrick = jQueryVersion < 150;

  DnD.prototype = {
    $droppable: null,

    /**
     * Attach events to the given droppable areas.
     */
    attachEvents: function () {
      this.$droppable[0].ondrop = this.eventsList.drop.bind(this);
      this.$droppable[0].ondragover = this.eventsList.dragover.bind(this);
      this.$droppable[0].ondragleave = this.eventsList.dragleave.bind(this);

      // Attach event to create a preview when a file is added.
      this.$droppable.bind('dnd:addFiles:added', this.createPreview);
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

        this.$droppable.removeClass('drag-over').addClass('dropped');

        this.addFiles(transFiles);
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

        this.$droppable.addClass('drag-over');
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

        this.$droppable.removeClass('drag-over');
      }
    },

    /**
     * Add files to the droppable area.
     *
     * @param {Array} transFiles
     *  Array of files that should be added to the dropppable area.
     */
    addFiles: function (transFiles) {
      var file, error, messages = [], filesList = this.getFilesList();
      for (var i = 0, n = transFiles.length; i < n; i++) {
        error = this.validateFile(transFiles[i], filesList, this.$droppable.data('validators'));
        if (error !== true) {
          messages.push(error);
          continue;
        }

        file = {
          file: transFiles[i],
          $preview: null,
          errorStatus: !error,
          errorMessage: error
        };
        filesList.push(file);

        /**
         * Each file have:
         *  - file {Object}: dropped file object.
         *  - $preview {jQuery|null}: preview object.
         *  - errorStatus {Boolean}: whether file pass validation or not.
         *  - error {String}: error message if present.
         *
         * @type {Array}
         */
        this.setFilesList(filesList);

        // Trigger event telling that file has been added.
        this.$droppable.trigger('dnd:addFiles:added', file);
      }

      if (messages.length) {
        this.showError(messages);
      }

      // Trigger the event telling that all files have been added.
      this.$droppable.trigger('dnd:addFiles:finished', transFiles);
    },

    /**
     * Create previews of dropped files.
     *
     * @param file
     */
    createPreview: function (file) {
      var reader = new FileReader();
      var me = this;

      reader.onload = function (event) {
        // Give others an ability to build a preview for a file.
        me.$droppable.trigger('dnd:createPreview', file);
      };
      reader.readAsDataURL(file.file);
    },

    /**
     * Remove preview for the file.
     *
     * @param file
     */
    removePreview: function (file) {
      // Give others an ability to remove file preview.
      this.$droppable.trigger('dnd:removePreview', file);
    },

    /**
     * Validate file by given function.
     *
     * @param file
     * @param filesList
     *  Array of files already dropped.
     * @param {Function} validators
     *  Example of validator function.
     *
     *  var validateFunction = function(file) {
         *    var errorMessage = 'Max file size exceed'.
         *    var maxSize = 10000;
         *
         *    return (file.size <= maxSize) ? true : errorMessage;
         *  }
     *
     * @returns {String|Boolean}
     *  Return error message if not valid or True when valid.
     */
    validateFile: function (file, filesList, validators) {
      var validatorsList = [];
      var errorMessage = true;
      validators = validators || [];

      if (typeof validators == 'function') {
        validatorsList.push(validators);
      } else {
        validatorsList = validators;
      }

      // Iterate through all validators functions.
      for (var i = 0, n = validatorsList.length; i < n; i++) {
        errorMessage = validatorsList[i](file, filesList);
        if (errorMessage !== true) {
          return errorMessage;
        }
      }

      return errorMessage;
    },

    /**
     * Show errors for the droppable.
     *
     * @param messages
     */
    showError: function (messages) {
      if (typeof messages != 'object') {
        messages = [messages];
      }

      this.$droppable.trigger('dnd:files:error', messages);
    },

    /**
     * Remove a file from droppable area.
     *
     * @param file
     *  The file that should be removed.
     */
    removeFile: function (file) {
      var me = this;
      var droppedFiles = me.getFilesList();

      $.each(droppedFiles, function (index, eachFile) {
        if (file == eachFile) {
          droppedFiles.splice(index, 1);
          me.removePreview(file);
        }
      });

      me.setFilesList(droppedFiles);

      // Trigger an event telling that file has been removed.
      this.$droppable.trigger('dnd:removeFile', file);
      if (!droppedFiles.length) {
        this.$droppable.trigger('dnd:removeFile:empty');
      }
    },

    /**
     * Remove files from the droppable area.
     *
     * @param files
     *  Files to be removed. Removes all files if undefined.
     */
    removeFiles: function (files) {
      var me = this;
      files = files || this.getFilesList();

      $.each(files, function (index, eachFile) {
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
    send: function () {
      var me = this;
      var $droppable = this.$droppable;
      var filesList = this.getFilesList();
      if (!filesList.length) {
        return;
      }

      var form = new FormData();

      // Append filesList to the form.
      $.each(filesList, function (index, file) {
        form.append(me.settings.name, file.file);
      });

      // Give an ability to add data to the form.
      $droppable.trigger('dnd:send:form', form);

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
      $droppable.trigger('dnd:send:options', options);

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
