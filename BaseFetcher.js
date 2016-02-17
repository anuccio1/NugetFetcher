var Promise = require('bluebird'),
    _ = require('underscore'),
    Locator = require('./Locator.js');

/**
 * Base fetcher class that implements resolution boilerplate.
 * @param {} config
 */
var BaseFetcher = function(config) {
  // Override
};

/**
 * Resolve all locator components.
 * @param {(Object|string)} locator
 * @returns {Promise} resolves to a full locator
 */
BaseFetcher.prototype.resolve = function(locator) {
  return this.resolveFetcher(locator).then(this.resolvePackage.bind(this)).then(this.resolveRevision.bind(this));
};

/**
 * Resolve Locator.fetcher
 * @param {Locator} locator
 * @param {Boolean} force_resolve force resolution regardless of if Locator component is resolved
 * @returns {Promise} which resolves into a Locator
 */
BaseFetcher.prototype.resolveFetcher = function(locator, force_resolve) {
  return Promise.method(this._defaultLocator)(locator).then(function(locator) {
    if(!locator.fetcher) throw new Error("No Fetcher Specified.");
    return locator;
  });
};

/**
 * Resolve Locator.package
 * @param {Locator} locator
 * @param {Boolean} force_resolve force resolution regardless of if Locator component is resolved
 * @returns {Promise} which resolves into a Locator
 */
BaseFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  return Promise.method(this._defaultLocator)(locator);
};

/**
 * Resolve Locator.revision
 * @param {Locator} locator
 * @param {Boolean} force_resolve force resolution regardless of if Locator component is resolved
 * @returns {Promise} which resolves into a Locator
 */
BaseFetcher.prototype.resolveRevision = function(locator, force_resolve) {
  return Promise.method(this._defaultLocator)(locator);
};

BaseFetcher.prototype.fetchPackage = function() {

};

BaseFetcher.prototype.fetchRevision = function() {

};

/**
 * Download
 * @param {Locator} locator
 * @param {string} directory to write download to
 * @returns {Promise}
 */
BaseFetcher.prototype.download = function(locator, directory) {
  return this.resolve(locator);
};



/**
 * Synchronous function to set locator defaults/validation.
 * @param {Locator} locator
 * @returns {Locator} locator w/ set defaults
 */
BaseFetcher.prototype._defaultLocator = function(locator) {
  if(!(locator instanceof Locator)) {
    return new Locator(locator);
  }
  return locator;
};

module.exports = BaseFetcher;

// instead of metadata we can add more functions like fetchPackage and fetchRevision
