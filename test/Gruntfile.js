/* global module */
module.exports = function (grunt) {
	grunt.initConfig({
		pkg:            grunt.file.readJSON('package.json'),
		svn_custom_tag: {
			options: {
				//_debug:     true,
				//bump:       'z',
				repository:     '<%= pkg.svn.repository %>',
				useWorkingCopy: true
			},
			test:    {
				options: {
					tagDir: 'tags/test'
				},
				files:   [
					{
						dest: '',
						src:  [
							'< insert test file here >'
						]
					}
				]
			}
		}
	});
	grunt.loadNpmTasks('grunt-svn-custom-tag');
	grunt.registerTask('default', 'svn_custom_tag:test')
};
