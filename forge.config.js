const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'public', 'favicon'),
    extraResource: [
      path.join(__dirname, 'resources', 'items.json'),
      path.join(__dirname, 'resources', 'stats.json'),
    ],
    ignore: [
      /^\/src($|\/)/,
      /^\/angular\.json$/,
      /^\/\.git($|\/)/,
      /^\/\.vscode($|\/)/,
      /^\/out($|\/)/,           // 排除輸出的打包目錄
      /^\/resources($|\/)/,     // 重要：已透過 extraResource 處理，需從 ASAR 排除以避免重複
      /^\/public($|\/)/,        // 排除原始圖示素材
      /node_modules\/.*\/README\.md/,
      /node_modules\/.*\/CHANGELOG\.md/,
      /node_modules\/.*\/test($|\/)/,
      /node_modules\/.*\/docs($|\/)/,
      /(.eslintrc|tsconfig\.json|package-lock\.json|yarn\.lock)$/,
      /\.map$/,                 // 排除 Source Maps 檔案
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: __dirname + '/public/favicon.ico',
        iconUrl: __dirname + '/public/favicon.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
