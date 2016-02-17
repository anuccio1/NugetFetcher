var expect = require('expect.js'),
    Locator = require('../../../modules/fetchers/Locator.js'),
    Fetchers = require('../../../modules/fetchers/'),
    _ = require('underscore'),
    Promise = require('bluebird');

describe('NpmFetcher', function() {
  var fetcher = Fetchers.fetchers.npm;

  it("should resolve a full NPM locator", function(done) {
    fetcher.resolve("npm+async$latest").then(function(locator) {
      expect(locator.fetcher.resolved).to.be(true);
      expect(locator.package.resolved).to.be(true);
      expect(locator.revision.resolved).to.be(true);
      expect(locator.revision.value).to.not.be('latest'); //revision should have been resolved
      done();
    }, done);
  });

  it("should error when given a non-npm locator", function(done) {
    fetcher.resolve("git+http://github.com/caolan/async.git$8a08170e43ba3cf379475dbcef97e940477731e4").then(function(){
      throw new Error("Should have errored.");
    }, function(err) {
      expect(err.message).to.be("NPM resolution attempted on non-NPM locator.");
      done();
    });
  });

  it("should resolve a partial NPM locator", function(done) {
    fetcher.resolve("npm+async").then(function(locator) {
      expect(locator.fetcher.resolved).to.be(true);
      expect(locator.package.resolved).to.be(true);
      expect(locator.revision.resolved).to.be(true);
      expect(locator.revision.value).to.not.be('latest'); //revision should have been resolved
      done();
    }, done);
  });

  it("should error on a nonexistient package", function(done) {
    fetcher.resolve("npm+nonexistient_package").then(function(locator) {
      throw new Error("package should not have been resolved.");
    }, function(err) {
      done();
    });
  });

  it("should correctly fetch and process authors", function(done) {
    fetcher.resolve("npm+async$1.5.0").then(function(locator) {
      expect(locator.fetcher.resolved).to.be(true);
      expect(locator.package.resolved).to.be(true);
      expect(locator.revision.resolved).to.be(true);
      expect(
        _.difference(
          ['caolan.mcmahon@gmail.com','beau@beaugunderson.com','alexander.early@gmail.com','megawac@gmail.com'],
          locator.package.metadata.authors
        ).length
      ).to.be(0);
      done();
    }, done);
  });

  it("should work on the following cases", function(done) {
    Promise.join(fetcher.resolve("npm+node"), fetcher.resolve("npm+utf8-byte-length"), fetcher.resolve("npm+tape")).spread(function(l1, l2) {
      return done();
    });
  });
});
