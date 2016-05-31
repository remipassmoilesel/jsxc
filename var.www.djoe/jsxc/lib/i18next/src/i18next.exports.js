// Export the i18next object for **CommonJS**. 
// If we're not in CommonJS, add `i18n` to the
// global object or to jquery.
if (typeof module !== 'undefined' && module.exports) {
    if (!$) {
      try {
        $ = require('jquery');
      } catch(e) {
        // just ignore
      }
    }
    if ($) {
        $.i18n = $.i18n || i18n;
    }
    module.exports = i18n;
} else {
    if ($) {
        $.i18n = $.i18n || i18n;
    }
    
    root.i18n = root.i18n || i18n;
}