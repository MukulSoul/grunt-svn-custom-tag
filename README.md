# grunt-svn-custom-tag

Creates custom versioned tag entries in your SVN repository. If you want to do a brute-force snapshot of your project i.e. put your whole project into a tag, then you probably want to use [grunt-svn-tag](https://www.npmjs.com/package/grunt-svn-tag). However, if you want to pick and choose which files from your project are tagged, then this is the plugin for you.

## Getting Started
This plugin requires Grunt `~0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

	npm install grunt-svn-fetch --save-dev

One the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

	grunt.loadNpmTasks('grunt-svn-fetch');

## Overview

In your project's Gruntfile, add a section named `svn_custom-tag` to the data object passed into `grunt.initConfig()`.

	grunt.initConfig({
		...
		svn_custom_tag: {
			options: {
				// Task-specific options go here.
			},
			your_project: {
				files: [
					// the project files and folders you want tagged
				]
			},
		},
		...
	});

This plugin requires some user input to determine the right version number to use. However, this can also be circumvented by supplying arguments from the command-line (see below).

## Options

### options.defaultBump

Type: `String`

Default: `'F'`

When prompted to select the bump level, pressing enter will select the default bump.

### options.noLatest

Type: `boolean`

Default: `false`

By default, the task copies the created versioned tag to the `'latest'` tag. Setting this to false prevents this.

### options.repository

Type: `String`

Default: none

Specifies the project's SVN repository URL. This must be specified or the task will fail.

### options.tagDir

Type: `String`

Default: `'tags'`

Specifies the root tag folder in the project's SVN respository.

## Version Numbering

Various version numbering systems exist, but this plugin only supports the X.Y.Z notation, but this should cater for the majority of cases. The terminology used in the plugin is "Generation.Version.Fix".

## Tagged Folder Structure

The plugin processes the names of the folders under the specified `tagDir` folder and from them determines the latest (highest) version number, which will then (most likely) be bumped. Folders with names other than the X.Y.Z format are ignored. If also creating a `latest` folder, any existing folder of that name will be overwritten.

When creating a new snapshot, a new folder under `tagDir` will be added, and the specified files imported. See below for an example.

## Specifying Custom Tagging

The files and folders you want tagged can be specified in the normal manner, by supplying a `files` configuration object (see example above). The `src` component identifies the files from your working copy that will be imported into the tag folder. The `dest` component specifies the folder under the create version folder to which the source files/folders will be imported. For example:

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

Assuming a fix-bump, and our latest tagged version was 1.2.3, the new version tag is 1.2.4, and the repository would be updated as follows:

	http://svn.my_company.com/my_project
		/tags
			...
			/1.2.4
				/dist						<--- specified by dest
					my_dist_file.min.js		<--- specified by src

Note that multiple file object can be specified, and each will be processed in turn.

## User Input

The plugin will determine the latest (highest) version number from the already existing version folders. This is the number that will be bumped (unless the user explicitly proves a version number). In order to determine the next bump type, the user is asked the nature of the change. Possible responses are:

1. 'G' - A generation change, e.g. 2.1.15 => 3.0.0
2. 'V' - A version change, e.g. 4.2.6 => 4.3.0
3. 'F' - A fix change, e.g. 1.3.12 => 1.3.13
4. 'X' - An explicit version. The user is asked to supply the version directly. Both format clashes will be tested.
5. 'Enter' - Use the default bump type. For convenience.
6. 'Q' - Quit the task.

Input is case-insensitive.

### Avoiding User Input

It is possible to circumvent having to supply user input by providing the bump type as the first argument for the task. For example:

	> grunt svn_custom_tag:my_project:f

In this case, only 'G', 'V' and 'F' are recognised. This feature allows for custom tasks to be defined, which can be invoked as required, e.g.

	grunt.registerTask('tag_fix', [ 'svn_custom_tag:my_project:f' ])

Lovely jovely!
