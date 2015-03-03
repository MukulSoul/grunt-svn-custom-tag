//"use strict";

var util = require('util');
var Q = require('q');
var sprintf = require('sprintf');
var os = require('os');
var exec = require('child_process').exec;

module.exports = function (grunt) {
	grunt.logObject = function (obj) {
		grunt.write.log(util.inspect(obj, false, null));
	};

	grunt.registerMultiTask(
		'svn_bump',
		'Create versioned copies of specified files, placing them into a specified SVN tag folder.',
		function () {
			var task = this;
			var done = task.async();
			Q.try(prepareConfig)
				.then(loadVersions)
				.then(determineNextVersion)
				.then(createVersionFolder)
				.then(importFiles)
				.then(done)
				.fail(function (error) {
					grunt.fatal(error);
				});

			function prepareConfig() {
				var repository;
				grunt.config.merge({
					defaultBump: 'f',
					tagDir:      'tags'
				});
				grunt.config.merge(task.options());
				grunt.config.merge(task.data);
				if (task.args.length > 0) {
					grunt.config('bump', task.args[ 0 ]);
				}
				repository = grunt.config('repository');
				if (!repository) {
					throw grunt.util.error('"repository" option not specified.');
				}
				grunt.config('fullTagDir', sprintf('%s/%s', repository, grunt.config('tagDir')));
			}

			function loadVersions() {
				var command = sprintf('svn ls %s', grunt.config('fullTagDir'));
				return performExec(command).then(function (versions) {
					if (versions.length === 0) {
						grunt.verbose.write('No versions found.\n');
					} else {
						versions = versions.split(/\/\s+/);
						versions.pop();
						grunt.verbose.write('Found tagged versions:\n');
						grunt.verbose.write(versions.join('\n'));
					}
					return versions;
				});
			}

			function determineNextVersion(versions) {
				var deferred = Q.defer();
				var version = findLatestVersion();
				var bump = grunt.config('bump');
				var queryForBump = createUserQuery(
					'What do you wish to bump?\n[G]eneration, [V]ersion, or [F]ix? Or [Enter] for default. Or give an e[X]plicit version. Or [Q]uit.',
					function (input) {
						input = input.toUpperCase();
						if (input.length === 0) {
							input = grunt.config('defaultBump');
						}
						processBumpChoice(input);
					}
				);
				var queryForVersion = createUserQuery(
					'Enter version (e.g. 1.3.0):',
					function (input) {
						if (!isValidVersion(input, versions)) {
							queryForBump();
						} else {
							version = input;
							deferred.resolve(version);
						}
					}
				);
				if (bump) {
					grunt.log.write('Bump already specified. Checking.\n');
					processBumpChoice(bump);
				} else {
					queryForBump();
				}
				return deferred.promise;

				function processBumpChoice(bump) {
					if (/[^GVFXQ]/i.test(bump)) {
						grunt.log.error('Unrecognised value. Please try again.\n');
						queryForBump();
					} else {
						switch (bump) {
							case 'Q':
								grunt.log.write('Quitting\n');
								done();
								break;
							case 'X':
								queryForVersion();
								break;
							default:
								version = bumpVersion(version, bump);
								deferred.resolve(version);
								break;
						}
					}
				}

				function findLatestVersion() {
					var version;
					if (versions.length > 0) {
						version = versions.pop();
					}
					if (version) {
						grunt.log.write('Latest version found is: %s\n', version);
					} else {
						grunt.log.write('Looks like you\'re creating the first build. So let\'s start from 0.0.0\n');
						version = '0.0.0';
					}
					return version;
				}
			}

			function createVersionFolder(version) {
				var folder = sprintf('%s/%s', grunt.config('fullTagDir'), version);
				var command = sprintf('svn mkdir %s -m "Creating version folder"', folder);
				return performExec(command).thenResolve(folder);
			}

			function importFiles(folder) {
				var files = [];
				task.files.forEach(function (file) {
					files = files.concat(file.src.filter(function (path) {
						var exists = grunt.file.exists(path);
						if (!exists) {
							grunt.log.warn('File "%s" does not exist.\n', path);
						}
						return exists;
					}).map(function (path) {
						return {
							dest: file.dest,
							src:  path,
							name: path.split('/').pop()
						};
					}));
				});
				var deferred = Q.defer();
				var promise = deferred.promise;
				return Q.try(processNextFile);

				function processNextFile() {
					if (files.length > 0) {
						promise.then(processFile(files.shift()));
					} else {
						deferred.resolve();
					}
					return promise;
				}

				function processFile(file) {
					var command = sprintf('svn import %s %s/%s', file.src, folder, file.dest);
					if (grunt.file.isFile(file.src)) {
						command = sprintf('%s/%s -m "Adding file to version."', command, file.name);
					} else {
						command += ' -m "Adding folder to version."';
					}
					return performExec(command).then(processNextFile);
				}
			}

			function performExec(command) {
				var deferred = Q.defer();
				grunt.verbose.write('Executing: %s\n', command);
				exec(command, function (error, stdout) {
					if (error !== null) {
						deferred.reject(error);
					} else {
						deferred.resolve(stdout);
					}
				});
				return deferred.promise;
			}

			function createUserQuery(message, callback) {
				return function () {
					if (message) {
						console.info(message);
					}
					process.stdin.resume();
					process.stdin.once('data', function (data) {
						data = data.toString().trim();
						callback(data);
					});
				};
			}

			function isValidVersion(version, versions) {
				var valid = /\d+\.\d+\.\d+/.test(version);
				grunt.verbose.write('Checking version\n');
				if (!valid) {
					grunt.log.error('Incorrect format %s\n', version);
				} else {
					valid = versions.indexOf(version) === -1;
					if (!valid) {
						grunt.log.error('Version %s already exists\n', version);
					}
				}
				return valid;
			}

			function bumpVersion(version, bump) {
				var parts = version.split('.');
				var index = 'GVF'.indexOf(bump.toUpperCase());
				parts[ index ] = (parseInt(parts[ index ], 10) + 1).toString();
				while (++index < parts.length) {
					parts[ index ] = 0;
				}
				version = parts.join('.');
				grunt.verbose.write('Bumping to version %s\n', version);
				return version;
			}
		}
	);
};
