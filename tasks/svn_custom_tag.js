/* global: require:false */
/* global: module:false */
"use strict";

var colors = require('colors');
var exec = require('child_process').exec;
var prompt = require('prompt');
var Q = require('q');
var semver = require('semver');
var sprintf = require('sprintf');
var util = require('util');

colors.setTheme({
	exec:    'grey',
	info:    'cyan',
	prompt:  'green',
	verbose: 'magenta',
	warn:    'white'
});

module.exports = function (grunt) {
	grunt.logObject = function (obj) {
		grunt.write.log(util.inspect(obj, false, null));
	};
	grunt.registerMultiTask(
		'svn_custom_tag',
		'Tag copies of specified files, placing them into a semver\'d SVN tag folder.',
		function () {
			var task = this;
			var options;
			var done = task.async();
			Q.try(checkOptions)
				.then(loadVersions)
				.then(determineNextVersion)
				.then(createVersionFolder)
				.then(transferFiles)
				.then(copyToLatest)
				.then(done)
				.catch(fail);

			function checkOptions() {
				var defaultOptions = {
					_colors:        true, // set to true to force colours to be enabled
					_debug:         false, // set to true to avoid making SVN calls
					bump:           null,
					bin:            'svn',
					defaultBump:    'z',
					tagDir:         'tags',
					trunkDir:       'trunk',
					useWorkingCopy: false
				};
				options = task.options(defaultOptions);
				task.args.forEach(function (arg) {
					var parts = arg.split('=');
					if (parts.length === 2) {
						options[parts[0]] = parts[1];
					}
				});
				colors.enabled = colors.enabled || !!options._colors;
				if (!options.repository) {
					throw grunt.util.error('"repository" option not specified.');
				}
				if (options.defaultBump && !/p?[xyz]/i.test(options.defaultBump)) {
					throw grunt.util.error('illegal defaultBump');
				}
				options.fullTagDir = sprintf('%s/%s', options.repository, options.tagDir);
				options.fullTrunkDir = sprintf('%s/%s', options.repository, options.trunkDir);
			}

			function loadVersions() {
				var command = sprintf('%s ls %s', options.bin, options.fullTagDir);
				return performExec(command).then(function (versions) {
					versions = versions || [];
					if (versions.length === 0) {
						grunt.verbose.write('No versions found.\n'.verbose);
					} else {
						versions = (function () {
							var pruned = [];
							versions.split(/\/\s+/).forEach(function (version) {
								if (semver.valid(version)) {
									pruned.push(version);
								}
							});
							return pruned.sort(function (a, b) {
								var rv;
								var aParts = a.split(/[\.-]/);
								var bParts = b.split(/[\.-]/);
								var aNext, bNext;
								while (aParts.length) {
									if (!bParts.length) {
										rv = 1;
										break;
									}
									aNext = parseInt(aParts.shift());
									bNext = parseInt(bParts.shift());
									if (aNext < bNext) {
										rv = -1;
										break;
									} else if (aNext > bNext) {
										rv = 1;
										break;
									}
								}
								if (rv === undefined) {
									rv = bParts.length > 0 ? -1 : 1;
								}
								return rv;
							});
						})();
						grunt.verbose.write('Found tagged versions:\n'.verbose);
						grunt.verbose.writeln(versions.join('\n'));
					}
					return versions;
				});
			}

			function determineNextVersion(versions) {
				var deferred = Q.defer();
				var version = findLatestVersion();
				if (options.bump) {
					grunt.log.write('Bump already specified. Checking.\n'.info);
					processBumpChoice(options.bump);
				} else {
					queryForBump();
				}
				return deferred.promise;

				function findLatestVersion() {
					var version;
					if (versions.length > 0) {
						version = versions.slice(-1)[0];
						grunt.log.write('Latest version found is: %s\n'.info, version);
					} else {
						version = '0.0.0';
						grunt.log.write('Looks like you\'re creating the first build. So let\'s start from 0.0.0\n'.info);
					}
					return version;
				}

				function queryForBump() {
					prompt.start();
					prompt.get([
							{
								description: sprintf('What do you wish to bump? [X].[Y].[Z] (or [PX].[PY].[PZ], or pre-release [PR])?' +
									' Or' +
									' [Enter] for default (\'%s\'). Or give an [E]xplicit version. Or [Q]uit',
									options.defaultBump.toUpperCase()
								).prompt,
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
								bump = options.defaultBump;
							}
							processBumpChoice(bump);
						}
					);
				}

				function processBumpChoice(bump) {
					var newVersion;
					switch (bump) {
						case 'q':
							quit();
							break;
						case 'e':
							queryForVersion();
							break;
						default:
							newVersion = bumpVersion(version, bump);
							if (newVersion) {
								confirmBump(newVersion);
							} else {
								grunt.log.warn('Unrecognised bump given. Querying for clarification.');
								queryForBump();
							}
							break;
					}

					function queryForVersion() {
						prompt.start();
						prompt.get({
								description: 'Enter version (e.g. 1.3.0-1), go [B]ack or [Q]uit'.prompt,
								name:        'version'
							},
							function (err, input) {
								if (err !== null) {
									deferred.reject();
								}
								var newVersion = input.version.toLowerCase();
								switch (newVersion) {
									case 'q':
										quit();
										break;
									case 'b':
										queryForBump();
										break;
									default:
										newVersion = semver.clean(newVersion);
										if (semver.valid(newVersion)) {
											if (versions.indexOf(newVersion) !== -1) {
												grunt.log.warn('Version %s already exists.', newVersion);
												queryForVersion();
											} else {
												confirmBump(newVersion);
											}
										} else {
											grunt.log.warn('Invalid format.');
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
							pr: 'prerelease',
							x:  'major',
							y:  'minor',
							z:  'patch'
						};
						return semver.inc(version, incs[bump]);
					}

					function confirmBump(version) {
						grunt.log.write('Bumping to version %s\n'.info, version);
						deferred.resolve(version);
					}
				}

				function quit() {
					grunt.log.write('Quitting\n'.info);
					done();
				}
			}

			function createVersionFolder(version) {
				var folder = sprintf('%s/%s', options.fullTagDir, version);
				var command = sprintf('%s mkdir %s -m "Creating folder for version %s"', options.bin, folder, version);
				return performExec(command).thenResolve({
					tagFolder: folder,
					version:   version
				});
			}

			function transferFiles(data) {
				var targets = options.useWorkingCopy ? processWorkingCopyFiles() : processRepositoryFiles();
				var deferred = Q.defer();
				var promise = deferred.promise;
				var processFile = options.useWorkingCopy ? importFile : copyTarget;
				return Q.try(processNextFile);

				function processWorkingCopyFiles() {
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
					return files;
				}

				function processRepositoryFiles() {
					var files = [];
					task.files.forEach(function (file) {
						file.src.filter(function (path) {
							files.push({
								dest: file.dest,
								src:  path,
								name: path.split('/').pop()
							});
						});
					});
					return files;
				}

				function processNextFile() {
					if (targets.length > 0) {
						promise.then(processFile(targets.shift()));
					} else {
						deferred.resolve(data);
					}
					return promise;
				}

				function importFile(file) {
					var command = sprintf('%s import %s %s', options.bin, file.src, data.tagFolder);
					if (file.dest) {
						command = sprintf('%s/%s', command, file.dest);
					}
					if (grunt.file.isFile(file.src)) {
						command = sprintf('%s/%s -m "Adding file \'%s\' to tag %s"',
							command, file.name, file.name, data.version);
					} else {
						command = sprintf('%s -m "Adding folder \'%s\' to version %s"',
							command, file.name, data.version);
					}
					return performExec(command).then(processNextFile);
				}

				function copyTarget(target) {
					var command = sprintf('%s copy %s/%s %s',
						options.bin, options.fullTrunkDir, target.src, data.tagFolder);
					if (target.dest) {
						command = sprintf('%s/%s', command, target.dest);
					}
					command = sprintf('%s/%s', command, target.name);
					command = sprintf('%s -m "Copying item \'%s\' to tag %s"', command, target.name, data.version);
					return performExec(command).then(processNextFile);
				}
			}

			function copyToLatest(data) {
				var deferred = Q.defer();
				var promise = deferred.promise;
				if (options.latest === false || /false|no/i.test(options.latest)) {
					grunt.verbose.write('Skipping copying to latest.\n'.verbose);
				} else if (options.latest === 'prompt') {
					confirmCopy();
				} else {
					promise = createLatest();
				}
				return promise;

				function confirmCopy() {
					prompt.start();
					prompt.get({
							description: 'Copy to latest? [Y/n]'.prompt,
							name:        'copy',
							pattern:     /(y|n)?/i
						},
						function (err, input) {
							if (err !== null) {
								deferred.reject();
							}
							if (input.copy.toLowerCase() !== 'n') {
								createLatest();
							}
						}
					);
				}

				function createLatest() {
					var latestDir = sprintf('%s/latest', options.fullTagDir);
					return deleteFolder().then(createFolder);

					function deleteFolder() {
						var command = sprintf('%s delete %s -m "Deleting latest folder"', options.bin, latestDir);
						return performExec(command);
					}

					function createFolder() {
						var command = sprintf('%s copy %s %s -m "Creating latest folder"',
							options.bin, data.tagFolder, latestDir);
						return performExec(command);
					}
				}
			}

			function fail(error) {
				grunt.fail.fatal(error.message);
			}

			function performExec(command) {
				var deferred = Q.defer();
				grunt.verbose.write('%s\n'.exec, command);
				if (!options._debug) {
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
