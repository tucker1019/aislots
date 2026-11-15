const path = require('path');
const jsonfile = require('jsonfile');
const { sync } = require('cross-spawn');
const buildConfig = require('./build-config.json');
const { APP_KEY, DEPLOY_ENV, COCOS_CREATOR_VERSION, PLATFORM } = process.env;

async function cocosCreatorBuildBundle(params) {
  if (PLATFORM == "android" || PLATFORM == "ios") {
    const buildConfigPath = path.resolve(process.cwd(), `buildConfig_${PLATFORM}.json`)
    const buildConfigAndroid = jsonfile.readFileSync(buildConfigPath);
    if (DEPLOY_ENV == "test") {
      buildConfigAndroid.packages.native.encrypted = false;
    } else {
      buildConfigAndroid.packages.native.xxteaKey = params.xxteaKey;
      buildConfigAndroid.packages.native.encrypted = true;
    }
    jsonfile.writeFileSync(buildConfigPath, buildConfigAndroid, { encoding: 'utf8', spaces: 2, EOL: '\r\n' });
    const strCocosBuildArgs = `configPath=${buildConfigPath};logDest=${PLATFORM}..compile.log`;
    console.log(`\n🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Cocos ${PLATFORM} 开始构建 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀`);
    sync(`/Applications/CocosCreator/Creator/${COCOS_CREATOR_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
    console.log(`\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 Cocos ${PLATFORM} 构建完成 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉`);
    const { app_name } = params;
    const bundleName = buildConfig.gameName;
    const bundlePath = path.resolve(process.cwd(), 'build', PLATFORM, 'data', 'assets', bundleName);
    sync(`tj-cocos`, [DEPLOY_ENV, app_name, PLATFORM, '1.1.1', bundleName, bundlePath, COCOS_CREATOR_VERSION, 2], { stdio: 'inherit' });
  }
  else {
    const { app_name } = params;
    const buildConfigPath = path.resolve(process.cwd(), 'buildConfig_web-mobile.json');
    const strCocosBuildArgs = `configPath=${buildConfigPath};logDest=web-mobile..compile.log`;
    console.log(`\n🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Cocos android 开始构建 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀`);
    sync(`/Applications/CocosCreator/Creator/${COCOS_CREATOR_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
    // sync(`D:\\CocosDashboard\\resources\\.editors\\Creator\\${COCOS_CREATOR_VERSION}\\CocosCreator.exe`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
    console.log(`\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 Cocos android 构建完成 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉`);
    const bundleName = buildConfig.gameName;
    const bundlePath = path.resolve(process.cwd(), 'build', 'web-mobile', "assets", bundleName);
    sync(`tj-cocos`, [DEPLOY_ENV, app_name, 'web-mobile', '1.1.1', bundleName, bundlePath, COCOS_CREATOR_VERSION, 2], { stdio: 'inherit' });
  }

}

(async () => {
  // @ts-ignore
  const arrApps = buildConfig[APP_KEY];
  for (let i = 0; i < arrApps.length; i++) {
    await cocosCreatorBuildBundle(arrApps[i]);
  }
})();