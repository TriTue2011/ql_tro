#!/usr/bin/env node

/**
 * Script kiểm tra cấu hình setup cho dự án Quản lý Phòng Trọ
 * Chạy: node scripts/check-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 KIỂM TRA CẤU HÌNH DỰ ÁN\n');
console.log('='.repeat(50));

let totalChecks = 0;
let passedChecks = 0;
let criticalErrors = [];
let warnings = [];

// Helper functions
function checkPassed(message) {
  console.log('✅', message);
  passedChecks++;
  totalChecks++;
}

function checkFailed(message, isCritical = true) {
  console.log(isCritical ? '❌' : '⚠️', message);
  if (isCritical) {
    criticalErrors.push(message);
  } else {
    warnings.push(message);
  }
  totalChecks++;
}

function checkInfo(message) {
  console.log('ℹ️', message);
}

console.log('\n📦 1. KIỂM TRA CÀI ĐẶT NODE.JS\n');

// Check Node.js version
const nodeVersion = process.version;
const nodeMajorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (nodeMajorVersion >= 18) {
  checkPassed(`Node.js version: ${nodeVersion} (✓ >= 18)`);
} else {
  checkFailed(`Node.js version: ${nodeVersion} (Cần >= 18.0.0)`, true);
}

// Check npm
try {
  const { execSync } = require('child_process');
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  checkPassed(`npm version: ${npmVersion}`);
} catch (error) {
  checkFailed('npm không được cài đặt', true);
}

console.log('\n📁 2. KIỂM TRA CẤU TRÚC DỰ ÁN\n');

// Check important directories
const importantDirs = [
  'src',
  'src/app',
  'src/components',
  'src/lib',
  'src/models',
  'node_modules'
];

importantDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    checkPassed(`Thư mục ${dir} tồn tại`);
  } else {
    if (dir === 'node_modules') {
      checkFailed(`Thư mục ${dir} không tồn tại. Chạy: npm install`, true);
    } else {
      checkFailed(`Thư mục ${dir} không tồn tại`, true);
    }
  }
});

console.log('\n⚙️  3. KIỂM TRA FILE CẤU HÌNH\n');

// Check .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  checkPassed('File .env.local tồn tại');
  
  // Read and check .env.local content
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  
  // Check MONGODB_URI
  if (envContent.includes('MONGODB_URI=')) {
    const mongoUriMatch = envContent.match(/MONGODB_URI=(.+)/);
    if (mongoUriMatch) {
      const mongoUri = mongoUriMatch[1].trim();
      
      // Check if it's not the default placeholder
      if (mongoUri.includes('username:password@cluster')) {
        checkFailed('MONGODB_URI vẫn đang dùng placeholder. Cần thay bằng URI thật', true);
      } else if (mongoUri.includes('mongodb+srv://')) {
        // Check if database name is present
        const hasDbName = /mongodb\.net\/[^?]+\?/.test(mongoUri);
        if (hasDbName) {
          // Extract database name
          const dbNameMatch = mongoUri.match(/mongodb\.net\/([^?]+)\?/);
          const dbName = dbNameMatch ? dbNameMatch[1] : 'unknown';
          checkPassed(`MONGODB_URI có tên database: "${dbName}"`);
        } else {
          checkFailed('MONGODB_URI thiếu TÊN DATABASE! Phải thêm tên database sau .net/ và trước dấu ?', true);
          checkInfo('   Ví dụ: ...mongodb.net/demophongtro?retryWrites=...');
        }
      } else {
        checkFailed('MONGODB_URI không đúng định dạng', true);
      }
    }
  } else {
    checkFailed('Thiếu MONGODB_URI trong .env.local', true);
  }
  
  // Check NEXTAUTH_SECRET
  if (envContent.includes('NEXTAUTH_SECRET=')) {
    const secretMatch = envContent.match(/NEXTAUTH_SECRET=(.+)/);
    if (secretMatch) {
      const secret = secretMatch[1].trim();
      if (secret === 'your-secret-key-here' || secret === 'your-secret-key-here-replace-with-random-string' || secret.length < 20) {
        checkFailed('NEXTAUTH_SECRET chưa được cấu hình hoặc quá ngắn. Cần tạo key ngẫu nhiên', true);
        checkInfo('   Windows: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
        checkInfo('   Mac/Linux: openssl rand -base64 32');
      } else {
        checkPassed('NEXTAUTH_SECRET đã được cấu hình');
      }
    }
  } else {
    checkFailed('Thiếu NEXTAUTH_SECRET trong .env.local', true);
  }
  
  // Check NEXTAUTH_URL
  if (envContent.includes('NEXTAUTH_URL=')) {
    const urlMatch = envContent.match(/NEXTAUTH_URL=(.+)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      if (url === 'http://localhost:3000' || url.startsWith('https://')) {
        checkPassed(`NEXTAUTH_URL: ${url}`);
      } else {
        checkFailed('NEXTAUTH_URL không đúng định dạng', false);
      }
    }
  } else {
    checkFailed('Thiếu NEXTAUTH_URL trong .env.local', true);
  }
  
  // Check Cloudinary
  if (envContent.includes('NEXT_PUBLIC_CLOUD_NAME=')) {
    const cloudMatch = envContent.match(/NEXT_PUBLIC_CLOUD_NAME=(.+)/);
    if (cloudMatch) {
      const cloudName = cloudMatch[1].trim();
      if (cloudName === 'your-cloudinary-cloud-name' || cloudName.length < 3) {
        checkFailed('NEXT_PUBLIC_CLOUD_NAME chưa được cấu hình', false);
        checkInfo('   Đăng ký Cloudinary tại: https://cloudinary.com/');
      } else {
        checkPassed(`Cloudinary Cloud Name: ${cloudName}`);
      }
    }
  } else {
    checkFailed('Thiếu NEXT_PUBLIC_CLOUD_NAME (Upload ảnh có thể không hoạt động)', false);
  }
  
  if (envContent.includes('NEXT_PUBLIC_UPLOAD_PRESET=')) {
    const presetMatch = envContent.match(/NEXT_PUBLIC_UPLOAD_PRESET=(.+)/);
    if (presetMatch) {
      const preset = presetMatch[1].trim();
      if (preset === 'your-upload-preset' || preset.length < 3) {
        checkFailed('NEXT_PUBLIC_UPLOAD_PRESET chưa được cấu hình', false);
      } else {
        checkPassed(`Cloudinary Upload Preset: ${preset}`);
      }
    }
  } else {
    checkFailed('Thiếu NEXT_PUBLIC_UPLOAD_PRESET (Upload ảnh có thể không hoạt động)', false);
  }
  
} else {
  checkFailed('File .env.local không tồn tại!', true);
  checkInfo('   Tạo file: cp env.example .env.local (Mac/Linux)');
  checkInfo('   Tạo file: Copy-Item env.example .env.local (Windows PowerShell)');
}

// Check package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  checkPassed('File package.json tồn tại');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check important dependencies
    const requiredDeps = ['next', 'react', 'mongoose', 'next-auth'];
    const missingDeps = [];
    
    requiredDeps.forEach(dep => {
      if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
        missingDeps.push(dep);
      }
    });
    
    if (missingDeps.length === 0) {
      checkPassed('Tất cả dependencies quan trọng đã có trong package.json');
    } else {
      checkFailed(`Thiếu dependencies: ${missingDeps.join(', ')}`, true);
    }
    
  } catch (error) {
    checkFailed('Không thể đọc package.json', true);
  }
} else {
  checkFailed('File package.json không tồn tại', true);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 KẾT QUẢ KIỂM TRA\n');

const successRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

console.log(`Tổng số kiểm tra: ${totalChecks}`);
console.log(`Đã pass: ${passedChecks} ✅`);
console.log(`Lỗi nghiêm trọng: ${criticalErrors.length} ❌`);
console.log(`Cảnh báo: ${warnings.length} ⚠️`);
console.log(`Tỷ lệ thành công: ${successRate}%`);

console.log('\n' + '='.repeat(50));

if (criticalErrors.length === 0 && warnings.length === 0) {
  console.log('\n🎉 HOÀN HẢO! CẤU HÌNH ĐÃ SẴN SÀNG!\n');
  console.log('Bạn có thể chạy: npm run dev\n');
  process.exit(0);
} else if (criticalErrors.length === 0) {
  console.log('\n✅ CẤU HÌNH CƠ BẢN OK!\n');
  console.log('⚠️  Có một số cảnh báo nhỏ:');
  warnings.forEach(w => console.log('   -', w));
  console.log('\nBạn có thể chạy: npm run dev');
  console.log('(Nhưng nên sửa các cảnh báo trên)\n');
  process.exit(0);
} else {
  console.log('\n❌ CÒN MỘT SỐ VẤN ĐỀ CẦN SỬA!\n');
  console.log('Các lỗi nghiêm trọng:');
  criticalErrors.forEach(e => console.log('   ❌', e));
  
  if (warnings.length > 0) {
    console.log('\nCác cảnh báo:');
    warnings.forEach(w => console.log('   ⚠️ ', w));
  }
  
  console.log('\n📖 Xem hướng dẫn chi tiết tại:');
  console.log('   - HUONG-DAN-SETUP.md');
  console.log('   - CHECKLIST-SETUP.md\n');
  
  process.exit(1);
}

