/* global module */
module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		svn_tag: {
			options: {
				_debug: true,
				//bump:       'z',
				repository: '<%= pkg.svn.repository %>',
				useWorkingCopy: true
			},
			test: {
				options: {
					tagDir: 'tags/test',
				},
				files: [{
					dest: '',
					src: [
						'file.txt'
					]
				}]
			},
			testCustomVersion: {
				options: {
					tagDir: 'tags/test',
					customVersion:"<%=pkg.version%>"
				},
				files: [{
					dest: '',
					src: [
						'file.txt'
					]
				}]
			}
		}
	});
	grunt.loadTasks('..\\tasks');
	grunt.registerTask('default',[ 'svn_tag'])
};