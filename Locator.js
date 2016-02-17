var _ = require('underscore');

/**
 * Creates a new Locator object to describe how to identify, locate and fetch a source package.
 * @class
 * @classdesc This class handles parsing and string generation only with no validation, in the style of url.parse().
 */
var Locator = function(locator_spec) {
  var props = {}, self = this;

  // set up component field getters/setters
  var keys = ['fetcher', 'package', 'revision'];
  for(var i=0; i<keys.length; i++) {
    props[keys[i]] = { value: null };
    (function(prop){
      Object.defineProperty(self, prop, {
        set: function normalizeComponent(component) {
          var new_prop;
          if(typeof component === "object") {
            new_prop = _.pick(component, "value", "resolved", "metadata", "full");
          }
          props[prop] = _.extend({
            value: null,
            full: null,
            resolved: null,
            metadata: {}
          }, new_prop || { value: component, full: component }); // assign onto fresh hash as other fields are dependent on value
        },
        get: function() {
          return props[prop];
        }
      });
    })(keys[i]);
  }

  Object.defineProperty(self, 'resolved', {
    get: function() {
      for(var i=0; i<keys.length; i++) {
        if(!props[keys[i]].resolved) return false;
      }
      return true;
    }
  });

  // parse initial data
  if(typeof locator_spec === "string") {
    // parse into locator string
    // fetcher+package_spec$rev_spec
    // TODO: encode components to escape reserved `+` and `$`
    var locator_pattern = /^(?:([a-z]+)\+|)([^$]+)(?:\$|)([^$]+|)$/ig;
    var parse_res = locator_pattern.exec(locator_spec) || [];
    this.fetcher = parse_res[1] || null; // xor null to normalize falsy defaults
    this.package = parse_res[2] || null;
    this.revision = parse_res[3] || null;
  } else if(typeof locator_spec === "object" && locator_spec != null) {
    this.fetcher = locator_spec.fetcher || null;
    this.package = locator_spec.package || null;
    this.revision = locator_spec.revision || null;
    this.auth = locator_spec.auth || null;
  }
};

Locator.prototype.toString = Locator.prototype.inspect = function() {
  return (!!this.fetcher.value ? this.fetcher.value + '+' : '') +
    (this.package.value || '') +
    (!!this.revision.value ? '$' + this.revision.value : '');
};

Locator.prototype.toFullString = function () {
  return (!!this.fetcher.value ? (this.fetcher.full || this.fetcher.value) + '+' : '') +
    (this.package.full || this.package.value || '') +
    (!!this.revision.value ? '$' + (this.revision.full || this.revision.value) : '');
};

Locator.prototype.toPackageString = function() {
  return (!!this.fetcher.value ? this.fetcher.value + '+' : '') + (this.package.value || '');
};

Locator.prototype.toParts = function() {
  return {
    fetcher: this.fetcher.value,
    package: this.package.value,
    revision: this.revision.value
  };
}

// Resolve this locator fully. Perhaps separate this from the locator object?
Locator.resolve = function() {
  throw new Error("Resolution not handled by Locator object.");
};

// ### TODO NOTES
// we need some utilities for creating Locators
// 1. common hydration methods to guarantee if we are getting a resolved locator or not
// 2. common parsing and guessing interfaces
// since locators have none of this logic, we should only deal with locators that are headed or from storage w/ the factory interface.

module.exports = Locator;
