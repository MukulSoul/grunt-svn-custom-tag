/* global require:false */
/* global module:false */
"use strict";

// set to false to test without making changes to the repository.
var ACTIVE_SVN = true;

var util = require('util');
var prompt = require('prompt');
var Q = require('q');
var semver = require('semver');
var sprintf = require('sprintf');
var os = require('os');
var exec = require('child_process').exec;

module.exports = function (grunt) {
	grunt.logObject = function (obj) {
		grunt.write.log(util.inspect(obj, false, null));
	};

	grunt.registerMultiTask(
		'svn_custom_tag',
		'Create versioned copies of specified files, placing them into a specified SVN tag folder.',
		function () {
			var config = grunt.config;
			var task = this;
			var done = task.async();
			Q.try(prepareConfig)
				.then(loadVersions)
				.then(determineNextVersion)
				.then(createVersionFolder)
				.then(importFiles)
				.then(copyToLatest)
				.then(done)
				.fail(function (error) {
					grunt.fatal(error);
				});

			function prepareConfig() {
				var repository;
				var defaultBump;
				config.merge({
					defaultBump: 'z',
					tagDir:      'tags'
				});
				config.merge(task.options());
				config.merge(task.data);
				if (task.args.length > 0) {
					config('bump', task.args[ 0 ]);
				}
				repository = config('repository');
				defaultBump = config('defaultBump');
				if (!repository) {
					throw grunt.util.error('"repository" option not specified.');
				}
				if (defaultBump && !/p?[xyz]/i.test(defaultBump)) {
					throw grunt.util.error('illegal defaultBump');
				}
				config('fullTagDir', sprintf('%s/%s', repository, config('tagDir')));
			}

			function loadVersions() {
				var command = sprintf('svn ls %s', config('fullTagDir'));
				return performExec(command).then(function (versions) {
					if (versions.length === 0) {
						grunt.verbose.write('No versions found.\n'.yellow);
					} else {
						versions = (function () {
							var pruned = [];
							versions.split(/\/\s+/).forEach(function (version) {
								if (semver.valid(version)) {
									pruned.push(version);
								}
							});
							return pruned;
						})();
						grunt.verbose.write('Found tagged versions:\n'.cyan);
						grunt.verbose.write(versions.join('\n'), '\n');
					}
					return versions;
				});
			}

			function determineNextVersion(versions) {
				var deferred = Q.defer();
				var version = findLatestVersion();
				var bump = config('bump');
				if (bump) {
					grunt.log.write('Bump already specified. Checking.\n'.yellow);
					processBumpChoice(bump);
				} else {
					queryForBump();
				}
				return deferred.promise;

				function findLatestVersion() {
					var version;
					if (versions.length > 0) {
						version = versions.slice(-1)[ 0 ];
					}
					if (version) {
						grunt.log.write('Latest version found is: %s\n'.cyan, version);
					} else {
						grunt.log.write('Looks like you\'re creating the first build. So let\'s start from 0.0.0\n');
						version = '0.0.0';
					}
					return version;
				}

				function queryForBump() {
					prompt.start();
					prompt.get([
							{
								description: sprintf('What do you wish to bump? [X].[Y].[Z] (or [PX].[PY].[PZ])? Or' +
									' [Enter] for default (\'%s\'). Or give an [E]xplicit version. Or [Q]uit',
									config('defaultBump').toUpperCase()
								).cyan,
								name:        'bump',
								pattern:     /(p?[xyz]|eq)?/i
							}
						],
						function (err, input) {
							if (err !== null) {
								deferred.reject();
							}
							var bump = input.bump.toLowerCase();
							if (bump.length === 0) {
								bump = config('defaultBump');
							}
							processBumpChoice(bump);
						}
					);
				}

				function processBumpChoice(bump) {
					switch (bump) {
						case 'q':
							quit();
							break;
						case 'e':
							queryForVersion();
							break;
						default:
							version = bumpVersion(version, bump);
							deferred.resolve(version);
							break;
					}

					function queryForVersion() {
						prompt.start();
						prompt.get({
								description: 'Enter version (e.g. 1.3.0-1), go [B]ack or [Q]uit'.cyan,
								name:        'version'
							},
							function (err, input) {
								if (err !== null) {
									deferred.reject();
								}
								var version = input.version.toLowerCase();
								switch (version) {
									case 'q':
										quit();
										break;
									case 'b':
										queryForBump();
										break;
									default:
										version = semver.clean(version);
										if (semver.valid(version)) {
											if (versions.indexOf(version) !== -1) {
												grunt.log.warn('Version %s already exists.', version);
												queryForVersion();
											} else {
												deferred.resolve(version);
											}
										} else {
											grunt.log.error('Invalid format.');
											queryForVersion();
										}
								}
							}
						);
					}

					function bumpVersion(version, bump) {
						var incs = {
							px: 'premajor',
							py: 'preminor',
							pz: 'prepatch',
							x:  'major',
							y:  'minor',
							z:  'patch'
						};
						version = semver.inc(version, incs[ bump ]);
						grunt.log.write('Bumping to version %s\n'.cyan, version);
						return version;
					}
				}

				function quit() {
					grunt.log.write('Quitting\n'.yellow);
					done();
				}
			}

			function createVersionFolder(version) {
				var folder = sprintf('%s/%s', config('fullTagDir'), version);
				var command = sprintf('svn mkdir %s -m "Creating folder for version %s"', folder, version);
				return performExec(command, !ACTIVE_SVN).thenResolve({
					folder:  folder,
					version: version
				});
			}

			function importFiles(data) {
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
						deferred.resolve(data);
					}
					return promise;
				}

				function processFile(file) {
					var command = sprintf('svn import %s %s/%s', file.src, data.folder, file.dest);
					if (grunt.file.isFile(file.src)) {
						command = sprintf('%s/%s -m "Adding file \'%s\' to version %s"',
							command, file.name, file.name, data.version);
					} else {
						command += sprintf(' -m "Adding folder \'%s\' to version %s"', file.name, data.version);
					}
					return performExec(command, !ACTIVE_SVN).then(processNextFile);
				}
			}

			function copyToLatest(data) {
				var command;
				var deferred = Q.defer();
				var promise = deferred.promise;
				var latest = config('latest');
				if (latest === false) {
					ready();
				} else if (latest === 'prompt') {
					confirmCopy();
				} else {
					createLatest();
				}
				return promise;

				function confirmCopy() {
					prompt.start();
					prompt.get({
							description: 'Copy to latest? [Y/n]'.cyan,
							name:        'copy',
							pattern:     /(y|n)?/i
						},
						function (err, input) {
							if (err !== null) {
								deferred.reject();
							}
							if (input.copy.toLowerCase() !== 'n') {
								createLatest();
							} else {
								ready();
							}
						}
					);
				}

				function createLatest() {
					command = sprintf('svn copy %s %s/%s/latest -m "Creating latest tag"',
						data.folder, config('repository'), config('tagDir'));
					promise.then(performExec(command, !ACTIVE_SVN));
					ready();
				}

				function ready() {
					deferred.resolve();
				}
			}

			function performExec(command, dontDoIt) {
				var deferred = Q.defer();
				grunt.verbose.write('%s\n'.grey, command);
				if (!dontDoIt) {
					exec(command, function (error, stdout) {
						if (error !== null) {
							deferred.reject(error);
						} else {
							deferred.resolve(stdout);
						}
					});
				} else {
					deferred.resolve();
				}
				return deferred.promise;
			}
		}
	);
};
