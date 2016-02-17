var npm = require('npm'),
    Promise = require('bluebird'),
    BaseFetcher = require('./BaseFetcher.js'),
    inherits = require('inherits'),
    _ = require('underscore'),
    futils = require('./fetcherUtils.js'),
    email_parse = require('email-addresses'),
    fs = Promise.promisifyAll(require('fs-extra')),
    child_process = require('child_process'),
    path = require('path'),
    tmp = require('tmp');

// NPM LOCATION SPEC:
// Full: npm+user:pass@registry.com/package/package_id$semver
// Minimal: npm+package_id$version_id

var NpmFetcher = function(config) {
  NpmFetcher.super_.apply(this, arguments);
  this._npm_ready = new Promise(function(resolve, reject) {
    npm.load(_.extend({}, config || {}, {
      loglevel: 'silent'
    }), function(err) {
      if(err) return reject(err);
      return resolve();
    });
  });
  this.config = config;
};

inherits(NpmFetcher, BaseFetcher);

NpmFetcher.prototype.resolveFetcher = function(locator) {
  return NpmFetcher.super_.prototype.resolveFetcher.apply(this, arguments).then(function(locator) {
    // resolve fetcher
    if(typeof locator.fetcher.value !== "string" || locator.fetcher.value.toLowerCase() != "npm") throw new Error("NPM resolution attempted on non-NPM locator.");
    locator.fetcher = {
      value: 'npm',
      full: 'npm',
      resolved: true
    };
    return locator;
  });
};

/**
 * Resolve an NPM package to spec.
 */
NpmFetcher.prototype.resolvePackage = function(locator, force_resolve) {
  var self = this;
  return Promise.all([NpmFetcher.super_.prototype.resolvePackage.apply(this, arguments), this._npm_ready]).spread(function doResolve(locator) {
    if(!locator.package.value || (!force_resolve && locator.package.value && locator.package.resolved)) {
      return locator; // if package is null or already resolved, skip resolution
    }
    // TODO: parse urls, registry formats, auth, etc...
    var npm_match = (/(?:www\.|)npmjs\.(?:com|org)\/(?:package\/|)([a-z0-9\-]+)/ig).exec(locator.package.value);
    if(npm_match && npm_match.length > 1) {
      locator.package = npm_match[1];
      // todo: match registry URL also
    }
    return self.fetchPackage(locator.package.value).then(function(data) {
      locator.package = {
        value: data.title,
        full: data.title,
        resolved: true,
        metadata: data
      };
      return locator;
    });
   }).then(function(locator) {
    // catch unresolved packages
     if(!locator.package.value || !locator.package.resolved) throw new Error("No package found with spec: " + locator);
     return locator;
  });
};

function npm_view(package_spec) {
  var args = [];
  for(var i=0; i<arguments.length; i++) {
    args.push(arguments[i]);
  }
  return new Promise(function(resolve, reject) {
    try {
      npm.commands.view(args, true, function(err, data) {
        if(err) return reject(err);
        return resolve(data);
      });
    } catch (e) {
      return reject(new Error("Invalid NPM package: " + package_spec));
    }
  });
};

NpmFetcher.prototype.fetchPackage = function(package_spec) {
  return npm_view(package_spec, "name", "versions", "description", "repository", "homepage", "url", "bugs", "dist-tags.latest", "author", "maintainers").then(function(data) {
    if(!data) return data;
    data = data[Object.keys(data)[0]]; // explore version fetched
    if(!data) throw new Error("Invalid data returned from NPM.");
    var formatted_data = {
      title: data.name,
      url: data.homepage || (data.bugs ? data.bugs.url : null) || (data.repository ? data.repository.url : null),
      description: data.description,
      revisions: [],
      head: {
        revision_id: data["dist-tags.latest"]
      },
      authors: _.map(data.maintainers, function(bundle) {
        return bundle.email;
      })
    };

    for(var i=0; i<data.versions.length; i++) {
      formatted_data.revisions.push({
        revision_id: data.versions[i],
        position: i
      });
    }
    return formatted_data;
  });
};

NpmFetcher.prototype.resolveRevision = function(locator, force_resolve) {
  return NpmFetcher.super_.prototype.resolveRevision.apply(this, arguments).then(function(locator) {
    return npm_view(locator.package.value + '@' + (locator.revision.value || 'latest'), "version").then(function(data) {
      var revision = Object.keys(data)[0];
      if(data) {
        locator.revision = {
          value: revision,
          full: revision,
          resolved: true,
          metadata: data
        };
      } else {
        throw new Error("Invalid data returned from NPM.");
      }
      return locator;
    });
  });
};

NpmFetcher.prototype.fetchRevision = function(revision_spec) {

};

NpmFetcher.prototype._defaultLocator = function(locator) {
  locator = NpmFetcher.super_.prototype._defaultLocator.apply(this, arguments);
  if(locator.package.value) {
    // TODO: establish package source defaults
  }
  return locator;
};

NpmFetcher.prototype.download = function(locator, directory) {
  return Promise.join(NpmFetcher.super_.prototype.download.apply(this, arguments), this._npm_ready).spread(function(locator) {
    var old_cwd = process.cwd();
    return new Promise(function(resolve, reject) {
      tmp.dir({ unsafeCleanup: true }, function(err, tar_dir, cleanup) {
        if(err) return reject(err);
        // Download/unpack in temp dir.
        process.chdir(tar_dir);
        npm.commands.pack([locator.package.value + '@' + (locator.revision.value || "*")], true, function(err, fname) {
          if(err) return reject(err);
          var dir_list = fs.readdirSync(tar_dir);
          if(dir_list.length == 0) return reject(new Error("Error writing package from NPM registry."));
          // use gtar -- GNU Tar, as --warning isn't available on BSD tar. --strip-components strips package/, which is the top directory for all node tars
          child_process.exec("gtar -xf " + path.join(tar_dir, dir_list[0]) + " -C " + directory + " --warning=none --strip-components=1", function(err, stdout, stderr) {
            if (err || stderr) {
              var acceptableError = _.chain(stderr.split("\n"))
              .compact()
              .isEqual([
                "gzip: (stdin): trailing garbage ignored",
                "gtar: Child returned status 1",
                "gtar: Error is not recoverable: exiting now"
              ]);
              if (acceptableError) {
                resolve();
              } else {
                reject(err || stderr);
              }
            } else {
              resolve();
            }
            cleanup();
          });
        });
      });
    })
    .finally(process.chdir.bind(process, old_cwd));
  });
};

module.exports = NpmFetcher;
