/**
 * Entity Capabilities (XEP-0115)
 *
 * Depends on disco plugin.
 *
 * See: http://xmpp.org/extensions/xep-0115.html
 *
 * Authors: - Michael Weibel <michael.weibel@gmail.com> - Klaus Herberth <klaus@jsxc.org>
 * Copyright: - Michael Weibel <michael.weibel@gmail.com>
 *
 * @license MIT
 */

(function ($) {
    Strophe.addConnectionPlugin('caps', {
        /**
         * Constant: HASH Hash used
         *
         * Currently only sha-1 is supported.
         */
        HASH: 'sha-1',
        /**
         * Variable: node Client which is being used.
         *
         * Can be overwritten as soon as Strophe has been initialized.
         */
        node: 'http://strophe.im/strophejs/',
        /**
         * PrivateVariable: _ver Own generated version string
         */
        _ver: '',
        /**
         * PrivateVariable: _connection Strophe connection
         */
        _connection: null,
        /**
         * PrivateVariable: _knownCapabilities A hashtable containing
         * version-strings and their capabilities, serialized as string.
         *
         * TODO: Maybe those caps shouldn't be serialized.
         */
        _knownCapabilities: JSON.parse(localStorage.getItem('strophe.caps._knownCapabilities')) || {},

        /**
         * PrivateVariable: _jidVerIndex A hashtable containing jids and their
         * versions for better lookup of capabilities.
         */
        _jidVerIndex: JSON.parse(localStorage.getItem('strophe.caps._jidVerIndex')) || {},

        /**
         * Function: init Initialize plugin: - Add caps namespace - Add caps
         * feature to disco plugin - Add handler for caps stanzas
         *
         * Parameters: (Strophe.Connection) conn - Strophe connection
         */
        init: function (conn) {

            this._connection = conn;

            Strophe.addNamespace('CAPS', 'http://jabber.org/protocol/caps');

            if (!this._connection.disco) {
                throw "Caps plugin requires the disco plugin to be installed.";
            }

            this._connection.disco.addFeature(Strophe.NS.CAPS);
            this._connection.addHandler(this._delegateCapabilities.bind(this), Strophe.NS.CAPS);
        },

        /**
         * Function: generateCapsAttrs Returns the attributes for generating the
         * "c"-stanza containing the own version
         *
         * Returns: (Object) - attributes
         */
        generateCapsAttrs: function () {
            return {
                'xmlns': Strophe.NS.CAPS,
                'hash': this.HASH,
                'node': this.node,
                'ver': this.generateVer()
            };
        },

        /**
         * Function: generateVer Returns the base64 encoded version string
         * (encoded itself with sha1)
         *
         * Returns: (String) - version
         */
        generateVer: function () {
            if (this._ver !== "") {
                return this._ver;
            }

            var ver = "", identities = this._connection.disco._identities.sort(this._sortIdentities), identitiesLen = identities.length, features = this._connection.disco._features.sort(), featuresLen = features.length;
            for (var i = 0; i < identitiesLen; i++) {
                var curIdent = identities[i];
                ver += curIdent.category + "/" + curIdent.type + "/" + curIdent.lang + "/" + curIdent.name + "<";
            }
            for (var i = 0; i < featuresLen; i++) {
                ver += features[i] + '<';
            }

            this._ver = b64_sha1(ver);
            return this._ver;
        },

        /**
         * Function: getCapabilitiesByJid Returns serialized capabilities of a jid
         * (if available). Otherwise null.
         *
         * Parameters: (String) jid - Jabber id
         *
         * Returns: (String|null) - capabilities, serialized; or null when not
         * available.
         */
        getCapabilitiesByJid: function (jid) {
            if (this._jidVerIndex[jid]) {
                return this._knownCapabilities[this._jidVerIndex[jid]];
            }
            return null;
        },
        hasFeatureByJid: function (jid, feature) {
            if (this._jidVerIndex[jid] && feature !== null && typeof feature !== 'undefined') {
                if (!$.isArray(feature)) {
                    feature = $.makeArray(feature);
                }

                var i, knownCapabilities;
                knownCapabilities = this._knownCapabilities[this._jidVerIndex[jid]];
                if (!knownCapabilities) {
                    return null;
                }
                for (i = 0; i < feature.length; i++) {
                    if (knownCapabilities['features'].indexOf(feature[i]) < 0) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        },

        /**
         * PrivateFunction: _delegateCapabilities Checks if the version has
         * already been saved. If yes: do nothing. If no: Request capabilities
         *
         * Parameters: (Strophe.Builder) stanza - Stanza
         *
         * Returns: (Boolean)
         */
        _delegateCapabilities: function (stanza) {

            var from = stanza.getAttribute('from'), c = stanza.querySelector('c'), ver = c.getAttribute('ver'), node = c.getAttribute('node');
            if (!this._knownCapabilities[ver]) {
                return this._requestCapabilities(from, node, ver);
            } else {
                this._jidVerIndex[from] = ver;
            }
            if (!this._jidVerIndex[from] || !this._jidVerIndex[from] !== ver) {
                this._jidVerIndex[from] = ver;
            }

            localStorage.setItem('strophe.caps._jidVerIndex', JSON.stringify(this._jidVerIndex));
            $(document).trigger('caps.strophe', [from, this._knownCapabilities[ver], ver]);

            return true;
        },

        /**
         * PrivateFunction: _requestCapabilities Requests capabilities from the
         * one which sent the caps-info stanza. This is done using disco info.
         *
         * Additionally, it registers a handler for handling the reply.
         *
         * Parameters: (String) to - Destination jid (String) node - Node
         * attribute of the caps-stanza (String) ver - Version of the caps-stanza
         *
         * Returns: (Boolean) - true
         */
        _requestCapabilities: function (to, node, ver) {
            if (to !== this._connection.jid) {

                /*
                // Original code: Here id will be always undefined so handler will not work

                var id = this._connection.disco.info(to, node + '#' + ver);
                this._connection.addHandler(this._handleDiscoInfoReply.bind(this), Strophe.NS.DISCO_INFO, 'iq', 'result', id, to);
                */

                var nodeStr = "";
                if(node){
                    nodeStr += node;
                    if(ver){
                        nodeStr += "#" + ver;
                    }
                }

                this._connection.disco.info(to,
                    nodeStr,
                    this._handleDiscoInfoReply.bind(this),
                    function(response){
                        Strophe.warn("Unable to retrieve disco informations", response);
                    }
                );
            }
            return true;
        },

        /**
         * PrivateFunction: _handleDiscoInfoReply Parses the disco info reply and
         * adds the version & it's capabilities to the _knownCapabilities
         * variable. Additionally, it adds the jid & the version to the
         * _jidVerIndex variable for a better lookup.
         *
         * Parameters: (Strophe.Builder) stanza - Disco info stanza
         *
         * Returns: (Boolean) - false, to automatically remove the handler.
         */
        _handleDiscoInfoReply: function (stanza) {

            var query = stanza.querySelector('query');
            var from = stanza.getAttribute('from');
            var node = query.getAttribute('node');
            var ver = (node) ? node.split('#')[1] : this._jidVerIndex[from]; //fix open prosody issue

            if (!this._knownCapabilities[ver]) {
                var childNodes = query.childNodes, childNodesLen = childNodes.length;
                this._knownCapabilities[ver] = {
                    features: [],
                    identities: []
                };

                for (var i = 0; i < childNodesLen; i++) {
                    var node = childNodes[i];
                    if (node.nodeName == 'feature') {
                        this._knownCapabilities[ver]['features'].push(node.getAttribute('var'));
                    } else if (node.nodeName == 'identity') {
                        this._knownCapabilities[ver]['identities'].push(this._attributesToJsObject(node.attributes));
                    } else {
                        if (typeof this._knownCapabilities[ver][node.nodeName] === 'undefined')
                            this._knownCapabilities[ver][node.nodeName] = [];
                        this._knownCapabilities[ver][node.nodeName].push(this._attributesToJsObject(node.attributes));
                    }

                }
                this._jidVerIndex[from] = ver;
            } else if (!this._jidVerIndex[from] || !this._jidVerIndex[from] !== ver) {
                this._jidVerIndex[from] = ver;
            }

            localStorage.setItem('strophe.caps._jidVerIndex', JSON.stringify(this._jidVerIndex));
            localStorage.setItem('strophe.caps._knownCapabilities', JSON.stringify(this._knownCapabilities));
            $(document).trigger('caps.strophe', [from, this._knownCapabilities[ver], ver]);

            return false;
        },

        _attributesToJsObject: function (attr) {
            var obj = {};

            for (i = 0; i < attr.length; i++)
                obj[attr[i].name] = attr[i].value;

            return obj;
        },

        /**
         * PrivateFunction: _sortIdentities Sorts two identities according the
         * sorting requirements in XEP-0115.
         *
         * Parameters: (Object) a - Identity a (Object) b - Identity b
         *
         * Returns: (Integer) - 1, 0 or -1; according to which one's greater.
         */
        _sortIdentities: function (a, b) {
            if (a.category > b.category) {
                return 1;
            }
            if (a.category < b.category) {
                return -1;
            }
            if (a.type > b.type) {
                return 1;
            }
            if (a.type < b.type) {
                return -1;
            }
            if (a.lang > b.lang) {
                return 1;
            }
            if (a.lang < b.lang) {
                return -1;
            }
            return 0;
        }
    });
}(jQuery));
