# grunt-svn-custom-tag

Creates custom versioned tag entries in your SVN repository. If you want to do a brute-force snapshot of your project i.e. put your whole project into a tag, then you probably want to use [grunt-svn-tag](https://www.npmjs.com/package/grunt-svn-tag). However, if you want to pick and choose which files from your project are tagged, then this is the plugin for you.

## Getting Started
This plugin requires Grunt `~0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

	npm install grunt-svn-custom-tag --save-dev

One the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

	grunt.loadNpmTasks('grunt-svn-custom-tag');

## Overview

This plugin requires some user input to determine the right version number to use. However, this can also be circumvented by supplying arguments from the command-line (see below). Support for copying files from either the working copy or SVN (default) is supported.

### Version Numbering

The plugin adheres to the [Semver](http://semver.org/) system of version numbering, and utilises the [semver](https://docs.npmjs.com/misc/semver) npm package to achieve this. For convenience, the plug-in refers to the MAJOR.MINOR.PATCH numbering as X.Y.Z (see user input below), but the same logic is followed.

## Options

### options.bump

Type: `String`

Default: `null`

If set to a recognised value (see below), then the user will not be queried for the bump type.

### options.defaultBump

Type: `String`

Default: `'z'`

When prompted to select the bump level, pressing enter will select the default bump. See below for more details.

### options.latest

Type: `boolean` | `string`

Default: `true`

The plug-in provides the means to copy the bumped version to a `latest` tag folder. Whether or not this is done is determined by the value of this option.

Set this to `true` to copy to the latest without prompting. Set to `false` to skip this step. Set to `'prompt'` to be asked at run-time.

### options.repository

Type: `String`

Default: none

Specifies the project's SVN repository URL. This must be specified or the task will fail. This should be the project's root folder in the SVN, i.e. that which is common to both the source (trunk) and target (tag) folders.

### options.tagDir

Type: `String`

Default: `'tags'`

Specifies the root tag folder in the project's SVN repository.

### options.trunkDir

Type: `String`

Default: `'trunk'`

Specifies the source folder in the project's SVN repository. This option is utilised when copying from the SVN and not the working copy.

### options.useWorkingCopy

Type: `Boolean`

Default: `false`

If true, the specified files will be sought from the working copy. Otherwise, the files will be taken from the SVN source. This feature is useful when wishing to tag generated files, which are not typically stored in the SVN, e.g. CSS or minified Javascript files.

## Tagged Folder Structure

When creating a new snapshot, the existing tagged folders are scanned to identify the latest stored version (providing the bump starting point). Once the bump type is known, a new folder under the tag root is added, and the specified files imported. See below for an example.

## Specifying Custom Tagging

The files and folders you want tagged can be specified in the normal manner, by supplying a `files` configuration object. When copying within the SVN, the `src` property identifies the files and/or folders that will be copied to the target tag folder. When using the working copy, it identifies the files from your working copy that will be imported. The `dest` component specifies the target folder under the created version folder to which the source files/folders will be imported. For example:

	svn_custom_tag: {
		options: {
			respository: 'http://svn.my_company.com/my_project'
		},
		my_project: {
			files: [
				{
					src: '/my/project/path/dist/*.js',
					dest: 'dist'
				}
			]
		}
	}

Assuming a patch bump, and our latest tagged version was 1.2.3, the new version tag is 1.2.4, and the repository would be updated as follows:

	http://svn.my_company.com/my_project
		/tags
			...
			/1.2.4
				/dist						<--- specified by dest
					my_dist_file.min.js		<--- specified by src

Note that multiple file objects can be specified, and each will be processed in turn.

## User Input

In order to determine the next bump type, (if not already specified via the options or arguments), the user is asked to supply it. Possible responses to the prompt (all case-insensitive) are:

1. `X` - A major change, i.e. 2.1.15 => 3.0.0
2. `Y` - A minor change, i.e. 2.1.15 => 2.2.0
3. `Z` - A patch change, i.e. 2.1.15 => 2.1.16
4. `PX` - A pre-major change, i.e. 2.1.15 => 3.0.0-0
5. `PY` - A pre-minor change, i.e. 2.1.15 => 2.2.0-0
6. `PZ` - A pre-patch change, i.e. 2.1.15 => 2.1.16-0
7. `E` - An explicit version. The user is asked to supply the version directly.
8. `Enter` - Use the `defaultBump` option. For convenience.
9. `Q` - Quit the task.

### Avoiding User Input

It is possible to circumvent having to supply user input by specifying certain task settings either via the options or from the command-line. For example:

	> grunt svn_custom_tag:my_project:bump=pz:latest=no

Note that Command-line arguments take precedence over supplied options.

Lovely jovely!

## Release Notes

### 1.3.0

* Issue #1 Support for copying from SVN added: options `trunkDir` and `useWorkingCopy` provided.
* Issue #7 corrected.
* Issue #8 corrected.