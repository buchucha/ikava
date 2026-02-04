
/* 
  [IKAVA VetPulse - Local Image Server]
  
  이 파일은 병원 내 서버 PC에서 실행해야 합니다.
  실행 방법:
  1. Node.js 설치
  2. 터미널 열기
  3. npm init -y
  4. npm install express cors multer https fs
  5. node local_server_script.js
  
  * 사설 인증서(Self-Signed Cert) 생성 방법 (Windows/Mac)
  1. mkcert 설치 (추천)
  2. mkcert -install
  3. mkcert localhost 192.168.0.x (병원 서버 IP)
  4. 생성된 파일 이름을 key.pem, cert.pem으로 변경하고 이 폴더에 두세요.
*/

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');

// --- 설정 ---
const PORT = 3000;
const IP_ADDRESS = '0.0.0.0'; // 모든 내부 IP에서 접근 허용
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 업로드 폴더 자동 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const app = express();

// CORS 허용 (모든 곳에서 접속 가능하게)
app.use(cors());

// 정적 파일 제공 (이미지 조회용)
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer 설정 (이미지 저장)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // 파일명 중복 방지 (타임스탬프 + 랜덤숫자)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// 업로드 라우트
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 서버의 IP 주소를 자동으로 감지해서 URL 생성하면 좋지만,
  // 여기서는 편의상 요청 온 Host 헤더를 사용합니다.
  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('host'); // e.g., 192.168.0.10:3000
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  console.log(`[Image Saved] ${fileUrl}`);
  res.json({ url: fileUrl });
});

// 삭제 라우트
app.delete('/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename) {
    return res.status(400).json({ error: 'Filename required' });
  }

  // 보안 체크: 파일 경로 조작 방지
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  
  // 파일 존재 여부 확인
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    console.log(`[Image Deleted] ${filename}`);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    console.error(`[Delete Error] ${filename}:`, err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// --- 서버 실행 ---

// 1. HTTPS 모드 (인증서가 있는 경우 - 권장)
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  https.createServer(httpsOptions, app).listen(PORT, IP_ADDRESS, () => {
    console.log(`✅ Secure Local Image Server running at https://${IP_ADDRESS}:${PORT}`);
    console.log(`   (Ensure clients trust the 'cert.pem' root CA)`);
  });
} else {
  // 2. HTTP 모드 (인증서 없는 경우 - 아이패드 카메라 작동 안 함)
  console.warn('⚠️ WARNING: SSL Certificates (cert.pem, key.pem) not found.');
  console.warn('   Server starting in HTTP mode. iPad Camera will NOT work.');
  
  app.listen(PORT, IP_ADDRESS, () => {
    console.log(`🚀 Local Image Server running at http://${IP_ADDRESS}:${PORT}`);
  });
}
