/**
 * This namespace handles the Notification API.
 *
 * @namespace jsxc.notification
 */
jsxc.notification = {

  /** Current audio file. */
  audio : null,

  /**
   * Register notification on incoming messages.
   *
   * @memberOf jsxc.notification
   */
  init : function() {

    $(document).on('postmessagein.jsxc', function(event, bid, msg) {

      msg = (msg && msg.match(/^\?OTR/)) ? jsxc.t('Encrypted_message') : msg;

      var data = jsxc.storage.getUserItem('buddy', bid);

      jsxc.notification.notify({
        title : jsxc.t('New_message_from', {
          name : data.name
        }), msg : msg, soundFile : jsxc.CONST.SOUNDS.MSG, source : bid
      });

    });

  },

  /**
   * Shows a pop up notification and optional play sound.
   *
   * @param title Title
   * @param msg Message
   * @param d Duration
   * @param force Should message also shown, if tab is visible?
   * @param soundFile Playing given sound file
   * @param loop Loop sound file?
   * @param source Bid which triggered this notification
   */
  notify : function(title, msg, d, force, soundFile, loop, source) {

    if (!jsxc.options.notification || !jsxc.notification.hasPermission()) {
      jsxc.debug('Notification triggered, but disabled', {arguments : arguments});
      return;
    }

    var o;

    if (title !== null && typeof title === 'object') {
      o = title;
    } else {
      o = {
        title : title,
        msg : msg,
        duration : d,
        force : force,
        soundFile : soundFile,
        loop : loop,
        source : source
      };
    }

    if (jsxc.hasFocus() && o.force !== true) {
      return; // Tab is visible
    }

    var icon = o.icon || jsxc.options.root + '/img/newgui/desktop-notification.png';

    if (typeof o.source === 'string') {
      var data = jsxc.storage.getUserItem('buddy', o.source);
      var src = jsxc.storage.getUserItem('avatar', data.avatar);

      if (typeof src === 'string' && src !== '0') {
        icon = src;
      }
    }

    jsxc.toNotification = setTimeout(function() {

      if (typeof o.soundFile === 'string') {
        jsxc.notification.playSound(o.soundFile, o.loop, o.force);
      }

      // notifications are hidden
      if (jsxc.notification.isNotificationShowed() !== true) {
        return;
      }

      var popup = new Notification(jsxc.t(o.title), {
        body : jsxc.t(o.msg), icon : icon
      });

      var duration = o.duration || jsxc.options.popupDuration;

      if (duration > 0) {
        setTimeout(function() {
          popup.close();
        }, duration);
      }
    }, jsxc.toNotificationDelay);
  },

  /**
   * Checks if browser has support for notifications and add on chrome to the
   * default api.
   *
   * @returns {Boolean} True if the browser has support.
   */
  hasSupport : function() {
    if (window.webkitNotifications) {
      // prepare chrome

      window.Notification = function(title, opt) {
        var popup = window.webkitNotifications.createNotification(null, title, opt.body);
        popup.show();

        popup.close = function() {
          popup.cancel();
        };

        return popup;
      };

      var permission;
      switch (window.webkitNotifications.checkPermission()) {
        case 0:
          permission = jsxc.CONST.NOTIFICATION_GRANTED;
          break;
        case 2:
          permission = jsxc.CONST.NOTIFICATION_DENIED;
          break;
        default: // 1
          permission = jsxc.CONST.NOTIFICATION_DEFAULT;
      }
      window.Notification.permission = permission;

      window.Notification.requestPermission = function(func) {
        window.webkitNotifications.requestPermission(func);
      };

      return true;
    } else if (window.Notification) {
      return true;
    } else {
      return false;
    }
  },

  /**
   * Ask user on first incoming message if we should inform him about new
   * messages.
   */
  prepareRequest : function() {

    if (jsxc.notice.has('gui.showRequestNotification')) {
      return;
    }

    $(document).one('postmessagein.jsxc', function() {
      setTimeout(function() {
        jsxc.notice.add(jsxc.t('Notifications') + '?', jsxc.t('Should_we_notify_you_'),
            'gui.showRequestNotification');
      }, 1000);
    });
  },

  /**
   * Request notification permission.
   */
  requestPermission : function() {
    window.Notification.requestPermission(function(status) {
      if (window.Notification.permission !== status) {
        window.Notification.permission = status;
      }

      if (jsxc.notification.hasPermission()) {
        $(document).trigger('notificationready.jsxc');
      } else {
        $(document).trigger('notificationfailure.jsxc');
      }
    });
  },

  /**
   * Check permission.
   *
   * @returns {Boolean} True if we have the permission
   */
  hasPermission : function() {
    return window.Notification.permission === jsxc.CONST.NOTIFICATION_GRANTED;
  },

  /**
   * Plays the given file.
   *
   * @memberOf jsxc.notification
   * @param {string} soundFile File relative to the sound directory
   * @param {boolean} loop True for loop
   * @param {boolean} force Play even if a tab is visible. Default: false.
   */
  playSound : function(soundFile, loop, force) {
    if (!jsxc.master) {
      // only master plays sound
      return;
    }

    if (jsxc.notification.isSoundMuted() === true) {
      return;
    }

    if (jsxc.hasFocus() && !force) {
      // tab is visible
      return;
    }

    // stop current audio file
    jsxc.notification.stopSound();

    var audio = new Audio(jsxc.options.root + '/sound/' + soundFile);
    audio.loop = loop || false;

    //TODO: some browsers (Android Chrome, ...) want a user interaction before trigger play()
    audio.play();

    jsxc.notification.audio = audio;
  },

  /**
   * Stop/remove current sound.
   *
   * @memberOf jsxc.notification
   */
  stopSound : function() {
    var audio = jsxc.notification.audio;

    if (typeof audio !== 'undefined' && audio !== null) {
      audio.pause();
      jsxc.notification.audio = null;
    }
  },

  /**
   * Mute sound.
   *
   * @memberOf jsxc.notification
   * @param {boolean} external True if triggered from external tab. Default:
   *        false.
   */
  muteSound : function(external) {
    if (external !== true) {
      jsxc.options.set('muteNotification', true);
    }
  },

  /**
   * Unmute sound.
   *
   * @memberOf jsxc.notification
   * @param {boolean} external True if triggered from external tab. Default:
   *        false.
   */
  unmuteSound : function(external) {
    if (external !== true) {
      jsxc.options.set('muteNotification', false);
    }
  },

  /**
   * Return true if sound is muted
   */
  isSoundMuted : function() {
    return jsxc.options && jsxc.options.get('muteNotification');
  },

  /**
   * Return true if notifications are showed
   */
  isNotificationShowed : function() {
    return jsxc.options && jsxc.options.get('hideNotification') !== true &&
        jsxc.notification.hasPermission();
  },

  /**
   * Hide notifications.
   *
   * @memberOf jsxc.notification
   * @param {boolean} external True if triggered from external tab. Default:
   *        false.
   */
  hideNotifications : function(external) {
    if (external !== true) {
      jsxc.options.set('hideNotification', true);
    }
  },

  /**
   * Show notifications. It just set flag.
   *
   * If desktop notifications are disabled in browser nothing will be done.
   *
   * @memberOf jsxc.notification
   * @param {boolean} external True if triggered from external tab. Default:
   *        false.
   */
  showNotifications : function(external) {
    if (external !== true) {
      jsxc.options.set('hideNotification', false);
    }
  }

};
