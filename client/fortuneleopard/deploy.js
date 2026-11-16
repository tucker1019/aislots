const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// 默认使用 Cocos Creator 3.6.3，可以通过环境变量覆盖
const COCOS_CREATOR_VERSION = process.env.COCOS_CREATOR_VERSION || '3.6.3';

async function deploy() {
  const buildConfigPath = path.resolve(process.cwd(), 'buildConfig_web-mobile.json');
  
  // 检查构建配置文件是否存在
  if (!fs.existsSync(buildConfigPath)) {
    console.error(`\n❌ 构建配置文件不存在: ${buildConfigPath}`);
    process.exit(1);
  }
  
  const strCocosBuildArgs = `configPath=${buildConfigPath};logDest=web-mobile..compile.log`;
  
  // 检查 Cocos Creator 路径
  const cocosCreatorPath = `/Applications/Cocos/Creator/${COCOS_CREATOR_VERSION}/CocosCreator.app/Contents/MacOS/CocosCreator`;
  if (!fs.existsSync(cocosCreatorPath)) {
    console.error(`\n❌ Cocos Creator 路径不存在: ${cocosCreatorPath}`);
    console.error(`   请检查 Cocos Creator 版本是否正确，或设置环境变量 COCOS_CREATOR_VERSION`);
    process.exit(1);
  }
  
  console.log(`\n🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Cocos web-mobile 开始构建 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀`);
  console.log(`   Cocos Creator 路径: ${cocosCreatorPath}`);
  console.log(`   构建配置: ${buildConfigPath}`);
  
  // 执行构建
  const buildResult = spawnSync(cocosCreatorPath, ['--project', process.cwd(), '--build', strCocosBuildArgs], { 
    stdio: 'inherit',
    shell: false
  });
  
  // 检查构建输出目录是否存在（更可靠的判断方式）
  const sourceDir = path.resolve(process.cwd(), 'build', 'web-mobile');
  const buildSuccess = fs.existsSync(sourceDir) && fs.existsSync(path.join(sourceDir, 'index.html'));
  
  if (!buildSuccess) {
    console.error('\n❌ 构建失败！');
    if (buildResult.error) {
      console.error(`   错误信息: ${buildResult.error.message}`);
    }
    if (buildResult.signal) {
      console.error(`   信号: ${buildResult.signal}`);
    }
    if (buildResult.status !== 0) {
      console.error(`   退出码: ${buildResult.status}`);
    }
    console.error(`   构建输出目录不存在: ${sourceDir}`);
    console.error(`   请查看日志文件: web-mobile..compile.log`);
    process.exit(1);
  }
  
  console.log(`\n🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 Cocos web-mobile 构建完成 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉`);
  
  // 确保 release 目录存在
  const releaseDir = path.resolve(process.cwd(), 'release');
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }
  
  console.log('\n📦 开始复制文件...');
  console.log(`   源目录: ${sourceDir}`);
  console.log(`   目标目录: ${releaseDir}`);
  
  // 将 web-mobile 下的所有文件直接复制到 release 目录
  copyFolderContentsSync(sourceDir, releaseDir);
  
  // 重命名 index.html 为递增编号的文件名
  renameIndexHTML(releaseDir);
  
  console.log('\n✅ 部署完成！文件已复制到 release 目录');
  
  // 获取最大版本号并自动提交
  const maxVersion = getMaxVersion(releaseDir);
  if (maxVersion) {
    commitChanges(maxVersion);
  } else {
    console.log('\n⚠️  未找到版本号，跳过 git 提交');
  }
}

// 递归复制文件夹内容（将源文件夹内的所有内容复制到目标文件夹）
function copyFolderContentsSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  
  const files = fs.readdirSync(from);
  
  files.forEach(file => {
    const sourcePath = path.join(from, file);
    const targetPath = path.join(to, file);
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // 如果目标目录已存在，先删除
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
      copyFolderContentsSync(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// 重命名 index.html 为递增编号的文件名
function renameIndexHTML(releaseDir) {
  const indexHtmlPath = path.join(releaseDir, 'index.html');
  
  // 如果 index.html 不存在，直接返回
  if (!fs.existsSync(indexHtmlPath)) {
    console.log('\n⚠️  未找到 index.html 文件');
    return;
  }
  
  // 查找 release 目录中所有 index.*.html 文件
  const files = fs.readdirSync(releaseDir);
  const indexPattern = /^index\.(\d+)\.html$/;
  let maxNumber = 10001; // 默认起始编号
  
  files.forEach(file => {
    const match = file.match(indexPattern);
    if (match) {
      const number = parseInt(match[1], 10);
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  
  // 新的编号 = 最大编号 + 1
  const newNumber = maxNumber + 1;
  const newFileName = `index.${newNumber}.html`;
  const newFilePath = path.join(releaseDir, newFileName);
  
  // 重命名文件
  fs.renameSync(indexHtmlPath, newFilePath);
  console.log(`\n📝 已将 index.html 重命名为 ${newFileName}`);
}

// 获取 release 目录下最大的版本号
function getMaxVersion(releaseDir) {
  if (!fs.existsSync(releaseDir)) {
    return null;
  }
  
  const files = fs.readdirSync(releaseDir);
  const indexPattern = /^index\.(\d+)\.html$/;
  let maxNumber = null;
  
  files.forEach(file => {
    const match = file.match(indexPattern);
    if (match) {
      const number = parseInt(match[1], 10);
      if (maxNumber === null || number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  
  return maxNumber;
}

// 执行 git 提交
function commitChanges(version) {
  console.log(`\n📝 开始 git 提交，版本号: ${version}`);
  
  // 检查是否在 git 仓库中
  const gitCheckResult = spawnSync('git', ['rev-parse', '--git-dir'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
  
  if (gitCheckResult.status !== 0) {
    console.log('\n⚠️  当前目录不是 git 仓库，跳过提交');
    return;
  }
  
  // 检查是否有变更
  const statusResult = spawnSync('git', ['status', '--porcelain'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8'
  });
  
  if (!statusResult.stdout || statusResult.stdout.trim().length === 0) {
    console.log('\n⚠️  没有需要提交的变更');
    return;
  }
  
  // 添加所有变更
  const addResult = spawnSync('git', ['add', '.'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  
  if (addResult.status !== 0) {
    console.error('\n❌ git add 失败');
    return;
  }
  
  // 提交变更
  const commitMessage = `发布版本：${version}`;
  const commitResult = spawnSync('git', ['commit', '-m', commitMessage], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  
  if (commitResult.status !== 0) {
    console.error('\n❌ git commit 失败');
    return;
  }
  
  console.log(`\n✅ Git 提交成功！提交信息: ${commitMessage}`);
}

// 执行部署
deploy().catch(error => {
  console.error('\n❌ 部署过程中发生错误:', error);
  process.exit(1);
});

