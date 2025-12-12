// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
	...config,
	{
		// specify files to exclude from linting here
		ignores: [
			'.dev-server/',
			'.vscode/',
			'*.test.js',
			'test/**/*.js',
			'*.config.mjs',
			'build',
			'dist',
			'admin/words.js',
			'admin/admin.d.ts',
			'admin/blockly.js',
			'**/adapter-config.d.ts',
			'widgets/**/*.js',
			'admin/build',
			'docs/home_controller_all_in_one.js' // Legacy example file
		],
	},
	{
		// Browser environment for admin JS files
		files: ['admin/js/**/*.js'],
		languageOptions: {
			globals: {
				window: 'readonly',
				document: 'readonly',
				io: 'readonly',
				alert: 'readonly',
				confirm: 'readonly',
				FileReader: 'readonly',
				console: 'readonly',
			},
		},
		rules: {
			'no-undef': 'off', // Browser globals are defined above
			'@typescript-eslint/no-unused-vars': ['error', { 
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^(renderDeviceRows|renderRoomRows|renderSceneRows|openAddDialog|saveNewItem|exportData|handleImportFile|loadConnectedClients|toggleLogs|disconnectClient|toggleCapabilities|toggleSceneDetails|triggerScene|toggleMetrics|renderMetricSummary|relativeTime|validateConfig|formatCountdown|updateValueDisplay|applyRoomMetricsUpdateBatch|switchTab|loadData|closeAddDialog|currentTab|currentBasePath|templates)$'
			}],
		},
	},
	{
		// you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
		// as this improves maintainability. jsdoc warnings will not block build process.
		rules: {
      'jsdoc/no-blank-blocks': ['error', { 'enableFixer': true }],
			// 'jsdoc/require-jsdoc': 'off',
			// 'jsdoc/require-param': 'off',
			// 'jsdoc/require-param-description': 'off',
			// 'jsdoc/require-returns-description': 'off',
			// 'jsdoc/require-returns-check': 'off',
		},
	},
];