const path = require('path');
const jsonfile = require('jsonfile');
const { sync } = require('cross-spawn');
const buildConfig = require('./build-config.json');
const fs = require("fs")
const { APP_KEY, DEPLOY_ENV, COCOS_CREATOR_VERSION, UPLOAD, PLATFORM } = process.env;

async function cocosCreatorBuildBundle(params) {
  const boolAndroid = PLATFORM == "android";
  if (boolAndroid) {
    const buildConfigPath = path.resolve(process.cwd(), 'buildConfig_android.json');
    const buildConfigAndroid = jsonfile.readFileSync(buildConfigPath);
    buildConfigAndroid.packages.android.packageName = params.package || buildConfigAndroid.packages.android.packageName;
    if (params.xxteaKey != "") {
      buildConfigAndroid.packages.native.xxteaKey = params.xxteaKey;
      buildConfigAndroid.packages.native.encrypted = true
    } else {
      buildConfigAndroid.packages.native.encrypted = false

    }
    jsonfile.writeFileSync(buildConfigPath, buildConfigAndroid, { encoding: 'utf8', spaces: 2, EOL: '\r\n' });
    const strCocosBuildArgs = `configPath=${buildConfigPath};logDest=android..compile.log`;

    console.log(`\n🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Cocos android 开始构建 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀`);
    sync(`/Applications/CocosCreator/Creator/${COCOS_CREATOR_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
    // sync(`D:\\CocosDashboard_1.2.2\\resources\\.editors\\Creator\\${COCOS_CREATOR_VERSION}\\CocosCreator.exe`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
    console.log(`\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 Cocos android 构建完成 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉`);
  } else {
    const strCocosBuildArgs = `platform=web-mobile;debug=false;md5Cache=true;replaceSplashScreen=true`
    console.log("strCocosBuildArgs", strCocosBuildArgs)
    sync(`/Applications/CocosCreator/Creator/${COCOS_CREATOR_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator`, ['--project', process.cwd(), '--build', strCocosBuildArgs], { stdio: 'inherit' });
  }


  const { app_name } = params;
  const bundleName = buildConfig.gameName;
  if (boolAndroid) {
    var zipper = require("zip-local");
    const bundlePath = path.resolve(process.cwd(), 'build', 'android', 'data', 'assets', bundleName);
    const outPath = path.resolve(process.cwd(), 'build', 'android', 'data', 'assets', "out");
    fs.mkdir(outPath, () => {

    })
    var md5 = "";
    fs.readdir(bundlePath, (err, menu) => {
      if (!menu) return;
      menu.forEach(function (ele) {
        fs.stat(bundlePath + "/" + ele, function (err, info) {
          if (ele.slice(ele.length - 4, ele.length) == "json") {
            md5 = ele.slice(ele.length - 10, ele.length - 5)
            console.log("md5=>", md5)
            zipper.sync.zip(bundlePath).compress().save(outPath + "/" + bundleName + "_" + md5 + ".zip");
            if (UPLOAD == "false") {
              console.log(`open`, outPath)
              sync(`open`, [outPath], { stdio: 'inherit' })
              return
            }
            if (APP_KEY == "kny")
              sync(`tj-cocos`, [DEPLOY_ENV, app_name, 'android', '1.0.0', bundleName, outPath, COCOS_CREATOR_VERSION], { stdio: 'inherit' });
          }
        })
      })
    })
  } else {
    if(UPLOAD=="true"){
      const bundlePath = path.resolve(process.cwd(), "build", "web-mobile");
      sync(`tj-cocos`, [DEPLOY_ENV, app_name, "web-mobile", '1.0.8', bundleName, bundlePath, COCOS_CREATOR_VERSION], { stdio: 'inherit' });
    }else {
      // sync(`open`, [path.resolve(process.cwd(), "build","web-mobile")], { stdio: 'inherit' })
    }

  }
}


(async () => {
  // @ts-ignore
  const arrApps = buildConfig[APP_KEY];
  for (let i = 0; i < arrApps.length; i++) {
    await cocosCreatorBuildBundle(arrApps[i]);
  }
})();